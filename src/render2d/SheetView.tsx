/**
 * The CAD sheet, verbatim.
 *
 * This is NOT a re-drawing: src/assets/plan-sheet.svg is copied byte-for-byte
 * from the CAD branch's drawings/07-round1-layout.svg by docs/design-export.py
 * — the same sheet the architect's DXF is built beside. What the family sees
 * here is exactly the current 2D plan; when the plan changes on the CAD
 * branch, re-running the exporter refreshes this file along with the model
 * data, and the app follows on the next deploy.
 *
 * Pan with the pointer, zoom with the wheel or the buttons.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import sheetSvg from '../assets/plan-sheet.svg?raw'

const MIN_Z = 0.25
const MAX_Z = 8

export function SheetView({ compact = false }: { compact?: boolean }): React.ReactElement {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, z: 0.35 })
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  // fit once on mount: the sheet is 4200 x 2675 svg units
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const z = Math.min(r.width / 4200, r.height / 2675) * 0.97
    setView({ x: (r.width - 4200 * z) / 2, y: (r.height - 2675 * z) / 2, z })
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0016)
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor))
      const rect = outerRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // keep the point under the cursor fixed
      const k = z / v.z
      return { x: mx - (mx - v.x) * k, y: my - (my - v.y) * k, z }
    })
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, x: 0, y: 0 }
    setView((v) => {
      drag.current = { px: e.clientX, py: e.clientY, x: v.x, y: v.y }
      return v
    })
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    setView((v) => ({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }))
  }, [])

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  const zoomBy = (f: number): void =>
    setView((v) => {
      const el = outerRef.current!
      const r = el.getBoundingClientRect()
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * f))
      const k = z / v.z
      const cx = r.width / 2
      const cy = r.height / 2
      return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }
    })

  const fit = (): void => {
    const el = outerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const z = Math.min(r.width / 4200, r.height / 2675) * 0.97
    setView({ x: (r.width - 4200 * z) / 2, y: (r.height - 2675 * z) / 2, z })
  }

  return (
    <div
      ref={outerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
               background: '#efece5', cursor: drag.current ? 'grabbing' : 'grab',
               touchAction: 'none' }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 4200, height: 2675,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          transformOrigin: '0 0',
          boxShadow: '0 2px 18px rgba(40,34,24,0.18)',
        }}
        dangerouslySetInnerHTML={{ __html: sheetSvg }}
      />
      {!compact && (
        <>
          <div className="no-print"
            style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
            <button onClick={() => zoomBy(1.3)} title="Zoom in">＋</button>
            <button onClick={() => zoomBy(1 / 1.3)} title="Zoom out">－</button>
            <button onClick={fit} title="Fit the sheet">Fit</button>
          </div>
          <div className="tiny"
            style={{ position: 'absolute', bottom: 10, left: 10, padding: '5px 10px',
                     background: 'rgba(250,248,244,0.92)', border: '1px solid #d5cdbb',
                     borderRadius: 5, color: '#6d6558' }}>
            The CAD sheet, verbatim — regenerated from design.py with the DXF. Drag to pan, wheel to zoom.
          </div>
        </>
      )}
    </div>
  )
}
