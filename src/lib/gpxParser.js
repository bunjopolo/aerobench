import { haversine, calcBearing, savgol } from './physics'
import FitParser from 'fit-file-parser'

const parseGpxExtensionSpeed = (extNode) => {
  if (!extNode) return null

  const candidates = ['speed', 'ns3:speed', 'gpxtpx:speed', 'ns2:speed']
  for (const tag of candidates) {
    const node = extNode.getElementsByTagName(tag)[0]
    if (!node) continue
    const raw = parseFloat(node.textContent)
    if (!Number.isFinite(raw)) continue
    if (raw < 0) return null
    // GPX speed extensions are usually m/s; handle occasional km/h exports.
    return raw > 25 ? raw / 3.6 : raw
  }

  return null
}

const computeAcceleration = (time, velocity) => {
  const acc = new Array(velocity.length).fill(0)
  for (let i = 1; i < velocity.length - 1; i++) {
    const dt = time[i + 1] - time[i - 1]
    if (!Number.isFinite(dt) || dt <= 0) {
      acc[i] = 0
      continue
    }
    const ai = (velocity[i + 1] - velocity[i - 1]) / dt
    acc[i] = Number.isFinite(ai) ? ai : 0
  }
  return acc
}

// Parse FIT file (binary format from Garmin/Wahoo/etc)
export const parseFIT = (arrayBuffer) => {
  return new Promise((resolve, reject) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      elapsedRecordField: true
    })

    fitParser.parse(arrayBuffer, (error, data) => {
      if (error) {
        reject(new Error(`FIT parse error: ${error}`))
        return
      }

      const records = data.records || []
      const laps = data.laps || []
      const pts = []
      let cum = 0, pLat = null, pLon = null, st = null, pTime = null
      let powerPointCount = 0

      for (const rec of records) {
        // Skip records without position data
        if (rec.position_lat === undefined || rec.position_long === undefined) continue

        const lat = rec.position_lat
        const lon = rec.position_long
        const ele = rec.altitude || rec.enhanced_altitude || 0
        const pwr = rec.power || 0
        const speedRec = rec.enhanced_speed ?? rec.speed
        const spd = Number.isFinite(speedRec) && speedRec >= 0 ? speedRec : null
        const tObj = rec.timestamp ? new Date(rec.timestamp) : null

        if (!tObj || isNaN(tObj.getTime())) continue
        if (pTime && tObj <= pTime) continue
        if (!st) st = tObj

        if (pwr > 0) powerPointCount++

        let ds = 0, b = 0
        if (pLat !== null) {
          ds = haversine(pLat, pLon, lat, lon)
          b = calcBearing(pLat * Math.PI / 180, pLon * Math.PI / 180, lat * Math.PI / 180, lon * Math.PI / 180)
        }
        cum += ds

        pts.push({
          t: (tObj - st) / 1000,
          lat, lon, ele, pwr, spd, cum, ds, b
        })

        pLat = lat
        pLon = lon
        pTime = tObj
      }

      if (pts.length === 0) {
        reject(new Error('No valid GPS data found in FIT file'))
        return
      }

      const t = pts.map(d => d.t)
      const vRaw = pts.map((d, i) => i === 0 ? 0 : d.ds / Math.max(0.05, t[i] - t[i - 1]))
      const vGps = savgol(vRaw)
      const aGps = computeAcceleration(t, vGps)
      const wheelSpeedPointCount = pts.filter(d => Number.isFinite(d.spd)).length
      const hasWheelSpeed = pts.length > 0 && wheelSpeedPointCount / pts.length > 0.5
      const vWheel = hasWheelSpeed ? savgol(pts.map((d, i) => Number.isFinite(d.spd) ? d.spd : vGps[i])) : null
      const aWheel = hasWheelSpeed ? computeAcceleration(t, vWheel) : null

      const hasPowerData = pts.length > 0 && powerPointCount / pts.length > 0.5

      // Extract lap markers - find the distance at each lap end time
      const lapMarkers = []
      for (let i = 0; i < laps.length; i++) {
        const lap = laps[i]
        const lapTime = lap.timestamp ? new Date(lap.timestamp) : null
        if (!lapTime || !st) continue

        const lapSeconds = (lapTime - st) / 1000
        // Find the closest point to this lap time
        let closestIdx = 0
        let closestDiff = Infinity
        for (let j = 0; j < pts.length; j++) {
          const diff = Math.abs(pts[j].t - lapSeconds)
          if (diff < closestDiff) {
            closestDiff = diff
            closestIdx = j
          }
        }

        if (closestDiff < 10) { // Within 10 seconds
          lapMarkers.push({
            distance: pts[closestIdx].cum,
            name: `Lap ${i + 1}`,
            time: lapSeconds
          })
        }
      }

      resolve({
        data: {
          t: pts.map(d => d.t),
          dist: pts.map(d => d.cum),
          pwr: pts.map(d => d.pwr),
          ele: pts.map(d => d.ele),
          lat: pts.map(d => d.lat),
          lon: pts.map(d => d.lon),
          v: vGps,
          a: aGps,
          vGps,
          aGps,
          vWheel,
          aWheel,
          hasWheelSpeed,
          b: pts.map(d => d.b),
          ds: pts.map(d => d.ds)
        },
        startTime: st,
        hasPowerData,
        lapMarkers
      })
    })
  })
}

