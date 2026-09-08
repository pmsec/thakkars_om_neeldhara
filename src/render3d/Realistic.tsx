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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { getModel } from '../geometry/model'
import { pointInPolygon } from '../geometry/vec'
import { barrelProfile, buildSolids } from '../geometry/solid'
import polygonClipping from 'polygon-clipping'
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
const pcx = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ??
  polygonClipping) as typeof polygonClipping

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
    // mown stripes, then blades over them
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(0, y, s, 64)
    }
    for (let k = 0; k < 14000; k++) {
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

/** Polished white marble: a warm white ground with grey veins wandering across it. */
function marbleTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#efece5'
    g.fillRect(0, 0, s, s)
    // a faint cloudy ground
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % s, y = (i * 173) % s, r = 40 + (i * 31) % 90
      const grad = g.createRadialGradient(x, y, 2, x, y, r)
      grad.addColorStop(0, i % 3 ? 'rgba(200,196,188,0.18)' : 'rgba(255,255,255,0.22)')
      grad.addColorStop(1, 'rgba(230,226,218,0)')
      g.fillStyle = grad
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // the veins: a few long wandering strokes, each with a paler halo
    let seed = 7
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    for (let v = 0; v < 9; v++) {
      let x = rnd() * s, y = rnd() * s
      let ang = rnd() * Math.PI * 2
      const pts: Array<[number, number]> = [[x, y]]
      for (let k = 0; k < 40; k++) {
        ang += (rnd() - 0.5) * 0.9
        x += Math.cos(ang) * 14; y += Math.sin(ang) * 14
        pts.push([x, y])
      }
      for (const [w, col] of [[7, 'rgba(150,146,140,0.10)'], [2.2, 'rgba(110,108,104,0.55)'], [0.8, 'rgba(70,70,72,0.7)']] as const) {
        g.strokeStyle = col
        g.lineWidth = w
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(pts[0][0], pts[0][1])
        for (const [px, py] of pts) g.lineTo(px, py)
        g.stroke()
      }
    }
  }, 1.1)
}

/** Walnut: a deep brown with a fine, slightly wandering grain and a soft figure. */
function walnutTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#4e3322'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 12; i++) {
      const x = (i * 71) % s, y = (i * 113) % s
      const grad = g.createRadialGradient(x, y, 4, x, y, 90)
      grad.addColorStop(0, 'rgba(120,80,50,0.18)')
      grad.addColorStop(1, 'rgba(60,38,22,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, s, s)
    }
    for (let k = 0; k < 46; k++) {
      const y = (k * 11) % s
      g.strokeStyle = `rgba(28, 16, 8, ${0.14 + (k % 5) / 24})`
      g.lineWidth = 1 + (k % 3) * 0.4
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(s * 0.3, y + 4, s * 0.7, y - 4, s, y + 1)
      g.stroke()
    }
  }, 0.9)
}

function weaveTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#e9e1cf'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 4) {
      for (let x = 0; x < s; x += 4) {
        const k = ((x + y) / 4) % 2
        g.fillStyle = k ? 'rgba(120,100,70,0.16)' : 'rgba(255,255,255,0.10)'
        g.fillRect(x, y, 3, 3)
      }
    }
  }, 0.12)
}

function quiltTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#d9cbb3'
    g.fillRect(0, 0, s, s)
    // tufted diamonds: soft shading toward each button
    for (let y = 0; y < s; y += 64) {
      for (let x = 0; x < s; x += 64) {
        const grad = g.createRadialGradient(x + 32, y + 32, 4, x + 32, y + 32, 40)
        grad.addColorStop(0, 'rgba(90,70,45,0.45)')
        grad.addColorStop(0.35, 'rgba(255,255,255,0.10)')
        grad.addColorStop(1, 'rgba(90,70,45,0.18)')
        g.fillStyle = grad
        g.fillRect(x, y, 64, 64)
        g.fillStyle = '#8a7250'
        g.beginPath()
        g.arc(x + 32, y + 32, 3.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  }, 0.5)
}

function rugTexture(): THREE.CanvasTexture {
  // a palace carpet: a burgundy field, a gold-and-ivory guard border, a
  // central medallion with lobed petals and quarter medallions in the corners
  return canvasTexture(1024, (g, s) => {
    g.fillStyle = '#5a4030'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = `rgba(${120 + (k % 40)}, ${90 + (k % 20)}, ${64 + (k % 24)}, 0.22)`
      g.fillRect((k * 31) % s, (k * 87) % s, 2, 2)
    }
    const band = (inset: number, w: number, col: string) => {
      g.strokeStyle = col
      g.lineWidth = w
      g.strokeRect(inset, inset, s - inset * 2, s - inset * 2)
    }
    band(18, 10, '#b58d4a')
    band(40, 26, '#e9dcc2')
    band(70, 6, '#b58d4a')
    // vine motif along the ivory band
    g.strokeStyle = '#8a5a2a'
    g.lineWidth = 3
    for (let t = 52; t < s - 52; t += 32) {
      for (const [x, y, dx, dy] of [[t, 40, 1, 0], [t, s - 40, 1, 0], [40, t, 0, 1], [s - 40, t, 0, 1]] as const) {
        g.beginPath()
        g.arc(x + dx * 8, y + dy * 8, 9, 0, Math.PI * 2)
        g.stroke()
      }
    }
    const medallion = (cx: number, cy: number, r: number) => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        g.fillStyle = i % 2 ? '#b58d4a' : '#e9dcc2'
        g.beginPath()
        g.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.36, r * 0.14, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#4a5a3e'
      g.beginPath(); g.arc(cx, cy, r * 0.42, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#b58d4a'
      g.beginPath(); g.arc(cx, cy, r * 0.28, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#5a4030'
      g.beginPath(); g.arc(cx, cy, r * 0.12, 0, Math.PI * 2); g.fill()
    }
    medallion(s / 2, s / 2, s * 0.24)
    for (const [cx, cy] of [[76, 76], [s - 76, 76], [76, s - 76], [s - 76, s - 76]] as const) medallion(cx, cy, s * 0.11)
    // a scatter of small gold sprigs across the field
    g.fillStyle = 'rgba(181,141,74,0.7)'
    for (let i = 0; i < 40; i++) {
      const x = 130 + ((i * 197) % (s - 260)), y = 130 + ((i * 311) % (s - 260))
      if (Math.hypot(x - s / 2, y - s / 2) < s * 0.27) continue
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill()
      g.fillRect(x - 1, y - 14, 2, 28); g.fillRect(x - 14, y - 1, 28, 2)
    }
  }, 3.0)
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
  const walnut = walnutTexture()
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
    // the upholstery: crushed velvets with a silk sheen, the way a palace
    // seat catches the light - burgundy for the seats, a deeper wine for the
    // backs and arms, bottle green for the cushions on the beds
    fabric: new THREE.MeshPhysicalMaterial({ map: weaveTexture(), color: 0x8a7462, roughness: 0.66, sheen: 0.8, sheenColor: new THREE.Color(0xd9c3a8), sheenRoughness: 0.6 }),
    fabricDark: new THREE.MeshPhysicalMaterial({ map: weaveTexture(), color: 0x6a5546, roughness: 0.66, sheen: 0.8, sheenColor: new THREE.Color(0xc9ae90), sheenRoughness: 0.6 }),
    velvetGreen: new THREE.MeshPhysicalMaterial({ map: weaveTexture(), color: 0x4a5a3e, roughness: 0.62, sheen: 0.9, sheenColor: new THREE.Color(0xb8c49a), sheenRoughness: 0.5 }),
    quilt: new THREE.MeshPhysicalMaterial({ map: quiltTexture(), color: 0xe4d6bd, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xf3e2b8), sheenRoughness: 0.4 }),
    throw: new THREE.MeshPhysicalMaterial({ color: 0xa8843f, roughness: 0.5, sheen: 0.9, sheenColor: new THREE.Color(0xf0d9a0), sheenRoughness: 0.4 }),
    bin: new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.5, metalness: 0.5 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3b2b1c, roughness: 1.0 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xc9d6dd, roughness: 0.05, metalness: 0.9 }),
    stoneTop: new THREE.MeshStandardMaterial({ color: 0xd9d4cb, roughness: 0.3 }),
    hob: new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.15, metalness: 0.2 }),
    // bedding and seat cushions in ivory silk; bolsters in green velvet
    duvet: new THREE.MeshPhysicalMaterial({ color: 0xf6efe0, roughness: 0.5, sheen: 0.9, sheenColor: new THREE.Color(0xfff2cc), sheenRoughness: 0.4 }),
    pillow: new THREE.MeshPhysicalMaterial({ map: weaveTexture(), color: 0x4a5a3e, roughness: 0.62, sheen: 0.9, sheenColor: new THREE.Color(0xb8c49a), sheenRoughness: 0.5 }),
    timber: new THREE.MeshStandardMaterial({ map: walnut, roughness: 0.42 }),
    walnut: new THREE.MeshStandardMaterial({ map: walnut, roughness: 0.42 }),
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
    // the fountain: polished veined marble under a clear coat, and still water
    // that mirrors the sky - both take the environment map once the renderer exists
    fountainMarble: new THREE.MeshPhysicalMaterial({
      map: marbleTexture(), color: 0xffffff, roughness: 0.16, metalness: 0.0,
      clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.9,
    }),
    fountainWater: new THREE.MeshPhysicalMaterial({
      color: 0x9fcfe0, transparent: true, opacity: 0.72, roughness: 0.03, metalness: 0.05,
      clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 1.4, side: THREE.DoubleSide,
    }),
    fountainJet: new THREE.MeshPhysicalMaterial({
      color: 0xd8f0f8, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.0,
    }),
    poolLamp: new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffc352, emissiveIntensity: 2.4, roughness: 0.3 }),
    // carved stone of the fountain: warmer and duller than the polished marble tops
    carved: new THREE.MeshStandardMaterial({ color: 0xd6cdbb, roughness: 0.7 }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xeef2f2, roughness: 0.18, metalness: 0.05 }),
    petal: new THREE.MeshStandardMaterial({ color: 0xd4679a, roughness: 0.8 }),
    petalWhite: new THREE.MeshStandardMaterial({ color: 0xf6eff2, roughness: 0.8 }),
    appliance: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.4, metalness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc6c9cc, roughness: 0.32, metalness: 0.7 }),
    idol: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.35, metalness: 0.02 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xf0d09a, emissive: 0xffb45a, emissiveIntensity: 1.1, roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.8 }),
    gasket: new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.6 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.35, metalness: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe4e7ea, roughness: 0.12, metalness: 0.95 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.22 }),
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

/**
 * Door fronts on a joinery box: shadow lines between doors and a bar handle on
 * each, on the face toward the room. A headboard gets the quilt instead.
 */
