/**
 * The curved glass canopies, measured as the renderer actually builds them.
 *
 * These are load-bearing for the drawing's meaning: the deck and both private terraces
 * have no external wall and no upright pane any more, so if a canopy is misplaced the
 * building is open to the weather and nothing else in the suite would notice —
 * `bounds-3d` compares the abstract solid model, which holds no roof surfaces at all.
 *
 * The bug this pins down was real: the section is authored in ABSOLUTE model
 * coordinates, but the renderer added the extent's y0 to it, which shifted the whole
 * deck vault 700 mm north and left it landing 700 mm short of the wall head.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { building } from '../data/building'
import { getModel } from '../geometry/model'
import { barrelProfile, buildSolids, canopyHeightAt, gableOutline } from '../geometry/solid'
import { furniture } from '../data/furniture'
import { gableGeometry, gableJamb, vaultGeometry } from '../render3d/canopy'
import { cageGroup, cageOuterY } from '../render3d/cage'
import { treeEnvelope } from '../render3d/tree'
import { S } from '../render3d/prism'

const mm = (v: number): number => v / S
const solids = buildSolids(getModel())
const barrels = solids.roofs.filter((r) => r.kind === 'barrel')

function worldBox(geo: THREE.BufferGeometry): {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
} {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  return {
    min: { x: mm(b.min.x), y: mm(b.min.y), z: mm(b.min.z) },
    max: { x: mm(b.max.x), y: mm(b.max.y), z: mm(b.max.z) },
  }
}

describe('curved glass canopies', () => {
  it('models three of them: the deck and both private terraces', () => {
    expect(barrels.map((r) => r.id).sort()).toEqual([
      'ROOF-DECK',
      'ROOF-K-TERRACE',
      'ROOF-P-TERRACE',
    ])
  })

  it('places the vault by the section, not by the extent — no y0 offset', () => {
    for (const roof of barrels) {
      const sec = roof.section!
      const box = worldBox(vaultGeometry(roof))
      // 48 is the section resolution the mesh is built at; a finer sampling would find a
      // very slightly higher crown between two of its facets.
      const prof = barrelProfile(sec, 48)

      // Springs at floor level on the building line, and lands at the wall head.
      expect(sec.p0.y).toBe(0)
      expect(sec.p2.y).toBe(building.levels.ceiling)
      expect(box.min.y).toBeCloseTo(0, 2)
      expect(box.max.y).toBeCloseTo(Math.max(...prof.map((q) => q.y)), 2)

      // Scene z is model y. The vault must span exactly the section, springing line to
      // landing line — this is the assertion that fails if the extent is added back in.
      expect(box.min.z).toBeCloseTo(Math.min(...prof.map((q) => q.x)), 2)
      expect(box.max.z).toBeCloseTo(sec.p2.x, 2)

      // And along the building, exactly the authored plan extent.
      expect(box.min.x).toBeCloseTo(roof.extent[0], 2)
      expect(box.max.x).toBeCloseTo(roof.extent[2], 2)
    }
  })

  it('agrees with the authored plan extent, oversail included', () => {
    for (const roof of barrels) {
      const prof = barrelProfile(roof.section!, 400)
      const lo = Math.min(...prof.map((q) => q.x))
      const hi = Math.max(...prof.map((q) => q.x))
      // The extent is the plan bounding box and is authored rounded outward, so it must
      // contain the glass but not by more than a rounding step.
      expect(roof.extent[1]).toBeLessThanOrEqual(lo)
      expect(lo - roof.extent[1]).toBeLessThan(100)
      expect(roof.extent[3]).toBeGreaterThanOrEqual(hi - 1e-6)
    }
  })

  it('stands each gable in the plane of the building face it closes', () => {
    const closed = barrels.flatMap((r) => r.gableEnds.map((e) => [r, e] as const))
    expect(closed.length).toBe(2) // both terrace returns; the deck's ends face open shafts

    for (const [roof, end] of closed) {
      const x = end === 'x0' ? roof.extent[0] : roof.extent[2]
      const box = worldBox(gableGeometry(roof, end))
      // Zero thickness in x: the panel is flat, standing on the envelope line.
      expect(box.min.x).toBeCloseTo(x, 2)
      expect(box.max.x).toBeCloseTo(x, 2)
      // Floor to the crown of the vault, at the mesh's own section resolution.
      expect(box.min.y).toBeCloseTo(0, 2)
      expect(box.max.y).toBeCloseTo(Math.max(...gableOutline(roof.section!, 48).map((q) => q.y)), 2)

      const j = gableJamb(roof, end)
      expect(mm(j.x)).toBeCloseTo(x, 2)
      expect(mm(j.height)).toBeCloseTo(roof.section!.p2.y, 2)
      expect(mm(j.z)).toBeCloseTo(roof.section!.p2.x, 2)
    }
  })

  it('covers the full height of the envelope return it replaces', () => {
    // EG-P-TERRACE-W and EG-K-TERRACE-E have no upright pane. The gable is the only
    // thing standing on those lines, so it has to span them completely.
    const returns = (building.envelopeGlazing ?? []).filter(
      (g) => g.pane === false && g.p1.x === g.p2.x,
    )
    expect(returns.length).toBe(2)

    for (const g of returns) {
      const roof = barrels.find(
        (r) =>
          (r.gableEnds.includes('x0') && r.extent[0] === g.p1.x) ||
          (r.gableEnds.includes('x1') && r.extent[2] === g.p1.x),
      )
      expect(roof, `no gable stands on ${g.id}`).toBeDefined()
      const ring = gableOutline(roof!.section!, 400)
      const lo = Math.min(...ring.map((q) => q.x))
      const hi = Math.max(...ring.map((q) => q.x))
      expect(lo).toBeLessThanOrEqual(Math.min(g.p1.y, g.p2.y))
      expect(hi).toBeGreaterThanOrEqual(Math.max(g.p1.y, g.p2.y))
    }
  })

  it('comes down exactly on the outer face of its tree cage', () => {
    // The cage is the canopy's footing. If the two drift apart the glass lands on nothing
    // and the trees are no longer inside it.
    for (const roof of barrels) {
      const cage = building.cages.find(
        (c) => c.from <= roof.extent[0] && c.to >= roof.extent[2],
      )
      expect(cage, `${roof.id} has no cage under it`).toBeDefined()
      expect(roof.section!.p0.x).toBe(cageOuterY(cage!))
      expect(roof.section!.p0.y).toBe(0)
    }
  })

  it('builds each cage between the slab edge and the glass foot', () => {
    const mats = {
      metal: new THREE.MeshBasicMaterial(),
      soil: new THREE.MeshBasicMaterial(),
    }
    for (const cage of building.cages) {
      const g = cageGroup(cage, mats)
      const box = new THREE.Box3().setFromObject(g)
      // Tolerances are half a bar: the frame members are centred on the cage's faces.
      expect(mm(box.min.z)).toBeGreaterThan(cageOuterY(cage) - 20)
      expect(mm(box.max.z)).toBeLessThan(cage.at + 20)
      expect(mm(box.min.y)).toBeGreaterThanOrEqual(-20)
      expect(mm(box.max.y)).toBeLessThan(cage.height + 20)
      expect(mm(box.min.x)).toBeGreaterThan(cage.from - 20)
      expect(mm(box.max.x)).toBeLessThan(cage.to + 20)
    }
  })

  it('leaves every tree room to grow under the glass', () => {
    // A tree that would grow into the canopy fails the build rather than being discovered
    // on site. Furniture takes no part in the integrity REPORT (brief §4), so this lives
    // in the suite instead.
    const trees = furniture.filter((f) => f.kind === 'tree')
    expect(trees.length).toBeGreaterThan(0)

    for (const t of trees) {
      const cx = t.x + t.w / 2
      const cy = t.y + t.d / 2

      const cage = building.cages.find((c) => c.from <= cx && c.to >= cx)
      expect(cage, `${t.id} is not over any cage`).toBeDefined()
      expect(t.y).toBeGreaterThanOrEqual(cageOuterY(cage!))
      expect(t.y + t.d).toBeLessThanOrEqual(cage!.at)

      // The crown must stay inside the authored footprint, or it spreads through the
      // glass coming down beside it rather than growing up into the clear space.
      const env = treeEnvelope(t.w, t.d, t.height)
      expect(env.dx).toBeLessThanOrEqual(t.w / 2 + 1e-6)
      expect(env.dz).toBeLessThanOrEqual(t.d / 2 + 1e-6)
      expect(env.top).toBeCloseTo(t.height, 6)

      const roof = barrels.find((r) => r.extent[0] <= cx && r.extent[2] >= cx)
      expect(roof, `${t.id} is not under any canopy`).toBeDefined()
      // Take the worst point of the crown, not just its centre.
      const heights = [t.y, cy, t.y + t.d].map((y) => canopyHeightAt(roof!.section!, y))
      for (const h of heights) expect(h, `no glass over ${t.id}`).not.toBeNull()
      expect(Math.min(...(heights as number[]))).toBeGreaterThan(t.height + 300)
    }
  })

  it('mirrors the two terrace canopies about x = 12 240', () => {
    const p = barrels.find((r) => r.id === 'ROOF-P-TERRACE')!
    const k = barrels.find((r) => r.id === 'ROOF-K-TERRACE')!
    expect(24480 - p.extent[0]).toBe(k.extent[2])
    expect(24480 - p.extent[2]).toBe(k.extent[0])
    expect(k.section).toEqual(p.section)
    expect(p.gableEnds).toEqual(['x0'])
    expect(k.gableEnds).toEqual(['x1'])
  })
})
