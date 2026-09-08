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
    idol: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.35, metalness: 0.02 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46a, emissiveIntensity: 1.6, roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.8 }),
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
    const lift = f.lift ?? 0
    if (/\bdesk\b/i.test(f.label) && f.kind === 'console') {
      // a desk is a top on gables, not a solid block: the top and a gable at
      // each end
      const top = polyPiece(f.poly, h - 40, h, M.timber, f.room)
      if (!top) return null
      const alongX = w >= d
      for (const sgn of [-1, 1]) {
        const gable = box(alongX ? 30 : w - 40, h - 40, alongX ? d - 40 : 30, M.timber)
        place(gable, cx + (alongX ? sgn * (w / 2 - 15) : 0), cy + (alongX ? 0 : sgn * (d / 2 - 15)), (h - 40) / 2)
        g.add(gable)
      }
      g.add(top)
      return g
    }
    if (lift > 0 && f.kind === 'shelves') {
      // wall cabinets: a carcass hung at `lift`, door joints read as shadow lines
      const body = polyPiece(f.poly, lift, lift + h, M.timber, f.room)
      if (body) g.add(body)
      const alongX = w >= d
      const n = Math.max(1, Math.round(Math.max(w, d) / 450))
      for (let i = 1; i < n; i++) {
        const line = box(alongX ? 4 : d + 2, h - 60, alongX ? w + 2 : 4, M.trunk)
        if (alongX) line.scale.set(1, 1, (d + 2) / (w + 2))
        else line.scale.set((w + 2) / (d + 2), 1, 1)
        place(line, cx + (alongX ? -w / 2 + (i * w) / n : 0), cy + (alongX ? 0 : -d / 2 + (i * d) / n), lift + h / 2)
        g.add(line)
      }
      return g
    }
    const body = polyPiece(f.poly, lift, lift + h, M.timber, f.room)
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
      if (/desk chair|swivel|task chair/i.test(f.label)) {
        // a revolving work chair: five-star base on castors, gas column, a
        // padded seat, a curved backrest on its spine, armrests either side.
        // It faces the desk - the nearest piece labelled desk.
        const desks = furniture.filter((o) => /\bdesk\b/i.test(o.label) && o.kind === 'console')
        let ang = f.face === 'N' ? Math.PI : f.face === 'S' ? 0 : f.face === 'E' ? -Math.PI / 2 : f.face === 'W' ? Math.PI / 2 : NaN
        if (Number.isNaN(ang)) {
          let best = Infinity
          let target = { x: cx, y: cy - 1 }
          for (const o of desks) {
            const ox = o.x + o.w / 2
            const oy = o.y + o.d / 2
            const dd = Math.hypot(ox - cx, oy - cy)
            if (dd < best) { best = dd; target = { x: ox, y: oy } }
          }
          ang = Math.atan2(target.x - cx, target.y - cy)
        }
        const seatH = 450
        // the chair turns to face its desk, so everything is sized to stay inside
        // the drawn circle at any angle: seat corners at 0.66 of the diameter
        const dia = Math.min(w, d)
        const seatW = dia * 0.66
        const reach = dia * 0.42
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2
          const arm = box(reach, 28, 40, M.metal, Math.sin(a) * (reach / 2), 40, Math.cos(a) * (reach / 2))
          arm.rotation.y = a - Math.PI / 2
          g.add(arm)
          const castor = new THREE.Mesh(new THREE.SphereGeometry(22 * S, 8, 6), M.gasket)
          castor.position.set(Math.sin(a) * reach * S, 22 * S, Math.cos(a) * reach * S)
          g.add(castor)
        }
        const column = new THREE.Mesh(new THREE.CylinderGeometry(24 * S, 30 * S, (seatH - 80) * S, 12), M.metal)
        column.position.y = ((seatH - 80) / 2 + 40) * S
        g.add(column)
        const chair = new THREE.Group()
        chair.add(box(seatW, 80, seatW, M.fabricDark, 0, seatH - 40, 0))
        // local +z faces the desk; the backrest sits on the far side
        chair.add(box(40, 260, 30, M.metal, 0, seatH + 100, -seatW / 2 + 20))
        const back = box(seatW - 40, 520, 45, M.fabricDark, 0, seatH + 330, -seatW / 2 + 10)
        back.rotation.x = -0.12
        chair.add(back)
        for (const sx of [-1, 1]) {
          chair.add(box(30, 230, 30, M.metal, sx * (seatW / 2 - 25), seatH + 100, 40))
          chair.add(box(60, 25, 240, M.gasket, sx * (seatW / 2 - 25), seatH + 225, 20))
        }
        chair.rotation.y = ang
        g.add(chair)
        place(g, cx, cy)
        return g
      }
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
      // a drawn screen is thin and SEE-THROUGH — rendering it as an opaque
      // slab once put a phantom wall in Karan's suite. Only a screen the sheet
      // labels with a dado gets one; the rest are tinted glass floor to head.
      const dado = /dado/i.test(f.label) ? Math.min(900, f.height * 0.42) : 0
      if (dado > 0) g.add(box(w, dado, d, M.timber, 0, dado / 2, 0))
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
      // An electronic kit built on the sheet's own pad circles: mesh-head pads on a
      // chrome rack, the kick pad upright on its pedal, hi-hat and cymbal pads on
      // stands and arms, the module on the rack, and the throne behind. Every part
      // sits on its drawn circle, so the kit nests into its corner exactly as drawn.
      const parts = f.parts ?? []
      if (!parts.length) {
        const m = box(w, 500, d, M.appliance, 0, 250, 0)
        place(m, cx, cy)
        return m
      }
      const pad = (px: number, py: number, r: number, h: number, thick = 60) => {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, thick * S, 24), M.gasket)
        shell.position.set(px * S, (h - thick / 2) * S, py * S)
        shell.castShadow = true
        g.add(shell)
        const rim = new THREE.Mesh(new THREE.TorusGeometry((r - 8) * S, 9 * S, 8, 28), M.steel)
        rim.rotation.x = Math.PI / 2
        rim.position.set(px * S, h * S, py * S)
        g.add(rim)
        const head = new THREE.Mesh(new THREE.CylinderGeometry((r - 16) * S, (r - 16) * S, 6 * S, 24), M.appliance)
        head.position.set(px * S, (h + 2) * S, py * S)
        g.add(head)
      }
      const post = (px: number, py: number, h0: number, h1: number, r = 11) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, (h1 - h0) * S, 10), M.steel)
        m.position.set(px * S, ((h0 + h1) / 2) * S, py * S)
        m.castShadow = true
        g.add(m)
      }
      const tube = (ax: number, ay: number, ah: number, bx: number, by: number, bh: number, r = 11) => {
        const a = new THREE.Vector3(ax * S, ah * S, ay * S)
        const b = new THREE.Vector3(bx * S, bh * S, by * S)
        const len = a.distanceTo(b)
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, len, 8), M.steel)
        m.position.copy(a).add(b).multiplyScalar(0.5)
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
        g.add(m)
      }
      const cymbal = (px: number, py: number, r: number, h: number, tilt: number) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, 8 * S, 28), M.gasket)
        c.rotation.z = tilt
        c.position.set(px * S, h * S, py * S)
        c.castShadow = true
        g.add(c)
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22 * S, r * 0.28 * S, 22 * S, 16), M.metal)
        bell.rotation.z = tilt
        bell.position.set(px * S, (h + 12) * S, py * S)
        g.add(bell)
      }
      const throne = parts.find((p) => p.role === 'throne')
      const toms = parts.filter((p) => p.role === 'tom')
      for (const p of parts) {
        switch (p.role) {
          case 'kick': {
            // the kick pad stands upright, its face to the drummer (toward the throne)
            const dir = throne ? Math.atan2(throne.x - p.x, throne.y - p.y) : 0
            const face = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.8 * S, p.r * 0.8 * S, 90 * S, 24), M.gasket)
            face.rotation.set(Math.PI / 2, 0, 0)
            face.rotation.y = dir
            face.position.set(p.x * S, (p.r * 0.8 + 40) * S, p.y * S)
            g.add(face)
            const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.8 * S, 10 * S, 8, 28), M.steel)
            ring.rotation.set(0, dir, 0)
            ring.position.copy(face.position)
            g.add(ring)
            g.add(box(p.r * 1.4, 40, p.r * 1.2, M.steel, p.x, 20, p.y))             // base plate
            g.add(box(120, 30, 300, M.metal, p.x + Math.sin(dir) * p.r * 0.9, 25, p.y + Math.cos(dir) * p.r * 0.9)) // pedal, on the drummer's side
            break
          }
          case 'snare':
            pad(p.x, p.y, p.r, 720, 90)
            post(p.x, p.y, 0, 660, 14)
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * Math.PI * 2
              tube(p.x, p.y, 380, p.x + Math.sin(a) * 240, p.y + Math.cos(a) * 240, 0, 8)
            }
            break
          case 'tom':
            pad(p.x, p.y, p.r, 800, 70)
            break
          case 'floortom':
            pad(p.x, p.y, p.r, 640, 90)
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * Math.PI * 2 + 0.5
              post(p.x + Math.sin(a) * (p.r - 30), p.y + Math.cos(a) * (p.r - 30), 0, 620, 8)
            }
            break
          case 'hihat':
            post(p.x, p.y, 0, 940, 12)
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * Math.PI * 2
              tube(p.x, p.y, 420, p.x + Math.sin(a) * 260, p.y + Math.cos(a) * 260, 0, 8)
            }
            cymbal(p.x, p.y, p.r, 900, 0)
            cymbal(p.x, p.y, p.r, 940, 0.06)
            g.add(box(110, 25, 280, M.metal, p.x, 20, p.y + 200))
            break
          case 'ride':
          case 'crash': {
            const h = p.role === 'ride' ? 1120 : 1260
            cymbal(p.x, p.y, p.r, h, p.role === 'ride' ? -0.18 : 0.22)
            // boom arm back to the nearest rack tom, or a stand of its own
            const near = toms.length ? toms.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b)) : null
            if (near) tube(near.x, near.y, 860, p.x, p.y, h - 20, 9)
            else post(p.x, p.y, 0, h - 20, 11)
            break
          }
          case 'throne':
            post(p.x, p.y, 0, 520, 20)
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * Math.PI * 2
              tube(p.x, p.y, 300, p.x + Math.sin(a) * 260, p.y + Math.cos(a) * 260, 0, 9)
            }
            {
              const seat = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.68 * S, p.r * 0.62 * S, 80 * S, 24), M.fabricDark)
              seat.position.set(p.x * S, 560 * S, p.y * S)
              seat.castShadow = true
              g.add(seat)
            }
            break
          default:
            pad(p.x, p.y, p.r, 760, 70)
        }
      }
      // the rack: a chrome bar across the toms on two posts, the module on its left leg
      if (toms.length >= 2) {
        const xs = toms.map((t) => t.x)
        const ys = toms.map((t) => t.y)
        const x0 = Math.min(...xs) - 120
        const x1 = Math.max(...xs) + 120
        const yb = ys.reduce((a, b) => a + b, 0) / ys.length + 230
        tube(x0, yb, 900, x1, yb, 900, 14)
        post(x0, yb, 0, 900, 14)
        post(x1, yb, 0, 900, 14)
        for (const t of toms) tube(t.x, yb, 900, t.x, t.y, 790, 9)
        const dir = throne ? Math.sign(throne.x - (x0 + x1) / 2) || 1 : 1
        const mx = dir < 0 ? x1 : x0
        const module = box(200, 130, 60, M.gasket, mx, 1000, yb - 40)
        module.rotation.x = -0.5
        g.add(module)
      }
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
 * Every hinged door in the house, as a leaf on its hinge: shut in the frame, or
 * swung open into the room it serves. Wood on a wall, tinted glass on the
 * gallery's glazed thresholds. The swing side follows the drawing where it is
 * given, and is checked against the rooms so no leaf opens into a wall.
 */
