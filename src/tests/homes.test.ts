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

describe("Ekta's flat, against the builder's own figures", () => {
  const home = HOMES.find((h) => h.meta.id === 'ekta')!
  const model = buildModel(home.building)

  it('matches the RERA carpet area', () => {
    // RERA 1073 sq ft = 1032 carpet + 41 balcony. The balcony is a slab outside
    // the enclosure, so the envelope is the 1032 plus the external wall it is
    // measured inside of. Carpet as RERA counts it includes the internal
    // partitions; the derived rooms do not, hence the two numbers.
    const gross = sqFt(model.envelopeArea)
    expect(gross).toBeGreaterThan(1100)
    expect(gross).toBeLessThan(1130)
    const rooms = sqFt(model.rooms.reduce((s, r) => s + r.area, 0))
    expect(rooms).toBeGreaterThan(960)
    expect(rooms).toBeLessThan(1010)
  })

  it('has nine rooms, none of them under a square metre', () => {
    expect(model.rooms.length).toBe(9)
    expect(Math.min(...model.rooms.map((r) => r.area))).toBeGreaterThan(1e6)
  })
})
