/**
 * The planted strips inside the parapets - the deck's and both terraces' - as
 * a row of small trees in a rhythm: a pair of trees, then a globe lamp in a
 * short gap, then a pair again. Each tree is the great-room tree at a smaller
 * scale - a trunk, three branches with a tuft of foliage on each and a crown -
 * standing in the bed with its crown overhanging it, the way a tree's crown
 * overhangs any bed. The lamps carry the run's light.
 */

import * as THREE from 'three'
import type { FurnitureItem } from '../data/furniture'
import { S } from './prism'

export interface HedgeMats {
  bed: THREE.Material
  leaf: THREE.Material
  leafDark: THREE.Material
  trunk?: THREE.Material
}

export const HEDGE_TOP = 1900
/** The small trees: about two-thirds of the great-room tree. */
const TREE_H = 1750
const TREE_R = 330
const BUSH = 1829          // six feet of hedge
const GAP = 450            // the lamp's gap between bushes

/** Deterministic jitter, the same on every load and in both renderers. */
function jitter(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}


export function hedgeGroup(f: FurnitureItem, M: HedgeMats, bed?: THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group()
  if (bed) g.add(bed)
  const alongX = f.w >= f.d
  const long = alongX ? f.w : f.d
  const across = alongX ? f.d : f.w
  const half = Math.max(50, across / 2 - 10)

  // the rhythm along the strip: bush, gap with a lamp, bush ... a last bush is
  // kept if it is at least half a bush long
  const runs: Array<[number, number]> = []
  const lamps: number[] = []
  let s = 0
  while (s < long - 10) {
    const e = Math.min(long, s + BUSH)
    if (e - s >= BUSH * 0.45) runs.push([s, e])
    s = e + GAP
    if (s < long - 10) lamps.push(e + GAP / 2)
  }

  const toWorld = (u: number, v: number, h: number) => ({
    x: (alongX ? f.x + u : f.x + f.w / 2 + v) * S,
    y: h * S,
    z: (alongX ? f.y + f.d / 2 + v : f.y + u) * S,
  })
  const trunkMat = M.trunk ?? new THREE.MeshStandardMaterial({ color: 0x6d5334, roughness: 0.9 })

  // a small tree: the great-room tree's build at a smaller scale
  const tree = (u: number, k: number) => {
    const height = TREE_H * (0.92 + jitter(k, 1) * 0.16)
    const R0 = TREE_R * (0.9 + jitter(k, 2) * 0.2)
    const base = toWorld(u, 0, 0)
    const t = new THREE.Group()
    t.position.set(base.x, 0, base.z)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(38 * S, 52 * S, height * 0.45 * S, 9), trunkMat)
    trunk.position.y = height * 0.225 * S
    trunk.castShadow = true
    t.add(trunk)
    const branchTop = height * 0.62
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6 + jitter(k, 3) * 1.2
      const bx = Math.cos(a) * R0 * 0.45
      const bz = Math.sin(a) * R0 * 0.45
      const from = new THREE.Vector3(0, height * 0.42 * S, 0)
      const to = new THREE.Vector3(bx * S, branchTop * S, bz * S)
      const len = from.distanceTo(to)
      const br = new THREE.Mesh(new THREE.CylinderGeometry(12 * S, 22 * S, len, 6), trunkMat)
      br.position.copy(from).add(to).multiplyScalar(0.5)
      br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
      t.add(br)
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(R0 * 0.5 * S, 9, 7), i % 2 ? M.leaf : M.leafDark)
      tuft.position.set(bx * S, (branchTop + R0 * 0.2) * S, bz * S)
      tuft.scale.set(1, 0.8, 1)
      tuft.castShadow = true
      t.add(tuft)
    }
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R0 * 0.62 * S, 10, 8), M.leaf)
    crown.position.y = (branchTop + R0 * 0.5) * S
    crown.scale.set(1, 0.85, 1)
    crown.castShadow = true
    t.add(crown)
    g.add(t)
  }
  let k = 0
  for (const [u0, u1] of runs) {
    const len = u1 - u0
    if (len >= 1200) { tree(u0 + len * 0.3, k++); tree(u0 + len * 0.7, k++) }
    else tree((u0 + u1) / 2, k++)
  }
  void half

  // the globe lamps in the gaps: a slim post, a glowing globe, and the light it throws
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 })
  const globeMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc866, emissiveIntensity: 1.8, roughness: 0.4 })
  lamps.forEach((u, li) => {
    const base = toWorld(u, 0, 0)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 22 * S, 700 * S, 10), postMat)
    post.position.set(base.x, 300 * S + 350 * S, base.z)
    post.castShadow = true
    g.add(post)
    const globe = new THREE.Mesh(new THREE.SphereGeometry(Math.min(150, half - 10) * S, 20, 14), globeMat)
    globe.position.set(base.x, 1150 * S, base.z)
    g.add(globe)
    // every globe glows; every third one carries a real light with a wider throw,
    // which lights the run the same and costs a third of the shading
    if (li % 4 === 0) {
      const light = new THREE.PointLight(0xffd27a, 1.7, 7.0, 1.6)
      light.position.set(base.x, 1150 * S, base.z)
      g.add(light)
    }
  })
  return g
}
