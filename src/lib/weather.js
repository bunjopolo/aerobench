const isFiniteNumber = (value) => Number.isFinite(value)

const normalizeDegrees = (degrees) => {
  if (!isFiniteNumber(degrees)) return null
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}

const pickRepresentativeIndex = (latSeries, lonSeries) => {
  if (!Array.isArray(latSeries) || !Array.isArray(lonSeries)) return -1
  const len = Math.min(latSeries.length, lonSeries.length)
  if (len === 0) return -1

  const mid = Math.floor(len / 2)
  const isValidPair = (idx) => (
    idx >= 0 &&
    idx < len &&
    isFiniteNumber(latSeries[idx]) &&
    isFiniteNumber(lonSeries[idx])
  )

  if (isValidPair(mid)) return mid
  for (let delta = 1; delta < len; delta++) {
    const left = mid - delta
    const right = mid + delta
    if (isValidPair(left)) return left
    if (isValidPair(right)) return right
  }
  return -1
}

const pickIndexNear = (latSeries, lonSeries, targetIndex) => {
  if (!Array.isArray(latSeries) || !Array.isArray(lonSeries)) return -1
  const len = Math.min(latSeries.length, lonSeries.length)
  if (len === 0) return -1

  const clamped = Math.max(0, Math.min(len - 1, Math.floor(targetIndex)))
  const isValidPair = (idx) => (
    idx >= 0 &&
    idx < len &&
    isFiniteNumber(latSeries[idx]) &&
    isFiniteNumber(lonSeries[idx])
  )

  if (isValidPair(clamped)) return clamped
  for (let delta = 1; delta < len; delta++) {
    const left = clamped - delta
    const right = clamped + delta
    if (isValidPair(left)) return left
    if (isValidPair(right)) return right
  }
  return -1
}

const parseUtcTime = (value) => {
  if (typeof value !== 'string') return Number.NaN
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value)
  const timestamp = Date.parse(hasTimezone ? value : `${value}Z`)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

const findClosestHourlyIndex = (timeSeries, targetMs, fallbackIndex) => {
  if (!Array.isArray(timeSeries) || timeSeries.length === 0 || !isFiniteNumber(targetMs)) {
    return fallbackIndex
  }

  let bestIdx = fallbackIndex
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < timeSeries.length; i++) {
    const ts = parseUtcTime(timeSeries[i])
    if (!isFiniteNumber(ts)) continue
    const diff = Math.abs(ts - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  }
  return bestIdx
}

const readHourlyValue = (hourly, key, idx) => {
  const series = hourly?.[key]
  if (!Array.isArray(series) || idx < 0 || idx >= series.length) return null
  const value = Number(series[idx])
  return isFiniteNumber(value) ? value : null
}

const addUtcDays = (date, days) => {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const findBracketingHourlyIndices = (timeSeries, targetMs) => {
  if (!Array.isArray(timeSeries) || timeSeries.length < 2 || !isFiniteNumber(targetMs)) return null
  const times = timeSeries.map(parseUtcTime)
  if (times.some(t => !isFiniteNumber(t))) return null

  if (targetMs <= times[0]) return { i0: 0, i1: 1, w: 0, times }
  if (targetMs >= times[times.length - 1]) {
    const last = times.length - 1
    return { i0: last - 1, i1: last, w: 1, times }
  }

  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i]
    const t1 = times[i + 1]
    if (targetMs >= t0 && targetMs <= t1) {
      const dt = t1 - t0
      const w = dt > 0 ? (targetMs - t0) / dt : 0
      return { i0: i, i1: i + 1, w: Math.max(0, Math.min(1, w)), times }
    }
  }
  return null
}

const interpolateHourlyValue = (hourly, key, bracket, fallbackIdx) => {
  if (!bracket) return readHourlyValue(hourly, key, fallbackIdx)
  const s = hourly?.[key]
  if (!Array.isArray(s)) return readHourlyValue(hourly, key, fallbackIdx)
  const v0 = Number(s[bracket.i0])
  const v1 = Number(s[bracket.i1])
  if (isFiniteNumber(v0) && isFiniteNumber(v1)) {
    return v0 + (v1 - v0) * bracket.w
  }
  if (isFiniteNumber(v0)) return v0
  if (isFiniteNumber(v1)) return v1
  return readHourlyValue(hourly, key, fallbackIdx)
}

