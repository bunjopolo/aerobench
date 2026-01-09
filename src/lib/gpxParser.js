import { haversine, calcBearing, savgol } from './physics'

// Parse GPX file and return processed data
export const parseGPX = (xmlString) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlString, "text/xml")
  const trk = xml.getElementsByTagName("trkpt")
  const pts = []
  let cum = 0, pLat = null, pLon = null, st = null

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
      if (w) pwr = parseFloat(w.textContent)
    }

    let ds = 0, b = 0
    if (pLat !== null) {
      ds = haversine(pLat, pLon, lat, lon)
      b = calcBearing(pLat * Math.PI / 180, pLon * Math.PI / 180, lat * Math.PI / 180, lon * Math.PI / 180)
    }
    cum += ds
    pts.push({ t: (tObj - st) / 1000, lat, lon, ele, pwr, cum, ds, b })
    pLat = lat
    pLon = lon
  }

  const t = pts.map(d => d.t)
  const vRaw = pts.map((d, i) => i === 0 ? 0 : d.ds / Math.max(0.05, t[i] - t[i - 1]))
  const vSm = savgol(vRaw)
  const acc = vSm.map((v, i) => (i === 0 || i === vSm.length - 1) ? 0 : (vSm[i + 1] - vSm[i - 1]) / (t[i + 1] - t[i - 1]))

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
    startTime: st
  }
}

// Parse route GPX for estimator
export const parseRouteGPX = (xmlString) => {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlString, "text/xml")
  const trk = xml.getElementsByTagName("trkpt")
  const segments = []
  let totalDist = 0
  let gain = 0
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
        let grade = (de / d) * 100
        grade = Math.max(-50, Math.min(50, grade))
        segments.push({ d, g: grade, ele: (ele + pEle) / 2 })
        totalDist += d
        if (de > 0) gain += de
      }
    }
    pLat = lat
    pLon = lon
    pEle = ele
  }

  return { segments, totalDist, gain }
}
