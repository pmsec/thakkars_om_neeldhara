/**
 * Quadratic Bézier support for the two curved glass pod walls and the day-bed screen.
 * Control points come straight from floor-plan-source.py (brief §3.3).
 */

import type { Pt } from './vec'
import { dist } from './vec'

export interface QuadBezier {
  p0: Pt
  p1: Pt
  p2: Pt
}

export function bezierAt(b: QuadBezier, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * b.p0.x + 2 * u * t * b.p1.x + t * t * b.p2.x,
    y: u * u * b.p0.y + 2 * u * t * b.p1.y + t * t * b.p2.y,
  }
}

/** First derivative — used for arch springing normals and for 3D mullion orientation. */
export function bezierTangent(b: QuadBezier, t: number): Pt {
  return {
    x: 2 * (1 - t) * (b.p1.x - b.p0.x) + 2 * t * (b.p2.x - b.p1.x),
    y: 2 * (1 - t) * (b.p1.y - b.p0.y) + 2 * t * (b.p2.y - b.p1.y),
  }
}

/**
 * Bisection for the parameter at a given y. Both pod curves are monotonic in y
 * (p0.y < p1.y < p2.y), which is what makes this valid — asserted by the test suite.
 */
export function bezierTAtY(b: QuadBezier, y: number, iterations = 60): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (bezierAt(b, mid).y < y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function bezierXAtY(b: QuadBezier, y: number): number {
  return bezierAt(b, bezierTAtY(b, y)).x
}

export const isMonotonicInY = (b: QuadBezier): boolean =>
  (b.p0.y <= b.p1.y && b.p1.y <= b.p2.y) || (b.p0.y >= b.p1.y && b.p1.y >= b.p2.y)

/**
 * Uniform-parameter flattening. `segments` is fixed rather than adaptive so that the
 * planar subdivision is deterministic and two curves sharing an endpoint always agree
 * on that vertex to the bit. 96 segments keeps the chord error on these curves under
 * 0.05 mm, far below the 1 mm model tolerance.
 */
export function flattenBezier(b: QuadBezier, segments = 96): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= segments; i++) out.push(bezierAt(b, i / segments))
  return out
}

/** Worst chord deviation of a flattening, for the test suite to assert against. */
export function flattenError(b: QuadBezier, segments = 96): number {
  const poly = flattenBezier(b, segments)
  let worst = 0
  for (let i = 0; i < segments; i++) {
    const tMid = (i + 0.5) / segments
    const onCurve = bezierAt(b, tMid)
    const onChord = {
      x: (poly[i].x + poly[i + 1].x) / 2,
      y: (poly[i].y + poly[i + 1].y) / 2,
    }
    worst = Math.max(worst, dist(onCurve, onChord))
  }
  return worst
}

/** Arc length by flattening — used for the curved glass wall's running metre schedule. */
export function bezierLength(b: QuadBezier, segments = 512): number {
  const poly = flattenBezier(b, segments)
  let s = 0
  for (let i = 0; i < poly.length - 1; i++) s += dist(poly[i], poly[i + 1])
  return s
}

/** The portion of a curve between two parameters, flattened. Used for the arched portals. */
export function flattenBezierRange(
  b: QuadBezier,
  t0: number,
  t1: number,
  segments = 48,
): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= segments; i++) out.push(bezierAt(b, t0 + ((t1 - t0) * i) / segments))
  return out
}
