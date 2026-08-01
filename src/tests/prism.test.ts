/**
 * Plan-to-scene mapping for the 3D viewer.
 *
 * The `bounds-3d` integrity check compares the ABSTRACT solid model against the 2D
 * envelope, which is a real check but says nothing about how the renderer places those
 * solids. It passed at 0.0000 mm while every wall and floor in the actual scene was
 * mirrored north-south and lifted to twice its height, because furniture and glazing
 * were positioned by a different code path that happened to be correct.
 *
 * These tests close that gap: they assert the geometry the renderer really builds.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { prismGeometry, S } from '../render3d/prism'
import { getModel } from '../geometry/model'
import { buildSolids } from '../geometry/solid'
import { bbox } from '../geometry/vec'

const mm = (v: number): number => v / S

function worldBox(geo: THREE.BufferGeometry): { min: number[]; max: number[] } {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  return {
    min: [mm(b.min.x), mm(b.min.y), mm(b.min.z)],
    max: [mm(b.max.x), mm(b.max.y), mm(b.max.z)],
  }
}

describe('plan -> scene mapping', () => {
  const square = [
    { x: 1000, y: 2000 },
    { x: 4000, y: 2000 },
    { x: 4000, y: 7000 },
    { x: 1000, y: 7000 },
  ]

  it('puts model x on scene x and model y on scene z, WITHOUT mirroring', () => {
    const b = worldBox(prismGeometry(square, 0, 3050))
    expect(b.min[0]).toBeCloseTo(1000, 3)
    expect(b.max[0]).toBeCloseTo(4000, 3)
    // The bug this guards against produced z of -7000..-2000 here.
    expect(b.min[2]).toBeCloseTo(2000, 3)
    expect(b.max[2]).toBeCloseTo(7000, 3)
  })

  it('lifts a prism from its base to its top, not from its top', () => {
    const b = worldBox(prismGeometry(square, 0, 3050))
    expect(b.min[1]).toBeCloseTo(0, 3)
    expect(b.max[1]).toBeCloseTo(3050, 3)
    // A lintel above a door head must sit between head and ceiling.
    const lintel = worldBox(prismGeometry(square, 2100, 3050))
    expect(lintel.min[1]).toBeCloseTo(2100, 3)
    expect(lintel.max[1]).toBeCloseTo(3050, 3)
    // And a floor slab hangs below level zero.
    const slab = worldBox(prismGeometry(square, -150, 0))
    expect(slab.min[1]).toBeCloseTo(-150, 3)
    expect(slab.max[1]).toBeCloseTo(0, 3)
  })

  it('keeps face winding outward after the mirror', () => {
    // A mirrored shape with un-reversed rings triangulates inside-out, which reads as a
    // hollow shell lit from within. Check the +x face's normal actually points +x.
    const geo = prismGeometry(square, 0, 1000)
    geo.computeVertexNormals()
    const pos = geo.getAttribute('position')
    const nrm = geo.getAttribute('normal')
    let found = false
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(mm(pos.getX(i)) - 4000) < 0.5 && Math.abs(nrm.getX(i)) > 0.9) {
        expect(nrm.getX(i)).toBeGreaterThan(0)
        found = true
      }
    }
    expect(found).toBe(true)
  })
})

describe('the rendered scene matches the 2D plan', () => {
  const model = getModel()
  const solids = buildSolids(model)

  it('every wall prism the renderer builds lands on its own plan footprint', () => {
    const offenders: string[] = []
    for (const p of solids.prisms) {
      if (p.polygon.length < 3) continue
      const plan = bbox(p.polygon)
      const b = worldBox(prismGeometry(p.polygon, p.base, p.top))
      const off =
        Math.abs(b.min[0] - plan.minX) +
        Math.abs(b.max[0] - plan.maxX) +
        Math.abs(b.min[2] - plan.minY) +
        Math.abs(b.max[2] - plan.maxY) +
        Math.abs(b.min[1] - p.base) +
        Math.abs(b.max[1] - p.top)
      if (off > 0.01) offenders.push(`${p.id}: off by ${off.toFixed(3)} mm`)
    }
    expect(offenders.slice(0, 8)).toEqual([])
  })

  it('the whole rendered fabric sits inside the envelope and under the ceiling', () => {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    let maxY = -Infinity
    for (const p of solids.prisms) {
      if (p.polygon.length < 3) continue
      const b = worldBox(prismGeometry(p.polygon, p.base, p.top))
      minX = Math.min(minX, b.min[0])
      maxX = Math.max(maxX, b.max[0])
      minZ = Math.min(minZ, b.min[2])
      maxZ = Math.max(maxZ, b.max[2])
      maxY = Math.max(maxY, b.max[1])
    }
    const env = model.envelopeBBox
    expect(minX).toBeGreaterThanOrEqual(env.minX - 1)
    expect(maxX).toBeLessThanOrEqual(env.maxX + 1)
    expect(minZ).toBeGreaterThanOrEqual(env.minY - 1)
    expect(maxZ).toBeLessThanOrEqual(env.maxY + 1)
    // 6100 was the symptom of lifting prisms by `top` instead of `base`.
    expect(maxY).toBeCloseTo(model.data.levels.ceiling, 3)
  })

  it('furniture and walls occupy the same coordinate space', () => {
    // The bug was invisible in isolation: furniture was right, fabric was mirrored, and
    // only their disagreement showed it. Assert they agree by construction.
    const great = model.roomById.get('R-GREAT')!
    const sofa = prismGeometry(
      [
        { x: 10590, y: 4180 },
        { x: 13890, y: 4180 },
        { x: 13890, y: 5130 },
        { x: 10590, y: 5130 },
      ],
      0,
      750,
    )
    const b = worldBox(sofa)
    const cx = (b.min[0] + b.max[0]) / 2
    const cz = (b.min[2] + b.max[2]) / 2
    expect(cx).toBeGreaterThan(great.bbox.minX)
    expect(cx).toBeLessThan(great.bbox.maxX)
    expect(cz).toBeGreaterThan(great.bbox.minY)
    expect(cz).toBeLessThan(great.bbox.maxY)
  })
})
