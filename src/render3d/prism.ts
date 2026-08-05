/**
 * Plan-to-scene geometry. Pure three.js, no DOM, so the test suite can assert it.
 *
 * This exists because it got the mapping wrong once and nothing caught it. The model is
 * authored with x along the building and y across it, y increasing toward the lobby.
 * The scene wants (model x, height, model y).
 *
 * A THREE.Shape extrudes in its own XY plane along +Z, giving (a, b, t). Getting from
 * there to (a, t, b) is a SWAP of the last two axes, and a swap is a reflection, not a
 * rotation — `rotateX(-90°)` maps (x, y, z) to (x, z, -y) and silently mirrors the whole
 * plan north-south. The shape is therefore built with y already negated, and its rings
 * reversed so the mirroring does not also invert the face winding.
 */

import * as THREE from 'three'
import type { Poly, Pt } from '../geometry/vec'

/** Millimetres to scene metres. */
export const S = 0.001

/** Drop near-duplicate vertices: boolean-derived outlines carry thousands of
 * sampled points and earcut quietly produces degenerate triangles on them. */
export function decimate(poly: Poly, tol = 18): Poly {
  const out: Poly = []
  for (const p of poly) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > tol) out.push(p)
  }
  if (out.length > 2) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.hypot(a.x - b.x, a.y - b.y) <= tol) out.pop()
  }
  return out.length >= 3 ? out : poly
}

function toVec(p: Pt): THREE.Vector2 {
  return new THREE.Vector2(p.x * S, -p.y * S)
}

export function shapeFrom(poly: Poly, holes: Poly[] = []): THREE.Shape {
  const shape = new THREE.Shape([...poly].reverse().map(toVec))
  for (const h of holes) shape.holes.push(new THREE.Path([...h].reverse().map(toVec)))
  return shape
}

/**
 * Extrude a plan polygon between two heights, in millimetres above finished floor.
 * The result occupies exactly [minX..maxX] × [base..top] × [minY..maxY] in scene metres.
 */
export function prismGeometry(
  poly: Poly,
  base: number,
  top: number,
  holes: Poly[] = [],
): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(poly, holes), {
    depth: (top - base) * S,
    bevelEnabled: false,
  })
  // (x, y, z) -> (x, z, -y). Combined with the negated y in shapeFrom this is the swap
  // we actually want, and it leaves the extrusion running up the scene's +Y.
  geo.rotateX(-Math.PI / 2)
  // The extrusion starts at 0, so lift it by the BASE, not the top.
  geo.translate(0, base * S, 0)
  return geo
}
