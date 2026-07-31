/**
 * Planar subdivision.
 *
 * This is the mechanism behind brief §2.3: "Rooms are derived from walls, not drawn
 * independently." Nothing here knows what a room is. It takes a soup of boundary
 * polylines (wall centrelines, curved glass walls, zero-thickness thresholds), splits
 * them at every crossing, builds a half-edge graph, and walks out the faces those
 * boundaries enclose — including faces with holes.
 *
 * `offsetFace` then insets each face by half the thickness of whichever boundary
 * produced each edge, which is what turns a face into a room's carpet polygon. Move a
 * wall in the data and the face changes shape, so the room does too. There is no way to
 * author a room polygon by hand, which is the point.
 */

import type { Poly, Pt } from './vec'
import {
  closestPointOnSegment,
  cross,
  dedupePoly,
  dist,
  distToSegment,
  lineIntersect,
  norm,
  pointInPolygon,
  scale,
  segIntersect,
  signedArea,
  sub,
  add,
  area,
} from './vec'

/** A boundary handed to the subdivider. Thickness 0 means "divides space, occupies none". */
export interface BoundaryInput {
  id: string
  points: Pt[]
  /** Full wall thickness in mm. Each adjoining face is inset by half of it. */
  thickness: number
  kind: string
}

interface Edge {
  a: number
  b: number
  thickness: number
  boundaryId: string
  kind: string
}

export interface FaceEdgeRef {
  boundaryId: string
  kind: string
  thickness: number
  from: Pt
  to: Pt
}

export interface Face {
  index: number
  /** Face boundary along the wall CENTRELINES, before any inset. */
  outer: Poly
  holes: Poly[]
  /** Per-edge provenance, index-aligned with `outer` (edge i runs outer[i] -> outer[i+1]). */
  outerEdges: FaceEdgeRef[]
  holeEdges: FaceEdgeRef[][]
  /** Centreline area, i.e. gross of half the surrounding walls. */
  centrelineArea: number
}

const SNAP_TOL = 0.05 // mm; vertices closer than this are the same vertex
const WELD_TOL = 2 // mm; a dangling endpoint this close to another boundary snaps onto it

