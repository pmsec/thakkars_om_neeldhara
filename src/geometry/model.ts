/**
 * The model builder. Reads the authored data in `src/data/building.ts` and derives
 * everything else: the external wall centreline, the clipped wall runs, the room
 * polygons, the areas, the opening positions, the circulation graph and the wall
 * footprint.
 *
 * Framework-free and renderer-free by design (brief §9.4) — the only dependency is a
 * polygon boolean library, so this module could be pointed at an IFC or DXF writer
 * without touching anything else.
 */

import polygonClipping from 'polygon-clipping'
import type { BuildingData, OpeningDef, RoomDef, WallDef } from '../data/schema'
import { building } from '../data/building'
import { bezierAt, flattenBezier, type QuadBezier } from './bezier'
import {
  offsetRing,
  subdivide,
  type BoundaryInput,
  type Face,
  type FaceEdgeRef,
} from './planar'
import {
  add,
  area,
  bbox,
  centroid,
  dedupePoly,
  dist,
  distToSegment,
  dot,
  norm,
  perimeter,
  pointInPolygon,
  scale,
  sub,
  type BBox,
  type Poly,
  type Pt,
} from './vec'

// polygon-clipping ships both CJS and ESM shapes depending on bundler; normalise.
const pc = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ??
  polygonClipping) as typeof polygonClipping

const CURVE_SEGMENTS = 96

// ---------------------------------------------------------------------------- helpers

function polylineLength(points: Pt[]): number {
  let s = 0
  for (let i = 0; i < points.length - 1; i++) s += dist(points[i], points[i + 1])
  return s
}

function pointAtDistance(points: Pt[], d: number): Pt {
  let remaining = d
  for (let i = 0; i < points.length - 1; i++) {
    const seg = dist(points[i], points[i + 1])
    if (remaining <= seg || i === points.length - 2) {
      const t = seg === 0 ? 0 : remaining / seg
      return add(points[i], scale(sub(points[i + 1], points[i]), t))
    }
    remaining -= seg
  }
  return points[points.length - 1]
}

/** Distance along a polyline of the point on it closest to `p`. */
function distanceOfPoint(points: Pt[], p: Pt): number {
  let best = 0
  let bestDist = Infinity
  let acc = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const ab = sub(b, a)
    const l2 = ab.x * ab.x + ab.y * ab.y
    let t = l2 === 0 ? 0 : ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2
    t = Math.max(0, Math.min(1, t))
    const proj = add(a, scale(ab, t))
    const d = dist(p, proj)
    if (d < bestDist) {
      bestDist = d
      best = acc + t * Math.sqrt(l2)
    }
    acc += Math.sqrt(l2)
  }
  return best
}

/** Direction of a polyline at a given distance along it. */
function directionAtDistance(points: Pt[], d: number): Pt {
  let remaining = d
  for (let i = 0; i < points.length - 1; i++) {
    const seg = dist(points[i], points[i + 1])
    if (remaining <= seg || i === points.length - 2) return norm(sub(points[i + 1], points[i]))
    remaining -= seg
  }
  return norm(sub(points[points.length - 1], points[points.length - 2]))
}

/** Keep only the parts of a polyline that lie inside `poly`. */
function clipPolylineToPolygon(points: Pt[], poly: Poly): Pt[][] {
  const out: Pt[][] = []
  let current: Pt[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    // Split this segment at every crossing of the clip polygon.
    const params: number[] = [0, 1]
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j]
      const d = poly[(j + 1) % poly.length]
      const r = sub(b, a)
      const s = sub(d, c)
      const denom = r.x * s.y - r.y * s.x
      if (Math.abs(denom) < 1e-12) continue
      const qp = sub(c, a)
      const t = (qp.x * s.y - qp.y * s.x) / denom
      const u = (qp.x * r.y - qp.y * r.x) / denom
      if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) params.push(t)
    }
    const ts = [...new Set(params)].sort((p, q) => p - q)
    for (let k = 0; k < ts.length - 1; k++) {
      const pa = add(a, scale(sub(b, a), ts[k]))
      const pb = add(a, scale(sub(b, a), ts[k + 1]))
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
      if (pointInPolygon(mid, poly)) {
        if (current.length === 0) current.push(pa)
        current.push(pb)
      } else if (current.length > 0) {
        out.push(current)
        current = []
      }
    }
  }
  if (current.length > 1) out.push(current)
  return out
}

/** polygon-clipping's ring/polygon shapes, named locally so the code stays readable. */
type PcRing = [number, number][]
type PcPolygon = PcRing[]

