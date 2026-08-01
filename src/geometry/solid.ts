/**
 * The 3D model, expressed as plain data.
 *
 * This is deliberately NOT Three.js. The brief requires the 3D viewer to be built from
 * the same geometry module as the 2D one (§6.1) and requires the 3D bounding box to
 * equal the 2D envelope bounds (§2.4). Both are only meaningful if the solids are
 * derived here, from the same walls, and the renderer is a thin translation layer.
 *
 * Heights are millimetres above finished floor level.
 */

import polygonClipping from 'polygon-clipping'
import type { BuiltModel, WallRun } from './model'
import { bezierAt, type QuadBezier } from './bezier'
import {
  add,
  area as polyArea,
  bbox,
  dist,
  norm,
  pointInPolygon,
  scale,
  sub,
  type BBox,
  type Poly,
  type Pt,
} from './vec'

const pc = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ??
  polygonClipping) as typeof polygonClipping

function closeRing(p: Poly): [number, number][] {
  const r: [number, number][] = p.map((q) => [q.x, q.y])
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0])
  return r
}

export type SolidKind =
  | 'wall-exterior'
  | 'wall-interior'
  | 'wall-partition'
  | 'wall-curved-glass'
  | 'glazing'
  | 'lintel'
  | 'balustrade'
  | 'screen'

export interface Prism {
  id: string
  kind: SolidKind
  /** Plan footprint. */
  polygon: Poly
  base: number
  top: number
  /** Set for the arched portal head, whose underside is curved rather than flat. */
  archProfile?: { springing: number; rise: number }
  wallId?: string
  transparent?: boolean
}

export interface Slab {
  id: string
  roomId: string
  polygon: Poly
  holes: Poly[]
  level: number
  thickness: number
  finish: string
}

export interface RoofSurface {
  id: string
  kind: 'barrel' | 'flat'
  /** Barrel: a lofted strip set. Flat: a single quad at `height`. */
  extent: [number, number, number, number]
  section?: QuadBezier
  height?: number
  retractable: boolean
  glazing: string
}

export interface SolidModel {
  prisms: Prism[]
  slabs: Slab[]
  roofs: RoofSurface[]
  /** Plan bounds of every solid, which must equal the 2D envelope bounds. */
  bounds: BBox
  ceiling: number
}

// --------------------------------------------------------------------------- helpers

function cumulative(points: Pt[]): number[] {
  const acc = [0]
  for (let i = 0; i < points.length - 1; i++) acc.push(acc[i] + dist(points[i], points[i + 1]))
  return acc
}

function pointAt(points: Pt[], acc: number[], d: number): Pt {
  if (d <= 0) return points[0]
  const last = acc[acc.length - 1]
  if (d >= last) return points[points.length - 1]
  let i = 0
  while (i < acc.length - 2 && acc[i + 1] < d) i++
  const t = (d - acc[i]) / (acc[i + 1] - acc[i])
  return add(points[i], scale(sub(points[i + 1], points[i]), t))
}

/** The sub-polyline between two distances along a run. */
function slice(points: Pt[], acc: number[], from: number, to: number): Pt[] {
  const out: Pt[] = [pointAt(points, acc, from)]
  for (let i = 0; i < points.length; i++) {
    if (acc[i] > from + 1e-6 && acc[i] < to - 1e-6) out.push(points[i])
  }
  out.push(pointAt(points, acc, to))
  return out
}

/** Thicken a polyline into a closed band of the given full thickness. */
export function band(points: Pt[], thickness: number): Poly {
  const h = thickness / 2
  if (h === 0 || points.length < 2) return []
  const normals: Pt[] = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const d = norm(sub(b, a))
    return { x: -d.y, y: d.x }
  })
  const left = points.map((p, i) => add(p, scale(normals[i], h)))
  const right = points.map((p, i) => sub(p, scale(normals[i], h)))
  return [...left, ...right.reverse()]
}

/**
 * Shift a zero-thickness boundary toward whichever side has a room on it. Used to set
 * glazing panes behind the structural line they are drawn on.
 */