class VertexStore {
  pts: Pt[] = []
  private buckets = new Map<string, number[]>()
  private readonly cell = 1 // mm

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`
  }

  add(p: Pt): number {
    // Probe the 3x3 neighbourhood so a point near a cell edge still finds its twin.
    const gx = Math.floor(p.x / this.cell)
    const gy = Math.floor(p.y / this.cell)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const b = this.buckets.get(`${gx + dx},${gy + dy}`)
        if (!b) continue
        for (const i of b) if (dist(this.pts[i], p) <= SNAP_TOL) return i
      }
    }
    const idx = this.pts.length
    this.pts.push(p)
    const k = this.key(p.x, p.y)
    const arr = this.buckets.get(k)
    if (arr) arr.push(idx)
    else this.buckets.set(k, [idx])
    return idx
  }
}

export interface Subdivision {
  faces: Face[]
  vertices: Pt[]
  /** The cycle that bounds the infinite face, i.e. the outline of everything supplied. */
  outerCycle: Poly
}

/**
 * Split every input polyline wherever it crosses another, then walk faces.
 *
 * Collinear overlaps between different boundaries are NOT resolved here; the model data
 * is authored so that no two boundaries run along the same line. `assertNoCollinearOverlap`
 * is exported so the test suite can enforce that rather than leaving it to trust.
 */
export function subdivide(boundaries: BoundaryInput[]): Subdivision {
  const store = new VertexStore()

  // ---- 0. weld dangling endpoints onto the boundary they were meant to meet -----
  // A wall authored to die on a curved glass wall is given the exact point on the true
  // Bézier, but the subdivider sees the flattened polyline, whose chord sits a few
  // hundredths of a millimetre away. Without this the wall stops just short and the two
  // rooms it should separate merge into one face. Welding is deliberately limited to
  // polyline endpoints and to WELD_TOL, which is far below any real dimension.
  const work = boundaries.map((b) => ({ ...b, points: b.points.map((p) => ({ ...p })) }))
  for (const b of work) {
    for (const idx of [0, b.points.length - 1]) {
      const e = b.points[idx]
      let best: Pt | null = null
      let bestD = WELD_TOL
      for (const other of work) {
        if (other.id === b.id) continue
        for (let i = 0; i < other.points.length - 1; i++) {
          const d = distToSegment(e, other.points[i], other.points[i + 1])
          if (d > 1e-9 && d < bestD) {
            bestD = d
            best = closestPointOnSegment(e, other.points[i], other.points[i + 1]).point
          }
        }
      }
      if (best) {
        e.x = best.x
        e.y = best.y
      }
    }
  }

  // ---- 1. gather raw segments -------------------------------------------------
  interface Raw {
    p: Pt
    q: Pt
    thickness: number
    boundaryId: string
    kind: string
  }
  const raw: Raw[] = []
  for (const b of work) {
    for (let i = 0; i < b.points.length - 1; i++) {
      const p = b.points[i]
      const q = b.points[i + 1]
      if (dist(p, q) <= SNAP_TOL) continue
      raw.push({ p, q, thickness: b.thickness, boundaryId: b.id, kind: b.kind })
    }
  }

  // ---- 2. find split parameters -----------------------------------------------
  const splits: number[][] = raw.map(() => [0, 1])
  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) {
      const hit = segIntersect(raw[i].p, raw[i].q, raw[j].p, raw[j].q)
      if (!hit) continue
      splits[i].push(hit.t)
      splits[j].push(hit.u)
    }
  }

  // ---- 3. emit split edges ------------------------------------------------------
  const edges: Edge[] = []
  const edgeKeys = new Map<string, number>()
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]
    const ts = [...new Set(splits[i].map((t) => Math.min(1, Math.max(0, t))))].sort((a, b) => a - b)
    for (let k = 0; k < ts.length - 1; k++) {
      const t0 = ts[k]
      const t1 = ts[k + 1]
      const pa = { x: seg.p.x + (seg.q.x - seg.p.x) * t0, y: seg.p.y + (seg.q.y - seg.p.y) * t0 }
      const pb = { x: seg.p.x + (seg.q.x - seg.p.x) * t1, y: seg.p.y + (seg.q.y - seg.p.y) * t1 }
      if (dist(pa, pb) <= SNAP_TOL) continue
      const a = store.add(pa)
      const b = store.add(pb)
      if (a === b) continue
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const existing = edgeKeys.get(key)
      if (existing !== undefined) {
        // Two boundaries produced the same edge. Keep the thicker one so a wall never
        // loses its substance to a coincident zero-thickness threshold.
        if (seg.thickness > edges[existing].thickness) {
          edges[existing].thickness = seg.thickness
          edges[existing].boundaryId = seg.boundaryId
          edges[existing].kind = seg.kind
        }
        continue
      }
      edgeKeys.set(key, edges.length)
      edges.push({ a, b, thickness: seg.thickness, boundaryId: seg.boundaryId, kind: seg.kind })
    }
  }

  // ---- 4. half-edge graph -------------------------------------------------------
  // Half-edge 2i runs a->b, 2i+1 runs b->a.
  const n = edges.length
  const heFrom = new Int32Array(n * 2)
  const heTo = new Int32Array(n * 2)
  for (let i = 0; i < n; i++) {
    heFrom[2 * i] = edges[i].a
    heTo[2 * i] = edges[i].b
    heFrom[2 * i + 1] = edges[i].b
    heTo[2 * i + 1] = edges[i].a
  }
  const twin = (h: number): number => h ^ 1
  const edgeOf = (h: number): Edge => edges[h >> 1]

  const outgoing = new Map<number, number[]>()
  for (let h = 0; h < n * 2; h++) {
    const v = heFrom[h]
    const arr = outgoing.get(v)
    if (arr) arr.push(h)
    else outgoing.set(v, [h])
  }
  const pts = store.pts
  const angleOf = (h: number): number => {
    const a = pts[heFrom[h]]
    const b = pts[heTo[h]]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }
  const rank = new Map<number, number>()
  for (const [, arr] of outgoing) {
    arr.sort((h1, h2) => angleOf(h1) - angleOf(h2))
    arr.forEach((h, i) => rank.set(h, i))
  }

  // next(h): arrive at v along h, leave along the neighbour immediately clockwise from
  // the twin. That keeps the face consistently on one side of every half-edge.
  const next = (h: number): number => {
    const t = twin(h)
    const v = heFrom[t]
    const arr = outgoing.get(v)!
    const i = rank.get(t)!
    return arr[(i - 1 + arr.length) % arr.length]
  }

  // ---- 5. walk cycles -----------------------------------------------------------
  interface Cycle {
    halfEdges: number[]
    poly: Poly
    signed: number
  }
  const visited = new Uint8Array(n * 2)
  const cycles: Cycle[] = []
  for (let h0 = 0; h0 < n * 2; h0++) {
    if (visited[h0]) continue
    const walk: number[] = []
    let h = h0
    let guard = 0
    do {
      visited[h] = 1
      walk.push(h)
      h = next(h)
      if (++guard > n * 4 + 16) throw new Error('planar: face walk did not terminate')
    } while (h !== h0)
    const poly = walk.map((e) => pts[heFrom[e]])
    cycles.push({ halfEdges: walk, poly, signed: signedArea(poly) })
  }

  // ---- 6. classify cycles ------------------------------------------------------
  // Bounded faces are wound one way; holes and the infinite face are wound the other.
  // The infinite face's walk traces the outline of the whole arrangement, so its area is
  // the sum of every bounded face and is therefore the largest single cycle. Identify it
  // first, and the winding of everything else follows. (Summing by sign does NOT work:
  // holes side with the infinite face and can tip the total the wrong way.)
  let infinite: Cycle | null = null
  for (const c of cycles) {
    if (!infinite || Math.abs(c.signed) > Math.abs(infinite.signed)) infinite = c
  }
  if (!infinite) throw new Error('planar: no cycles found')
  const faceSign = -Math.sign(infinite.signed)
  const faceCycles = cycles.filter((c) => c !== infinite && Math.sign(c.signed) === faceSign)
  const holeCycles = cycles.filter((c) => c !== infinite && Math.sign(c.signed) !== faceSign)

  // ---- 7. assemble faces, attaching holes to their smallest container -----------
  const refOf = (h: number): FaceEdgeRef => {
    const e = edgeOf(h)
    return {
      boundaryId: e.boundaryId,
      kind: e.kind,
      thickness: e.thickness,
      from: pts[heFrom[h]],
      to: pts[heTo[h]],
    }
  }

  const faces: Face[] = faceCycles.map((c, index) => ({
    index,
    outer: c.poly,
    holes: [],
    outerEdges: c.halfEdges.map(refOf),
    holeEdges: [],
    centrelineArea: Math.abs(c.signed),
  }))

  for (const hole of holeCycles) {
    const probe = hole.poly[0]
    let best: Face | null = null
    for (const f of faces) {
      if (!pointInPolygon(probe, f.outer)) continue
      if (!best || f.centrelineArea < best.centrelineArea) best = f
    }
    if (!best) {
      throw new Error(
        `planar: hole cycle has no containing face — ${hole.poly.length} pts, ` +
          `area ${Math.abs(hole.signed).toFixed(0)} mm², near ` +
          `(${probe.x.toFixed(0)}, ${probe.y.toFixed(0)})`,
      )
    }
    best.holes.push(hole.poly)
    best.holeEdges.push(hole.halfEdges.map(refOf))
    best.centrelineArea -= Math.abs(hole.signed)
  }

  return {
    faces,
    vertices: pts,
    outerCycle: infinite ? infinite.poly : [],
  }
}

/**
 * Inset a face by half the thickness of the boundary behind each edge.
 *
 * Each edge is offset inward independently, then consecutive offset lines are
 * intersected to place the new vertex. Zero-thickness edges offset by zero and so pass
 * through unchanged, which is how thresholds and glazing lines divide rooms without
 * consuming floor.
 */
export function offsetRing(ring: Poly, edges: FaceEdgeRef[], inward: boolean): Poly {
  const m = ring.length
  if (m < 3) return ring

  // Normalise winding so the interior is consistently on the left of each edge.
  const wantPositive = inward
  let poly = ring
  let refs = edges
  if (signedArea(ring) > 0 !== wantPositive) {
    poly = [...ring].reverse()
    // Edge i of the original runs ring[i] -> ring[i+1]; after reversing, the edge
    // leaving poly[i] is the original edge (m-1-i-1).
    refs = edges.map((_, i) => edges[(m - 1 - i - 1 + m) % m])
  }

  interface OffLine {
    p: Pt
    d: Pt
    n: Pt
    dist: number
  }
  const lines: OffLine[] = []
  for (let i = 0; i < m; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % m]
    const d = norm(sub(b, a))
    // For a positively-wound ring the interior lies to the left, which is (-dy, dx).
    const nrm = { x: -d.y, y: d.x }
    const off = refs[i].thickness / 2
    lines.push({ p: add(a, scale(nrm, off)), d, n: nrm, dist: off })
  }

  const out: Pt[] = []
  for (let i = 0; i < m; i++) {
    const prev = lines[(i - 1 + m) % m]
    const curr = lines[i]
    const original = poly[i]
    const hit = lineIntersect(prev.p, prev.d, curr.p, curr.d)
    if (!hit) {
      // The two edges are parallel. If they also carry the same offset the vertex is a
      // straight-through and one point suffices. If the offsets differ — a 150 wall
      // meeting a zero-thickness shaft edge in line with it, say — the inset boundary
      // genuinely steps sideways, and collapsing that to one point silently loses (or
      // invents) floor area. Emit both points so the step is drawn.
      const pPrev = add(original, scale(prev.n, prev.dist))
      const pCurr = add(original, scale(curr.n, curr.dist))
      if (dist(pPrev, pCurr) > 1e-6) out.push(pPrev, pCurr)
      else out.push(pCurr)
      continue
    }
    // Guard against runaway miters at very shallow corners, which flattened Bézier
    // joins can produce. Beyond 4x the offset, fall back to averaging the two lines.
    const budget = 4 * Math.max(prev.dist, curr.dist) + 1
    if (dist(hit, original) > budget) {
      out.push({ x: (prev.p.x + curr.p.x) / 2, y: (prev.p.y + curr.p.y) / 2 })
    } else {
      out.push(hit)
    }
  }
  return dedupePoly(out, 1e-4)
}

export interface OffsetFace {
  outer: Poly
  holes: Poly[]
  area: number
}

/** Inset a whole face (outer boundary in, holes out) to produce the usable floor polygon. */
export function offsetFace(face: Face): OffsetFace {
  const outer = offsetRing(face.outer, face.outerEdges, true)
  const holes = face.holes.map((h, i) => offsetRing(h, face.holeEdges[i], false))
  const a = area(outer) - holes.reduce((s, h) => s + area(h), 0)
  return { outer, holes, area: a }
}

/**
 * Detect two boundaries running along the same line for a non-zero distance. The
 * subdivision cannot resolve those, so the model must not contain any; the test suite
 * calls this to prove it doesn't.
 */
export function findCollinearOverlaps(
  boundaries: BoundaryInput[],
  tol = 0.5,
): Array<{ a: string; b: string; at: Pt }> {
  interface Seg {
    p: Pt
    q: Pt
    id: string
  }
  const segs: Seg[] = []
  for (const b of boundaries) {
    for (let i = 0; i < b.points.length - 1; i++) {
      if (dist(b.points[i], b.points[i + 1]) > tol) {
        segs.push({ p: b.points[i], q: b.points[i + 1], id: b.id })
      }
    }
  }
  const out: Array<{ a: string; b: string; at: Pt }> = []
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i]
      const s2 = segs[j]
      if (s1.id === s2.id) continue
      const d1 = sub(s1.q, s1.p)
      const d2 = sub(s2.q, s2.p)
      if (Math.abs(cross(norm(d1), norm(d2))) > 1e-6) continue // not parallel
      // Parallel: are they on the same line, and do they actually overlap?
      const perp = { x: -norm(d1).y, y: norm(d1).x }
      const sep = Math.abs(
        perp.x * (s2.p.x - s1.p.x) + perp.y * (s2.p.y - s1.p.y),
      )
      if (sep > tol) continue
      const l = Math.hypot(d1.x, d1.y)
      const u = norm(d1)
      const proj = (p: Pt): number => u.x * (p.x - s1.p.x) + u.y * (p.y - s1.p.y)
      const a2 = Math.min(proj(s2.p), proj(s2.q))
      const b2 = Math.max(proj(s2.p), proj(s2.q))
      const lo = Math.max(0, a2)
      const hi = Math.min(l, b2)
      if (hi - lo > tol) {
        out.push({ a: s1.id, b: s2.id, at: add(s1.p, scale(u, (lo + hi) / 2)) })
      }
    }
  }
  return out
}