function hingedDoors(M: Mats, mode: 'open' | 'shut'): THREE.Group {
  const g = new THREE.Group()
  const ceiling = model.data.levels.ceiling
  for (const w of model.walls) {
    for (const op of w.openings) {
      if (op.type !== 'door') continue
      const hingeAt = op.hinge === 1 ? op.p2 : op.p1
      const other = op.hinge === 1 ? op.p1 : op.p2
      const len = Math.hypot(other.x - hingeAt.x, other.y - hingeAt.y)
      if (len < 300) continue
      const d = { x: (other.x - hingeAt.x) / len, y: (other.y - hingeAt.y) / len }
      const side = op.side ?? 1
      let n = { x: -d.y * side, y: d.x * side }
      // the open leaf must land inside a room, not in a wall or outside
      const probe = { x: hingeAt.x + n.x * len * 0.6 + d.x * 40, y: hingeAt.y + n.y * len * 0.6 + d.y * 40 }
      if (!model.rooms.some((r) => pointInPolygon(probe, r.polygon))) n = { x: -n.x, y: -n.y }
      const dir = mode === 'open' ? n : d
      const H = Math.min((op.head ?? model.data.levels.doorHead) - 20, ceiling - 40)
      const leafLen = len - 12
      const glazed = w.kind === 'threshold' || w.kind === 'glazing'
      const leaf = new THREE.Group()
      const body = box(leafLen, H, 40, glazed ? M.tintGlass : M.wallWood, leafLen / 2 + 6, H / 2, 0)
      leaf.add(body)
      if (!glazed) {
        // two recessed panels, read as thin dark lines
        for (const dy of [140, H / 2 - 20, H / 2 + 20, H - 140]) {
          leaf.add(box(leafLen - 180, 6, 44, M.trunk, leafLen / 2 + 6, dy, 0))
        }
        leaf.add(box(6, H - 280, 44, M.trunk, 96, H / 2, 0))
        leaf.add(box(6, H - 280, 44, M.trunk, leafLen - 84, H / 2, 0))
      } else {
        leaf.add(box(leafLen, 60, 46, M.metal, leafLen / 2 + 6, 30, 0))
        leaf.add(box(leafLen, 40, 46, M.metal, leafLen / 2 + 6, H - 20, 0))
      }
      // the lever handle near the free edge, both faces
      for (const sz of [-1, 1]) {
        const lever = box(120, 18, 18, M.metal, leafLen - 90, 1000, sz * 32)
        leaf.add(lever)
      }
      leaf.rotation.y = -Math.atan2(dir.y, dir.x)
      leaf.position.set(hingeAt.x * S, 0, hingeAt.y * S)
      g.add(leaf)
    }
  }
  return g
}

