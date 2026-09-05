/**
 * The home switcher: which building the app is showing, and the way in to
 * adding another.
 *
 * Switching reloads the page — deliberate, since the derived model, every 3D
 * scene and the material libraries are all built once at module init, and a
 * clean reload is more certain than tearing all of that down live.
 */

import React, { useState } from 'react'
import { HOMES, activeHomeId, setActiveHome } from '../homes/registry'

export function HomeSwitcher(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const active = HOMES.find((h) => h.meta.id === activeHomeId)

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="tiny"
        onClick={() => setOpen(!open)}
        title="Switch home, or add another"
        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
      >
        🏠 {active?.meta.name ?? activeHomeId}
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
            background: 'var(--paper, #faf8f4)', border: '1px solid #d5cdbb',
            borderRadius: 8, padding: 8, minWidth: 280,
            boxShadow: '0 4px 16px rgba(40,34,24,0.18)', fontSize: 13,
          }}
        >
          {HOMES.map((h) => (
            <button
              key={h.meta.id}
              onClick={() => { setOpen(false); setActiveHome(h.meta.id) }}
              aria-pressed={h.meta.id === activeHomeId}
              style={{ display: 'block', width: '100%', textAlign: 'left', margin: '2px 0' }}
            >
              <b>{h.meta.name}</b>
              <div className="tiny" style={{ opacity: 0.7 }}>
                {h.meta.subtitle} · {h.meta.origin === 'authored' ? 'authored in CAD' : 'imported'}
              </div>
            </button>
          ))}
          <div style={{ borderTop: '1px solid #e2dac8', marginTop: 6, paddingTop: 6 }}>
            <button
              style={{ width: '100%' }}
              onClick={() => { setOpen(false); window.dispatchEvent(new Event('om-add-home')) }}
            >
              + Add a home
            </button>
            <p className="tiny" style={{ color: '#6d6558', margin: '6px 0 0' }}>
              Each home keeps its own styling, materials, objects and saved
              renders. Nothing you do to one can reach another.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
