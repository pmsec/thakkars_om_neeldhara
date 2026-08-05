/**
 * The walkthrough: the same derived model as the 3D tab, dressed in real
 * materials — oak boards, stone, grass, plaster, tinted and clear glass —
 * under a sky, with warm room lighting, seen from a first-person camera.
 *
 * Everything is generated: the textures are drawn on canvases at runtime
 * (no assets to load), the floors come from the model's room slabs and
 * carry each room's authored finish, the walls come from the same prisms
 * the technical 3D uses, and the furniture is built per kind with enough
 * shape to read as the thing it is — a bed has a duvet and pillows, a sofa
 * has arms and cushions, a tree has a crown.
 *
 * Click to walk: WASD + mouse, Shift to hurry, Esc to release the mouse.
 * Orbit with the pointer when not walking.
 */

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { getModel } from '../geometry/model'
import { buildSolids } from '../geometry/solid'
import { EXTRUDED_KINDS, renderFootprints } from '../geometry/fidelity'
import { furniture, type FurnitureItem } from '../data/furniture'
import { fixtures } from '../data/fixtures'
import { decimate, prismGeometry, S } from './prism'

const model = getModel()
const solids = buildSolids(model)

// ------------------------------------------------------------- textures
function canvasTexture(
  px: number,
  draw: (g: CanvasRenderingContext2D, size: number) => void,
  repeatMetres: number,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')!
  draw(g, px)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / repeatMetres, 1 / repeatMetres)
  t.anisotropy = 4
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function oakTexture(): THREE.CanvasTexture {
  // 1.2 m of floor per tile: six 190 mm boards with tone drift and grain.
  return canvasTexture(512, (g, s) => {
    const boards = 6
    const bw = s / boards
    for (let i = 0; i < boards; i++) {
      const tone = 202 + ((i * 37) % 5) * 7 - 12
      g.fillStyle = `rgb(${tone}, ${tone - 44}, ${tone - 94})`
      g.fillRect(i * bw, 0, bw, s)
      // grain
      for (let k = 0; k < 26; k++) {
        const x = i * bw + ((k * 61 + i * 131) % bw)
        g.strokeStyle = `rgba(96, 62, 28, ${0.05 + ((k * 7) % 10) / 90})`
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x, 0)
        g.bezierCurveTo(x + 4, s * 0.3, x - 4, s * 0.7, x + 2, s)
        g.stroke()
      }
      g.fillStyle = 'rgba(70, 45, 20, 0.55)'
      g.fillRect(i * bw, 0, 2, s)
    }
    // butt joints
    for (let i = 0; i < boards; i++) {
      for (let j = 0; j < 2; j++) {
        const y = ((i * 197 + j * 251) % s)
        g.fillStyle = 'rgba(70, 45, 20, 0.4)'
        g.fillRect(i * bw, y, bw, 2)
      }
    }
  }, 1.2)
}

function stoneTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#d9d6cb'
    g.fillRect(0, 0, s, s)
    const n = 2
    const tw = s / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const tone = 214 + ((i * 3 + j * 5) % 4) * 4
        g.fillStyle = `rgb(${tone}, ${tone - 3}, ${tone - 12})`
        g.fillRect(i * tw + 1, j * tw + 1, tw - 2, tw - 2)
        for (let k = 0; k < 60; k++) {
          const x = i * tw + ((k * 89) % tw)
          const y = j * tw + ((k * 53 + i * 31) % tw)
          g.fillStyle = `rgba(120, 116, 104, ${((k * 13) % 10) / 45})`
          g.fillRect(x, y, 2, 2)
        }
      }
    }
    g.strokeStyle = 'rgba(110, 106, 96, 0.6)'
    g.lineWidth = 3
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * tw, 0); g.lineTo(i * tw, s); g.stroke()
      g.beginPath(); g.moveTo(0, i * tw); g.lineTo(s, i * tw); g.stroke()
    }
  }, 1.2)
}

function grassTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#5e7d43'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 5200; k++) {
      const x = (k * 97) % s
      const y = (k * 61 + ((k * k) % 17)) % s
      const h = 3 + ((k * 7) % 6)
      const green = 96 + ((k * 11) % 70)
      g.strokeStyle = `rgba(${green - 60}, ${green}, ${green - 55}, 0.5)`
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (((k * 3) % 5) - 2), y - h)
      g.stroke()
    }
  }, 0.9)
}

function plasterTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#f3ecdd'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 900; k++) {
      const x = (k * 37) % s
      const y = (k * 71) % s
      g.fillStyle = `rgba(190, 180, 160, ${((k * 7) % 8) / 60})`
      g.fillRect(x, y, 2, 2)
    }
  }, 1.6)
}

function rugTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#c9b598'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 2000; k++) {
      g.fillStyle = `rgba(${140 + (k % 40)}, ${118 + (k % 30)}, ${88 + (k % 24)}, 0.35)`
      g.fillRect((k * 31) % s, (k * 87) % s, 3, 3)
    }
    g.strokeStyle = 'rgba(120, 95, 60, 0.55)'
    g.lineWidth = 6
    g.strokeRect(10, 10, s - 20, s - 20)
  }, 1.0)
}

function woodTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#8a6238'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 30; k++) {
      const y = (k * 17) % s
      g.strokeStyle = `rgba(60, 38, 16, ${0.12 + (k % 5) / 30})`
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(s * 0.3, y + 5, s * 0.7, y - 5, s, y + 2)
      g.stroke()
    }
  }, 0.8)
}

// ------------------------------------------------------------- materials
export function makeMaterials() {
  const oak = oakTexture()
  const stone = stoneTexture()
  const grass = grassTexture()
  const plaster = plasterTexture()
  const wood = woodTexture()
  const rug = rugTexture()

  return {
    oak: new THREE.MeshStandardMaterial({ map: oak, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ map: stone, roughness: 0.8, side: THREE.DoubleSide }),
    grass: new THREE.MeshStandardMaterial({ map: grass, roughness: 1.0, side: THREE.DoubleSide }),
    deckBoard: new THREE.MeshStandardMaterial({ map: oak, roughness: 0.75 }),
    plaster: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.92, side: THREE.DoubleSide }),
    wallWood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xe4f0f4, transparent: true, opacity: 0.13, roughness: 0.06,
      metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    }),
    tintGlass: new THREE.MeshPhysicalMaterial({
      color: 0xa4763c, transparent: true, opacity: 0.38, roughness: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    roofGlass: new THREE.MeshPhysicalMaterial({
      color: 0xcfe4ea, transparent: true, opacity: 0.16, roughness: 0.05,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xf0e8d6, roughness: 0.95 }),
    fabricDark: new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.95 }),
    duvet: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.98 }),
    pillow: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.96 }),
    timber: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x6e9450, roughness: 0.9 }),
    leafDark: new THREE.MeshStandardMaterial({ color: 0x577b3e, roughness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6d5334, roughness: 0.9 }),
    pot: new THREE.MeshStandardMaterial({ color: 0xb8a894, roughness: 0.7 }),
    rug: new THREE.MeshStandardMaterial({ map: rug, roughness: 1.0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x777d7c, roughness: 0.35, metalness: 0.7 }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x7fb5c4, transparent: true, opacity: 0.75, roughness: 0.08, metalness: 0.1,
    }),
    marble: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.25 }),
    appliance: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.4, metalness: 0.25 }),
  }
}
export type Mats = ReturnType<typeof makeMaterials>

// ---------------------------------------------------------- scene build
function box(
  w: number, h: number, d: number, mat: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), mat)
  m.position.set(x * S, y * S, z * S)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Model (x, y) to scene (x, +y): prismGeometry's shape negation and its
 * rotateX(-90) cancel, so scene z carries model y with its sign KEPT. */
function place(o: THREE.Object3D, cx: number, cy: number, h = 0): void {
  o.position.set(cx * S, h * S, cy * S)
}

/** Extrude a drawn outline, clipped so it can never occupy wall space, and
 * limited to the fragments that belong in the piece's own room. */