/**
 * The wall bed folded down: the queen comes out of its cabinet and lies over
 * the sofa, platform, mattress and pillows at the cabinet end. Drawn where a
 * cabinet labelled wall bed exists, toward the sofa in front of it.
 */
function wallBedDown(M: Mats): THREE.Group | null {
  const cab = furniture.find((f) => /wall bed cabinet/i.test(f.label))
  if (!cab) return null
  const sofa = furniture.find((f) => /in front of the wall bed/i.test(f.label))
  const cx = cab.x + cab.w / 2
  const cy = cab.y + cab.d / 2
  const sx = sofa ? sofa.x + sofa.w / 2 : cx + 1
  const sy = sofa ? sofa.y + sofa.d / 2 : cy
  const alongX = Math.abs(sx - cx) >= Math.abs(sy - cy)
  const sgn = alongX ? Math.sign(sx - cx) || 1 : Math.sign(sy - cy) || 1
  const L = 2000
  const W = alongX ? cab.d : cab.w
  const faceX = alongX ? (sgn > 0 ? cab.x + cab.w : cab.x) : cx
  const faceY = alongX ? cy : (sgn > 0 ? cab.y + cab.d : cab.y)
  const bx = alongX ? faceX + sgn * (L / 2) : cx
  const by = alongX ? cy : faceY + sgn * (L / 2)
  const g = new THREE.Group()
  const PLAT = 570
  const platform = box(alongX ? L : W - 40, 70, alongX ? W - 40 : L, M.timber)
  place(platform, bx, by, PLAT + 35)
  g.add(platform)
  const mattress = box(alongX ? L - 60 : W - 100, 170, alongX ? W - 100 : L - 60, M.duvet)
  place(mattress, bx, by, PLAT + 70 + 85)
  g.add(mattress)
  // pillows at the cabinet end
  for (const k of [-1, 1]) {
    const pw = Math.min(520, W / 2 - 60)
    const px = alongX ? faceX + sgn * 260 : cx + k * pw * 0.62
    const py = alongX ? cy + k * pw * 0.62 : faceY + sgn * 260
    const pillow = box(alongX ? 380 : pw, 130, alongX ? pw : 380, M.pillow)
    place(pillow, px, py, PLAT + 240 + 65)
    g.add(pillow)
  }
  // the cabinet's open face reads dark
  const mouth = box(alongX ? 20 : W - 60, 1900, alongX ? W - 60 : 20, M.gasket)
  place(mouth, alongX ? faceX + sgn * 10 : cx, alongX ? cy : faceY + sgn * 10, 950 + 150)
  g.add(mouth)
  return g
}

