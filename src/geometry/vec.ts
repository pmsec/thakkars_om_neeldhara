/**
 * Plain 2D geometry helpers. No framework, no renderer, no units logic.
 *
 * Coordinate convention for the whole model (brief §3):
 *   x increases along the long axis of the building, 0 -> 24480
 *   y increases across the depth, 0 (deck edge / north) -> 10850 (building lobby / south)
 * That makes y "screen-down" when drawn directly, which is what the 2D renderer wants.
 * Signed areas below use the plain shoelace formula, so a polygon that looks clockwise
 * on screen has a positive signed area. We never rely on the visual sense of that word;
 * orientation is always normalised explicitly.
 */

export interface Pt {
  x: number
  y: number
}

export type Poly = Pt[]

export const pt = (x: number, y: number): Pt => ({ x, y })

export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y
export const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x
export const len = (a: Pt): number => Math.hypot(a.x, a.y)
export const dist = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y)
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

export function norm(a: Pt): Pt {
  const l = len(a)
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

/** Rotate 90° so that, for a CCW-wound polygon, this points into the interior. */
export const leftNormal = (d: Pt): Pt => ({ x: -d.y, y: d.x })

/** Signed shoelace area. Positive => counter-clockwise in plain (x right, y up) terms. */
export function signedArea(poly: Poly): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export const area = (poly: Poly): number => Math.abs(signedArea(poly))

export function perimeter(poly: Poly, closed = true): number {
  let s = 0
  const n = closed ? poly.length : poly.length - 1
  for (let i = 0; i < n; i++) s += dist(poly[i], poly[(i + 1) % poly.length])
  return s
}

export function centroid(poly: Poly): Pt {
  const a = signedArea(poly)
  if (Math.abs(a) < 1e-9) {
    // Degenerate: fall back to the vertex average so callers never see NaN.
    const s = poly.reduce((acc, p) => add(acc, p), pt(0, 0))
    return scale(s, 1 / Math.max(1, poly.length))
  }
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const f = p.x * q.y - q.x * p.y
    cx += (p.x + q.x) * f
    cy += (p.y + q.y) * f
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function bbox(pts: Pt[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export const bboxWidth = (b: BBox): number => b.maxX - b.minX
export const bboxHeight = (b: BBox): number => b.maxY - b.minY

export function bboxContains(b: BBox, p: Pt, tol = 0): boolean {
  return p.x >= b.minX - tol && p.x <= b.maxX + tol && p.y >= b.minY - tol && p.y <= b.maxY + tol
}

/** Ray casting. Points exactly on an edge are unreliable by nature; callers use interior probes. */
export function pointInPolygon(p: Pt, poly: Poly): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const straddles = a.y > p.y !== b.y > p.y
    if (straddles && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Point in a polygon with holes. */
export function pointInRegion(p: Pt, outer: Poly, holes: Poly[] = []): boolean {
  if (!pointInPolygon(p, outer)) return false
  return !holes.some((h) => pointInPolygon(p, h))
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  if (l2 === 0) return dist(p, a)
  let t = dot(sub(p, a), ab) / l2
  t = Math.max(0, Math.min(1, t))
  return dist(p, add(a, scale(ab, t)))
}

export function closestPointOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; t: number } {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  if (l2 === 0) return { point: a, t: 0 }
  let t = dot(sub(p, a), ab) / l2
  t = Math.max(0, Math.min(1, t))
  return { point: add(a, scale(ab, t)), t }
}

export interface SegIntersection {
  point: Pt
  /** Parameter along the first segment, 0..1. */
  t: number
  /** Parameter along the second segment, 0..1. */
  u: number
}

/**
 * Proper segment-segment intersection. Returns null for parallel/collinear pairs —
 * collinear overlaps are handled separately by the planar builder, which snaps and
 * dedupes shared vertices rather than trying to intersect coincident lines.
 */
export function segIntersect(
  p1: Pt,
  p2: Pt,
  p3: Pt,
  p4: Pt,
  eps = 1e-9,
): SegIntersection | null {
  const r = sub(p2, p1)
  const s = sub(p4, p3)
  const denom = cross(r, s)
  if (Math.abs(denom) < eps) return null
  const qp = sub(p3, p1)
  const t = cross(qp, s) / denom
  const u = cross(qp, r) / denom
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null
  return { point: add(p1, scale(r, t)), t, u }
}

/** Intersection of two infinite lines given as point + direction. Null if parallel. */
export function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt, eps = 1e-9): Pt | null {
  const denom = cross(d1, d2)
  if (Math.abs(denom) < eps) return null
  const t = cross(sub(p2, p1), d2) / denom
  return add(p1, scale(d1, t))
}

/** Force a winding. `ccw` here means positive signed area under the shoelace above. */
export function orient(poly: Poly, ccw: boolean): Poly {
  const a = signedArea(poly)
  const isCcw = a > 0
  return isCcw === ccw ? poly : [...poly].reverse()
}

/** Drop consecutive duplicates (and the wrap-around duplicate) within tol. */
export function dedupePoly(poly: Poly, tol = 1e-6): Poly {
  const out: Pt[] = []
  for (const p of poly) {
    if (out.length === 0 || dist(out[out.length - 1], p) > tol) out.push(p)
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= tol) out.pop()
  return out
}

/** Remove vertices that sit on the straight line between their neighbours. */
export function simplifyCollinear(poly: Poly, tol = 1e-6): Poly {
  const p = dedupePoly(poly, tol)
  if (p.length < 3) return p
  const out: Pt[] = []
  for (let i = 0; i < p.length; i++) {
    const a = p[(i - 1 + p.length) % p.length]
    const b = p[i]
    const c = p[(i + 1) % p.length]
    if (Math.abs(cross(sub(b, a), sub(c, b))) > tol * Math.max(1, dist(a, c))) out.push(b)
  }
  return out.length >= 3 ? out : p
}

export function polyToRings(poly: Poly): number[][] {
  return poly.map((p) => [p.x, p.y])
}

export function ringToPoly(ring: number[][]): Poly {
  return ring.map(([x, y]) => ({ x, y }))
}
