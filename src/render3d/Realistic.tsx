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
 * Orbit with the pointer when not walking. On a touch screen (iPad) there is no
 * mouse to lock and no keys, so Walk shows a thumb stick and a drag-to-look
 * instead — see touchWalk.ts.
 */

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { getModel } from '../geometry/model'
import { pointInPolygon } from '../geometry/vec'
import { barrelProfile, buildSolids } from '../geometry/solid'
import { gableGeometry, gableJamb, vaultGeometry } from './canopy'
import { EXTRUDED_KINDS, renderFootprints } from '../geometry/fidelity'
import { furniture, type FurnitureItem } from '../data/furniture'
import { fixtures } from '../data/fixtures'
import { AiRenderPanel } from './AiRenderPanel'
import { StylePanel } from './StylePanel'
import { decimate, prismGeometry, S } from './prism'
import { customObject, floorMaterial, getAssign, primeStyle, wallMaterial } from './styleOverrides'
import { lightRig } from './lighting'
import { createTouchWalk, isTouchDevice, preventPageZoom, zoomLens, type TouchWalk } from './touchWalk'
import { PRESETS, presetCamera } from './cameras'
import { podDoorLeaves, type PodDoorMode } from './podDoors'
import { isStrengthTrainer, strengthTrainer } from './gym'
import { hedgeGroup } from './hedge'
import { cityscape, followCamera, skyDome, STREET_DROP } from './backdrop'
import { useStore } from '../ui/store'

const model = getModel()
const solids = buildSolids(model)