function closeRing(p: Poly): PcRing {
  const r: PcRing = p.map((q) => [q.x, q.y])
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0])
  return r
}

// ---------------------------------------------------------------------------- types

export interface Opening extends OpeningDef {
  wallId: string
  /** Along-run distances on the CLIPPED run. */
  from: number
  to: number
  width: number
  /** Absolute endpoints of the opening on the wall centreline. */
  p1: Pt
  p2: Pt
  mid: Pt
  /** Unit direction of the parent run at the opening. */
  dir: Pt
  thickness: number
  wallKind: string
}

export interface WallRun {
  id: string
  def: WallDef
  /** Centreline after clipping to the envelope centreline. */
  points: Pt[]
  thickness: number
  kind: string
  length: number
  openings: Opening[]
  isExterior: boolean
}

export interface Room {
  def: RoomDef
  id: string
  name: string
  /** DERIVED. Carpet polygon: the face inset by half of each adjoining wall. */
  polygon: Poly
  holes: Poly[]
  area: number
  perimeter: number
  centroid: Pt
  bbox: BBox
  /** Bounding-box dimensions, which is what "3200 × 7300" means on the sheet. */
  width: number
  depth: number
  faceIndex: number
  /** Centreline (gross) area of the parent face, before the wall inset. */
  grossArea: number
  ceiling: number
  edges: FaceEdgeRef[]
}

export interface ConnectionEdge {
  openingId: string
  a: string
  b: string
  type: string
  sealed: boolean
}

export interface BuiltModel {
  data: BuildingData
  envelope: Poly
  envelopeCentreline: Poly
  envelopeArea: number
  envelopeBBox: BBox
  walls: WallRun[]
  openings: Opening[]
  rooms: Room[]
  roomById: Map<string, Room>
  faces: Face[]
  /** Faces that no room claimed — must be empty, and the suite asserts it. */
  unclaimedFaces: Face[]
  connections: ConnectionEdge[]
  adjacency: Map<string, ConnectionEdge[]>
  wallFootprintArea: number
  /** Wall footprint as a MultiPolygon: [polygon][ring][point][x|y]. Used by 2D + DXF. */
  wallFootprint: number[][][][]
  /** Faces the walls split into more than one piece. Should be empty. */
  splitWarnings: string[]
  totals: {
    envelope: number
    rooms: number
    voids: number
    walls: number
    carpet: number
    reconciliationError: number
    reconciliationPct: number
  }
  curves: Map<string, Pt[]>
}

// ---------------------------------------------------------------------------- build

