/**
 * Room-label placement.
 *
 * The Rev 4 sheet hand-placed and hand-rotated every label and still shipped with a
 * collision audit at the bottom of the script. Here the placement is computed instead:
 * each label is sized and rotated to fit the room it belongs to, and drops its
 * subtitles when there is no room for them. Move a wall and the labels re-fit.
 */

import type { Room } from '../geometry/model'
import { formatArea, formatFeetInches, type InchPrecision } from '../geometry/units'
import { pointInPolygon, type Poly, type Pt } from '../geometry/vec'

export interface PlacedLabel {
  at: Pt
  rotation: 0 | -90
  name: string[]
  lines: string[]
  size: number
}

/**
 * Average glyph advance as a fraction of the font size. Room names are set in bold
 * capitals, which run wider than the mixed-case subtitles, so they get their own figure.
 */
const ADVANCE_NAME = 0.64
const ADVANCE_SUB = 0.5
const LINE = 1.22

/**
 * Largest inscribed axis-aligned box around a point, found by expanding until a corner
 * leaves the polygon. Cheap, and good enough to keep text off the walls in L-shaped
 * rooms like Karan's pod hall where the centroid alone would mislead.
 */
function usableBox(poly: Poly, holes: Poly[], at: Pt): { w: number; h: number } {
  const inside = (p: Pt): boolean => pointInPolygon(p, poly) && !holes.some((hl) => pointInPolygon(p, hl))
  if (!inside(at)) return { w: 0, h: 0 }
  let w = 40
  let h = 40
  for (let i = 0; i < 60; i++) {
    const tryW = w * 1.12
    if (
      inside({ x: at.x - tryW / 2, y: at.y - h / 2 }) &&
      inside({ x: at.x + tryW / 2, y: at.y - h / 2 }) &&
      inside({ x: at.x - tryW / 2, y: at.y + h / 2 }) &&
      inside({ x: at.x + tryW / 2, y: at.y + h / 2 })
    ) {
      w = tryW
    }
    const tryH = h * 1.12
    if (
      inside({ x: at.x - w / 2, y: at.y - tryH / 2 }) &&
      inside({ x: at.x + w / 2, y: at.y - tryH / 2 }) &&
      inside({ x: at.x - w / 2, y: at.y + tryH / 2 }) &&
      inside({ x: at.x + w / 2, y: at.y + tryH / 2 })
    ) {
      h = tryH
    }
  }
  return { w, h }
}

/** Split a name across at most two lines at the space nearest the middle. */
function wrap(name: string, maxChars: number): string[] {
  if (name.length <= maxChars) return [name]
  const words = name.split(' ')
  if (words.length === 1) return [name]
  let best = 1
  let bestScore = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    const score = Math.abs(a - b) + Math.max(0, Math.max(a, b) - maxChars) * 3
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

export function placeLabel(room: Room, precision: InchPrecision): PlacedLabel | null {
  const at = room.def.labelAt ?? room.centroid
  const box = usableBox(room.polygon, room.holes, at)
  if (box.w < 300 && box.h < 300) return null

  // Rotate when the room is clearly taller than it is wide.
  const rotation: 0 | -90 = box.h > box.w * 1.45 ? -90 : 0
  const along = rotation === 0 ? box.w : box.h
  const across = rotation === 0 ? box.h : box.w

  const name = room.name.toUpperCase()
  const dims = `${Math.round(room.width)} × ${Math.round(room.depth)} mm · ${formatFeetInches(room.width, precision)} × ${formatFeetInches(room.depth, precision)}`
  const areaLine = formatArea(room.area)

  // In order of preference: name + both subtitles, name + area, name alone, then the
  // name wrapped over two lines. Take the first that fits at a comfortable size; if
  // none does, take whichever of them came out largest, down to a legibility floor.
  const attempts: Array<{ nameLines: string[]; lines: string[] }> = [
    { nameLines: [name], lines: [dims, areaLine] },
    { nameLines: [name], lines: [areaLine] },
    { nameLines: [name], lines: [] },
    { nameLines: wrap(name, Math.ceil(name.length / 2)), lines: [] },
  ]

  const sized = attempts.map((a) => {
    const longest = Math.max(...a.nameLines.map((l) => l.length))
    const subLongest = a.lines.length ? Math.max(...a.lines.map((l) => l.length)) : 0
    // Subtitles are set at 0.56 of the name size.
    const widthLimited = Math.min(
      (along * 0.94) / (longest * ADVANCE_NAME),
      subLongest ? (along * 0.94) / (subLongest * ADVANCE_SUB * 0.56) : Infinity,
    )
    const rows = a.nameLines.length + a.lines.length * 0.56
    const heightLimited = (across * 0.9) / (rows * LINE)
    return { ...a, size: Math.min(widthLimited, heightLimited, room.area > 3e7 ? 460 : 320) }
  })

  const comfortable = sized.find((a) => a.size >= 150)
  if (comfortable) {
    return { at, rotation, name: comfortable.nameLines, lines: comfortable.lines, size: comfortable.size }
  }
  const best = sized.reduce((a, b) => (b.size > a.size ? b : a))
  if (best.size < 70) return null
  return { at, rotation, name: best.nameLines, lines: best.lines, size: best.size }
}