/** The first-person default: same fidelity rules, eye-level phrasing. */
const FP_PROMPT =
  'Re-render this first-person interior view photorealistically. Keep the camera ' +
  'viewpoint and every wall, opening and piece of furniture exactly where and how ' +
  'large they are — change nothing structural. Upgrade materials and light to ' +
  'high-end interior photography quality, natural depth of field, eye level.'

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
    // the chamfered edge of a bevelled light: catches the light, reads brighter
    bevel: new THREE.MeshPhysicalMaterial({
      color: 0xf4fbff, transparent: true, opacity: 0.55, roughness: 0.04,
      metalness: 0.05, side: THREE.DoubleSide, depthWrite: false,
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
    // carved stone of the fountain: warmer and duller than the polished marble tops
    carved: new THREE.MeshStandardMaterial({ color: 0xd6cdbb, roughness: 0.7 }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xeef2f2, roughness: 0.18, metalness: 0.05 }),
    petal: new THREE.MeshStandardMaterial({ color: 0xd4679a, roughness: 0.8 }),
    petalWhite: new THREE.MeshStandardMaterial({ color: 0xf6eff2, roughness: 0.8 }),
    appliance: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.4, metalness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc6c9cc, roughness: 0.32, metalness: 0.7 }),
    gasket: new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.6 }),
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
  // A real 3D object assigned to this piece replaces the built-in mesh —
  // already FITTED to the drawn footprint, so the projection gate still holds.
  const custom = customObject(f)
  if (custom) return custom

  const g = new THREE.Group()
  const w = f.w
  const d = f.d
  const cx = f.x + w / 2
  const cy = f.y + d / 2

  /** Extrude the drawn outline in the piece's LOCAL frame, so it can sit in
   * a group that place() positions — rounded beds and sofas keep their
   * drawn silhouette instead of being squared back into boxes. */
  const basePrism = (poly: { x: number; y: number }[], base: number, top: number, mat: THREE.Material): THREE.Mesh => {
    const lp = decimate(poly.map((q) => ({ x: q.x - cx, y: q.y - cy })))
    const m = new THREE.Mesh(prismGeometry(lp, base, top), mat)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }

  // The strength trainer is a cable machine, not a joinery slab.
  if (isStrengthTrainer(f)) {
    return strengthTrainer(f, { metal: M.metal, weights: M.trunk, pad: M.fabricDark })
  }

  // The spa is a hot tub, not a table: a wood-skirted shell with a lip, water,
  // four seats under it and a headrest each. Everything stays inside the drawn
  // 1750 square, so the footprint gate still holds.
  if (/\bspa\b|jacuzzi|hot tub/i.test(f.label)) {
    const rr = (hw: number, hd: number, r: number) => {
      const pts: { x: number; y: number }[] = []
      const corners: Array<[number, number, number]> = [[hw - r, hd - r, 0], [-hw + r, hd - r, Math.PI / 2], [-hw + r, -hd + r, Math.PI], [hw - r, -hd + r, -Math.PI / 2]]
      for (const [ox, oy, a0] of corners)
        for (let i = 0; i <= 6; i++) {
          const a = a0 + (Math.PI / 2) * (i / 6)
          pts.push({ x: ox + r * Math.cos(a), y: oy + r * Math.sin(a) })
        }
      return pts
    }
    const hw = w / 2
    const hd = d / 2
    const H = Math.min(f.height, 900)
    const LIP = 130
    const outer = rr(hw, hd, 180)
    const inner = rr(hw - LIP, hd - LIP, 120)
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = true
      m.receiveShadow = true
      return m
    }
    g.add(mesh(prismGeometry(outer, 0, H - 90, [inner]), M.wallWood))      // the cabinet skirt
    g.add(mesh(prismGeometry(outer, H - 90, H, [inner]), M.acrylic))         // the lip
    g.add(mesh(prismGeometry(inner, 0, 260, []), M.acrylic))                 // the shell floor
    const seatIn = 300
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.add(box(560, 300, 560, M.acrylic, sx * (hw - LIP - seatIn), 260 + 150, sz * (hd - LIP - seatIn)))
      g.add(box(150, 90, 340, M.fabricDark, sx * (hw - LIP / 2), H + 45, sz * (hd - 380)))
    }
    g.add(mesh(prismGeometry(inner, H - 130, H - 118, []), M.water))         // the water, just below the lip
    place(g, cx, cy)
    return g
  }

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
      // the planted strip: a low bed with a clipped hedge standing in it, tall
      // enough to hide the city from inside (see hedge.ts)
      const bed = f.poly ? polyPiece(f.poly, 0, 300, M.pot, f.room) : box(w, 300, d, M.pot)
      if (bed && !f.poly) place(bed, cx, cy, 150)
      return hedgeGroup(f, { bed: M.pot, leaf: M.leaf, leafDark: M.leafDark }, bed)
    }
    case 'sofa': {
      const seatH = 420
      const backH = f.height
      g.add(f.poly ? basePrism(f.poly, 0, seatH, M.fabric)
        : box(w, seatH, d, M.fabric, 0, seatH / 2, 0))
      // back along the far side by `face`
      const bt = 190
      const back =
        f.face === 'S' ? box(w, backH, bt, M.fabricDark, 0, backH / 2, -d / 2 + bt / 2)
        : f.face === 'N' ? box(w, backH, bt, M.fabricDark, 0, backH / 2, d / 2 - bt / 2)
        : f.face === 'E' ? box(bt, backH, d, M.fabricDark, -w / 2 + bt / 2, backH / 2, 0)
        : box(bt, backH, d, M.fabricDark, w / 2 - bt / 2, backH / 2, 0)
      g.add(back)
      // arms + cushions, at the ends of the back whichever way it faces
      const armH = seatH + 160
      if (f.face === 'N' || f.face === 'S') {
        g.add(box(bt, armH, d, M.fabricDark, -w / 2 + bt / 2, armH / 2, 0))
        g.add(box(bt, armH, d, M.fabricDark, w / 2 - bt / 2, armH / 2, 0))
        const n = Math.max(2, Math.round(w / 800))
        for (let i = 0; i < n; i++) {
          g.add(box(w / n - 60, 110, d - 240, M.duvet,
            -w / 2 + (i + 0.5) * (w / n), seatH + 55,
            f.face === 'S' ? 40 : -40))
        }
      } else if (f.face === 'E' || f.face === 'W') {
        g.add(box(w, armH, bt, M.fabricDark, 0, armH / 2, -d / 2 + bt / 2))
        g.add(box(w, armH, bt, M.fabricDark, 0, armH / 2, d / 2 - bt / 2))
        const n = Math.max(2, Math.round(d / 800))
        for (let i = 0; i < n; i++) {
          g.add(box(w - 240, 110, d / n - 60, M.duvet,
            f.face === 'E' ? 40 : -40, seatH + 55,
            -d / 2 + (i + 0.5) * (d / n)))
        }
      }
      place(g, cx, cy)
      return g
    }
    case 'lounger': {
      g.add(f.poly ? basePrism(f.poly, 0, 380, M.fabric)
        : box(w, 380, d, M.fabric, 0, 190, 0))
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
      if (/bunk/i.test(f.label)) {
        // two berths on four posts, a guard rail along the open side of the
        // upper one, and a ladder at the foot
        const alongX = w >= d
        const post = 60
        const lvl = [0, 1450]
        for (const y0 of lvl) {
          g.add(box(w - 2 * post, 180, d - 2 * post, M.timber, 0, y0 + 90, 0))
          g.add(box(w - 2 * post - 40, 160, d - 2 * post - 40, M.duvet, 0, y0 + 260, 0))
          const pw = Math.min(480, (alongX ? d : w) - 200)
          g.add(box(alongX ? 300 : pw, 110, alongX ? pw : 300, M.pillow,
            alongX ? -(w / 2 - post - 220) : 0, y0 + 395, alongX ? 0 : -(d / 2 - post - 220)))
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          g.add(box(post, 2000, post, M.timber, sx * (w / 2 - post / 2), 1000, sz * (d / 2 - post / 2)))
        // guard rail on the side the sleeper faces
        const railH = 1450 + 180 + 300
        if (f.face === 'S') g.add(box(w - 2 * post, 40, 30, M.timber, 0, railH, d / 2 - post - 15))
        else if (f.face === 'N') g.add(box(w - 2 * post, 40, 30, M.timber, 0, railH, -(d / 2 - post - 15)))
        else if (f.face === 'E') g.add(box(30, 40, d - 2 * post, M.timber, w / 2 - post - 15, railH, 0))
        else g.add(box(30, 40, d - 2 * post, M.timber, -(w / 2 - post - 15), railH, 0))
        // ladder at the foot end
        const lx = alongX ? w / 2 - post - 40 : 0
        const lz = alongX ? 0 : d / 2 - post - 40
        for (let r = 0; r < 6; r++) {
          g.add(box(alongX ? 30 : 360, 30, alongX ? 360 : 30, M.timber, lx, 300 + r * 260, lz))
        }
        place(g, cx, cy)
        return g
      }
      if (f.poly) {
        // the drawn silhouette — rounded foot corners survive to 3D
        g.add(basePrism(f.poly, 0, 260, M.timber))
        g.add(basePrism(f.poly, 260, 470, M.duvet))
      } else {
        g.add(box(w, 260, d, M.timber, 0, 130, 0))                    // frame
        g.add(box(w - 60, 210, d - 60, M.duvet, 0, 260 + 105, 0))    // mattress+duvet
      }
      // pillows at the head (face = the way the sleeper looks, derived from
      // the DRAWN pillows/headboard; no face means no drawn head — no
      // pillows, never a guess). E/W heads run along x, N/S along y, and a
      // cabinet too shallow for pillows (the folded murphy) gets none.
      const ph = 260 + 210 + 70
      const ew = f.face === 'E' || f.face === 'W'
      const pw = Math.min(560, (ew ? d : w) / 2 - 80)
      const off = (ew ? w : d) / 2 - 260
      if (f.face && off > 80 && pw > 80) {
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
      g.add(f.poly ? basePrism(f.poly, 0, 400, M.fabric)
        : box(w, 400, d, M.fabric, 0, 200, 0))
      // back on the side opposite the face (drawn), arms on the flanks
      const bk =
        f.face === 'N' ? box(w, 720, 170, M.fabricDark, 0, 360, d / 2 - 85)
        : f.face === 'E' ? box(170, 720, d, M.fabricDark, -w / 2 + 85, 360, 0)
        : f.face === 'W' ? box(170, 720, d, M.fabricDark, w / 2 - 85, 360, 0)
        : box(w, 720, 170, M.fabricDark, 0, 360, -d / 2 + 85)
      g.add(bk)
      if (f.face === 'E' || f.face === 'W') {
        g.add(box(w, 560, 150, M.fabricDark, 0, 280, -d / 2 + 75))
        g.add(box(w, 560, 150, M.fabricDark, 0, 280, d / 2 - 75))
      } else {
        g.add(box(150, 560, d, M.fabricDark, -w / 2 + 75, 280, 0))
        g.add(box(150, 560, d, M.fabricDark, w / 2 - 75, 280, 0))
      }
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

/**
 * The pod-to-suite sliding doors in one state: wooden leaves with a recessed
 * panel line and a pull at the leading stile. Both states are built into the
 * scene and the Show setting picks which one is visible.
 */
export function podDoorGroup(M: Mats, mode: PodDoorMode): THREE.Group {
  const g = new THREE.Group()
  g.name = `pod-doors-${mode}`
  for (const leaf of podDoorLeaves(model.data, mode)) {
    const w = leaf.x1 - leaf.x0
    const d = leaf.y1 - leaf.y0
    const h = leaf.top - leaf.base
    const cx = (leaf.x0 + leaf.x1) / 2
    const cy = (leaf.y0 + leaf.y1) / 2
    const body = box(w, h, d, M.wallWood)
    place(body, cx, cy, leaf.base + h / 2)
    g.add(body)
    // two recessed panels either side of a mid rail, read as thin dark lines
    for (const dy of [-d / 2 + 120, -120, 120, d / 2 - 120]) {
      const line = box(w + 4, h - 300, 6, M.trunk)
      place(line, cx, cy + dy, leaf.base + h / 2)
      g.add(line)
    }
    const rail = box(w + 4, 8, d - 240, M.trunk)
    place(rail, cx, cy, leaf.base + h / 2)
    g.add(rail)
    // the pull, a vertical bar at the leading stile
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), M.metal)
    const towardCentre = cx < (model.envelopeBBox.minX + model.envelopeBBox.maxX) / 2 ? 1 : -1
    pull.position.set((cx + towardCentre * (w / 2 + 25)) * S, 1.05, (cy + leaf.handleAt * (d / 2 - 90)) * S)
    g.add(pull)
  }
  return g
}

/**
 * A three-tier carved stone fountain, London style: stepped plinth, a wide lower
 * basin on a fluted pedestal, a middle and a top basin above it, a finial, water
 * falling from tier to tier, and trailing flowers spilling over the two lower rims.
 * Scaled from the drawn footprint radius `r` (600 on the sheet).
 */
function tieredFountain(M: Mats, F: { x: number; y: number; r: number }): THREE.Group {
  const g = new THREE.Group()
  const k = F.r / 600
  const mm = (v: number) => v * k * S
  const add = (m: THREE.Mesh, y: number) => {
    m.position.set(F.x * S, y * k * S, F.y * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const lathe = (profile: Array<[number, number]>, mat: THREE.Material, segs = 40) => {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r * k * S, y * k * S))
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat)
    m.material.side = THREE.DoubleSide
    return m
  }
  // plinth and pedestal
  add(new THREE.Mesh(new THREE.CylinderGeometry(mm(560), mm(600), mm(80), 40), M.carved), 40)
  add(new THREE.Mesh(new THREE.CylinderGeometry(mm(470), mm(500), mm(100), 40), M.carved), 130)
  add(new THREE.Mesh(new THREE.CylinderGeometry(mm(180), mm(230), mm(420), 14), M.carved), 390)
  add(new THREE.Mesh(new THREE.TorusGeometry(mm(215), mm(38), 10, 32), M.carved), 600)
  // the three basins, each a bowl with water in it
  const bowl = (rim: number, base: number, top: number, mat = M.carved) =>
    lathe([[0, base], [rim * 0.55, base], [rim * 0.92, base + (top - base) * 0.55], [rim, top - 20], [rim - 30, top], [rim * 0.45, top - 60], [0, top - 70]], mat)
  const water = (r: number, y: number) => add(new THREE.Mesh(new THREE.CylinderGeometry(mm(r), mm(r), mm(12), 36), M.water), y)
  add(bowl(600, 620, 840), 0)
  water(520, 815)
  add(new THREE.Mesh(new THREE.CylinderGeometry(mm(105), mm(135), mm(700), 14), M.carved), 840 + 350)
  add(bowl(380, 1520, 1690), 0)
  water(320, 1668)
  add(new THREE.Mesh(new THREE.CylinderGeometry(mm(65), mm(85), mm(380), 12), M.carved), 1690 + 190)
  add(bowl(220, 2060, 2180), 0)
  water(180, 2160)
  add(new THREE.Mesh(new THREE.SphereGeometry(mm(62), 16, 12), M.carved), 2245)
  add(new THREE.Mesh(new THREE.ConeGeometry(mm(40), mm(120), 12), M.carved), 2330)
  // falling water: thin translucent columns from each upper rim into the basin below
  const fall = (r: number, n: number, top: number, bottom: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(7), mm(9), mm(top - bottom), 6), M.water)
      m.position.set((F.x + r * k * Math.cos(a)) * S, ((top + bottom) / 2) * k * S, (F.y + r * k * Math.sin(a)) * S)
      g.add(m)
    }
  }
  fall(200, 6, 2160, 1690)
  fall(360, 8, 1668, 840)
  // flowers and creepers over the two lower rims: a green wreath, blooms on it,
  // and strands trailing down
  const wreath = (r: number, tube: number, y: number, blooms: number, strands: number, drop: number) => {
    add(new THREE.Mesh(new THREE.TorusGeometry(mm(r), mm(tube), 8, 40), M.leafDark), y)
    for (let i = 0; i < blooms; i++) {
      const a = (i / blooms) * Math.PI * 2 + (i % 3) * 0.07
      const rr = r + (i % 2 ? tube * 0.6 : -tube * 0.3)
      const m = new THREE.Mesh(new THREE.SphereGeometry(mm(30), 8, 6), i % 3 === 0 ? M.petalWhite : M.petal)
      m.position.set((F.x + rr * k * Math.cos(a)) * S, (y + tube * 0.4) * k * S, (F.y + rr * k * Math.sin(a)) * S)
      g.add(m)
    }
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * Math.PI * 2 + 0.2
      const len = drop * (0.6 + ((i * 7) % 5) / 10)
      const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(12), mm(18), mm(len), 6), i % 2 ? M.leaf : M.leafDark)
      m.position.set((F.x + (r + tube * 0.5) * k * Math.cos(a)) * S, (y - len / 2) * k * S, (F.y + (r + tube * 0.5) * k * Math.sin(a)) * S)
      g.add(m)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(mm(26), 8, 6), i % 2 ? M.petal : M.petalWhite)
      tip.position.set(m.position.x, (y - len) * k * S, m.position.z)
      g.add(tip)
    }
  }
  wreath(590, 80, 830, 30, 14, 620)
  wreath(370, 55, 1680, 18, 8, 420)
  return g
}