function shiftInward(points: Pt[], by: number, model: BuiltModel): Pt[] {
  if (points.length < 2) return points
  // Probe from the MIDDLE of the middle segment. A vertex — and for a two-point run,
  // points[length/2] is the end vertex — sits exactly on a room boundary, where
  // point-in-polygon is a coin toss and the shift silently does nothing.
  const i = Math.max(0, Math.floor((points.length - 1) / 2))
  const a = points[i]
  const b = points[i + 1]
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const d = norm(sub(b, a))
  const n = { x: -d.y, y: d.x }
  const hasRoom = (sign: number): boolean => {
    const probe = add(mid, scale(n, sign * 60))
    return model.rooms.some(
      (r) => r.def.category !== 'void' && pointInPolygon(probe, r.polygon),
    )
  }
  const sign = hasRoom(1) ? 1 : hasRoom(-1) ? -1 : 0
  if (sign === 0) return points
  return points.map((p) => add(p, scale(n, sign * by)))
}

// --------------------------------------------------------------------------- build

export function buildSolids(model: BuiltModel): SolidModel {
  const ceiling = model.data.levels.ceiling
  const prisms: Prism[] = []
  const slabs: Slab[] = []

  const kindOf = (w: WallRun): SolidKind => {
    switch (w.kind) {
      case 'exterior':
        return 'wall-exterior'
      case 'partition':
        return 'wall-partition'
      case 'curved-glass':
        return 'wall-curved-glass'
      case 'glazing':
        return 'glazing'
      default:
        return 'wall-interior'
    }
  }

  for (const w of model.walls) {
    const kind = kindOf(w)
    const transparent = kind === 'wall-curved-glass' || kind === 'glazing'
    const acc = cumulative(w.points)
    const total = acc[acc.length - 1]
    void acc

    // Zero-thickness boundaries carry no solid. The glazed screens to the deck are the
    // exception: they are real glass, so they get a nominal 20 mm pane purely so the 3D
    // view shows them. That 20 mm is a rendering allowance, not a specified dimension,
    // and it is excluded from every area calculation.
    const solidThickness = w.thickness > 0 ? w.thickness : kind === 'glazing' ? 20 : 0
    if (solidThickness === 0) continue

    // A glazed line has no authored thickness, so the pane is a rendering allowance. Set
    // it INSIDE the line rather than centred on it: glass is fixed behind the structural
    // face, and a centred pane would put 10 mm of the building outside its own envelope.
    const runPoints =
      w.thickness === 0 ? shiftInward(w.points, solidThickness / 2, model) : w.points
    const accPts = cumulative(runPoints)

    const portal = model.data.portals.find((p) => p.wall === w.def.id)
    const curve = w.def.curve as QuadBezier | undefined

    if (portal && curve) {
      // Curved glass wall with an arched portal. Solid either side of the portal, and a
      // spandrel above the arched head across it.
      const tStart = portal.t[0]
      const tEnd = portal.t[1]
      const dStart = distAtBezierT(runPoints, accPts, curve, tStart)
      const dEnd = distAtBezierT(runPoints, accPts, curve, tEnd)
      pushRun(prisms, w, runPoints, accPts, 0, dStart, 0, ceiling, kind, solidThickness, transparent)
      pushRun(prisms, w, runPoints, accPts, dEnd, total, 0, ceiling, kind, solidThickness, transparent)
      // The arch head: slice the span and give each slice its own springing height, so
      // the underside reads as a real arch rather than a flat lintel.
      const SLICES = 20
      for (let i = 0; i < SLICES; i++) {
        const u0 = i / SLICES
        const u1 = (i + 1) / SLICES
        const uMid = (u0 + u1) / 2
        const base = portal.springing + portal.rise * Math.sin(Math.PI * uMid)
        const seg = slice(runPoints, accPts, dStart + (dEnd - dStart) * u0, dStart + (dEnd - dStart) * u1)
        const poly = band(seg, solidThickness)
        if (poly.length < 3 || ceiling - base < 1e-6) continue
        prisms.push({
          id: `${w.id}:arch:${i}`,
          kind: 'lintel',
          polygon: poly,
          base,
          top: ceiling,
          archProfile: { springing: portal.springing, rise: portal.rise },
          wallId: w.id,
          transparent: false,
        })
      }
      continue
    }

    // Ordinary run: solid between openings, plus sills and lintels at each opening.
    const ops = [...w.openings].sort((a, b) => a.from - b.from)
    let cursor = 0
    for (const op of ops) {
      const from = Math.max(0, Math.min(total, op.from))
      const to = Math.max(0, Math.min(total, op.to))
      if (from > cursor + 1e-6) {
        pushRun(prisms, w, runPoints, accPts, cursor, from, 0, ceiling, kind, solidThickness, transparent)
      }
      const sill = op.sill ?? 0
      const head = op.head ?? model.data.levels.doorHead
      if (sill > 0) {
        pushRun(prisms, w, runPoints, accPts, from, to, 0, sill, kind, solidThickness, transparent, ':sill')
      }
      if (head < ceiling) {
        pushRun(prisms, w, runPoints, accPts, from, to, head, ceiling, 'lintel', solidThickness, false, ':lintel')
      }
      cursor = Math.max(cursor, to)
    }
    if (cursor < total - 1e-6) {
      pushRun(prisms, w, runPoints, accPts, cursor, total, 0, ceiling, kind, solidThickness, transparent)
    }
  }

  // Curved sliding screens (day bed). Not a room divider, so it never reaches the
  // ceiling. The source curve is authored across the full 0–3200 suite width, i.e. from
  // wall centreline to wall centreline, so the band is trimmed back to the room it sits
  // in — a sliding screen cannot pass through the external wall.
  for (const s of model.data.screens) {
    const pts: Pt[] = []
    for (let i = 0; i <= 48; i++) pts.push(bezierAt(s.curve, i / 48))
    const host = model.rooms.find((r) => r.polygon.length > 2 && pointInPolygon(bezierAt(s.curve, 0.5), r.polygon))
    let poly = band(pts, 40)
    if (host) {
      const trimmed = pc.intersection([closeRing(poly)], [closeRing(host.polygon)])
      if (trimmed.length) {
        // Keep the longest piece; the screen is one continuous panel.
        let best = trimmed[0]
        let bestA = -1
        for (const cand of trimmed) {
          const a = polyArea(cand[0].map(([x, y]) => ({ x, y })))
          if (a > bestA) {
            bestA = a
            best = cand
          }
        }
        poly = best[0].map(([x, y]) => ({ x, y }))
      }
    }
    prisms.push({
      id: s.id,
      kind: 'screen',
      polygon: poly,
      base: 0,
      top: s.height,
      transparent: true,
    })
  }

  // Floor slabs, one per room, from the derived polygons.
  for (const room of model.rooms) {
    if (room.def.category === 'void') continue
    slabs.push({
      id: `SLAB-${room.id}`,
      roomId: room.id,
      polygon: room.polygon,
      holes: room.holes,
      level: 0,
      thickness: 150,
      finish: room.def.finish ?? 'Oak plank',
    })
  }

  const roofs: RoofSurface[] = model.data.glassRoofs.map((r) => ({
    id: r.id,
    kind: r.kind,
    extent: r.extent,
    section: r.section,
    height: r.height,
    retractable: !!r.retractable,
    glazing: r.glazing,
  }))

  const allPts: Pt[] = []
  for (const p of prisms) allPts.push(...p.polygon)
  for (const s of slabs) allPts.push(...s.polygon)

  return { prisms, slabs, roofs, bounds: bbox(allPts), ceiling }
}

function pushRun(
  out: Prism[],
  w: WallRun,
  points: Pt[],
  acc: number[],
  from: number,
  to: number,
  base: number,
  top: number,
  kind: SolidKind,
  thickness: number,
  transparent: boolean,
  suffix = '',
): void {
  if (to - from < 1e-6 || top - base < 1e-6) return
  const poly = band(slice(points, acc, from, to), thickness)
  if (poly.length < 3) return
  out.push({
    id: `${w.id}${suffix}@${from.toFixed(0)}`,
    kind,
    polygon: poly,
    base,
    top,
    wallId: w.id,
    transparent,
  })
}

/** Distance along a flattened curve corresponding to a Bézier parameter. */
function distAtBezierT(points: Pt[], acc: number[], curve: QuadBezier, t: number): number {
  const target = bezierAt(curve, t)
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = dist(points[i], target)
    if (d < bestD) {
      bestD = d
      best = acc[i]
    }
  }
  return best
}
