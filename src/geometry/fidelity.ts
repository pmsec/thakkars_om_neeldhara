/**
 * The 2D↔3D fidelity contract. One module, used by BOTH the 3D renderers and
 * the test suite, so the rule cannot fork:
 *
 *   1. A piece's 3D footprint is `renderedFootprint()` — its drawn 2D polygon
 *      when the exporter shipped one, its bounding box otherwise. The bbox is
 *      only ever used where it is a SUPERSET of the drawing (detail-modelled
 *      kinds), so testing it against walls is conservative.
 *   2. Footprints are clipped against the model's wall footprint before they
 *      are extruded (`clipToPlan`) — furniture can not occupy wall space, by
 *      construction, exactly as the 2D sheet draws walls over furniture.
 *   3. `wallCrossings()` lists every footprint with real area on BOTH sides
 *      of any wall centreline. The suite asserts it is empty, so a 3D scene
 *      that deviates from the 2D plan fails the build instead of shipping.
 *
 * This exists because the den's pantry run — drawn hugging the curved pod
 * screen — was exported as its bounding box and poked through the glass into
 * the great room. The instance was easy; this is the guarantee.
 */

import polygonClipping from 'polygon-clipping'
import { fixtures } from '../data/fixtures'
import { furniture, type FurnitureItem } from '../data/furniture'
import type { FixtureDef } from '../data/schema'
import { getModel, type WallRun } from './model'
import { add, area, norm, pointInPolygon, scale, sub, type Poly, type Pt } from './vec'

// polygon-clipping ships both CJS and ESM shapes depending on bundler; normalise.
const pc = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ??
  polygonClipping) as typeof polygonClipping

type PcRing = [number, number][]
type PcPoly = PcRing[]
type PcMulti = PcPoly[]

/** Real area below which an overlap is numeric noise, mm² (0.002 m²). */
const EPS_AREA = 2000

/** Kinds the renderers extrude as one solid slab from the drawn outline. */
export const EXTRUDED_KINDS = new Set<string>([
  'console', 'table', 'bench', 'wardrobe', 'shelves', 'stool',
])

/** Every kind whose RENDERED footprint is its drawn outline — the slab kinds
 * plus the kinds with their own outline-driven builders. Keep in lockstep
 * with furnitureMesh: the tests judge exactly what the renderer draws. */
export const POLY_FOOTPRINT_KINDS = new Set<string>([
  ...EXTRUDED_KINDS, 'rug', 'grass', 'planter', 'dining',
])

function closeRing(p: Poly): PcRing {
  const r: PcRing = p.map((q) => [q.x, q.y])
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0])
  return r
}

function openRing(r: PcRing): Poly {
  const out = r.map(([x, y]) => ({ x, y }))
  const a = out[0]
  const b = out[out.length - 1]
  if (out.length > 1 && a.x === b.x && a.y === b.y) out.pop()
  return out
}

function multiArea(m: PcMulti): number {
  let s = 0
  for (const poly of m) {
    poly.forEach((ring, i) => {
      const a = area(ring.map(([x, y]) => ({ x, y })))
      s += i === 0 ? a : -a
    })
  }
  return s
}

function rect(x: number, y: number, w: number, d: number): Poly {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }]
}

/** The plan footprint the 3D actually renders for a furniture piece. */
export function furnitureFootprint(f: FurnitureItem): Poly {
  if (f.poly && POLY_FOOTPRINT_KINDS.has(f.kind)) return f.poly
  return rect(f.x, f.y, f.w, f.d)
}

/** The plan footprint the 3D actually renders for a fixture. */
export function fixtureFootprint(f: FixtureDef): Poly {
  if (f.poly) return f.poly
  return rect(f.at.x - f.size[0] / 2, f.at.y - f.size[1] / 2, f.size[0], f.size[1])
}

export interface Footprint {
  outer: Poly
  holes: Poly[]
}

/**
 * A footprint minus the wall footprint: the space a piece may actually
 * occupy. Extruding THIS instead of the raw shape means a piece drawn to a
 * wall's centreline (the glass screens' convention) stops at the glass face
 * in 3D rather than penetrating it.
 */
