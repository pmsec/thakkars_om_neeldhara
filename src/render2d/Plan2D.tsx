/**
 * The 2D plan viewer. SVG so it stays crisp at any zoom, prints at true scale, and
 * exports to vector without a second rendering path.
 *
 * Every coordinate drawn here comes from the geometry module. There are no literals.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getModel } from '../geometry/model'
import { buildDimensions } from '../geometry/dimensions'
import { fixtures } from '../data/fixtures'
import { furniture } from '../data/furniture'
import { building } from '../data/building'
import { formatArea, formatLength, formatMm } from '../geometry/units'
import { area as polyArea, dist, perimeter, pointInPolygon, type Poly, type Pt } from '../geometry/vec'
import { useStore } from '../ui/store'
import underlayUrl from '../assets/builder-original-plan.jpg'
import {
  archPath,
  buildSnapIndex,
  chainLength,
  curvePoints,
  dimGeometry,
  doorSwing,
  multiPath,
  path,
  portalPoints,
  regionPath,
  sliderLeaves,
  snapTo,
  windowLines,
  type SnapTarget,
} from './draw'
import { placeLabel } from './labels'

const model = getModel()
const dims = buildDimensions(model)
const snapIndex = buildSnapIndex(model)

const ROOM_FILL: Record<string, string> = {
  habitable: '#E9DFCB',
  circulation: '#EFE8DA',
  wet: '#DBDFDB',
  service: '#EBE6DC',
  storage: '#EDE7DA',
  outdoor: '#D5CDBD',
  void: '#E4E2DD',
}

interface View {
  x: number
  y: number
  w: number
}

const PAD = 3400

/** Which room contains a model-space point, if any. Voids included, so shafts select too. */
function roomAt(p: Pt): string | null {
  for (const r of model.rooms) {
    if (pointInPolygon(p, r.polygon) && !r.holes.some((h) => pointInPolygon(p, h))) return r.id
  }
  return null
}

function fitView(aspect: number): View {
  const bb = model.envelopeBBox
  const w = bb.maxX - bb.minX + PAD * 2
  const h = bb.maxY - bb.minY + PAD * 2
  const needW = Math.max(w, h * aspect)
  return { x: bb.minX - PAD - (needW - w) / 2, y: bb.minY - PAD, w: needW }
}

