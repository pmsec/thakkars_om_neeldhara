/**
 * THE 2D plan: the CAD sheet, verbatim, with the portal's tools laid over it.
 *
 * The active home's plan-sheet.svg is copied byte-for-byte from the CAD
 * branch by its exporter. The sheet's own coordinate frame is stamped on its
 * root (data-frame, data-pad — see export/sheetFrame.ts), so model
 * millimetres and sheet pixels convert losslessly for either home, and every
 * tool (measure, area, markup, room inspect) works on the real drawing. The sheet's <g id="L-*"> groups, emitted by the
 * CAD generator, give the layer toggles.
 *
 * When the plan changes on the CAD branch, re-running the exporter refreshes
 * this sheet with the model data, and everything here follows.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sheetSvg } from '../data/sheet'
import { parseSheetFrame } from '../export/sheetFrame'
import { getModel } from '../geometry/model'
import { formatFeetInches, sqFt, sqM } from '../geometry/units'
import { area as polyArea, pointInPolygon, type Pt } from '../geometry/vec'
import { useStore } from '../ui/store'

const model = getModel()

// ---- the sheet's own frame, stamped on the SVG root by the CAD generator
const FRAME = parseSheetFrame(sheetSvg)
const SHEET_W = FRAME.w
const SHEET_H = FRAME.h
const SC = FRAME.sc
const { mmToSheet, sheetToMm } = FRAME

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

// the measure tool reads in feet and inches whatever the unit toggle says
// (Karan's call): a tape on the plan, not a millimetre rule
function fmtLen(mm: number, roundToInch: boolean): string {
  return formatFeetInches(mm, roundToInch ? 1 : 16)
}

/** A measure endpoint under the pointer: which chain, which end. */
interface Handle { id: string; idx: number }

