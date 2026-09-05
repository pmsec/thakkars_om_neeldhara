/**
 * Types for the authored building data. Deliberately dumb: no behaviour, no imports
 * from any renderer. `src/geometry/model.ts` is the only thing that interprets these.
 */

import type { Pt } from '../geometry/vec'
import type { QuadBezier } from '../geometry/bezier'

export type OpeningType = 'door' | 'slider' | 'cased' | 'arch' | 'window' | 'threshold'

export interface OpeningDef {
  id: string
  type: OpeningType
  /** Distance along the parent run, from its first point. Use this OR `abs`. */
  at?: [number, number]
  /** Absolute endpoints on the OUTER face of the envelope; projected onto the centreline. */
  abs?: [Pt, Pt]
  /** Which end the door is hinged at: 0 = start of the opening, 1 = end. Matches Rev 4. */
  hinge?: 0 | 1
  /** Swing side: +1 toward the run's left normal. Matches Rev 4. */
  side?: 1 | -1
  /** Head height above finished floor. Doors 2100, windows 2300. */
  head?: number
  /** Sill height. Windows 900; doors and cased openings 0. */
  sill?: number
  /** The one controlled door between the service zone and the house (brief §1). */
  sealed?: boolean
  /** Does not connect rooms for circulation purposes (all windows, plus the glazed screens). */
  nonCirculating?: boolean
  label?: string
  notes?: string
}

export type WallKind =
  | 'exterior'
  | 'interior'
  | 'partition'
  | 'curved-glass'
  | 'glazing'
  | 'threshold'
  | 'void-edge'

export interface WallDef {
  id: string
  /** Centreline. Straight runs give two points; curved runs are flattened from `curve`. */
  points?: Pt[]
  curve?: QuadBezier
  thickness: number
  kind: WallKind
  openings?: OpeningDef[]
  /** Zero-thickness glazing only: false suppresses the 3D pane. */
  renderPane?: boolean
  label?: string
  notes?: string
}

export type RoomCategory =
  | 'habitable'
  | 'wet'
  | 'service'
  | 'circulation'
  | 'storage'
  | 'outdoor'
  | 'void'

export type Zone = 'parents' | 'karan' | 'shared' | 'service' | 'outdoor' | 'core' | 'flat'

export interface RoomDef {
  id: string
  name: string
  /** A point known to be inside the face. Identity is authored; GEOMETRY IS DERIVED. */
  anchor: Pt
  category: RoomCategory
  zone: Zone
  /** Counts toward carpet area. Decks, terraces, shafts and cores do not. */
  carpet: boolean
  ceiling?: number
  finish?: string
  /** Where the room's label sits on the 2D sheet, if not the polygon centroid. */
  labelAt?: Pt
  publishedSqFt?: number
  notes?: string
}

export interface StackDef {
  id: string
  name: string
  /** Authored riser position. See `provenance` — these are Rev 4 derived, not surveyed. */
  at: Pt
  room: string
  capped?: boolean
  provenance: string
}

export type FixtureKind =
  | 'wc'
  | 'basin'
  | 'shower'
  | 'tub'
  | 'sink'
  | 'washer'
  | 'dryer'
  | 'hob'
  | 'fridge'
  | 'counter'

export interface FixtureDef {
  id: string
  kind: FixtureKind
  at: Pt
  /** Plan footprint, mm. */
  size: [number, number]
  rotation?: number
  room: string
  /** Set for plumbed fixtures; drives the wet-stack integrity check. */
  stack?: string
  label?: string
  /** The drawn 2D outline when it is not the plain rect — the 3D extrudes THIS. */
  poly?: Pt[]
  /** Drawn basin bowl (vanities): centre and radius, straight off the sheet. */
  bowl?: { x: number; y: number; r: number }
}

/** A stretch of the external wall replaced by structural glazing, floor to canopy. */
export interface EnvelopeGlazingDef {
  id: string
  /** Endpoints on the OUTER envelope polygon. The glass sits on that line. */
  p1: Pt
  p2: Pt
  label: string
  /**
   * Draw a vertical pane in 3D. False where a curved canopy already springs from this
   * line and IS the enclosure — a separate upright pane there is just doubled glass.
   */
  pane?: boolean
  notes?: string
}

/**
 * A metal growing cage projecting beyond the slab edge, holding soil for trees. It is
 * also where the canopy glass comes down: the glass foot and the cage's outer face are
 * the same plane, so the trees stand between the floor edge and the glass.
 */
export interface CageDef {
  id: string
  name: string
  /** Along the building. */
  from: number
  to: number
  /** The building line it projects from, and how far out (toward -y). */
  at: number
  projection: number
  /** Height of the cage above floor level. It doubles as the edge protection. */
  height: number
  notes?: string
}

export interface CoreDef {
  id: string
  name: string
  /** Open polyline: the three sides that are not shared with another boundary. */
  points: Pt[]
  notes?: string
}

export interface GlassRoofDef {
  id: string
  name: string
  kind: 'barrel' | 'flat'
  /** Plan extent [x0, y0, x1, y1]. */
  extent: [number, number, number, number]
  /** Barrel only: section curve in (model y, height). Absolute, so it may oversail. */
  section?: QuadBezier
  /**
   * Barrel only: which ends of the extrusion are closed with a glazed gable cut to the
   * section profile. 'x0' is the low-x end, 'x1' the high-x end. An end left out is open —
   * on the deck both ends face open building shafts, so neither is closed.
   */
  gableEnds?: Array<'x0' | 'x1'>
  height?: number
  retractable?: boolean
  glazing: string
  notes?: string
}

export interface ArchedPortalDef {
  id: string
  wall: string
  /** Bézier parameter range of the gap in the curved wall. */
  t: [number, number]
  /** Springing height of the arch, and its rise above that. */
  springing: number
  rise: number
  label: string
}

export interface ScreenDef {
  id: string
  name: string
  curve: QuadBezier
  height: number
  notes: string
}

export interface BuildingData {
  meta: {
    project: string
    drawing: string
    revision: string
    date: string
    scaleNote: string
  }
  /** OUTER face of the external wall. The centreline is derived from it. */
  envelope: Pt[]
  thickness: { exterior: number; interior: number; partition: number }
  levels: { ceiling: number; doorHead: number; windowSill: number; windowHead: number }
  exteriorOpenings: OpeningDef[]
  /** Where the external wall is omitted and glazed instead. */
  envelopeGlazing?: EnvelopeGlazingDef[]
  walls: WallDef[]
  cores: CoreDef[]
  /** Tree cages projecting beyond the slab edge, where the canopy glass lands. */
  cages: CageDef[]
  rooms: RoomDef[]
  stacks: StackDef[]
  glassRoofs: GlassRoofDef[]
  portals: ArchedPortalDef[]
  screens: ScreenDef[]
}