export function Plan2D({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { state, set, update } = useStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 800 })
  const [view, setView] = useState<View>(() => fitView(1.5))
  const [cursor, setCursor] = useState<Pt>({ x: 0, y: 0 })
  const [snap, setSnap] = useState<SnapTarget | null>(null)
  const [draft, setDraft] = useState<Pt[]>([])
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  const height = (view.w * size.h) / size.w
  const mmPerPx = view.w / size.w
  const scaleDenom = Math.round(mmPerPx * 3.7795) // 1 CSS px ≈ 0.2646 mm on paper

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const didFit = useRef(false)
  useEffect(() => {
    if (!didFit.current && size.w > 100) {
      didFit.current = true
      setView(fitView(size.w / size.h))
    }
  }, [size])

  const toModel = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = svgRef.current!.getBoundingClientRect()
      return {
        x: view.x + ((clientX - r.left) / r.width) * view.w,
        y: view.y + ((clientY - r.top) / r.height) * ((view.w * r.height) / r.width),
      }
    },
    [view],
  )

  // -------------------------------------------------------------- interaction
  const onWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    const p = toModel(e.clientX, e.clientY)
    const k = Math.exp(e.deltaY * 0.0013)
    const nw = Math.min(180000, Math.max(900, view.w * k))
    const r = svgRef.current!.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    setView({ x: p.x - fx * nw, y: p.y - fy * ((nw * r.height) / r.width), w: nw })
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button === 1 || e.button === 2 || state.tool === 'select') {
      pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const raw = toModel(e.clientX, e.clientY)
    setCursor(raw)
    if (pan.current) {
      const dx = e.clientX - pan.current.x
      const dy = e.clientY - pan.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.current.moved = true
      setView((v) => ({ ...v, x: pan.current!.vx - dx * mmPerPx, y: pan.current!.vy - dy * mmPerPx }))
      return
    }
    if (state.tool !== 'select' && state.snap) {
      setSnap(snapTo(snapIndex, raw, mmPerPx * 14))
    } else {
      setSnap(null)
    }
    // Hit-test against the derived polygons rather than relying on DOM hit-testing,
    // which pointer capture during panning makes unreliable.
    if (state.tool === 'select') {
      const hit = roomAt(raw)
      if (hit !== state.hoveredRoom) set({ hoveredRoom: hit })
    }
  }

  const onPointerUp = (e: React.PointerEvent): void => {
    const wasPan = pan.current
    pan.current = null
    if (wasPan?.moved) return
    const p = snap?.at ?? toModel(e.clientX, e.clientY)

    if (state.tool === 'select') {
      set({ selectedRoom: roomAt(p) })
      return
    }
    if (state.tool === 'measure' || state.tool === 'area') {
      setDraft((d) => [...d, p])
      return
    }
    if (state.tool === 'markup') {
      const text = window.prompt('Comment for this location:')
      if (text) {
        update((s) => ({
          ...s,
          markups: [
            ...s.markups,
            {
              id: `M-${s.markups.length + 1}`,
              at: p,
              text,
              author: s.author,
              date: new Date().toISOString().slice(0, 10),
            },
          ],
        }))
      }
      return
    }
    if (state.tool === 'calibrate') {
      update((s) => {
        // First two clicks land on the underlay and are recorded in IMAGE pixel space,
        // by inverting the current placement. The next two are model points.
        if (s.calibration.imagePoints.length < 2) {
          const t = s.underlay.transform
          if (!t) return s
          const c = Math.cos(-t.rotation) / t.scale
          const sn = Math.sin(-t.rotation) / t.scale
          const dx = p.x - t.tx
          const dy = p.y - t.ty
          const img = { x: c * dx - sn * dy, y: sn * dx + c * dy }
          return { ...s, calibration: { ...s.calibration, imagePoints: [...s.calibration.imagePoints, img] } }
        }
        return {
          ...s,
          calibration: { ...s.calibration, modelPoints: [...s.calibration.modelPoints, p].slice(-2) },
        }
      })
    }
  }

  const commitDraft = useCallback((): void => {
    if (draft.length < 2) {
      setDraft([])
      return
    }
    if (state.tool === 'measure') {
      update((s) => ({
        ...s,
        measures: [...s.measures, { id: `D-${s.measures.length + 1}`, points: draft, committed: true }],
      }))
    } else if (state.tool === 'area' && draft.length >= 3) {
      update((s) => ({
        ...s,
        areas: [...s.areas, { id: `A-${s.areas.length + 1}`, points: draft, committed: true }],
      }))
    }
    setDraft([])
  }, [draft, state.tool, update])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDraft([])
      if (e.key === 'Enter') commitDraft()
      if (e.key === 'f') setView(fitView(size.w / size.h))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commitDraft, size])

  // Zoom to the selected room when another view asks for it.
  useEffect(() => {
    if (!state.flyTo) return
    const room = model.roomById.get(state.flyTo.room)
    if (!room) return
    const b = room.bbox
    const w = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 2.1 + 2000
    setView({ x: (b.minX + b.maxX) / 2 - w / 2, y: (b.minY + b.maxY) / 2 - (w * size.h) / size.w / 2, w })
  }, [state.flyTo, size])

  const L = state.layers
  const fmt = (mm: number): string => formatLength(mm, state.units, state.roundToInch ? 1 : 16)

  const underlay = useMemo(() => {
    const t = state.underlay.transform
    if (!t) return null
    const c = Math.cos(t.rotation) * t.scale
    const s = Math.sin(t.rotation) * t.scale
    return `matrix(${c} ${s} ${-s} ${c} ${t.tx} ${t.ty})`
  }, [state.underlay.transform])

  const draftLive = snap && draft.length ? [...draft, snap.at] : draft

  return (
    <div className="planwrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${height}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={commitDraft}
        style={{ cursor: state.tool === 'select' ? 'grab' : 'crosshair', background: 'var(--paper)' }}
      >
        <defs>
          <pattern id="hatch-void" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="260" stroke="#B8B5AE" strokeWidth="26" />
          </pattern>
          <pattern id="hatch-service" width="340" height="340" patternUnits="userSpaceOnUse">
            <rect width="340" height="340" fill="none" />
            <path d="M0 340H340V0" fill="none" stroke="#D9D2C3" strokeWidth="18" />
          </pattern>
        </defs>

        {/* ---------- underlay: the builder's sanctioned plan ---------- */}
        {L.underlay && underlay && (
          <g transform={underlay} opacity={state.underlay.opacity} pointerEvents="none">
            <image href={underlayUrl} x={0} y={0} width={1170} height={2348} />
          </g>
        )}

        {/* ---------- grid ---------- */}
        {L.grid && <GridLayer view={view} height={height} />}

        {/* ---------- room floors ---------- */}
        <g>
          {model.rooms.map((r) => {
            const isVoid = r.def.category === 'void'
            if (isVoid && !L.shafts) return null
            const hovered = state.hoveredRoom === r.id
            const selected = state.selectedRoom === r.id
            return (
              <path
                key={r.id}
                d={regionPath(r.polygon, r.holes)}
                fill={isVoid ? 'url(#hatch-void)' : ROOM_FILL[r.def.category] ?? '#EFE8DA'}
                fillRule="evenodd"
                stroke={selected ? 'var(--accent)' : hovered ? 'var(--glass)' : 'none'}
                strokeWidth={selected ? 90 : 60}
                opacity={hovered && !selected ? 0.92 : 1}
                pointerEvents="none"
              />
            )
          })}
        </g>

        {/* ---------- service-zone tint ---------- */}
        {L.serviceTint && (
          <g pointerEvents="none">
            {model.rooms
              .filter((r) => r.def.zone === 'service')
              .map((r) => (
                <path key={r.id} d={regionPath(r.polygon, r.holes)} fill="url(#hatch-service)" opacity={0.85} />
              ))}
          </g>
        )}

        {/* ---------- glass roofs ---------- */}
        {L.glassRoof && (
          <g pointerEvents="none">
            {building.glassRoofs.map((g) => (
              <rect
                key={g.id}
                x={g.extent[0]}
                y={g.extent[1]}
                width={g.extent[2] - g.extent[0]}
                height={g.extent[3] - g.extent[1]}
                fill="#D8E8EF"
                opacity={g.kind === 'barrel' ? 0.4 : 0.3}
                stroke="var(--glass)"
                strokeWidth={g.kind === 'barrel' ? 40 : 25}
                strokeDasharray={g.kind === 'barrel' ? undefined : '260 180'}
              />
            ))}
            {/* Tree cages: real structure, projecting past the slab edge, drawn solid so
                they are not mistaken for the glass extent they sit inside. */}
            {building.cages.map((c) => (
              <g key={c.id}>
                <rect
                  x={c.from}
                  y={c.at - c.projection}
                  width={c.to - c.from}
                  height={c.projection}
                  fill="#CBD8CE"
                  opacity={0.55}
                  stroke="var(--ink)"
                  strokeWidth={45}
                />
                <text
                  x={(c.from + c.to) / 2}
                  y={c.at - c.projection * 0.22}
                  textAnchor="middle"
                  fontSize={185}
                  fill="var(--ink)"
                  opacity={0.7}
                >
                  TREE CAGE {c.projection}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* ---------- furniture (its own layer, switchable) ---------- */}
        {L.furniture && <FurnitureLayer />}
        {L.fixtures && <FixtureLayer />}

        {/* ---------- walls ---------- */}
        {L.walls && (
          <path d={multiPath(model.wallFootprint)} fill="var(--ink)" fillRule="evenodd" pointerEvents="none" />
        )}

        {/* ---------- openings ---------- */}
        {L.openings && <OpeningLayer />}
        {L.glazing && <GlazingLayer />}
        {L.curvedGlass && <CurvedGlassLayer />}

        {/* ---------- labels ---------- */}
        {L.labels && <LabelLayer roundToInch={state.roundToInch} />}

        {/* ---------- dimension chains ---------- */}
        {L.dimensions && <DimensionLayer fmt={fmt} />}

        {/* ---------- ad-hoc measurements ---------- */}
        <g pointerEvents="none">
          {state.measures.map((m) => (
            <MeasureChainView key={m.id} pts={m.points} fmt={fmt} colour="var(--accent)" />
          ))}
          {state.areas.map((a) => (
            <AreaView key={a.id} pts={a.points} fmt={fmt} />
          ))}
          {draftLive.length > 0 && state.tool === 'measure' && (
            <MeasureChainView pts={draftLive} fmt={fmt} colour="var(--ochre)" />
          )}
          {draftLive.length > 0 && state.tool === 'area' && <AreaView pts={draftLive} fmt={fmt} draft />}
        </g>

        {/* ---------- markup pins ---------- */}
        <g>
          {state.markups.map((m, i) => (
            <g key={m.id} transform={`translate(${m.at.x} ${m.at.y})`}>
              <circle r={190} fill="var(--ochre)" stroke="#fff" strokeWidth={40} />
              <text y={62} textAnchor="middle" fontSize={200} fill="#fff" fontWeight="700">
                {i + 1}
              </text>
            </g>
          ))}
        </g>

        {/* ---------- snap indicator ---------- */}
        {snap && (
          <g pointerEvents="none">
            <rect
              x={snap.at.x - mmPerPx * 5}
              y={snap.at.y - mmPerPx * 5}
              width={mmPerPx * 10}
              height={mmPerPx * 10}
              fill="none"
              stroke="var(--ochre)"
              strokeWidth={mmPerPx * 1.6}
            />
          </g>
        )}
      </svg>

      {!compact && (
        <div className="toolbar">
          {(['select', 'measure', 'area', 'markup'] as const).map((t) => (
            <button
              key={t}
              className="btn tiny"
              aria-pressed={state.tool === t}
              onClick={() => {
                setDraft([])
                set({ tool: t })
              }}
            >
              {t === 'select' ? 'Pan / select' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button className="btn tiny" onClick={() => setView(fitView(size.w / size.h))}>
            Fit
          </button>
          <button
            className="btn tiny"
            disabled={!state.selectedRoom}
            onClick={() => state.selectedRoom && set({ flyTo: { room: state.selectedRoom, nonce: Date.now() } })}
          >
            Zoom to selection
          </button>
          {(state.tool === 'measure' || state.tool === 'area') && (
            <button className="btn tiny" onClick={commitDraft}>
              Finish (↵)
            </button>
          )}
        </div>
      )}

      <div className="hud">
        <div className="scalebar">
          <span>1:{scaleDenom}</span>
          <div className="bar" style={{ width: `${2000 / mmPerPx}px` }} />
          <span>2 m</span>
        </div>
        <div>
          x {formatMm(cursor.x)} · y {formatMm(cursor.y)}
          {snap && <> · snap: {snap.label}</>}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- sub-layers

function GridLayer({ view, height }: { view: View; height: number }): React.ReactElement {
  const step = view.w > 40000 ? 5000 : view.w > 14000 ? 1000 : 500
  const lines: React.ReactElement[] = []
  const x0 = Math.floor(view.x / step) * step
  const y0 = Math.floor(view.y / step) * step
  for (let x = x0; x < view.x + view.w; x += step) {
    lines.push(<line key={`x${x}`} x1={x} y1={view.y} x2={x} y2={view.y + height} stroke="#E2DDD2" strokeWidth={step / 120} />)
  }
  for (let y = y0; y < view.y + height; y += step) {
    lines.push(<line key={`y${y}`} x1={view.x} y1={y} x2={view.x + view.w} y2={y} stroke="#E2DDD2" strokeWidth={step / 120} />)
  }
  return <g pointerEvents="none">{lines}</g>
}

function OpeningLayer(): React.ReactElement {
  return (
    <g pointerEvents="none">
      {model.openings.map((op) => {
        if (op.type === 'window') return null
        if (op.type === 'door') {
          const { leaf, arc } = doorSwing(op)
          return (
            <g key={op.id}>
              <line x1={leaf[0].x} y1={leaf[0].y} x2={leaf[1].x} y2={leaf[1].y} stroke="var(--ink)" strokeWidth={46} strokeLinecap="round" />
              <path d={arc} fill="none" stroke="#756E64" strokeWidth={26} strokeDasharray="110 80" />
            </g>
          )
        }
        if (op.type === 'slider') {
          return (
            <g key={op.id}>
              {sliderLeaves(op).map(([a, b], i) => (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--glass)" strokeWidth={64} />
              ))}
            </g>
          )
        }
        if (op.type === 'arch') {
          return (
            <g key={op.id}>
              <path d={archPath(op)} fill="none" stroke="var(--accent)" strokeWidth={42} strokeDasharray="140 110" />
              <line x1={op.p1.x} y1={op.p1.y} x2={op.p2.x} y2={op.p2.y} stroke="var(--accent)" strokeWidth={30} opacity={0.5} />
            </g>
          )
        }
        // Cased opening: jamb ticks.
        const n = { x: -op.dir.y * 95, y: op.dir.x * 95 }
        return (
          <g key={op.id}>
            {[op.p1, op.p2].map((p, i) => (
              <line key={i} x1={p.x - n.x} y1={p.y - n.y} x2={p.x + n.x} y2={p.y + n.y} stroke="var(--ink)" strokeWidth={38} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

function GlazingLayer(): React.ReactElement {
  return (
    <g pointerEvents="none">
      {model.openings
        .filter((o) => o.type === 'window')
        .map((op) => (
          <g key={op.id}>
            {windowLines(op).map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--glass)" strokeWidth={44} />
            ))}
          </g>
        ))}
      {model.walls
        .filter((w) => w.kind === 'glazing')
        .map((w) => (
          <line
            key={w.id}
            x1={w.points[0].x}
            y1={w.points[0].y}
            x2={w.points[w.points.length - 1].x}
            y2={w.points[w.points.length - 1].y}
            stroke="var(--glass)"
            strokeWidth={120}
            strokeLinecap="round"
          />
        ))}
      {model.walls
        .filter((w) => w.kind === 'threshold')
        .map((w) => (
          <line
            key={w.id}
            x1={w.points[0].x}
            y1={w.points[0].y}
            x2={w.points[w.points.length - 1].x}
            y2={w.points[w.points.length - 1].y}
            stroke="#8E877C"
            strokeWidth={34}
            strokeDasharray="240 180"
          />
        ))}
    </g>
  )
}

function CurvedGlassLayer(): React.ReactElement {
  return (
    <g pointerEvents="none">
      {building.walls
        .filter((w) => w.kind === 'curved-glass')
        .map((w) => {
          const pts = curvePoints(model, w.id)
          const gap = portalPoints(w.id)
          const gapSet = new Set(gap.map((p) => `${p.x.toFixed(1)}`))
          // Draw the full curve, then overprint the portal span in the accent dash.
          const solid: Pt[][] = []
          let run: Pt[] = []
          for (const p of pts) {
            const inGap = gap.length > 0 && p.y >= Math.min(gap[0].y, gap[gap.length - 1].y) && p.y <= Math.max(gap[0].y, gap[gap.length - 1].y)
            if (inGap) {
              if (run.length > 1) solid.push(run)
              run = []
            } else {
              run.push(p)
            }
          }
          if (run.length > 1) solid.push(run)
          void gapSet
          return (
            <g key={w.id}>
              <path d={path(pts, false)} fill="none" stroke="var(--glass)" strokeWidth={420} opacity={0.1} />
              {solid.map((s, i) => (
                <g key={i}>
                  <path d={path(s, false)} fill="none" stroke="var(--glass)" strokeWidth={140} strokeLinecap="round" />
                  <path d={path(s, false)} fill="none" stroke="#fff" strokeWidth={38} />
                </g>
              ))}
              {gap.length > 1 && (
                <path d={path(gap, false)} fill="none" stroke="var(--accent)" strokeWidth={40} strokeDasharray="150 120" />
              )}
            </g>
          )
        })}
      {/* Sliding day-bed screen */}
      {building.screens.map((s) => {
        const pts: Pt[] = []
        for (let i = 0; i <= 48; i++) {
          const t = i / 48
          const u = 1 - t
          pts.push({
            x: u * u * s.curve.p0.x + 2 * u * t * s.curve.p1.x + t * t * s.curve.p2.x,
            y: u * u * s.curve.p0.y + 2 * u * t * s.curve.p1.y + t * t * s.curve.p2.y,
          })
        }
        return <path key={s.id} d={path(pts, false)} fill="none" stroke="var(--glass)" strokeWidth={66} strokeDasharray="330 210" />
      })}
    </g>
  )
}

function FixtureLayer(): React.ReactElement {
  return (
    <g pointerEvents="none">
      {fixtures.map((f) => {
        const [w, d] = f.size
        const x = f.at.x - w / 2
        const y = f.at.y - d / 2
        if (f.kind === 'wc') {
          return (
            <g key={f.id}>
              <ellipse cx={f.at.x} cy={f.at.y} rx={w * 0.34} ry={d * 0.48} fill="#FCFBF8" stroke="#A79E90" strokeWidth={30} />
              <rect x={x} y={y} width={w * 0.26} height={d} fill="#F2EBDD" stroke="#A79E90" strokeWidth={30} />
            </g>
          )
        }
        if (f.kind === 'basin' || f.kind === 'sink') {
          return (
            <g key={f.id}>
              <rect x={x} y={y} width={w} height={d} fill="#FCFBF8" stroke="#A79E90" strokeWidth={30} />
              <ellipse cx={f.at.x} cy={f.at.y} rx={w * 0.28} ry={d * 0.28} fill="#F0F4F5" stroke="#A79E90" strokeWidth={24} />
            </g>
          )
        }
        if (f.kind === 'shower') {
          return (
            <g key={f.id}>
              <rect x={x} y={y} width={w} height={d} fill="#EFF4F5" stroke="#A79E90" strokeWidth={30} />
              <line x1={x} y1={y} x2={x + w} y2={y + d} stroke="#A79E90" strokeWidth={22} />
              <line x1={x + w} y1={y} x2={x} y2={y + d} stroke="#A79E90" strokeWidth={22} />
            </g>
          )
        }
        return (
          <rect
            key={f.id}
            x={x}
            y={y}
            width={w}
            height={d}
            fill={f.kind === 'counter' ? '#EEE8DB' : '#F2EBDD'}
            stroke="#A79E90"
            strokeWidth={30}
          />
        )
      })}
    </g>
  )
}

function FurnitureLayer(): React.ReactElement {
  return (
    <g pointerEvents="none" opacity={0.95}>
      {furniture.map((f) => {
        const common = { stroke: '#A79E90', strokeWidth: 30 }
        if (f.kind === 'rug') {
          return <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.d} rx={110} fill="#EEE4D3" stroke="#D9CBB3" strokeWidth={28} />
        }
        if (f.kind === 'plant') {
          return (
            <g key={f.id}>
              <circle cx={f.x + f.w / 2} cy={f.y + f.d / 2} r={f.w / 2} fill="#E8EEE4" stroke="#6C8B6A" strokeWidth={28} />
              <circle cx={f.x + f.w / 2} cy={f.y + f.d / 2} r={f.w / 4} fill="#94AD8F" stroke="#6C8B6A" strokeWidth={20} />
            </g>
          )
        }
        if (f.kind === 'dining') {
          const seats = f.seats ?? [3, 1]
          const chairs: React.ReactElement[] = []
          for (let i = 0; i < seats[0]; i++) {
            const cx = f.x + (f.w * (i + 0.5)) / seats[0]
            chairs.push(<rect key={`t${i}`} x={cx - 225} y={f.y - 520} width={450} height={450} rx={60} fill="#FCFBF8" {...common} />)
            chairs.push(<rect key={`b${i}`} x={cx - 225} y={f.y + f.d + 70} width={450} height={450} rx={60} fill="#FCFBF8" {...common} />)
          }
          for (let i = 0; i < seats[1]; i++) {
            const cy = f.y + (f.d * (i + 0.5)) / seats[1]
            chairs.push(<rect key={`l${i}`} x={f.x - 520} y={cy - 225} width={450} height={450} rx={60} fill="#FCFBF8" {...common} />)
            chairs.push(<rect key={`r${i}`} x={f.x + f.w + 70} y={cy - 225} width={450} height={450} rx={60} fill="#FCFBF8" {...common} />)
          }
          return (
            <g key={f.id}>
              <rect x={f.x} y={f.y} width={f.w} height={f.d} rx={55} fill="#F4EEE1" {...common} />
              {chairs}
            </g>
          )
        }
        if (f.kind === 'drumkit') {
          const cx = f.x + f.w / 2
          const cy = f.y + f.d / 2
          const s = f.w / 3000
          return (
            <g key={f.id}>
              {[
                [0, 200, 500],
                [-540, -170, 240],
                [20, -280, 240],
                [580, 110, 320],
                [-700, 300, 280],
                [730, -350, 320],
                [-170, 540, 290],
              ].map(([dx, dy, r], i) => (
                <circle key={i} cx={cx + dx * s * 1.85} cy={cy + dy * s * 1.85} r={r * s * 1.85} fill="#F2EBDD" {...common} />
              ))}
            </g>
          )
        }
        if (f.kind === 'guitar') {
          const cx = f.x + f.w / 2
          return (
            <g key={f.id}>
              <ellipse cx={cx} cy={f.y + f.d * 0.72} rx={f.w * 0.4} ry={f.d * 0.24} fill="#FCFBF8" {...common} />
              <ellipse cx={cx} cy={f.y + f.d * 0.42} rx={f.w * 0.31} ry={f.d * 0.2} fill="#FCFBF8" {...common} />
              <line x1={cx} y1={f.y + f.d * 0.24} x2={cx} y2={f.y} stroke="#A79E90" strokeWidth={70} strokeLinecap="round" />
            </g>
          )
        }
        if (f.kind === 'stair') {
          return (
            <g key={f.id}>
              <rect x={f.x} y={f.y} width={f.w} height={f.d} fill="#EFEAE0" {...common} />
              {[1, 2, 3, 4, 5].map((i) => (
                <line key={i} x1={f.x} y1={f.y + (i * f.d) / 6} x2={f.x + f.w} y2={f.y + (i * f.d) / 6} stroke="#A79E90" strokeWidth={24} />
              ))}
            </g>
          )
        }
        if (f.kind === 'shelves') {
          const n = Math.max(2, Math.floor(f.d / 430))
          return (
            <g key={f.id}>
              <rect x={f.x} y={f.y} width={f.w} height={f.d} fill="#F1EBDD" {...common} />
              {Array.from({ length: n - 1 }, (_, i) => (
                <line key={i} x1={f.x} y1={f.y + ((i + 1) * f.d) / n} x2={f.x + f.w} y2={f.y + ((i + 1) * f.d) / n} stroke="#A79E90" strokeWidth={20} />
              ))}
            </g>
          )
        }
        if (f.kind === 'sofa' || f.kind === 'bed' || f.kind === 'daybed') {
          const b = 190
          const back =
            f.face === 'N'
              ? { x: f.x, y: f.y + f.d - b, w: f.w, h: b }
              : f.face === 'S'
                ? { x: f.x, y: f.y, w: f.w, h: b }
                : f.face === 'E'
                  ? { x: f.x + f.w - b, y: f.y, w: b, h: f.d }
                  : { x: f.x, y: f.y, w: b, h: f.d }
          return (
            <g key={f.id}>
              <rect x={f.x} y={f.y} width={f.w} height={f.d} rx={70} fill="#FCFBF8" {...common} />
              <rect x={back.x} y={back.y} width={back.w} height={back.h} rx={40} fill="#EFE8DA" {...common} />
            </g>
          )
        }
        if (f.kind === 'armchair') {
          return (
            <g key={f.id}>
              <rect x={f.x} y={f.y} width={f.w} height={f.d} rx={95} fill="#FCFBF8" {...common} />
              <circle cx={f.x + f.w / 2} cy={f.y + f.d / 2} r={f.w * 0.25} fill="#F2EBDD" stroke="#A79E90" strokeWidth={24} />
            </g>
          )
        }
        return <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.d} rx={50} fill="#FCFBF8" {...common} />
      })}
    </g>
  )
}

function LabelLayer({ roundToInch }: { roundToInch: boolean }): React.ReactElement {
  const placed = useMemo(
    () => model.rooms.map((r) => ({ r, p: placeLabel(r, roundToInch ? 1 : 16) })).filter((x) => x.p),
    [roundToInch],
  )
  return (
    <g pointerEvents="none">
      {placed.map(({ r, p }) => {
        const lab = p!
        const rows = lab.name.length + lab.lines.length
        const top = -((rows - 1) * lab.size * 0.6)
        return (
          <g key={r.id} transform={`translate(${lab.at.x} ${lab.at.y}) rotate(${lab.rotation})`}>
            {lab.name.map((line, i) => (
              <text
                key={i}
                y={top + i * lab.size * 1.06}
                textAnchor="middle"
                fontSize={lab.size}
                fontWeight={700}
                fill="var(--txt)"
                letterSpacing={lab.size * 0.02}
              >
                {line}
              </text>
            ))}
            {lab.lines.map((line, i) => (
              <text
                key={`s${i}`}
                y={top + (lab.name.length + i * 0.62) * lab.size * 1.06}
                textAnchor="middle"
                fontSize={lab.size * 0.56}
                fill="var(--txt2)"
              >
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </g>
  )
}

function DimensionLayer({ fmt }: { fmt: (mm: number) => string }): React.ReactElement {
  return (
    <g pointerEvents="none">
      {dims.map((chain) =>
        chain.segments.map((seg, i) => {
          const g = dimGeometry(seg.from, seg.to, chain.offset)
          const size = chain.emphasis ? 260 : 210
          return (
            <g key={`${chain.id}-${i}`}>
              <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#8B867D" strokeWidth={22} />
              {[g.w1, g.w2].map(([p, q], k) => (
                <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#8B867D" strokeWidth={16} />
              ))}
              <text
                x={g.mid.x}
                y={g.mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size}
                fill="#5E5951"
                transform={chain.axis === 'y' ? `rotate(-90 ${g.mid.x} ${g.mid.y})` : undefined}
              >
                <tspan style={{ paintOrder: 'stroke' }} stroke="var(--paper)" strokeWidth={size * 0.5}>
                  {seg.label ? `${seg.label}  ` : ''}
                  {fmt(seg.value)}
                </tspan>
              </text>
            </g>
          )
        }),
      )}
    </g>
  )
}

function MeasureChainView({
  pts,
  fmt,
  colour,
}: {
  pts: Pt[]
  fmt: (mm: number) => string
  colour: string
}): React.ReactElement {
  const total = chainLength(pts)
  return (
    <g>
      <path d={path(pts, false)} fill="none" stroke={colour} strokeWidth={44} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={80} fill={colour} />
      ))}
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1]
        const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
        return (
          <text key={i} x={m.x} y={m.y - 130} textAnchor="middle" fontSize={230} fill={colour} fontWeight={600}>
            <tspan style={{ paintOrder: 'stroke' }} stroke="var(--paper)" strokeWidth={110}>
              {fmt(dist(p, q))}
            </tspan>
          </text>
        )
      })}
      {pts.length > 2 && (
        <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y + 330} textAnchor="middle" fontSize={230} fill={colour} fontWeight={700}>
          <tspan style={{ paintOrder: 'stroke' }} stroke="var(--paper)" strokeWidth={110}>
            Σ {fmt(total)}
          </tspan>
        </text>
      )}
    </g>
  )
}

function AreaView({ pts, fmt, draft }: { pts: Pt[]; fmt: (mm: number) => string; draft?: boolean }): React.ReactElement {
  const poly: Poly = pts
  const a = pts.length >= 3 ? polyArea(poly) : 0
  const per = pts.length >= 3 ? perimeter(poly) : chainLength(pts)
  const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 })
  return (
    <g>
      <path
        d={path(poly, pts.length >= 3)}
        fill={draft ? 'rgba(160,122,56,0.16)' : 'rgba(44,92,97,0.16)'}
        stroke={draft ? 'var(--ochre)' : 'var(--accent)'}
        strokeWidth={44}
      />
      {pts.length >= 3 && (
        <text x={c.x} y={c.y} textAnchor="middle" fontSize={250} fill={draft ? 'var(--ochre)' : 'var(--accent)'} fontWeight={700}>
          <tspan style={{ paintOrder: 'stroke' }} stroke="var(--paper)" strokeWidth={120}>
            {formatArea(a)}
          </tspan>
          <tspan x={c.x} dy={300} fontSize={200} fontWeight={400}>
            perimeter {fmt(per)}
          </tspan>
        </text>
      )}
    </g>
  )
}