/**
 * Kitchen overheads: wall cabinets over every stretch of counter that backs on
 * to a solid wall, a warm light strip under each with point lights that
 * actually light the worktop, and a hood over the hob. Derived from the
 * counter outlines and the walls with their openings, so nothing hangs over
 * the serving hatch or the south window.
 */
function kitchenOverheads(M: Mats): THREE.Group {
  const g = new THREE.Group()
  const CAB_BOTTOM = 1450
  const CAB_TOP = 2200
  const CAB_DEPTH = 350
  const counters = fixtures.filter((f) => f.kind === 'counter' && f.poly && /kitchen/i.test(model.roomById.get(f.room)?.name ?? f.room))
  const segDist = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2)) : 0
    return { d: Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))), t }
  }
  for (const f of counters) {
    const poly = f.poly!
    const ccx = poly.reduce((t, q) => t + q.x, 0) / poly.length
    const ccy = poly.reduce((t, q) => t + q.y, 0) / poly.length
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 400) continue
      // a wall this edge lies along, within the wall's own half thickness
      const wall = model.walls.find((w) => {
        if (w.thickness < 60 || w.points.length < 2) return false
        for (let k = 0; k < w.points.length - 1; k++) {
          const da = segDist(a, w.points[k], w.points[k + 1])
          const db = segDist(b, w.points[k], w.points[k + 1])
          if (da.d <= w.thickness / 2 + 40 && db.d <= w.thickness / 2 + 40) return true
        }
        return false
      })
      if (!wall) continue
      // the run along the edge, minus any opening in that wall that rises into the cabinet zone
      const ux = (b.x - a.x) / len
      const uy = (b.y - a.y) / len
      const spans: Array<[number, number]> = [[0, len]]
      for (const op of wall.openings) {
        const head = op.head ?? model.data.levels.doorHead
        if (head <= CAB_BOTTOM) continue
        const s0 = (op.p1.x - a.x) * ux + (op.p1.y - a.y) * uy
        const s1 = (op.p2.x - a.x) * ux + (op.p2.y - a.y) * uy
        const lo = Math.min(s0, s1) - 60
        const hi = Math.max(s0, s1) + 60
        for (let k = spans.length - 1; k >= 0; k--) {
          const [p, q] = spans[k]
          if (hi <= p || lo >= q) continue
          spans.splice(k, 1)
          if (lo > p) spans.push([p, lo])
          if (hi < q) spans.push([hi, q])
        }
      }
      // inward: from the edge toward the counter's own centre
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      let nx = -uy
      let ny = ux
      if ((ccx - mx) * nx + (ccy - my) * ny < 0) { nx = -nx; ny = -ny }
      for (const [p, q] of spans) {
        if (q - p < 350) continue
        const L = q - p
        const sx = a.x + ux * ((p + q) / 2) + nx * (CAB_DEPTH / 2)
        const sy = a.y + uy * ((p + q) / 2) + ny * (CAB_DEPTH / 2)
        const ang = Math.atan2(ux, uy)
        const cab = new THREE.Group()
        cab.add(box(CAB_DEPTH, CAB_TOP - CAB_BOTTOM, L, M.timber, 0, (CAB_BOTTOM + CAB_TOP) / 2, 0))
        // door joints
        const n = Math.max(1, Math.round(L / 450))
        for (let k = 1; k < n; k++) {
          cab.add(box(CAB_DEPTH + 2, CAB_TOP - CAB_BOTTOM - 60, 4, M.trunk, 0, (CAB_BOTTOM + CAB_TOP) / 2, -L / 2 + (k * L) / n))
        }
        // the light strip under the front edge, and the light it throws
        const strip = new THREE.Mesh(new THREE.BoxGeometry(24 * S, 10 * S, (L - 60) * S), M.lamp)
        strip.position.set((CAB_DEPTH / 2 - 30) * S, (CAB_BOTTOM - 6) * S, 0)
        cab.add(strip)
        const lights = Math.max(1, Math.round(L / 900))
        for (let k = 0; k < lights; k++) {
          const pl = new THREE.PointLight(0xffc978, 0.9, 1.7, 1.6)
          pl.position.set((CAB_DEPTH / 2 + 60) * S, (CAB_BOTTOM - 40) * S, (-L / 2 + ((k + 0.5) * L) / lights) * S)
          cab.add(pl)
        }
        cab.rotation.y = ang
        cab.position.set(sx * S, 0, sy * S)
        g.add(cab)
      }
    }
  }
  // the hood over the hob: a stainless canopy and its chimney to the ceiling
  for (const hob of fixtures.filter((f) => f.kind === 'hob')) {
    const [w, d] = hob.size
    const canopy = box(w + 300, 60, d + 100, M.steel)
    place(canopy, hob.at.x, hob.at.y, 1580)
    g.add(canopy)
    const body = box(w + 300, 180, d + 100, M.steel)
    place(body, hob.at.x, hob.at.y, 1700)
    g.add(body)
    const chimney = box(300, model.data.levels.ceiling - 1790, 260, M.steel)
    place(chimney, hob.at.x, hob.at.y, (1790 + model.data.levels.ceiling) / 2)
    g.add(chimney)
    const pl = new THREE.PointLight(0xffe0b0, 0.8, 1.6, 1.6)
    pl.position.set(hob.at.x * S, 1.5, hob.at.y * S)
    g.add(pl)
  }
  return g
}

