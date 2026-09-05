/**
 * What the app needs to know about a home, beyond its geometry.
 *
 * Everything downstream — the plan sheet, the 3D views, the styling and AI
 * layers, the schedules — runs off the three generated data files and needs
 * nothing from here. This is only for the things that are genuinely per
 * building: what it is called, where it came from, and which of the
 * home-specific integrity checks apply to it.
 */

import type { BuildingData, FixtureDef } from '../data/schema'
import type { Pt } from '../geometry/vec'
import type { FurnitureItem } from './om-neeldhara/furniture'

export interface HomeChecks {
  /** x of the mirror line, when the plan is two mirrored wings. */
  mirrorAbout?: number
  /** Run the hand-written envelope expectation (Home 1 only). */
  expectedEnvelope?: boolean
  /** Run the curved-screen span check. */
  curvedScreens?: boolean
  /** Apply the recorded 2D-clash register. */
  knownClashes?: boolean
  /** This home has a written brief page. */
  brief?: boolean
}

export interface HomeMeta {
  id: string
  name: string
  subtitle: string
  /** 'authored' = written as CAD Python; 'imported' = derived from a DXF. */
  origin: 'authored' | 'imported'
  checks: HomeChecks
  /** Which camera preset set to use, if any. */
  cameras?: string
}

/** Features not every home has: a mirror line, curved pod screens. */
export interface HomeConstants {
  MIRROR_X: number
  POD_PARENTS: { p0: Pt; p1: Pt; p2: Pt } | null
  POD_KARAN: { p0: Pt; p1: Pt; p2: Pt } | null
}

export interface Home {
  meta: HomeMeta
  building: BuildingData
  fixtures: FixtureDef[]
  furniture: FurnitureItem[]
  sheetSvg: string
  constants: HomeConstants
}