function polyPiece(
  poly: { x: number; y: number }[],
  base: number,
  top: number,
  mat: THREE.Material,
  room?: string,
): THREE.Object3D | null {
  const parts = renderFootprints(poly, room)
  if (!parts.length) return null
  const g = new THREE.Group()
  for (const fp of parts) {
    const m = new THREE.Mesh(
      prismGeometry(decimate(fp.outer), base, top, fp.holes.map((h) => decimate(h))),
      mat,
    )
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  return g
}

export function furnitureMesh(f: FurnitureItem, M: Mats): THREE.Object3D | null {
  const g = new THREE.Group()
  const w = f.w
  const d = f.d
  const cx = f.x + w / 2
  const cy = f.y + d / 2

  // A piece with its drawn 2D outline extrudes THAT — the shape on the sheet,
  // clipped at the walls — instead of a box that squares its curves back off.
  if (f.poly && EXTRUDED_KINDS.has(f.kind)) {
    const h = f.kind === 'wardrobe' || f.kind === 'shelves'
      ? f.height
      : Math.min(f.height, 900)
    const body = polyPiece(f.poly, 0, h, M.timber, f.room)
    return body
  }

  switch (f.kind) {
    case 'rug': {
      if (f.poly) {
        const m = polyPiece(f.poly, 2, 14, M.rug, f.room)
        if (m) m.traverse((o) => { o.castShadow = false })
        return m
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w * S, d * S), M.rug)
      m.rotation.x = -Math.PI / 2
      m.receiveShadow = true
      place(m, cx, cy, 14)
      return m
    }
    case 'grass': {
      // a drawn field of real grass (deck, terraces) laid over the slab
      const m = f.poly ? polyPiece(f.poly, 0, 25, M.grass, f.room)
        : box(w, 25, d, M.grass)
      if (!m) return null
      if (!f.poly) place(m, cx, cy, 12.5)
      m.traverse((o) => { o.castShadow = false })
      return m
    }
    case 'planter': {
      // the planted strip: a low bed with a run of shrubs standing in it
      const bed = f.poly ? polyPiece(f.poly, 0, 300, M.pot, f.room) : box(w, 300, d, M.pot)
      if (bed) {
        if (!f.poly) place(bed, cx, cy, 150)
        g.add(bed)
      }
      const long = Math.max(w, d)
      const n = Math.max(2, Math.round(long / 1250))
      const r = Math.min(220, Math.min(w, d) / 2 - 20)
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const sx = w >= d ? f.x + t * w : cx
        const sy = w >= d ? cy : f.y + t * d
        const s = new THREE.Mesh(new THREE.SphereGeometry(r * S, 8, 6), i % 2 ? M.leaf : M.leafDark)
        s.position.set(sx * S, (300 + r * 0.7) * S, sy * S)
        s.castShadow = true
        g.add(s)
      }
      return g
    }
    case 'sofa': {
      const seatH = 420
      const backH = f.height
      g.add(box(w, seatH, d, M.fabric, 0, seatH / 2, 0))
      // back along the far side by `face`
      const bt = 190
      const back =
        f.face === 'S' ? box(w, backH, bt, M.fabricDark, 0, backH / 2, -d / 2 + bt / 2)
        : f.face === 'N' ? box(w, backH, bt, M.fabricDark, 0, backH / 2, d / 2 - bt / 2)
        : f.face === 'E' ? box(bt, backH, d, M.fabricDark, -w / 2 + bt / 2, backH / 2, 0)
        : box(bt, backH, d, M.fabricDark, w / 2 - bt / 2, backH / 2, 0)
      g.add(back)
      // arms + cushions
      if (f.face === 'N' || f.face === 'S') {
        g.add(box(bt, seatH + 160, d, M.fabricDark, -w / 2 + bt / 2, (seatH + 160) / 2, 0))
        g.add(box(bt, seatH + 160, d, M.fabricDark, w / 2 - bt / 2, (seatH + 160) / 2, 0))
        const n = Math.max(2, Math.round(w / 800))
        for (let i = 0; i < n; i++) {
          g.add(box(w / n - 60, 110, d - 240, M.duvet,
            -w / 2 + (i + 0.5) * (w / n), seatH + 55,
            f.face === 'S' ? 40 : -40))
        }
      }
      place(g, cx, cy)
      return g
    }
    case 'lounger': {
      g.add(box(w, 380, d, M.fabric, 0, 190, 0))
      // inclined back toward the face direction — the back's long side runs
      // ACROSS the face axis (by face, not by aspect: a deep W-facing chair
      // still reclines along x)
      const ewL = f.face === 'E' || f.face === 'W'
      const backLen = (ewL ? w : d) * 0.45
      const bk = new THREE.Mesh(
        new THREE.BoxGeometry((ewL ? backLen : w * 0.9) * S, 90 * S, (ewL ? d * 0.9 : backLen) * S),
        M.fabricDark,
      )
      bk.castShadow = true
      const tilt = 0.6
      if (f.face === 'N') { bk.position.set(0, (380 + 160) * S, (d / 2 - backLen / 2) * S); bk.rotation.x = -tilt }
      else if (f.face === 'S') { bk.position.set(0, (380 + 160) * S, (-d / 2 + backLen / 2) * S); bk.rotation.x = tilt }
      else if (f.face === 'E') { bk.position.set((-w / 2 + backLen / 2) * S, (380 + 160) * S, 0); bk.rotation.z = -tilt }
      else { bk.position.set((w / 2 - backLen / 2) * S, (380 + 160) * S, 0); bk.rotation.z = tilt }
      g.add(bk)
      place(g, cx, cy)
      return g
    }
    case 'bed': {
      g.add(box(w, 260, d, M.timber, 0, 130, 0))                      // frame
      g.add(box(w - 60, 210, d - 60, M.duvet, 0, 260 + 105, 0))      // mattress+duvet
      // pillows at the head (by face: the head is where the bed FACES from).
      // The head axis follows the face — E/W heads run along x, N/S along y —
      // and a cabinet too shallow for pillows (the folded murphy) gets none,
      // exactly as the 2D draws the folded-down bed dashed, i.e. not there.
      const ph = 260 + 210 + 70
      const ew = f.face === 'E' || f.face === 'W'
      const pw = Math.min(560, (ew ? d : w) / 2 - 80)
      const off = (ew ? w : d) / 2 - 260
      if (off > 80 && pw > 80) {
        const pos: Array<[number, number]> =
          f.face === 'E' ? [[-off, -pw * 0.7], [-off, pw * 0.7]]
          : f.face === 'W' ? [[off, -pw * 0.7], [off, pw * 0.7]]
          : f.face === 'S' ? [[-pw * 0.7, -off], [pw * 0.7, -off]]
          : [[-pw * 0.7, off], [pw * 0.7, off]]
        for (const [px, pz] of pos)
          g.add(box(ew ? 360 : pw, 140, ew ? pw : 360, M.pillow, px, ph, pz))
      }
      place(g, cx, cy)
      return g
    }
    case 'armchair': {
      g.add(box(w, 400, d, M.fabric, 0, 200, 0))
      g.add(box(w, 720, 170, M.fabricDark, 0, 360, -d / 2 + 85))
      g.add(box(150, 560, d, M.fabricDark, -w / 2 + 75, 280, 0))
      g.add(box(150, 560, d, M.fabricDark, w / 2 - 75, 280, 0))
      place(g, cx, cy)
      return g
    }
    case 'dining': {
      // The TABLE ONLY — its chairs are their own items now, exported one per
      // chair the sheet draws. The 3D never invents seating again: a seat
      // count was a hint, and hints drift; drawn rectangles cannot.
      if (f.poly) {
        const top = polyPiece(f.poly, 690, 750, M.timber, f.room)
        if (top) g.add(top)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const leg = box(70, 690, 70, M.timber)
          place(leg, cx + sx * w * 0.26, cy + sz * d * 0.3, 345)
          g.add(leg)
        }
        return g
      }
      g.add(box(w, 60, d, M.timber, 0, 750, 0))
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        g.add(box(70, 750, 70, M.timber, sx * (w / 2 - 90), 375, sz * (d / 2 - 90)))
      }
      place(g, cx, cy)
      return g
    }
    case 'chair': {
      // One drawn chair: seat and legs inside its rectangle, back on the side
      // away from `face` (the way the sitter looks — at the table).
      const seat = Math.min(w, d) - 30
      g.add(box(seat, 60, seat, M.fabricDark, 0, 440, 0))
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
        g.add(box(45, 440, 45, M.timber, lx * (seat / 2 - 35), 220, lz * (seat / 2 - 35)))
      const bh = Math.min(f.height, 900)
      const back =
        f.face === 'E' ? box(60, bh - 440, seat, M.fabricDark, -w / 2 + 30, (bh + 440) / 2, 0)
        : f.face === 'W' ? box(60, bh - 440, seat, M.fabricDark, w / 2 - 30, (bh + 440) / 2, 0)
        : f.face === 'S' ? box(seat, bh - 440, 60, M.fabricDark, 0, (bh + 440) / 2, -d / 2 + 30)
        : box(seat, bh - 440, 60, M.fabricDark, 0, (bh + 440) / 2, d / 2 - 30)
      g.add(back)
      place(g, cx, cy)
      return g
    }
    case 'table':
    case 'console':
    case 'bench': {
      const h = Math.min(f.height, 900)
      g.add(box(w, 50, d, M.timber, 0, h - 25, 0))
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
        g.add(box(60, h - 50, 60, M.timber, sx * (w / 2 - 60), (h - 50) / 2, sz * (d / 2 - 60)))
      place(g, cx, cy)
      return g
    }
    case 'stool':
      g.add(box(w, f.height, d, M.timber, 0, f.height / 2, 0))
      place(g, cx, cy)
      return g
    case 'wardrobe':
    case 'shelves': {
      const m = box(w, f.height, d, M.timber, 0, f.height / 2, 0)
      place(m, cx, cy)
      return m
    }
    case 'screen': {
      // a drawn screen is thin and SEE-THROUGH above its dado — rendering it
      // as an opaque slab once put a phantom wall in Karan's suite
      const dado = Math.min(900, f.height * 0.42)
      g.add(box(w, dado, d, M.timber, 0, dado / 2, 0))
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(w * S, (f.height - dado) * S, d * S), M.tintGlass)
      glass.position.set(0, ((f.height + dado) / 2) * S, 0)
      g.add(glass)
      place(g, cx, cy)
      return g
    }
    case 'tv': {
      // slim dark panel on its stand (the den monitor), inside its rectangle
      const thin = Math.min(80, Math.min(w, d))
      const panelW = Math.max(w, d)
      const upright = d > w
      g.add(box(upright ? thin : panelW, 520, upright ? panelW : thin, M.appliance, 0, 1020, 0))
      g.add(box(120, 760, 120, M.metal, 0, 380, 0))
      place(g, cx, cy)
      return g
    }
    case 'plant': {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.32 * S, Math.min(w, d) * 0.26 * S, 340 * S, 12),
        M.pot,
      )
      pot.position.y = 170 * S
      pot.castShadow = true
      g.add(pot)
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * (0.24 + (i % 2) * 0.09) * S, 8, 6),
          i % 2 ? M.leaf : M.leafDark)
        s.position.set(((i % 2) - 0.5) * 0.2 * w * S, (450 + i * 160) * S, (((i >> 1) % 2) - 0.5) * 0.2 * d * S)
        s.castShadow = true
        g.add(s)
      }
      place(g, cx, cy)
      return g
    }
    case 'tree': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(70 * S, 95 * S, f.height * 0.45 * S, 10), M.trunk)
      trunk.position.y = f.height * 0.225 * S
      trunk.castShadow = true
      g.add(trunk)
      const r0 = Math.max(w, d) * 0.62
      for (const [dx, dy, dz, k] of [
        [0, 0, 0, 1], [-0.5, -0.18, 0.2, 0.62], [0.5, -0.22, -0.2, 0.6],
        [0.15, 0.28, 0.3, 0.55], [-0.2, 0.3, -0.35, 0.5],
      ] as const) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r0 * k * S, 9, 7), k > 0.9 ? M.leaf : M.leafDark)
        s.position.set(dx * r0 * S, (f.height * 0.62 + dy * r0) * S, dz * r0 * S)
        s.castShadow = true
        g.add(s)
      }
      place(g, cx, cy)
      return g
    }
    case 'drumkit': {
      for (const [dx, dz, r, h] of [[-w * 0.25, 0, 240, 420], [0, -d * 0.2, 180, 500],
        [w * 0.25, 0, 200, 460], [0, d * 0.22, 300, 380]] as const) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, h * S, 14), M.appliance)
        c.position.set(dx * S, (h / 2) * S, dz * S)
        c.castShadow = true
        g.add(c)
      }
      place(g, cx, cy)
      return g
    }
    default: {
      const m = box(w, f.height, d, M.fabric, 0, f.height / 2, 0)
      place(m, cx, cy)
      return m
    }
  }
}