export function clipToPlan(poly: Poly): Footprint[] {
  const walls = getModel().wallFootprint as unknown as PcMulti
  const clipped = pc.difference(
    [[closeRing(poly)]] as unknown as polygonClipping.Geom,
    walls as unknown as polygonClipping.Geom,
  ) as unknown as PcMulti
  return clipped
    .map((rings) => ({ outer: openRing(rings[0]), holes: rings.slice(1).map(openRing) }))
    .filter((f) => f.outer.length >= 3 && area(f.outer) > EPS_AREA)
    .sort((a, b) => area(b.outer) - area(a.outer))
}

function centroidOf(poly: Poly): Pt {
  let x = 0
  let y = 0
  for (const p of poly) {
    x += p.x
    y += p.y
  }
  return { x: x / poly.length, y: y / poly.length }
}

/** The room whose carpet contains the point, if any. */
function roomAt(p: Pt): string | null {
  for (const r of getModel().rooms) {
    if (pointInPolygon(p, r.polygon) && !r.holes.some((h) => pointInPolygon(p, h))) return r.id
  }
  return null
}

/**
 * What the renderers extrude: the clipped footprint's fragments that belong
 * to the piece's own room. A wall can notch a piece (the arch console where
 * the exporter's straight jog stands in for the sweep) without deleting its
 * tail — but a fragment a wall pushes into a DIFFERENT room (the severed
 * sliver of a known 2D clash) is not furniture and must not appear there.
 * With no room given, the largest fragment wins.
 */
export function renderFootprints(poly: Poly, room?: string): Footprint[] {
  const fragments = clipToPlan(poly)
  if (!room) return fragments.slice(0, 1)
  const kept = fragments.filter((fr) => {
    const at = roomAt(centroidOf(fr.outer))
    return at === null || at === room
  })
  return kept.length ? kept : fragments.slice(0, 1)
}

// ------------------------------------------------------------- wall crossing

/** The band on ONE side of a run's centreline. BUTT caps, deliberately: the
 * model's wall footprint extends square caps to fill junction corners, but a
 * piece standing against a wall's drawn END is not crossing it, and the cap
 * extension manufactured exactly those false quarter-thickness corners. */
function sideQuads(points: Pt[], half: number, sign: 1 | -1): PcMulti {
  const quads: PcMulti = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const d = norm(sub(b, a))
    if (d.x === 0 && d.y === 0) continue
    const n = scale({ x: -d.y, y: d.x }, half * sign)
    quads.push([closeRing([a, b, add(b, n), add(a, n)])])
  }
  return quads
}

interface WallSides {
  wall: WallRun
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
  plus: polygonClipping.Geom
  minus: polygonClipping.Geom
}

let wallSidesCache: WallSides[] | null = null

function wallSides(): WallSides[] {
  if (wallSidesCache) return wallSidesCache
  const out: WallSides[] = []
  for (const w of getModel().walls) {
    if (w.thickness <= 0 || w.points.length < 2) continue
    const half = w.thickness / 2
    const xs = w.points.map((p) => p.x)
    const ys = w.points.map((p) => p.y)
    const union = (quads: PcMulti): polygonClipping.Geom =>
      (quads.length
        ? pc.union(quads[0] as unknown as polygonClipping.Geom, ...(quads.slice(1) as unknown as polygonClipping.Geom[]))
        : []) as unknown as polygonClipping.Geom
    out.push({
      wall: w,
      bbox: {
        minX: Math.min(...xs) - w.thickness,
        minY: Math.min(...ys) - w.thickness,
        maxX: Math.max(...xs) + w.thickness,
        maxY: Math.max(...ys) + w.thickness,
      },
      plus: union(sideQuads(w.points, half, 1)),
      minus: union(sideQuads(w.points, half, -1)),
    })
  }
  wallSidesCache = out
  return out
}

export interface Crossing {
  itemId: string
  itemLabel: string
  wallId: string
  /** Overlap area on each side of the centreline, mm². */
  areas: [number, number]
}

/**
 * Wall crossings that exist IN THE 2D DRAWING itself — found by this very
 * check, raised with the owner, awaiting a CAD-side decision. Each is pinned
 * to its measured size: if the overlap grows past `maxArea` (mm², either
 * side), the gate fails again. The 3D renderers clip these pieces at the
 * wall, so neither ever penetrates a wall on screen.
 */
