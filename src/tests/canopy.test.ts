/**
 * The glass roofs. The deck and both private terraces are enclosed by ONE
 * BELLIED curved glass vault, terrace to terrace: it springs from floor datum
 * on the deck's parapet line, bulges out past the building line on the way up,
 * peaks well above the ceiling and lands on the wall head along the pod line,
 * with both ends closed by a glazed gable cut to the same curve. No upright
 * pane stands on the parapet lines. Both pod bays carry flat glass over their
 * deck ends. This suite pins that down.
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
  it('models three of them: one vault over the whole front, two pod bays', () => {
    expect(roofs.map((r) => r.id).sort()).toEqual(['ROOF-DEN', 'ROOF-FAMILY', 'ROOF-FRONT'])
    expect(vaults.map((r) => r.id)).toEqual(['ROOF-FRONT'])
    expect(byId('ROOF-FAMILY').kind).toBe('flat')
    expect(byId('ROOF-DEN').kind).toBe('flat')
  })

  it('only the front vault retracts', () => {
    for (const r of roofs) {
      expect(!!r.retractable).toBe(r.id === 'ROOF-FRONT')
    }
  })

  it('runs the full width of the building, end wall to end wall', () => {
    const xs = building.envelope.map((q) => q.x)
    const [x0, , x1] = byId('ROOF-FRONT').extent
    expect(x0).toBe(Math.min(...xs))
    expect(x1).toBe(Math.max(...xs))
  })

  it('covers the deck, both terraces and both shafts between them, so they are one glass room', () => {
    for (const roomId of ['R-DECK', 'R-P-TERRACE', 'R-K-TERRACE', 'R-SHAFT-W', 'R-SHAFT-E']) {
      const room = model.roomById.get(roomId)!
      const [x0, y0, x1, y1] = byId('ROOF-FRONT').extent
      expect(room.bbox.minX).toBeGreaterThanOrEqual(x0 - 1)
      expect(room.bbox.maxX).toBeLessThanOrEqual(x1 + 1)
      expect(room.bbox.minY).toBeGreaterThanOrEqual(y0 - 1)
      expect(room.bbox.maxY).toBeLessThanOrEqual(y1 + 1)
    }
  })

  it('mirrors about x = 12 240: the vault on itself, the pod-bay roofs on each other', () => {
    const v = byId('ROOF-FRONT').extent
    expect(Math.abs(2 * MIRROR_X - v[0] - v[2])).toBeLessThan(1)
    for (const [a, b] of [
      ['ROOF-FAMILY', 'ROOF-DEN'],
    ] as const) {
      const ra = byId(a).extent
      const rb = byId(b).extent
      expect(Math.abs(2 * MIRROR_X - ra[0] - rb[2])).toBeLessThan(1)
      expect(Math.abs(2 * MIRROR_X - ra[2] - rb[0])).toBeLessThan(1)
      expect(Math.abs(ra[1] - rb[1])).toBeLessThan(1)
      expect(Math.abs(ra[3] - rb[3])).toBeLessThan(1)
    }
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
  it('springs from floor datum, with every parapet line under it and solid wall between', () => {
    for (const r of vaults) {
      const sec = r.section!
      expect(sec.p0.y).toBe(0)
      // Every glazed envelope run with no pane lies under the vault, on or just
      // inboard of its foot: the deck parapet on the foot line itself, the terrace
      // parapets 150 inboard of it (the deck slab stands 150 proud of the terraces).
      const open = (building.envelopeGlazing ?? []).filter((g) => g.pane === false)
      expect(open.length).toBeGreaterThan(0)
      for (const g of open) {
        expect(Math.abs(g.p1.y - g.p2.y)).toBeLessThan(1)
        expect(g.p1.y - sec.p0.x).toBeGreaterThanOrEqual(-1)
        expect(g.p1.y - sec.p0.x).toBeLessThanOrEqual(150 + 1)
        expect(Math.min(g.p1.x, g.p2.x)).toBeGreaterThanOrEqual(r.extent[0] - 1)
        expect(Math.max(g.p1.x, g.p2.x)).toBeLessThanOrEqual(r.extent[2] + 1)
      }
      // and one of them is ON the foot line, so the vault has its own parapet to stand on
      expect(open.some((g) => Math.abs(g.p1.y - sec.p0.x) < 1)).toBe(true)
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
    const front = barrelProfile(byId('ROOF-FRONT').section!, 400)
    expect(Math.max(...front.map((q) => q.y))).toBeGreaterThan(6000)
  })

  it('lands on the wall head, so glass and wall meet edge to edge', () => {
    for (const r of vaults) {
      expect(r.section!.p2.y).toBe(CEILING)
      expect(r.section!.p2.x).toBe(r.extent[3])
    }
    // the vault lands on the pod line, where the flat pod-bay roofs start
    expect(byId('ROOF-FRONT').section!.p2.x).toBe(byId('ROOF-FAMILY').extent[1])
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
  it("the parents' dressing partition and both pod screens are tinted glass", () => {
    const tinted = building.walls.filter((w) => w.glass === 'tinted').map((w) => w.id).sort()
    expect(tinted).toEqual(['W-CURVE-KARAN', 'W-CURVE-PARENTS', 'W-P-DRESS'])
  })

  it("the parents' dressing partition is tinted glass, with its sliding leaves left to the door states", () => {
    // The static solid carries the fixed glass either side and the transom over
    // the leaves' head; the leaves themselves are drawn open and shut by the
    // walkthrough, so nothing static may stand across the opening below the head.
    const solids = buildSolids(model)
    for (const id of ['W-P-DRESS']) {
      const ps = solids.prisms.filter((p) => p.wallId === id)
      expect(ps.length).toBeGreaterThan(0)
      for (const p of ps) {
        expect(p.glass).toBe('tinted')
        expect(p.transparent).toBe(true)
        expect(p.top).toBe(CEILING)
      }
      const transom = ps.filter((p) => p.id.includes(':transom'))
      expect(transom.length).toBe(1)
      expect(transom[0].base).toBe(2100)
      expect(ps.some((p) => p.id.includes(':leaf'))).toBe(false)
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
