/**
 * THE LAMPS AND THE DECOR A HOME CARRIES BEYOND ITS FURNITURE.
 *
 * Home 1 has its set pieces written into Realistic.tsx at its own plan
 * coordinates - the petal pendant, the entry sconces, the idol. This is the
 * same idea for any other home, as a table: each entry names a kind and a
 * place in plan mm, and the builders below make the thing. Nothing here has
 * a drawn footprint, so nothing here goes through the fidelity gate; these are
 * lamps on the ceiling and walls and the small things on surfaces.
 */

import * as THREE from 'three'
import { S } from './prism'

type Mat = THREE.Material
export interface LampKit {
  M: Record<string, Mat>
  ceiling: number
  box: (w: number, h: number, d: number, mat: Mat, x?: number, y?: number, z?: number) => THREE.Mesh
  sconce: (withLight?: boolean) => THREE.Group
  /** a lit paper flower: n petals of L x W, drooping by `droop` radians, spun by `spin` */
  flower: (n: number, L: number, W: number, droop: number, spin: number) => THREE.Group
  /** one lit paper leaf of L x W, base at the origin, pointing +y, veins fanning from the base */
  leaf: (L: number, W: number) => THREE.Mesh
}

export type LampSpot =
  | { kind: 'constellation'; x: number; y: number; spread: number; n: number }
  /** a leaf chandelier: one dark branch swooping under the ceiling across `spread`,
   *  n lit paper leaves hanging off it on twigs at staggered heights, a few buds */
  | { kind: 'leaves'; x: number; y: number; spread: number; n: number; along: number }
  | { kind: 'pendant'; x: number; y: number; h: number; r?: number }
  | { kind: 'bar'; x: number; y: number; h: number; len: number; alongX: boolean }
  | { kind: 'sconce'; x: number; y: number; h: number; nx: number; ny: number }
  | { kind: 'floor'; x: number; y: number }
  | { kind: 'lantern'; x: number; y: number; h: number; nx: number; ny: number }
  | { kind: 'desk'; x: number; y: number; top: number }
  | { kind: 'headboard'; x: number; y: number; nx: number; ny: number; w: number; h0: number; h1: number }
  /** a teak arch framing a window from inside: a soffit along the ceiling between x0 and x1
   *  (the inner faces of its two legs, which are drawn pieces), coves of radius r at the
   *  corners, and a flower pendant hung from the soffit */
  | { kind: 'arch'; x0: number; x1: number; y0: number; y1: number; r: number; pendant: { x: number; y: number; h: number } }
  /** a run of teak overhead cabinets on a wall face: from (x, y) along (ux, uy) for len,
   *  standing `depth` off the face into the room along (nx, ny), from h0 to h1 */
  | { kind: 'loft'; x: number; y: number; ux: number; uy: number; nx: number; ny: number; len: number; h0: number; h1: number; depth: number }