export function SheetView({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { state, set, update } = useStore()
  const outerRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, z: 0.35 })
  const [fetched, setFetched] = useState<{ svg: string; note: string; newer: boolean } | null>(null)
  const [fetching, setFetching] = useState(false)
  const [cursor, setCursor] = useState<Pt | null>(null)          // mm
  const [live, setLive] = useState<Pt[]>([])                     // mm, active chain
  // one pointer down on the sheet: a pan, or a measure endpoint being
  // dragged; `slop` is how far it may wander and still count as a tap (a
  // finger lands far less exactly than a mouse). On a finger the measure
  // tool arms a HOLD timer: held still that long, the finger sets a point
  // (or grabs an end) and the pan becomes a handle drag; moved or lifted
  // sooner, nothing is set (Karan's call: no points from a stray touch)
  const drag = useRef<{
    px: number; py: number; x: number; y: number; moved: boolean; slop: number
    kind: 'pan' | 'handle'; handle?: Handle; hold?: number
    off?: { x: number; y: number }                // handle: the point's screen offset from the pointer, so it slides without a jump
  } | null>(null)
  // a long press, not a tap: a brush is shorter than this, a deliberate
  // touch longer (Karan's call: two seconds was far too long)
  const HOLD = 450
  const [hold, setHold] = useState<Pt | null>(null)            // mm, a finger held, the ring growing
  const liveRef = useRef(live)
  liveRef.current = live
  const sheetLayers = state.sheetLayers
  const snaps = useMemo(snapPoints, [])

  const fetchLatest = useCallback(async (): Promise<void> => {
    setFetching(true)
    try {
      const res = await fetch('/api/plan', { cache: 'no-store' })
      const body = (await res.json()) as {
        svg?: string
        commit?: { sha: string; date: string; message: string } | null
        error?: string
      }
      if (!res.ok || !body.svg) {
        throw new Error(body.error ?? `The plan endpoint returned ${res.status}`)
      }
      const newer = body.svg !== sheetSvg
      const when = body.commit?.date ? new Date(body.commit.date).toLocaleString() : 'unknown date'
      setFetched({
        svg: body.svg,
        note: body.commit
          ? `Sheet ${body.commit.sha} · ${when} · ${body.commit.message}`
          : 'Latest sheet fetched',
        newer,
      })
    } catch (err) {
      window.alert(
        `Could not fetch the latest plan.\n\n${err instanceof Error ? err.message : String(err)}\n\n` +
          'The button needs the deployed /api/plan function and a GITHUB_TOKEN in the Vercel project settings.',
      )
    } finally {
      setFetching(false)
    }
  }, [])

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
  }, [sheetLayers, fetched])

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
    (p: Pt, touch = false): Pt => {
      if (!state.snap) return p
      const tolMm = (touch ? 22 : 14) / (view.z * SC)   // screen px; a finger gets more
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

  // the measure endpoint (committed or the live chain's) within `tol` screen
  // px of the pointer, nearest first — a handle to drag it by
  const mmToScreen = useCallback(
    (p: Pt) => {
      const r = outerRef.current!.getBoundingClientRect()
      const q = mmToSheet(p)
      return { x: r.left + view.x + q.x * view.z, y: r.top + view.y + q.y * view.z }
    },
    [view],
  )
  const handleAt = useCallback(
    (clientX: number, clientY: number, tol: number): Handle | null => {
      let best: Handle | null = null
      let bd = tol
      const probe = (id: string, pts: Pt[]) => pts.forEach((p, idx) => {
        const q = mmToScreen(p)
        const d = Math.hypot(q.x - clientX, q.y - clientY)
        if (d < bd) { bd = d; best = { id, idx } }
      })
      probe('live', live)
      for (const m of state.measures) probe(m.id, m.points)
      return best
    },
    [mmToScreen, live, state.measures],
  )
  const pointOf = useCallback(
    (h: Handle): Pt | undefined => (h.id === 'live' ? liveRef.current[h.idx] : state.measures.find((m) => m.id === h.id)?.points[h.idx]),
    [state.measures],
  )
  const movePoint = useCallback(
    (h: Handle, mm: Pt) => {
      if (h.id === 'live') setLive((pts) => pts.map((p, i) => (i === h.idx ? mm : p)))
      else update((s) => ({ ...s, measures: s.measures.map((m) => (m.id === h.id ? { ...m, points: m.points.map((p, i) => (i === h.idx ? mm : p)) } : m)) }))
    },
    [update],
  )
  const commitMeasure = useCallback(
    (a: Pt, b: Pt) => update((s) => ({ ...s, measures: [...s.measures, { id: `M${Date.now()}`, points: [a, b], committed: true }] })),
    [update],
  )

  // two fingers: a pinch zooms about the fingers' midpoint and pans with it
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d0: number; z0: number; mx0: number; my0: number; x0: number; y0: number } | null>(null)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // capturing the pointer on the container would steal the click from
      // the toolbar buttons layered over the sheet — leave their events alone
      if ((e.target as HTMLElement).closest('button, select, input, a, label')) return
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) {
        const [p1, p2] = [...pointers.current.values()]
        const rect = outerRef.current!.getBoundingClientRect()
        pinch.current = {
          d0: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)), z0: view.z,
          mx0: (p1.x + p2.x) / 2 - rect.left, my0: (p1.y + p2.y) / 2 - rect.top, x0: view.x, y0: view.y,
        }
        drag.current = null
        return
      }
      const touch = e.pointerType !== 'mouse'
      const slop = touch ? 12 : 4
      const base = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false, slop }
      if (state.tool === 'measure') {
        if (!touch) {
          // a mouse on an endpoint drags it straight away
          const h = handleAt(e.clientX, e.clientY, 8)
          if (h) {
            const q = mmToScreen(pointOf(h)!)
            drag.current = { ...base, kind: 'handle', handle: h, off: { x: q.x - e.clientX, y: q.y - e.clientY } }
            return
          }
        } else {
          // a finger pans until it has held still for HOLD: then it grabs the
          // end under it, or sets the next point of the measure, and keeps
          // hold of that point to slide it while it stays down
          const mm = snapMm(screenToMm(e.clientX, e.clientY), true)
          const h = handleAt(e.clientX, e.clientY, 24)
          const d: NonNullable<typeof drag.current> = { ...base, kind: 'pan' }
          d.hold = window.setTimeout(() => {
            if (drag.current !== d || d.moved) return
            d.hold = undefined
            d.kind = 'handle'
            // the point keeps its offset from the finger from here on, so the
            // slide starts where the point is and follows every move
            const at = h ? pointOf(h)! : mm
            const q = mmToScreen(at)
            const f = pointers.current.get(e.pointerId) ?? { x: e.clientX, y: e.clientY }
            d.off = { x: q.x - f.x, y: q.y - f.y }
            if (h) d.handle = h
            else {
              const pts = liveRef.current
              if (pts.length === 0) { setLive([mm]); d.handle = { id: 'live', idx: 0 } }
              else {
                const id = `M${Date.now()}`
                update((s) => ({ ...s, measures: [...s.measures, { id, points: [pts[0], mm], committed: true }] }))
                setLive([])
                d.handle = { id, idx: 1 }
              }
            }
            setHold(null)
            navigator.vibrate?.(30)
          }, HOLD)
          setHold(mm)
          drag.current = d
          return
        }
      }
      drag.current = { ...base, kind: 'pan' }
    },
    [view, state.tool, handleAt, snapMm, screenToMm, update, mmToScreen, pointOf],
  )
  // a hold that is over, one way or another
  const endHold = (d: NonNullable<typeof drag.current> | null) => {
    if (d?.hold) { window.clearTimeout(d.hold); d.hold = undefined }
    setHold(null)
  }

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pz = pinch.current
      if (pz && pointers.current.size >= 2) {
        const [p1, p2] = [...pointers.current.values()]
        const rect = outerRef.current!.getBoundingClientRect()
        const dist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y))
        const z = Math.min(MAX_Z, Math.max(MIN_Z, pz.z0 * (dist / pz.d0)))
        const k = z / pz.z0
        const mx = (p1.x + p2.x) / 2 - rect.left
        const my = (p1.y + p2.y) / 2 - rect.top
        setView({ x: mx - (pz.mx0 - pz.x0) * k, y: my - (pz.my0 - pz.y0) * k, z })
        return
      }
      const d = drag.current
      if (d) {
        const dx = e.clientX - d.px
        const dy = e.clientY - d.py
        if (Math.hypot(dx, dy) > d.slop) d.moved = true
        if (d.kind === 'handle') {
          // every move, no dead zone: the point rides with the finger at its
          // offset, snapping only at the mouse's tight reach so it does not
          // feel stuck to the last corner
          const off = d.off ?? { x: 0, y: 0 }
          movePoint(d.handle!, snapMm(screenToMm(e.clientX + off.x, e.clientY + off.y)))
          return
        }
        if (d.moved) {
          if (d.hold) endHold(d)               // the finger moved: a pan, not a hold
          setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }))
        }
        return
      }
      const mm = snapMm(screenToMm(e.clientX, e.clientY), e.pointerType !== 'mouse')
      setCursor(mm)
      if (state.tool === 'select') {
        const r = roomAt(mm)
        if ((r?.id ?? null) !== state.hoveredRoom) set({ hoveredRoom: r?.id ?? null })
      }
    },
    [screenToMm, snapMm, state.tool, state.hoveredRoom, roomAt, set, movePoint],
  )

  // a cancelled touch (the browser took the gesture) ends whatever it was
  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    endHold(drag.current)
    drag.current = null
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pinch.current) {
        // the pinch ends when either finger lifts; the other does not become a pan
        if (pointers.current.size < 2) pinch.current = null
        drag.current = null
        return
      }
      const d = drag.current
      drag.current = null
      // a lift with no down of ours (one that began on a toolbar button, say)
      // is not a tap on the sheet: the Measure button must not set point A
      if (!d) return
      if ((e.target as HTMLElement).closest('button, select, input, a, label')) return
      endHold(d)
      const touch = e.pointerType !== 'mouse'
      if (d.kind === 'handle') return            // the endpoint has been set or moved already
      if (d.moved) return                        // it was a pan, not a click
      if (touch && state.tool === 'measure') return   // a finger sets points by holding, never by a tap
      const mm = snapMm(screenToMm(e.clientX, e.clientY), touch)

      if (state.tool === 'select') {
        const r = roomAt(mm)
        set({ selectedRoom: r?.id ?? null })
        return
      }
      if (state.tool === 'measure') {
        setLive((pts) => {
          const next = [...pts, mm]
          if (next.length === 2) {
            commitMeasure(next[0], next[1])
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
    [screenToMm, snapMm, state.tool, roomAt, set, update, commitMeasure],
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

  // a change of tool drops the live chain, and leaving Pan / select drops
  // the room selection: the measure tool must not keep lighting rooms up
  useEffect(() => {
    setLive([])
    if (state.tool !== 'select') set({ selectedRoom: null, hoveredRoom: null })
  }, [state.tool, set])
  const clearAll = useCallback(() => {
    setLive([])
    update((s) => ({ ...s, measures: [], areas: [] }))
  }, [update])

  // ------------------------------------------------------------- overlay
  const hovered = state.hoveredRoom ? model.roomById.get(state.hoveredRoom) : null
  const selected = state.selectedRoom ? model.roomById.get(state.selectedRoom) : null

  const roomPath = (pts: Pt[]): string =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${mmToSheet(p).x.toFixed(1)},${mmToSheet(p).y.toFixed(1)}`).join(' ') + 'Z'

  const measureLabel = (a: Pt, b: Pt): { at: Pt; text: string } => ({
    at: mmToSheet({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
    text: fmtLen(Math.hypot(b.x - a.x, b.y - a.y), state.roundToInch),
  })
  // an endpoint's handle: a ring a finger can find, on the dot
  const handleRing = (p: { x: number; y: number }, key: React.Key) => (
    <g key={key}>
      <circle cx={p.x} cy={p.y} r={strokeW * 5} fill="rgba(163,61,47,0.12)" stroke="#a33d2f" strokeWidth={strokeW * 0.6} />
      <circle cx={p.x} cy={p.y} r={strokeW * 2.2} fill="#a33d2f" />
    </g>
  )

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
      onPointerCancel={onPointerCancel}
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
        <div ref={sheetRef} dangerouslySetInnerHTML={{ __html: fetched?.svg ?? sheetSvg }} />

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
                {[A, B].map((p, i) => handleRing(p, i))}
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

          {live.length > 0 && (
            <g>
              {live.map((p, i) => handleRing(mmToSheet(p), i))}
              {live.length > 1 && (
                <path
                  d={live.map((p, i) => `${i ? 'L' : 'M'}${mmToSheet(p).x},${mmToSheet(p).y}`).join(' ')}
                  fill="none" stroke="#a33d2f" strokeWidth={strokeW}
                />
              )}
              {cursor && (
                <path
                  d={`M${mmToSheet(live[live.length - 1]).x},${mmToSheet(live[live.length - 1]).y}` +
                    `L${mmToSheet(cursor).x},${mmToSheet(cursor).y}`}
                  fill="none" stroke="#a33d2f" strokeWidth={strokeW} strokeDasharray={`${strokeW * 3} ${strokeW * 2}`}
                />
              )}
              {state.tool === 'measure' && live.length === 1 && cursor && (() => {
                const L = measureLabel(live[0], cursor)
                return (
                  <text x={L.at.x} y={L.at.y - strokeW * 3} fontSize={fontPx} fill="#a33d2f" textAnchor="middle"
                    fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}
                    paintOrder="stroke" stroke="#faf8f4" strokeWidth={fontPx / 4}>
                    {L.text}
                  </text>
                )
              })()}
              {state.tool === 'area' && live.length >= 3 && (() => {
                const c = live.reduce((a, p) => ({ x: a.x + p.x / live.length, y: a.y + p.y / live.length }), { x: 0, y: 0 })
                const P = mmToSheet(c)
                const ar = polyArea(live)
                return (
                  <text x={P.x} y={P.y} fontSize={fontPx} fill="#a33d2f" textAnchor="middle"
                    fontFamily="Helvetica,Arial,sans-serif" fontWeight={700}
                    paintOrder="stroke" stroke="#faf8f4" strokeWidth={fontPx / 4}>
                    {`${sqM(ar).toFixed(2)} m² · ${sqFt(ar).toFixed(1)} sq ft`}
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

          {hold && (() => {
            // the finger's hold, a ring that grows for the two seconds it takes
            const P = mmToSheet(hold)
            return (
              <circle cx={P.x} cy={P.y} r={strokeW * 2} fill="rgba(163,61,47,0.10)" stroke="#a33d2f" strokeWidth={strokeW * 1.4}>
                <animate attributeName="r" from={strokeW * 2} to={strokeW * 16} dur={`${HOLD}ms`} fill="freeze" />
              </circle>
            )
          })()}
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
            <button onClick={clearAll} disabled={state.measures.length === 0 && state.areas.length === 0 && live.length === 0}
              title="Clear every measurement and area on the sheet">
              Clear measures
            </button>
            <span style={{ width: 1, background: '#d5cdbb', margin: '2px 3px' }} />
            <button onClick={() => void fetchLatest()} disabled={fetching}
              title="Pull the newest sheet straight from the CAD branch, without waiting for a redeploy">
              {fetching ? 'Fetching…' : 'Fetch latest plan'}
            </button>
            <span style={{ width: 1, background: '#d5cdbb', margin: '2px 3px' }} />
            <button onClick={() => setView((v) => zoomAbout(outerRef.current!, v, 1.3))} title="Zoom in">＋</button>
            <button onClick={() => setView((v) => zoomAbout(outerRef.current!, v, 1 / 1.3))} title="Zoom out">－</button>
            <button onClick={fit} title="Fit the sheet">Fit</button>
          </div>
          {fetched && (
            <div className="tiny" style={{ position: 'absolute', top: 56, left: 10, padding: '5px 10px',
              background: fetched.newer ? 'rgba(255,244,214,0.96)' : 'rgba(232,240,229,0.96)',
              border: `1px solid ${fetched.newer ? '#c9a227' : '#7d9a72'}`, borderRadius: 5,
              color: '#5a5142', maxWidth: 520 }}>
              {fetched.note}
              {fetched.newer &&
                ' — newer than this build: the sheet is current, but the room inspector, 3D and walkthrough follow on the next deploy.'}
              {!fetched.newer && ' — this build is already up to date.'}
            </div>
          )}
          <div className="tiny no-print" style={{ position: 'absolute', bottom: 10, left: 10, padding: '5px 10px',
            background: 'rgba(250,248,244,0.92)', border: '1px solid #d5cdbb', borderRadius: 5, color: '#6d6558',
            display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>
              {state.tool === 'select' && 'The CAD sheet, verbatim. Drag to pan · wheel or pinch to zoom · tap a room to inspect.'}
              {state.tool === 'measure' && 'Measure, in feet and inches. Finger: press and hold on a point to set A, then B; press and hold an end to grab it and slide. Mouse: click A then B. Snap is ' + (state.snap ? 'on' : 'off') + '.'}
              {state.tool === 'area' && (live.length < 3
                ? `Area: tap the corners (${live.length} so far), then close.`
                : `Area: ${live.length} corners — close it, or keep tapping.`)}
              {state.tool === 'markup' && 'Markup: tap where the note belongs.'}
            </span>
            {state.tool === 'area' && live.length >= 3 && (
              <button
                onClick={() => {
                  update((s2) => ({
                    ...s2,
                    areas: [...s2.areas, { id: `A${Date.now()}`, points: live, committed: true }],
                  }))
                  setLive([])
                }}
              >
                Close area
              </button>
            )}
            {live.length > 0 && <button onClick={() => setLive([])}>Cancel</button>}
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
