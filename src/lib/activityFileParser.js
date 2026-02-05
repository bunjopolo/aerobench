import { haversine, calcBearing, savgol } from './physics'
import FitParser from 'fit-file-parser'

// Process raw points into final data format (shared between GPX and FIT)
const processPoints = (pts, lapTimestamps = []) => {
  if (pts.length === 0) {
    return {
      data: { dist: [], pwr: [], ele: [], lat: [], lon: [], v: [], a: [], b: [], ds: [] },
      startTime: null,
      hasPowerData: false,
      isSmartRecording: false,
      avgInterval: 1,
      lapMarkers: []
    }
  }

  const st = pts[0].time
  const t = pts.map(d => d.t)
  const vRaw = pts.map((d, i) => i === 0 ? 0 : d.ds / Math.max(0.05, t[i] - t[i - 1]))
  const vSm = savgol(vRaw)
  const acc = vSm.map((v, i) => (i === 0 || i === vSm.length - 1) ? 0 : (vSm[i + 1] - vSm[i - 1]) / (t[i + 1] - t[i - 1]))

  // Count power points
  const powerPointCount = pts.filter(p => p.pwr > 0).length
  const hasPowerData = pts.length > 0 && powerPointCount / pts.length > 0.5

  // Detect smart recording
  let longIntervalCount = 0
  const intervals = []
  for (let i = 1; i < pts.length; i++) {
    const interval = pts[i].t - pts[i - 1].t
    intervals.push(interval)
    if (interval > 1.5) longIntervalCount++
  }
  const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 1
  const isSmartRecording = pts.length > 10 && (longIntervalCount / intervals.length > 0.2 || avgInterval > 1.5)

  // Match lap timestamps to track points
  const lapMarkers = []
  lapTimestamps.forEach((lapTime, idx) => {
    let bestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < pts.length; i++) {
      const diff = Math.abs(pts[i].t - lapTime)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }
    if (bestDiff < 10) { // Within 10 seconds
      lapMarkers.push({
        index: bestIdx,
        distance: pts[bestIdx].cum,
        name: `Lap ${idx + 1}`
      })
    }
  })
  lapMarkers.sort((a, b) => a.distance - b.distance)

  return {
    data: {
      dist: pts.map(d => d.cum),
      pwr: pts.map(d => d.pwr),
      ele: pts.map(d => d.ele),
      lat: pts.map(d => d.lat),
      lon: pts.map(d => d.lon),
      v: vSm,
      a: acc,
      b: pts.map(d => d.b),
      ds: pts.map(d => d.ds)
    },
    startTime: st,
    hasPowerData,
    isSmartRecording,
    avgInterval: Math.round(avgInterval * 10) / 10,
    lapMarkers
  }
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
      let cum = 0, pLat = null, pLon = null, st = null

      for (const rec of records) {
        // Skip records without position data
        if (rec.position_lat === undefined || rec.position_long === undefined) continue

        const lat = rec.position_lat
        const lon = rec.position_long
        const ele = rec.altitude || rec.enhanced_altitude || 0
        const pwr = rec.power || 0
        const tObj = rec.timestamp ? new Date(rec.timestamp) : null

        if (!tObj || isNaN(tObj.getTime())) continue
        if (!st) st = tObj

        let ds = 0, b = 0
        if (pLat !== null) {
          ds = haversine(pLat, pLon, lat, lon)
          b = calcBearing(pLat * Math.PI / 180, pLon * Math.PI / 180, lat * Math.PI / 180, lon * Math.PI / 180)
        }
        cum += ds

        pts.push({
          t: (tObj - st) / 1000,
          time: tObj,
          lat, lon, ele, pwr, cum, ds, b
        })

        pLat = lat
        pLon = lon
      }

      // Extract lap timestamps (relative to start)
      const lapTimestamps = laps
        .filter(lap => lap.timestamp && st)
        .map(lap => (new Date(lap.timestamp) - st) / 1000)

      resolve(processPoints(pts, lapTimestamps))
    })
  })
}

