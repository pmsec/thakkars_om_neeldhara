/**
 * The glass roofs. The deck and both private terraces are enclosed by BELLIED
 * curved glass: each vault springs from floor datum on its parapet line, bulges
 * out past the building line on the way up, peaks well above the ceiling and
 * lands on the wall head, with both ends closed by a glazed gable cut to the
 * same curve. No upright pane stands on those lines. Both pod bays carry flat
 * glass over their deck ends. This suite pins that down.
 */

import { describe, expect, it } from 'vitest'
import { building, MIRROR_X } from '../data/building'
import { furniture } from '../data/furniture'
import { getModel } from '../geometry/model'
import { barrelProfile, buildSolids, gableOutline } from '../geometry/solid'

const roofs = building.glassRoofs
const model = getModel()
const CEILING = building.levels.ceiling
const vaults = roofs.filter((r) => r.kind === 'barrel')
const byId = (id: string) => roofs.find((r) => r.id === id)!

describe('glass roofs', () => {
  it('models five of them: deck, two terraces, two pod bays', () => {
    expect(roofs.map((r) => r.id).sort()).toEqual([
      'ROOF-DECK', 'ROOF-DEN', 'ROOF-FAMILY', 'ROOF-K-TERRACE', 'ROOF-P-TERRACE',
    ])
    expect(vaults.map((r) => r.id).sort()).toEqual(['ROOF-DECK', 'ROOF-K-TERRACE', 'ROOF-P-TERRACE'])
    expect(byId('ROOF-FAMILY').kind).toBe('flat')
    expect(byId('ROOF-DEN').kind).toBe('flat')
  })

  it('only the deck roof retracts', () => {
    for (const r of roofs) {
      expect(!!r.retractable).toBe(r.id === 'ROOF-DECK')
    }
  })

  it('covers the deck room completely', () => {
    const deck = model.roomById.get('R-DECK')!
    const [x0, y0, x1, y1] = byId('ROOF-DECK').extent
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
      const [x0, y0, x1, y1] = byId(roofId).extent
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
      const ra = byId(a).extent
      const rb = byId(b).extent
      expect(Math.abs(2 * MIRROR_X - ra[0] - rb[2])).toBeLessThan(1)
      expect(Math.abs(2 * MIRROR_X - ra[2] - rb[0])).toBeLessThan(1)
      expect(Math.abs(ra[1] - rb[1])).toBeLessThan(1)
      expect(Math.abs(ra[3] - rb[3])).toBeLessThan(1)
    }
    expect(byId('ROOF-P-TERRACE').section).toEqual(byId('ROOF-K-TERRACE').section)
  })

  it('keeps every tree under its roof with room to grow', () => {
    for (const t of furniture.filter((f) => f.kind === 'tree')) {
      const roof = roofs.find(
        (r) => t.x >= r.extent[0] && t.x + t.w <= r.extent[2] &&
               t.y >= r.extent[1] && t.y + t.d <= r.extent[3],
      )
      if (!roof) continue // the great-room tree stands under the slab
      const clear = roof.kind === 'barrel'
        ? Math.max(...barrelProfile(roof.section!, 200).map((q) => q.y))
        : roof.height ?? CEILING
      expect(t.height).toBeLessThan(clear - 200)
    }
  })
})