export const LAMP_SPOTS: Record<string, LampSpot[]> = {
  ekta: [
    // the living room's piece: a leaf chandelier - one dark branch swooping
    // under the ceiling over the rug between the diwan and the recliner, with
    // fourteen lit paper leaves hanging off it at staggered heights, the way
    // Home 1's great room has its flower and buds. It runs north-south, the
    // long way of the room, over the middle the swivels and the bar look toward
    { kind: 'leaves', x: 4500, y: 7300, spread: 2600, n: 14, along: Math.PI / 2 },
    // the foyer: one brass drum inside the door
    { kind: 'pendant', x: 1380, y: 10300, h: 2100, r: 140 },
    // the kitchen: a linear brass bar over the worktop's north run
    { kind: 'bar', x: 6100, y: 920, h: 1950, len: 1400, alongX: true },
    // the living room's west wall: a sconce either side of the canvas over the diwan
    { kind: 'sconce', x: 2295, y: 6850, h: 1750, nx: 1, ny: 0 },
    { kind: 'sconce', x: 2295, y: 8350, h: 1750, nx: 1, ny: 0 },
    // a floor lamp at the diwan's south end
    { kind: 'floor', x: 3400, y: 8850 },
    // the east room: a pendant at each side of the bed's head, and a teak
    // panel behind it
    { kind: 'pendant', x: 11150, y: 560, h: 1450, r: 90 },
    { kind: 'pendant', x: 11150, y: 2870, h: 1450, r: 90 },
    { kind: 'headboard', x: 11470, y: 1715, nx: -1, ny: 0, w: 2500, h0: 250, h1: 1500 },
    // the bedroom desk
    { kind: 'desk', x: 2900, y: 250, top: 750 },
    // the balcony: a lantern on its west wall
    { kind: 'lantern', x: 3800, y: 11700, h: 1800, nx: 1, ny: 0 },
    // the east room: the teak arch over the daybed - the fin and the shelf
    // column are on the plan (arch fin, arch shelves); this is the soffit, the
    // two coves and the flower pendant over the middle of the seat
    { kind: 'arch', x0: 9490, x1: 11120, y0: 8005, y1: 8355, r: 500, pendant: { x: 10305, y: 8180, h: 2050 } },
    // the kitchen's lofts: teak overheads from 2450 to 3000 on the west leg,
    // the north wall and the east leg (the corners left to the curves), and a
    // wall cabinet on the 800 pier between the two north windows
    { kind: 'loft', x: 4610, y: 2500, ux: 0, uy: -1, nx: 1, ny: 0, len: 1530, h0: 2450, h1: 3000, depth: 350 },
    { kind: 'loft', x: 4610, y: 620, ux: 1, uy: 0, nx: 0, ny: 1, len: 3685, h0: 2450, h1: 3000, depth: 350 },
    { kind: 'loft', x: 8295, y: 970, ux: 0, uy: 1, nx: -1, ny: 0, len: 1530, h0: 2450, h1: 3000, depth: 350 },
    { kind: 'loft', x: 6435, y: 620, ux: 1, uy: 0, nx: 0, ny: 1, len: 800, h0: 1500, h1: 2440, depth: 350 },
  ],
}

