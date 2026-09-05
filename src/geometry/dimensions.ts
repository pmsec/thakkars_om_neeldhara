/**
 * Dimension chains for the 2D sheet.
 *
 * Every station is looked up from a wall id, a curve control point or the envelope —
 * never written as a coordinate. That is what keeps brief §2.1 honest: move a wall in
 * `building.ts` and the dimension chain moves with it instead of silently lying.
 */

import { building, POD_KARAN, POD_PARENTS } from '../data/building'
import type { BuiltModel } from './model'
import type { Pt } from './vec'

export interface DimSegment {
  from: Pt
  to: Pt
  value: number
  label?: string
}

export interface DimChain {
  id: string
  side: 'north' | 'south' | 'east' | 'west'
  /** Perpendicular offset from the envelope edge, mm. */
  offset: number
  axis: 'x' | 'y'
  segments: DimSegment[]
  emphasis?: boolean
}

/** x of a straight wall's centreline, by id. Throws rather than guessing. */
function wallX(model: BuiltModel, id: string): number {
  const w = model.walls.find((r) => r.def.id === id)
  if (!w) throw new Error(`dimensions: no wall ${id}`)
  return w.points[0].x
}

function wallY(model: BuiltModel, id: string): number {
  const w = model.walls.find((r) => r.def.id === id)
  if (!w) throw new Error(`dimensions: no wall ${id}`)
  return w.points[0].y
}

/**
 * Offsets are measured along the left normal of the run direction, which is (-dy, dx).
 * For the vertical (axis 'y') chains that normal points toward -x, so a WEST chain needs
 * a positive offset to sit outside the building and an EAST chain a negative one.
 */
function chain(
  id: string,
  side: DimChain['side'],
  axis: 'x' | 'y',
  offset: number,
  stations: Array<{ at: number; label?: string }>,
  fixed: number,
  emphasis = false,
): DimChain {
  const segments: DimSegment[] = []
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i].at
    const b = stations[i + 1].at
    segments.push({
      from: axis === 'x' ? { x: a, y: fixed } : { x: fixed, y: a },
      to: axis === 'x' ? { x: b, y: fixed } : { x: fixed, y: b },
      value: Math.abs(b - a),
      label: stations[i + 1].label,
    })
  }
  return { id, side, offset, axis, segments, emphasis }
}

export function buildDimensions(model: BuiltModel): DimChain[] {
  const bb = model.envelopeBBox
  // Deck band / main body / east bay divisions, read off the fabric.
  const deckLine = wallY(model, 'G-GREAT-DECK') // y = 2545, the deck glass line
  const bodyLine = wallY(model, 'W-HELP-N') // y = 8462.5, the body's south line

  const out: DimChain[] = []

  // North: the terrace / shaft / continuous deck breakdown.
  out.push(
    chain(
      'north-zones',
      'north',
      'x',
      -900,
      [
        { at: bb.minX },
        { at: wallX(model, 'W-SHAFT-W-W') },
        { at: wallX(model, 'W-SHAFT-W-E'), label: 'SEALED SHAFT' },
        { at: wallX(model, 'W-SHAFT-E-W'), label: 'CONTINUOUS DECK' },
        { at: wallX(model, 'W-SHAFT-E-E'), label: 'SEALED SHAFT' },
        { at: bb.maxX },
      ],
      bb.minY,
    ),
  )
  out.push(
    chain('north-overall', 'north', 'x', -1620, [{ at: bb.minX }, { at: bb.maxX, label: 'OVERALL' }], bb.minY, true),
  )

  // South: the two wings either side of the great room, measured at the deck
  // edge. Only a home built as two wings about a pair of curved screens has
  // this chain; one without pods simply omits it.
  if (POD_PARENTS && POD_KARAN) {
    out.push(
      chain(
        'south-wings',
        'south',
        'x',
        900,
        [
          { at: bb.minX, label: '' },
          { at: POD_PARENTS.p0.x, label: "PARENTS' WING" },
          { at: POD_KARAN.p0.x, label: 'GREAT ROOM AT DECK' },
          { at: bb.maxX, label: "KARAN'S WING" },
        ],
        bb.maxY,
      ),
    )
  }
  out.push(
    chain('south-overall', 'south', 'x', 1620, [{ at: bb.minX }, { at: bb.maxX, label: 'OVERALL' }], bb.maxY, true),
  )

  // West: deck band and main body depth.
  out.push(
    chain(
      'west-bands',
      'west',
      'y',
      950,
      [{ at: bb.minY }, { at: deckLine, label: 'DECK' }, { at: bodyLine, label: 'MAIN BODY' }],
      bb.minX,
    ),
  )
  out.push(
    chain('west-overall', 'west', 'y', 1700, [{ at: bb.minY }, { at: bb.maxY, label: 'OVERALL' }], bb.minX, true),
  )

  // East: the east bay only, since the envelope steps there.
  out.push(
    chain('east-bay', 'east', 'y', -1120, [{ at: bodyLine }, { at: bb.maxY, label: 'EAST BAY' }], bb.maxX),
  )

  return out
}

/** The great room's variable width, which is the point of the curved walls.
 * Null for a home that has no pod screens. */
export function greatRoomWidths(): { atDeck: number; atBack: number } | null {
  if (!POD_PARENTS || !POD_KARAN) return null
  return {
    atDeck: POD_KARAN.p0.x - POD_PARENTS.p0.x,
    atBack: POD_KARAN.p2.x - POD_PARENTS.p2.x,
  }
}

export const projectMeta = building.meta
