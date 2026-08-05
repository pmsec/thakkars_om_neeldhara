/**
 * THE 2D plan: the CAD sheet, verbatim, with the portal's tools laid over it.
 *
 * src/assets/plan-sheet.svg is copied byte-for-byte from the CAD branch's
 * drawings/07-round1-layout.svg by docs/design-export.py. The sheet's own
 * coordinate frame is known exactly — Sheet(-3200, -2400 … 26600, 16100) at
 * 4200 px wide with a 90 px pad — so model millimetres and sheet pixels
 * convert losslessly, and every tool (measure, area, markup, room inspect)
 * works on the real drawing. The sheet's <g id="L-*"> groups, emitted by the
 * CAD generator, give the layer toggles.
 *
 * When the plan changes on the CAD branch, re-running the exporter refreshes
 * this sheet with the model data, and everything here follows.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import sheetSvg from '../assets/plan-sheet.svg?raw'
import { getModel } from '../geometry/model'
import { formatFeetInches, sqFt, sqM } from '../geometry/units'
import { area as polyArea, pointInPolygon, type Pt } from '../geometry/vec'
import { useStore } from '../ui/store'

const model = getModel()

// ---- the sheet's own frame, from the CAD generator: Sheet(x0, y0, x1, y1)
const SHEET_W = 4200
const SHEET_H = 2675
const PAD = 90
const X0 = -3200
const Y0 = -2400
const SC = (SHEET_W - 2 * PAD) / (26600 - X0)

const mmToSheet = (p: Pt): Pt => ({ x: PAD + (p.x - X0) * SC, y: PAD + (p.y - Y0) * SC })
const sheetToMm = (p: Pt): Pt => ({ x: X0 + (p.x - PAD) / SC, y: Y0 + (p.y - PAD) / SC })

/** Snap targets: every wall vertex and opening end, in mm. */
function snapPoints(): Pt[] {
  const pts: Pt[] = []
  for (const w of model.walls) {
    if (w.points.length <= 12) pts.push(...w.points)
    else pts.push(w.points[0], w.points[w.points.length - 1])
    for (const o of w.openings) pts.push(o.p1, o.p2)
  }
  for (const r of model.rooms) if (r.polygon.length <= 24) pts.push(...r.polygon)
  return pts
}

export interface SheetLayer {
  id: string
  label: string
}
export const SHEET_LAYERS: SheetLayer[] = [
  { id: 'floor', label: 'Floor finishes' },
  { id: 'furniture', label: 'Furniture & planting' },
  { id: 'labels', label: 'Room labels' },
  { id: 'dims', label: 'Dimension chains' },
  { id: 'keepclear', label: 'Keep-clear zones' },
  { id: 'ref', label: 'Lobby beyond the flat' },
  { id: 'title', label: 'Title & legend' },
]

const MIN_Z = 0.2
const MAX_Z = 10

function fmtLen(mm: number, units: string, roundToInch: boolean): string {
  if (units === 'ftin') return formatFeetInches(mm, roundToInch ? 1 : 16)
  if (units === 'm') return `${(mm / 1000).toFixed(2)} m`
  return `${Math.round(mm)} mm`
}

