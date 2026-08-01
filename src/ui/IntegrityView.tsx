/**
 * The "Model integrity" page (brief §2.5). Shows the architect each check with its
 * actual measured number, not just a reassuring tick. Same code path as the Vitest
 * suite, so what passes here is what passes the build.
 */

import React from 'react'
import { runIntegrity } from '../geometry/integrity'
import { getModel } from '../geometry/model'
import { sqFt, sqM } from '../geometry/units'
import { download, integrityCsv } from '../export/vector'

const model = getModel()

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
