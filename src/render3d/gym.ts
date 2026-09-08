/**
 * The all-in-one strength trainer on the deck: a cable machine, built inside its
 * drawn footprint so the 2D-to-3D footprint gate still holds. Two uprights with a
 * crossbar and a pulley at the back, the weight stack between them, a lat bar
 * hanging from the crossbar, and a bench down the front. Shared by the technical
 * 3D tab and the walkthrough, each passing its own materials.
 */

import * as THREE from 'three'
import type { FurnitureItem } from '../data/furniture'
import { S } from './prism'

export interface GymMats {
  metal: THREE.Material
  weights: THREE.Material
  pad: THREE.Material
}

export function isStrengthTrainer(f: FurnitureItem): boolean {
  return /strength trainer|gym|cable machine/i.test(f.label)
}

export function strengthTrainer(f: FurnitureItem, M: GymMats): THREE.Group {
  const g = new THREE.Group()
  const cx = f.x + f.w / 2
  const cy = f.y + f.d / 2
  // long axis along the deeper side; "back" is the end away from the room's open side
  const alongY = f.d >= f.w
  const len = alongY ? f.d : f.w
  const wid = alongY ? f.w : f.d
  const H = Math.min(f.height, 2200)

  // local frame: u along the machine's length (back at +u), v across it
  const put = (m: THREE.Mesh, u: number, h: number, v: number) => {
    m.position.set((cx + (alongY ? v : u)) * S, h * S, (cy + (alongY ? u : v)) * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const box = (lu: number, lh: number, lv: number, mat: THREE.Material, u: number, h: number, v: number) =>
    put(new THREE.Mesh(new THREE.BoxGeometry((alongY ? lv : lu) * S, lh * S, (alongY ? lu : lv) * S), mat), u, h, v)
  const bar = (r: number, length: number, mat: THREE.Material, u: number, h: number, v: number, axis: 'u' | 'v' | 'h') => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, length * S, 12), mat)
    if (axis === 'v') m.rotation.z = Math.PI / 2
    if (axis === 'u') m.rotation.x = Math.PI / 2
    if (axis !== 'h' && alongY === (axis === 'v')) { /* already across x */ }
    if (axis === 'v' && alongY) m.rotation.set(0, 0, Math.PI / 2)
    if (axis === 'v' && !alongY) m.rotation.set(Math.PI / 2, 0, 0)
    if (axis === 'u' && alongY) m.rotation.set(Math.PI / 2, 0, 0)
    if (axis === 'u' && !alongY) m.rotation.set(0, 0, Math.PI / 2)
    put(m, u, h, v)
  }

  const back = len / 2 - 120
  const halfV = wid / 2 - 120
  // floor rails and the two uprights with a crossbar
  box(len - 100, 40, 60, M.metal, 0, 20, -halfV)
  box(len - 100, 40, 60, M.metal, 0, 20, halfV)
  box(60, 40, wid - 180, M.metal, back, 20, 0)
  for (const s of [-1, 1]) box(60, H, 60, M.metal, back, H / 2, s * halfV)
  box(60, 60, wid - 180, M.metal, back, H - 30, 0)
  // the weight stack between the uprights, with its guide rods and a top pulley
  box(160, 1150, 340, M.weights, back - 10, 100 + 1150 / 2, 0)
  for (const s of [-1, 1]) bar(10, H - 200, M.metal, back - 10, (H - 200) / 2 + 60, s * 140, 'h')
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(70 * S, 70 * S, 40 * S, 20), M.metal)
  if (alongY) pulley.rotation.set(0, 0, Math.PI / 2)
  else pulley.rotation.set(Math.PI / 2, 0, 0)
  put(pulley, back - 40, H - 120, 0)
  // the lat bar hanging under the crossbar, and the cable to it
  bar(6, 700, M.metal, back - 40, H - 120 - 350, 0, 'h')
  bar(16, wid - 260, M.metal, back - 40, H - 120 - 700, 0, 'v')
  // the bench down the front: pad on a frame
  const benchL = Math.min(1150, len - 700)
  const benchU = -len / 2 + 120 + benchL / 2
  box(benchL, 60, 320, M.pad, benchU, 440, 0)
  box(benchL - 200, 380, 80, M.metal, benchU, 220, 0)
  box(80, 380, 300, M.metal, benchU - benchL / 2 + 80, 220, 0)
  box(80, 380, 300, M.metal, benchU + benchL / 2 - 80, 220, 0)
  return g
}
