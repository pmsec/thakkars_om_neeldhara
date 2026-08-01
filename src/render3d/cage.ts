/**
 * The metal growing cages at the north edge.
 *
 * A cage is a shallow steel basket cantilevered past the slab: outer and end faces of
 * vertical bars, three horizontal rails, and the soil it holds. Its outer face is where
 * the canopy glass comes down, so the two have to agree — `canopy.test.ts` asserts that
 * every canopy's springing line sits on its cage's outer face.
 *
 * Built here rather than in `Viewer3D.tsx` so the test suite can measure it.
 */

import * as THREE from 'three'
import type { CageDef } from '../data/schema'
import { S } from './prism'

/** Spacing of the vertical bars, mm. Close enough to hold soil behind a liner. */
const BAR_PITCH = 400
const BAR = 0.03

export interface CageMaterials {
  metal: THREE.Material
  soil: THREE.Material
}

/** The plan line the glass lands on: the cage's outer face. */
export function cageOuterY(cage: CageDef): number {
  return cage.at - cage.projection
}

export function cageGroup(cage: CageDef, mats: CageMaterials): THREE.Group {
  const g = new THREE.Group()
  const outer = cageOuterY(cage)
  const h = cage.height
  const len = cage.to - cage.from

  const bar = (x: number, y: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(BAR, h * S, BAR), mats.metal)
    m.position.set(x * S, (h * S) / 2, y * S)
    m.castShadow = true
    g.add(m)
  }
  const railAlong = (height: number, y: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len * S, BAR, BAR), mats.metal)
    m.position.set(((cage.from + cage.to) / 2) * S, height * S, y * S)
    m.castShadow = true
    g.add(m)
  }
  const railAcross = (height: number, x: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(BAR, BAR, cage.projection * S), mats.metal)
    m.position.set(x * S, height * S, ((cage.at + outer) / 2) * S)
    m.castShadow = true
    g.add(m)
  }

  // Vertical bars down the outer face, and one pair at each end.
  const n = Math.max(2, Math.round(len / BAR_PITCH))
  for (let i = 0; i <= n; i++) bar(cage.from + (len * i) / n, outer)
  for (const x of [cage.from, cage.to]) {
    bar(x, cage.at)
    bar(x, (cage.at + outer) / 2)
  }

  // Rails: bottom, middle and top on the outer face; top rail returning at each end.
  for (const height of [BAR_PITCH * 0.15, h / 2, h]) railAlong(height, outer)
  for (const x of [cage.from, cage.to]) railAcross(h, x)
  railAlong(h, cage.at)

  // Soil, sitting just below the top rail so the trees read as planted in it.
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(len * S, 0.04, cage.projection * S),
    mats.soil,
  )
  soil.position.set(
    ((cage.from + cage.to) / 2) * S,
    (h - 120) * S,
    ((cage.at + outer) / 2) * S,
  )
  soil.receiveShadow = true
  g.add(soil)

  return g
}