export function buildScene(M: Mats, opts: { roofs?: boolean } = {}): THREE.Group {
  const root = new THREE.Group()

  // ---- floors, by finish
  for (const slab of solids.slabs) {
    const room = model.roomById.get(slab.roomId)
    const fin = (room?.def.finish ?? '').toLowerCase()
    const mat =
      fin.includes('grass') ? M.grass
      : fin.includes('oak') || fin.includes('timber') ? M.oak
      : fin.includes('stone') ? M.stone
      : fin.includes('vinyl') ? M.stone
      : M.stone
    if (room?.def.category === 'void') continue         // shafts stay open
    const geo = prismGeometry(decimate(slab.polygon), -80, 0,
      slab.holes.map((h) => decimate(h)))
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    root.add(mesh)
  }
  // one slab under everything (the structure), so voids read as pits, not holes
  const env = model.envelope
  root.add(new THREE.Mesh(prismGeometry(env, -240, -90), M.stone))

  // ---- walls and glass from the shared prisms
  for (const p of solids.prisms) {
    if (p.kind === 'lintel' && p.top - p.base < 60) continue
    const mat =
      p.kind === 'glazing' ? M.glass
      : p.kind === 'wall-curved-glass' ? (p.wallId === 'W-CURVE-KARAN' ? M.tintGlass : M.glass)
      : p.kind === 'screen' ? M.wallWood
      : M.plaster
    const mesh = new THREE.Mesh(prismGeometry(p.polygon, p.base, p.top), mat)
    mesh.castShadow = mat === M.plaster
    mesh.receiveShadow = true
    root.add(mesh)
  }

  // the entry drum + gallery legs read as wood: repaint by wall id
  for (const p of solids.prisms) {
    if (p.wallId && (p.wallId.startsWith('W-GAL-ARC') || p.wallId === 'W-GAL-W' || p.wallId === 'W-GAL-E')) {
      const mesh = new THREE.Mesh(prismGeometry(p.polygon, p.base, p.top), M.wallWood)
      mesh.castShadow = true
      mesh.scale.setScalar(1.001)
      root.add(mesh)
    }
  }

  // ---- glass roofs
  for (const roof of opts.roofs === false ? [] : solids.roofs) {
    const [x0, y0, x1, y1] = roof.extent
    const h = (roof.height ?? model.data.levels.ceiling) * S
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry((x1 - x0) * S, (y1 - y0) * S), M.roofGlass)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(((x0 + x1) / 2) * S, h, ((y0 + y1) / 2) * S)
    root.add(mesh)
    // slim frame
    const fr = new THREE.Mesh(
      new THREE.BoxGeometry((x1 - x0) * S, 0.04, 0.04), M.metal)
    fr.position.copy(mesh.position)
    root.add(fr)
  }

  // ---- the fountain: marble ring + water disc on the deck centre
  const F = { x: 12240, y: 1160, r: 600 }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(F.r * S, (F.r + 60) * S, 0.42, 36, 1, false), M.marble)
  ring.position.set(F.x * S, 0.21, F.y * S)
  ring.castShadow = true
  root.add(ring)
  const water = new THREE.Mesh(new THREE.CylinderGeometry((F.r - 90) * S, (F.r - 90) * S, 0.05, 32), M.water)
  water.position.set(F.x * S, 0.4, F.y * S)
  root.add(water)

  return root
}