const interpolateDirectionDeg = (hourly, key, bracket, fallbackIdx) => {
  if (!bracket) return normalizeDegrees(readHourlyValue(hourly, key, fallbackIdx))
  const s = hourly?.[key]
  if (!Array.isArray(s)) return normalizeDegrees(readHourlyValue(hourly, key, fallbackIdx))
  const d0 = normalizeDegrees(Number(s[bracket.i0]))
  const d1 = normalizeDegrees(Number(s[bracket.i1]))
  if (isFiniteNumber(d0) && isFiniteNumber(d1)) {
    const r0 = d0 * Math.PI / 180
    const r1 = d1 * Math.PI / 180
    const x = Math.cos(r0) * (1 - bracket.w) + Math.cos(r1) * bracket.w
    const y = Math.sin(r0) * (1 - bracket.w) + Math.sin(r1) * bracket.w
    if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return d0
    return normalizeDegrees(Math.atan2(y, x) * 180 / Math.PI)
  }
  if (isFiniteNumber(d0)) return d0
  if (isFiniteNumber(d1)) return d1
  return normalizeDegrees(readHourlyValue(hourly, key, fallbackIdx))
}

// Wind profile power law: V(z) = V(ref) * (z / z_ref)^alpha
// alpha = 0.22 keeps behavior close to the historical 0.6 conversion factor.
export const adjustWindSpeedToRiderHeight = (
  speedAt10mMs,
  {
    riderHeightM = 1.0,
    referenceHeightM = 10.0,
    alpha = 0.22
  } = {}
) => {
  if (!isFiniteNumber(speedAt10mMs)) return null
  if (!isFiniteNumber(riderHeightM) || !isFiniteNumber(referenceHeightM) || riderHeightM <= 0 || referenceHeightM <= 0) {
    return speedAt10mMs
  }
  const factor = Math.pow(riderHeightM / referenceHeightM, alpha)
  return speedAt10mMs * factor
}

export const fetchRideWeatherSnapshot = async ({ data, startTime, sampleIndex = null }) => {
  if (!data || !startTime) {
    throw new Error('Ride data and start time are required')
  }

  const idx = Number.isFinite(sampleIndex)
    ? pickIndexNear(data.lat, data.lon, sampleIndex)
    : pickRepresentativeIndex(data.lat, data.lon)
  if (idx < 0) {
    throw new Error('Ride file is missing valid GPS coordinates')
  }

  const latitude = Number(data.lat[idx])
  const longitude = Number(data.lon[idx])
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    throw new Error('Ride file is missing valid GPS coordinates')
  }

  const dateStartUtc = addUtcDays(startTime, -1).toISOString().slice(0, 10)
  const dateEndUtc = addUtcDays(startTime, 1).toISOString().slice(0, 10)
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', latitude.toString())
  url.searchParams.set('longitude', longitude.toString())
  url.searchParams.set('start_date', dateStartUtc)
  url.searchParams.set('end_date', dateEndUtc)
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set(
    'hourly',
    'wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,surface_pressure,pressure_msl'
  )

  const response = await fetch(url.toString())
  if (!response.ok) throw new Error('Weather service unavailable')

  const payload = await response.json()
  if (!payload?.hourly) throw new Error('No weather data available')

  const fallbackIndex = Math.max(0, Math.min(23, startTime.getUTCHours()))
  const targetMs = startTime.getTime()
  const sampleIdx = findClosestHourlyIndex(payload.hourly.time, targetMs, fallbackIndex)
  const bracket = findBracketingHourlyIndices(payload.hourly.time, targetMs)

  const windSpeed10mKmh = interpolateHourlyValue(payload.hourly, 'wind_speed_10m', bracket, sampleIdx)
  const windDirectionDeg = interpolateDirectionDeg(payload.hourly, 'wind_direction_10m', bracket, sampleIdx)
  const temperatureC = interpolateHourlyValue(payload.hourly, 'temperature_2m', bracket, sampleIdx)
  const humidityPct = interpolateHourlyValue(payload.hourly, 'relative_humidity_2m', bracket, sampleIdx)
  const surfacePressure = interpolateHourlyValue(payload.hourly, 'surface_pressure', bracket, sampleIdx)
  const pressureMsl = interpolateHourlyValue(payload.hourly, 'pressure_msl', bracket, sampleIdx)
  const pressureHpa = isFiniteNumber(surfacePressure) ? surfacePressure : pressureMsl

  const wind10mMs = isFiniteNumber(windSpeed10mKmh) ? windSpeed10mKmh / 3.6 : null
  const windRiderMsRaw = adjustWindSpeedToRiderHeight(wind10mMs)
  const windRiderMs = isFiniteNumber(windRiderMsRaw)
    ? Math.round(windRiderMsRaw * 100) / 100
    : null

  return {
    index: idx,
    latitude,
    longitude,
    elevationM: isFiniteNumber(data.ele?.[idx]) ? data.ele[idx] : null,
    windSpeed10mKmh,
    windDirectionDeg,
    windSpeedRiderMs: windRiderMs,
    temperatureC,
    humidityPct,
    pressureHpa
  }
}
