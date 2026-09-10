/**
 * BESPOKE PIECES FOR AN IMPORTED HOME.
 *
 * Home 1's joinery is modelled as FIXTURES with their own renderers; a home
 * exported through the generic contract has furniture only, and the walkthrough
 * used to stand a box up for anything it did not recognise — a shower tray
 * became a 2.1 m panel, a WC a walnut console, the fridge a bookshelf, a lounge
 * swivel an office chair on castors. These pieces are picked by what the label
 * says the thing is, in the words the drawing uses, and every one stays inside
 * its drawn footprint so the fidelity gate still holds.
 */

import * as THREE from 'three'
import { getModel } from '../geometry/model'
import type { FurnitureItem } from '../data/furniture'
import { S } from './prism'

type Mat = THREE.Material
export interface PieceKit {
  M: Record<string, Mat>
  /** a box of w × h × d at (x, y, z) in the piece's local frame, mm */
  box: (w: number, h: number, d: number, mat: Mat, x?: number, y?: number, z?: number) => THREE.Mesh
  /** the drawn outline extruded base..top, in the piece's local frame */
  basePrism: (poly: { x: number; y: number }[], base: number, top: number, mat: Mat) => THREE.Mesh
  place: (o: THREE.Object3D, cx: number, cy: number, h?: number) => void
}

type Side = 'N' | 'S' | 'E' | 'W'
const SIDES: Side[] = ['N', 'S', 'E', 'W']

/** How far each side of a piece's footprint is from the nearest wall face. */
export function wallGaps(f: FurnitureItem): Record<Side, number> {
  const model = getModel()
  const cx = f.x + f.w / 2, cy = f.y + f.d / 2
  const probe: Record<Side, { x: number; y: number }> = {
    N: { x: cx, y: f.y }, S: { x: cx, y: f.y + f.d }, W: { x: f.x, y: cy }, E: { x: f.x + f.w, y: cy },
  }
  const out = { N: Infinity, S: Infinity, E: Infinity, W: Infinity }
  for (const side of SIDES) {
    const q = probe[side]
    for (const w of model.walls) {
      if (w.thickness < 60) continue
      for (let k = 1; k < w.points.length; k++) {
        const a = w.points[k - 1], b = w.points[k]
        const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
        const t = L2 ? Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / L2)) : 0
        const d = Math.hypot(q.x - (a.x + t * (b.x - a.x)), q.y - (a.y + t * (b.y - a.y))) - w.thickness / 2
        if (d < out[side]) out[side] = d
      }
    }
  }
  return out
}
/**
 * The nearest wall face to a point: the foot on the face, the unit tangent
 * along it and the unit normal from the face toward the point. A piece on a
 * curved wall has its back in THIS frame, not on a side of its bounding box -
 * the wash basin on Ekta's curve had its mirror standing on the box's north
 * edge, at 40 degrees to the wall it was meant to hang on.
 */
export function wallFrameAt(x: number, y: number): { px: number; py: number; ux: number; uy: number; nx: number; ny: number; dist: number } | null {
  const model = getModel()
  let best: { px: number; py: number; ux: number; uy: number; nx: number; ny: number; dist: number } | null = null
  for (const w of model.walls) {
    if (w.thickness < 60) continue
    for (let k = 1; k < w.points.length; k++) {
      const a = w.points[k - 1], b = w.points[k]
      const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      if (!L2) continue
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / L2))
      const fx = a.x + t * (b.x - a.x), fy = a.y + t * (b.y - a.y)
      const dx = x - fx, dy = y - fy
      const dc = Math.hypot(dx, dy)
      const dist = dc - w.thickness / 2
      if (!best || dist < best.dist) {
        const L = Math.sqrt(L2)
        const nx = dc ? dx / dc : 0, ny = dc ? dy / dc : 0
        best = { px: fx + nx * w.thickness / 2, py: fy + ny * w.thickness / 2, ux: (b.x - a.x) / L, uy: (b.y - a.y) / L, nx, ny, dist }
      }
    }
  }
  return best
}
function wallSide(f: FurnitureItem): Side {
  const g = wallGaps(f)
  return SIDES.reduce((best, s) => (g[s] < g[best] ? s : best), 'N' as Side)
}
function opposite(s: Side): Side {
  return s === 'N' ? 'S' : s === 'S' ? 'N' : s === 'E' ? 'W' : 'E'
}
/** unit vector of a side, in the local frame (x east, z south) */
function vec(s: Side): { x: number; z: number } {
  return s === 'N' ? { x: 0, z: -1 } : s === 'S' ? { x: 0, z: 1 } : s === 'E' ? { x: 1, z: 0 } : { x: -1, z: 0 }
}

