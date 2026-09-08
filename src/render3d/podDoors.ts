/**
 * The sliding doors between each pod and its suite.
 *
 * Each pod-to-suite line carries a pair of wooden leaves on two parallel tracks.
 * Shut, they meet in the opening with a small overlap. Open, both slide north
 * along the wall, out past the deck glazing line, and stack on the deck against
 * the wall face - behind the strength trainer on the parents' side, behind the
 * spa on Karan's - so the opening between pod and suite is completely clear.
 *
 * Derived from the building: any wall with a slider opening whose label names a
 * pod-to-suite partition. Positions are plan rectangles in mm so the technical 3D
 * tab and the walkthrough draw exactly the same leaves in their own materials.
 */

import type { BuildingData } from '../data/schema'

export interface DoorLeaf {
  wallId: string
  /** Plan rectangle, mm. */
  x0: number
  y0: number
  x1: number
  y1: number
  base: number
  top: number
  /** Which side of the leaf the pull handle is on, as a y direction (+1 = south). */
  handleAt: number
}

export type PodDoorMode = 'open' | 'shut'

const LEAF_T = 40
const TRACK_GAP = 30
const OVERLAP = 60

export function podDoorLeaves(building: BuildingData, mode: PodDoorMode): DoorLeaf[] {
  const out: DoorLeaf[] = []
  const xs = building.envelope.map((p) => p.x)
  const centreX = (Math.min(...xs) + Math.max(...xs)) / 2
  // the deck glazing line: the northernmost glazing wall that runs east-west
  const deckLine = Math.min(
    ...building.walls
      .filter((w) => w.kind === 'glazing' && w.points && Math.abs(w.points[0].y - w.points[1].y) < 1)
      .map((w) => w.points![0].y),
  )

  for (const w of building.walls) {
    if (!w.points || w.points.length !== 2) continue
    const op = w.openings?.find((o) => o.type === 'slider' && !!o.at && /suite to (family|den)|pod/i.test(o.label ?? ''))
    if (!op) continue
    const [p, q] = w.points
    if (Math.abs(p.x - q.x) > 1) continue // only the north-south lines
    const wx = p.x
    const y0 = Math.min(p.y, q.y)
    const [a0, a1] = op.at!
    const from = y0 + a0
    const to = y0 + a1
    const span = to - from
    const L = span / 2 + OVERLAP
    const top = (op.head ?? 2100) - 20
    // the deck side of the wall is toward the home's centre
    const deckSide = wx < centreX ? 1 : -1

    if (mode === 'shut') {
      const xa = wx - TRACK_GAP
      const xb = wx + TRACK_GAP
      out.push({ wallId: w.id, x0: xa - LEAF_T / 2, x1: xa + LEAF_T / 2, y0: from, y1: from + L, base: 0, top, handleAt: 1 })
      out.push({ wallId: w.id, x0: xb - LEAF_T / 2, x1: xb + LEAF_T / 2, y0: to - L, y1: to, base: 0, top, handleAt: -1 })
    } else {
      // stacked on the deck, against the wall face, both leaves north of the glazing line
      const face = wx + deckSide * ((w.thickness || 125) / 2)
      const yEnd = Number.isFinite(deckLine) ? Math.min(deckLine, from) : from
      for (let i = 0; i < 2; i++) {
        const xc = face + deckSide * (LEAF_T / 2 + 10 + i * (LEAF_T + 15))
        out.push({
          wallId: w.id,
          x0: xc - LEAF_T / 2, x1: xc + LEAF_T / 2,
          y0: yEnd - L, y1: yEnd,
          base: 0, top, handleAt: 1,
        })
      }
    }
  }
  return out
}
