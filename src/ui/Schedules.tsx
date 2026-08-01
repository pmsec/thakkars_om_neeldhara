/**
 * Room schedule and door/window schedule (brief §8). Sortable, exportable, and clicking
 * a row selects the room in both viewers.
 */

import React, { useMemo, useState } from 'react'
import { getModel } from '../geometry/model'
import { building } from '../data/building'
import { formatFeetInches, sqFt, sqM } from '../geometry/units'
import { download, openingScheduleCsv, roomScheduleCsv } from '../export/vector'
import { useStore } from './store'

const model = getModel()

type Dir = 1 | -1

export function Schedules(): React.ReactElement {
  const { state, set } = useStore()
  const [sortKey, setSortKey] = useState<string>('id')
  const [dir, setDir] = useState<Dir>(1)
  const ft = (mm: number): string => formatFeetInches(mm, state.roundToInch ? 1 : 16)

  const rooms = useMemo(() => {
    const val = (r: (typeof model.rooms)[number]): string | number => {
      switch (sortKey) {
        case 'name':
          return r.name
        case 'zone':
          return r.def.zone
        case 'category':
          return r.def.category
        case 'w':
          return r.width
        case 'd':
          return r.depth
        case 'area':
          return r.area
        case 'gross':
          return r.grossArea
        case 'pub':
          return r.def.publishedSqFt ?? -1
        case 'ceiling':
          return r.ceiling
        default:
          return r.id
      }
    }
    return [...model.rooms].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir
    })
  }, [sortKey, dir])

  const th = (k: string, label: string): React.ReactElement => (
    <th
      onClick={() => {
        if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1))
        else {
          setSortKey(k)
          setDir(1)
        }
      }}
    >
      {label}
      {sortKey === k ? (dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <div className="doc">
      <h1>Schedules</h1>
      <p className="lede">
        Derived from the geometry, not typed in. Click a column head to sort, or a row to
        select that room in the plan and the model.
      </p>
      <div className="btnrow no-print">
        <button className="btn" onClick={() => download('room-schedule.csv', roomScheduleCsv(), 'text/csv')}>
          Rooms CSV
        </button>
        <button className="btn" onClick={() => download('opening-schedule.csv', openingScheduleCsv(), 'text/csv')}>
          Openings CSV
        </button>
      </div>

      <h2>Room schedule</h2>
      <table className="sched">
        <thead>
          <tr>
            {th('id', 'ID')}
            {th('name', 'Room')}
            {th('zone', 'Zone')}
            {th('category', 'Use')}
            {th('w', 'W mm')}
            {th('d', 'D mm')}
            <th>W × D ft-in</th>
            {th('area', 'Carpet sq ft')}
            <th>Carpet m²</th>
            {th('gross', 'Gross sq ft')}
            {th('pub', 'Rev 4 sq ft')}
            {th('ceiling', 'Ceiling')}
            <th>Finish</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr
              key={r.id}
              className={state.selectedRoom === r.id ? 'sel' : ''}
              onClick={() => set({ selectedRoom: r.id })}
              onMouseEnter={() => set({ hoveredRoom: r.id })}
              onMouseLeave={() => set({ hoveredRoom: null })}
            >
              <td className="mono">{r.id}</td>
              <td>{r.name}</td>
              <td>{r.def.zone}</td>
              <td>{r.def.category}</td>
              <td className="num">{Math.round(r.width)}</td>
              <td className="num">{Math.round(r.depth)}</td>
              <td className="num">
                {ft(r.width)} × {ft(r.depth)}
              </td>
              <td className="num">{sqFt(r.area).toFixed(1)}</td>
              <td className="num">{sqM(r.area).toFixed(2)}</td>
              <td className="num">{sqFt(r.grossArea).toFixed(1)}</td>
              <td className="num">{r.def.publishedSqFt ?? '—'}</td>
              <td className="num">{r.ceiling}</td>
              <td>{r.def.finish ?? '—'}</td>
              <td style={{ maxWidth: 320 }}>{r.def.notes ?? ''}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, background: 'var(--line-2)' }}>
            <td colSpan={7}>Carpet total (excludes deck, terraces, shafts and cores)</td>
            <td className="num">{sqFt(model.totals.carpet).toFixed(1)}</td>
            <td className="num">{sqM(model.totals.carpet).toFixed(2)}</td>
            <td colSpan={5} />
          </tr>
        </tbody>
      </table>

      <h2>Door and window schedule</h2>
      <table className="sched">
        <thead>
          <tr>
            <th>Mark</th>
            <th>Type</th>
            <th>Wall</th>
            <th>Width mm</th>
            <th>Width ft-in</th>
            <th>Sill</th>
            <th>Head</th>
            <th>Connects</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {model.openings.map((op) => {
            const c = model.connections.find((x) => x.openingId === op.id)
            const a = c ? model.roomById.get(c.a)?.name : null
            const b = c ? model.roomById.get(c.b)?.name : null
            return (
              <tr key={op.id}>
                <td className="mono">{op.id}</td>
                <td>{op.type}</td>
                <td className="mono">{op.wallId}</td>
                <td className="num">{Math.round(op.width)}</td>
                <td className="num">{ft(op.width)}</td>
                <td className="num">{op.sill ?? 0}</td>
                <td className="num">{op.head ?? '—'}</td>
                <td>{a && b ? `${a} — ${b}` : op.type === 'window' ? 'external' : '—'}</td>
                <td style={{ maxWidth: 300 }}>
                  {op.label ? <b>{op.label}. </b> : null}
                  {op.notes ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Wet areas and retained stacks</h2>
      <table className="sched">
        <thead>
          <tr>
            <th>Stack</th>
            <th>Room</th>
            <th>Status</th>
            <th>x mm</th>
            <th>y mm</th>
            <th>Provenance</th>
          </tr>
        </thead>
        <tbody>
          {building.stacks.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.id}</td>
              <td>{model.roomById.get(s.room)?.name ?? s.room}</td>
              <td>{s.capped ? 'Capped, not removed' : 'Retained'}</td>
              <td className="num">{s.at.x}</td>
              <td className="num">{s.at.y}</td>
              <td style={{ maxWidth: 420 }}>{s.provenance}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tiny muted">
        Stack coordinates come from the Rev 4 fixture layout, not from a site survey.
        Confirm riser positions against the sanctioned plumbing drawings before demolition.
      </p>
    </div>
  )
}
