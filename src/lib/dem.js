import { fromArrayBuffer } from 'geotiff'
import proj4 from 'proj4'

const EPSG_4326 = 'EPSG:4326'

const parseHeaderValue = (line, key) => {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 2) return null
  if (parts[0].toLowerCase() !== key) return null
  const value = Number(parts[1])
  return Number.isFinite(value) ? value : null
}

const getCellValue = (grid, rowTop, col) => {
  if (rowTop < 0 || rowTop >= grid.nrows || col < 0 || col >= grid.ncols) return null
  const v = grid.values[rowTop * grid.ncols + col]
  if (!Number.isFinite(v)) return null
  if (Number.isFinite(grid.nodata) && v === grid.nodata) return null
  return v
}

const sampleGridByRowCol = (grid, rowFloat, colFloat) => {
  const c0 = Math.floor(colFloat)
  const r0 = Math.floor(rowFloat)
  const c1 = c0 + 1
  const r1 = r0 + 1

  if (c0 < 0 || r0 < 0 || c1 >= grid.ncols || r1 >= grid.nrows) return null

  const q11 = getCellValue(grid, r0, c0)
  const q21 = getCellValue(grid, r0, c1)
  const q12 = getCellValue(grid, r1, c0)
  const q22 = getCellValue(grid, r1, c1)
  const tx = colFloat - c0
  const ty = rowFloat - r0

  if ([q11, q21, q12, q22].every(v => Number.isFinite(v))) {
    const top = q11 * (1 - tx) + q21 * tx
    const bottom = q12 * (1 - tx) + q22 * tx
    return top * (1 - ty) + bottom * ty
  }

  const nearCol = Math.round(colFloat)
  const nearRow = Math.round(rowFloat)
  return getCellValue(grid, nearRow, nearCol)
}

const parseWorldFile = (text) => {
  const nums = text
    .split(/\r?\n/)
    .map(v => Number(v.trim()))
    .filter(v => Number.isFinite(v))

  if (nums.length < 6) {
    throw new Error('Invalid world file: expected 6 numeric lines')
  }

  // A, D, B, E, C, F
  return {
    a: nums[0],
    d: nums[1],
    b: nums[2],
    e: nums[3],
    c: nums[4],
    f: nums[5]
  }
}

const buildUtmProjFromEpsg = (epsgCode) => {
  if (epsgCode >= 32601 && epsgCode <= 32660) {
    return `+proj=utm +zone=${epsgCode - 32600} +datum=WGS84 +units=m +no_defs`
  }
  if (epsgCode >= 32701 && epsgCode <= 32760) {
    return `+proj=utm +zone=${epsgCode - 32700} +south +datum=WGS84 +units=m +no_defs`
  }
  return null
}

const parsePrjToProj4 = (prjText) => {
  if (!prjText || typeof prjText !== 'string') return null
  const normalized = prjText.replace(/\s+/g, ' ').trim()

  if (/WGS[_ ]?84/i.test(normalized) && /GEOGCS|GEOGRAPHICCRS/i.test(normalized)) {
    return proj4.WGS84
  }

  const utmMatch = normalized.match(/UTM[^0-9]*([0-9]{1,2})\s*([NS])?/i)
  if (utmMatch && /WGS[_ ]?84/i.test(normalized)) {
    const zone = Number(utmMatch[1])
    if (Number.isFinite(zone) && zone >= 1 && zone <= 60) {
      const south = (utmMatch[2] || '').toUpperCase() === 'S'
      return `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`
    }
  }

  return null
}

const getProjectionFromGeoKeys = (geoKeys) => {
  if (!geoKeys) return null
  if (Number.isFinite(geoKeys.ProjectedCSTypeGeoKey)) {
    const epsg = geoKeys.ProjectedCSTypeGeoKey
    if (epsg === 4326) return proj4.WGS84
    if (epsg === 3857) return proj4.defs('EPSG:3857')
    const utm = buildUtmProjFromEpsg(epsg)
    if (utm) return utm
  }
  if (Number.isFinite(geoKeys.GeographicTypeGeoKey) && geoKeys.GeographicTypeGeoKey === 4326) {
    return proj4.WGS84
  }
  return null
}

const geoToPixel = (affine, x, y) => {
  const det = affine.a * affine.e - affine.b * affine.d
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null

  const dx = x - affine.c
  const dy = y - affine.f

  const col = (affine.e * dx - affine.b * dy) / det
  const row = (-affine.d * dx + affine.a * dy) / det
  return { row, col }
}

