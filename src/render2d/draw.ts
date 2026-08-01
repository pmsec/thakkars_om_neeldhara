/**
 * Pure SVG path/geometry helpers for the 2D renderer, plus the snapping index.
 * No React here, so the exporters can reuse all of it.
 */

import type { BuiltModel, Opening } from '../geometry/model'
import { bezierAt } from '../geometry/bezier'
import { building } from '../data/building'
import { add, dist, closestPointOnSegment, norm, scale, sub, type Poly, type Pt } from '../geometry/vec'

export const path = (poly: Poly, close = true): string =>
  poly.length === 0
    ? ''
    : `M${poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}${close ? 'Z' : ''}`

export const regionPath = (outer: Poly, holes: Poly[] = []): string =>
  [path(outer), ...holes.map((h) => path(h))].join(' ')

export const multiPath = (mp: number[][][][]): string =>
  mp
    .map((poly) =>
      poly.map((ring) => path(ring.map(([x, y]) => ({ x, y })))).join(' '),
    )
    .join(' ')

/** Door swing arc, matching the hinge/side convention carried over from Rev 4. */
export function doorSwing(op: Opening): { leaf: [Pt, Pt]; arc: string } {
  const side = op.side ?? 1
  const hinge = op.hinge ?? 0
  const L = op.width
  const n = { x: -op.dir.y * side, y: op.dir.x * side }
  const h = hinge === 0 ? op.p1 : op.p2
  const o = hinge === 0 ? op.p2 : op.p1
  const tip = add(h, scale(n, L))
  const sweep = crossSign(sub(o, h), sub(tip, h)) > 0 ? 1 : 0
  return {
    leaf: [h, tip],
    arc: `M${tip.x.toFixed(2)},${tip.y.toFixed(2)} A${L.toFixed(2)},${L.toFixed(2)} 0 0 ${sweep} ${o.x.toFixed(2)},${o.y.toFixed(2)}`,
  }
}

const crossSign = (a: Pt, b: Pt): number => Math.sign(a.x * b.y - a.y * b.x)

/** Sliding-door leaves: two panels offset either side of the run. */
export function sliderLeaves(op: Opening): Array<[Pt, Pt]> {
  const n = { x: -op.dir.y, y: op.dir.x }
  const mid = add(op.p1, scale(op.dir, op.width / 2))
  return [
    [add(op.p1, scale(n, 70)), add(mid, scale(n, 70))],
    [sub(mid, scale(n, 70)), sub(op.p2, scale(n, 70))],
  ]
}

/** Window: two glazing lines inside the wall thickness. */
export function windowLines(op: Opening): Array<[Pt, Pt]> {
  const n = { x: -op.dir.y, y: op.dir.x }
  const t = Math.max(op.thickness, 60)
  return [0.3, -0.3].map((k) => [add(op.p1, scale(n, t * k)), add(op.p2, scale(n, t * k))] as [Pt, Pt])
}

/** The arched head drawn across a portal or cased arch opening. */
export function archPath(op: Opening, riseRatio = 0.34): string {
  const n = { x: -op.dir.y, y: op.dir.x }
  const pts: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const th = (Math.PI * i) / 40
    const along = add(op.p1, scale(op.dir, (op.width * (1 - Math.cos(th))) / 2))
    pts.push(add(along, scale(n, op.width * riseRatio * Math.sin(th))))
  }
  return path(pts, false)
}

/** Flattened polyline of a curved wall's centreline, for the glass wall rendering. */
export function curvePoints(model: BuiltModel, wallId: string): Pt[] {
  return model.curves.get(wallId) ?? []
}

/** The portal gap on a curved wall, as a polyline. */
export function portalPoints(wallId: string, segments = 48): Pt[] {
  const portal = building.portals.find((p) => p.wall === wallId)
  const wall = building.walls.find((w) => w.id === wallId)
  if (!portal || !wall?.curve) return []
  const out: Pt[] = []
  for (let i = 0; i <= segments; i++) {
    out.push(bezierAt(wall.curve, portal.t[0] + ((portal.t[1] - portal.t[0]) * i) / segments))
  }
  return out
}

// --------------------------------------------------------------------- snapping

export type SnapKind = 'corner' | 'midpoint' | 'opening' | 'edge' | 'centre'

export interface SnapTarget {
  at: Pt
  kind: SnapKind
  label: string
}

export interface SnapIndex {
  points: SnapTarget[]
  edges: Array<{ a: Pt; b: Pt; label: string }>
}

/** Build once per model. Wall faces, corners, midpoints and openings (brief §5.2). */
export function buildSnapIndex(model: BuiltModel): SnapIndex {
  const points: SnapTarget[] = []
  const edges: Array<{ a: Pt; b: Pt; label: string }> = []

  for (const room of model.rooms) {
    const rings = [room.polygon, ...room.holes]
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % ring.length]
        points.push({ at: a, kind: 'corner', label: `${room.name} corner` })
        if (dist(a, b) > 200) {
          points.push({
            at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            kind: 'midpoint',
            label: `${room.name} wall midpoint`,
          })
          edges.push({ a, b, label: `${room.name} wall face` })
        }
      }
    }
    points.push({ at: room.centroid, kind: 'centre', label: `${room.name} centre` })
  }

  for (const op of model.openings) {
    points.push({ at: op.p1, kind: 'opening', label: `${op.id} jamb` })
    points.push({ at: op.p2, kind: 'opening', label: `${op.id} jamb` })
    points.push({ at: op.mid, kind: 'opening', label: `${op.id} centre` })
  }

  return { points, edges }
}

/** Nearest snap within `radius` model-mm. Points beat edges. */
export function snapTo(index: SnapIndex, p: Pt, radius: number): SnapTarget | null {
  let best: SnapTarget | null = null
  let bestD = radius
  for (const t of index.points) {
    const d = dist(p, t.at)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  if (best) return best
  let bestEdge: SnapTarget | null = null
  let bestED = radius
  for (const e of index.edges) {
    const { point } = closestPointOnSegment(p, e.a, e.b)
    const d = dist(p, point)
    if (d < bestED) {
      bestED = d
      bestEdge = { at: point, kind: 'edge', label: e.label }
    }
  }
  return bestEdge
}

/** Perpendicular offset points for drawing a dimension witness + line. */
export function dimGeometry(
  from: Pt,
  to: Pt,
  offset: number,
): { a: Pt; b: Pt; w1: [Pt, Pt]; w2: [Pt, Pt]; mid: Pt; angle: number } {
  const d = norm(sub(to, from))
  const n = { x: -d.y, y: d.x }
  const a = add(from, scale(n, offset))
  const b = add(to, scale(n, offset))
  return {
    a,
    b,
    w1: [from, add(from, scale(n, offset * 1.12))],
    w2: [to, add(to, scale(n, offset * 1.12))],
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  }
}

/** Polyline length, for the measure tool's running total. */
export function chainLength(pts: Pt[]): number {
  let s = 0
  for (let i = 0; i < pts.length - 1; i++) s += dist(pts[i], pts[i + 1])
  return s
}