/**
 * The curved doors on the entry drum's arched portal to the great room. The 2D
 * draws them shut on the arc ("they slide on the arc"), so they are drawn shut
 * here too: a pair of leaves, wood framed, each with two chamfered glass lights.
 * Derived from the drum's own geometry — the arc wall's circumcentre and radius,
 * the portal's chord for its extent — so they cannot drift from the plan.
 */
function curvedDoors(M: Mats): THREE.Group | null {
  const walls = model.data.walls
  const chord = walls.find((w) => w.openings?.some((o) => o.id === 'D-GAL-N'))
  const arc = walls.find((w) => w.id === 'W-GAL-ARC-1')
  if (!chord?.points || chord.points.length < 2 || !arc?.points || arc.points.length < 3) return null
  const [p1, p2, p3] = [arc.points[0], arc.points[Math.floor(arc.points.length / 2)], arc.points[arc.points.length - 1]]
  // circumcentre of three points on the drum
  const dd = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
  if (Math.abs(dd) < 1e-6) return null
  const s1 = p1.x * p1.x + p1.y * p1.y
  const s2 = p2.x * p2.x + p2.y * p2.y
  const s3 = p3.x * p3.x + p3.y * p3.y
  const C = {
    x: (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / dd,
    y: (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / dd,
  }
  const Rwall = Math.hypot(p1.x - C.x, p1.y - C.y)
  const [q0, q1] = chord.points
  let a0 = Math.atan2(q0.y - C.y, q0.x - C.x)
  let a1 = Math.atan2(q1.y - C.y, q1.x - C.x)
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI
  if (a0 - a1 > Math.PI) a0 -= 2 * Math.PI
  if (a1 < a0) [a0, a1] = [a1, a0]

  // The leaves slide just inside the drum's inner face.
  const wallT = arc.thickness || 230
  const R = Rwall - wallT / 2 - 40
  const LEAF_T = 45
  const H = Math.min(2500, (chord.openings?.find((o) => o.id === 'D-GAL-N')?.head ?? 2530) - 30)
  const STILE = 90
  const RAIL_BOT = 300
  const RAIL_TOP = 150
  const RAIL_MID = 90
  const MID_AT = 1000
  const BEVEL = 40

  const g = new THREE.Group()
  const band = (r: number, from: number, to: number, t: number) => {
    const n = Math.max(3, Math.ceil(((to - from) * r) / 60))
    const outer = []
    const inner = []
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n
      outer.push({ x: C.x + (r + t / 2) * Math.cos(a), y: C.y + (r + t / 2) * Math.sin(a) })
      inner.push({ x: C.x + (r - t / 2) * Math.cos(a), y: C.y + (r - t / 2) * Math.sin(a) })
    }
    return [...outer, ...inner.reverse()]
  }
  const piece = (from: number, to: number, base: number, top: number, mat: THREE.Material, t = LEAF_T, r = R) => {
    const m = new THREE.Mesh(prismGeometry(band(r, from, to, t), base, top), mat)
    m.castShadow = mat === M.wallWood
    m.receiveShadow = true
    g.add(m)
  }
  const ang = (mm: number) => mm / R
  const mid = (a0 + a1) / 2
  for (const [s0, s1] of [[a0, mid], [mid, a1]] as const) {
    // frame
    piece(s0, s0 + ang(STILE), 0, H, M.wallWood)
    piece(s1 - ang(STILE), s1, 0, H, M.wallWood)
    piece(s0, s1, 0, RAIL_BOT, M.wallWood)
    piece(s0, s1, H - RAIL_TOP, H, M.wallWood)
    piece(s0, s1, MID_AT, MID_AT + RAIL_MID, M.wallWood)
    // two lights per leaf, each with a chamfered edge read as a brighter border
    const l0 = s0 + ang(STILE)
    const l1 = s1 - ang(STILE)
    for (const [b, t] of [[RAIL_BOT, MID_AT], [MID_AT + RAIL_MID, H - RAIL_TOP]] as const) {
      piece(l0, l1, b, t, M.glass, 8)
      piece(l0, l1, b, b + BEVEL, M.bevel, 14)
      piece(l0, l1, t - BEVEL, t, M.bevel, 14)
      piece(l0, l0 + ang(BEVEL), b, t, M.bevel, 14)
      piece(l1 - ang(BEVEL), l1, b, t, M.bevel, 14)
    }
  }
  // pull handles either side of the meeting stiles
  for (const sgn of [-1, 1]) {
    const a = mid + sgn * ang(STILE / 2)
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.metal)
    h.position.set((C.x + (R - LEAF_T / 2 - 30) * Math.cos(a)) * S, 1.05, (C.y + (R - LEAF_T / 2 - 30) * Math.sin(a)) * S)
    g.add(h)
  }
  return g
}

