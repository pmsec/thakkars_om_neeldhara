/**
 * Meshes for the curved glass canopies.
 *
 * Kept out of `Viewer3D.tsx` for the same reason `prism.ts` is: the canopy is now
 * ENCLOSURE, not decoration — it is what stands where the deck's and the terraces'
 * external walls used to. If it is placed wrongly the building is open to the weather,
 * and the abstract solid model cannot catch that because it holds no roof surfaces. So
 * the mapping lives here, where `canopy.test.ts` can measure it.
 *
 * Section coordinates are (model y, height) and are ABSOLUTE, not relative to the roof's
 * plan extent — the extent is only the plan bounding box, and its y0 is negative
 * precisely because the glass bulges outside the building line.
 */

import * as THREE from 'three'
import { barrelProfile, gableOutline, type RoofSurface } from '../geometry/solid'
import { S } from './prism'

/** Section samples across the vault, and bays along it every ~500 mm. */
const N = 48

/**
 * The vault itself, lofted as a ribbon. A canopy is a SURFACE, not a solid: extruding
 * the section as a THREE.Shape closes it back to its own chord and the vault comes out
 * as a solid glass lens lying across the deck.
 */
export function vaultGeometry(roof: RoofSurface): THREE.BufferGeometry {
  const [x0, , x1] = roof.extent
  const profile = barrelProfile(roof.section!, N)
  const bays = Math.max(2, Math.round((x1 - x0) / 500))

  const pos: number[] = []
  for (let j = 0; j <= bays; j++) {
    const x = x0 + ((x1 - x0) * j) / bays
    for (const q of profile) pos.push(x * S, q.y * S, q.x * S)
  }
  const idx: number[] = []
  for (let j = 0; j < bays; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i
      const b = a + (N + 1)
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/**
 * The glazed gable closing one end of a vault: curved along the section, straight down
 * the wall line. Used where the vault stops against the building's own face rather than
 * against an open shaft.
 */
export function gableGeometry(roof: RoofSurface, end: 'x0' | 'x1'): THREE.BufferGeometry {
  const [x0, , x1] = roof.extent
  const x = end === 'x0' ? x0 : x1
  const ring = gableOutline(roof.section!, N)

  const shape = new THREE.Shape()
  shape.moveTo(ring[0].x * S, ring[0].y * S)
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i].x * S, ring[i].y * S)
  shape.closePath()

  const geo = new THREE.ShapeGeometry(shape)
  // ShapeGeometry lies in XY. rotateY(-90°) maps (u, v, 0) -> (0, v, u), so the panel
  // stands in the y-z plane — height on scene y, model y on scene z — at a constant x.
  geo.rotateY(-Math.PI / 2)
  geo.translate(x * S, 0, 0)
  return geo
}

/** Where the closing mullion of a gable stands: [scene x, height, scene z] in metres. */
export function gableJamb(
  roof: RoofSurface,
  end: 'x0' | 'x1',
): { x: number; height: number; z: number } {
  const [x0, , x1] = roof.extent
  const profile = barrelProfile(roof.section!, N)
  const last = profile[profile.length - 1]
  return { x: (end === 'x0' ? x0 : x1) * S, height: last.y * S, z: last.x * S }
}