export function SheetView({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { state, set, update } = useStore()
  const outerRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, z: 0.35 })
  const [cursor, setCursor] = useState<Pt | null>(null)          // mm
  const [live, setLive] = useState<Pt[]>([])                     // mm, active chain
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  const sheetLayers = state.sheetLayers
  const snaps = useMemo(snapPoints, [])

  const fit = useCallback((): void => {
    const el = outerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const z = Math.min(r.width / SHEET_W, r.height / SHEET_H) * 0.97
    setView({ x: (r.width - SHEET_W * z) / 2, y: (r.height - SHEET_H * z) / 2, z })
  }, [])
  useEffect(fit, [fit])

  // layer visibility applies straight to the sheet's own <g id="L-*"> groups
  useEffect(() => {
    const root = sheetRef.current
    if (!root) return
    for (const l of SHEET_LAYERS) {
      const g = root.querySelector<SVGGElement>(`#L-${l.id}`)
      if (g) g.style.display = sheetLayers[l.id] ? '' : 'none'
    }
  }, [sheetLayers])

  const screenToMm = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = outerRef.current!.getBoundingClientRect()
      const sx = (clientX - r.left - view.x) / view.z
      const sy = (clientY - r.top - view.y) / view.z
      return sheetToMm({ x: sx, y: sy })
    },
    [view],
  )

  const snapMm = useCallback(
    (p: Pt): Pt => {
      if (!state.snap) return p
      const tolMm = 14 / (view.z * SC)          // ~14 screen px
      let best: Pt | null = null
      let bd = tolMm
      for (const q of snaps) {
        const d = Math.hypot(q.x - p.x, q.y - p.y)
        if (d < bd) {
          bd = d
          best = q
        }
      }
      return best ?? p
    },
    [snaps, state.snap, view.z],
  )

  const roomAt = useCallback((p: Pt) => {
    return model.rooms.find(
      (r) => pointInPolygon(p, r.polygon) && !r.holes.some((h) => pointInPolygon(p, h)),
    )
  }, [])

  // ------------------------------------------------------------- pointer
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0016)
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor))
      const rect = outerRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const k = z / v.z
      return { x: mx - (mx - v.x) * k, y: my - (my - v.y) * k, z }
    })
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false }
    },
    [view],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      if (d) {
        const dx = e.clientX - d.px
        const dy = e.clientY - d.py
        if (Math.hypot(dx, dy) > 4) d.moved = true
        if (d.moved) setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }))
        return
      }
      const mm = snapMm(screenToMm(e.clientX, e.clientY))
      setCursor(mm)
      if (state.tool === 'select') {
        const r = roomAt(mm)
        if ((r?.id ?? null) !== state.hoveredRoom) set({ hoveredRoom: r?.id ?? null })
      }
    },
    [screenToMm, snapMm, state.tool, state.hoveredRoom, roomAt, set],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      drag.current = null
      if (d?.moved) return                       // it was a pan, not a click
      const mm = snapMm(screenToMm(e.clientX, e.clientY))

      if (state.tool === 'select') {
        const r = roomAt(mm)
        set({ selectedRoom: r?.id ?? null })
        return
      }
      if (state.tool === 'measure') {
        setLive((pts) => {
          const next = [...pts, mm]
          if (next.length === 2) {
            update((s) => ({
              ...s,
              measures: [
                ...s.measures,
                { id: `M${Date.now()}`, points: next, committed: true },
              ],
            }))
            return []
          }
          return next
        })
        return
      }
      if (state.tool === 'area') {
        setLive((pts) => [...pts, mm])
        return
      }
      if (state.tool === 'markup') {
        const text = window.prompt('Markup note')
        if (text) {
          update((s) => ({
            ...s,
            markups: [
              ...s.markups,
              {
                id: `MK${Date.now()}`,
                at: mm,
                text,
                author: s.author || 'Family',
                date: new Date().toISOString().slice(0, 10),
              },
            ],
          }))
        }
      }
    },
    [screenToMm, snapMm, state.tool, roomAt, set, update],
  )

  const onDoubleClick = useCallback(() => {
    if (state.tool === 'area' && live.length >= 3) {
      update((s) => ({
        ...s,
        areas: [...s.areas, { id: `A${Date.now()}`, points: live, committed: true }],
      }))
      setLive([])
    }
  }, [state.tool, live, update])

  // Esc clears the live chain; Delete clears committed measures/areas
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setLive([])
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = e.target as HTMLElement | null
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
        update((s) => ({ ...s, measures: [], areas: [] }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [update])

  useEffect(() => setLive([]), [state.tool])

  // ------------------------------------------------------------- overlay
  const hovered = state.hoveredRoom ? model.roomById.get(state.hoveredRoom) : null
  const selected = state.selectedRoom ? model.roomById.get(state.selectedRoom) : null

  const roomPath = (pts: Pt[]): string =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${mmToSheet(p).x.toFixed(1)},${mmToSheet(p).y.toFixed(1)}`).join(' ') + 'Z'

  const measureLabel = (a: Pt, b: Pt): { at: Pt; text: string } => ({
    at: mmToSheet({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
    text: fmtLen(Math.hypot(b.x - a.x, b.y - a.y), state.units, state.roundToInch),
  })

  const strokeW = Math.max(1.2, 2.2 / view.z)
  const fontPx = Math.max(11, 15 / view.z)

  return (
    <div
      ref={outerRef}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        background: '#eae6dc',
        cursor: state.tool === 'select' ? (drag.current ? 'grabbing' : 'grab') : 'crosshair',
        touchAction: 'none',
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: SHEET_W, height: SHEET_H,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          transformOrigin: '0 0',
          boxShadow: '0 2px 18px rgba(40,34,24,0.18)',
        }}
      >
        <div ref={sheetRef} dangerouslySetInnerHTML={{ __html: sheetSvg }} />

        {/* the tool overlay shares the sheet's pixel frame exactly */}
        <svg
          width={SHEET_W}
          height={SHEET_H}
          viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {hovered && hovered.id !== selected?.id && (
            <path d={roomPath(hovered.polygon)} fill="rgba(44,92,97,0.12)" stroke="rgba(44,92,97,0.6)" strokeWidth={strokeW} />
          )}
          {selected && (
            <path d={roomPath(selected.polygon)} fill="rgba(44,92,97,0.16)" stroke="#2c5c61" strokeWidth={strokeW * 1.2} />
          )}

          {state.measures.map((m) => {
            const [a, b] = m.points
            if (!b) return null
            const A = mmToSheet(a)
            const B = mmToSheet(b)
            const L = measureLabel(a, b)
            return (
              <g key={m.id}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#a33d2f" strokeWidth={strokeW} />
                {[A, B].map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={strokeW * 2.2} fill="#a33d2f" />
                ))}
                <text x={L.at.x} y={L.at.y - strokeW * 3} fontSize={fontPx} fill="#a33d2f"
                  textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}
                  paintOrder="stroke" stroke="#faf8f4" strokeWidth={fontPx / 4}>
                  {L.text}
                </text>
              </g>
            )
          })}

          {state.areas.map((a) => {
            const c = a.points.reduce((s, p) => ({ x: s.x + p.x / a.points.length, y: s.y + p.y / a.points.length }), { x: 0, y: 0 })
            const P = mmToSheet(c)
            const ar = polyArea(a.points)
            return (
              <g key={a.id}>
                <path d={roomPath(a.points)} fill="rgba(163,61,47,0.10)" stroke="#a33d2f" strokeWidth={strokeW} strokeDasharray={`${strokeW * 4} ${strokeW * 3}`} />
                <text x={P.x} y={P.y} fontSize={fontPx} fill="#a33d2f" textAnchor="middle"
                  fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}
                  paintOrder="stroke" stroke="#faf8f4" strokeWidth={fontPx / 4}>
                  {`${sqM(ar).toFixed(2)} m² · ${sqFt(ar).toFixed(1)} sq ft`}
                </text>
              </g>
            )
          })}

          {live.length > 0 && cursor && (
            <g>
              <path
                d={live.map((p, i) => `${i ? 'L' : 'M'}${mmToSheet(p).x},${mmToSheet(p).y}`).join(' ') +
                  `L${mmToSheet(cursor).x},${mmToSheet(cursor).y}`}
                fill="none" stroke="#a33d2f" strokeWidth={strokeW} strokeDasharray={`${strokeW * 3} ${strokeW * 2}`}
              />
              {state.tool === 'measure' && live.length === 1 && (() => {
                const L = measureLabel(live[0], cursor)
                return (
                  <text x={L.at.x} y={L.at.y - strokeW * 3} fontSize={fontPx} fill="#a33d2f" textAnchor="middle"
                    fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}
                    paintOrder="stroke" stroke="#faf8f4" strokeWidth={fontPx / 4}>
                    {L.text}
                  </text>
                )
              })()}
            </g>
          )}

          {state.markups.map((m, i) => {
            const P = mmToSheet(m.at)
            return (
              <g key={m.id}>
                <circle cx={P.x} cy={P.y} r={strokeW * 5} fill="#b8860b" stroke="#faf8f4" strokeWidth={strokeW} />
                <text x={P.x} y={P.y + fontPx * 0.36} fontSize={fontPx} fill="#fff" textAnchor="middle"
                  fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}>
                  {i + 1}
                </text>
              </g>
            )
          })}

          {cursor && state.snap && state.tool !== 'select' && (() => {
            const P = mmToSheet(cursor)
            return <circle cx={P.x} cy={P.y} r={strokeW * 3} fill="none" stroke="#a33d2f" strokeWidth={strokeW * 0.8} />
          })()}
        </svg>
      </div>

      {!compact && (
        <>
          <div className="no-print" style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6,
            background: 'rgba(250,248,244,0.94)', border: '1px solid #d5cdbb', borderRadius: 7, padding: 5 }}>
            {(
              [
                ['select', 'Pan / select'],
                ['measure', 'Measure'],
                ['area', 'Area'],
                ['markup', 'Markup'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} aria-pressed={state.tool === id} onClick={() => set({ tool: id })}>
                {label}
              </button>
            ))}
            <span style={{ width: 1, background: '#d5cdbb', margin: '2px 3px' }} />
            <button onClick={() => setView((v) => zoomAbout(outerRef.current!, v, 1.3))} title="Zoom in">＋</button>
            <button onClick={() => setView((v) => zoomAbout(outerRef.current!, v, 1 / 1.3))} title="Zoom out">－</button>
            <button onClick={fit} title="Fit the sheet">Fit</button>
          </div>
          <div className="tiny" style={{ position: 'absolute', bottom: 10, left: 10, padding: '5px 10px',
            background: 'rgba(250,248,244,0.92)', border: '1px solid #d5cdbb', borderRadius: 5, color: '#6d6558' }}>
            {state.tool === 'select' && 'The CAD sheet, verbatim. Drag to pan · wheel to zoom · click a room to inspect.'}
            {state.tool === 'measure' && 'Measure: click two points. Snap is ' + (state.snap ? 'on' : 'off') + ' · Esc cancels · Del clears.'}
            {state.tool === 'area' && 'Area: click the corners, double-click to close. Esc cancels · Del clears.'}
            {state.tool === 'markup' && 'Markup: click where the note belongs.'}
          </div>
        </>
      )}
    </div>
  )
}

function zoomAbout(el: HTMLElement, v: { x: number; y: number; z: number }, f: number): { x: number; y: number; z: number } {
  const r = el.getBoundingClientRect()
  const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * f))
  const k = z / v.z
  const cx = r.width / 2
  const cy = r.height / 2
  return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }
}

/** The sheet's layer toggles, driven by the SVG's own <g id="L-*"> groups. */
export function SheetLayersPanel(): React.ReactElement {
  const { state, set } = useStore()
  return (
    <div className="panel">
      <h3>Sheet layers</h3>
      {SHEET_LAYERS.map((l) => (
        <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
          <input
            type="checkbox"
            checked={state.sheetLayers[l.id]}
            onChange={(e) =>
              set({ sheetLayers: { ...state.sheetLayers, [l.id]: e.target.checked } })}
          />
          <span>{l.label}</span>
        </label>
      ))}
      <p className="tiny" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>
        Structure — walls, columns, shafts — is always drawn. These groups come from the
        CAD sheet itself.
      </p>
    </div>
  )
}