/**
 * The marble Shiva on the mandir: the larger corner unit in the parents' pod,
 * the wedge that follows the pod glazing. Seated on a lotus plinth on top of
 * the unit, a trishul standing beside him, a brass diya in front. Drawn only
 * where that unit exists, so no other home grows a shrine.
 */
function mandirIdol(M: Mats): THREE.Group | null {
  const units = furniture.filter((f) => /corner unit/i.test(f.label) && f.room === 'R-P-FAMILY')
  if (!units.length) return null
  const unit = units.reduce((a, b) => (a.w * a.d >= b.w * b.d ? a : b))
  const cx = unit.poly ? unit.poly.reduce((t, q) => t + q.x, 0) / unit.poly.length : unit.x + unit.w / 2
  const cy = unit.poly ? unit.poly.reduce((t, q) => t + q.y, 0) / unit.poly.length : unit.y + unit.d / 2
  const top = Math.min(unit.height, 900)
  const g = new THREE.Group()
  const at = (m: THREE.Mesh, dx: number, h: number, dz: number) => {
    m.position.set((cx + dx) * S, (top + h) * S, (cy + dz) * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const sph = (r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 16, 12), mat)
    m.scale.set(sx, sy, sz)
    return m
  }
  const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, seg = 16) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r0 * S, r1 * S, h * S, seg), mat)
  // lotus plinth: a stepped disc with a ring of petals
  at(cyl(190, 210, 30, M.idol, 24), 0, 15, 0)
  at(cyl(150, 175, 40, M.idol, 24), 0, 50, 0)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const p = sph(34, M.idol, 1, 0.5, 1.6)
    p.rotation.y = -a
    at(p, Math.cos(a) * 170, 62, Math.sin(a) * 170)
  }
  // seated figure: crossed legs, torso, shoulders, arms, head with the jata
  at(sph(150, M.idol, 1, 0.42, 0.85), 0, 100, 0)
  at(sph(95, M.idol, 0.95, 1.25, 0.72), 0, 235, -10)
  at(sph(60, M.idol, 1.9, 0.55, 0.8), 0, 335, -10)
  for (const sx of [-1, 1]) {
    const arm = cyl(22, 24, 190, M.idol, 10)
    arm.rotation.z = sx * 0.55
    arm.rotation.x = -0.45
    at(arm, sx * 105, 250, 35)
    at(sph(26, M.idol), sx * 60, 170, 105)          // hands resting on the knees
  }
  at(sph(58, M.idol, 0.9, 1, 0.9), 0, 425, -5)
  at(cyl(28, 46, 80, M.idol, 12), 0, 500, -5)       // the jata, piled up
  at(sph(22, M.idol), 0, 548, -5)
  // crescent by the jata, as a thin ring segment
  const moon = new THREE.Mesh(new THREE.TorusGeometry(22 * S, 5 * S, 8, 16, Math.PI), M.idol)
  moon.rotation.z = Math.PI * 0.15
  at(moon, 40, 520, -5)
  // the trishul, standing to the figure's right; the damru at its foot
  at(cyl(6, 6, 640, M.brass, 8), 205, 320, -40)
  at(cyl(5, 5, 130, M.brass, 8), 205, 650, -40)
  for (const sx of [-1, 1]) {
    const prong = cyl(4, 4, 120, M.brass, 8)
    at(prong, 205 + sx * 42, 650, -40)
    const bar = cyl(4, 4, 84, M.brass, 8)
    bar.rotation.z = Math.PI / 2
    at(bar, 205, 600, -40)
  }
  at(cyl(28, 20, 22, M.brass, 12), 250, 11, 70)
  at(cyl(20, 28, 22, M.brass, 12), 250, 33, 70)
  // a brass diya in front, with its flame
  at(cyl(30, 22, 14, M.brass, 14), -170, 7, 150)
  const flame = sph(9, M.brass, 1, 1.8, 1)
  at(flame, -170, 32, 150)
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
  // no ring of foliage around the rims: the blooms sit on the stone edge and the
  // creepers trail from it, as on the reference
  const wreath = (r: number, tube: number, y: number, blooms: number, strands: number, drop: number) => {
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
function curvedDoors(M: Mats, mode: 'open' | 'shut' = 'shut'): THREE.Group | null {
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
  // open: each leaf slides its own width along the arc, past its jamb
  const slide = mode === 'open' ? (a1 - a0) / 2 : 0
  for (const [s0, s1] of [[a0 - slide, mid - slide], [mid + slide, a1 + slide]] as const) {
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
    const a = mid + sgn * (ang(STILE / 2) + slide)
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

  // every door in both states; the Doors switch picks which set is visible
  for (const mode of ['open', 'shut'] as const) {
    const set = new THREE.Group()
    set.name = `doors-${mode}`
    const curved = curvedDoors(M, mode)
    if (curved) set.add(curved)
    set.add(podDoorGroup(M, mode))
    set.add(hingedDoors(M, mode))
    root.add(set)
  }
  const bedDown = wallBedDown(M)
  if (bedDown) {
    bedDown.name = 'wallbed-down'
    root.add(bedDown)
  }
  const idol = mandirIdol(M)
  if (idol) root.add(idol)
  root.add(kitchenOverheads(M))

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

  const { state: uiState, update: uiUpdate } = useStore()
  const sceneRef = useRef<THREE.Scene | null>(null)
  const doorsShut = uiState.show3d.doorsShut
  const wallBed = uiState.show3d.wallBedDown
  const shutRef = useRef(doorsShut)
  shutRef.current = doorsShut
  const bedRef = useRef(wallBed)
  bedRef.current = wallBed
  const applyToggles = (sc: THREE.Scene, shut: boolean, down: boolean): void => {
    sc.traverse((o) => {
      if (o.name === 'doors-open') o.visible = !shut
      if (o.name === 'doors-shut') o.visible = shut
      if (o.name === 'wallbed-down') o.visible = down
    })
  }
  useEffect(() => {
    if (sceneRef.current) applyToggles(sceneRef.current, doorsShut, wallBed)
  }, [doorsShut, wallBed])

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
    applyToggles(scene, shutRef.current, bedRef.current)
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
          <span style={{ width: 6 }} />
          <button
            onClick={() => uiUpdate((st) => ({ ...st, show3d: { ...st.show3d, doorsShut: !st.show3d.doorsShut } }))}
            title="Every door: hinged leaves, the pod sliders, the entry pair"
          >
            Doors: {doorsShut ? 'shut' : 'open'}
          </button>
          <button
            onClick={() => uiUpdate((st) => ({ ...st, show3d: { ...st.show3d, wallBedDown: !st.show3d.wallBedDown } }))}
            title="The grandmother's wall bed"
          >
            Wall bed: {wallBed ? 'down' : 'up'}
          </button>
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
