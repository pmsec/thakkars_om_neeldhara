/**
 * The 2D↔3D fidelity gates, packaged for the Model integrity page — the same
 * checks that fail the build in CI, run live in the browser so a failure is
 * visible IN THE APP with its reasoning, not only in a terminal.
 */

import * as THREE from 'three'
import { fixtures } from '../data/fixtures'
import { furniture } from '../data/furniture'
import { furnitureMesh, type Mats } from '../render3d/Realistic'
import { furnitureObject } from '../render3d/Viewer3D'
import { S } from '../render3d/prism'
import { KNOWN_2D_CLASHES, outsideEnvelope, wallCrossings, type Crossing } from './fidelity'

export interface ProjectionViolation {
  renderer: string
  itemId: string
  itemLabel: string
  /** Which way it escapes its drawn footprint, and by how much (mm). */
  direction: string
  overshootMm: number
}

export interface FidelityReport {
  crossings: Crossing[]
  outside: Crossing[]
  projection: ProjectionViolation[]
  piecesChecked: number
  fixturesChecked: number
  known: typeof KNOWN_2D_CLASHES
}

const TOL = 30

export function runFidelity(): FidelityReport {
  const materialStub = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() }) as Mats
  const builders: Array<[string, (f: (typeof furniture)[number]) => THREE.Object3D | null]> = [
    ['styled/walkthrough', (f) => furnitureMesh(f, materialStub)],
    ['technical 3D', (f) => furnitureObject(f, [])],
  ]
  const projection: ProjectionViolation[] = []
  let piecesChecked = 0
  for (const [renderer, build] of builders) {
    for (const f of furniture) {
      if (f.kind === 'tree') continue // crowns overhang the planting square, as drawn
      const o = build(f)
      if (!o) continue
      piecesChecked++
      o.updateMatrixWorld(true)
      const bb = new THREE.Box3().setFromObject(o)
      if (bb.isEmpty()) continue
      const checks: Array<[string, number]> = [
        ['west', f.x - TOL - bb.min.x / S],
        ['east', bb.max.x / S - (f.x + f.w + TOL)],
        ['north', f.y - TOL - bb.min.z / S],
        ['south', bb.max.z / S - (f.y + f.d + TOL)],
      ]
      for (const [direction, over] of checks) {
        if (over > 0) {
          projection.push({
            renderer, itemId: f.id, itemLabel: f.label, direction,
            overshootMm: Math.round(over + TOL),
          })
        }
      }
    }
  }
  return {
    crossings: wallCrossings(),
    outside: outsideEnvelope(),
    projection,
    piecesChecked,
    fixturesChecked: fixtures.length,
    known: KNOWN_2D_CLASHES,
  }
}
