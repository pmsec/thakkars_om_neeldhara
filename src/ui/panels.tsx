/**
 * Side-panel controls. Layers, tools, the underlay georeferencing flow, the 3D
 * controls, the room inspector, markup and exports.
 */

import React, { useMemo, useState } from 'react'
import { getModel } from '../geometry/model'
import { building } from '../data/building'
import { fixtures } from '../data/fixtures'
import { formatArea, formatFeetInches, formatLength, formatMm, sqFt, sqM } from '../geometry/units'
import { LAYER_LABELS, useStore, type LayerId } from './store'
import sheetSvgRaw from '../assets/plan-sheet.svg?raw'
import { exportMarkupPdf, exportPdf, PAPER, type PaperName } from '../export/pdf'
import {
  download,
  exportDxf,
  exportPng,
  exportSvg,
  integrityCsv,
  openingScheduleCsv,
  roomScheduleCsv,
} from '../export/vector'
import { dayLabel, hourLabel, solarPosition } from '../render3d/sun'

const model = getModel()

export function LayersPanel(): React.ReactElement {
  const { state, update } = useStore()
  const toggle = (id: LayerId): void =>
    update((s) => ({ ...s, layers: { ...s.layers, [id]: !s.layers[id] } }))
  return (
    <div className="panel">
      <h3>Layers</h3>
      {LAYER_LABELS.map(([id, label]) => (
        <div className="row" key={id}>
          <label>
            <input type="checkbox" checked={state.layers[id]} onChange={() => toggle(id)} />
            {label}
          </label>
        </div>
      ))}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button
          className="btn tiny"
          onClick={() =>
            update((s) => ({
              ...s,
              layers: Object.fromEntries(LAYER_LABELS.map(([k]) => [k, true])) as Record<LayerId, boolean>,
            }))
          }
        >
          All on
        </button>
        <button
          className="btn tiny"
          onClick={() =>
            update((s) => ({
              ...s,
              layers: {
                ...(Object.fromEntries(LAYER_LABELS.map(([k]) => [k, false])) as Record<LayerId, boolean>),
                walls: true,
                openings: true,
              },
            }))
          }
        >
          Fabric only
        </button>
      </div>
    </div>
  )
}

