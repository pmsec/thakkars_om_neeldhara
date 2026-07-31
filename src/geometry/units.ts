/**
 * Unit handling.
 *
 * RULE (brief §2.2): every stored length is an integer number of millimetres.
 * Feet-inches, square feet and square metres are DERIVED HERE, at display time,
 * and are never stored or fed back into the model.
 *
 * Precision note — this matters and the architect should know it:
 * the Rev 4 drawing rounds feet-inches to the nearest whole inch. A whole inch is
 * 25.4 mm, so a nearest-inch string can be up to 12.7 mm away from the true value
 * and cannot round-trip inside the 1 mm tolerance the brief demands. We therefore
 * default the display to the nearest 1/16", whose worst-case error is 0.794 mm.
 * `27'-6"` still prints as `27'-6"` whenever the value really is exact to the inch.
 */

export const MM_PER_INCH = 25.4
export const MM_PER_FOOT = 304.8
export const SQFT_PER_SQMM = 1.0763910416709722e-5
export const SQM_PER_SQMM = 1e-6

/** Denominator of an inch used when printing. 16 => nearest 1/16". */
export type InchPrecision = 1 | 2 | 4 | 8 | 16 | 32

const GCD = (a: number, b: number): number => (b === 0 ? a : GCD(b, a % b))

/**
 * mm -> `27'-6"` / `27'-6 1/2"`. Negative values keep the sign on the feet.
 * At the default 1/16" precision this round-trips through parseFeetInches to
 * within 0.794 mm, which satisfies the brief's 1 mm requirement.
 */
export function formatFeetInches(mm: number, precision: InchPrecision = 16): string {
  const sign = mm < 0 ? '-' : ''
  const abs = Math.abs(mm)
  // Work in units of 1/precision of an inch so rounding happens exactly once.
  const totalTicks = Math.round((abs / MM_PER_INCH) * precision)
  const ticksPerFoot = 12 * precision
  const feet = Math.floor(totalTicks / ticksPerFoot)
  const rem = totalTicks - feet * ticksPerFoot
  const inches = Math.floor(rem / precision)
  const frac = rem - inches * precision
  if (frac === 0) return `${sign}${feet}'-${inches}"`
  const g = GCD(frac, precision)
  return `${sign}${feet}'-${inches} ${frac / g}/${precision / g}"`
}

/** Inverse of formatFeetInches. Accepts `27'-6"`, `27'-6 1/2"`, `27' 6 1/2"`, `-3'-0"`. */
export function parseFeetInches(s: string): number {
  const m = s
    .trim()
    .match(/^(-)?(\d+)\s*'\s*[- ]?\s*(?:(\d+)(?:\s+(\d+)\/(\d+))?\s*")?$/)
  if (!m) throw new Error(`Cannot parse feet-inches: "${s}"`)
  const [, neg, ft, inch, num, den] = m
  const inches =
    Number(ft) * 12 + Number(inch ?? 0) + (num && den ? Number(num) / Number(den) : 0)
  return (neg ? -1 : 1) * inches * MM_PER_INCH
}

/** mm -> metres, 3 dp, e.g. `7.690 m`. */
export function formatMetres(mm: number): string {
  return `${(mm / 1000).toFixed(3)} m`
}

/** mm -> `7 690 mm` (thin-space grouping, as on the Rev 4 sheet). */
export function formatMm(mm: number): string {
  return `${Math.round(mm).toLocaleString('en-GB').replace(/,/g, ' ')} mm`
}

export type UnitSystem = 'mm' | 'ftin' | 'm'

/** One length in whichever system the user has selected globally. */
export function formatLength(mm: number, system: UnitSystem, precision: InchPrecision = 16): string {
  switch (system) {
    case 'mm':
      return formatMm(mm)
    case 'ftin':
      return formatFeetInches(mm, precision)
    case 'm':
      return formatMetres(mm)
  }
}

/** Every displayed dimension carries mm AND feet-inches (brief §2.6). */
export function formatLengthBoth(mm: number, precision: InchPrecision = 16): string {
  return `${formatMm(mm)}  ·  ${formatFeetInches(mm, precision)}`
}

export function sqFt(mm2: number): number {
  return mm2 * SQFT_PER_SQMM
}

export function sqM(mm2: number): number {
  return mm2 * SQM_PER_SQMM
}

/** Areas always show both systems (brief §2.6). */
export function formatArea(mm2: number): string {
  return `${sqFt(mm2).toFixed(1)} sq ft  ·  ${sqM(mm2).toFixed(2)} m²`
}

/** `3 200 × 7 300 mm  ·  10'-6" × 23'-11 1/2"` */
export function formatDims(w: number, d: number, precision: InchPrecision = 16): string {
  return (
    `${formatMm(w).replace(' mm', '')} × ${formatMm(d)}  ·  ` +
    `${formatFeetInches(w, precision)} × ${formatFeetInches(d, precision)}`
  )
}
