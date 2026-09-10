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
}

export type LampSpot =
  | { kind: 'constellation'; x: number; y: number; spread: number; n: number }
  | { kind: 'pendant'; x: number; y: number; h: number; r?: number }
  | { kind: 'bar'; x: number; y: number; h: number; len: number; alongX: boolean }
  | { kind: 'sconce'; x: number; y: number; h: number; nx: number; ny: number }
  | { kind: 'floor'; x: number; y: number }
  | { kind: 'lantern'; x: number; y: number; h: number; nx: number; ny: number }
  | { kind: 'desk'; x: number; y: number; top: number }
  | { kind: 'headboard'; x: number; y: number; nx: number; ny: number; w: number; h0: number; h1: number }

export const LAMP_SPOTS: Record<string, LampSpot[]> = {
  ekta: [
    // the living room's piece: a constellation of nine frosted globes hung at
    // staggered heights from one walnut disc, over the rug between the diwan
    // and the recliner - the room's middle, which the swivels and the bar
    // both look toward
    { kind: 'constellation', x: 4500, y: 7300, spread: 1300, n: 9 },
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