function doorFronts(g: THREE.Group, f: FurnitureItem, M: Mats, base: number, top: number, absolute = false): void {
  const w = f.w
  const d = f.d
  const cx = f.x + w / 2
  const cy = f.y + d / 2
  const room = model.roomById.get(f.room)
  const dx = (room?.centroid.x ?? cx) - cx
  const dy = (room?.centroid.y ?? cy) - cy
  const alongX = Math.abs(dx) >= Math.abs(dy)   // the face is on an x-side
  const sgn = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1
  const faceLen = alongX ? d : w
  const ox = absolute ? cx : 0
  const oy = absolute ? cy : 0
  const H = top - base
  if (/headboard/i.test(f.label)) {
    const q = box(alongX ? 30 : faceLen - 20, H - 40, alongX ? faceLen - 20 : 30, M.quilt)
    q.position.set((ox + (alongX ? sgn * (w / 2 + 8) : 0)) * S, (base + H / 2) * S, (oy + (alongX ? 0 : sgn * (d / 2 + 8))) * S)
    g.add(q)
    return
  }
  const n = Math.max(1, Math.round(faceLen / 500))
  for (let k = 1; k < n; k++) {
    const t = -faceLen / 2 + (k * faceLen) / n
    const line = box(alongX ? 6 : 4, H - 40, alongX ? 4 : 6, M.trunk)
    line.position.set((ox + (alongX ? sgn * (w / 2 + 2) : t)) * S, (base + H / 2) * S, (oy + (alongX ? t : sgn * (d / 2 + 2))) * S)
    g.add(line)
  }
  for (let k = 0; k < n; k++) {
    const t = -faceLen / 2 + ((k + 0.5) * faceLen) / n + (k % 2 ? -1 : 1) * Math.min(120, faceLen / n / 2 - 40)
    const handle = box(alongX ? 12 : 14, Math.min(220, H * 0.3), alongX ? 14 : 12, M.metal)
    handle.position.set((ox + (alongX ? sgn * (w / 2 + 14) : t)) * S, (base + Math.min(H * 0.55, 1000)) * S, (oy + (alongX ? t : sgn * (d / 2 + 14))) * S)
    g.add(handle)
  }
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

  // Karan's pod corner unit is the coffee bar: the sheet's pantry run, built as one
  if (f.kind === 'console' && /corner unit/i.test(f.label) && /DEN/i.test(f.room) && f.poly && w > 1000) {
    return coffeeBar(M, f)
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
    if (f.kind === 'console' && /^console$|side table|dresser|work console/i.test(f.label) && !(/^console$/i.test(f.label) && /GREAT/i.test(f.room))) {
      // an open piece: the drawn top on four legs with a low shelf, not a block
      const top = polyPiece(f.poly, h - 40, h, M.timber, f.room)
      if (!top) return null
      g.add(top)
      const cxp = f.x + w / 2
      const cyp = f.y + d / 2
      const shelfPoly = f.poly.map((q) => ({ x: cxp + (q.x - cxp) * 0.86, y: cyp + (q.y - cyp) * 0.8 }))
      const shelf = polyPiece(shelfPoly, 150, 180, M.timber, f.room)
      if (shelf) g.add(shelf)
      const inX = Math.min(120, w * 0.18)
      const inZ = Math.min(120, d * 0.18)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = box(40, h - 40, 40, M.trunk)
        place(leg, cxp + sx * (w / 2 - inX), cyp + sz * (d / 2 - inZ), (h - 40) / 2)
        g.add(leg)
      }
      if (/side table/i.test(f.label) && /SUITE/i.test(f.room)) {
        // a bedside lamp: turned base, a linen drum shade, a warm light in it
        const base = new THREE.Mesh(new THREE.CylinderGeometry(50 * S, 70 * S, 260 * S, 12), M.brass)
        base.position.set(cxp * S, (h + 130) * S, cyp * S)
        g.add(base)
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(120 * S, 140 * S, 200 * S, 16, 1, true), M.fabric)
        ;(shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
        shade.position.set(cxp * S, (h + 360) * S, cyp * S)
        g.add(shade)
        const bulb = new THREE.PointLight(0xffd9a8, 0.55, 2.4, 1.7)
        bulb.position.set(cxp * S, (h + 330) * S, cyp * S)
        g.add(bulb)
      }
      if (/dresser/i.test(f.label)) {
        // the dresser's mirror standing on it
        const mir = box(w * 0.6, 520, 20, M.mirror)
        place(mir, cxp, cyp + (d / 2 - 40), h + 300)
        g.add(mir)
        const frame = box(w * 0.6 + 40, 560, 12, M.trunk)
        place(frame, cxp, cyp + (d / 2 - 30), h + 300)
        g.add(frame)
      }
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
    if (f.kind === 'wardrobe' || f.kind === 'shelves') {
      const body = polyPiece(f.poly, lift, lift + h, M.timber, f.room)
      if (body) g.add(body)
      if (/hatch/i.test(f.label)) {
        // the serving hatch's open shelves: two boards and a few things on them
        const alongX = w >= d
        for (const sh of [500, 950]) {
          g.add(Object.assign(box(alongX ? w - 40 : d - 60, 30, alongX ? d - 60 : w - 40, M.timber), {}))
          const last = g.children[g.children.length - 1]
          last.position.set(cx * S, (lift + sh) * S, cy * S)
        }
        for (const [k, hgt] of [[0.25, 120], [0.5, 180], [0.75, 90]] as const) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(45 * S, 45 * S, hgt * S, 10), k > 0.6 ? M.carved : M.brass)
          jar.position.set((cx + (alongX ? (k - 0.5) * w : 0)) * S, (lift + 515 + hgt / 2) * S, (cy + (alongX ? 0 : (k - 0.5) * d)) * S)
          g.add(jar)
        }
      } else {
        doorFronts(g, f, M, lift, lift + h, true)
      }
      return g
    }
    if (f.kind === 'console' && /arch console/i.test(f.label)) {
      // the curved cabinet under the bath sweep: joinery body, marble top, doors
      const body = polyPiece(f.poly, 0, h - 40, M.timber, f.room)
      const top = polyPiece(f.poly, h - 40, h, M.marble, f.room)
      if (body) g.add(body)
      if (top) g.add(top)
      doorFronts(g, f, M, 100, h - 60, true)
      return g
    }
    if (f.kind === 'console' && /corner unit/i.test(f.label)) {
      const body = polyPiece(f.poly, 0, h, M.timber, f.room)
      if (body) g.add(body)
      const mandir = /P-FAMILY|family/i.test(f.room) && w * d > 800000
      if (mandir) {
        // the mandir: a carved front read as a lattice of fine lines, and a lamp
        // niche glowing under the shelf
        const lat = new THREE.Group()
        const span = Math.min(w, d) * 0.55
        for (let k = 0; k < 6; k++) lat.add(box(4, h - 160, 4, M.trunk, 0, h / 2, -span / 2 + (k * span) / 5))
        for (let k = 0; k < 5; k++) lat.add(box(4, 4, span, M.brass, 0, 120 + k * ((h - 240) / 4), 0))
        lat.position.set((cx - w * 0.18) * S, 0, cy * S)
        g.add(lat)
        const niche = new THREE.PointLight(0xffc98a, 0.5, 1.6, 1.6)
        niche.position.set((cx) * S, (h - 120) * S, (cy) * S)
        g.add(niche)
      } else {
        doorFronts(g, f, M, 100, h - 60, true)
      }
      return g
    }
    if (f.kind === 'console' && /^console$/i.test(f.label) && /GREAT/i.test(f.room)) {
      // the great room's credenza: a joinery body with doors and a stone top
      const body = polyPiece(f.poly, 120, h - 30, M.timber, f.room)
      const top = polyPiece(f.poly, h - 30, h, M.stoneTop, f.room)
      if (body) g.add(body)
      if (top) g.add(top)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = box(40, 120, 40, M.trunk)
        place(leg, cx + sx * (w / 2 - 60), cy + sz * (d / 2 - 60), 60)
        g.add(leg)
      }
      doorFronts(g, f, M, 120, h - 30, true)
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
      const bed = f.poly ? polyPiece(f.poly, 0, 300, M.pot, f.room) : box(w, 300, d, M.pot)
      if (bed && !f.poly) place(bed, cx, cy, 150)
      if (/parapet/i.test(f.label)) {
        // the planted strip inside a parapet: the clipped hedge, tall enough to
        // hide the city from inside (see hedge.ts)
        return hedgeGroup(f, { bed: M.pot, leaf: M.leaf, leafDark: M.leafDark }, bed)
      }
      if (/sofa/i.test(f.label)) {
        // the great room's planter box: joinery to match the sofa, eased corners as
        // drawn, a soil bed 50 below its rim. The tree in it is its own piece.
        const H = f.height || 450
        const boxBody = f.poly ? polyPiece(f.poly, 0, H, M.timber, f.room) : box(w, H, d, M.timber)
        if (boxBody && !f.poly) place(boxBody, cx, cy, H / 2)
        if (boxBody) g.add(boxBody)
        const inner = f.poly
          ? f.poly.map((q) => ({ x: cx + (q.x - cx) * 0.9, y: cy + (q.y - cy) * 0.9 }))
          : null
        const soil = inner ? polyPiece(inner, H - 50, H + 2, M.soil, f.room) : box(w * 0.9, 52, d * 0.9, M.soil)
        if (soil && !inner) place(soil, cx, cy, H - 24)
        if (soil) g.add(soil)
        // a scatter of moss and pebbles on the soil
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.4
          const rr = Math.min(w, d) * (0.18 + 0.14 * ((i * 37) % 5) / 5)
          const peb = new THREE.Mesh(new THREE.SphereGeometry((28 + (i % 3) * 10) * S, 7, 5), i % 2 ? M.leaf : M.carved)
          peb.scale.set(1, 0.5, 1)
          peb.position.set((cx + Math.cos(a) * rr) * S, (H + 6) * S, (cy + Math.sin(a) * rr) * S)
          g.add(peb)
        }
        return g
      }
      // an indoor planter: a stone bed with a row of low shrubs in it
      const stoneBed = f.poly ? polyPiece(f.poly, 0, 300, M.carved, f.room) : box(w, 300, d, M.carved)
      if (stoneBed && !f.poly) place(stoneBed, cx, cy, 150)
      if (stoneBed) g.add(stoneBed)
      const long = Math.max(w, d)
      const n = Math.max(2, Math.round(long / 420))
      const r = Math.min(230, Math.min(w, d) / 2 - 30)
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const sx = w >= d ? f.x + t * w : cx
        const sy = w >= d ? cy : f.y + t * d
        const sh = new THREE.Mesh(new THREE.SphereGeometry(r * S, 9, 7), i % 2 ? M.leaf : M.leafDark)
        sh.scale.set(1, 0.8, 1)
        sh.position.set(sx * S, (300 + r * 0.55) * S, sy * S)
        sh.castShadow = true
        g.add(sh)
      }
      return g
    }
    case 'sofa': {
      if (/^chair$/i.test(f.label)) {
        // a hall chair: a timber frame, a padded seat and a slatted back
        const seat = Math.min(w, d) - 40
        g.add(box(seat, 40, seat, M.timber, 0, 420, 0))
        g.add(box(seat - 30, 50, seat - 30, M.fabricDark, 0, 465, 0))
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(16 * S, 22 * S, 420 * S, 8), M.trunk)
          leg.position.set(lx * (seat / 2 - 30) * S, 210 * S, lz * (seat / 2 - 30) * S)
          g.add(leg)
        }
        const bx = f.face === 'E' ? -1 : f.face === 'W' ? 1 : 0
        const bz = f.face === 'S' ? -1 : f.face === 'N' ? 1 : bx ? 0 : 1
        for (let k = 0; k < 4; k++) {
          const t = (k - 1.5) / 3.5
          g.add(box(bx ? 24 : 24, 460, bx ? 24 : 24, M.trunk,
            bx ? bx * (w / 2 - 32) : t * seat, 420 + 230, bz ? bz * (d / 2 - 32) : t * seat))
        }
        g.add(box(bx ? 30 : seat, 50, bx ? seat : 30, M.timber, bx * (w / 2 - 32), 420 + 460 - 25, bz * (d / 2 - 32)))
        place(g, cx, cy)
        return g
      }
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
      // an upholstered recliner: a plinth, a seat cushion, arms along the sides
      // and the padded back on the far side, all within the drawn seat
      const ewA = f.face === 'E' || f.face === 'W'
      g.add(f.poly ? basePrism(f.poly, 0, 300, M.fabric)
        : box(w, 300, d, M.fabric, 0, 150, 0))
      g.add(box(ewA ? w * 0.7 : w - 240, 110, ewA ? d - 240 : d * 0.7, M.fabricDark,
        f.face === 'E' ? w * 0.12 : f.face === 'W' ? -w * 0.12 : 0, 355,
        f.face === 'S' ? d * 0.12 : f.face === 'N' ? -d * 0.12 : 0))
      if (ewA) {
        g.add(box(w * 0.9, 560, 110, M.fabric, 0, 280, -d / 2 + 55))
        g.add(box(w * 0.9, 560, 110, M.fabric, 0, 280, d / 2 - 55))
      } else {
        g.add(box(110, 560, d * 0.9, M.fabric, -w / 2 + 55, 280, 0))
        g.add(box(110, 560, d * 0.9, M.fabric, w / 2 - 55, 280, 0))
      }
      // inclined back toward the face direction — the back's long side runs
      // ACROSS the face axis (by face, not by aspect: a deep W-facing chair
      // still reclines along x)
      const ewL = f.face === 'E' || f.face === 'W'
      const backLen = (ewL ? w : d) * 0.45
      const bk = new THREE.Mesh(
        new THREE.BoxGeometry((ewL ? backLen : w * 0.7) * S, 150 * S, (ewL ? d * 0.7 : backLen) * S),
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
      // a folded throw across the foot: the end away from the pillows
      {
        const ewT = f.face === 'E' || f.face === 'W'
        const tw = (ewT ? 380 : w - 200)
        const td = (ewT ? d - 200 : 380)
        const tx = f.face === 'E' ? w / 2 - 330 : f.face === 'W' ? -(w / 2 - 330) : 0
        const tz = f.face === 'S' ? d / 2 - 330 : f.face === 'N' ? -(d / 2 - 330) : 0
        if (f.face) g.add(box(tw, 70, td, M.throw, tx, 470 + 35, tz))
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
      const rocking = /rocking/i.test(f.label)
      const seatBase = rocking ? 140 : 0
      if (rocking) {
        // runners: two flattened rings under the chair, along the face axis
        const ewR = f.face === 'E' || f.face === 'W'
        for (const sgn of [-1, 1]) {
          // a rocker: a slim rail along the face axis, tipped so its ends lift
          const len = (ewR ? w : d) * 0.78
          const runner = box(ewR ? len : 30, 40, ewR ? 30 : len, M.trunk,
            ewR ? 0 : sgn * (w / 2 - 80), 40, ewR ? sgn * (d / 2 - 80) : 0)
          runner.rotation.set(ewR ? 0 : 0.14, 0, ewR ? -0.14 : 0)
          g.add(runner)
        }
      } else {
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 24 * S, 160 * S, 8), M.trunk)
          leg.position.set(lx * (w / 2 - 70) * S, 80 * S, lz * (d / 2 - 70) * S)
          g.add(leg)
        }
      }
      g.add(f.poly ? basePrism(f.poly, 160, 400, M.fabric)
        : box(w, 240, d, M.fabric, 0, 280, 0))
      g.add(box(w - 300, 80, d - 300, M.fabricDark, 0, 440, 0))
      void seatBase
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
        // the top with a turned edge: the full outline, and a thinner lip under it
        const top = polyPiece(f.poly, 712, 750, M.timber, f.room)
        if (top) g.add(top)
        const lipPoly = f.poly.map((q) => ({ x: cx + (q.x - cx) * 0.94, y: cy + (q.y - cy) * 0.94 }))
        const lip = polyPiece(lipPoly, 690, 712, M.trunk, f.room)
        if (lip) g.add(lip)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(34 * S, 42 * S, 690 * S, 10), M.trunk)
          leg.position.set((cx + sx * w * 0.26) * S, 345 * S, (cy + sz * d * 0.3) * S)
          leg.castShadow = true
          g.add(leg)
        }
        // over the table: a long walnut slat pendant on two cords, a linen diffuser
        // between the slats and a dim amber light in it
        {
          const ceiling = model.data.levels.ceiling
          const L = Math.min(w, d) >= w ? Math.max(w, d) * 0.6 : w * 0.6
          const alongX = w >= d
          for (const e of [-1, 1]) {
            const cord = new THREE.Mesh(new THREE.CylinderGeometry(2.5 * S, 2.5 * S, (ceiling - 1950) * S, 6), M.gasket)
            cord.position.set((cx + (alongX ? e * L * 0.35 : 0)) * S, ((ceiling + 1950) / 2) * S, (cy + (alongX ? 0 : e * L * 0.35)) * S)
            g.add(cord)
          }
          const n = Math.max(6, Math.round(L / 90))
          for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n - 0.5
            g.add(box(alongX ? 18 : 220, 110, alongX ? 220 : 18, M.walnut, cx + (alongX ? t * L : 0), 1895, cy + (alongX ? 0 : t * L)))
          }
          g.add(box(alongX ? L : 24, 60, alongX ? 24 : L, M.walnut, cx, 1955, cy))       // the spine
          g.add(box(alongX ? L - 30 : 170, 70, alongX ? 170 : L - 30, M.lamp, cx, 1890, cy))  // the linen diffuser, lit
          const bulb = new THREE.PointLight(0xffc27a, 0.9, 4.0, 1.6)
          bulb.position.set(cx * S, 1840 * S, cy * S)
          g.add(bulb)
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
      g.add(box(seat, 40, seat, M.timber, 0, 430, 0))
      g.add(box(seat - 40, 50, seat - 40, M.fabricDark, 0, 475, 0))
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(16 * S, 22 * S, 430 * S, 8), M.trunk)
        leg.position.set(lx * (seat / 2 - 35) * S, 215 * S, lz * (seat / 2 - 35) * S)
        leg.castShadow = true
        g.add(leg)
      }
      const bh = Math.min(f.height, 900)
      // a shaped back: two uprights and a curved splat between, leaning a little
      const backGroup = new THREE.Group()
      for (const sx of [-1, 1]) backGroup.add(box(30, bh - 430, 30, M.trunk, sx * (seat / 2 - 15), (bh - 430) / 2, 0))
      const splat = box(seat - 60, (bh - 430) * 0.55, 22, M.timber, 0, (bh - 430) * 0.62, 0)
      backGroup.add(splat)
      backGroup.add(box(seat, 34, 34, M.trunk, 0, bh - 430 - 17, 0))
      backGroup.position.y = 430 * S
      const dir = f.face === 'E' ? -1 : f.face === 'W' ? 1 : 0
      const dirZ = f.face === 'S' ? -1 : f.face === 'N' ? 1 : f.face ? 0 : 1
      backGroup.position.x = dir * (w / 2 - 45) * S
      backGroup.position.z = dirZ * (d / 2 - 45) * S
      backGroup.rotation.y = dir ? Math.PI / 2 : 0
      backGroup.rotation.x = dir ? 0 : dirZ * 0.05
      backGroup.rotation.z = dir ? -dir * 0.05 : 0
      g.add(backGroup)
      place(g, cx, cy)
      return g
    }
    case 'table':
    case 'console':
    case 'bench': {
      const h = Math.min(f.height, 900)
      if (f.kind === 'table' && Math.abs(w - d) < 120 && w < 800) {
        // a round teak side table on three splayed legs
        const r = Math.min(w, d) / 2 - 8
        const top = new THREE.Mesh(new THREE.CylinderGeometry(r * S, (r - 12) * S, 36 * S, 28), M.timber)
        top.position.y = (h - 18) * S
        top.castShadow = true
        g.add(top)
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.4
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(16 * S, 20 * S, (h - 36) * S, 8), M.trunk)
          leg.position.set(Math.cos(a) * r * 0.62 * S, ((h - 36) / 2) * S, Math.sin(a) * r * 0.62 * S)
          leg.rotation.z = -Math.cos(a) * 0.08
          leg.rotation.x = Math.sin(a) * 0.08
          leg.castShadow = true
          g.add(leg)
        }
        place(g, cx, cy)
        return g
      }
      if (f.kind === 'bench' && /jhoola|swing/i.test(f.label)) {
        // the jhoola: two A-frames, a top beam, the seat hung on four chains
        const H = Math.min(f.height, 1900)
        const alongX = w >= d
        const L = alongX ? w : d
        const D = alongX ? d : w
        // each A-frame: two legs from the feet at the footprint's edge up to meet
        // under the beam, so the frame never leans past the drawn outline
        const spread = D / 2 - 40
        const tilt = Math.atan(spread / H)
        const legLen = Math.hypot(spread, H)
        for (const e of [-1, 1]) {
          for (const k of [-1, 1]) {
            const leg = box(40, legLen, 40, M.timber)
            leg.position.set((alongX ? e * (L / 2 - 30) : (k * spread) / 2) * S, (H / 2) * S, (alongX ? (k * spread) / 2 : e * (L / 2 - 30)) * S)
            leg.rotation.set(alongX ? -k * tilt : 0, 0, alongX ? 0 : k * tilt)
            g.add(leg)
          }
        }
        g.add(box(alongX ? L : 60, 60, alongX ? 60 : L, M.timber, 0, H - 30, 0))
        const seatL = L - 300
        g.add(box(alongX ? seatL : D - 200, 60, alongX ? D - 200 : seatL, M.timber, 0, 450, 0))
        g.add(box(alongX ? seatL : 60, 360, alongX ? 60 : seatL, M.timber, alongX ? 0 : -(D / 2 - 130), 660, alongX ? -(D / 2 - 130) : 0))
        g.add(box(alongX ? seatL - 40 : D - 240, 60, alongX ? D - 240 : seatL - 40, M.fabricDark, 0, 500, 0))
        for (const e of [-1, 1]) for (const k of [-1, 1]) {
          const chain = new THREE.Mesh(new THREE.CylinderGeometry(6 * S, 6 * S, (H - 60 - 480) * S, 6), M.metal)
          chain.position.set((alongX ? e * (seatL / 2 - 40) : k * (D / 2 - 120)) * S, ((H - 60 + 480) / 2) * S, (alongX ? k * (D / 2 - 120) : e * (seatL / 2 - 40)) * S)
          g.add(chain)
        }
        place(g, cx, cy)
        return g
      }
      g.add(box(w, 50, d, M.timber, 0, h - 25, 0))
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
        g.add(box(60, h - 50, 60, M.timber, sx * (w / 2 - 60), (h - 50) / 2, sz * (d / 2 - 60)))
      place(g, cx, cy)
      return g
    }
    case 'stool': {
      if (/bin|basket/i.test(f.label)) {
        const r = Math.min(w, d) / 2 - 10
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * 0.88 * S, f.height * S, 18), M.bin)
        bin.position.y = (f.height / 2) * S
        bin.castShadow = true
        g.add(bin)
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, 14 * S, 18), M.metal)
        lid.position.y = (f.height + 7) * S
        g.add(lid)
      } else if (/footrest/i.test(f.label)) {
        // the recliner's footrest, deployed: a padded flap on a slim frame
        g.add(box(w - 60, 90, d - 60, M.fabricDark, 0, f.height - 45, 0))
        g.add(box(w - 200, 40, d - 200, M.metal, 0, f.height - 120, 0))
      } else {
        g.add(box(w, f.height, d, M.timber, 0, f.height / 2, 0))
      }
      place(g, cx, cy)
      return g
    }
    case 'wardrobe':
    case 'shelves': {
      g.add(box(w, f.height, d, M.timber, 0, f.height / 2, 0))
      doorFronts(g, f, M, 0, f.height)
      place(g, cx, cy)
      return g
    }
    case 'screen': {
      if (/mirror/i.test(f.label)) {
        // a framed mirror: dark frame, a glossy pane, on the wall side of its slot
        const upright = d > w
        const L = Math.max(w, d)
        const H = Math.min(f.height, 1800)
        const frame = box(upright ? 30 : L, H, upright ? L : 30, M.trunk, 0, 350 + H / 2, 0)
        g.add(frame)
        const pane = box(upright ? 34 : L - 90, H - 90, upright ? L - 90 : 34, M.mirror, 0, 350 + H / 2, 0)
        g.add(pane)
        place(g, cx, cy)
        return g
      }
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
      g.add(box(upright ? thin : panelW, 460, upright ? panelW : thin, M.gasket, 0, 1080, 0))
      g.add(box(upright ? thin + 6 : panelW - 40, 420, upright ? panelW - 40 : thin + 6, M.appliance, 0, 1080, 0))
      // the arm: a post from the desk and a boom to the panel's back
      g.add(box(60, 340, 60, M.metal, upright ? thin / 2 + 20 : 0, 800 + 170, upright ? 0 : thin / 2 + 20))
      g.add(box(upright ? 90 : 30, 30, upright ? 30 : 90, M.metal, upright ? thin / 2 : 0, 1060, upright ? 0 : thin / 2))
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
      // a fiddle-leaf: a slim stem and big paddle leaves fanned round it, every
      // leaf inside the drawn footprint
      const reach = Math.min(w, d) / 2 - 20
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 22 * S, (f.height - 340) * S, 8), M.trunk)
      stem.position.y = (340 + (f.height - 340) / 2) * S
      g.add(stem)
      const leafGeo = new THREE.PlaneGeometry(1, 1)
      for (let i = 0; i < 11; i++) {
        const a = i * 2.4
        const h = 620 + i * ((f.height - 700) / 11)
        const len = Math.min(reach, 420) * (0.75 + (i % 3) * 0.12)
        const leafMat = (i % 2 ? M.leaf : M.leafDark).clone()
        leafMat.side = THREE.DoubleSide
        const leaf = new THREE.Mesh(leafGeo, leafMat)
        leaf.scale.set(len * 0.62 * S, len * S, 1)
        leaf.position.set(Math.cos(a) * (len * 0.5) * S, (h + len * 0.25) * S, Math.sin(a) * (len * 0.5) * S)
        leaf.rotation.set(-0.35, -a + Math.PI / 2, 0.15, 'YXZ')
        leaf.castShadow = true
        g.add(leaf)
      }
      place(g, cx, cy)
      return g
    }
    case 'tree': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(70 * S, 95 * S, f.height * 0.45 * S, 10), M.trunk)
      trunk.position.y = f.height * 0.225 * S
      trunk.castShadow = true
      g.add(trunk)
      // three branches out of the trunk, a tuft of foliage on each and a crown,
      // all held inside the drawn footprint
      const R0 = Math.min(w, d) / 2 - 10
      const branchTop = f.height * 0.62
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.6
        const bx = Math.cos(a) * R0 * 0.45
        const bz = Math.sin(a) * R0 * 0.45
        const from = new THREE.Vector3(0, f.height * 0.42 * S, 0)
        const to = new THREE.Vector3(bx * S, branchTop * S, bz * S)
        const len = from.distanceTo(to)
        const br = new THREE.Mesh(new THREE.CylinderGeometry(22 * S, 40 * S, len, 7), M.trunk)
        br.position.copy(from).add(to).multiplyScalar(0.5)
        br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
        br.castShadow = true
        g.add(br)
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(R0 * 0.5 * S, 9, 7), k % 2 ? M.leaf : M.leafDark)
        tuft.position.set(bx * S, (branchTop + R0 * 0.2) * S, bz * S)
        tuft.scale.set(1, 0.8, 1)
        tuft.castShadow = true
        g.add(tuft)
      }
      const crown = new THREE.Mesh(new THREE.SphereGeometry(R0 * 0.62 * S, 10, 8), M.leaf)
      crown.position.y = (branchTop + R0 * 0.5) * S
      crown.scale.set(1, 0.85, 1)
      crown.castShadow = true
      g.add(crown)
      place(g, cx, cy, f.lift ?? 0)                 // a tree in a box stands on its soil
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

