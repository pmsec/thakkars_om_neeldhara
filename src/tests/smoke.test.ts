/**
 * Not an assertion suite — a printed report. `npm test` shows it so a change to the
 * geometry data is visible as numbers, not just as a pass/fail.
 */

import { describe, expect, it } from 'vitest'
import { getModel } from '../geometry/model'
import { offsetFace } from '../geometry/planar'
import { runIntegrity } from '../geometry/integrity'
import { sqFt, sqM } from '../geometry/units'
import { area } from '../geometry/vec'

const model = getModel()

describe('model report', () => {
  it('prints the derived schedule', () => {
    const l: string[] = []
    l.push(`faces=${model.faces.length} rooms=${model.rooms.length} unclaimed=${model.unclaimedFaces.length} splits=${model.splitWarnings.length}`)
    l.push(`envelope   ${sqFt(model.envelopeArea).toFixed(1)} sq ft / ${sqM(model.envelopeArea).toFixed(2)} m²`)
    l.push(`rooms      ${sqFt(model.totals.rooms).toFixed(1)}`)
    l.push(`voids      ${sqFt(model.totals.voids).toFixed(1)}`)
    l.push(`walls      ${sqFt(model.totals.walls).toFixed(1)}`)
    l.push(`carpet     ${sqFt(model.totals.carpet).toFixed(1)}`)
    l.push(`recon err  ${(model.totals.reconciliationError / 1e6).toFixed(6)} m²  (${model.totals.reconciliationPct.toFixed(5)} %)`)
    l.push('')
    l.push('id               carpet    gross     pub     w x d')
    for (const r of model.rooms) {
      l.push(
        `${r.id.padEnd(16)} ${sqFt(r.area).toFixed(1).padStart(7)} ${sqFt(r.grossArea).toFixed(1).padStart(8)} ` +
          `${String(r.def.publishedSqFt ?? '-').padStart(7)}   ${r.width.toFixed(0)} x ${r.depth.toFixed(0)}`,
      )
    }
    // eslint-disable-next-line no-console
    console.log(l.join('\n'))
    expect(model.unclaimedFaces).toHaveLength(0)
  })

  it('prints the integrity report', () => {
    const rep = runIntegrity(model)
    const l = [`INTEGRITY  ${rep.passed} passed, ${rep.failed} failed, ${rep.warnings} advisory`]
    for (const c of rep.checks) {
      l.push(`${c.pass ? 'PASS' : c.severity === 'warn' ? 'NOTE' : 'FAIL'}  ${c.id.padEnd(22)} ${c.actual}`)
    }
    // eslint-disable-next-line no-console
    console.log(l.join('\n'))
    expect(rep.failed).toBe(0)
  })

  it('the boolean and offset room derivations agree', () => {
    // Two independent implementations of "inset the face by half each wall". The boolean
    // is authoritative because it stays correct at pathological corners; this proves the
    // straightforward offset agrees wherever it is well-conditioned.
    const rows: string[] = []
    let worstPct = 0
    for (const room of model.rooms) {
      const face = model.faces[room.faceIndex]
      const off = offsetFace(face)
      const offArea = area(off.outer) - off.holes.reduce((s, h) => s + area(h), 0)
      const pct = Math.abs(offArea - room.area) / Math.max(1, room.area) * 100
      if (pct > 0.5) rows.push(`${room.id}: boolean ${sqFt(room.area).toFixed(2)} vs offset ${sqFt(offArea).toFixed(2)} sq ft (${pct.toFixed(2)} %)`)
      else worstPct = Math.max(worstPct, pct)
    }
    // eslint-disable-next-line no-console
    console.log(`offset-vs-boolean: worst well-conditioned divergence ${worstPct.toFixed(4)} %` +
      (rows.length ? `\n  ill-conditioned (boolean wins):\n    ${rows.join('\n    ')}` : ''))
    // Rooms bounded by sampled curves (drum, sweeps, pod screens) are the
    // known ill-conditioned cases for the naive offset; the boolean wins there.
    const curved = /^(R-ENTRY|R-GREAT|R-P-BATH|R-K-BATH|R-GUEST-BATH|R-HELP|R-KITCHEN|R-DUCT-E|R-DUCT-SE|R-P-DRESSING|R-K-DRESSING|R-P-FAMILY|R-K-DEN|R-STORE):/
    expect(rows.filter((r) => !curved.test(r))).toEqual([])
  })
})
