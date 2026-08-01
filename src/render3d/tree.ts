/**
 * Trees in the edge cages, described as massing rather than drawn.
 *
 * The shape matters dimensionally for once: these stand in a 1500 mm cage with curved
 * glass coming down on its outer face, so a crown that spreads wider than its authored
 * footprint grows straight through the canopy. Returning the masses as plain numbers lets
 * `canopy.test.ts` measure the envelope and check both the spread and the headroom.
 *
 * Everything is relative to the centre of the footprint at floor level.
 */

export interface TreeMass {
  kind: 'trunk' | 'crown'
  /** Radius, mm. */
  r: number
  /** Trunk only: height. */
  h?: number
  dx: number
  /** Height of the centre above the floor (trunk: of its mid-point). */
  dy: number
  dz: number
}

/**
 * `height` is the top of the crown — the figure the clearance check works from. Crown
 * radii and offsets are driven by the footprint, never by the height, so a taller tree
 * grows upward rather than outward into the glass.
 */
export function treeMasses(w: number, d: number, height: number): TreeMass[] {
  const trunkH = height * 0.34
  const r = Math.min(w, d) / 2
  return [
    { kind: 'trunk', r: Math.min(w, d) * 0.045, h: trunkH, dx: 0, dy: trunkH / 2, dz: 0 },
    { kind: 'crown', r, dx: 0, dy: height - r, dz: 0 },
    { kind: 'crown', r: r * 0.6, dx: w * 0.15, dy: height - r * 1.9, dz: -d * 0.12 },
    { kind: 'crown', r: r * 0.5, dx: -w * 0.18, dy: height - r * 2.3, dz: d * 0.16 },
  ]
}

/** Bounding box of the massing, in mm relative to the footprint centre at floor level. */
export function treeEnvelope(
  w: number,
  d: number,
  height: number,
): { dx: number; dz: number; top: number } {
  let dx = 0
  let dz = 0
  let top = 0
  for (const m of treeMasses(w, d, height)) {
    const half = m.kind === 'trunk' ? m.r : m.r
    dx = Math.max(dx, Math.abs(m.dx) + half)
    dz = Math.max(dz, Math.abs(m.dz) + half)
    top = Math.max(top, m.kind === 'trunk' ? (m.h ?? 0) : m.dy + m.r)
  }
  return { dx, dz, top }
}
