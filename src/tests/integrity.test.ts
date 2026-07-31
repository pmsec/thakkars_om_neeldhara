/**
 * The dimensional-integrity suite (brief §2.4). A failure here fails the build.
 *
 * The checks themselves live in `src/geometry/integrity.ts` so that the portal's
 * "Model integrity" panel shows the architect exactly what this suite asserts.
 */

import { describe, expect, it } from 'vitest'
import { runIntegrity } from '../geometry/integrity'
import { getModel } from '../geometry/model'
import { findCollinearOverlaps } from '../geometry/planar'
import { formatFeetInches, parseFeetInches } from '../geometry/units'
import { building } from '../data/building'
import { furniture } from '../data/furniture'

const model = getModel()
const report = runIntegrity(model)

const check = (id: string) => {
  const c = report.checks.find((x) => x.id === id)
  if (!c) throw new Error(`No check with id "${id}"`)
  return c
}

describe('dimensional integrity', () => {
  for (const id of [
    'envelope',
    'area-reconciliation',
    'room-overlap',
    'openings',
    'wet-stacks',
    'reach-main',
    'reach-service',
    'unit-roundtrip',
    'bounds-3d',
    'faces-claimed',
    'curved-walls',
    'mirror',
    'polygons-valid',
  ]) {
    it(`${id}: ${check(id).title}`, () => {
      const c = check(id)
      if (!c.pass) {
        throw new Error(
          `${c.title}\n  requirement: ${c.requirement}\n  actual: ${c.actual}\n` +
            (c.detail ?? []).map((d) => `    - ${d}`).join('\n'),
        )
      }
      expect(c.pass).toBe(true)
    })
  }

  it('reports no hard failures overall', () => {
    const failures = report.checks.filter((c) => !c.pass && c.severity === 'fail')
    expect(failures.map((f) => `${f.id}: ${f.actual}`)).toEqual([])
  })
})

describe('model construction invariants', () => {
  it('no two boundaries are authored along the same line', () => {
    // The planar subdivider resolves crossings, not coincident collinear runs. Proving
    // the data contains none is what makes the subdivision trustworthy.
    const boundaries = model.walls.map((w) => ({
      id: w.id,
      points: w.points,
      thickness: w.thickness,
      kind: w.kind,
    }))
    for (const core of building.cores) {
      boundaries.push({ id: core.id, points: core.points, thickness: 0, kind: 'void-edge' })
    }
    const overlaps = findCollinearOverlaps(boundaries)
    expect(
      overlaps.map((o) => `${o.a} overlaps ${o.b} at (${o.at.x.toFixed(0)}, ${o.at.y.toFixed(0)})`),
    ).toEqual([])
  })

  it('every room id is unique and every anchor lands in its own face', () => {
    const ids = model.rooms.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const faces = model.rooms.map((r) => r.faceIndex)
    expect(new Set(faces).size).toBe(faces.length)
  })

  it('every opening id is unique', () => {
    const ids = model.openings.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all authored lengths are integer millimetres, bar the two curve tangency points', () => {
    // W-P-POD-MID and W-K-POD-MID terminate on the Bézier, whose x at y = 4900 is not an
    // integer. Those are the only permitted non-integers, and they are derived, not chosen.
    const allowed = new Set(['W-P-POD-MID', 'W-K-POD-MID'])
    const offenders: string[] = []
    for (const w of building.walls) {
      if (!w.points || allowed.has(w.id)) continue
      for (const p of w.points) {
        if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) {
          offenders.push(`${w.id} (${p.x}, ${p.y})`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('furniture is excluded from the fabric and from every integrity check', () => {
    // Brief §4: the architect must be able to switch furniture off, and it must never
    // participate in the dimensional checks.
    expect(furniture.length).toBeGreaterThan(0)
    const fabricIds = new Set([
      ...model.walls.map((w) => w.id),
      ...model.rooms.map((r) => r.id),
      ...model.openings.map((o) => o.id),
    ])
    for (const f of furniture) expect(fabricIds.has(f.id)).toBe(false)
    const reportText = JSON.stringify(report)
    for (const f of furniture.slice(0, 40)) expect(reportText).not.toContain(f.id)
  })
})

describe('unit conversion', () => {
  it('formats the way the Rev 4 sheet does when the value is exact to the inch', () => {
    expect(formatFeetInches(8382)).toBe("27'-6\"") // 27'-6" exactly
    expect(formatFeetInches(304.8)).toBe("1'-0\"")
    expect(formatFeetInches(0)).toBe("0'-0\"")
  })

  it('round-trips within 1 mm at 1/16 inch across the whole millimetre range', () => {
    let worst = 0
    for (let mm = 1; mm <= 30000; mm += 7) {
      const err = Math.abs(parseFeetInches(formatFeetInches(mm, 16)) - mm)
      if (err > worst) worst = err
    }
    expect(worst).toBeLessThan(1)
  })

  it('nearest-inch display cannot meet 1 mm, which is why mm is always shown too', () => {
    let worst = 0
    for (let mm = 1; mm <= 30000; mm += 7) {
      worst = Math.max(worst, Math.abs(parseFeetInches(formatFeetInches(mm, 1)) - mm))
    }
    expect(worst).toBeGreaterThan(1)
    expect(worst).toBeLessThanOrEqual(12.7)
  })
})
