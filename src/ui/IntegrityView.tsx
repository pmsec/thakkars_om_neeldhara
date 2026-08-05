/**
 * The "Model integrity" page (brief §2.5). Shows the architect each check with its
 * actual measured number, not just a reassuring tick. Same code path as the Vitest
 * suite, so what passes here is what passes the build.
 */

import React, { useEffect, useState } from 'react'
import { furniture } from '../data/furniture'
import { runIntegrity } from '../geometry/integrity'
import { runFidelity, type FidelityReport } from '../geometry/fidelityReport'
import { getModel } from '../geometry/model'
import { sqFt, sqM } from '../geometry/units'
import { download, integrityCsv } from '../export/vector'

const model = getModel()

const m2 = (mm2: number): string => `${(mm2 / 1e6).toFixed(3)} m² (${(mm2 / 92903).toFixed(1)} sq ft)`

/** The 2D↔3D gates, run LIVE in this browser — the same code that fails the
 * build. If a renderer ever invents geometry the sheet does not draw, this
 * section names the piece and says why, right here in the app. */
function FidelitySection(): React.ReactElement {
  const [rep, setRep] = useState<FidelityReport | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setRep(runFidelity()), 60)
    return () => clearTimeout(t)
  }, [])

  if (!rep) {
    return (
      <>
        <h2>2D ↔ 3D fidelity</h2>
        <p>Running the fidelity gates in this browser…</p>
      </>
    )
  }
  return (
    <>
      <h2>2D ↔ 3D fidelity</h2>
      <p className="lede">
        The styled plan and both 3D views are generated from the sheet&rsquo;s own drawn
        geometry. These three gates prove it, live, with the same code that fails the build:
        nothing may cross a wall, nothing may stand outside the envelope, and no renderer
        may produce geometry outside a piece&rsquo;s drawn footprint.
      </p>

      <div className={`check ${rep.crossings.length ? 'fail' : 'pass'}`}>
        <div className="hd">
          <span className="tag">{rep.crossings.length ? 'FAIL' : 'PASS'}</span>
          <b>No furniture or fixture crosses a wall</b>
        </div>
        <div className="req">
          A piece may touch a wall or back onto the glass line; real area on BOTH sides of a
          wall centreline means the 3D is showing something the 2D forbids.
        </div>
        <div className="actual">
          {furniture.length} furniture + {rep.fixturesChecked} fixture footprints tested
          against every wall band — {rep.crossings.length} crossing
          {rep.crossings.length === 1 ? '' : 's'}
        </div>
        {rep.crossings.length > 0 && (
          <ul>
            {rep.crossings.map((c, i) => (
              <li key={i}>
                {c.itemId} ({c.itemLabel}) crosses {c.wallId}: {m2(c.areas[0])} / {m2(c.areas[1])} on the two sides
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`check ${rep.outside.length ? 'fail' : 'pass'}`}>
        <div className="hd">
          <span className="tag">{rep.outside.length ? 'FAIL' : 'PASS'}</span>
          <b>Nothing stands outside the envelope</b>
        </div>
        <div className="req">Every footprint must lie inside the home&rsquo;s outer walls.</div>
        <div className="actual">{rep.outside.length} violation{rep.outside.length === 1 ? '' : 's'}</div>
        {rep.outside.length > 0 && (
          <ul>
            {rep.outside.map((c, i) => (
              <li key={i}>{c.itemId} ({c.itemLabel}): {m2(c.areas[0])} outside</li>
            ))}
          </ul>
        )}
      </div>

      <div className={`check ${rep.projection.length ? 'fail' : 'pass'}`}>
        <div className="hd">
          <span className="tag">{rep.projection.length ? 'FAIL' : 'PASS'}</span>
          <b>Every 3D piece stays inside its drawn 2D footprint — both renderers</b>
        </div>
        <div className="req">
          Each piece is built by BOTH furniture renderers (styled/walkthrough and technical
          3D) and its plan projection must fit its drawn footprint. This is the gate that
          catches a renderer inventing geometry — chairs, pillows, backs — the sheet does
          not draw. Tree crowns are exempt: they overhang their planting square exactly as
          the sheet&rsquo;s own crown circles do.
        </div>
        <div className="actual">
          {rep.piecesChecked} piece builds projected and measured — {rep.projection.length}{' '}
          violation{rep.projection.length === 1 ? '' : 's'} (tolerance 30 mm)
        </div>
        {rep.projection.length > 0 && (
          <ul>
            {rep.projection.map((v, i) => (
              <li key={i}>
                {v.renderer}: {v.itemId} ({v.itemLabel}) escapes {v.overshootMm} mm {v.direction} of its footprint
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="check warn">
        <div className="hd">
          <span className="tag">NOTE</span>
          <b>Known 2D conditions, accepted and pinned ({rep.known.length})</b>
        </div>
        <div className="req">
          Overlaps that exist in the 2D drawing itself or in the exporter&rsquo;s straight-line
          stand-ins for curved junctions. Each is pinned to its measured size — if one ever
          grows, the wall gate above fails again. On screen, every one is clipped at the wall.
        </div>
        <ul>
          {rep.known.map((k, i) => (
            <li key={i}>
              <b>{k.item}</b> × {k.wallId}: {k.note}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}


export function IntegrityView(): React.ReactElement {
  const rep = runIntegrity(model)
  return (
    <div className="doc">
      <h1>Model integrity</h1>
      <p className="lede">
        Every check below runs against the same geometry that draws the plan and the 3D
        model, and the same code fails the build in CI. Numbers are measured, not asserted.
      </p>

      <div className="summary">
        <div className="stat">
          <div className="k">Checks passed</div>
          <div className="v">
            {rep.passed} / {rep.checks.length}
          </div>
        </div>
        <div className="stat">
          <div className="k">Failures</div>
          <div className="v" style={{ color: rep.failed ? 'var(--red)' : 'var(--green)' }}>
            {rep.failed}
          </div>
        </div>
        <div className="stat">
          <div className="k">Reconciliation</div>
          <div className="v">{model.totals.reconciliationPct.toFixed(4)} %</div>
        </div>
        <div className="stat">
          <div className="k">Gross envelope</div>
          <div className="v">{sqM(model.totals.envelope).toFixed(1)} m²</div>
        </div>
        <div className="stat">
          <div className="k">Carpet</div>
          <div className="v">{sqFt(model.totals.carpet).toFixed(0)} sq ft</div>
        </div>
      </div>

      <button className="btn no-print" onClick={() => download('model-integrity.csv', integrityCsv(), 'text/csv')}>
        Export as CSV
      </button>

      <h2>Checks</h2>
      {rep.checks.map((c) => (
        <div key={c.id} className={`check ${c.pass ? 'pass' : c.severity === 'warn' ? 'warn' : 'fail'}`}>
          <div className="hd">
            <span className="tag">{c.pass ? 'PASS' : c.severity === 'warn' ? 'NOTE' : 'FAIL'}</span>
            <b>{c.title}</b>
          </div>
          <div className="req">{c.requirement}</div>
          <div className="actual">
            {c.actual}
            {c.tolerance ? `   (tolerance ${c.tolerance})` : ''}
          </div>
          {c.detail && c.detail.length > 0 && (
            <ul>
              {c.detail.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <FidelitySection />

      <h2>How the geometry is derived</h2>
      <p>
        Rooms are not drawn. The wall centrelines — including the two curved glass pod
        walls, flattened from their Bézier definitions — are run through a planar
        subdivision: every crossing is split, a half-edge graph is walked to find the faces
        those walls enclose, and holes are attached to the face that contains them. Each
        face is then carved by the union of the wall footprints, which is the same thing as
        insetting every edge by half its wall&rsquo;s thickness, but stays well-behaved at awkward
        corners.
      </p>
      <p>
        Room records in the data file carry a name, a category and a single anchor point.
        They carry no shape. That is what makes the reconciliation above meaningful: change
        a wall thickness from 150 to 200 and the rooms either side shrink, the areas change,
        the schedules change, the 3D model changes, and this page still adds up.
      </p>
    </div>
  )
}
