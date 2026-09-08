/**
 * The sliding doors between each pod and its suite.
 *
 * Each pod-to-suite line carries a pair of wooden leaves on two parallel tracks.
 * Shut, they meet in the opening with a small overlap. Open, both slide north
 * along the wall on their own tracks, past the deck glazing line, into the
 * pocket the wall makes for them - inside the wall's own line, behind the
 * strength trainer on the parents' side and the spa on Karan's - so the opening
 * between pod and suite is completely clear.
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

const LEAF_T = 32
const TRACK_GAP = 38
const OVERLAP = 50

export function podDoorLeaves(building: BuildingData, mode: PodDoorMode): DoorLeaf[] {
  const out: DoorLeaf[] = []

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
    const top = (op.head ?? 2100) - 20
    // The pocket is the wall's own run north of the opening. Split the span into
    // as few leaves as will park inside it, each on its own track - 3555 into a
    // 1345 pocket takes three leaves of 1235, on tracks 38 apart within the wall.
    const pocket = from - y0
    let n = 1
    while (n < 4 && span / n + OVERLAP > pocket) n++
    const L = span / n + OVERLAP
    const tracks = n === 1 ? [wx] : n === 2 ? [wx - TRACK_GAP / 2, wx + TRACK_GAP / 2] : [wx - TRACK_GAP, wx, wx + TRACK_GAP]
    for (let i = 0; i < n; i++) {
      const xc = tracks[i]
      if (mode === 'shut') {
        // spread along the opening, each leaf overlapping the next
        const y0l = from + (i * (span - L)) / Math.max(1, n - 1)
        out.push({ wallId: w.id, x0: xc - LEAF_T / 2, x1: xc + LEAF_T / 2, y0: y0l, y1: y0l + L, base: 0, top, handleAt: i === 0 ? 1 : -1 })
      } else {
        // all parked in the pocket, inside the wall's own line
        out.push({ wallId: w.id, x0: xc - LEAF_T / 2, x1: xc + LEAF_T / 2, y0: from - L, y1: from, base: 0, top, handleAt: 1 })
      }
    }
  }
  return out
}