export function buildScene(M: Mats, opts: { roofs?: boolean } = {}): THREE.Group {
  const root = new THREE.Group()

  // ---- floors, by finish
  for (const slab of solids.slabs) {
    const room = model.roomById.get(slab.roomId)
    const fin = (room?.def.finish ?? '').toLowerCase()
    const follows = room?.def.finishFollows
    const mat =
      floorMaterial(slab.roomId)          // an assigned AI material wins
      ?? (follows ? floorMaterial(follows) : null)   // one floor through the glass
      ?? (fin.includes('grass') ? M.grass
      : fin.includes('oak') || fin.includes('timber') ? M.oak
      : fin.includes('stone') ? M.stone
      : fin.includes('vinyl') ? M.stone
      : M.stone)
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
    // The entry drum and the gallery legs are wood, both faces. (They used to be a
    // second mesh scaled by 0.1 % about the scene origin, which shifted the copy a
    // dozen millimetres east and left the drum's east half showing plaster.)
    const galleryWood = !!p.wallId &&
      (p.wallId.startsWith('W-GAL-ARC') || p.wallId === 'W-GAL-W' || p.wallId === 'W-GAL-E')
    const mat =
      p.glass === 'tinted' ? M.tintGlass
      : p.kind === 'glazing' ? M.glass
      : p.kind === 'wall-curved-glass' ? M.glass
      : p.kind === 'screen' ? M.wallWood
      : galleryWood ? M.wallWood
      : wallMaterial() ?? M.plaster
    const mesh = new THREE.Mesh(prismGeometry(p.polygon, p.base, p.top), mat)
    mesh.castShadow = mat === M.plaster || mat === M.wallWood
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const doors = curvedDoors(M)
  if (doors) root.add(doors)
  root.add(podDoorGroup(M, 'open'))
  root.add(podDoorGroup(M, 'shut'))

  // ---- glass roofs
  for (const roof of opts.roofs === false ? [] : solids.roofs) {
    const [x0, y0, x1, y1] = roof.extent
    if (roof.kind === 'barrel' && roof.section) {
      // The bellied vault: springs from the parapet, bulges out past it, peaks above the
      // ceiling and lands on the wall head. Same mesh as the 3D tab, from canopy.ts, so
      // the walkthrough cannot show a different roof from the model.
      const vault = new THREE.Mesh(vaultGeometry(roof), M.roofGlass)
      vault.receiveShadow = true
      root.add(vault)
      const profile = barrelProfile(roof.section, 48)
      for (let x = x0; x <= x1 + 1; x += 1500) {
        const curve = new THREE.CatmullRomCurve3(
          profile.map((q) => new THREE.Vector3(x * S, q.y * S, q.x * S)))
        const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.03, 6, false), M.metal)
        rib.castShadow = true
        root.add(rib)
      }
      for (const end of roof.gableEnds) {
        root.add(new THREE.Mesh(gableGeometry(roof, end), M.roofGlass))
        const j = gableJamb(roof, end)
        const jamb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, j.height, 6), M.metal)
        jamb.position.set(j.x, j.height / 2, j.z)
        root.add(jamb)
      }
      continue
    }
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

  // ---- the fountain: marble ring + water disc on the deck centre.
  // Fixed to Om Neeldhara's deck, and the only thing in this scene with no
  // footprint on the 2D sheet behind it. On a home without that deck it would
  // hang in mid-air outside the flat, so it is drawn only where its room is.
  const deck = model.roomById.get('R-DECK')
  const drawn = furniture.find((f) => f.label.toLowerCase().includes('fountain'))
  const F = drawn
    ? { x: drawn.x + drawn.w / 2, y: drawn.y + drawn.d / 2, r: Math.min(drawn.w, drawn.d) / 2 }
    : { x: 12240, y: 1160, r: 600 }
  if (deck && pointInPolygon({ x: F.x, y: F.y }, deck.polygon)) {
    root.add(tieredFountain(M, F))
  }

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
    // The fridge: a stainless French-door unit, two doors over a freezer drawer,
    // long bar handles, dark gasket lines, facing the room.
    if (f.kind === 'fridge') {
      const H = 1900
      const room = model.roomById.get(f.room)
      const dx = (room?.centroid.x ?? f.at.x) - f.at.x
      const dy = (room?.centroid.y ?? f.at.y) - f.at.y
      const alongX = Math.abs(dx) >= Math.abs(dy)
      const sgn = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1
      const body = box(w, H, d, M.steel)
      place(body, f.at.x, f.at.y, H / 2)
      g.add(body)
      // the front plane, 6 mm proud, with the gasket lines cut into it as dark strips
      const faceW = alongX ? d : w                    // the width of the face across the room
      const fx = f.at.x + (alongX ? sgn * (w / 2 + 3) : 0)
      const fz = f.at.y + (alongX ? 0 : sgn * (d / 2 + 3))
      const strip = (across: number, up: number, along: number, h: number) => {
        // `along` runs across the face, `h` is the height
        const m = box(alongX ? 6 : across, up, alongX ? across : 6, M.gasket)
        place(m, fx + (alongX ? 0 : along), fz + (alongX ? along : 0), h)
        g.add(m)
      }
      strip(faceW - 40, 14, 0, 760)                   // freezer drawer / doors split
      strip(14, H - 780, 0, 760 + (H - 780) / 2)      // the two doors meet in the middle
      strip(faceW - 40, 14, 0, H - 40)                // top reveal
      // handles: two long bars beside the centre split, one across the drawer
      for (const side of [-1, 1]) {
        const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), M.metal)
        const off = side * 70
        hb.position.set((fx + (alongX ? sgn * 22 : off)) * S, 1.24, (fz + (alongX ? off : sgn * 22)) * S)
        g.add(hb)
      }
      const dh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, (faceW - 240) * S, 8), M.metal)
      dh.rotation.set(alongX ? Math.PI / 2 : 0, 0, alongX ? 0 : Math.PI / 2)
      dh.position.set((fx + (alongX ? sgn * 22 : 0)) * S, 0.64, (fz + (alongX ? 0 : sgn * 22)) * S)
      g.add(dh)
      continue
    }

    // A stacked washer and dryer: two machines, one on the other, doors to the room.
    if (f.kind === 'laundry') {
      const MACHINE = 850
      const room = model.roomById.get(f.room)
      const dx = (room?.centroid.x ?? f.at.x) - f.at.x
      const dy = (room?.centroid.y ?? f.at.y) - f.at.y
      const alongX = Math.abs(dx) >= Math.abs(dy)     // doors face the room
      const sgn = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1
      for (let i = 0; i < 2; i++) {
        const body = box(w, MACHINE - 20, d, M.appliance)
        place(body, f.at.x, f.at.y, i * MACHINE + (MACHINE - 20) / 2)
        g.add(body)
        // control strip along the top edge of the front, and the round porthole door
        const strip = box(alongX ? 30 : w - 80, 70, alongX ? d - 80 : 30, M.metal)
        place(strip, f.at.x + (alongX ? sgn * (w / 2 - 5) : 0), f.at.y + (alongX ? 0 : sgn * (d / 2 - 5)),
          i * MACHINE + MACHINE - 90)
        g.add(strip)
        const r = Math.min(w, d) * 0.36
        const door = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, 30 * S, 28), M.metal)
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78 * S, r * 0.78 * S, 34 * S, 28), M.tintGlass)
        for (const m of [door, glass]) {
          m.rotation.z = alongX ? Math.PI / 2 : 0
          m.rotation.x = alongX ? 0 : Math.PI / 2
          m.position.set(
            (f.at.x + (alongX ? sgn * (w / 2 + 10) : 0)) * S,
            (i * MACHINE + MACHINE * 0.46) * S,
            (f.at.y + (alongX ? 0 : sgn * (d / 2 + 10))) * S)
          g.add(m)
        }
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
  const [touchWalking, setTouchWalking] = useState(false)
  const [hint, setHint] = useState(true)
  const touch = isTouchDevice()
  const touchRef = useRef<TouchWalk | null>(null)
  const walkRef = useRef<((on: boolean) => void) | null>(null)
  const wholeRef = useRef<(() => void) | null>(null)
  const captureRef = useRef<(() => string | null) | null>(null)
  const standRef = useRef<((roomId: string, dir: 'N' | 'S' | 'E' | 'W') => void) | null>(null)
  const [standRoom, setStandRoom] = useState('R-GREAT')

  const { state: uiState } = useStore()
  const sceneRef = useRef<THREE.Scene | null>(null)
  const podDoorsShut = uiState.show3d.podDoorsShut
  const shutRef = useRef(podDoorsShut)
  shutRef.current = podDoorsShut
  useEffect(() => {
    const sc = sceneRef.current
    if (!sc) return
    sc.traverse((o) => {
      if (o.name === 'pod-doors-open') o.visible = !podDoorsShut
      if (o.name === 'pod-doors-shut') o.visible = podDoorsShut
    })
  }, [podDoorsShut])

  const [styleTick, setStyleTick] = useState(0)
  useEffect(() => {
    const onStyle = (): void => {
      void primeStyle().then(() => setStyleTick((t) => t + 1))
    }
    onStyle()
    window.addEventListener('om-style-changed', onStyle)
    return () => window.removeEventListener('om-style-changed', onStyle)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const rig = lightRig(getAssign().lighting ?? null, 'walk')
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = rig.exposure
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(rig.background)
    // The haze thickens with distance so the city reads as far away and a little
    // smoggy; the block itself, seen from the overview, stays crisp.
    scene.fog = new THREE.Fog(rig.background, 160, 380)
    // sky, clouds and the city below and around - the things the hedge is there to hide
    const sky = skyDome(new THREE.Vector3(rig.sunOffset[0], rig.sunOffset[1], rig.sunOffset[2]))
    scene.add(sky)
    scene.add(cityscape({ bbox: model.envelopeBBox }))

    const M = makeMaterials()
    scene.add(buildScene(M))
    scene.traverse((o) => {
      if (o.name === 'pod-doors-open') o.visible = !shutRef.current
      if (o.name === 'pod-doors-shut') o.visible = shutRef.current
    })
    scene.add(buildFixtures(M))

    const furn = new THREE.Group()
    for (const f of furniture) {
      if (f.label.toLowerCase().includes('fountain')) continue
      const o = furnitureMesh(f, M)
      if (o) furn.add(o)
    }
    scene.add(furn)

    // ---- light
    scene.add(new THREE.HemisphereLight(rig.hemiSky, rig.hemiGround, rig.hemiIntensity))
    const sun = new THREE.DirectionalLight(rig.sunColor, rig.sunIntensity)
    sun.position.set(12.24 + rig.sunOffset[0], rig.sunOffset[1], 5 + rig.sunOffset[2])
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
      const p = new THREE.PointLight(rig.pointColor, rig.pointIntensity, Math.max(r.width, r.depth) * S * 1.4, 1.8)
      p.position.set(r.centroid.x * S, (r.ceiling - 350) * S, r.centroid.y * S)
      scene.add(p)
    }

    // the street, far below, so looking over the parapet reads as height
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: 0x7d7f78, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -STREET_DROP
    ground.receiveShadow = true
    scene.add(ground)

    // ---- camera + controls
    // Stand at eye height in the home's BIGGEST habitable room, a step back
    // from its middle, looking across it. That is Om Neeldhara's great room
    // looking north over the seating to the deck — the view this started as,
    // now derived instead of typed, so it is the same idea in any home rather
    // than a point on the floor of one of them.
    const biggest = model.rooms
      .filter((r) => r.def.category === 'habitable')
      .reduce((a, r) => (r.area > a.area ? r : a), model.rooms[0])
    const CX = biggest.centroid.x * S
    const CZ = biggest.centroid.y * S
    const STEP = 1.9

    const camera = new THREE.PerspectiveCamera(64, 1, 0.05, 400)
    camera.position.set(CX, 1.62, CZ + STEP)
    camera.lookAt(CX, 1.4, CZ - 3.3)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(CX, 1.1, CZ - STEP)
    orbit.maxPolarAngle = Math.PI * 0.495
    // Pinch or scroll from arm's length right out to the whole block and beyond.
    orbit.minDistance = 0.3
    orbit.maxDistance = 160
    orbit.update()
    const undoPageZoom = preventPageZoom(mount)

    // Frame the whole house: the same derived overview the 3D tab opens on.
    wholeRef.current = () => {
      walkRef.current?.(false)
      const shot = presetCamera(PRESETS[0])
      camera.position.copy(shot.pos)
      orbit.target.copy(shot.look)
      orbit.update()
    }

    // Scroll while walking with the mouse changes the lens, as the pinch does on touch.
    const onWheel = (e: WheelEvent): void => {
      if (!lock.isLocked) return
      zoomLens(camera, e.deltaY > 0 ? 1.06 : 1 / 1.06)
      e.preventDefault()
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // first-person frame for the AI panel: render synchronously, bounded JPEG
    captureRef.current = () => {
      renderer.render(scene, camera)
      const src = renderer.domElement
      const w = Math.min(1536, src.width)
      const h = Math.round((src.height / src.width) * w)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      if (!g) return null
      g.drawImage(src, 0, 0, w, h)
      return c.toDataURL('image/jpeg', 0.92)
    }

    // stand at a room's centre, eye height, looking the chosen way
    standRef.current = (roomId, dir) => {
      const room = model.roomById.get(roomId)
      if (!room) return
      const px = room.centroid.x * S
      const pz = room.centroid.y * S
      const d = dir === 'N' ? [0, -3] : dir === 'S' ? [0, 3] : dir === 'E' ? [3, 0] : [-3, 0]
      camera.position.set(px, 1.62, pz)
      orbit.target.set(px + d[0], 1.45, pz + d[1])
      if (touchWalk.enabled) {
        camera.lookAt(orbit.target)
        touchWalk.sync()
      } else orbit.update()
    }

    const lock = new PointerLockControls(camera, renderer.domElement)
    const touchWalk = createTouchWalk(camera, renderer.domElement, mount, { eye: 1.62, speed: 2.3 })
    touchRef.current = touchWalk
    walkRef.current = (on) => {
      if (touch) {
        if (on) { touchWalk.enable(); orbit.enabled = false; setTouchWalking(true); setHint(false) }
        else { touchWalk.disable(); orbit.enabled = true; setTouchWalking(false) }
      } else if (on) {
        if (!lock.isLocked) lock.lock()
      } else if (lock.isLocked) lock.unlock()
    }
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
      if (touch) walkRef.current?.(true)
      else if (!lock.isLocked) lock.lock()
    }
    renderer.domElement.addEventListener('dblclick', onClick)

    const clock = new THREE.Clock()
    let raf = 0
    const bb = model.envelopeBBox
    const animate = (): void => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      if (touchWalk.enabled) {
        touchWalk.update(dt)
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, (bb.minX - 2000) * S, (bb.maxX + 2000) * S)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, (bb.minY - 3500) * S, (bb.maxY + 2000) * S)
      } else if (lock.isLocked) {
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
      followCamera(sky, camera)
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
      captureRef.current = null
      standRef.current = null
      walkRef.current = null
      wholeRef.current = null
      touchRef.current = null
      touchWalk.dispose()
      undoPageZoom()
      renderer.domElement.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      renderer.domElement.removeEventListener('dblclick', onClick)
      if (lock.isLocked) lock.unlock()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [styleTick])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {!compact && <StylePanel />}
      {!compact && (
        <AiRenderPanel
          capture={() => captureRef.current?.() ?? null}
          defaultPrompt={FP_PROMPT}
        />
      )}
      {!compact && (
        <div
          style={{
            position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6,
            alignItems: 'center', background: 'rgba(250,248,244,0.95)',
            border: '1px solid #d5cdbb', borderRadius: 8, padding: '6px 8px', fontSize: 12,
          }}
        >
          <span>Stand in</span>
          <select value={standRoom} onChange={(e) => setStandRoom(e.target.value)}>
            {model.rooms
              .filter((r) => r.def.category !== 'void')
              .map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
          </select>
          <span>look</span>
          {(['N', 'E', 'S', 'W'] as const).map((d) => (
            <button key={d} onClick={() => standRef.current?.(standRoom, d)}>{d}</button>
          ))}
          <span style={{ width: 6 }} />
          <button onClick={() => wholeRef.current?.()} title="Pull right back to see the whole block">Whole house</button>
        </div>
      )}
      <button
        onClick={() => walkRef.current?.(!(walking || touchWalking))}
        aria-pressed={walking || touchWalking}
        style={{
          position: 'absolute', right: 12, bottom: 12, padding: '8px 14px', fontSize: 13,
          background: walking || touchWalking ? '#2b4a52' : 'rgba(250,248,244,0.95)',
          color: walking || touchWalking ? '#f3ecdd' : '#1e1c18',
          border: '1px solid #d5cdbb', borderRadius: 8, cursor: 'pointer', zIndex: 6,
        }}
      >
        {walking || touchWalking ? 'Exit walk' : 'Walk'}
      </button>
      <div
        style={{
          position: 'absolute', left: 12, bottom: 12, padding: '6px 12px',
          background: 'rgba(30,28,24,0.72)', color: '#f3ecdd', borderRadius: 6,
          fontSize: 12.5, pointerEvents: 'none', letterSpacing: 0.3,
        }}
      >
        {touchWalking
          ? 'Thumb stick to walk, push to the rim to hurry · drag to look · pinch to zoom the lens · Exit walk to release'
          : walking
          ? 'W A S D to walk · mouse to look · scroll to zoom the lens · Shift to hurry · Esc to release'
          : touch
          ? 'Drag to orbit · pinch to zoom · tap Walk to step inside'
          : 'Drag to orbit · scroll to zoom · double-click to enter and walk the home'}
      </div>
      {hint && !compact && (
        <div
          style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            padding: '7px 14px', background: 'rgba(30,28,24,0.72)', color: '#f3ecdd',
            borderRadius: 6, fontSize: 13, pointerEvents: 'none',
          }}
        >
          The home in its materials — oak, stone, grass and glass. {touch ? 'Tap Walk' : 'Double-click'} to step inside.
        </div>
      )}
    </div>
  )
}
