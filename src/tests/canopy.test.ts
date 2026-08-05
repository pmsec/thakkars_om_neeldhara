/**
 * The glass roofs. The Rev 4 barrel-vault canopies and tree cages are gone —
 * this plan encloses the deck with a flat retractable roof at 3400 and each
 * private terrace with a high fixed glass roof, and both pod bays carry flat
 * glass over their deck ends. This suite pins that down.
 */

import { describe, expect, it } from 'vitest'
import { building, MIRROR_X } from '../data/building'
import { furniture } from '../data/furniture'
import { getModel } from '../geometry/model'

const roofs = building.glassRoofs
const model = getModel()

describe('glass roofs', () => {
  it('models five of them: deck, two terraces, two pod bays', () => {
    expect(roofs.map((r) => r.id).sort()).toEqual([
      'ROOF-DECK', 'ROOF-DEN', 'ROOF-FAMILY', 'ROOF-K-TERRACE', 'ROOF-P-TERRACE',
    ])
    expect(roofs.every((r) => r.kind === 'flat')).toBe(true)
  })

  it('only the deck roof retracts', () => {
    for (const r of roofs) {
      expect(!!r.retractable).toBe(r.id === 'ROOF-DECK')
    }
  })

  it('covers the deck room completely', () => {
    const deck = model.roomById.get('R-DECK')!
    const [x0, y0, x1, y1] = roofs.find((r) => r.id === 'ROOF-DECK')!.extent
    expect(deck.bbox.minX).toBeGreaterThanOrEqual(x0 - 1)
    expect(deck.bbox.maxX).toBeLessThanOrEqual(x1 + 1)
    expect(deck.bbox.minY).toBeGreaterThanOrEqual(y0 - 1)
    expect(deck.bbox.maxY).toBeLessThanOrEqual(y1 + 1)
  })

  it('covers each terrace, so the grass is under glass', () => {
    for (const [roomId, roofId] of [
      ['R-P-TERRACE', 'ROOF-P-TERRACE'],
      ['R-K-TERRACE', 'ROOF-K-TERRACE'],
    ] as const) {
      const room = model.roomById.get(roomId)!
      const [x0, y0, x1, y1] = roofs.find((r) => r.id === roofId)!.extent
      expect(room.bbox.minX).toBeGreaterThanOrEqual(x0 - 1)
      expect(room.bbox.maxX).toBeLessThanOrEqual(x1 + 1)
      expect(room.bbox.minY).toBeGreaterThanOrEqual(y0 - 1)
      expect(room.bbox.maxY).toBeLessThanOrEqual(y1 + 1)
    }
  })

  it('mirrors the terrace roofs and the pod-bay roofs about x = 12 240', () => {
    for (const [a, b] of [
      ['ROOF-P-TERRACE', 'ROOF-K-TERRACE'],
      ['ROOF-FAMILY', 'ROOF-DEN'],
    ] as const) {
      const ra = roofs.find((r) => r.id === a)!.extent
      const rb = roofs.find((r) => r.id === b)!.extent
      expect(Math.abs(2 * MIRROR_X - ra[0] - rb[2])).toBeLessThan(1)
      expect(Math.abs(2 * MIRROR_X - ra[2] - rb[0])).toBeLessThan(1)
      expect(Math.abs(ra[1] - rb[1])).toBeLessThan(1)
      expect(Math.abs(ra[3] - rb[3])).toBeLessThan(1)
    }
  })

  it('keeps every tree under its roof with room to grow', () => {
    // furniture trees on the terraces vs the terrace roof height
    for (const t of furniture.filter((f) => f.kind === 'tree')) {
      const roof = roofs.find(
        (r) => t.x >= r.extent[0] && t.x + t.w <= r.extent[2] &&
               t.y >= r.extent[1] && t.y + t.d <= r.extent[3],
      )
      if (!roof) continue // the great-room tree stands under the slab
      expect(t.height).toBeLessThan((roof.height ?? 3050) - 200)
    }
  })
})
