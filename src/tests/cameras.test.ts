/**
 * Preset cameras must be able to SEE the room they claim to show.
 *
 * The service-wing preset shipped with the camera buried inside the south external wall,
 * framing a blank plaster face. Nothing caught it: the geometry was correct, the model
 * reconciled, the build was green, and the only symptom was a picture. So this raycasts
 * from each preset to its target through the real wall meshes and fails if anything is
 * in the way.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PRESETS, presetCamera } from '../render3d/cameras'
import { prismGeometry, S } from '../render3d/prism'
import { getModel } from '../geometry/model'
import { buildSolids } from '../geometry/solid'

const model = getModel()
const solids = buildSolids(model)

/** Opaque fabric only — glass is meant to be seen through. */
const occluders = solids.prisms
  .filter((p) => !p.transparent && p.polygon.length >= 3)
  .map((p) => {
    const m = new THREE.Mesh(prismGeometry(p.polygon, p.base, p.top))
    m.userData.id = p.id
    m.updateMatrixWorld(true)
    return m
  })

function firstHit(from: THREE.Vector3, to: THREE.Vector3): { dist: number; id: string } | null {
  const dir = to.clone().sub(from)
  const total = dir.length()
  dir.normalize()
  const ray = new THREE.Raycaster(from, dir, 0.01, total)
  const hits = ray.intersectObjects(occluders, false)
  return hits.length ? { dist: hits[0].distance, id: String(hits[0].object.userData.id) } : null
}

describe('preset cameras', () => {
  it('none is buried inside the building fabric', () => {
    const inside: string[] = []
    for (const p of PRESETS) {
      const { pos } = presetCamera(p)
      // Shoot a short ray straight down: starting inside a solid gives no exit hit at
      // all from outside, so instead check the camera is clear of every prism's box.
      for (const solid of solids.prisms) {
        if (solid.polygon.length < 3) continue
        const geo = prismGeometry(solid.polygon, solid.base, solid.top)
        geo.computeBoundingBox()
        const bb = geo.boundingBox!
        if (bb.containsPoint(pos)) inside.push(`${p.id} is inside ${solid.id}`)
      }
    }
    expect(inside.slice(0, 5)).toEqual([])
  })

  it('has a clear line of sight from every room camera to its target', () => {
    // The overview deliberately looks at the building as an object, so its target may sit
    // behind fabric; it is covered by the framing test below instead.
    const blocked: string[] = []
    for (const p of PRESETS) {
      if (!p.room) continue
      const { pos, look } = presetCamera(p)
      const hit = firstHit(pos, look)
      if (hit) {
        const total = pos.distanceTo(look)
        blocked.push(
          `${p.id}: blocked by ${hit.id} at ${(hit.dist / S / 1000).toFixed(2)} m of ${(total / S / 1000).toFixed(2)} m`,
        )
      }
    }
    expect(blocked).toEqual([])
  })

  it('frames each room wide enough to fit it across a 62 degree field', () => {
    const tight: string[] = []
    for (const p of PRESETS) {
      if (!p.room) continue
      const room = model.roomById.get(p.room)!
      const { pos, look } = presetCamera(p)
      const distance = pos.distanceTo(look)
      const visibleWidth = 2 * distance * Math.tan((62 * Math.PI) / 360)
      const needed = room.width * S
      if (visibleWidth < needed) {
        tight.push(`${p.id}: ${visibleWidth.toFixed(1)} m visible, room is ${needed.toFixed(1)} m wide`)
      }
    }
    expect(tight).toEqual([])
  })

  it('frames the whole building from the overview', () => {
    const overview = PRESETS.find((p) => !p.room)!
    const { pos, look } = presetCamera(overview)
    const distance = pos.distanceTo(look)
    const visibleWidth = 2 * distance * Math.tan((62 * Math.PI) / 360)
    const env = model.envelopeBBox
    expect(visibleWidth).toBeGreaterThan((env.maxX - env.minX) * S)
  })

  it('keeps every camera above the floor and outside the ground', () => {
    for (const p of PRESETS) {
      const { pos } = presetCamera(p)
      expect(pos.y).toBeGreaterThan(1.5)
      expect(Number.isFinite(pos.x) && Number.isFinite(pos.z)).toBe(true)
    }
  })
})