const parseAsciiDem = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  let cursor = 0
  const ncols = parseHeaderValue(lines[cursor++], 'ncols')
  const nrows = parseHeaderValue(lines[cursor++], 'nrows')
  if (!Number.isFinite(ncols) || !Number.isFinite(nrows) || ncols <= 1 || nrows <= 1) {
    throw new Error('Invalid DEM header: ncols/nrows not found')
  }

  let xllcorner = null
  let xllcenter = null
  let yllcorner = null
  let yllcenter = null
  let cellsize = null
  let nodata = null

  while (cursor < lines.length) {
    const line = lines[cursor]
    const key = line.split(/\s+/)[0]?.toLowerCase()
    if (!key) {
      cursor++
      continue
    }
    if (key === 'xllcorner') xllcorner = parseHeaderValue(line, 'xllcorner')
    else if (key === 'xllcenter') xllcenter = parseHeaderValue(line, 'xllcenter')
    else if (key === 'yllcorner') yllcorner = parseHeaderValue(line, 'yllcorner')
    else if (key === 'yllcenter') yllcenter = parseHeaderValue(line, 'yllcenter')
    else if (key === 'cellsize') cellsize = parseHeaderValue(line, 'cellsize')
    else if (key === 'nodata_value') nodata = parseHeaderValue(line, 'nodata_value')
    else break
    cursor++
  }

  if (!Number.isFinite(cellsize) || cellsize <= 0) {
    throw new Error('Invalid DEM header: cellsize not found')
  }
  if ((!Number.isFinite(xllcorner) && !Number.isFinite(xllcenter)) || (!Number.isFinite(yllcorner) && !Number.isFinite(yllcenter))) {
    throw new Error('Invalid DEM header: xll/yll origin not found')
  }

  const values = lines
    .slice(cursor)
    .join(' ')
    .trim()
    .split(/\s+/)
    .map(v => Number(v))

  const expected = ncols * nrows
  if (values.length < expected) {
    throw new Error(`DEM grid is incomplete (expected ${expected} cells, found ${values.length})`)
  }

  const xMinCenter = Number.isFinite(xllcenter) ? xllcenter : xllcorner + cellsize / 2
  const yMinCenter = Number.isFinite(yllcenter) ? yllcenter : yllcorner + cellsize / 2

  const grid = {
    ncols,
    nrows,
    nodata,
    values: values.slice(0, expected)
  }

  return {
    sourceType: 'ascii',
    sample: (lat, lon) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      const colFloat = (lon - xMinCenter) / cellsize
      const rowFromBottomFloat = (lat - yMinCenter) / cellsize
      const rowTopFloat = (nrows - 1) - rowFromBottomFloat
      return sampleGridByRowCol(grid, rowTopFloat, colFloat)
    }
  }
}

const parseGeoTiffDem = async ({ tiffSource, worldFileText, prjText }) => {
  const tiff = await fromArrayBuffer(await tiffSource.arrayBuffer())
  const image = await tiff.getImage()
  const ncols = image.getWidth()
  const nrows = image.getHeight()
  if (ncols <= 1 || nrows <= 1) throw new Error('GeoTIFF has invalid dimensions')

  const raster = await image.readRasters({ interleave: true })
  const nodataRaw = image.getGDALNoData?.()
  const nodata = nodataRaw == null ? null : Number(nodataRaw)

  const grid = {
    ncols,
    nrows,
    nodata,
    values: Array.from(raster)
  }

  let affine = null
  if (worldFileText) {
    affine = parseWorldFile(worldFileText)
  } else {
    const bbox = image.getBoundingBox?.()
    if (!bbox || bbox.length < 4) {
      throw new Error('GeoTIFF is missing georeferencing (bbox/tiepoints)')
    }
    const [minX, minY, maxX, maxY] = bbox
    const a = (maxX - minX) / ncols
    const e = -(maxY - minY) / nrows
    const c = minX + a / 2
    const f = maxY + e / 2
    affine = { a, b: 0, c, d: 0, e, f }
  }

  let srcProj = null
  const prjProj = parsePrjToProj4(prjText)
  if (prjProj) srcProj = prjProj
  if (!srcProj) {
    const geoKeys = image.getGeoKeys?.()
    srcProj = getProjectionFromGeoKeys(geoKeys)
  }

  const mapWgs84ToRaster = (lat, lon) => {
    if (!srcProj) return { x: lon, y: lat }
    if (srcProj === proj4.WGS84) return { x: lon, y: lat }
    const [x, y] = proj4(EPSG_4326, srcProj, [lon, lat])
    return { x, y }
  }

  return {
    sourceType: 'geotiff',
    sample: (lat, lon) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      let coords
      try {
        coords = mapWgs84ToRaster(lat, lon)
      } catch {
        return null
      }
      const px = geoToPixel(affine, coords.x, coords.y)
      if (!px) return null
      return sampleGridByRowCol(grid, px.row, px.col)
    }
  }
}