// fixtures rendered simply
export function buildFixtures(M: Mats): THREE.Group {
  const g = new THREE.Group()
  for (const f of fixtures) {
    const [w, d] = f.size
    const h = f.kind === 'counter' ? 900 : f.kind === 'fridge' ? 1900 : f.kind === 'basin' ? 850
      : f.kind === 'shower' ? 40 : f.kind === 'wc' ? 420 : f.kind === 'hob' ? 40 : 850
    // Curved runs (kitchen counters, the arched vanities) carry their drawn
    // outline: extrude the real shape, clipped at the walls, with a stone top.
    if (f.poly && (f.kind === 'counter' || f.kind === 'basin')) {
      const body = polyPiece(f.poly, 0, h, M.timber, f.room)
      const top = polyPiece(f.poly, h, h + 40, M.marble, f.room)
      if (body) g.add(body)
      if (top) g.add(top)
      if (f.bowl) {
        // the basin, set exactly where the sheet draws its circle
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(f.bowl.r * S, f.bowl.r * 0.8 * S, 140 * S, 20),
          M.marble,
        )
        bowl.position.set(f.bowl.x * S, (h + 40 + 70) * S, f.bowl.y * S)
        bowl.castShadow = true
        g.add(bowl)
      }
      continue
    }
    // The shower is a CABINET, not a floor stain: stone tray with a raised
    // curb and glass around it — visible from above and walk-through alike.
    if (f.kind === 'shower') {
      const tray = box(w, 50, d, M.marble)
      place(tray, f.at.x, f.at.y, 25)
      g.add(tray)
      const curb = 60
      const gh = 2000
      for (const [px, py, sw, sd] of [
        [f.at.x, f.at.y - d / 2 + curb / 2, w, curb],
        [f.at.x, f.at.y + d / 2 - curb / 2, w, curb],
        [f.at.x - w / 2 + curb / 2, f.at.y, curb, d],
        [f.at.x + w / 2 - curb / 2, f.at.y, curb, d],
      ] as const) {
        const c = box(sw, 100, sd, M.marble)
        place(c, px, py, 75)
        g.add(c)
        const gl = new THREE.Mesh(
          new THREE.BoxGeometry((sw === curb ? 14 : sw - 20) * S, gh * S,
            (sd === curb ? 14 : sd - 20) * S),
          M.glass,
        )
        gl.position.set(px * S, (100 + gh / 2) * S, py * S)
        g.add(gl)
      }
      continue
    }
    const mat = f.kind === 'counter' || f.kind === 'basin' ? M.timber
      : f.kind === 'wc' ? M.marble : M.appliance
    const m = box(w, h, d, mat, 0, (f.kind === 'counter' || f.kind === 'basin' ? h / 2 : h / 2), 0)
    place(m, f.at.x, f.at.y)
    m.position.y = (h / 2) * S
    if (f.kind === 'hob') m.position.y = 0.92
    g.add(m)
    if (f.kind === 'counter' || f.kind === 'basin') {
      const top = box(w, 40, d, M.marble, 0, 0, 0)
      place(top, f.at.x, f.at.y, 910)
      g.add(top)
    }
  }
  return g
}