/** An abstract canvas: warm strokes on linen, painted once. */
function paintingCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 384
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e9e1d2'
  ctx.fillRect(0, 0, 512, 384)
  let s = 23
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const tones = ['#b5542e', '#d9a34c', '#2f4a5a', '#7a8a6a', '#c2b59b', '#5c3b2e', '#e0c56b']
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = tones[i % tones.length]
    ctx.globalAlpha = 0.55 + rnd() * 0.4
    ctx.lineWidth = 10 + rnd() * 34
    ctx.lineCap = 'round'
    ctx.beginPath()
    const x = rnd() * 512
    const y = 60 + rnd() * 264
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 220, y + (rnd() - 0.5) * 120, x + (rnd() - 0.5) * 220, y + (rnd() - 0.5) * 120, x + (rnd() - 0.5) * 300, y + (rnd() - 0.5) * 160)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return c
}

/**
 * The entry gallery's last-look wall: over the console against the west leg, a
 * framed canvas with a brass picture light above it that throws warm light
 * down the painting. Drawn only where a console stands in the entry.
 */
function entryPainting(M: Mats): THREE.Group | null {
  const con = furniture.find((f) => f.kind === 'console' && /^console$/i.test(f.label) && /entry/i.test(model.roomById.get(f.room)?.name ?? ''))
  if (!con) return null
  // which side of the console is against a wall: the bbox side nearest a wall line
  const sides = [
    { x: con.x, y: con.y + con.d / 2, nx: 1, ny: 0, along: 'y' as const },
    { x: con.x + con.w, y: con.y + con.d / 2, nx: -1, ny: 0, along: 'y' as const },
    { x: con.x + con.w / 2, y: con.y, nx: 0, ny: 1, along: 'x' as const },
    { x: con.x + con.w / 2, y: con.y + con.d, nx: 0, ny: -1, along: 'x' as const },
  ]
  const distToWalls = (p: { x: number; y: number }) => {
    let best = Infinity
    for (const w of model.walls) {
      if (w.thickness < 60) continue
      for (let k = 0; k < w.points.length - 1; k++) {
        const a = w.points[k]
        const b = w.points[k + 1]
        const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
        const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2)) : 0
        const dd = Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))) - w.thickness / 2
        if (dd < best) best = dd
      }
    }
    return best
  }
  const back = sides.reduce((a, b) => (distToWalls(a) <= distToWalls(b) ? a : b))
  const g = new THREE.Group()
  const rot = back.along === 'y' ? Math.PI / 2 : 0
  const PW = Math.min(1000, (back.along === 'y' ? con.d : con.w) * 0.7)
  const PH = PW * 0.7
  const mid = 1250 + PH / 2
  const put = (m: THREE.Object3D, off: number, h: number) => {
    m.position.set((back.x + back.nx * off) * S, h * S, (back.y + back.ny * off) * S)
    m.rotation.y = rot
    g.add(m)
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry((PW + 70) * S, (PH + 70) * S, 38 * S), M.trunk)
  frame.castShadow = true
  put(frame, 24, mid)
  const tex = new THREE.CanvasTexture(paintingCanvas())
  tex.colorSpace = THREE.SRGBColorSpace
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(PW * S, PH * S), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  put(canvas, 46, mid)
  if (back.nx < 0 || back.ny < 0) canvas.rotation.y += Math.PI
  if (back.along === 'y' && back.nx > 0) canvas.rotation.y = Math.PI / 2
  if (back.along === 'y' && back.nx < 0) canvas.rotation.y = -Math.PI / 2
  if (back.along === 'x' && back.ny < 0) canvas.rotation.y = Math.PI
  if (back.along === 'x' && back.ny > 0) canvas.rotation.y = 0
  // the picture light: a brass tube on two short arms, above the frame
  const lampH = mid + PH / 2 + 130
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(22 * S, 22 * S, (PW * 0.5) * S, 12), M.brass)
  tube.rotation.z = Math.PI / 2
  put(tube, 150, lampH)
  for (const sgn of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(7 * S, 7 * S, 150 * S, 8), M.brass)
    arm.rotation.x = Math.PI / 2
    const ax = back.along === 'y' ? back.x + back.nx * 75 : back.x + sgn * PW * 0.2
    const ay = back.along === 'y' ? back.y + sgn * PW * 0.2 : back.y + back.ny * 75
    arm.position.set(ax * S, lampH * S, ay * S)
    arm.rotation.y = rot
    g.add(arm)
  }
  const light = new THREE.PointLight(0xffd7a3, 0.9, 2.2, 1.7)
  light.position.set((back.x + back.nx * 170) * S, (lampH - 40) * S, (back.y + back.ny * 170) * S)
  g.add(light)
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
        // the splashback: stone from the worktop up to the cabinets, on the wall face
        const sb = new THREE.Group()
        sb.add(box(18, CAB_BOTTOM - 940, L, M.stoneTop, -CAB_DEPTH / 2 + 9, (940 + CAB_BOTTOM) / 2, 0))
        sb.rotation.y = ang
        sb.position.set(sx * S, 0, sy * S)
        g.add(sb)
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
/**
 * The coffee bar in Karan's pod: the pantry run the sheet draws along the
 * void's back wall, built as a bar rather than a cabinet. Dark timber base
 * with door fronts and brass pulls, a marble top with an upstand along the
 * back, the sink where the sheet puts it with a brass tap, the machine where
 * the sheet's 320 rectangle is — a Nespresso, graphite and chrome, with its
 * lever, tank and a cup on the drip tray — a capsule dispenser and a tray of
 * mugs beside it, and a floating shelf over with more mugs and a warm strip
 * light under it. Everything stays inside the drawn outline.
 */