export const parseDemUpload = async (input) => {
  const files = Array.from(input || [])
  if (files.length === 0) throw new Error('No DEM files selected')

  const tiffFile = files.find(f => /\.(tif|tiff)$/i.test(f.name))
  const ascFile = files.find(f => /\.(asc|txt)$/i.test(f.name))
  const worldFile = files.find(f => /\.(tfw|tifw)$/i.test(f.name))
  const prjFile = files.find(f => /\.prj$/i.test(f.name))

  if (tiffFile) {
    const worldFileText = worldFile ? await worldFile.text() : null
    const prjText = prjFile ? await prjFile.text() : null
    return parseGeoTiffDem({ tiffSource: tiffFile, worldFileText, prjText })
  }

  if (ascFile) {
    return parseAsciiDem(await ascFile.text())
  }

  throw new Error('Unsupported DEM upload. Use .asc or .tif/.tiff files.')
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const computeActivityBoundingBox = (activityData, startIndex = 0, endIndex = null) => {
  const lat = Array.isArray(activityData?.lat) ? activityData.lat : []
  const lon = Array.isArray(activityData?.lon) ? activityData.lon : []
  const len = Math.min(lat.length, lon.length)
  if (len < 2) return null

  const si = clamp(Math.floor(startIndex), 0, len - 1)
  const ei = clamp(endIndex == null ? len : Math.floor(endIndex), si + 1, len)

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity

  for (let i = si; i < ei; i++) {
    const la = Number(lat[i])
    const lo = Number(lon[i])
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue
    minLat = Math.min(minLat, la)
    maxLat = Math.max(maxLat, la)
    minLon = Math.min(minLon, lo)
    maxLon = Math.max(maxLon, lo)
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLon) || !Number.isFinite(maxLat) || !Number.isFinite(maxLon)) {
    return null
  }

  return { south: minLat, north: maxLat, west: minLon, east: maxLon }
}

const OPENTOPO_BASE_URL = 'https://portal.opentopography.org/API/globaldem'
const DEFAULT_DEM_ORDER = ['COP30', 'NASADEM', 'SRTMGL1', 'AW3D30', 'COP90', 'SRTMGL3']
// OpenTopography can reject very small request windows.
// Keep a conservative minimum span and expand around the selected center when needed.
const MIN_OPENTOPO_LAT_SPAN_DEG = 0.01
const MIN_OPENTOPO_LON_SPAN_DEG = 0.01

const enforceMinimumBboxSpan = (bbox) => {
  const out = { ...bbox }
  const latSpan = out.north - out.south
  const lonSpan = out.east - out.west

  if (latSpan < MIN_OPENTOPO_LAT_SPAN_DEG) {
    const center = (out.north + out.south) * 0.5
    const half = MIN_OPENTOPO_LAT_SPAN_DEG * 0.5
    out.south = clamp(center - half, -90, 90)
    out.north = clamp(center + half, -90, 90)
    if (out.north - out.south < MIN_OPENTOPO_LAT_SPAN_DEG) {
      // Handle poles after clamping.
      if (out.south <= -90) out.north = clamp(-90 + MIN_OPENTOPO_LAT_SPAN_DEG, -90, 90)
      if (out.north >= 90) out.south = clamp(90 - MIN_OPENTOPO_LAT_SPAN_DEG, -90, 90)
    }
  }

  if (lonSpan < MIN_OPENTOPO_LON_SPAN_DEG) {
    const center = (out.east + out.west) * 0.5
    const half = MIN_OPENTOPO_LON_SPAN_DEG * 0.5
    out.west = clamp(center - half, -180, 180)
    out.east = clamp(center + half, -180, 180)
    if (out.east - out.west < MIN_OPENTOPO_LON_SPAN_DEG) {
      // Handle antimeridian bounds after clamping.
      if (out.west <= -180) out.east = clamp(-180 + MIN_OPENTOPO_LON_SPAN_DEG, -180, 180)
      if (out.east >= 180) out.west = clamp(180 - MIN_OPENTOPO_LON_SPAN_DEG, -180, 180)
    }
  }

  return out
}

