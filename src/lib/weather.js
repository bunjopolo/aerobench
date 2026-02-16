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

  const dateUtc = startTime.toISOString().slice(0, 10)
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', latitude.toString())
  url.searchParams.set('longitude', longitude.toString())
  url.searchParams.set('start_date', dateUtc)
  url.searchParams.set('end_date', dateUtc)
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

  const windSpeed10mKmh = readHourlyValue(payload.hourly, 'wind_speed_10m', sampleIdx)
  const windDirectionDeg = normalizeDegrees(readHourlyValue(payload.hourly, 'wind_direction_10m', sampleIdx))
  const temperatureC = readHourlyValue(payload.hourly, 'temperature_2m', sampleIdx)
  const humidityPct = readHourlyValue(payload.hourly, 'relative_humidity_2m', sampleIdx)
  const surfacePressure = readHourlyValue(payload.hourly, 'surface_pressure', sampleIdx)
  const pressureMsl = readHourlyValue(payload.hourly, 'pressure_msl', sampleIdx)
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