function coffeeBar(M: Mats, f: FurnitureItem): THREE.Group | null {
  if (!f.poly) return null
  const g = new THREE.Group()
  const TOP = 900
  const poly = f.poly
  const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  // the back wall is the long straight edge; the front is the far one
  const backY = y0, depth = y1 - y0
  const frontY = backY + depth
  // where the run has its full depth (the sheet tapers one end to the glass)
  const fullFrom = poly.filter((q) => Math.abs(q.y - frontY) < 20).reduce((a, q) => Math.min(a, q.x), Infinity)
  const fullTo = poly.filter((q) => Math.abs(q.y - frontY) < 20).reduce((a, q) => Math.max(a, q.x), -Infinity)
  const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2

  // base: plinth, carcass, top, upstand
  const plinth = polyPiece(poly.map((q) => ({ x: cxm + (q.x - cxm) * 0.97, y: cym + (q.y - cym) * 0.94 })), 0, 90, M.gasket, f.room)
  if (plinth) g.add(plinth)
  const carcass = polyPiece(poly, 90, TOP - 30, M.trunk, f.room)
  if (carcass) g.add(carcass)
  const slab = polyPiece(poly, TOP - 30, TOP, M.marble, f.room)
  if (slab) g.add(slab)
  g.add(box(x1 - x0 - 20, 100, 20, M.marble, cxm, TOP + 50, backY + 12))       // the upstand
  // door fronts along the full-depth stretch, brass pulls
  const runL = fullTo - fullFrom
  const nDoors = Math.max(2, Math.round(runL / 450))
  for (let i = 0; i < nDoors; i++) {
    const dw = runL / nDoors
    const dx = fullFrom + dw * (i + 0.5)
    g.add(box(dw - 12, TOP - 150, 14, M.timber, dx, (TOP - 30 + 100) / 2, frontY - 4))
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(5 * S, 5 * S, 140 * S, 8), M.brass)
    pull.position.set((dx + dw / 2 - 50) * S, ((TOP - 30 + 100) / 2) * S, (frontY + 12) * S)
    g.add(pull)
  }

  // the sink, where the sheet draws it: an undermount bowl and a brass swan tap
  const sinkX = x1 - 240, sinkY = backY + 300
  g.add(box(400, 30, 320, M.chrome, sinkX, TOP - 14, sinkY))
  g.add(box(330, 120, 250, M.gasket, sinkX, TOP - 76, sinkY))
  const tapBase = new THREE.Mesh(new THREE.CylinderGeometry(16 * S, 20 * S, 260 * S, 12), M.brass)
  tapBase.position.set((sinkX + 120) * S, (TOP + 130) * S, (backY + 90) * S)
  g.add(tapBase)
  const spout = new THREE.Mesh(new THREE.TorusGeometry(90 * S, 8 * S, 8, 20, Math.PI), M.brass)
  spout.position.set((sinkX + 120) * S, (TOP + 260) * S, (backY + 180) * S)
  spout.rotation.y = Math.PI / 2
  g.add(spout)

  // the Nespresso, on the sheet's machine rectangle: 320 across, 300 deep
  const mx = fullFrom + 360, mz = backY + 190
  const body = box(180, 250, 300, M.graphite, mx, TOP + 125, mz)
  g.add(body)
  g.add(box(184, 26, 304, M.chrome, mx, TOP + 262, mz))                       // brushed top
  g.add(box(90, 210, 110, M.acrylic, mx + 60, TOP + 120, mz - 80))            // the water tank behind
  const lever = box(160, 18, 22, M.chrome, mx, TOP + 285, mz + 70)
  lever.rotation.x = -0.25
  g.add(lever)
  g.add(box(150, 10, 150, M.chrome, mx, TOP + 5, mz + 60))                    // drip tray
  const head = box(70, 60, 60, M.chrome, mx, TOP + 150, mz + 140)
  g.add(head)
  const spoutN = new THREE.Mesh(new THREE.CylinderGeometry(7 * S, 9 * S, 30 * S, 10), M.chrome)
  spoutN.position.set(mx * S, (TOP + 110) * S, (mz + 140) * S)
  g.add(spoutN)
  const mug = (x: number, z: number, h = 0, small = false) => {
    const r = small ? 30 : 42, hh = small ? 60 : 95
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(r * S, (r - 6) * S, hh * S, 18, 1, true), M.porcelain)
    ;(cup.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    cup.position.set(x * S, (h + hh / 2) * S, z * S)
    cup.castShadow = true
    g.add(cup)
    const base = new THREE.Mesh(new THREE.CircleGeometry((r - 6) * S, 18), M.porcelain)
    base.rotation.x = -Math.PI / 2
    base.position.set(x * S, (h + 2) * S, z * S)
    g.add(base)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * S, 2.2 * S, 6, 24), M.brass)
    rim.rotation.x = Math.PI / 2
    rim.position.set(x * S, (h + hh - 2) * S, z * S)
    g.add(rim)
    const handle = new THREE.Mesh(new THREE.TorusGeometry((small ? 16 : 24) * S, 5 * S, 6, 14, Math.PI), M.porcelain)
    handle.position.set((x + r + 2) * S, (h + hh * 0.5) * S, z * S)
    handle.rotation.z = -Math.PI / 2
    g.add(handle)
  }
  mug(mx, mz + 60, TOP + 10, true)                                            // an espresso cup on the tray
  // capsule dispenser: a chrome tower of coloured pods beside the machine
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(38 * S, 38 * S, 240 * S, 16), M.chrome)
  tower.position.set((mx + 180) * S, (TOP + 120) * S, (mz - 40) * S)
  g.add(tower)
  const podColors = [0x6b3fa0, 0xb8862b, 0x2f6f4f, 0x9c2f2f, 0x2b4a7a, 0xd8a13a]
  for (let i = 0; i < 6; i++) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(20 * S, 14 * S, 26 * S, 10),
      new THREE.MeshStandardMaterial({ color: podColors[i], roughness: 0.3, metalness: 0.6 }))
    pod.position.set((mx + 180) * S, (TOP + 20 + i * 36) * S, (mz - 40 + 40) * S)
    g.add(pod)
  }
  // a timber tray of mugs, and two more on the tapering shelf end
  const trayX = mx + 360, trayZ = backY + 260
  g.add(box(360, 14, 240, M.timber, trayX, TOP + 7, trayZ))
  g.add(box(360, 34, 12, M.timber, trayX, TOP + 24, trayZ - 114))
  g.add(box(360, 34, 12, M.timber, trayX, TOP + 24, trayZ + 114))
  for (const [ox, oz] of [[-110, -50], [10, -50], [-50, 55], [70, 55]] as const) mug(trayX + ox, trayZ + oz, TOP + 14)
  mug(fullFrom - 40, backY + 120, TOP)
  mug(fullFrom - 130, backY + 70, TOP)
  // the shelf over, with its mugs and a warm light strip under
  const shelfX = (mx + trayX) / 2, shelfL = trayX - mx + 320
  g.add(box(shelfL, 30, 200, M.timber, shelfX, 1380, backY + 100))
  g.add(box(shelfL - 60, 8, 20, M.lamp, shelfX, 1362, backY + 150))
  const strip = new THREE.PointLight(0xffd8a8, 0.5, 1.6, 1.6)
  strip.position.set(shelfX * S, 1350 * S, (backY + 200) * S)
  g.add(strip)
  for (let i = 0; i < 5; i++) mug(shelfX - shelfL / 2 + 80 + i * (shelfL - 160) / 4, backY + 100, 1395)
  // two glass jars on the shelf end: beans and sugar
  for (const [ox, mat] of [[shelfL / 2 - 70, M.trunk], [shelfL / 2 - 150, M.porcelain]] as const) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(40 * S, 40 * S, 130 * S, 14), M.acrylic)
    jar.position.set((shelfX + ox) * S, 1460 * S, (backY + 100) * S)
    g.add(jar)
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(34 * S, 34 * S, 100 * S, 14), mat)
    fill.position.set((shelfX + ox) * S, 1448 * S, (backY + 100) * S)
    g.add(fill)
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(42 * S, 42 * S, 14 * S, 14), M.timber)
    lid.position.set((shelfX + ox) * S, 1532 * S, (backY + 100) * S)
    g.add(lid)
  }
  return g
}


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
  const stone = M.fountainMarble
  const add = (m: THREE.Mesh, y: number) => {
    m.position.set(F.x * S, y * k * S, F.y * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const lathe = (profile: Array<[number, number]>, mat: THREE.Material, segs = 64) => {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r * k * S, y * k * S))
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat)
    return m
  }
  // plinth and pedestal: turned marble, fine rings and a baluster stem
  add(lathe([[0, 0], [600, 0], [600, 60], [575, 80], [560, 80], [560, 110], [505, 120], [500, 200], [470, 210], [470, 230], [0, 230]], stone), 0)
  add(lathe([[0, 230], [235, 230], [230, 270], [190, 300], [175, 420], [200, 520], [230, 560], [235, 600], [215, 640], [0, 640]], stone), 0)
  // the three basins, each a lathed bowl with a thick rolled lip and water in it;
  // the water sits 25 below the lip, so the marble edge reads as a rim
  const bowl = (rim: number, base: number, top: number) =>
    lathe([[0, base], [rim * 0.5, base], [rim * 0.88, base + (top - base) * 0.5], [rim, top - 30], [rim + 12, top - 12], [rim, top], [rim - 40, top], [rim - 55, top - 40], [rim * 0.42, top - 60], [0, top - 70]], stone)
  const basins: Array<{ rim: number; base: number; top: number; lamps: number }> = [
    { rim: 600, base: 640, top: 860, lamps: 8 },
    { rim: 380, base: 1540, top: 1700, lamps: 5 },
    { rim: 220, base: 2080, top: 2190, lamps: 3 },
  ]
  for (const b of basins) {
    add(bowl(b.rim, b.base, b.top), 0)
    const waterR = b.rim - 48
    const waterY = b.top - 25
    add(new THREE.Mesh(new THREE.CylinderGeometry(mm(waterR), mm(waterR), mm(6), 64), M.fountainWater), waterY)
    // the lights in the water: small warm lamps on the basin floor, each a glowing
    // lens and a real light, so the water and the marble above it are lit from within
    for (let i = 0; i < b.lamps; i++) {
      const a = (i / b.lamps) * Math.PI * 2 + 0.3
      const r = waterR * 0.62
      const x = F.x + r * k * Math.cos(a), z = F.y + r * k * Math.sin(a)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(mm(22), mm(26), mm(10), 14), M.poolLamp)
      lens.position.set(x * S, (b.top - 62) * k * S, z * S)
      g.add(lens)
    }
    // one real light per basin does the lighting; the lenses are the glow points
    const glow = new THREE.PointLight(0xffc860, 1.4, 2.6 * k, 1.8)
    glow.position.set(F.x * S, (b.top - 40) * k * S, F.y * S)
    g.add(glow)
  }
  // the stems between the basins, and the finial
  add(lathe([[0, 860], [130, 860], [110, 900], [95, 1200], [110, 1500], [135, 1540], [0, 1540]], stone), 0)
  add(lathe([[0, 1700], [80, 1700], [65, 1740], [58, 2000], [75, 2080], [0, 2080]], stone), 0)
  add(lathe([[0, 2190], [60, 2190], [62, 2230], [45, 2260], [40, 2300], [25, 2380], [0, 2430]], stone), 0)
  // one warm light up the stem from the lowest basin, so the underside of the
  // middle bowl glows the way lit water throws light up on to stone
  // the water: a crown of fine jets from the finial, and thin sheets falling from
  // each upper lip into the basin below
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(mm(4), mm(6), mm(220), 6), M.fountainJet)
    jet.position.set((F.x + 30 * k * Math.cos(a)) * S, 2440 * k * S, (F.y + 30 * k * Math.sin(a)) * S)
    jet.rotation.z = Math.cos(a) * 0.35
    jet.rotation.x = -Math.sin(a) * 0.35
    g.add(jet)
  }
  const fall = (r: number, n: number, top: number, bottom: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(5), mm(8), mm(top - bottom), 6), M.fountainJet)
      m.position.set((F.x + r * k * Math.cos(a)) * S, ((top + bottom) / 2) * k * S, (F.y + r * k * Math.sin(a)) * S)
      g.add(m)
    }
  }
  fall(212, 10, 2170, 1700)
  fall(372, 14, 1680, 860)
  // ripple rings where the falls land: faint pale discs on the water
  for (const [r, y, n] of [[372, 1676, 14], [212, 2166, 10]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const ring = new THREE.Mesh(new THREE.RingGeometry(mm(28), mm(40), 20), M.fountainJet)
      ring.rotation.x = -Math.PI / 2
      ring.position.set((F.x + r * k * Math.cos(a)) * S, y * k * S, (F.y + r * k * Math.sin(a)) * S)
      g.add(ring)
    }
  }
  return g
}

