import React, { useEffect, useState } from 'react'

/**
 * An on-device diagnostic strip for the walkthrough, for the cases that only
 * show up on a real phone or tablet and never under emulation: open the app
 * with `?debug` in the address and a small panel logs every tap on the canvas,
 * what it picked, every toggle applied, the frame rate, lost WebGL contexts
 * and any script error. Off the panel costs nothing - the log calls return at
 * once.
 */
const enabled = typeof location !== 'undefined' && /\bdebug\b/.test(location.search)
const MAX = 16
const lines: string[] = []
let frames = 0
let slowest = 0
let fps = 0
let worst = 0
let since = typeof performance !== 'undefined' ? performance.now() : 0
let installed = false

function stamp(): string {
  const d = new Date()
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export const diag = {
  on: enabled,
  log(msg: string): void {
    if (!enabled) return
    lines.push(`${stamp()} ${msg}`)
    if (lines.length > MAX) lines.shift()
  },
  /** one rendered frame took `dt` seconds */
  frame(dt: number): void {
    if (!enabled) return
    frames++
    if (dt > slowest) slowest = dt
    const now = performance.now()
    if (now - since >= 1000) {
      fps = Math.round((frames * 1000) / (now - since))
      worst = Math.round(slowest * 1000)
      frames = 0
      slowest = 0
      since = now
    }
  },
  install(): void {
    if (!enabled || installed) return
    installed = true
    window.addEventListener('error', (e) => diag.log(`ERROR ${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`))
    window.addEventListener('unhandledrejection', (e) => diag.log(`REJECTION ${String((e as PromiseRejectionEvent).reason).slice(0, 120)}`))
  },
}

export function DiagOverlay({ info }: { info: () => string }): React.ReactElement | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => tick((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [])
  if (!enabled) return null
  const ua = navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90)
  return (
    <pre
      style={{
        position: 'fixed', right: 8, top: 130, zIndex: 60, margin: 0, padding: '6px 8px',
        maxWidth: 'min(92vw, 520px)', maxHeight: '45vh', overflow: 'hidden',
        background: 'rgba(20,18,14,0.82)', color: '#e8e2d3', font: '10px/1.35 ui-monospace, Menlo, monospace',
        borderRadius: 6, pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}
    >
      {`${ua}\ntouch ${navigator.maxTouchPoints} · dpr ${window.devicePixelRatio} · ${info()} · ${fps} fps · worst ${worst} ms\n`}
      {lines.join('\n')}
    </pre>
  )
}