/** a framed mirror against `side` of the footprint, its glass toward the room */
function mirrorOn(k: PieceKit, f: FurnitureItem, side: Side, width: number, h0 = 1100, h1 = 2000): THREE.Group {
  const g = new THREE.Group()
  const v = vec(side)
  const along = side === 'N' || side === 'S'
  const off = (along ? f.d : f.w) / 2 - 14        // just inside the drawn footprint, on the wall side
  const H = h1 - h0
  g.add(k.box(along ? width + 60 : 26, H + 60, along ? 26 : width + 60, k.M.trunk, v.x * off, (h0 + h1) / 2, v.z * off))
  g.add(k.box(along ? width : 10, H, along ? 10 : width, k.M.mirror, v.x * (off - 10), (h0 + h1) / 2, v.z * (off - 10)))
  return g
}

export function importedPiece(f: FurnitureItem, k: PieceKit): THREE.Object3D | null {
  const { M, box, basePrism, place } = k
  const g = new THREE.Group()
  const w = f.w, d = f.d
  const cx = f.x + w / 2, cy = f.y + d / 2
  const label = f.label
  const poly = f.poly
  const localRect = [{ x: f.x, y: f.y }, { x: f.x + w, y: f.y }, { x: f.x + w, y: f.y + d }, { x: f.x, y: f.y + d }]

  // The recliners' seats are drawn as their own pieces so the plan shows the
  // split; the sofa renderer draws its cushions, so these draw nothing.
  if (f.kind === 'sofa' && /^seat —/i.test(label)) return g

  // ---- a lounge swivel: a disc base, a stem, a round tub seat, a wrapped back
  if (f.kind === 'armchair' && /swivel chair/i.test(label)) {
    const r = Math.min(w, d) / 2
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55 * S, r * 0.6 * S, 28 * S, 24), M.brass)
    disc.position.y = 14 * S
    g.add(disc)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(30 * S, 36 * S, 300 * S, 12), M.metal)
    stem.position.y = 178 * S
    g.add(stem)
    const seat = new THREE.Mesh(new THREE.CylinderGeometry((r - 10) * S, (r - 40) * S, 150 * S, 28), M.fabric)
    seat.position.y = 400 * S
    seat.castShadow = true
    g.add(seat)
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry((r - 50) * S, (r - 60) * S, 60 * S, 28), M.fabricDark)
    cushion.position.y = 505 * S
    g.add(cushion)
    // the back wraps the rear half, standing on the seat's rim
    const face = f.face ?? 'S'
    const dirAng = face === 'S' ? Math.PI / 2 : face === 'N' ? -Math.PI / 2 : face === 'E' ? 0 : Math.PI
    const segs = 9
    for (let i = 0; i < segs; i++) {
      const a = dirAng + Math.PI / 2 + (Math.PI * (i + 0.5)) / segs      // from the left arm round to the right
      const rr = r - 55
      const bh = 300 + 160 * Math.sin((Math.PI * (i + 0.5)) / segs)      // low at the arms, tallest at the back
      const seg = box(110, bh, 70, M.fabric, Math.cos(a) * rr, 475 + bh / 2, Math.sin(a) * rr)
      seg.rotation.y = -a
      seg.castShadow = true
      g.add(seg)
    }
    place(g, cx, cy)
    return g
  }

  // ---- the fridge: a steel box, a two-door front toward the room, bar handles
  if (f.kind === 'shelves' && /fridge/i.test(label)) {
    const H = Math.min(f.height, 1900)
    g.add(box(w - 8, H, d - 8, M.appliance, 0, H / 2, 0))
    const front = f.face ?? opposite(wallSide(f))
    const v = vec(front)
    const along = front === 'N' || front === 'S'
    const out = (along ? d : w) / 2 - 2
    const span = along ? w - 8 : d - 8
    // the door split, two thirds up, and a handle on each door
    g.add(box(along ? span : 6, 6, along ? 6 : span, M.graphite, v.x * out, H * 0.66, v.z * out))
    for (const [h0, h1] of [[H * 0.7, H - 120], [140, H * 0.62]] as const) {
      const hh = h1 - h0
      const px = along ? span / 2 - 90 : v.x * (out + 10)
      const pz = along ? v.z * (out + 10) : span / 2 - 90
      g.add(box(along ? 22 : 30, hh, along ? 30 : 22, M.chrome, along ? px * (front === 'S' ? 1 : -1) : px, (h0 + h1) / 2, along ? pz : pz * (front === 'E' ? 1 : -1)))
    }
    place(g, cx, cy)
    return g
  }

  // ---- the WC: a porcelain cistern against the wall, the pan in front of it
  if (f.kind === 'console' && /WC cistern/i.test(label)) {
    const cist = poly ? basePrism(poly, 380, Math.min(f.height, 900), M.porcelain) : box(w, 520, d, M.porcelain, 0, 640, 0)
    g.add(cist)
    const wall = wallSide(f)
    const v = vec(opposite(wall))
    g.add(box(60, 8, 30, M.chrome, v.x * 0, Math.min(f.height, 900) + 4, v.z * 0))
    place(g, cx, cy)
    return g
  }
  if (f.kind === 'console' && /^WC —/i.test(label)) {
    const H = Math.min(f.height, 420)
    g.add(poly ? basePrism(poly, 0, H - 40, M.porcelain) : box(w - 40, H - 40, d - 40, M.porcelain, 0, (H - 40) / 2, 0))
    // the seat and its lid, a little inside the pan's outline
    const lid = poly ? basePrism(poly.map((q) => ({ x: cx + (q.x - cx) * 0.9, y: cy + (q.y - cy) * 0.9 })), H - 40, H, M.porcelain)
      : box(w - 80, 40, d - 80, M.porcelain, 0, H - 20, 0)
    g.add(lid)
    place(g, cx, cy)
    return g
  }

  // ---- a basin console: a walnut cabinet under a stone top, a mirror on the wall over it
  if (f.kind === 'console' && /basin console/i.test(label)) {
    const top = Math.min(f.height, 900)
    g.add(poly ? basePrism(poly, 0, top - 30, M.walnut) : box(w, top - 30, d, M.walnut, 0, (top - 30) / 2, 0))
    g.add(poly ? basePrism(poly, top - 30, top, M.marble) : box(w, 30, d, M.marble, 0, top - 15, 0))
    const wall = wallSide(f)
    const along = wall === 'N' || wall === 'S'
    const half = (along ? d : w) / 2
    const fr = wallFrameAt(cx, cy)
    if (fr && fr.dist < half + 400) {
      // everything on the back of the piece is set out from the wall's face
      // along its tangent, so a console on a curve carries its mirror flat on
      // the curve. `out` is measured from the face; the piece's own back edge
      // is `gap` off it.
      const gap = Math.max(0, fr.dist - half)
      const yaw = -Math.atan2(fr.uy, fr.ux)
      const at = (u: number, out: number, h: number, m: THREE.Object3D) => {
        m.position.set((fr.px + fr.nx * out + fr.ux * u - cx) * S, h * S, (fr.py + fr.ny * out + fr.uy * u - cy) * S)
        m.rotation.y = yaw
        g.add(m)
      }
      const span = Math.min(700, (along ? w : d) - 200)
      at(0, gap + 27, 1550, box(span + 60, 960, 26, M.trunk))
      at(0, gap + 44, 1550, box(span, 900, 10, M.mirror))
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(12 * S, 14 * S, 180 * S, 10), M.chrome)
      at(0, gap + 70, top + 90, tap)
      at(0, gap + 125, top + 172, box(16, 14, 120, M.chrome))
      at(span / 2 - 60, gap + 120, top + 20, box(120, 40, 160, M.pillow))
    } else {
      g.add(mirrorOn(k, f, wall, Math.min(900, (along ? w : d) - 80)))
    }
    place(g, cx, cy)
    return g
  }
  // ---- the bowl on it: an oval porcelain basin standing on the top
  if (f.kind === 'console' && /^basin —/i.test(label)) {
    const base = Math.min(f.height, 880)
    const ring = poly ?? localRect
    const inner = ring.map((q) => ({ x: cx + (q.x - cx) * 0.78, y: cy + (q.y - cy) * 0.78 }))
    g.add(basePrism(ring, base + 20, base + 130, M.porcelain))
    g.add(basePrism(inner, base + 20, base + 34, M.porcelain))
    // the ring's inside: a second, smaller prism read through the rim would be
    // solid, so the rim is what shows; the floor of the bowl sits 14 above the top
    place(g, cx, cy)
    return g
  }

  // ---- a shower: a stone tray and a glass screen on its free edges
  if (f.kind === 'screen' && /shower/i.test(label)) {
    const ring = poly ?? localRect
    g.add(basePrism(ring, 0, 45, M.stone))
    // each outline edge whose midpoint is clear of any wall carries the screen
    const model = getModel()
    const clear = (p: { x: number; y: number }): boolean => {
      let best = Infinity
      for (const wl of model.walls) {
        if (wl.thickness < 60) continue
        for (let i = 1; i < wl.points.length; i++) {
          const a = wl.points[i - 1], b = wl.points[i]
          const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
          const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2)) : 0
          best = Math.min(best, Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))) - wl.thickness / 2)
        }
      }
      return best > 90
    }
    const H = Math.min(f.height, 2000)
    const noScreen = /no screen|curtain/i.test(label)
    let door = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      if (L < 30 || noScreen) continue
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!clear(mid)) continue
      const pane = box(L, H - 45, 12, M.glass, mid.x - cx, 45 + (H - 45) / 2, mid.y - cy)
      pane.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x)
      g.add(pane)
      door += L
    }
    // the shower head on its arm off the wall the label names (else the nearest
    // wall), the mixer below it
    const said = /head on the (north|south|east|west) wall/i.exec(label)
    const ws: Side = said ? (said[1][0].toUpperCase() as Side) : wallSide(f)
    const v = vec(ws)
    const along = ws === 'N' || ws === 'S'
    const edge = (along ? d : w) / 2                          // the footprint's edge on that side
    const headOut = 200
    const head = new THREE.Mesh(new THREE.CylinderGeometry(90 * S, 90 * S, 10 * S, 20), M.chrome)
    head.position.set(v.x * (edge - headOut) * S, 2050 * S, v.z * (edge - headOut) * S)
    g.add(head)
    const arm = box(along ? 16 : headOut, 16, along ? headOut : 16, M.chrome, v.x * (edge - headOut / 2), 2060, v.z * (edge - headOut / 2))
    g.add(arm)
    const mixer = new THREE.Mesh(new THREE.CylinderGeometry(40 * S, 40 * S, 30 * S, 14), M.chrome)
    mixer.rotation[along ? 'x' : 'z'] = Math.PI / 2
    mixer.position.set(v.x * (edge - 25) * S, 1100 * S, v.z * (edge - 25) * S)
    g.add(mixer)
    const lever = box(along ? 90 : 12, 12, along ? 12 : 90, M.chrome, v.x * (edge - 45), 1100, v.z * (edge - 45))
    g.add(lever)
    void door
    place(g, cx, cy)
    return g
  }

  // ---- the kitchen worktop: base cabinets under a stone top, a hob and a sink on the run
  if (f.kind === 'table' && /^worktop/i.test(label)) {
    const ring = poly ?? localRect
    const top = Math.min(f.height, 900)
    g.add(basePrism(ring, 0, 100, M.graphite))                 // the plinth, set back by colour
    g.add(basePrism(ring, 100, top - 40, M.wallWood))
    g.add(basePrism(ring, top - 40, top, M.marble))
    // the north run is the part of the outline within 700 of the footprint's top
    const north = ring.filter((q) => q.y < f.y + 700)
    if (north.length) {
      const xs = north.map((q) => q.x)
      const x0 = Math.min(...xs)
      // the hob and the sink are on the plan as their own pieces (see below);
      // what stands on the run is two jars against the wall at the corner end
      const runY = f.y + 300                                   // the middle of a 600 worktop
      for (const [ox, hh] of [[260, 170], [350, 130]] as const) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(48 * S, 48 * S, hh * S, 14), M.acrylic)
        jar.position.set((x0 + ox - cx) * S, (top + hh / 2) * S, (runY - cy - 200) * S)
        g.add(jar)
        g.add(box(96, 12, 96, M.walnut, x0 + ox - cx, top + hh + 6, runY - cy - 200))
      }
    }
    // door lines on the front: a groove every 600 along the outline's inner edge
    place(g, cx, cy)
    return g
  }

  // ---- the sink: a steel rim flush with the top, the dark bowl inside it, a
  // tap at the back on the wall side
  if (f.kind === 'console' && /^sink —/i.test(label)) {
    const top = Math.min(f.height, 900)
    const R = 44
    g.add(box(w, 6, R, M.steel, 0, top + 3, -d / 2 + R / 2))
    g.add(box(w, 6, R, M.steel, 0, top + 3, d / 2 - R / 2))
    g.add(box(R, 6, d, M.steel, -w / 2 + R / 2, top + 3, 0))
    g.add(box(R, 6, d, M.steel, w / 2 - R / 2, top + 3, 0))
    g.add(box(w - 2 * R, 4, d - 2 * R, M.graphite, 0, top + 2, 0))
    const back = wallSide(f)
    const v = vec(back)
    const along = back === 'N' || back === 'S'
    const b = (along ? d : w) / 2 - 40
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(12 * S, 14 * S, 260 * S, 10), M.chrome)
    tap.position.set(v.x * b * S, (top + 130) * S, v.z * b * S)
    g.add(tap)
    g.add(box(along ? 16 : 180, 14, along ? 180 : 16, M.chrome, v.x * (b - 85), top + 252, v.z * (b - 85)))
    place(g, cx, cy)
    return g
  }
  // ---- the hob: a black glass plate, four burner rings, the knobs on its front edge
  if (f.kind === 'console' && /^hob —/i.test(label)) {
    const top = Math.min(f.height, 900)
    g.add(box(w, 8, d, M.hob, 0, top + 4, 0))
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(85 * S, 85 * S, 5 * S, 20), M.metal)
      ring.position.set(i * 145 * S, (top + 10) * S, j * 120 * S)
      g.add(ring)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(32 * S, 32 * S, 8 * S, 12), M.graphite)
      cap.position.set(i * 145 * S, (top + 14) * S, j * 120 * S)
      g.add(cap)
    }
    const front = opposite(wallSide(f))
    const v = vec(front)
    const along = front === 'N' || front === 'S'
    const e = (along ? d : w) / 2 - 30
    for (const u of [-150, -50, 50, 150]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 14 * S, 14 * S, 10), M.chrome)
      knob.position.set((along ? u : v.x * e) * S, (top + 15) * S, (along ? v.z * e : u) * S)
      g.add(knob)
    }
    place(g, cx, cy)
    return g
  }

  // ---- the L's chaise: the diwan's seat carried round the corner - a
  // fabric base, a seat cushion, two back cushions on the wall side, an arm
  // on the side the label names, open on the other
  if (f.kind === 'sofa' && /^chaise/i.test(label)) {
    const ring = poly ?? localRect
    const back = wallSide(f)
    const bv = vec(back)
    const armSaid = /arm on the (north|south|east|west)/i.exec(label)
    const arm: Side = armSaid ? (armSaid[1][0].toUpperCase() as Side) : (back === 'N' || back === 'S' ? 'E' : 'N')
    const av = vec(arm)
    const BACK = 250, ARM = 180, SEAT = 420
    g.add(basePrism(ring, 0, 90, M.trunk))
    g.add(basePrism(ring, 90, SEAT, M.fabric))
    // the seat cushion: the footprint less the back and the arm, inset 20
    const sw = w - (bv.x ? BACK : 0) - (av.x ? ARM : 0) - 40
    const sd = d - (bv.z ? BACK : 0) - (av.z ? ARM : 0) - 40
    const scx = -bv.x * BACK / 2 - av.x * ARM / 2, scz = -bv.z * BACK / 2 - av.z * ARM / 2
    g.add(box(sw, 130, sd, M.duvet, scx, SEAT + 65, scz))
    // the arm, full length, and the back cushions along the wall side
    g.add(box(av.x ? ARM : w - 10, 620, av.z ? ARM : d - 10, M.fabric, av.x * (w - ARM) / 2, 310, av.z * (d - ARM) / 2))
    const backLen = (bv.x ? d : w) - (av.x || av.z ? ARM : 0) - 40
    for (const e of [-0.5, 0.5]) {
      const t = e * backLen / 2 - (bv.x ? av.z : av.x) * ARM / 2
      const c = box(bv.x ? BACK - 40 : backLen / 2 - 30, 340, bv.x ? backLen / 2 - 30 : BACK - 40, M.pillow,
        bv.x ? bv.x * (w / 2 - BACK / 2 - 10) : t, SEAT + 130 + 170, bv.z ? bv.z * (d / 2 - BACK / 2 - 10) : t)
      c.rotation[bv.x ? 'z' : 'x'] = (bv.x ? bv.x : -bv.z) * 0.16
      g.add(c)
    }
    place(g, cx, cy)
    return g
  }
  if (f.kind === 'console' && /^console cabinet/i.test(label)) {
    const top = Math.min(f.height, 800)
    const back = wallSide(f)
    const front = opposite(back)
    const fv = vec(front)
    const along = front === 'N' || front === 'S'         // the front runs along x
    const run = along ? w : d                              // the front's length
    const depth = along ? d : w
    g.add(box(along ? w - 60 : depth - 60, 90, along ? depth - 60 : w - 60, M.trunk, -fv.x * 30, 45, -fv.z * 30))
    g.add(box(along ? w : depth - 20, top - 90 - 20, along ? depth - 20 : w, M.walnut, -fv.x * 10, 90 + (top - 110) / 2, -fv.z * 10))
    g.add(box(along ? w + 10 : depth, 20, along ? depth : w + 10, M.marble, 0, top - 10, 0))
    // the front: a drawer across the top, two doors under, all with slim brass pulls
    const face = depth / 2 - 4
    const putFront = (u: number, h: number, lw: number, lh: number) => {
      g.add(box(along ? lw : 10, lh, along ? 10 : lw, M.walnut, along ? u : fv.x * face, h, along ? fv.z * face : u))
    }
    putFront(0, top - 110, run - 24, 150)
    for (const e of [-1, 1]) putFront(e * (run / 4), 90 + (top - 290) / 2, run / 2 - 20, top - 290)
    for (const [u, h] of [[0, top - 110], [-run / 4 + run / 8, 460], [run / 4 - run / 8, 460]] as const) {
      g.add(box(along ? 120 : 8, 8, along ? 8 : 120, M.brass, along ? u : fv.x * (face + 8), h, along ? fv.z * (face + 8) : u))
    }
    // things on it: a tall vase with dry stems, a stack of books, a bowl, a small figure
    const t0 = top
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(55 * S, 40 * S, 300 * S, 16), M.pot)
    vase.position.set((along ? -run / 2 + 170 : -fv.x * 40) * S, (t0 + 150) * S, (along ? -fv.z * 40 : -run / 2 + 170) * S)
    g.add(vase)
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(3 * S, 4 * S, 420 * S, 5), M.trunk)
      stem.position.copy(vase.position)
      stem.position.y += (150 + 190) * S
      stem.rotation.set((i % 2 ? 0.16 : -0.12) * (i % 3 ? 1 : -1), i * 1.3, 0.14 * ((i % 2) - 0.5) * 2)
      g.add(stem)
    }
    for (const [k, col] of [M.fabricDark, M.trunk, M.fabric].entries()) {
      g.add(box(along ? 220 - k * 16 : 160 - k * 10, 26, along ? 160 - k * 10 : 220 - k * 16, col, along ? 40 : -fv.x * 20, t0 + 13 + k * 26, along ? -fv.z * 20 : 40))
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(95 * S, 60 * S, 60 * S, 18, 1, true), M.porcelain)
    bowl.position.set((along ? run / 2 - 170 : fv.x * 60) * S, (t0 + 30) * S, (along ? fv.z * 60 : run / 2 - 170) * S)
    g.add(bowl)
    const fig = new THREE.Mesh(new THREE.SphereGeometry(48 * S, 12, 10), M.stone)
    fig.position.set((along ? run / 2 - 330 : -fv.x * 90) * S, (t0 + 110) * S, (along ? -fv.z * 90 : run / 2 - 330) * S)
    g.add(fig)
    const figBase = new THREE.Mesh(new THREE.CylinderGeometry(22 * S, 30 * S, 70 * S, 10), M.stone)
    figBase.position.set(fig.position.x, (t0 + 35) * S, fig.position.z)
    g.add(figBase)
    place(g, cx, cy)
    return g
  }

  // ---- the timber arch's legs over the daybed: a fin at the west end, a
  // column of four lit shelves at the east end. Both stand on the seat, above
  // the mattress; the soffit and coves that join them are in homeLamps.ts.
  if (f.kind === 'screen' && /^arch fin/i.test(label)) {
    const base = 520, top = Math.min(f.height, getModel().data.levels.ceiling)
    g.add(box(w - 2, top - base, d - 2, M.teak, 0, (base + top) / 2, 0))
    place(g, cx, cy)
    return g
  }
  if (f.kind === 'shelves' && /^arch shelves/i.test(label)) {
    const base = 520, top = Math.min(f.height, 2600)
    const back = wallSide(f)                       // the wall the column backs on
    const bv = vec(back)
    const along = back === 'N' || back === 'S'   // the shelves face across the piece's short axis
    const T = 24
    // back panel on the wall, the two side cheeks, a top
    g.add(box(along ? w : T, top - base, along ? T : d, M.teak, bv.x * ((w - T) / 2), (base + top) / 2, bv.z * ((d - T) / 2)))
    for (const e of [-1, 1]) g.add(box(along ? T : w, top - base, along ? d : T, M.teak, along ? e * (w - T) / 2 : 0, (base + top) / 2, along ? 0 : e * (d - T) / 2))
    g.add(box(w, T, d, M.teak, 0, top - T / 2, 0))
    const boards = [base + 380, base + 830, base + 1280, base + 1730]
    const led = new THREE.MeshStandardMaterial({ color: 0xfff1d8, emissive: 0xffc98a, emissiveIntensity: 1.2, roughness: 0.6 })
    const front = opposite(back)
    const fv = vec(front)
    for (const [i, h] of boards.entries()) {
      g.add(box(w - 2 * T, T, d - 2 * T, M.teak, 0, h, 0))
      // a light strip under the board's front edge, throwing down on the shelf below
      g.add(box(along ? w - 2 * T - 40 : 8, 5, along ? 8 : d - 2 * T - 40, led, fv.x * (w / 2 - T - 24), h - T / 2 - 3, fv.z * (d / 2 - T - 24)))
      const light = new THREE.PointLight(0xffd6a6, 0.28, 1.4, 1.8)
      light.position.set(fv.x * (w / 2 - T - 40) * S, (h - 40) * S, fv.z * (d / 2 - T - 40) * S)
      g.add(light)
      // what stands on each shelf, 30 above the board so nothing z-fights
      const s0 = h + T / 2
      if (i === 0) {
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(52 * S, 38 * S, 250 * S, 14), M.pot)
        vase.position.set(-60 * S, (s0 + 125) * S, 20 * S)
        g.add(vase)
        const sprig = new THREE.Mesh(new THREE.SphereGeometry(70 * S, 8, 6), M.leafDark)
        sprig.scale.set(1, 0.7, 1); sprig.position.set(-60 * S, (s0 + 280) * S, 20 * S)
        g.add(sprig)
        g.add(box(120, 34, 90, M.walnut, 80, s0 + 17, -30))
      } else if (i === 1) {
        for (const [k, col] of [M.fabricDark, M.fabric, M.trunk].entries()) g.add(box(150 - k * 12, 26, 210 - k * 20, col, -40, s0 + 13 + k * 26, 10))
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(60 * S, 40 * S, 50 * S, 14, 1, true), M.brass)
        bowl.position.set(95 * S, (s0 + 25) * S, -30 * S)
        g.add(bowl)
      } else if (i === 2) {
        const fig = new THREE.Mesh(new THREE.CylinderGeometry(24 * S, 34 * S, 150 * S, 10), M.brass)
        fig.position.set(60 * S, (s0 + 75) * S, 0)
        g.add(fig)
        const head = new THREE.Mesh(new THREE.SphereGeometry(30 * S, 10, 8), M.brass)
        head.position.set(60 * S, (s0 + 175) * S, 0)
        g.add(head)
        const frame = box(110, 140, 12, M.walnut, -70, s0 + 70, -20)
        frame.rotation.y = 0.35
        g.add(frame)
      } else {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(30 * S, 30 * S, 110 * S, 12), M.porcelain)
        candle.position.set(-70 * S, (s0 + 55) * S, 30 * S)
        g.add(candle)
        const box2 = box(140, 70, 100, M.fabricDark, 60, s0 + 35, -20)
        g.add(box2)
      }
    }
    place(g, cx, cy)
    return g
  }

  // ---- the serving counter: one stone slab through the hatch, a base under it
  // in the kitchen and a pedestal at its far end in the living room
  if (f.kind === 'table' && /serving counter/i.test(label)) {
    const ring = poly ?? localRect
    const top = Math.min(f.height, 900)
    g.add(basePrism(ring, top - 40, top, M.marble))
    // the kitchen side: the first 600 of the slab, a cabinet under it
    const ws = wallSide(f)   // the wall the slab passes through is nearest the... slab's middle; use the short end that is
    void ws
    // the kitchen-side base: from the north end down to the wall's north face
    g.add(box(w - 40, top - 40 - 100, 560, M.wallWood, 0, 100 + (top - 140) / 2, -d / 2 + 300))
    g.add(box(w - 60, 100, 540, M.graphite, 0, 50, -d / 2 + 300))
    // the living side: a pedestal at the far end and a slim leg midway
    g.add(box(w - 200, top - 40, 260, M.wallWood, 0, (top - 40) / 2, d / 2 - 150))
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(150 * S, 100 * S, 70 * S, 20, 1, true), M.porcelain)
    bowl.position.set(0, (top + 35) * S, (d / 2 - 480) * S)
    g.add(bowl)
    for (let i = 0; i < 5; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(38 * S, 10, 8), i % 2 ? M.leaf : M.brass)
      fruit.position.set(((i % 3) - 1) * 55 * S, (top + 60 + (i > 2 ? 40 : 0)) * S, (d / 2 - 480 + (i > 2 ? -30 : 30 * ((i % 2) - 0.5))) * S)
      g.add(fruit)
    }
    place(g, cx, cy)
    return g
  }

  // ---- an ottoman: upholstered, the drawn rounded outline, a buttoned top
  if (f.kind === 'stool' && /ottoman|pouffe/i.test(label)) {
    const H = f.height || 420
    const ring = poly ?? localRect
    g.add(basePrism(ring, 0, H - 40, M.fabricDark))
    g.add(basePrism(ring.map((q) => ({ x: cx + (q.x - cx) * 0.94, y: cy + (q.y - cy) * 0.94 })), H - 40, H, M.fabric))
    for (const [px, pz] of [[-w * 0.22, 0], [w * 0.22, 0]] as const) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(16 * S, 8, 6), M.fabricDark)
      btn.position.set(px * S, H * S, pz * S)
      g.add(btn)
    }
    place(g, cx, cy)
    return g
  }

  // ---- daybeds: the built seat, its mattress, the diwan and its bolster
  if (f.kind === 'daybed') {
    const ring = poly ?? localRect
    if (/mattress/i.test(label)) {
      const top = Math.min(f.height, 520)
      g.add(basePrism(ring, top - 70, top, M.duvet))
      // three cushions along the wall side
      const ws = wallSide(f)
      const v = vec(ws)
      const along = ws === 'N' || ws === 'S'
      const L = along ? w : d
      const n = Math.max(2, Math.round(L / 600))
      for (let i = 0; i < n; i++) {
        const t = -L / 2 + (i + 0.5) * (L / n)
        const c = box(along ? L / n - 80 : 150, 320, along ? 150 : L / n - 80, M.pillow,
          along ? t : v.x * ((w - 150) / 2 - 40), top + 160, along ? v.z * ((d - 150) / 2 - 40) : t)
        c.rotation[along ? 'x' : 'z'] = (along ? -v.z : v.x) * 0.18
        g.add(c)
      }
      place(g, cx, cy)
      return g
    }
    if (/bolster/i.test(label)) {
      const base = 450
      const top = Math.min(f.height, base + 260)
      const along = w >= d
      const r = Math.min(w, d) / 2 - 6
      const bol = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, ((along ? w : d) - 20) * S, 16), M.fabricDark)
      bol.rotation[along ? 'z' : 'x'] = Math.PI / 2
      bol.position.y = (base + r) * S
      g.add(bol)
      void top
      place(g, cx, cy)
      return g
    }
    // the seat itself: a timber plinth, a fabric squab on top; the diwan gets its
    // mattress here since none is drawn for it
    const H = Math.min(f.height, 460)
    g.add(basePrism(ring, 0, H - 90, M.wallWood))
    g.add(basePrism(ring, H - 90, H, M.fabric))
    g.add(box(w >= d ? 420 : w - 120, 50, w >= d ? d - 120 : 420, M.throw, w >= d ? w / 2 - 300 : 0, H + 25, w >= d ? 0 : d / 2 - 300))
    if (/diwan/i.test(label)) {
      // a row of loose cushions against the wall it backs onto
      const ws = wallSide(f)
      const v = vec(ws)
      const along = ws === 'N' || ws === 'S'
      const L = along ? w : d
      const n = 3
      for (let i = 0; i < n; i++) {
        const t = -L / 2 + (i + 0.5) * (L / n)
        const c = box(along ? L / n - 90 : 140, 380, along ? 140 : L / n - 90, i % 2 ? M.pillow : M.throw,
          along ? t : v.x * ((w - 140) / 2 - 240), H + 190, along ? v.z * ((d - 140) / 2 - 240) : t)
        c.rotation[along ? 'x' : 'z'] = (along ? -v.z : v.x) * 0.2
        g.add(c)
      }
    }
    place(g, cx, cy)
    return g
  }

  // ---- a dressing console: a bowed cabinet, a stone top, a round mirror over it
  if (f.kind === 'console' && /dressing console/i.test(label)) {
    const ring = poly ?? localRect
    const top = Math.min(f.height, 780)
    g.add(basePrism(ring, 0, top - 30, M.walnut))
    g.add(basePrism(ring, top - 30, top, M.marble))
    const ws = wallSide(f)
    const v = vec(ws)
    const along = ws === 'N' || ws === 'S'
    const off = (along ? d : w) / 2 - 16
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(300 * S, 300 * S, 12 * S, 32), M.mirror)
    mirror.rotation[along ? 'x' : 'z'] = Math.PI / 2
    mirror.position.set(v.x * off * S, 1450 * S, v.z * off * S)
    g.add(mirror)
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(322 * S, 322 * S, 10 * S, 32), M.brass)
    frame.rotation[along ? 'x' : 'z'] = Math.PI / 2
    frame.position.set(v.x * (off + 2) * S, 1450 * S, v.z * (off + 2) * S)
    g.add(frame)
    g.add(box(along ? 260 : 160, 14, along ? 160 : 260, M.brass, -w * 0.2, top + 7, v.z * 40))
    for (const [ox, hh, rr] of [[-w * 0.26, 120, 22], [-w * 0.15, 90, 30]] as const) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(rr * S, rr * S, hh * S, 12), M.acrylic)
      bottle.position.set(ox * S, (top + 14 + hh / 2) * S, v.z * 40 * S)
      g.add(bottle)
    }
    place(g, cx, cy)
    return g
  }
  // ---- a shallow console against a wall: an open shelf unit
  if (f.kind === 'console' && /^console —/i.test(label) && poly) {
    const H = Math.min(f.height, 850)
    g.add(basePrism(poly, 0, 40, M.walnut))
    g.add(basePrism(poly, H - 40, H, M.walnut))
    g.add(basePrism(poly.map((q) => ({ x: cx + (q.x - cx) * 0.96, y: cy + (q.y - cy) * 0.6 })), 40, H - 40, M.wallWood))
    place(g, cx, cy)
    return g
  }

  return null
}