export const KNOWN_2D_CLASHES: Array<{
  /** Matches by exported id OR by label — ids renumber when kinds change. */
  item: string
  wallId: string
  maxArea: number
  note: string
}> = [
  {
    item: 'Shower',
    wallId: 'W-HELP-N',
    maxArea: 60000,
    note: 'Guest WC shower: drawn from y 8425, which is 100 into the 125 great-room wall band (face at 8525).',
  },
  {
    item: 'FX-P-CAB',
    wallId: 'W-P-DRESS',
    maxArea: 20000,
    note: "Jog idealisation, west wing only: the parents' dressing partition dies into the bath sweep, modelled as a straight jog — the bath wall cabinet beds on the sweep and crosses that jog on paper only. Karan's side has no partition, so no counterpart.",
  },
]

/**
 * Every furniture/fixture footprint that CROSSES a wall — real area on both
 * sides of its centreline. Touching a wall, or backing onto the glass line,
 * is one-sided and legal; poking through to the other side never is.
 *
 * Pieces that live INSIDE a wall by design (pocket sliders: ≥70 % of their
 * area inside the wall footprint) are exempt — the 2D draws them there too.
 */
export function wallCrossings(): Crossing[] {
  const model = getModel()
  const wallsGeom = model.wallFootprint as unknown as polygonClipping.Geom
  const out: Crossing[] = []

  const items: Array<{ id: string; label: string; fp: Poly }> = [
    ...furniture.map((f) => ({ id: f.id, label: f.label, fp: furnitureFootprint(f) })),
    ...fixtures.map((f) => ({ id: f.id, label: f.label ?? f.kind, fp: fixtureFootprint(f) })),
  ]

  for (const it of items) {
    const fpGeom = [[closeRing(it.fp)]] as unknown as polygonClipping.Geom
    const fpArea = area(it.fp)
    if (fpArea <= EPS_AREA) continue
    const xs = it.fp.map((p) => p.x)
    const ys = it.fp.map((p) => p.y)
    const fpBox = {
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys),
    }
    // In-wall by design (pocket sliders, in-wall panels): the 2D draws these
    // inside the wall zone, so the 3D showing them there is not a deviation.
    const inWall = multiArea(pc.intersection(fpGeom, wallsGeom) as unknown as PcMulti)
    if (inWall >= 0.7 * fpArea) continue

    for (const ws of wallSides()) {
      if (
        fpBox.maxX < ws.bbox.minX || fpBox.minX > ws.bbox.maxX ||
        fpBox.maxY < ws.bbox.minY || fpBox.minY > ws.bbox.maxY
      ) continue
      // A crossing needs REAL area on both sides: more than noise, and more
      // than half a percent of the piece — a long parapet strip nicking a
      // 150 mm jog stub at its corner is a drawn 2D condition, not a piece
      // standing on the wrong side of a wall.
      const minReal = Math.max(EPS_AREA, 0.005 * fpArea)
      const aPlus = multiArea(pc.intersection(fpGeom, ws.plus) as unknown as PcMulti)
      if (aPlus <= minReal) continue
      const aMinus = multiArea(pc.intersection(fpGeom, ws.minus) as unknown as PcMulti)
      if (aMinus <= minReal) continue
      const known = KNOWN_2D_CLASHES.find(
        (k) => (k.item === it.id || k.item === it.label) && k.wallId === ws.wall.id,
      )
      if (known && aPlus <= known.maxArea && aMinus <= known.maxArea) continue
      out.push({ itemId: it.id, itemLabel: it.label, wallId: ws.wall.id, areas: [aPlus, aMinus] })
    }
  }
  return out
}

/** Footprint area outside the envelope, mm² — nothing may stand outside the home. */
export function outsideEnvelope(): Crossing[] {
  const model = getModel()
  const env = [[closeRing(model.envelope)]] as unknown as polygonClipping.Geom
  const out: Crossing[] = []
  const items: Array<{ id: string; label: string; fp: Poly }> = [
    ...furniture.map((f) => ({ id: f.id, label: f.label, fp: furnitureFootprint(f) })),
    ...fixtures.map((f) => ({ id: f.id, label: f.label ?? f.kind, fp: fixtureFootprint(f) })),
  ]
  for (const it of items) {
    // a window box hangs OUTSIDE the facade by design - it is the one piece
    // whose footprint is meant to be off the envelope
    if (/^window box/i.test(it.label)) continue
    const fpGeom = [[closeRing(it.fp)]] as unknown as polygonClipping.Geom
    const outside = multiArea(pc.difference(fpGeom, env) as unknown as PcMulti)
    if (outside > EPS_AREA) {
      out.push({ itemId: it.id, itemLabel: it.label, wallId: 'ENVELOPE', areas: [outside, outside] })
    }
  }
  return out
}