describe('the bellied glass', () => {
  it('springs from floor datum on its own parapet line', () => {
    for (const r of vaults) {
      const sec = r.section!
      expect(sec.p0.y).toBe(0)
      // The glazed run lies under the vault; where the vault runs on to the building
      // corner it skims the solid wall's outer face, on the same line.
      const parapet = (building.envelopeGlazing ?? []).find(
        (g) => Math.abs(g.p1.y - sec.p0.x) < 1 && Math.abs(g.p2.y - sec.p0.x) < 1 &&
          Math.min(g.p1.x, g.p2.x) >= r.extent[0] - 1 && Math.max(g.p1.x, g.p2.x) <= r.extent[2] + 1,
      )
      expect(parapet, `${r.id} has a parapet line under it`).toBeTruthy()
      expect(parapet!.pane).toBe(false)
      const beyond = (Math.min(parapet!.p1.x, parapet!.p2.x) - r.extent[0]) + (r.extent[2] - Math.max(parapet!.p1.x, parapet!.p2.x))
      expect(beyond).toBeLessThanOrEqual(2 * building.thickness.exterior + 200)
    }
  })

  it('bellies out past the building line and peaks above the ceiling', () => {
    for (const r of vaults) {
      const prof = barrelProfile(r.section!, 400)
      const belly = r.section!.p0.x - Math.min(...prof.map((q) => q.x))
      const peak = Math.max(...prof.map((q) => q.y))
      expect(belly).toBeGreaterThan(400)
      expect(peak).toBeGreaterThan(CEILING + 1000)
      // and the plan extent is the true footprint, belly included
      expect(r.extent[1]).toBeLessThanOrEqual(r.section!.p0.x - belly + 1)
    }
    const deck = barrelProfile(byId('ROOF-DECK').section!, 400)
    expect(Math.max(...deck.map((q) => q.y))).toBeGreaterThan(4900)
  })

  it('lands on the wall head, so glass and wall meet edge to edge', () => {
    for (const r of vaults) {
      expect(r.section!.p2.y).toBe(CEILING)
      expect(r.section!.p2.x).toBe(r.extent[3])
    }
    // the deck vault lands on the pod line, where the flat pod-bay roofs start
    expect(byId('ROOF-DECK').section!.p2.x).toBe(byId('ROOF-FAMILY').extent[1])
  })

  it('closes both ends with a gable cut to the curve', () => {
    for (const r of vaults) {
      expect(r.gableEnds).toEqual(['x0', 'x1'])
      const ring = gableOutline(r.section!, 48)
      expect(ring.length).toBeGreaterThan(40)
      expect(Math.min(...ring.map((q) => q.y))).toBe(0)
    }
  })

  it('leaves no upright pane on the deck edge or the terrace fronts', () => {
    const solids = buildSolids(model)
    for (const id of ['EG-DECK', 'EG-P-TERRACE', 'EG-K-TERRACE']) {
      expect(solids.prisms.some((p) => p.wallId === id)).toBe(false)
    }
  })
})

describe('the bronze glass walls', () => {
  it('both dressing partitions and both pod screens are tinted glass', () => {
    const tinted = building.walls.filter((w) => w.glass === 'tinted').map((w) => w.id).sort()
    expect(tinted).toEqual(['W-CURVE-KARAN', 'W-CURVE-PARENTS', 'W-K-DRESS', 'W-P-DRESS'])
  })

  it('a dressing partition is one translucent plane, floor to ceiling, leaf included', () => {
    const solids = buildSolids(model)
    for (const id of ['W-P-DRESS', 'W-K-DRESS']) {
      const ps = solids.prisms.filter((p) => p.wallId === id)
      expect(ps.length).toBeGreaterThan(0)
      for (const p of ps) {
        expect(p.glass).toBe('tinted')
        expect(p.transparent).toBe(true)
        expect(p.base).toBe(0)
        expect(p.top).toBe(CEILING)
      }
      expect(ps.some((p) => p.id.includes(':leaf'))).toBe(true)
      expect(ps.some((p) => p.kind === 'lintel')).toBe(false)
    }
  })

  it('a pod screen is tinted glass either side of its portal, with the arch left plaster', () => {
    const solids = buildSolids(model)
    for (const id of ['W-CURVE-PARENTS', 'W-CURVE-KARAN']) {
      const ps = solids.prisms.filter((p) => p.wallId === id)
      expect(ps.filter((p) => p.transparent).every((p) => p.glass === 'tinted')).toBe(true)
      expect(ps.filter((p) => p.transparent).length).toBeGreaterThan(0)
      expect(ps.filter((p) => p.kind === 'lintel').every((p) => !p.glass)).toBe(true)
    }
  })
})
