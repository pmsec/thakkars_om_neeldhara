/**
 * THE 2D↔3D FIDELITY GATE. The Styled plan and the Walkthrough are generated
 * from the same data as the 2D sheet — this suite is what makes "generated
 * from" a guarantee instead of an intention. If any piece's rendered
 * footprint crosses a wall the 2D respects, or stands outside the envelope,
 * the build fails.
 *
 * Born from a real bug: the den's pantry run, drawn hugging the curved pod
 * screen, was exported as its bounding box and poked through the glass.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { fixtures } from '../data/fixtures'
import { furniture } from '../data/furniture'
import {
  clipToPlan,
  fixtureFootprint,
  furnitureFootprint,
  outsideEnvelope,
  wallCrossings,
} from '../geometry/fidelity'
import { area } from '../geometry/vec'
import { furnitureMesh, type Mats } from '../render3d/Realistic'
import { furnitureObject } from '../render3d/Viewer3D'
import { S } from '../render3d/prism'

describe('2D↔3D fidelity', () => {
  it('no furniture or fixture footprint crosses a wall', () => {
    const crossings = wallCrossings()
    const msg = crossings
      .map(
        (c) =>
          `${c.itemId} (${c.itemLabel}) crosses ${c.wallId}: ` +
          `${(c.areas[0] / 1e6).toFixed(3)} m² / ${(c.areas[1] / 1e6).toFixed(3)} m² on the two sides`,
      )
      .join('\n')
    expect(crossings, msg).toEqual([])
  })

  it('nothing stands outside the envelope', () => {
    const out = outsideEnvelope()
    const msg = out
      .map((c) => `${c.itemId} (${c.itemLabel}): ${(c.areas[0] / 1e6).toFixed(3)} m² outside`)
      .join('\n')
    expect(out, msg).toEqual([])
  })

  it('every exported outline fits inside its own bounding box', () => {
    for (const f of furniture) {
      if (!f.poly) continue
      for (const p of f.poly) {
        expect(p.x, `${f.id} poly x`).toBeGreaterThanOrEqual(f.x - 1)
        expect(p.x, `${f.id} poly x`).toBeLessThanOrEqual(f.x + f.w + 1)
        expect(p.y, `${f.id} poly y`).toBeGreaterThanOrEqual(f.y - 1)
        expect(p.y, `${f.id} poly y`).toBeLessThanOrEqual(f.y + f.d + 1)
      }
    }
    for (const f of fixtures) {
      if (!f.poly) continue
      for (const p of f.poly) {
        expect(p.x, `${f.id} poly x`).toBeGreaterThanOrEqual(f.at.x - f.size[0] / 2 - 1)
        expect(p.x, `${f.id} poly x`).toBeLessThanOrEqual(f.at.x + f.size[0] / 2 + 1)
        expect(p.y, `${f.id} poly y`).toBeGreaterThanOrEqual(f.at.y - f.size[1] / 2 - 1)
        expect(p.y, `${f.id} poly y`).toBeLessThanOrEqual(f.at.y + f.size[1] / 2 + 1)
      }
    }
  })

  it('the curved pieces carry their drawn outlines, not just boxes', () => {
    // The regression that started this: these pieces hug curved walls and are
    // meaningless as bounding boxes. Their polys must survive re-export.
    const pantryUnits = furniture.filter((f) => f.label === 'Corner unit')
    expect(pantryUnits.length).toBeGreaterThanOrEqual(2)
    for (const u of pantryUnits) expect(u.poly, `${u.id} lost its outline`).toBeDefined()

    const vanities = fixtures.filter((f) => f.id.endsWith('-VAN'))
    expect(vanities.length).toBe(3)
    for (const v of vanities) expect(v.poly, `${v.id} lost its outline`).toBeDefined()

    // Both kitchen runs: run B (which the old size cap silently dropped) and
    // the hob run. Each must ship with its drawn outline.
    const counters = fixtures.filter((f) => f.kind === 'counter')
    expect(counters.length).toBeGreaterThanOrEqual(2)
    for (const c of counters) expect(c.poly, `${c.id} lost its outline`).toBeDefined()
  })

  it('everything the sheet draws exists in 3D (the omission regression set)', () => {
    // Each of these was drawn in 2D and simply absent from the export once.
    // The exporter's coverage audit now hard-fails on any such omission; this
    // locks the shipped data to the same standard.
    const byLabel = (s: string): number =>
      furniture.filter((f) => f.label.toLowerCase().includes(s)).length
    expect(byLabel('rug'), 'the great-room rug').toBeGreaterThanOrEqual(1)
    expect(furniture.find((f) => f.label.includes('rug'))?.poly, 'rug outline').toBeDefined()
    expect(byLabel('arch console'), 'the two arch consoles').toBe(2)
    expect(byLabel('dressing screen'), "Karan's dressing screen").toBe(1)
    expect(byLabel('jhoola'), 'both jhoolas').toBe(2)
    expect(byLabel('footrest'), 'deployed recliner footrests').toBeGreaterThanOrEqual(4)
    expect(furniture.filter((f) => f.kind === 'grass').length, 'grass fields').toBeGreaterThanOrEqual(4)
    expect(furniture.filter((f) => f.kind === 'planter').length, 'planters').toBeGreaterThanOrEqual(2)
    expect(furniture.find((f) => f.label.includes('drum kit')), 'the drum kit').toBeDefined()
    expect(fixtures.filter((f) => f.label?.includes('cabinet')).length, 'bath wall cabinets').toBe(2)
    expect(fixtures.filter((f) => f.label?.includes('shelves')).length, 'bath shelf units').toBe(2)
    const vans = fixtures.filter((f) => f.id.endsWith('-VAN'))
    for (const v of vans) expect(v.bowl, `${v.id} basin bowl`).toBeDefined()
  })

  it('every 3D piece projects inside its own drawn 2D footprint', () => {
    // The gate that stops the renderer INVENTING geometry: whatever a kind's
    // 3D builder produces, its plan projection must stay inside the item's
    // drawn footprint. This is what failed when the dining case generated its
    // own chair arrangement outside the table instead of rendering the six
    // chairs the sheet draws (now items of their own).
    //
    // 'tree' is exempt on purpose: the crown overhangs the drawn planting
    // square exactly as the sheet's own green crown circles do — the trunk is
    // the footprint. Fixtures need no gate here: they render either as boxes
    // of their exact size or as wall-clipped extrusions of their outline.
    const materialStub = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() }) as Mats
    const TOL = 30
    // BOTH 3D renderers — the styled/walkthrough builder AND the technical
    // viewer's — are held to the same projection. They diverged once (the
    // technical tab kept bounding boxes long after the styled plan stopped);
    // this is what makes that structurally impossible now.
    const builders: Array<[string, (f: (typeof furniture)[number]) => THREE.Object3D | null]> = [
      ['furnitureMesh', (f) => furnitureMesh(f, materialStub)],
      ['furnitureObject', (f) => furnitureObject(f, [])],
    ]
    for (const [builderName, build] of builders) {
      for (const f of furniture) {
        if (f.kind === 'tree') continue
        const o = build(f)
        if (!o) continue
        o.updateMatrixWorld(true)
        const bb = new THREE.Box3().setFromObject(o)
        if (bb.isEmpty()) continue
        const minX = bb.min.x / S
        const maxX = bb.max.x / S
        const minY = bb.min.z / S
        const maxY = bb.max.z / S
        const tag = `${builderName}: ${f.id} (${f.label})`
        expect(minX, `${tag} west of its footprint`).toBeGreaterThanOrEqual(f.x - TOL)
        expect(maxX, `${tag} east of its footprint`).toBeLessThanOrEqual(f.x + f.w + TOL)
        expect(minY, `${tag} north of its footprint`).toBeGreaterThanOrEqual(f.y - TOL)
        expect(maxY, `${tag} south of its footprint`).toBeLessThanOrEqual(f.y + f.d + TOL)
      }
    }
  })

  it('the dining group is the drawn one: six chairs, three a side, ends clear', () => {
    const table = furniture.find((f) => f.kind === 'dining')
    expect(table?.poly, 'dining table lost its drawn outline').toBeDefined()
    const chairs = furniture.filter((f) => f.kind === 'chair')
    expect(chairs.length).toBe(6)
    const t = table!
    const east = chairs.filter((c) => c.x + c.w / 2 > t.x + t.w)
    const west = chairs.filter((c) => c.x + c.w / 2 < t.x)
    expect(west.length, 'three chairs on the west side').toBe(3)
    expect(east.length, 'three chairs on the east side').toBe(3)
    // no chair beyond the table's ends — the sheet keeps both ends clear
    for (const c of chairs) {
      expect(c.y + c.d / 2).toBeGreaterThan(t.y)
      expect(c.y + c.d / 2).toBeLessThan(t.y + t.d)
    }
  })

  it('clipping a footprint never grows it, and abutting pieces lose their wall overlap', () => {
    for (const f of furniture) {
      const fp = furnitureFootprint(f)
      const clipped = clipToPlan(fp)
      const clippedArea = clipped.reduce(
        (s, c) => s + area(c.outer) - c.holes.reduce((h, r) => h + area(r), 0),
        0,
      )
      expect(clippedArea, f.id).toBeLessThanOrEqual(area(fp) + 1)
    }
    for (const f of fixtures) {
      const fp = fixtureFootprint(f)
      const clipped = clipToPlan(fp)
      const clippedArea = clipped.reduce(
        (s, c) => s + area(c.outer) - c.holes.reduce((h, r) => h + area(r), 0),
        0,
      )
      expect(clippedArea, f.id).toBeLessThanOrEqual(area(fp) + 1)
    }
  })
})
