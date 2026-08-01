import React, { useCallback, useMemo, useState } from 'react'
import { Plan2D } from './render2d/Plan2D'
import { Viewer3D } from './render3d/Viewer3D'
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
          {(showsPlan || shows3d) && (
            <aside className="side no-print">
              {showsPlan && (
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
            {state.view === 'plan' && <Plan2D />}
            {state.view === 'model' && <Viewer3D />}
            {state.view === 'split' && (
              <div className="split">
                <Plan2D compact />
                <Viewer3D compact />
              </div>
            )}
            {state.view === 'schedules' && <Schedules />}
            {state.view === 'integrity' && <IntegrityView />}
            {state.view === 'brief' && <BriefView />}
          </main>

          {(showsPlan || shows3d) && (
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