// Parse GPX file and return processed data
export const parseGPX = (xmlString) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlString, "text/xml")
  const trk = xml.getElementsByTagName("trkpt")
  const pts = []
  let cum = 0, pLat = null, pLon = null, st = null

  // Parse waypoints for lap markers
  const waypoints = xml.getElementsByTagName("wpt")
  const lapWaypoints = []
  for (let i = 0; i < waypoints.length; i++) {
    const wpt = waypoints[i]
    const lat = parseFloat(wpt.getAttribute("lat"))
    const lon = parseFloat(wpt.getAttribute("lon"))
    const name = wpt.getElementsByTagName("name")[0]?.textContent || `Lap ${i + 1}`
    const timeStr = wpt.getElementsByTagName("time")[0]?.textContent
    const time = timeStr ? new Date(timeStr) : null
    lapWaypoints.push({ lat, lon, name, time })
  }

  for (let i = 0; i < trk.length; i++) {
    const pt = trk[i]
    const lat = parseFloat(pt.getAttribute("lat"))
    const lon = parseFloat(pt.getAttribute("lon"))
    const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || 0)
    const timeStr = pt.getElementsByTagName("time")[0]?.textContent
    const tObj = timeStr ? new Date(timeStr) : new Date(st ? st.getTime() + i * 1000 : 0)

    // Skip invalid dates
    if (isNaN(tObj.getTime())) continue
    if (i === 0 || !st) st = tObj

    let pwr = 0
    const ext = pt.getElementsByTagName("extensions")[0]
    if (ext) {
      const w = ext.getElementsByTagName("watts")[0] ||
                ext.getElementsByTagName("power")[0] ||
                ext.getElementsByTagName("ns3:watts")[0]
      if (w) {
        pwr = parseFloat(w.textContent)
      }
    }

    let ds = 0, b = 0
    if (pLat !== null) {
      ds = haversine(pLat, pLon, lat, lon)
      b = calcBearing(pLat * Math.PI / 180, pLon * Math.PI / 180, lat * Math.PI / 180, lon * Math.PI / 180)
    }
    cum += ds
    pts.push({ t: (tObj - st) / 1000, time: tObj, lat, lon, ele, pwr, cum, ds, b })
    pLat = lat
    pLon = lon
  }

  // Convert waypoint lap markers to timestamps for GPX
  // For GPX we handle lap markers specially since they may have custom names
  const result = processPoints(pts, [])

  // Override lap markers with GPX waypoints (they have custom names)
  const gpxLapMarkers = []
  for (const wpt of lapWaypoints) {
    let bestIdx = 0
    let bestScore = Infinity

    for (let i = 0; i < pts.length; i++) {
      if (wpt.time && st) {
        const timeDiff = Math.abs((wpt.time - st) / 1000 - pts[i].t)
        if (timeDiff < bestScore) {
          bestScore = timeDiff
          bestIdx = i
        }
      } else {
        const dist = haversine(wpt.lat, wpt.lon, pts[i].lat, pts[i].lon)
        if (dist < bestScore) {
          bestScore = dist
          bestIdx = i
        }
      }
    }

    if ((wpt.time && bestScore < 10) || (!wpt.time && bestScore < 50)) {
      gpxLapMarkers.push({
        index: bestIdx,
        distance: pts[bestIdx]?.cum || 0,
        name: wpt.name
      })
    }
  }
  gpxLapMarkers.sort((a, b) => a.distance - b.distance)

  return {
    ...result,
    lapMarkers: gpxLapMarkers.length > 0 ? gpxLapMarkers : result.lapMarkers
  }
}

// Unified parser that auto-detects file type based on content/extension
// Returns a Promise for consistent async handling
export const parseActivityFile = async (file) => {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.fit')) {
    // FIT file - binary format
    const arrayBuffer = await file.arrayBuffer()
    return parseFIT(arrayBuffer)
  } else if (fileName.endsWith('.gpx') || fileName.endsWith('.xml')) {
    // GPX file - XML format
    const text = await file.text()
    return parseGPX(text)
  } else {
    // Try to detect by content
    const arrayBuffer = await file.arrayBuffer()
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 12))

    // FIT files start with header size byte, then ".FIT" signature at bytes 8-11
    const fitSignature = String.fromCharCode(...firstBytes.slice(8, 12))
    if (fitSignature === '.FIT') {
      return parseFIT(arrayBuffer)
    }

    // Otherwise try as GPX
    const text = new TextDecoder().decode(arrayBuffer)
    if (text.includes('<gpx') || text.includes('<trk')) {
      return parseGPX(text)
    }

    throw new Error('Unsupported file format. Please use GPX or FIT files.')
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