// ------------------------------------------------------------ component
export function Realistic({ compact = false }: { compact?: boolean }): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [walking, setWalking] = useState(false)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xcfe0ea)
    scene.fog = new THREE.Fog(0xcfe0ea, 60, 160)

    const M = makeMaterials()
    scene.add(buildScene(M))
    scene.add(buildFixtures(M))

    const furn = new THREE.Group()
    for (const f of furniture) {
      if (f.label.toLowerCase().includes('fountain')) continue
      const o = furnitureMesh(f, M)
      if (o) furn.add(o)
    }
    scene.add(furn)

    // ---- light
    scene.add(new THREE.HemisphereLight(0xeaf2f7, 0x9a9078, 1.0))
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.9)
    sun.position.set(6, 22, 14)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const ext = 18
    sun.shadow.camera.left = -ext
    sun.shadow.camera.right = ext
    sun.shadow.camera.top = ext
    sun.shadow.camera.bottom = -ext
    sun.shadow.camera.far = 80
    sun.target.position.set(12.24, 0, 5)
    scene.add(sun, sun.target)

    // warm evening pools in the habitable rooms
    for (const r of model.rooms) {
      if (r.def.category !== 'habitable' && r.def.id !== 'R-ENTRY') continue
      const p = new THREE.PointLight(0xffe3b0, 0.5, Math.max(r.width, r.depth) * S * 1.4, 1.8)
      p.position.set(r.centroid.x * S, (r.ceiling - 350) * S, r.centroid.y * S)
      scene.add(p)
    }

    // ground far below, so looking over the parapet reads as height
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x9aa48e, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -42
    ground.receiveShadow = true
    scene.add(ground)

    // ---- camera + controls
    const camera = new THREE.PerspectiveCamera(64, 1, 0.05, 400)
    // start inside the great room, looking north over the seating to the deck
    camera.position.set(12.24, 1.62, 7.0)
    camera.lookAt(12.24, 1.4, 2.0)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(12.24, 1.1, 3.2)
    orbit.maxPolarAngle = Math.PI * 0.495
    orbit.update()

    const lock = new PointerLockControls(camera, renderer.domElement)
    const keys = new Set<string>()
    const onKey = (e: KeyboardEvent, down: boolean): void => {
      if (down) keys.add(e.code)
      else keys.delete(e.code)
    }
    const kd = (e: KeyboardEvent): void => onKey(e, true)
    const ku = (e: KeyboardEvent): void => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    lock.addEventListener('lock', () => { setWalking(true); setHint(false); orbit.enabled = false })
    lock.addEventListener('unlock', () => { setWalking(false); orbit.enabled = true })

    const onClick = (): void => {
      if (!lock.isLocked) lock.lock()
    }
    renderer.domElement.addEventListener('dblclick', onClick)

    const clock = new THREE.Clock()
    let raf = 0
    const bb = model.envelopeBBox
    const animate = (): void => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      if (lock.isLocked) {
        const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.6 : 2.3) * dt
        const fwd = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
        const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
        if (fwd) lock.moveForward(fwd * speed)
        if (side) lock.moveRight(side * speed)
        camera.position.y = 1.62
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, (bb.minX - 2000) * S, (bb.maxX + 2000) * S)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, (bb.minY - 3500) * S, (bb.maxY + 2000) * S)
      } else {
        orbit.update()
      }
      renderer.render(scene, camera)
    }

    const resize = (): void => {
      const r = mount.getBoundingClientRect()
      renderer.setSize(r.width, r.height)
      camera.aspect = r.width / Math.max(1, r.height)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      renderer.domElement.removeEventListener('dblclick', onClick)
      if (lock.isLocked) lock.unlock()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute', left: 12, bottom: 12, padding: '6px 12px',
          background: 'rgba(30,28,24,0.72)', color: '#f3ecdd', borderRadius: 6,
          fontSize: 12.5, pointerEvents: 'none', letterSpacing: 0.3,
        }}
      >
        {walking
          ? 'W A S D to walk · mouse to look · Shift to hurry · Esc to release'
          : 'Drag to orbit · double-click to enter and walk the home'}
      </div>
      {hint && !compact && (
        <div
          style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            padding: '7px 14px', background: 'rgba(30,28,24,0.72)', color: '#f3ecdd',
            borderRadius: 6, fontSize: 13, pointerEvents: 'none',
          }}
        >
          The home in its materials — oak, stone, grass and glass. Double-click to step inside.
        </div>
      )}
    </div>
  )
}