function buildExteriorRuns(data: BuildingData): { runs: WallDef[]; centreline: Poly } {
  const outer = data.envelope
  const t = data.thickness.exterior
  // The centreline sits half a wall inside the outer face.
  const refs: FaceEdgeRef[] = outer.map((_, i) => ({
    boundaryId: 'EXT',
    kind: 'exterior',
    thickness: t,
    from: outer[i],
    to: outer[(i + 1) % outer.length],
  }))
  const inset = offsetRing(outer, refs, true)

  // Walk the envelope edge by edge, dropping out any stretch that is glazed rather than
  // built. Where the wall exists the boundary follows its centreline; where the glass
  // replaces it the boundary follows the building line itself, at zero thickness, so the
  // floor runs right out to the glass. Short zero-thickness jogs join the two, and those
  // jogs are the exposed end faces of the wall where it stops.
  const glazing = data.envelopeGlazing ?? []
  const runs: WallDef[] = []
  let solidCount = 0
  let jogCount = 0

  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]
    const b = outer[(i + 1) % outer.length]
    const ca = inset[i]
    const cb = inset[(i + 1) % inset.length]
    const L = dist(a, b)
    if (L < 1) continue
    const u = norm(sub(b, a))
    const nIn = { x: -u.y, y: u.x } // envelope is positively wound, so left is inward

    // Centreline point at a distance along the OUTER edge. The mitred corners are the
    // true ends, so those are used verbatim rather than projected.
    const centreAt = (d: number): Pt =>
      d <= 1 ? ca : d >= L - 1 ? cb : add(add(a, scale(u, d)), scale(nIn, t / 2))
    const outerAt = (d: number): Pt => add(a, scale(u, d))

    const spans = glazing
      .filter((g) => distToSegment(g.p1, a, b) < 1 && distToSegment(g.p2, a, b) < 1)
      .map((g) => {
        const s = dot(sub(g.p1, a), u)
        const e = dot(sub(g.p2, a), u)
        return { def: g, s: Math.min(s, e), e: Math.max(s, e) }
      })
      .sort((p, q) => p.s - q.s)

    const pushSolid = (from: number, to: number): void => {
      if (to - from < 1) return
      runs.push({
        id: `EXT-${++solidCount}`,
        points: [centreAt(from), centreAt(to)],
        thickness: t,
        kind: 'exterior',
        openings: [],
      })
    }
    const pushJog = (p: Pt, q: Pt): void => {
      if (dist(p, q) < 1) return
      runs.push({ id: `EXT-J${++jogCount}`, points: [p, q], thickness: 0, kind: 'exterior', openings: [] })
    }

    let cursor = 0
    for (const sp of spans) {
      pushSolid(cursor, sp.s)
      pushJog(centreAt(sp.s), outerAt(sp.s))
      runs.push({
        id: sp.def.id,
        points: [outerAt(sp.s), outerAt(sp.e)],
        thickness: 0,
        kind: 'glazing',
        openings: [],
        label: sp.def.label,
        notes: sp.def.notes,
      })
      pushJog(outerAt(sp.e), centreAt(sp.e))
      cursor = sp.e
    }
    pushSolid(cursor, L)
  }

  // Where a glazed span runs right up to an envelope corner and the next edge starts
  // glazed too, the jog off the centreline and the jog back onto it are exact reverses:
  // a degenerate spike at the corner, and two boundaries lying on the same line. Cancel
  // the pair so the glass simply turns the corner. The list is circular, because the
  // north edge is walked first and the west edge last.
  const isJog = (r: WallDef): boolean => r.id.startsWith('EXT-J')
  const drop = new Set<number>()
  for (let i = 0; i < runs.length; i++) {
    const j = (i + 1) % runs.length
    if (drop.has(i) || drop.has(j) || i === j) continue
    const a = runs[i]
    const b = runs[j]
    if (!isJog(a) || !isJog(b)) continue
    if (dist(a.points![0], b.points![1]) < 1 && dist(a.points![1], b.points![0]) < 1) {
      drop.add(i)
      drop.add(j)
    }
  }
  const kept = runs.filter((_, i) => !drop.has(i))
  runs.length = 0
  runs.push(...kept)

  // The boundary loop the interior walls get clipped against, following the jogs.
  const centreline: Poly = runs.map((r) => r.points![0])

  // Attach each exterior opening to the run it belongs to. Openings are authored on the
  // OUTER face; the centreline is a pure perpendicular translation for axis-aligned
  // edges, so the nearest run by perpendicular distance is unambiguous.
  for (const op of data.exteriorOpenings) {
    if (!op.abs) throw new Error(`Exterior opening ${op.id} must be given as absolute points`)
    const [a, b] = op.abs
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    let best = -1
    let bestD = Infinity
    runs.forEach((run, i) => {
      const p = run.points![0]
      const q = run.points![1]
      const ab = sub(q, p)
      const l2 = ab.x * ab.x + ab.y * ab.y
      let tt = l2 === 0 ? 0 : ((mid.x - p.x) * ab.x + (mid.y - p.y) * ab.y) / l2
      tt = Math.max(0, Math.min(1, tt))
      const d = dist(mid, add(p, scale(ab, tt)))
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    const run = runs[best]
    const pts = run.points!
    const da = distanceOfPoint(pts, a)
    const db = distanceOfPoint(pts, b)
    run.openings!.push({ ...op, at: [Math.min(da, db), Math.max(da, db)], abs: undefined })
  }

  return { runs, centreline }
}

export function buildModel(data: BuildingData = building): BuiltModel {
  const { runs: extRuns, centreline } = buildExteriorRuns(data)

  // ---- 1. resolve every wall run to a clipped centreline polyline -----------------
  const curves = new Map<string, Pt[]>()
  const walls: WallRun[] = []

  const resolve = (def: WallDef, isExterior: boolean): void => {
    let raw: Pt[]
    if (def.curve) {
      raw = flattenBezier(def.curve as QuadBezier, CURVE_SEGMENTS)
      curves.set(def.id, raw)
    } else if (def.points) {
      raw = def.points
    } else {
      throw new Error(`Wall ${def.id} has neither points nor curve`)
    }

    // Interior runs are clipped to the envelope centreline so they never stray into the
    // external wall's own thickness. This is what trims W-K-SOUTH at x = 18480 and
    // W-P-SUITE-E at y = 8280 without anyone having to hand-edit those numbers.
    const pieces = isExterior ? [raw] : clipPolylineToPolygon(raw, centreline)
    if (pieces.length === 0) throw new Error(`Wall ${def.id} lies entirely outside the envelope`)

    const openings: Opening[] = []
    const rawLen = polylineLength(raw)
    for (const op of def.openings ?? []) {
      if (!op.at) throw new Error(`Opening ${op.id} on ${def.id} needs an 'at' range`)
      const [a0, b0] = op.at
      if (a0 < -1 || b0 > rawLen + 1) {
        throw new Error(`Opening ${op.id} (${a0}..${b0}) falls outside run ${def.id} (0..${rawLen.toFixed(1)})`)
      }
      const pa = pointAtDistance(raw, a0)
      const pb = pointAtDistance(raw, b0)
      // Place the opening on whichever clipped piece actually contains it.
      let target = 0
      let bestD = Infinity
      pieces.forEach((piece, i) => {
        const d = dist(pointAtDistance(piece, distanceOfPoint(piece, pa)), pa)
        if (d < bestD) {
          bestD = d
          target = i
        }
      })
      const piece = pieces[target]
      const from = distanceOfPoint(piece, pa)
      const to = distanceOfPoint(piece, pb)
      openings.push({
        ...op,
        wallId: pieces.length > 1 ? `${def.id}#${target + 1}` : def.id,
        from: Math.min(from, to),
        to: Math.max(from, to),
        width: Math.abs(to - from),
        p1: pa,
        p2: pb,
        mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
        dir: directionAtDistance(piece, (from + to) / 2),
        thickness: def.thickness,
        wallKind: def.kind,
      })
    }

    pieces.forEach((piece, i) => {
      const id = pieces.length > 1 ? `${def.id}#${i + 1}` : def.id
      walls.push({
        id,
        def,
        points: piece,
        thickness: def.thickness,
        kind: def.kind,
        length: polylineLength(piece),
        openings: openings.filter((o) => o.wallId === id),
        isExterior,
      })
    })
  }

  extRuns.forEach((d) => resolve(d, true))
  data.walls.forEach((d) => resolve(d, false))

  // Arched portals are authored as a Bézier parameter range on a curved wall, so turn
  // each into a real opening on that wall's run. Without this the pods would have no
  // way into the great room and the reachability check would (correctly) fail.
  for (const portal of data.portals) {
    const run = walls.find((w) => w.def.id === portal.wall)
    if (!run) throw new Error(`Portal ${portal.id} references unknown wall ${portal.wall}`)
    const curve = run.def.curve as QuadBezier | undefined
    if (!curve) throw new Error(`Portal ${portal.id} is on ${portal.wall}, which is not curved`)
    const pa = bezierAt(curve, portal.t[0])
    const pb = bezierAt(curve, portal.t[1])
    const from = distanceOfPoint(run.points, pa)
    const to = distanceOfPoint(run.points, pb)
    const op: Opening = {
      id: portal.id,
      type: 'arch',
      at: [Math.min(from, to), Math.max(from, to)],
      head: portal.springing + portal.rise,
      sill: 0,
      label: portal.label,
      wallId: run.id,
      from: Math.min(from, to),
      to: Math.max(from, to),
      width: Math.abs(to - from),
      p1: pa,
      p2: pb,
      mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
      dir: directionAtDistance(run.points, (from + to) / 2),
      thickness: run.thickness,
      wallKind: run.kind,
      notes: `Arch springs at ${portal.springing} mm and rises ${portal.rise} mm.`,
    }
    run.openings.push(op)
  }

  // ---- 2. planar subdivision ------------------------------------------------------
  const boundaries: BoundaryInput[] = walls.map((w) => ({
    id: w.id,
    points: w.points,
    thickness: w.thickness,
    kind: w.kind,
  }))
  for (const core of data.cores) {
    boundaries.push({ id: core.id, points: core.points, thickness: 0, kind: 'void-edge' })
  }

  const sub2 = subdivide(boundaries)

  // ---- 3. wall footprint ----------------------------------------------------------
  // Built BEFORE the rooms, because a room is defined as the part of its face that the
  // walls do not occupy. Union so junction overlaps are counted once. Openings are NOT
  // deducted: at floor level a doorway threshold still sits in the wall zone, which is
  // the convention that makes carpet + walls + voids reconcile to the gross envelope.
  const bands: PcPolygon[] = []

  // External wall: the ring between the outer face and the inner face, with any glazed
  // stretch cut out of it. Derived from the outer polygon rather than the centreline,
  // because the centreline now jogs around those glazed stretches.
  const outerRefs: FaceEdgeRef[] = data.envelope.map((_, i) => ({
    boundaryId: 'EXT',
    kind: 'exterior',
    thickness: data.thickness.exterior * 2, // offsetRing halves it, so this insets a full wall
    from: data.envelope[i],
    to: data.envelope[(i + 1) % data.envelope.length],
  }))
  const innerFace = offsetRing(data.envelope, outerRefs, true)
  let extBand = [[closeRing(data.envelope), closeRing(innerFace)]] as unknown as polygonClipping.Geom
  for (const g of data.envelopeGlazing ?? []) {
    // Cut back the full wall depth wherever the glass replaces it.
    const seg = { x: g.p2.x - g.p1.x, y: g.p2.y - g.p1.y }
    const len = Math.hypot(seg.x, seg.y)
    const u = { x: seg.x / len, y: seg.y / len }
    // Inward normal: whichever side of the line the building is on.
    let nIn = { x: -u.y, y: u.x }
    const probe = { x: (g.p1.x + g.p2.x) / 2 + nIn.x * 50, y: (g.p1.y + g.p2.y) / 2 + nIn.y * 50 }
    if (!pointInPolygon(probe, data.envelope)) nIn = { x: -nIn.x, y: -nIn.y }
    const d = data.thickness.exterior + 2
    const cut: Poly = [
      { x: g.p1.x - u.x, y: g.p1.y - u.y },
      { x: g.p2.x + u.x, y: g.p2.y + u.y },
      { x: g.p2.x + u.x + nIn.x * d, y: g.p2.y + u.y + nIn.y * d },
      { x: g.p1.x - u.x + nIn.x * d, y: g.p1.y - u.y + nIn.y * d },
    ]
    extBand = pc.difference(extBand, [closeRing(cut)])
  }
  for (const poly of extBand) bands.push(poly as unknown as PcPolygon)

  for (const w of walls) {
    if (w.isExterior || w.thickness === 0) continue
    const h = w.thickness / 2
    for (let i = 0; i < w.points.length - 1; i++) {
      const a = w.points[i]
      const b = w.points[i + 1]
      const d = norm(sub(b, a))
      if (d.x === 0 && d.y === 0) continue
      const n = { x: -d.y, y: d.x }
      // Square caps: extend by h at both ends so junction corners are filled exactly once.
      const a2 = sub(a, scale(d, h))
      const b2 = add(b, scale(d, h))
      bands.push([
        closeRing([
          add(a2, scale(n, h)),
          add(b2, scale(n, h)),
          sub(b2, scale(n, h)),
          sub(a2, scale(n, h)),
        ]),
      ])
    }
  }

  const unioned = pc.union(bands[0], ...bands.slice(1))
  // Clip to the envelope so square caps at the perimeter cannot overhang it.
  const wallUnion = pc.intersection(unioned, [closeRing(data.envelope)])

  let wallFootprintArea = 0
  for (const polyRings of wallUnion) {
    polyRings.forEach((ring, i) => {
      const a = area(ring.map(([x, y]) => ({ x, y })))
      wallFootprintArea += i === 0 ? a : -a
    })
  }

  // ---- 4. faces -> rooms ----------------------------------------------------------
  // A room is its face MINUS the wall footprint. That is the same thing as insetting
  // each edge by half its wall's thickness, but done as a boolean it stays well-behaved
  // where the offset method would invert: the gear-store partition, for instance, lands
  // 30 mm from the envelope's stepped corner, and a naive miter turns that sliver inside
  // out. `offsetFace` is retained and cross-checked against this in the test suite.
  const rooms: Room[] = []
  const claimed = new Set<number>()
  const splitWarnings: string[] = []

  for (const def of data.rooms) {
    const face = sub2.faces.find(
      (f) => pointInPolygon(def.anchor, f.outer) && !f.holes.some((h) => pointInPolygon(def.anchor, h)),
    )
    if (!face) {
      throw new Error(`Room ${def.id}: anchor (${def.anchor.x}, ${def.anchor.y}) is not inside any face`)
    }
    if (claimed.has(face.index)) {
      const other = rooms.find((r) => r.faceIndex === face.index)!
      throw new Error(`Rooms ${def.id} and ${other.id} both claim face ${face.index}`)
    }
    claimed.add(face.index)

    const facePoly: PcPolygon = [closeRing(face.outer), ...face.holes.map(closeRing)]
    const carved = pc.difference(facePoly, wallUnion)
    if (carved.length === 0) throw new Error(`Room ${def.id} has no floor left after the walls`)

    // Keep the piece containing the anchor; anything else is a sliver the walls cut off.
    let chosen = carved[0]
    let chosenArea = -1
    for (const cand of carved) {
      const ring = cand[0].map(([x, y]) => ({ x, y }))
      const a = area(ring)
      if (pointInPolygon(def.anchor, ring)) {
        chosen = cand
        chosenArea = Infinity
        break
      }
      if (a > chosenArea) {
        chosenArea = a
        chosen = cand
      }
    }
    if (carved.length > 1) {
      const dropped = carved.length - 1
      splitWarnings.push(`${def.id}: walls cut the face into ${carved.length} pieces; kept the one containing the anchor, dropped ${dropped}`)
    }

    const poly = dedupePoly(chosen[0].map(([x, y]) => ({ x, y })), 1e-6)
    const holes = chosen.slice(1).map((r) => dedupePoly(r.map(([x, y]) => ({ x, y })), 1e-6))
    const netArea = area(poly) - holes.reduce((s, h) => s + area(h), 0)
    const bb = bbox(poly)
    rooms.push({
      def,
      id: def.id,
      name: def.name,
      polygon: poly,
      holes,
      area: netArea,
      perimeter: perimeter(poly),
      centroid: centroid(poly),
      bbox: bb,
      width: bb.maxX - bb.minX,
      depth: bb.maxY - bb.minY,
      faceIndex: face.index,
      grossArea: face.centrelineArea,
      ceiling: def.ceiling ?? data.levels.ceiling,
      edges: face.outerEdges,
    })
  }
  const unclaimedFaces = sub2.faces.filter((f) => !claimed.has(f.index))

  // ---- 4. circulation graph -------------------------------------------------------
  const allOpenings = walls.flatMap((w) => w.openings)
  const roomAt = (p: Pt): Room | undefined =>
    rooms.find((r) => pointInPolygon(p, r.polygon) && !r.holes.some((h) => pointInPolygon(p, h)))

  const connections: ConnectionEdge[] = []
  for (const op of allOpenings) {
    if (op.nonCirculating || op.type === 'window') continue
    // Probe just past the wall face on each side of the opening's midpoint.
    const n = { x: -op.dir.y, y: op.dir.x }
    const reach = op.thickness / 2 + 60
    const a = roomAt(add(op.mid, scale(n, reach)))
    const b = roomAt(add(op.mid, scale(n, -reach)))
    if (!a || !b || a.id === b.id) continue
    connections.push({ openingId: op.id, a: a.id, b: b.id, type: op.type, sealed: !!op.sealed })
  }

  const adjacency = new Map<string, ConnectionEdge[]>()
  for (const r of rooms) adjacency.set(r.id, [])
  for (const c of connections) {
    adjacency.get(c.a)?.push(c)
    adjacency.get(c.b)?.push(c)
  }

  // ---- 6. totals ------------------------------------------------------------------
  const envelopeArea = area(data.envelope)
  const roomTotal = rooms.filter((r) => r.def.category !== 'void').reduce((s, r) => s + r.area, 0)
  const voidTotal = rooms.filter((r) => r.def.category === 'void').reduce((s, r) => s + r.area, 0)
  const carpet = rooms.filter((r) => r.def.carpet).reduce((s, r) => s + r.area, 0)
  const accounted = roomTotal + voidTotal + wallFootprintArea
  const err = accounted - envelopeArea

  return {
    data,
    envelope: data.envelope,
    envelopeCentreline: centreline,
    envelopeArea,
    envelopeBBox: bbox(data.envelope),
    walls,
    openings: allOpenings,
    rooms,
    roomById: new Map(rooms.map((r) => [r.id, r])),
    faces: sub2.faces,
    unclaimedFaces,
    connections,
    adjacency,
    wallFootprintArea,
    wallFootprint: wallUnion as unknown as number[][][][],
    splitWarnings,
    totals: {
      envelope: envelopeArea,
      rooms: roomTotal,
      voids: voidTotal,
      walls: wallFootprintArea,
      carpet,
      reconciliationError: err,
      reconciliationPct: (Math.abs(err) / envelopeArea) * 100,
    },
    curves,
  }
}

let cached: BuiltModel | null = null
/** The model is deterministic, so build it once and share it across every consumer. */
export function getModel(): BuiltModel {
  if (!cached) cached = buildModel(building)
  return cached
}
