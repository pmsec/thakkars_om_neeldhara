/**
 * Shared portal state. Small enough not to need a state library, and deliberately
 * framework-local — nothing in `src/geometry` imports any of this.
 */

import { createContext, useContext } from 'react'
import type { UnitSystem } from '../geometry/units'
import type { Pt } from '../geometry/vec'

export type LayerId =
  | 'walls'
  | 'openings'
  | 'glazing'
  | 'curvedGlass'
  | 'fixtures'
  | 'furniture'
  | 'dimensions'
  | 'labels'
  | 'serviceTint'
  | 'glassRoof'
  | 'shafts'
  | 'grid'
  | 'underlay'

export const LAYER_LABELS: Array<[LayerId, string]> = [
  ['walls', 'Walls'],
  ['openings', 'Openings & door swings'],
  ['glazing', 'Glazing'],
  ['curvedGlass', 'Curved glass'],
  ['fixtures', 'Sanitaryware & fitted'],
  ['furniture', 'Furniture'],
  ['dimensions', 'Dimension chains'],
  ['labels', 'Room labels'],
  ['serviceTint', 'Service-zone tint'],
  ['glassRoof', 'Glass-roof overlay'],
  ['shafts', 'Shafts & cores'],
  ['grid', 'Grid'],
  ['underlay', "Builder's original plan"],
]

export type Tool = 'select' | 'measure' | 'area' | 'markup' | 'calibrate'

export type ViewId = 'plan' | 'top' | 'model' | 'real' | 'split' | 'schedules' | 'integrity' | 'brief'


export interface MeasureChain {
  id: string
  points: Pt[]
  /** Persisted ad-hoc dimensions survive tool changes; live ones do not. */
  committed: boolean
}

export interface AreaPoly {
  id: string
  points: Pt[]
  committed: boolean
}

export interface Markup {
  id: string
  at: Pt
  text: string
  author: string
  date: string
}

/** Two-point georeference of the builder's original plan (brief §5.9). */
export interface UnderlayTransform {
  /** Scale, rotation (radians) and translation derived from two matched points. */
  scale: number
  rotation: number
  tx: number
  ty: number
}

export interface CalibrationState {
  /** Points picked on the underlay image, in image pixel space. */
  imagePoints: Pt[]
  /** Corresponding points picked on the model, in mm. */
  modelPoints: Pt[]
}

export interface Sun {
  /** Day of the year, 1–365. */
  day: number
  /** Hour of the day, local Mumbai time (UTC+5:30). */
  hour: number
  mode: 'day' | 'dusk'
  shadows: boolean
}

export interface PortalState {
  view: ViewId
  units: UnitSystem
  /** Round feet-inches to the nearest whole inch, as the Rev 4 sheet does. */
  roundToInch: boolean
  layers: Record<LayerId, boolean>
  tool: Tool
  sheetLayers: Record<string, boolean>
  selectedRoom: string | null
  hoveredRoom: string | null
  measures: MeasureChain[]
  areas: AreaPoly[]
  markups: Markup[]
  underlay: { opacity: number; transform: UnderlayTransform | null }
  calibration: CalibrationState
  snap: boolean
  /** The walkthrough's bars - the app header and the walk toolbar - shown. Hidden by default while walking; a small arrow at the top reveals them. */
  walkBars: boolean
  cutaway: number
  section: { axis: 'x' | 'y' | 'z' | null; at: number }
  show3d: {
    glassRoofs: boolean
    cages: boolean
    furniture: boolean
    podParents: boolean
    podKaran: boolean
    /** Every door drawn shut (true) or open: hinged leaves swung, the pod sliders stacked on the deck, the entry pair slid apart. */
    doorsShut: boolean
    /** The wall bed folded down over its sofa. */
    wallBedDown: boolean
    /** The walkthrough's plaster ceilings, with their downlights and cornices. Off for a top-down look. */
    ceiling: boolean
    /** The telescoping glass roof slid open: each half stacked at its own end. */
    roofOpen: boolean
    /** The walkthrough's time of day: sun, sky and how much the lamps carry. */
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  }
  sun: Sun
  /**
   * Compass bearing, in degrees, of the model's +x axis. The Rev 4 sheet's north arrow
   * points along +x (so 0), but the Python source's header says north is -y (so 90).
   * They disagree and the brief does not settle it, so it is exposed rather than fixed.
   */
  northAzimuth: number
  /** Sidebar visibility. Both start open; hiding them gives the drawing the full width. */
  panels: { left: boolean; right: boolean }
  /** Set when a view asks the other to fly to a room. */
  flyTo: { room: string; nonce: number } | null
  author: string
}

export const initialState: PortalState = {
  view: 'plan',
  units: 'mm',
  roundToInch: false,
  layers: {
    walls: true,
    openings: true,
    glazing: true,
    curvedGlass: true,
    fixtures: true,
    furniture: true,
    dimensions: true,
    labels: true,
    serviceTint: true,
    glassRoof: true,
    shafts: true,
    grid: false,
    underlay: false,
  },
  tool: 'select',
  sheetLayers: { floor: true, furniture: true, labels: true, dims: true, keepclear: true, ref: true, title: true },
  selectedRoom: null,
  hoveredRoom: null,
  measures: [],
  areas: [],
  markups: [],
  underlay: { opacity: 0.45, transform: null },
  calibration: { imagePoints: [], modelPoints: [] },
  snap: true,
  walkBars: false,
  cutaway: 3505,
  section: { axis: null, at: 12240 },
  show3d: { glassRoofs: true, cages: true, furniture: true, podParents: true, podKaran: true, doorsShut: false, wallBedDown: false, ceiling: true, roofOpen: false, timeOfDay: 'afternoon' },
  sun: { day: 80, hour: 11, mode: 'day', shadows: true },
  northAzimuth: 0,
  panels: { left: true, right: true },
  flyTo: null,
  author: 'Architect',
}

export interface Store {
  state: PortalState
  set: (patch: Partial<PortalState>) => void
  update: (fn: (s: PortalState) => PortalState) => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside provider')
  return s
}
