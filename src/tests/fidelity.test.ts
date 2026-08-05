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