export function homeLamps(homeId: string, k: LampKit): THREE.Group {
  const g = new THREE.Group()
  const { M, ceiling, box } = k
  const frosted = new THREE.MeshStandardMaterial({
    color: 0xfff4e4, emissive: 0xffc98a, emissiveIntensity: 0.55, roughness: 0.6,
    transparent: true, opacity: 0.92,
  })
  const shade = new THREE.MeshStandardMaterial({
    color: 0xf6ecd8, emissive: 0xffb860, emissiveIntensity: 0.5, roughness: 0.7, side: THREE.DoubleSide,
  })
  const cord = (x: number, y: number, top: number, bottom: number): void => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(2.5 * S, 2.5 * S, (top - bottom) * S, 6), M.graphite)
    c.position.set(x * S, ((top + bottom) / 2) * S, y * S)
    g.add(c)
  }
  for (const sp of LAMP_SPOTS[homeId] ?? []) {
    if (sp.kind === 'constellation') {
      // one walnut disc on the ceiling; the globes fall from it at nine
      // heights on a loose spiral, each with its own warm light
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(260 * S, 260 * S, 30 * S, 32), M.walnut)
      disc.position.set(sp.x * S, (ceiling - 15) * S, sp.y * S)
      g.add(disc)
      for (let i = 0; i < sp.n; i++) {
        const a = i * 2.399 + 0.4                         // the golden angle: no two globes line up
        const rr = (sp.spread / 2) * Math.sqrt((i + 0.5) / sp.n)
        const px = sp.x + rr * Math.cos(a), py = sp.y + rr * Math.sin(a)
        const h = 1850 + ((i * 7) % sp.n) * (700 / sp.n)
        const r = 70 + ((i * 5) % 3) * 25
        cord(px, py, ceiling - 30, h + r)
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 26 * S, 30 * S, 12), M.brass)
        cup.position.set(px * S, (h + r + 10) * S, py * S)
        g.add(cup)
        const globe = new THREE.Mesh(new THREE.SphereGeometry(r * S, 20, 14), frosted)
        globe.position.set(px * S, h * S, py * S)
        g.add(globe)
        if (i % 2 === 0) {
          const light = new THREE.PointLight(0xffd2a0, 0.45, 3.4, 1.8)
          light.position.set(px * S, (h - 20) * S, py * S)
          g.add(light)
        }
      }
      continue
    }
    if (sp.kind === 'leaves') {
      const vine = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.85 })
      const dx = Math.cos(sp.along), dy = Math.sin(sp.along)          // the branch's run in plan
      const sx = -dy, sy = dx                                          // and the side it wanders to
      const half = sp.spread / 2
      // the branch: anchored at both ends and the middle, swinging side to side
      // and dipping between the anchors
      const P = (t: number, side: number, drop: number) => new THREE.Vector3(
        (sp.x + dx * t * half + sx * side) * S, (ceiling - drop) * S, (sp.y + dy * t * half + sy * side) * S)
      const curve = new THREE.CatmullRomCurve3([
        P(-1, 120, 30), P(-0.7, -160, 380), P(-0.35, 200, 520), P(0, -60, 300),
        P(0.35, 220, 560), P(0.7, -180, 400), P(1, 80, 30),
      ])
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 15 * S, 8, false), vine))
      for (const t of [-1, 0, 1]) {
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(t === 0 ? 170 * S : 55 * S, t === 0 ? 170 * S : 55 * S, 22 * S, 20), t === 0 ? M.walnut : vine)
        rose.position.set((sp.x + dx * t * half) * S, (ceiling - 11) * S, (sp.y + dy * t * half) * S)
        g.add(rose)
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(8 * S, 8 * S, 300 * S, 6), vine)
      stem.position.set(sp.x * S, (ceiling - 160) * S, sp.y * S)
      g.add(stem)
      // the leaves: a twig drops from the branch, a leaf hangs from its end,
      // pointing down and out, spun round so no two face the same way
      for (let i = 0; i < sp.n; i++) {
        const t = -0.92 + (i + 0.5) * (1.84 / sp.n)
        const u = (t + 1) / 2
        const at = curve.getPointAt(u)
        const twig = 90 + ((i * 7) % 5) * 55                          // 90..310
        const L = 380 + ((i * 5) % 4) * 55                            // 380..545
        const W = L * 0.42
        const a = i * 2.399 + 0.6                                     // the golden angle: every leaf its own way
        const tw = new THREE.Mesh(new THREE.CylinderGeometry(4 * S, 6 * S, twig * S, 6), vine)
        tw.position.set(at.x, at.y - (twig / 2) * S, at.z)
        g.add(tw)
        const leaf = k.leaf(L, W)
        leaf.position.set(at.x, at.y - twig * S, at.z)
        leaf.rotation.set(Math.PI - 0.55 - ((i * 3) % 4) * 0.1, a, 0, 'YXZ')
        g.add(leaf)
        if (i % 3 === 1) {
          const light = new THREE.PointLight(0xffc98a, 0.5, 3.6, 1.8)
          light.position.set(at.x, at.y - (twig + L * 0.45) * S, at.z)
          g.add(light)
        }
      }
      // three buds trailing on cords between the leaves
      for (const [t, len] of [[-0.55, 950], [0.15, 1150], [0.8, 850]] as const) {
        const at = curve.getPointAt((t + 1) / 2)
        cord(at.x / S, at.z / S, at.y / S, ceiling - len)
        const bud = k.leaf(150, 90)
        bud.position.set(at.x, (ceiling - len) * S, at.z)
        bud.rotation.set(Math.PI - 0.15, t * 3, 0, 'YXZ')
        g.add(bud)
      }
      continue
    }
    if (sp.kind === 'pendant') {
      const r = sp.r ?? 120
      cord(sp.x, sp.y, ceiling - 10, sp.h + r * 0.9)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * 1.15 * S, r * 1.6 * S, 28, 1, true), M.brass)
      drum.position.set(sp.x * S, sp.h * S, sp.y * S)
      drum.castShadow = true
      g.add(drum)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28 * S, 12, 10), frosted)
      bulb.position.set(sp.x * S, (sp.h - r * 0.4) * S, sp.y * S)
      g.add(bulb)
      const light = new THREE.PointLight(0xffd2a0, 0.6, 3.2, 1.8)
      light.position.set(sp.x * S, (sp.h - r * 0.7) * S, sp.y * S)
      g.add(light)
      continue
    }
    if (sp.kind === 'bar') {
      for (const e of [-0.35, 0.35]) cord(sp.x + (sp.alongX ? e * sp.len : 0), sp.y + (sp.alongX ? 0 : e * sp.len), ceiling - 10, sp.h + 30)
      const body = box(sp.alongX ? sp.len : 60, 60, sp.alongX ? 60 : sp.len, M.brass, 0, 0, 0)
      body.position.set(sp.x * S, sp.h * S, sp.y * S)
      g.add(body)
      const glow = box(sp.alongX ? sp.len - 60 : 30, 6, sp.alongX ? 30 : sp.len - 60, frosted, 0, 0, 0)
      glow.position.set(sp.x * S, (sp.h - 32) * S, sp.y * S)
      g.add(glow)
      for (const e of [-0.3, 0.3]) {
        const light = new THREE.PointLight(0xffe0b8, 0.5, 2.6, 1.8)
        light.position.set((sp.x + (sp.alongX ? e * sp.len : 0)) * S, (sp.h - 80) * S, (sp.y + (sp.alongX ? 0 : e * sp.len)) * S)
        g.add(light)
      }
      continue
    }
    if (sp.kind === 'sconce') {
      const lamp = k.sconce(true)
      lamp.position.set((sp.x + sp.nx * 8) * S, sp.h * S, (sp.y + sp.ny * 8) * S)
      lamp.rotation.y = Math.atan2(sp.nx, sp.ny)
      g.add(lamp)
      continue
    }
    if (sp.kind === 'floor') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(140 * S, 150 * S, 20 * S, 24), M.brass)
      base.position.set(sp.x * S, 10 * S, sp.y * S)
      g.add(base)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(10 * S, 12 * S, 1400 * S, 10), M.brass)
      stem.position.set(sp.x * S, 720 * S, sp.y * S)
      g.add(stem)
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(150 * S, 200 * S, 260 * S, 24, 1, true), shade)
      sh.position.set(sp.x * S, 1530 * S, sp.y * S)
      g.add(sh)
      const light = new THREE.PointLight(0xffd9a3, 0.55, 3.0, 1.8)
      light.position.set(sp.x * S, 1480 * S, sp.y * S)
      g.add(light)
      continue
    }
    if (sp.kind === 'lantern') {
      const yaw = Math.atan2(sp.nx, sp.ny)
      const put = (m: THREE.Object3D, out: number, h: number) => {
        m.position.set((sp.x + sp.nx * out) * S, h * S, (sp.y + sp.ny * out) * S)
        m.rotation.y = yaw
        g.add(m)
      }
      put(box(120, 160, 14, M.graphite, 0, 0, 0), 8, sp.h)
      put(box(90, 200, 90, frosted, 0, 0, 0), 80, sp.h)
      put(box(110, 14, 110, M.graphite, 0, 0, 0), 80, sp.h + 108)
      put(box(110, 14, 110, M.graphite, 0, 0, 0), 80, sp.h - 108)
      const light = new THREE.PointLight(0xffd0a0, 0.5, 3.0, 1.8)
      light.position.set((sp.x + sp.nx * 120) * S, (sp.h - 30) * S, (sp.y + sp.ny * 120) * S)
      g.add(light)
      continue
    }
    if (sp.kind === 'desk') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(70 * S, 80 * S, 14 * S, 20), M.brass)
      base.position.set(sp.x * S, (sp.top + 7) * S, sp.y * S)
      g.add(base)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(6 * S, 7 * S, 380 * S, 8), M.brass)
      stem.position.set(sp.x * S, (sp.top + 200) * S, sp.y * S)
      g.add(stem)
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(80 * S, 120 * S, 150 * S, 20, 1, true), shade)
      sh.position.set(sp.x * S, (sp.top + 420) * S, sp.y * S)
      g.add(sh)
      const light = new THREE.PointLight(0xffd9a3, 0.35, 2.0, 1.8)
      light.position.set(sp.x * S, (sp.top + 380) * S, sp.y * S)
      g.add(light)
      continue
    }
    if (sp.kind === 'arch') {
      const top = ceiling - 60                                   // the soffit's underside
      const depth = sp.y1 - sp.y0
      const cz = (sp.y0 + sp.y1) / 2
      const soffit = box(sp.x1 - sp.x0 + 80, 60, depth, M.teak, 0, 0, 0)
      soffit.position.set(((sp.x0 + sp.x1) / 2) * S, (top + 30) * S, cz * S)
      g.add(soffit)
      // the coves: the square corner between a leg and the soffit, less a quarter circle
      const cove = (x: number, dir: 1 | -1): THREE.Mesh => {
        const sh = new THREE.Shape()
        sh.moveTo(x, top)
        sh.lineTo(x + dir * sp.r, top)
        sh.absarc(x + dir * sp.r, top - sp.r, sp.r, Math.PI / 2, dir > 0 ? Math.PI : 0, dir > 0)
        sh.lineTo(x, top)
        const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 24 })
        geo.scale(S, S, S)
        const m = new THREE.Mesh(geo, M.teak)
        m.position.z = sp.y0 * S
        return m
      }
      g.add(cove(sp.x0, 1))
      g.add(cove(sp.x1, -1))
      // the pendant: a cord from the soffit, one bloom over the seat
      cord(sp.pendant.x, sp.pendant.y, top, sp.pendant.h + 40)
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(40 * S, 40 * S, 16 * S, 14), M.brass)
      rose.position.set(sp.pendant.x * S, (top - 8) * S, sp.pendant.y * S)
      g.add(rose)
      const bloom = k.flower(7, 420, 220, 0.9, 0.25)
      bloom.position.set(sp.pendant.x * S, sp.pendant.h * S, sp.pendant.y * S)
      g.add(bloom)
      continue
    }
    if (sp.kind === 'loft') {
      // one carcass, door slabs on the face at 450 centres with a brass bar
      // low on each, a shadow gap under the top
      const yaw = -Math.atan2(sp.uy, sp.ux)
      const H = sp.h1 - sp.h0
      const at = (u: number, out: number, h: number, m: THREE.Object3D) => {
        m.position.set((sp.x + sp.ux * u + sp.nx * out) * S, h * S, (sp.y + sp.uy * u + sp.ny * out) * S)
        m.rotation.y = yaw
        g.add(m)
      }
      at(sp.len / 2, sp.depth / 2 - 10, sp.h0 + H / 2, box(sp.len, H, sp.depth - 20, M.teak, 0, 0, 0))
      const nDoors = Math.max(1, Math.round(sp.len / 450))
      const leaf = sp.len / nDoors
      for (let i = 0; i < nDoors; i++) {
        const c = (i + 0.5) * leaf
        at(c, sp.depth - 9, sp.h0 + 12 + (H - 24) / 2, box(leaf - 4, H - 24, 18, M.teak, 0, 0, 0))
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(5 * S, 5 * S, 140 * S, 8), M.brass)
        bar.rotation.z = Math.PI / 2
        at(c + (i % 2 ? -1 : 1) * (leaf / 2 - 90), sp.depth + 14, sp.h0 + 70, bar)
      }
      at(sp.len / 2, sp.depth - 4, sp.h1 - 6, box(sp.len, 8, 12, M.trunk, 0, 0, 0))
      continue
    }
    if (sp.kind === 'headboard') {
      // a teak panel on the wall behind the bed, floor-clear, with a shadow
      // line at its foot: the head of the bed has a wall of its own
      const along = sp.nx !== 0
      const panel = box(along ? 24 : sp.w, sp.h1 - sp.h0, along ? sp.w : 24, M.teak, 0, 0, 0)
      panel.position.set((sp.x + sp.nx * 14) * S, ((sp.h0 + sp.h1) / 2) * S, (sp.y + sp.ny * 14) * S)
      g.add(panel)
      const ledge = box(along ? 90 : sp.w, 30, along ? sp.w : 90, M.walnut, 0, 0, 0)
      ledge.position.set((sp.x + sp.nx * 46) * S, (sp.h1 + 15) * S, (sp.y + sp.ny * 46) * S)
      g.add(ledge)
      continue
    }
  }
  return g
}
