/**
 * The planted strip inside the deck parapet, as a clipped hedge.
 *
 * From inside the home the eye is at 1620 mm; the hedge tops out around 1900, so
 * the sightline over it from the great room climbs at about 3 degrees and the
 * city below and beyond drops out of view - what is left is bushes and sky. It is
 * built as overlapping foliage ellipsoids in three tiers, squeezed across the
 * strip so every one of them stays inside the drawn 340 mm bed: the 2D-to-3D
 * footprint gate holds for the hedge exactly as it does for a sofa.
 */

import * as THREE from 'three'
import type { FurnitureItem } from '../data/furniture'
import { S } from './prism'

export interface HedgeMats {
  bed: THREE.Material
  leaf: THREE.Material
  leafDark: THREE.Material
}

export const HEDGE_TOP = 1900

/** Deterministic jitter, so the hedge is the same on every load and in both renderers. */
function jitter(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function hedgeGroup(f: FurnitureItem, M: HedgeMats, bed?: THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group()
  if (bed) g.add(bed)
  const alongX = f.w >= f.d
  const long = alongX ? f.w : f.d
  const across = alongY(f)
  const R = 380
  const half = Math.max(60, across / 2 - 10)          // the foliage never leaves the bed
  const pitch = 430
  const tiers = [520, 1050, 1580]
  const n = Math.max(1, Math.floor((long - 2 * R) / pitch) + 1)
  const start = R + (long - 2 * R - (n - 1) * pitch) / 2
  for (let ti = 0; ti < tiers.length; ti++) {
    for (let i = 0; i < n; i++) {
      const j = jitter(i, ti)
      const r = R * (0.88 + 0.22 * j)
      const along = start + i * pitch + (ti % 2 ? pitch / 2 : 0)
      if (along < r || along > long - r) continue
      const h = tiers[ti] + (ti === tiers.length - 1 ? (j - 0.5) * 140 : 0)
      const top = Math.min(h + r * 0.9, HEDGE_TOP + 90)
      const cy = top - r * 0.9
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 10, 7), (i + ti) % 3 === 0 ? M.leafDark : M.leaf)
      m.scale.set(alongX ? 1 : half / r, 0.9, alongX ? half / r : 1)
      const px = alongX ? f.x + along : f.x + f.w / 2
      const pz = alongX ? f.y + f.d / 2 : f.y + along
      m.position.set(px * S, cy * S, pz * S)
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
  }
  return g
}

function alongY(f: FurnitureItem): number {
  return f.w >= f.d ? f.d : f.w
}