/**
 * The curved doors on the entry drum's arched portal to the great room. The 2D
 * draws them shut on the arc ("they slide on the arc"), so they are drawn shut
 * here too: a pair of leaves, wood framed, each with two chamfered glass lights.
 * Derived from the drum's own geometry — the arc wall's circumcentre and radius,
 * the portal's chord for its extent — so they cannot drift from the plan.
 */
/**
 * The entry drum as a circle: its centre and radius from three points on the
 * arc wall, and the portal's angular extent from its chord. Shared by the
 * curved doors and the sconces beside them, so both sit on the same wall.
 */
function entryDrum(): { C: { x: number; y: number }; Rwall: number; wallT: number; a0: number; a1: number } | null {
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
  return { C, Rwall, wallT: arc.thickness || 230, a0, a1 }
}

/**
 * A pair of classic wall lamps on the drum, one either side of the curved
 * doors, on the entry side: an oval brass backplate, a swept brass arm and a
 * frosted glass bell that glows warm, with a real light in it. Set 900 mm out
 * from each jamb along the arc, which keeps them clear of the leaves when the
 * doors slide open (each leaf runs 527 mm past its jamb).
 */
function entrySconces(M: Mats): THREE.Group | null {
  const drum = entryDrum()
  if (!drum) return null
  const { C, Rwall, wallT, a0, a1 } = drum
  const Ri = Rwall - wallT / 2                     // the drum's inner face
  const OFF = 900 / Ri                             // 900 mm along the arc, past the jamb
  const MOUNT = 1750                               // backplate centre above the floor
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d2, emissive: 0xffc26a, emissiveIntensity: 0.9, roughness: 0.55,
    transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  })
  const g = new THREE.Group()
  for (const a of [a0 - OFF, a1 + OFF]) {
    const lamp = new THREE.Group()
    // local frame: the backplate in the XY plane, +z out from the wall into the room
    // a tall oval: the disc's axis turned to +z, then stretched along what is now up
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(55 * S, 55 * S, 10 * S, 32), M.brass)
    plate.rotation.x = Math.PI / 2
    plate.scale.set(1, 1, 1.6)
    plate.position.z = 5 * S
    lamp.add(plate)
    const boss = new THREE.Mesh(new THREE.SphereGeometry(22 * S, 16, 12), M.brass)
    boss.position.z = 12 * S
    lamp.add(boss)
    // the arm: a swept tube from the boss, out and up to the shade
    const path = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 12 * S),
      new THREE.Vector3(0, -30 * S, 150 * S),
      new THREE.Vector3(0, 110 * S, 190 * S),
    )
    const arm = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 7 * S, 10, false), M.brass)
    arm.castShadow = true
    lamp.add(arm)
    // the cup the shade hangs from, and a ring where glass meets brass
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 34 * S, 42 * S, 20), M.brass)
    cup.position.set(0, 128 * S, 190 * S)
    lamp.add(cup)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(36 * S, 5 * S, 8, 28), M.brass)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 108 * S, 190 * S)
    lamp.add(ring)
    // the bell: a lathe of frosted glass, its mouth downward, flaring out as it drops
    const profile = [
      [30, 0], [36, -20], [48, -60], [62, -110], [76, -160], [88, -205], [94, -235], [90, -250],
    ].map(([r, y]) => new THREE.Vector2(r * S, y * S))
    const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), shadeMat)
    bell.position.set(0, 108 * S, 190 * S)
    lamp.add(bell)
    // the lamp inside, and the light it throws
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(20 * S, 14, 10), M.lamp)
    bulb.position.set(0, -20 * S, 190 * S)
    lamp.add(bulb)
    const light = new THREE.PointLight(0xffd39a, 1.3, 3.8, 1.7)
    light.position.set(0, 20 * S, 200 * S)
    lamp.add(light)

    // onto the wall: +z must point from the wall face toward the drum's centre
    const yaw = Math.atan2(-Math.cos(a), -Math.sin(a))
    lamp.rotation.y = yaw
    lamp.position.set((C.x + Ri * Math.cos(a)) * S, MOUNT * S, (C.y + Ri * Math.sin(a)) * S)
    g.add(lamp)
  }
  return g
}

