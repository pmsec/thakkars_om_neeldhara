import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plan2D } from './render2d/Plan2D'
import { SheetView } from './render2d/SheetView'
import { Viewer3D } from './render3d/Viewer3D'
import { Realistic } from './render3d/Realistic'
import { IntegrityView } from './ui/IntegrityView'
import { Schedules } from './ui/Schedules'
import { BriefView } from './ui/BriefView'
import {
  ExportPanel,
  LayersPanel,
  MarkupPanel,
  RoomInspector,
  ToolsPanel,
  TotalsPanel,
  UnderlayPanel,
  View3DPanel,
} from './ui/panels'
import { initialState, StoreContext, type PortalState, type ViewId } from './ui/store'
import { runIntegrity } from './geometry/integrity'
import { building } from './data/building'

const TABS: Array<[ViewId, string]> = [
  ['plan', '2D plan'],
  ['model', '3D model'],
  ['real', 'Walkthrough'],
  ['split', 'Split'],
  ['schedules', 'Schedules'],
  ['integrity', 'Model integrity'],
  ['brief', 'Brief & constraints'],
]

export function App(): React.ReactElement {
  const [state, setState] = useState<PortalState>(initialState)
  const set = useCallback((patch: Partial<PortalState>) => setState((s) => ({ ...s, ...patch })), [])
  const update = useCallback((fn: (s: PortalState) => PortalState) => setState(fn), [])
  const store = useMemo(() => ({ state, set, update }), [state, set, update])

  const integrity = useMemo(() => runIntegrity(), [])
  const showsPlan = state.view === 'plan' || state.view === 'split'
  const shows3d = state.view === 'model' || state.view === 'split'
  const hasPanels = showsPlan || shows3d

  const togglePanel = useCallback(
    (side: 'left' | 'right') =>
      setState((s) => ({ ...s, panels: { ...s.panels, [side]: !s.panels[side] } })),
    [],
  )

  // [ and ] collapse the sidebars, which is the fastest way to hand the drawing the whole
  // window. Ignored while typing, so the markup author field still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === '[') togglePanel('left')
      if (e.key === ']') togglePanel('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePanel])

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <b>{building.meta.project}</b>
            <span>
              DWG {building.meta.drawing} · {building.meta.revision} · {building.meta.date}
            </span>
          </div>

          <div
            className="tiny"
            style={{
              padding: '4px 9px',
              borderRadius: 5,
              background: integrity.failed ? 'var(--red-soft)' : '#e6f0e5',
              color: integrity.failed ? 'var(--red)' : 'var(--green)',
              border: `1px solid ${integrity.failed ? 'var(--red)' : 'var(--green)'}`,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => set({ view: 'integrity' })}
            role="button"
          >
            {integrity.failed
              ? `${integrity.failed} integrity failure${integrity.failed === 1 ? '' : 's'}`
              : `Model reconciles · ${integrity.passed}/${integrity.checks.length} checks`}
          </div>

          {showsPlan && (
            <div className="unitgroup" role="group" aria-label="2D plan source">
              <button
                aria-pressed={state.planMode === 'sheet'}
                onClick={() => set({ planMode: 'sheet' })}
                title="The CAD sheet, verbatim — exactly the current 2D plan"
              >
                CAD sheet
              </button>
              <button
                aria-pressed={state.planMode === 'model'}
                onClick={() => set({ planMode: 'model' })}
                title="The app's interactive derived model — measure, layers, exports"
              >
                Interactive
              </button>
            </div>
          )}
          {hasPanels && (
            <div className="unitgroup" role="group" aria-label="Sidebars">
              <button
                aria-pressed={state.panels.left}
                onClick={() => togglePanel('left')}
                title="Show or hide the tools and cutaway sidebar  [  "
              >
                ◧ Tools
              </button>
              <button
                aria-pressed={state.panels.right}
                onClick={() => togglePanel('right')}
                title="Show or hide the room inspector sidebar  ]  "
              >
                Inspector ◨
              </button>
            </div>
          )}

          <div className="unitgroup">
            {(
              [
                ['mm', 'mm'],
                ['ftin', "ft-in"],
                ['m', 'm'],
              ] as const
            ).map(([u, label]) => (
              <button key={u} aria-pressed={state.units === u} onClick={() => set({ units: u })}>
                {label}
              </button>
            ))}
          </div>

          <nav className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} aria-current={state.view === id} onClick={() => set({ view: id })}>
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="body">
          {hasPanels && state.panels.left && (
            <aside className="side no-print">
              {showsPlan && state.planMode === 'model' && (
                <>
                  <ToolsPanel />
                  <LayersPanel />
                  <UnderlayPanel />
                </>
              )}
              {shows3d && <View3DPanel />}
              <TotalsPanel />
            </aside>
          )}

          <main className="main">
            {hasPanels && !state.panels.left && (
              <button
                className="edge-tab left no-print"
                onClick={() => togglePanel('left')}
                title="Show the tools and cutaway sidebar  [  "
                aria-label="Show the tools sidebar"
              >
                ›
              </button>
            )}
            {hasPanels && !state.panels.right && (
              <button
                className="edge-tab right no-print"
                onClick={() => togglePanel('right')}
                title="Show the room inspector sidebar  ]  "
                aria-label="Show the room inspector sidebar"
              >
                ‹
              </button>
            )}
            {state.view === 'plan' && (state.planMode === 'sheet' ? <SheetView /> : <Plan2D />)}
            {state.view === 'model' && <Viewer3D />}
            {state.view === 'real' && <Realistic />}
            {state.view === 'split' && (
              <div className="split">
                {state.planMode === 'sheet' ? <SheetView compact /> : <Plan2D compact />}
                <Viewer3D compact />
              </div>
            )}
            {state.view === 'schedules' && <Schedules />}
            {state.view === 'integrity' && <IntegrityView />}
            {state.view === 'brief' && <BriefView />}
          </main>

          {hasPanels && state.panels.right && (
            <aside className="side right no-print">
              <RoomInspector />
              <MarkupPanel />
              <ExportPanel />
            </aside>
          )}
        </div>
      </div>
    </StoreContext.Provider>
  )
}
