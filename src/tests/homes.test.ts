/**
 * EVERY REGISTERED HOME BUILDS.
 *
 * The app resolves one active home per page load, so the rest of the suite
 * only ever exercises the default. This file walks the whole registry and
 * asserts the contract every home has to meet before it can be switched to:
 * the envelope closes, every authored room claims a face, no face is left
 * unclaimed, and nothing is cut into pieces.
 *
 * It is deliberately about STRUCTURE, not design. An imported flat has no
 * brief and no furniture, and that is not a failure — but a room that derives
 * no polygon means the walls do not enclose, and the 3D model of that home
 * would be a lie.
 */

import { describe, expect, it } from 'vitest'
import { HOMES } from '../homes/registry'
import { buildModel } from '../geometry/model'
import { area, signedArea } from '../geometry/vec'
import { sqFt } from '../geometry/units'

describe('every registered home', () => {
  for (const home of HOMES) {
    describe(home.meta.name, () => {
      const model = buildModel(home.building)

      it('closes its envelope', () => {
        expect(home.building.envelope.length).toBeGreaterThanOrEqual(3)
        expect(Math.abs(area(home.building.envelope))).toBeGreaterThan(1e6)
      })

      it('derives a valid polygon for every authored room', () => {
        const missing = home.building.rooms
          .filter((d) => !model.roomById.has(d.id))
          .map((d) => d.id)
        expect(missing, `rooms that claimed no face: ${missing.join(', ')}`).toEqual([])
        for (const r of model.rooms) {
          expect(r.polygon.length, r.def.id).toBeGreaterThanOrEqual(3)
          expect(Math.abs(signedArea(r.polygon)), r.def.id).toBeGreaterThan(0)
          expect(r.area, r.def.id).toBeGreaterThan(0)
        }
      })

      it('leaves no face unclaimed', () => {
        expect(model.unclaimedFaces.map((f) => f.index)).toEqual([])
      })

      it('cuts no room in two, if it was imported', () => {
        // An AUTHORED plan may split a face on purpose — Om Neeldhara's suites
        // are cut by their own dressing runs, and the anchor decides which side
        // keeps the name. An IMPORTED plan has no such intent: a split there
        // means the extracted walls do not enclose what the builder drew, and
        // the room the app shows is not the room on the DWG.
        if (home.meta.origin === 'imported') expect(model.splitWarnings).toEqual([])
      })

      it('reconciles rooms + walls + shafts against the envelope', () => {
        expect(model.totals.reconciliationPct).toBeLessThanOrEqual(0.25)
      })
    })
  }
})

describe("Ekta's flat, against the builder's own drawing", () => {
  const home = HOMES.find((h) => h.meta.id === 'ekta')!
  const model = buildModel(home.building)

  it('has all thirteen of the rooms the builder names', () => {
    expect(model.rooms.length).toBe(13)
    const names = model.rooms.map((r) => r.def.name).sort()
    expect(names).toContain('Foyer')
    expect(names).toContain('Balcony')
    expect(names).toContain('Kitchen')
    expect(names.filter((n) => n === 'Passage')).toHaveLength(3)
  })

  it('matches the RERA figures', () => {
    // RERA 1073 sq ft = 1032 carpet + 41 balcony. The rooms come out lower
    // than the carpet figure because RERA counts the internal partitions as
    // carpet and a derived room polygon stops at the wall face.
    const rooms = sqFt(model.rooms.reduce((s, r) => s + r.area, 0))
    expect(rooms).toBeGreaterThan(1000)
    expect(rooms).toBeLessThan(1073)
  })

  /**
   * THE ONE TEST THAT SAYS THE IMPORT READ THE DRAWING RIGHT.
   *
   * Every room on the builder's plan carries his own dimension text —
   * `10'0"X13'6"` under BEDROOM, and so on for all thirteen. import.py copies
   * that text through as `publishedSqFt`, untouched. So this compares a room
   * DERIVED from the wall centrelines against the size the man who drew the
   * walls says it is. Nothing in the chain measures the drawing twice.
   *
   * 8 % because his figures are nominal room rectangles rounded to the inch,
   * and a derived polygon is the real shape to the millimetre — on a 13 sq ft
   * passage one square foot is already 7 %.
   */
  it('derives every room to the size the builder wrote on it', () => {
    const off: string[] = []
    for (const r of model.rooms) {
      const pub = r.def.publishedSqFt
      expect(pub, `${r.def.id} carries no dimension from the DWG`).toBeGreaterThan(0)
      const err = Math.abs(sqFt(r.area) - pub!) / pub!
      if (err > 0.08) off.push(`${r.def.name}: ${sqFt(r.area).toFixed(0)} vs ${pub} sq ft`)
    }
    expect(off, off.join('; ')).toEqual([])
  })
})
