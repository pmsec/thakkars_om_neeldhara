/**
 * EVERY REGISTERED HOME BUILDS.
 *
 * The app resolves one active home per page load, so the rest of the suite
 * only ever exercises the default. This file walks the whole registry and
 * asserts the contract every home has to meet before it can be switched to:
 * the envelope closes, every authored room claims a face, no face is left
 * unclaimed, and nothing is cut into pieces.
 *
 * It is deliberately about STRUCTURE, not design. A flat may have no brief
 * and no furniture yet, and that is not a failure — but a room that derives no
 * polygon means the walls do not enclose, and the 3D model of that home would
 * be a lie.
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

describe("Ekta's flat, as designed", () => {
  /**
   * THIS BLOCK USED TO CHECK THE IMPORT, and it was the one test that said the
   * import had read the drawing right: every room on the builder's plan
   * carries his own dimension text, import.py copied it through as
   * publishedSqFt, and this compared a room DERIVED from his wall centrelines
   * against the size the man who drew them said it was.
   *
   * That check has done its job and it cannot run here any more, because these
   * are no longer his rooms. His thirteen — three passages, two toilets,
   * three bedrooms — have become eight, and none of them carries his figure.
   * The record of what he drew is frozen in the CAD repo as
   * homes/ekta/design.imported.py, and that is where the import is diffed.
   *
   * What is checked here instead is that the DESIGN holds together: the rooms
   * it claims, the area they come to against RERA, and that the flat is
   * furnished rather than an empty shell wearing a brief.
   */
  const home = HOMES.find((h) => h.meta.id === 'ekta')!
  const model = buildModel(home.building)

  it('derives the eight rooms the design draws', () => {
    expect(model.rooms.length).toBe(8)
    const names = model.rooms.map((r) => r.def.name).sort()
    expect(names).toEqual([
      'Balcony', 'Bath', 'Bath', 'Bedroom', 'Foyer', 'Kitchen',
      'Living / Dining', 'Room',
    ])
  })

  it('stays inside the RERA carpet it was cut from', () => {
    // RERA 1073 sq ft = 1032 carpet + 41 balcony. Derived rooms come out under
    // the carpet figure because RERA counts the internal partitions as carpet
    // and a derived polygon stops at the wall face — and this design adds
    // partitions the builder never drew, so it lands further under than his
    // plan did.
    const rooms = sqFt(model.rooms.reduce((s, r) => s + r.area, 0))
    expect(rooms).toBeGreaterThan(950)
    expect(rooms).toBeLessThan(1073)
  })

  it('is furnished, and every piece is in a room that exists', () => {
    expect(home.furniture.length).toBeGreaterThan(30)
    const ids = new Set(model.rooms.map((r) => r.def.id))
    const orphans = home.furniture
      .filter((f) => f.room && !ids.has(f.room))
      .map((f) => `${f.id} -> ${f.room}`)
    expect(orphans, orphans.join('; ')).toEqual([])
  })

  it('has a bathroom for each end of the flat', () => {
    expect(model.rooms.filter((r) => r.def.name === 'Bath')).toHaveLength(2)
  })
})