export function ToolsPanel(): React.ReactElement {
  const { state, set, update } = useStore()
  return (
    <div className="panel">
      <h3>Tools</h3>
      <div className="row">
        <label>
          <input type="checkbox" checked={state.snap} onChange={() => set({ snap: !state.snap })} />
          Snap to corners, midpoints, openings
        </label>
      </div>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={state.roundToInch}
            onChange={() => set({ roundToInch: !state.roundToInch })}
          />
          Round feet-inches to the whole inch
        </label>
      </div>
      <p className="tiny muted" style={{ margin: '4px 0 0' }}>
        Whole-inch rounding matches the Rev 4 sheet but is up to 12.7 mm out. The default
        1/16" display round-trips to within 0.8 mm.
      </p>
      {(state.measures.length > 0 || state.areas.length > 0) && (
        <>
          <h4>Saved measurements</h4>
          {state.measures.map((m) => (
            <div className="row" key={m.id}>
              <span className="tiny">{m.id}</span>
              <span className="val">{m.points.length} points</span>
              <button
                className="btn tiny"
                onClick={() => update((s) => ({ ...s, measures: s.measures.filter((x) => x.id !== m.id) }))}
              >
                ✕
              </button>
            </div>
          ))}
          {state.areas.map((a) => (
            <div className="row" key={a.id}>
              <span className="tiny">{a.id}</span>
              <span className="val">{a.points.length} points</span>
              <button
                className="btn tiny"
                onClick={() => update((s) => ({ ...s, areas: s.areas.filter((x) => x.id !== a.id) }))}
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export function UnderlayPanel(): React.ReactElement {
  const { state, set, update } = useStore()
  const cal = state.calibration
  const stage =
    cal.imagePoints.length < 2 ? `Pick image point ${cal.imagePoints.length + 1} of 2` : cal.modelPoints.length < 2 ? `Pick model point ${cal.modelPoints.length + 1} of 2` : 'Ready to solve'

  const solve = (): void => {
    const [i1, i2] = cal.imagePoints
    const [m1, m2] = cal.modelPoints
    const di = Math.hypot(i2.x - i1.x, i2.y - i1.y)
    const dm = Math.hypot(m2.x - m1.x, m2.y - m1.y)
    if (di < 1e-6) return
    const scale = dm / di
    const rotation = Math.atan2(m2.y - m1.y, m2.x - m1.x) - Math.atan2(i2.y - i1.y, i2.x - i1.x)
    const c = Math.cos(rotation) * scale
    const s = Math.sin(rotation) * scale
    update((st) => ({
      ...st,
      underlay: { ...st.underlay, transform: { scale, rotation, tx: m1.x - (c * i1.x - s * i1.y), ty: m1.y - (s * i1.x + c * i1.y) } },
      layers: { ...st.layers, underlay: true },
      tool: 'select',
    }))
  }

  return (
    <div className="panel">
      <h3>Builder&rsquo;s original plan</h3>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        The sanctioned two-flat drawing, overlaid so the new design can be checked against
        what exists. Georeference it by matching two points you can identify on both.
      </p>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={state.layers.underlay}
            onChange={() => update((s) => ({ ...s, layers: { ...s.layers, underlay: !s.layers.underlay } }))}
          />
          Show underlay
        </label>
      </div>
      <div className="row">
        <span className="tiny">Opacity</span>
        <span className="val">{Math.round(state.underlay.opacity * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={state.underlay.opacity}
        onChange={(e) => update((s) => ({ ...s, underlay: { ...s.underlay, opacity: Number(e.target.value) } }))}
      />
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button
          className="btn tiny"
          aria-pressed={state.tool === 'calibrate'}
          onClick={() =>
            update((s) => ({
              ...s,
              tool: s.tool === 'calibrate' ? 'select' : 'calibrate',
              calibration: { imagePoints: [], modelPoints: [] },
              underlay: {
                ...s.underlay,
                // Start from a rough placement so there is something to click on: the
                // sanctioned sheet is portrait, this plan is landscape, hence the turn.
                transform: s.underlay.transform ?? { scale: 10.4, rotation: -Math.PI / 2, tx: 0, ty: 12200 },
              },
              layers: { ...s.layers, underlay: true },
            }))
          }
        >
          {state.tool === 'calibrate' ? 'Cancel' : 'Georeference…'}
        </button>
        <button className="btn tiny" onClick={() => set({ underlay: { ...state.underlay, transform: null } })}>
          Clear
        </button>
      </div>
      {state.tool === 'calibrate' && (
        <>
          <p className="tiny" style={{ marginBottom: 4 }}>
            <b>{stage}</b>
          </p>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Click two features on the faded underlay first (a wall junction you can also
            find on the new plan works well), then the same two on the new drawing.
          </p>
          {cal.imagePoints.length === 2 && cal.modelPoints.length === 2 && (
            <button className="btn wide" onClick={solve}>
              Solve and apply
            </button>
          )}
        </>
      )}
      {state.underlay.transform && (
        <p className="tiny muted mono" style={{ marginBottom: 0 }}>
          scale {state.underlay.transform.scale.toFixed(3)} mm/px · rotation{' '}
          {((state.underlay.transform.rotation * 180) / Math.PI).toFixed(2)}°
        </p>
      )}
    </div>
  )
}

export function View3DPanel(): React.ReactElement {
  const { state, set, update } = useStore()
  const pos = solarPosition(state.sun.day, state.sun.hour)
  return (
    <>
      <div className="panel">
        <h3>Cutaway &amp; section</h3>
        <div className="row">
          <span className="tiny">Cutaway height</span>
          <span className="val">{formatMm(state.cutaway)}</span>
        </div>
        <input
          type="range"
          min={900}
          max={3050}
          step={10}
          value={state.cutaway}
          onChange={(e) => set({ cutaway: Number(e.target.value) })}
        />
        <p className="tiny muted" style={{ margin: '2px 0 8px' }}>
          Lintels reappear only at full height.
        </p>
        <div className="row wrap">
          {(['x', 'y', 'z', null] as const).map((ax) => (
            <button
              key={String(ax)}
              className="btn tiny"
              aria-pressed={state.section.axis === ax}
              onClick={() => set({ section: { axis: ax, at: ax === 'y' ? 1500 : ax === 'z' ? 5400 : 12240 } })}
            >
              {ax === null ? 'No section' : `Section ${ax.toUpperCase()}`}
            </button>
          ))}
        </div>
        {state.section.axis && (
          <>
            <div className="row">
              <span className="tiny">Cut at</span>
              <span className="val">{formatMm(state.section.at)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={state.section.axis === 'x' ? 24480 : state.section.axis === 'z' ? 10850 : 3050}
              step={20}
              value={state.section.at}
              onChange={(e) => update((s) => ({ ...s, section: { ...s.section, at: Number(e.target.value) } }))}
            />
          </>
        )}
      </div>

      <div className="panel">
        <h3>Show</h3>
        {(
          [
            ['glassRoofs', 'Glass roofs'],
            ['cages', 'Tree cages'],
            ['furniture', 'Furniture'],
            ['podParents', "Parents' pod"],
            ['podKaran', "Karan's pod"],
          ] as const
        ).map(([k, label]) => (
          <div className="row" key={k}>
            <label>
              <input
                type="checkbox"
                checked={state.show3d[k]}
                onChange={() => update((s) => ({ ...s, show3d: { ...s.show3d, [k]: !s.show3d[k] } }))}
              />
              {label}
            </label>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Sun path — Mumbai 19.076 N, 72.877 E</h3>
        <div className="row">
          <span className="tiny">Date</span>
          <span className="val">{dayLabel(state.sun.day)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={365}
          value={state.sun.day}
          onChange={(e) => update((s) => ({ ...s, sun: { ...s.sun, day: Number(e.target.value) } }))}
        />
        <div className="row">
          <span className="tiny">Time</span>
          <span className="val">{hourLabel(state.sun.hour)}</span>
        </div>
        <input
          type="range"
          min={4}
          max={20}
          step={0.25}
          value={state.sun.hour}
          onChange={(e) => update((s) => ({ ...s, sun: { ...s.sun, hour: Number(e.target.value) } }))}
        />
        <div className="row wrap" style={{ marginTop: 6 }}>
          <button
            className="btn tiny"
            aria-pressed={state.sun.mode === 'day'}
            onClick={() => update((s) => ({ ...s, sun: { ...s.sun, mode: 'day' } }))}
          >
            Day
          </button>
          <button
            className="btn tiny"
            aria-pressed={state.sun.mode === 'dusk'}
            onClick={() => update((s) => ({ ...s, sun: { ...s.sun, mode: 'dusk' } }))}
          >
            Dusk
          </button>
          <button
            className="btn tiny"
            aria-pressed={state.sun.shadows}
            onClick={() => update((s) => ({ ...s, sun: { ...s.sun, shadows: !s.sun.shadows } }))}
          >
            Shadows
          </button>
        </div>
        <div className="row wrap" style={{ marginTop: 6 }}>
          {[
            { d: 80, l: 'Equinox' },
            { d: 172, l: 'Jun solstice' },
            { d: 355, l: 'Dec solstice' },
          ].map((p) => (
            <button key={p.d} className="btn tiny" onClick={() => update((s) => ({ ...s, sun: { ...s.sun, day: p.d } }))}>
              {p.l}
            </button>
          ))}
        </div>
        <p className="tiny mono muted" style={{ marginBottom: 4 }}>
          altitude {pos.altitude.toFixed(1)}° · azimuth {pos.azimuth.toFixed(1)}°
          {pos.altitude <= 0 && ' · sun is down'}
        </p>

        <h4>North orientation</h4>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          Needs confirming. The Rev 4 sheet&rsquo;s north arrow points along +x; the Python
          source&rsquo;s header comment says north is &minus;y. Shadows are only as right as
          this setting.
        </p>
        <div className="row wrap">
          {[
            { a: 0, l: '+x is N (sheet)' },
            { a: 90, l: '+x is E' },
            { a: 180, l: '+x is S' },
            { a: 270, l: '+x is W (source)' },
          ].map((o) => (
            <button key={o.a} className="btn tiny" aria-pressed={state.northAzimuth === o.a} onClick={() => set({ northAzimuth: o.a })}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export function RoomInspector(): React.ReactElement {
  const { state, set } = useStore()
  const room = state.selectedRoom ? model.roomById.get(state.selectedRoom) : null
  const fmt = (mm: number): string => formatLength(mm, state.units, state.roundToInch ? 1 : 16)

  if (!room) {
    return (
      <div className="panel">
        <h3>Room inspector</h3>
        <p className="tiny muted">
          Click a room in either view. Hovering highlights it in both.
        </p>
      </div>
    )
  }

  const conns = model.connections.filter((c) => c.a === room.id || c.b === room.id)
  const stacks = building.stacks.filter((s) => s.room === room.id)
  const roomFixtures = fixtures.filter((f) => f.room === room.id)

  return (
    <div className="panel">
      <h3>Room inspector</h3>
      <h4 style={{ marginTop: 0, fontSize: 15 }}>{room.name}</h4>
      <p className="tiny muted mono" style={{ margin: '0 0 8px' }}>
        {room.id} · {room.def.zone} · {room.def.category}
      </p>

      <div className="row">
        <span className="tiny">Extent</span>
        <span className="val">
          {fmt(room.width)} × {fmt(room.depth)}
        </span>
      </div>
      <div className="row">
        <span className="tiny">Millimetres</span>
        <span className="val">
          {Math.round(room.width)} × {Math.round(room.depth)}
        </span>
      </div>
      <div className="row">
        <span className="tiny">Feet-inches</span>
        <span className="val">
          {formatFeetInches(room.width, state.roundToInch ? 1 : 16)} ×{' '}
          {formatFeetInches(room.depth, state.roundToInch ? 1 : 16)}
        </span>
      </div>
      <div className="row">
        <span className="tiny">Carpet area</span>
        <span className="val">{formatArea(room.area)}</span>
      </div>
      <div className="row">
        <span className="tiny">Gross (centreline)</span>
        <span className="val">{formatArea(room.grossArea)}</span>
      </div>
      {room.def.publishedSqFt != null && (
        <div className="row">
          <span className="tiny">Rev 4 published</span>
          <span className="val">{room.def.publishedSqFt} sq ft</span>
        </div>
      )}
      <div className="row">
        <span className="tiny">Perimeter</span>
        <span className="val">{fmt(room.perimeter)}</span>
      </div>
      <div className="row">
        <span className="tiny">Ceiling</span>
        <span className="val">{fmt(room.ceiling)}</span>
      </div>
      <div className="row">
        <span className="tiny">Floor finish</span>
        <span className="val">{room.def.finish ?? '—'}</span>
      </div>

      <h4>Openings</h4>
      {conns.length === 0 && <p className="tiny muted">None.</p>}
      {conns.map((c) => {
        const op = model.openings.find((o) => o.id === c.openingId)
        const other = model.roomById.get(c.a === room.id ? c.b : c.a)
        return (
          <div className="row" key={c.openingId}>
            <span className="tiny">
              {c.openingId} <span className="muted">{op?.type}</span>
            </span>
            <span className="val">
              {op ? fmt(op.width) : ''} → {other?.name ?? '?'}
            </span>
          </div>
        )
      })}

      {stacks.length > 0 && (
        <>
          <h4>Plumbing</h4>
          {stacks.map((s) => (
            <p className="tiny" key={s.id} style={{ margin: '2px 0' }}>
              <b>{s.capped ? 'Capped stack' : 'Retained stack'}</b> — {s.name}
              <br />
              <span className="muted">{s.provenance}</span>
            </p>
          ))}
          {roomFixtures.length > 0 && (
            <p className="tiny muted" style={{ margin: '4px 0 0' }}>
              Fixtures: {roomFixtures.map((f) => f.label ?? f.kind).join(', ')}
            </p>
          )}
        </>
      )}

      {room.def.notes && (
        <>
          <h4>Notes</h4>
          <p className="tiny">{room.def.notes}</p>
        </>
      )}

      <button className="btn wide" onClick={() => set({ flyTo: { room: room.id, nonce: Date.now() } })}>
        Zoom both views here
      </button>
    </div>
  )
}

export function MarkupPanel(): React.ReactElement {
  const { state, set, update } = useStore()
  return (
    <div className="panel">
      <h3>Markup</h3>
      <div className="row">
        <span className="tiny">Author</span>
        <input type="text" value={state.author} onChange={(e) => set({ author: e.target.value })} style={{ width: 150 }} />
      </div>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        Choose the Markup tool, then click the plan to pin a comment.
      </p>
      {state.markups.map((m, i) => (
        <div className="markup-item" key={m.id}>
          <div className="row">
            <b className="tiny">
              {i + 1}. {m.author}
            </b>
            <span className="val">{m.date}</span>
          </div>
          <p className="tiny" style={{ margin: '3px 0' }}>
            {m.text}
          </p>
          <div className="row">
            <span className="tiny muted mono">
              x {Math.round(m.at.x)} · y {Math.round(m.at.y)}
            </span>
            <button
              className="btn tiny"
              onClick={() => update((s) => ({ ...s, markups: s.markups.filter((x) => x.id !== m.id) }))}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      {state.markups.length > 0 && (
        <div className="btnrow">
          <button
            className="btn tiny"
            onClick={() => download('markups.json', JSON.stringify(state.markups, null, 2), 'application/json')}
          >
            JSON
          </button>
          <button className="btn tiny" onClick={() => download('markup-schedule.pdf', exportMarkupPdf(state.markups))}>
            PDF sheet
          </button>
        </div>
      )}
    </div>
  )
}

export function ExportPanel(): React.ReactElement {
  const { state } = useStore()
  const [paper, setPaper] = useState<PaperName>('A1')
  const [scale, setScale] = useState(50)
  const [dpi, setDpi] = useState(300)
  const [busy, setBusy] = useState('')

  const sheetOpts = useMemo(
    () => ({
      furniture: state.layers.furniture,
      fixtures: state.layers.fixtures,
      dimensions: state.layers.dimensions,
      labels: state.layers.labels,
      roundToInch: state.roundToInch,
    }),
    [state.layers, state.roundToInch],
  )

  return (
    <div className="panel">
      <h3>Export</h3>
      <div className="row">
        <span className="tiny">Sheet</span>
        <select value={paper} onChange={(e) => setPaper(e.target.value as PaperName)} style={{ width: 110 }}>
          {(Object.keys(PAPER) as PaperName[]).map((p) => (
            <option key={p} value={p}>
              {p} ({PAPER[p].w}×{PAPER[p].h} mm)
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <span className="tiny">Scale</span>
        <select value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: 110 }}>
          {[50, 75, 100, 150, 200].map((s) => (
            <option key={s} value={s}>
              1:{s}
            </option>
          ))}
        </select>
      </div>
      <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
        {(24480 / scale).toFixed(0)} mm of paper for the 24 480 mm length. A1 fits at 1:50; A3 needs 1:150.
      </p>
      <button
        className="btn wide"
        onClick={() => download(`floor-plan-A101-rev4-${paper}-1-${scale}.pdf`, exportPdf({ ...sheetOpts, paper, scale }))}
      >
        Vector PDF, true scale
      </button>

      <h4>CAD</h4>
      <div className="btnrow">
        <button className="btn tiny" onClick={() => download('floor-plan-fabric.svg', exportSvg({ fabricOnly: true }), 'image/svg+xml')}>
          SVG (fabric)
        </button>
        <button className="btn tiny" onClick={() => download('cad-sheet.svg', sheetSvgRaw, 'image/svg+xml')}>
          SVG (full)
        </button>
        <button className="btn tiny" onClick={() => download('floor-plan-fabric.dxf', exportDxf({ fabricOnly: true }), 'application/dxf')}>
          DXF (fabric)
        </button>
      </div>

      <h4>Raster</h4>
      <div className="row">
        <span className="tiny">DPI</span>
        <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} style={{ width: 110 }}>
          {[150, 300, 600].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn wide"
        disabled={busy !== ''}
        onClick={async () => {
          setBusy('png')
          try {
            download(`cad-sheet-${dpi}dpi-1-${scale}.png`, await exportPng(dpi, sheetOpts, scale))
          } catch (err) {
            window.alert(String(err instanceof Error ? err.message : err))
          } finally {
            setBusy('')
          }
        }}
      >
        {busy === 'png' ? 'Rendering…' : 'PNG'}
      </button>

      <h4>Schedules</h4>
      <div className="btnrow">
        <button className="btn tiny" onClick={() => download('room-schedule.csv', roomScheduleCsv(), 'text/csv')}>
          Rooms CSV
        </button>
        <button className="btn tiny" onClick={() => download('opening-schedule.csv', openingScheduleCsv(), 'text/csv')}>
          Openings CSV
        </button>
        <button className="btn tiny" onClick={() => download('model-integrity.csv', integrityCsv(), 'text/csv')}>
          Integrity CSV
        </button>
      </div>

      <h4>Print</h4>
      <button className="btn wide" onClick={() => window.print()}>
        Print at true scale
      </button>
    </div>
  )
}

export function TotalsPanel(): React.ReactElement {
  const t = model.totals
  return (
    <div className="panel">
      <h3>Areas</h3>
      {(
        [
          ['Gross envelope', t.envelope],
          ['Carpet', t.carpet],
          ['Rooms (incl. outdoor)', t.rooms],
          ['Shafts and cores', t.voids],
          ['Wall footprint', t.walls],
        ] as const
      ).map(([label, v]) => (
        <div className="row" key={label}>
          <span className="tiny">{label}</span>
          <span className="val">
            {sqFt(v).toFixed(0)} sq ft · {sqM(v).toFixed(1)} m²
          </span>
        </div>
      ))}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        Carpet is measured inside the wall faces. Rev 4&rsquo;s published figures are measured
        to zone extents, which is why they read higher.
      </p>
    </div>
  )
}