function curvedDoors(M: Mats, mode: 'open' | 'shut' = 'shut'): THREE.Group | null {
  const drum = entryDrum()
  if (!drum) return null
  const { C, Rwall, wallT, a0, a1 } = drum

  // The leaves slide just inside the drum's inner face.
  const R = Rwall - wallT / 2 - 40
  const LEAF_T = 45
  // the leaves run the full height of the drum: wall head to floor, less a clearance
  const H = model.data.levels.ceiling - 20
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

/**
 * A retractable vault as the telescoping roof it is: split at its centre into two
 * halves, each half made of bays that nest one inside the next (each bay a little
 * smaller in section than the one outboard of it), riding on the landing rail
 * and the foot sill. Shut, the bays sit end to end and read as one belly with a
 * rib at every joint; open, each half's bays slide out to its own end and stack
 * inside the outermost bay, which stays put and carries the glazed gable, so the
 * middle of the deck is open to the sky. Both states are built; the Roof switch
 * shows one.
 */
function telescopingVault(M: Mats, roof: (typeof solids.roofs)[number], mode: 'shut' | 'open'): THREE.Group {
  const g = new THREE.Group()
  const [x0, y0, x1, y1] = roof.extent
  const sec = roof.section!
  const mid = (x0 + x1) / 2
  const BAYS = 6                                  // per half
  const NEST = 0.014                              // each bay this much smaller than the last
  const STACK = 45                                // mm between stacked bays' ribs
  const landZ = sec.p2.x                          // the landing line, the pivot the bays nest about
  const profile = barrelProfile(sec, 48)
  for (const side of [-1, 1] as const) {
    const endX = side < 0 ? x0 : x1
    const halfL = mid - x0
    const bayL = halfL / BAYS
    for (let i = 0; i < BAYS; i++) {
      // bay i counts from the end wall inward: 0 is the fixed outermost bay
      const near = endX - side * i * bayL             // the bay's end-wall side
      const far = near - side * bayL                  // its inboard side
      const bx0 = Math.min(near, far), bx1 = Math.max(near, far)
      const bay = new THREE.Group()
      const sub = { ...roof, extent: [bx0, y0, bx1, y1] as [number, number, number, number] }
      const glass = new THREE.Mesh(vaultGeometry(sub), M.roofGlass)
      glass.receiveShadow = true
      bay.add(glass)
      // a rib at each end of the bay, so shut it reads as one ribbed belly and
      // open the stack shows every leaf
      for (const rx of [bx0, bx1]) {
        const curve = new THREE.CatmullRomCurve3(profile.map((q) => new THREE.Vector3(rx * S, q.y * S, q.x * S)))
        const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.03, 6, false), M.metal)
        rib.castShadow = true
        bay.add(rib)
      }
      // a slim runner along the bay's foot and its landing edge, on the tracks
      for (const q of [sec.p0, sec.p2]) {
        const runner = box(bx1 - bx0 - 20, 36, 36, M.metal, (bx0 + bx1) / 2, q.y + 28, q.x)
        bay.add(runner)
      }
      // nesting: scale the bay's section about the landing line at floor level
      const sc = 1 - NEST * i
      bay.scale.set(1, sc, sc)
      bay.position.z = landZ * (1 - sc) * S
      // open: the bay slides to its end wall and stacks just inside the bay before it
      if (mode === 'open') bay.position.x = side * i * (bayL - STACK) * S
      g.add(bay)
    }
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

  // ---- ceilings over every indoor room, cut round the flat glass roofs; recessed
  // downlights on them on a loose grid; a skirting and a cornice round each room.
  // The ceilings, their lights and the cornice live in one named group, so the
  // Ceiling switch can lift them off for a top-down look at the plan.
  const ceilingGroup = new THREE.Group()
  ceilingGroup.name = 'ceiling'
  root.add(ceilingGroup)
  {
    const ceiling = model.data.levels.ceiling
    const glassRects = solids.roofs
      .filter((r) => r.kind === 'flat')
      .map((r) => [[[r.extent[0], r.extent[1]], [r.extent[2], r.extent[1]], [r.extent[2], r.extent[3]], [r.extent[0], r.extent[3]], [r.extent[0], r.extent[1]]]] as [number, number][][])
    // dim amber: the downlights and the cove glow low and warm, not bright
    const downMat = new THREE.MeshStandardMaterial({ color: 0xf2dcb0, emissive: 0xffb860, emissiveIntensity: 0.9, roughness: 0.4 })
    const trimMat = M.walnut
    const coveMat = new THREE.MeshStandardMaterial({ color: 0xe8c890, emissive: 0xffae4e, emissiveIntensity: 0.8, roughness: 0.5 })
    for (const room of model.rooms) {
      const cat = room.def.category
      if (cat === 'outdoor' || cat === 'void') continue
      const ring = room.polygon.map((q) => [q.x, q.y] as [number, number])
      if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0])
      let pieces: [number, number][][][] = [[ring]]
      for (const rect of glassRects) {
        try { pieces = pcx.difference(pieces as never, [rect] as never) as [number, number][][][] } catch { /* keep */ }
      }
      for (const piece of pieces) {
        const outer = piece[0].map(([x, y]) => ({ x, y }))
        const holes = piece.slice(1).map((h) => h.map(([x, y]) => ({ x, y })))
        const slab = new THREE.Mesh(prismGeometry(decimate(outer), ceiling, ceiling + 80, holes.map((h) => decimate(h))), M.plaster)
        slab.receiveShadow = true
        ceilingGroup.add(slab)
      }
      // downlights, only under a plaster ceiling and well inside the room
      const pitch = 1800
      for (let x = room.bbox.minX + pitch / 2; x < room.bbox.maxX; x += pitch) {
        for (let y = room.bbox.minY + pitch / 2; y < room.bbox.maxY; y += pitch) {
          if (!pointInPolygon({ x, y }, room.polygon)) continue
          if (glassRects.some((r) => x >= r[0][0][0] && x <= r[0][2][0] && y >= r[0][0][1] && y <= r[0][2][1])) continue
          const dl = new THREE.Mesh(new THREE.CylinderGeometry(45 * S, 45 * S, 6 * S, 14), downMat)
          dl.position.set(x * S, (ceiling - 3) * S, y * S)
          ceilingGroup.add(dl)
        }
      }
      // skirting and cornice along the walls
      const poly = room.polygon
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]
        const b = poly[(i + 1) % poly.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 120) continue
        const ang = Math.atan2(b.x - a.x, b.y - a.y)
        // inward normal: toward the centroid
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        let nx = -(b.y - a.y) / len
        let ny = (b.x - a.x) / len
        if ((room.centroid.x - mx) * nx + (room.centroid.y - my) * ny < 0) { nx = -nx; ny = -ny }
        // a timber skirting, a gilded cornice, and a cove of warm light along the
        // cornice's underside, the palace way of lighting a ceiling
        for (const [h0, h1, t, mat] of [[0, 100, 16, trimMat], [ceiling - 60, ceiling, 24, M.walnut]] as const) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(t * S, (h1 - h0) * S, (len - 8) * S), mat)
          trim.position.set((mx + nx * t / 2) * S, ((h0 + h1) / 2) * S, (my + ny * t / 2) * S)
          trim.rotation.y = ang
          ;(h0 === 0 ? root : ceilingGroup).add(trim)
        }
        if (cat === 'habitable' || cat === 'circulation') {
          const cove = new THREE.Mesh(new THREE.BoxGeometry(10 * S, 8 * S, (len - 8) * S), coveMat)
          cove.position.set((mx + nx * 30) * S, (ceiling - 66) * S, (my + ny * 30) * S)
          cove.rotation.y = ang
          ceilingGroup.add(cove)
        }
      }
    }
  }

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
  const painting = entryPainting(M)
  if (painting) root.add(painting)
  const sconces = entrySconces(M)
  if (sconces) root.add(sconces)

  // ---- glass roofs
  for (const roof of opts.roofs === false ? [] : solids.roofs) {
    const [x0, y0, x1, y1] = roof.extent
    if (roof.kind === 'barrel' && roof.section) {
      // The bellied vault: springs from the parapet, bulges out past it, peaks above the
      // ceiling and lands on the wall head. Same mesh as the 3D tab, from canopy.ts, so
      // the walkthrough cannot show a different roof from the model.
      if (roof.retractable) {
        // the telescoping roof, both states; the Roof switch shows one
        for (const mode of ['shut', 'open'] as const) {
          const set = telescopingVault(M, roof, mode)
          set.name = `roof-${mode}`
          root.add(set)
        }
      } else {
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
      }
      // the landing edge: a slim metal channel where the glass meets the home's
      // ceiling edge, the full length of the vault, and a matching sill at the foot.
      // On the retractable roof these are the tracks the bays run on.
      const land = roof.section.p2
      const foot = roof.section.p0
      for (const [q, size] of [[land, roof.retractable ? 90 : 70], [foot, roof.retractable ? 70 : 50]] as const) {
        const rail = box((x1 - x0) * S / S, size, size, M.metal)
        rail.position.set(((x0 + x1) / 2) * S, (q.y - size / 2 + 10) * S, q.x * S)
        rail.castShadow = true
        root.add(rail)
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

/**
 * Which way an appliance's doors face. Not "towards the room's centre": the
 * kitchen's centre is off to the fridge's east, which put its doors against
 * the hob counter. The doors go on the side with the longest clear run —
 * rays from the front face in each of the four directions, stopped by the
 * first wall or the first other fixture (a counter, the next machine) — so
 * they open on to the floor where someone stands.
 */
export function openFace(f: { id: string; at: { x: number; y: number }; size: [number, number] }): { alongX: boolean; sgn: number } {
  const [w, d] = f.size
  const x0 = f.at.x - w / 2, x1 = f.at.x + w / 2, y0 = f.at.y - d / 2, y1 = f.at.y + d / 2
  const boxes = fixtures
    .filter((o) => o.id !== f.id)
    .map((o) => {
      const pts = o.poly ?? [
        { x: o.at.x - o.size[0] / 2, y: o.at.y - o.size[1] / 2 },
        { x: o.at.x + o.size[0] / 2, y: o.at.y + o.size[1] / 2 },
      ]
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y)
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
    })
  const segs: Array<[{ x: number; y: number }, { x: number; y: number }, number]> = []
  for (const wl of model.walls) {
    if (wl.thickness < 60) continue
    for (let k = 1; k < wl.points.length; k++) segs.push([wl.points[k - 1], wl.points[k], wl.thickness / 2])
  }
  // free run from the face out along +x / -x / +y / -y, the least of three rays across the face
  const run = (alongX: boolean, sgn: number): number => {
    let best = Infinity
    const lo = alongX ? y0 : x0, hi = alongX ? y1 : x1
    const face = alongX ? (sgn > 0 ? x1 : x0) : (sgn > 0 ? y1 : y0)
    for (const t of [0.15, 0.5, 0.85]) {
      const c = lo + (hi - lo) * t
      for (const b of boxes) {
        const cross = alongX ? (c >= b.y0 && c <= b.y1) : (c >= b.x0 && c <= b.x1)
        if (!cross) continue
        const near = alongX ? (sgn > 0 ? b.x0 : b.x1) : (sgn > 0 ? b.y0 : b.y1)
        const dist = (near - face) * sgn
        if (dist >= -20) best = Math.min(best, Math.max(0, dist))
      }
      for (const [a, b, half] of segs) {
        // the ray is axis-aligned: solve for where the segment crosses its line
        const pa = alongX ? a.y : a.x, pb = alongX ? b.y : b.x
        const qa = alongX ? a.x : a.y, qb = alongX ? b.x : b.y
        let hit: number | null = null
        if (Math.abs(pb - pa) < 1e-6) {
          if (Math.abs(c - pa) <= half) hit = Math.abs(qa - face) < Math.abs(qb - face) ? qa : qb
        } else {
          const u = (c - pa) / (pb - pa)
          if (u >= 0 && u <= 1) hit = qa + u * (qb - qa)
        }
        if (hit === null) continue
        const dist = (hit - face) * sgn - half
        if (dist >= -half) best = Math.min(best, Math.max(0, dist))
      }
    }
    return best
  }
  const options = [
    { alongX: true, sgn: 1 }, { alongX: true, sgn: -1 },
    { alongX: false, sgn: 1 }, { alongX: false, sgn: -1 },
  ]
  let pick = options[0], most = -1
  for (const o of options) {
    const r = run(o.alongX, o.sgn)
    if (r > most) { most = r; pick = o }
  }
  return pick
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
      // door and drawer fronts on every edge that does not back on to a wall
      const poly = f.poly
      const pcx0 = poly.reduce((t, q) => t + q.x, 0) / poly.length
      const pcy0 = poly.reduce((t, q) => t + q.y, 0) / poly.length
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]
        const b = poly[(i + 1) % poly.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 300) continue
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const nearWall = model.walls.some((w) => w.thickness >= 60 && w.points.length >= 2 && w.points.slice(1).some((q, k) => {
          const p0 = w.points[k]
          const L2 = (q.x - p0.x) ** 2 + (q.y - p0.y) ** 2
          const t = L2 ? Math.max(0, Math.min(1, ((mid.x - p0.x) * (q.x - p0.x) + (mid.y - p0.y) * (q.y - p0.y)) / L2)) : 0
          return Math.hypot(mid.x - (p0.x + t * (q.x - p0.x)), mid.y - (p0.y + t * (q.y - p0.y))) < w.thickness / 2 + 120
        }))
        if (nearWall) continue
        let nx = -(b.y - a.y) / len
        let ny = (b.x - a.x) / len
        if ((pcx0 - mid.x) * nx + (pcy0 - mid.y) * ny > 0) { nx = -nx; ny = -ny }   // outward
        const ang = Math.atan2(b.x - a.x, b.y - a.y)
        const face = new THREE.Group()
        const n = Math.max(1, Math.round(len / 500))
        for (let k = 1; k < n; k++) face.add(box(4, h - 140, 6, M.trunk, 0, 70 + (h - 140) / 2, -len / 2 + (k * len) / n))
        face.add(box(4, 6, len - 40, M.trunk, 0, h - 220, 0))               // the drawer line
        for (let k = 0; k < n; k++) face.add(box(14, 12, 180, M.metal, 8, h - 120, -len / 2 + ((k + 0.5) * len) / n))
        face.add(box(4, 90, len, M.gasket, -2, 45, 0))                       // the plinth recess
        face.rotation.y = ang
        face.position.set((mid.x + nx * 4) * S, 0, (mid.y + ny * 4) * S)
        g.add(face)
      }
      if (f.bowl) {
        // the basin, set exactly where the sheet draws its circle, its tap behind
        // it, and a framed mirror on the wall over it
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(f.bowl.r * S, f.bowl.r * 0.8 * S, 140 * S, 20),
          M.marble,
        )
        bowl.position.set(f.bowl.x * S, (h + 40 + 70) * S, f.bowl.y * S)
        bowl.castShadow = true
        g.add(bowl)
        // toward the wall: away from the room's centre
        const room = model.roomById.get(f.room)
        const dx = f.bowl.x - (room?.centroid.x ?? f.bowl.x)
        const dy = f.bowl.y - (room?.centroid.y ?? f.bowl.y)
        const L = Math.hypot(dx, dy) || 1
        const ux = dx / L
        const uy = dy / L
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 16 * S, 200 * S, 10), M.steel)
        tap.position.set((f.bowl.x + ux * (f.bowl.r + 60)) * S, (h + 40 + 100) * S, (f.bowl.y + uy * (f.bowl.r + 60)) * S)
        g.add(tap)
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(9 * S, 9 * S, 150 * S, 8), M.steel)
        spout.rotation.z = Math.PI / 2
        spout.rotation.y = -Math.atan2(uy, ux)
        spout.position.set((f.bowl.x + ux * (f.bowl.r - 10)) * S, (h + 40 + 200) * S, (f.bowl.y + uy * (f.bowl.r - 10)) * S)
        g.add(spout)
        const mirW = Math.min(700, f.bowl.r * 3.4)
        const mir = new THREE.Group()
        mir.add(box(mirW + 60, 760, 20, M.trunk, 0, 0, 0))
        mir.add(box(mirW, 700, 24, M.mirror, 0, 0, 0))
        mir.rotation.y = -Math.atan2(uy, ux) + Math.PI / 2
        mir.position.set((f.bowl.x + ux * (f.bowl.r + 200)) * S, 1550 * S, (f.bowl.y + uy * (f.bowl.r + 200)) * S)
        g.add(mir)
      }
      continue
    }
    // The shower is a CABINET, not a floor stain: stone tray with a raised
    // curb and glass around it — visible from above and walk-through alike.
    if (f.kind === 'shower') {
      const tray = box(w, 50, d, M.marble)
      place(tray, f.at.x, f.at.y, 25)
      g.add(tray)
      // the rain head on its arm from the wall side, the control plate under it,
      // a shelf niche beside it: the wall side is away from the room's centre
      {
        const room = model.roomById.get(f.room)
        const dx = f.at.x - (room?.centroid.x ?? f.at.x)
        const dy = f.at.y - (room?.centroid.y ?? f.at.y)
        const alongX = Math.abs(dx) >= Math.abs(dy)
        const sgn = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1
        const wx = f.at.x + (alongX ? sgn * (w / 2 - 20) : 0)
        const wy = f.at.y + (alongX ? 0 : sgn * (d / 2 - 20))
        const arm = box(alongX ? 300 : 16, 16, alongX ? 16 : 300, M.steel)
        place(arm, wx - (alongX ? sgn * 150 : 0), wy - (alongX ? 0 : sgn * 150), 2180)
        g.add(arm)
        const head = new THREE.Mesh(new THREE.CylinderGeometry(120 * S, 120 * S, 12 * S, 20), M.steel)
        head.position.set((wx - (alongX ? sgn * 300 : 0)) * S, 2160 * S, (wy - (alongX ? 0 : sgn * 300)) * S)
        g.add(head)
        const plate = box(alongX ? 10 : 160, 160, alongX ? 160 : 10, M.steel)
        place(plate, wx, wy, 1150)
        g.add(plate)
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(28 * S, 28 * S, 40 * S, 12), M.steel)
        knob.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0)
        knob.position.set((wx - (alongX ? sgn * 20 : 0)) * S, 1150 * S, (wy - (alongX ? 0 : sgn * 20)) * S)
        g.add(knob)
        const niche = box(alongX ? 12 : 320, 240, alongX ? 320 : 12, M.stoneTop)
        place(niche, wx, wy + (alongX ? (d / 2 - 260) : 0) - (alongX ? 0 : 0), 1500)
        if (!alongX) niche.position.x = (wx + (w / 2 - 260)) * S
        g.add(niche)
      }
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
    // long bar handles, dark gasket lines, doors to the open side of the room.
    if (f.kind === 'fridge') {
      const H = 1900
      const { alongX, sgn } = openFace(f)
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
      const { alongX, sgn } = openFace(f)              // doors on the open side
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
    if (f.kind === 'hob') {
      // an induction hob: black glass flush on the worktop, four rings
      const glass = box(w, 10, d, M.hob)
      place(glass, f.at.x, f.at.y, 945)
      g.add(glass)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(75 * S, 3 * S, 6, 24), M.metal)
        ring.rotation.x = Math.PI / 2
        ring.position.set((f.at.x + sx * w * 0.24) * S, 951 * S, (f.at.y + sz * d * 0.24) * S)
        g.add(ring)
      }
      continue
    }
    if (f.kind === 'sink') {
      // an undermount sink: a dark basin let into the worktop, a tall tap behind
      const basin = box(w - 40, 180, d - 40, M.gasket)
      place(basin, f.at.x, f.at.y, 850)
      g.add(basin)
      const room = model.roomById.get(f.room)
      const dy = f.at.y - (room?.centroid.y ?? f.at.y)
      const back = Math.sign(dy) || 1
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 16 * S, 320 * S, 10), M.steel)
      tap.position.set(f.at.x * S, (940 + 160) * S, (f.at.y + back * (d / 2 - 30)) * S)
      g.add(tap)
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(9 * S, 9 * S, 220 * S, 8), M.steel)
      spout.rotation.x = Math.PI / 2
      spout.position.set(f.at.x * S, (940 + 300) * S, (f.at.y + back * (d / 2 - 140)) * S)
      g.add(spout)
      continue
    }
    if (f.kind === 'wc') {
      // a wall-hung pan with its cistern plate on the wall behind
      const room = model.roomById.get(f.room)
      const dx = f.at.x - (room?.centroid.x ?? f.at.x)
      const dy = f.at.y - (room?.centroid.y ?? f.at.y)
      const alongX = Math.abs(dx) >= Math.abs(dy)
      const sgn = alongX ? Math.sign(dx) || 1 : Math.sign(dy) || 1
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.46 * S, Math.min(w, d) * 0.36 * S, 240 * S, 20), M.marble)
      pan.scale.set(alongX ? 1.35 : 1, 1, alongX ? 1 : 1.35)
      pan.position.set((f.at.x - (alongX ? sgn * 40 : 0)) * S, 320 * S, (f.at.y - (alongX ? 0 : sgn * 40)) * S)
      pan.castShadow = true
      g.add(pan)
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.47 * S, Math.min(w, d) * 0.47 * S, 24 * S, 20), M.appliance)
      seat.scale.copy(pan.scale)
      seat.position.set(pan.position.x, 452 * S, pan.position.z)
      g.add(seat)
      const box2 = box(alongX ? 90 : Math.max(w, d) * 0.9, 380, alongX ? Math.max(w, d) * 0.9 : 90, M.marble)
      place(box2, f.at.x + (alongX ? sgn * (w / 2 - 45) : 0), f.at.y + (alongX ? 0 : sgn * (d / 2 - 45)), 330)
      g.add(box2)
      const plate = box(alongX ? 6 : 220, 150, alongX ? 220 : 6, M.steel)
      place(plate, f.at.x + (alongX ? sgn * (w / 2 - 2) : 0), f.at.y + (alongX ? 0 : sgn * (d / 2 - 2)), 1000)
      g.add(plate)
      continue
    }
    const mat = f.kind === 'counter' || f.kind === 'basin' ? M.timber
      : f.kind === 'washer' ? M.timber : M.appliance
    const m = box(w, h, d, mat, 0, h / 2, 0)
    place(m, f.at.x, f.at.y)
    m.position.y = (h / 2) * S
    g.add(m)
    if (f.kind === 'washer') {
      // the integrated dishwasher: a panelled front, one bar handle
      const room = model.roomById.get(f.room)
      const dy = f.at.y - (room?.centroid.y ?? f.at.y)
      const front = -(Math.sign(dy) || 1)
      const handle = box(w - 120, 14, 14, M.metal)
      place(handle, f.at.x, f.at.y + front * (d / 2 + 12), 780)
      g.add(handle)
    }
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
  const ceilingOn = uiState.show3d.ceiling
  const roofOpen = uiState.show3d.roofOpen
  const shutRef = useRef(doorsShut)
  shutRef.current = doorsShut
  const bedRef = useRef(wallBed)
  bedRef.current = wallBed
  const ceilingRef = useRef(ceilingOn)
  ceilingRef.current = ceilingOn
  const roofRef = useRef(roofOpen)
  roofRef.current = roofOpen
  const applyToggles = (sc: THREE.Scene, shut: boolean, down: boolean, ceiling: boolean, roof: boolean): void => {
    sc.traverse((o) => {
      if (o.name === 'doors-open') o.visible = !shut
      if (o.name === 'doors-shut') o.visible = shut
      if (o.name === 'wallbed-down') o.visible = down
      if (o.name === 'ceiling') o.visible = ceiling
      if (o.name === 'roof-open') o.visible = roof
      if (o.name === 'roof-shut') o.visible = !roof
    })
  }
  useEffect(() => {
    if (sceneRef.current) applyToggles(sceneRef.current, doorsShut, wallBed, ceilingOn, roofOpen)
  }, [doorsShut, wallBed, ceilingOn, roofOpen])

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
    // 1.5 not 2: a retina iPad at full ratio pushes four times the pixels of a
    // laptop through a forward renderer with dozens of lights, and it lagged
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
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
    // Reflections for the polished pieces: a neutral room environment, given to the
    // fountain's marble and water only, so the rest of the house keeps its look.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    for (const mat of [M.fountainMarble, M.fountainWater]) {
      mat.envMap = envTex
      mat.needsUpdate = true
    }
    pmrem.dispose()
    scene.add(buildScene(M))
    applyToggles(scene, shutRef.current, bedRef.current, ceilingRef.current, roofRef.current)
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
    // A fixed viewpoint from the URL, in plan mm: #cam=x,y,z,tx,ty,tz (eye, then the
    // point looked at). For review screenshots and for sharing a particular view.
    const applyCamHash = (): boolean => {
      const camHash = /[#&]cam=([-\d.,]+)/.exec(window.location.hash)
      if (!camHash) return false
      const v = camHash[1].split(',').map(Number)
      if (v.length !== 6 || !v.every((n) => Number.isFinite(n))) return false
      camera.position.set(v[0] * S, v[1] * S, v[2] * S)
      orbit.target.set(v[3] * S, v[4] * S, v[5] * S)
      orbit.update()
      return true
    }
    applyCamHash()
    window.addEventListener('hashchange', applyCamHash)
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
    // Where to stand in a room: its centroid, unless a piece stands there (the deck's
    // centroid is the fountain's bowl), in which case the nearest clear spot on a ring
    // round it — inside the room, 400 clear of every piece of furniture and fixture.
    const clearStand = (room: (typeof model.rooms)[number]): { x: number; y: number } => {
      const blocked = (x: number, y: number): boolean =>
        !pointInPolygon({ x, y }, room.polygon) ||
        furniture.some((f) => f.room === room.id && f.kind !== 'rug' && f.kind !== 'grass' &&
          x > f.x - 400 && x < f.x + f.w + 400 && y > f.y - 400 && y < f.y + f.d + 400) ||
        fixtures.some((f) => f.room === room.id &&
          x > f.at.x - f.size[0] / 2 - 400 && x < f.at.x + f.size[0] / 2 + 400 &&
          y > f.at.y - f.size[1] / 2 - 400 && y < f.at.y + f.size[1] / 2 + 400)
      const c = room.centroid
      if (!blocked(c.x, c.y)) return c
      for (const r of [800, 1400, 2000, 2800, 3600]) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2
          const x = c.x + Math.cos(a) * r
          const y = c.y + Math.sin(a) * r
          if (!blocked(x, y)) return { x, y }
        }
      }
      return c
    }
    standRef.current = (roomId, dir) => {
      const room = model.roomById.get(roomId)
      if (!room) return
      const at = clearStand(room)
      const px = at.x * S
      const pz = at.y * S
      const d = dir === 'N' ? [0, -3] : dir === 'S' ? [0, 3] : dir === 'E' ? [3, 0] : [-3, 0]
      camera.position.set(px, 1.62, pz)
      orbit.target.set(px + d[0], 1.45, pz + d[1])
      if (touchWalk.enabled) {
        camera.lookAt(orbit.target)
        touchWalk.sync()
      } else orbit.update()
    }

    const lock = new PointerLockControls(camera, renderer.domElement)
    const touchWalk = createTouchWalk(camera, renderer.domElement, mount, { eye: 1.62, speed: 0.55 })
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
      window.removeEventListener('hashchange', applyCamHash)
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
          <button
            onClick={() => uiUpdate((st) => ({ ...st, show3d: { ...st.show3d, ceiling: !st.show3d.ceiling } }))}
            title="The plaster ceilings with their lights and cornices; off for a top-down look at the plan"
          >
            Ceiling: {ceilingOn ? 'on' : 'off'}
          </button>
          {solids.roofs.some((r) => r.kind === 'barrel' && r.retractable) && (
            <button
              onClick={() => uiUpdate((st) => ({ ...st, show3d: { ...st.show3d, roofOpen: !st.show3d.roofOpen } }))}
              title="The telescoping glass roof: split at the centre, each half stacks at its own end"
            >
              Roof: {roofOpen ? 'open' : 'closed'}
            </button>
          )}
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
          ? 'Thumb stick to walk, push to the rim to hurry · drag to look · pinch to zoom the lens · EYE and TILT rails on the right set your height and view angle · Exit walk to release'
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
