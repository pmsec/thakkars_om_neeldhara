/**
 * Solar position for Mumbai (brief §6.7). NOAA's algorithm, which is accurate to well
 * under a degree — plenty for judging what the deck's glass roof and the two
 * glass-roofed pod rooms will actually do.
 *
 * ORIENTATION CAVEAT, and it matters: the Rev 4 sheet's north arrow points along +x,
 * while the Python source's header comment says north is -y. They disagree, and nothing
 * in the brief settles it. `northAzimuth` therefore exists as a setting rather than a
 * constant, defaulting to the sheet's arrow. Set it correctly before trusting a shadow.
 */

export const MUMBAI = { lat: 19.076, lon: 72.877, tz: 5.5 }

export interface SolarPosition {
  /** Degrees above the horizon; negative means the sun is down. */
  altitude: number
  /** Degrees clockwise from true north. */
  azimuth: number
  declination: number
  equationOfTime: number
}

export function solarPosition(dayOfYear: number, hour: number): SolarPosition {
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24)

  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))

  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)

  const timeOffset = eqtime + 4 * MUMBAI.lon - 60 * MUMBAI.tz
  const tst = hour * 60 + timeOffset
  const ha = ((tst / 4 - 180) * Math.PI) / 180
  const lat = (MUMBAI.lat * Math.PI) / 180

  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)))

  let az = Math.acos(
    Math.max(
      -1,
      Math.min(1, -(Math.sin(lat) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat) * Math.sin(zen) || 1e-9)),
    ),
  )
  az = (az * 180) / Math.PI
  if (ha > 0) az = 360 - az

  return {
    altitude: 90 - (zen * 180) / Math.PI,
    azimuth: az,
    declination: (decl * 180) / Math.PI,
    equationOfTime: eqtime,
  }
}

/**
 * Sun direction in scene space (three.js: x right, y up, z toward the viewer).
 * The model's x maps to scene x and the model's y to scene z.
 *
 * `northAzimuth` is the compass bearing, in degrees, of the model's +x axis.
 * 0 means +x points true north (the Rev 4 arrow); 90 means +x points east.
 */
export function sunVector(
  pos: SolarPosition,
  northAzimuth: number,
): { x: number; y: number; z: number } {
  const alt = (pos.altitude * Math.PI) / 180
  // Bearing of the sun measured from the model's +x axis.
  const rel = ((pos.azimuth - northAzimuth) * Math.PI) / 180
  const horizontal = Math.cos(alt)
  return {
    x: horizontal * Math.cos(rel),
    y: Math.sin(alt),
    // Model +y is 90° clockwise from +x in plan; in scene terms that is +z.
    z: horizontal * Math.sin(rel),
  }
}

export const DAY_LABELS: Array<{ day: number; label: string }> = [
  { day: 1, label: '1 Jan' },
  { day: 80, label: '21 Mar — equinox' },
  { day: 172, label: '21 Jun — summer solstice' },
  { day: 266, label: '23 Sep — equinox' },
  { day: 355, label: '21 Dec — winter solstice' },
]

export function dayLabel(day: number): string {
  const d = new Date(Date.UTC(2026, 0, 1))
  d.setUTCDate(day)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function hourLabel(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
