/**
 * The CAD sheet's own coordinate frame, read off the SVG root.
 *
 * Both sheet writers on the CAD branch stamp `data-frame="x0 y0 x1 y1"` (the
 * model-millimetre window the sheet draws) and `data-pad` (its pixel pad) on
 * the <svg>. From those, sheet pixels and model millimetres convert exactly,
 * for whichever home is active — the 2D tab's tools and the styled PDF both
 * read this rather than carrying a copy of the numbers.
 */

import type { Pt } from '../geometry/vec'

export interface SheetFrame {
  /** Sheet size in px. */
  w: number
  h: number
  /** Pixel pad round the drawn window. */
  pad: number
  /** Model window, mm. */
  x0: number
  y0: number
  x1: number
  y1: number
  /** Sheet px per model mm. */
  sc: number
  mmToSheet: (p: Pt) => Pt
  sheetToMm: (p: Pt) => Pt
}

/** Om Neeldhara's frame — what every sheet used before the root carried its own. */
const LEGACY = { w: 4200, h: 2675, pad: 90, x0: -3200, y0: -2400, x1: 26600, y1: 16100 }

const attr = (root: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(root)
  return m ? m[1] : null
}

export function parseSheetFrame(svg: string): SheetFrame {
  const open = /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
  const w = Number(attr(open, 'width')) || LEGACY.w
  const h = Number(attr(open, 'height')) || LEGACY.h
  const frame = (attr(open, 'data-frame') ?? '').trim().split(/\s+/).map(Number)
  const hasFrame = frame.length === 4 && frame.every((v) => Number.isFinite(v))
  const [x0, y0, x1, y1] = hasFrame ? frame : [LEGACY.x0, LEGACY.y0, LEGACY.x1, LEGACY.y1]
  const pad = Number(attr(open, 'data-pad')) || LEGACY.pad
  const sc = (w - 2 * pad) / (x1 - x0)
  return {
    w,
    h,
    pad,
    x0,
    y0,
    x1,
    y1,
    sc,
    mmToSheet: (p) => ({ x: pad + (p.x - x0) * sc, y: pad + (p.y - y0) * sc }),
    sheetToMm: (p) => ({ x: x0 + (p.x - pad) / sc, y: y0 + (p.y - pad) / sc }),
  }
}