// Unified parser - auto-detects file type and returns consistent format
export const parseActivityFile = async (file) => {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.fit')) {
    const arrayBuffer = await file.arrayBuffer()
    return parseFIT(arrayBuffer)
  } else if (fileName.endsWith('.gpx')) {
    const text = await file.text()
    return parseGPX(text)
  } else {
    // Try to detect by content
    const arrayBuffer = await file.arrayBuffer()
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 12))
    const fitSignature = String.fromCharCode(...firstBytes.slice(8, 12))

    if (fitSignature === '.FIT') {
      return parseFIT(arrayBuffer)
    }

    // Try as GPX
    const text = new TextDecoder().decode(arrayBuffer)
    if (text.includes('<gpx') || text.includes('<trk')) {
      return parseGPX(text)
    }

    throw new Error('Unsupported file format. Please use GPX or FIT files.')
  }
}

// Parse GPX file and return processed data
export const parseGPX = (xmlString) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlString, "text/xml")
  const trk = xml.getElementsByTagName("trkpt")
  const pts = []
  let cum = 0, pLat = null, pLon = null, st = null, pTime = null
  let powerPointCount = 0  // Track how many points have power data

  for (let i = 0; i < trk.length; i++) {
    const pt = trk[i]
    const lat = parseFloat(pt.getAttribute("lat"))
    const lon = parseFloat(pt.getAttribute("lon"))
    const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || 0)
    const timeStr = pt.getElementsByTagName("time")[0]?.textContent
    const tObj = timeStr ? new Date(timeStr) : new Date(st ? st.getTime() + i * 1000 : 0)

    // Skip invalid dates
    if (isNaN(tObj.getTime())) continue
    if (pTime && tObj <= pTime) continue
    if (i === 0 || !st) st = tObj

    let pwr = 0
    const ext = pt.getElementsByTagName("extensions")[0]
    const spd = parseGpxExtensionSpeed(ext)
    if (ext) {
      const w = ext.getElementsByTagName("watts")[0] ||
                ext.getElementsByTagName("power")[0] ||
                ext.getElementsByTagName("ns3:watts")[0]
      if (w) {
        pwr = parseFloat(w.textContent)
        if (pwr > 0) powerPointCount++
      }
    }

    let ds = 0, b = 0
    if (pLat !== null) {
      ds = haversine(pLat, pLon, lat, lon)
      b = calcBearing(pLat * Math.PI / 180, pLon * Math.PI / 180, lat * Math.PI / 180, lon * Math.PI / 180)
    }
    cum += ds
    pts.push({ t: (tObj - st) / 1000, lat, lon, ele, pwr, spd, cum, ds, b })
    pLat = lat
    pLon = lon
    pTime = tObj
  }

  const t = pts.map(d => d.t)
  const vRaw = pts.map((d, i) => i === 0 ? 0 : d.ds / Math.max(0.05, t[i] - t[i - 1]))
  const vGps = savgol(vRaw)
  const aGps = computeAcceleration(t, vGps)
  const wheelSpeedPointCount = pts.filter(d => Number.isFinite(d.spd)).length
  const hasWheelSpeed = pts.length > 0 && wheelSpeedPointCount / pts.length > 0.5
  const vWheel = hasWheelSpeed ? savgol(pts.map((d, i) => Number.isFinite(d.spd) ? d.spd : vGps[i])) : null
  const aWheel = hasWheelSpeed ? computeAcceleration(t, vWheel) : null

  // Determine if file has meaningful power data (at least 50% of points)
  const hasPowerData = pts.length > 0 && powerPointCount / pts.length > 0.5

  return {
    data: {
      t: pts.map(d => d.t),
      dist: pts.map(d => d.cum),
      pwr: pts.map(d => d.pwr),
      ele: pts.map(d => d.ele),
      lat: pts.map(d => d.lat),
      lon: pts.map(d => d.lon),
      v: vGps,
      a: aGps,
      vGps,
      aGps,
      vWheel,
      aWheel,
      hasWheelSpeed,
      b: pts.map(d => d.b),
      ds: pts.map(d => d.ds)
    },
    startTime: st,
    hasPowerData,
    lapMarkers: [] // GPX files typically don't have lap data
  }
}

// Parse route GPX for estimator (enhanced with cumulative distances and bearings)
export const parseRouteGPX = (xmlString) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlString, "text/xml")
  const trk = xml.getElementsByTagName("trkpt")
  const segments = []
  const cumDist = []  // Cumulative distance at end of each segment
  let totalDist = 0
  let gain = 0
  let loss = 0
  let pLat = null, pLon = null, pEle = null

  for (let i = 0; i < trk.length; i++) {
    const pt = trk[i]
    const lat = parseFloat(pt.getAttribute("lat"))
    const lon = parseFloat(pt.getAttribute("lon"))
    const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || 0)

    if (pLat !== null) {
      const d = haversine(pLat, pLon, lat, lon)
      const de = ele - pEle

      if (d >= 1) {
        // Calculate grade
        let grade = (de / d) * 100
        grade = Math.max(-50, Math.min(50, grade))

        // Calculate bearing (direction of travel) in degrees
        // 0 = North, 90 = East, 180 = South, 270 = West
        const bearing = calcBearing(
          pLat * Math.PI / 180,
          pLon * Math.PI / 180,
          lat * Math.PI / 180,
          lon * Math.PI / 180
        )

        segments.push({
          d,              // segment distance in meters
          g: grade,       // gradient in percent
          ele: (ele + pEle) / 2,  // average elevation for air density
          bearing         // direction of travel in degrees
        })

        totalDist += d
        cumDist.push(totalDist)

        if (de > 0) gain += de
        else loss += Math.abs(de)
      }
    }
    pLat = lat
    pLon = lon
    pEle = ele
  }

  return {
    segments,
    cumDist,      // Cumulative distance array for interpolation
    totalDist,
    gain,
    loss
  }
}