export const fetchDemFromOpenTopography = async (activityData, {
  apiKey,
  startIndex = 0,
  endIndex = null,
  datasetOrder = DEFAULT_DEM_ORDER,
  outputFormat = 'GTiff',
  paddingDeg = 0.0003
} = {}) => {
  if (!apiKey) throw new Error('Missing OpenTopography API key')

  const bboxRaw = computeActivityBoundingBox(activityData, startIndex, endIndex)
  if (!bboxRaw) throw new Error('No valid GPS coordinates found in this activity')

  const bbox = {
    south: clamp(bboxRaw.south - paddingDeg, -90, 90),
    north: clamp(bboxRaw.north + paddingDeg, -90, 90),
    west: clamp(bboxRaw.west - paddingDeg, -180, 180),
    east: clamp(bboxRaw.east + paddingDeg, -180, 180)
  }
  const clampedBbox = enforceMinimumBboxSpan(bbox)

  let lastError = null
  for (const demtype of datasetOrder) {
    const params = new URLSearchParams({
      demtype,
      south: String(clampedBbox.south),
      north: String(clampedBbox.north),
      west: String(clampedBbox.west),
      east: String(clampedBbox.east),
      outputFormat,
      API_Key: apiKey
    })

    const response = await fetch(`${OPENTOPO_BASE_URL}?${params.toString()}`)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      lastError = new Error(`OpenTopography ${demtype} failed (${response.status}): ${body || response.statusText}`)
      if (response.status === 401 || response.status === 403) throw lastError
      continue
    }

    try {
      const blob = await response.blob()
      const dem = await parseGeoTiffDem({ tiffSource: blob, worldFileText: null, prjText: null })
      return {
        ...dem,
        sourceType: `opentopography:${demtype}`,
        meta: { demtype, bbox: clampedBbox }
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('OpenTopography DEM request failed')
}

export const applyDemToActivity = (activityData, dem) => {
  if (!activityData || !Array.isArray(activityData.ele) || !Array.isArray(activityData.lat) || !Array.isArray(activityData.lon) || !dem?.sample) {
    return { elevation: activityData?.ele || [], coveragePct: 0, coveredPoints: 0 }
  }

  const n = activityData.ele.length
  const eleDem = new Array(n)
  let coveredPoints = 0

  for (let i = 0; i < n; i++) {
    const sampled = dem.sample(activityData.lat[i], activityData.lon[i])
    if (Number.isFinite(sampled)) {
      eleDem[i] = sampled
      coveredPoints++
    } else {
      eleDem[i] = activityData.ele[i]
    }
  }

  return {
    elevation: eleDem,
    coveredPoints,
    coveragePct: n > 0 ? (coveredPoints / n) * 100 : 0
  }
}

const binarySearchFloor = (arr, value) => {
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= value) lo = mid + 1
    else hi = mid - 1
  }
  return clamp(hi, 0, arr.length - 2)
}

export const applyVeSamplingFilter = ({
  elevation,
  dist,
  t,
  v,
  minWindowMeters = 1,
  maxWindowMeters = 120
}) => {
  if (!Array.isArray(elevation) || !Array.isArray(dist) || elevation.length !== dist.length || elevation.length < 3) {
    return elevation
  }
  const n = elevation.length

  const d = new Array(n)
  const z = new Array(n)
  for (let i = 0; i < n; i++) {
    const di = Number(dist[i])
    const zi = Number(elevation[i])
    d[i] = Number.isFinite(di) ? di : (i > 0 ? d[i - 1] : 0)
    z[i] = Number.isFinite(zi) ? zi : (i > 0 ? z[i - 1] : 0)
  }

  const integral = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dd = Math.max(0, d[i] - d[i - 1])
    integral[i] = integral[i - 1] + 0.5 * (z[i - 1] + z[i]) * dd
  }

  const integralAt = (s) => {
    if (s <= d[0]) return integral[0]
    if (s >= d[n - 1]) return integral[n - 1]
    const k = binarySearchFloor(d, s)
    const dd = d[k + 1] - d[k]
    if (!Number.isFinite(dd) || dd <= 1e-9) return integral[k]
    const dx = s - d[k]
    const m = (z[k + 1] - z[k]) / dd
    const area = z[k] * dx + 0.5 * m * dx * dx
    return integral[k] + area
  }

  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let dt
    if (Array.isArray(t) && t.length === n) {
      if (i === 0) dt = Number(t[1]) - Number(t[0])
      else if (i === n - 1) dt = Number(t[n - 1]) - Number(t[n - 2])
      else dt = 0.5 * (Number(t[i + 1]) - Number(t[i - 1]))
    } else {
      dt = i > 0 ? 1 : (n > 1 ? 1 : 0)
    }
    if (!Number.isFinite(dt) || dt <= 0) dt = 1

    let vi = Array.isArray(v) && v.length === n ? Number(v[i]) : NaN
    if (!Number.isFinite(vi) || vi < 0) {
      if (i > 0) {
        const dd = d[i] - d[i - 1]
        vi = Number.isFinite(dd) && dd >= 0 ? dd / dt : 0
      } else {
        vi = 0
      }
    }

    const L = clamp(vi * dt, minWindowMeters, maxWindowMeters)
    const half = L * 0.5
    const s0 = clamp(d[i] - half, d[0], d[n - 1])
    const s1 = clamp(d[i] + half, d[0], d[n - 1])
    const span = s1 - s0
    out[i] = span > 1e-6 ? (integralAt(s1) - integralAt(s0)) / span : z[i]
  }

  return out
}
