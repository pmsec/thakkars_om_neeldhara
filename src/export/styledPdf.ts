/**
 * The CAD sheet — the drawing the 2D tab shows, colours, hatches, furniture
 * and all — as a vector PDF at a true scale.
 *
 * The plain "Vector PDF" is rebuilt from the geometry model with the portal's
 * own conventions; this one prints the sheet itself, so the paper looks like
 * the screen. The sheet is machine-written by the CAD branch from a small,
 * fixed vocabulary (line, polygon, polyline, rect, circle, M/L paths, text,
 * groups with translate/rotate), so a purpose-built converter covers it
 * exactly and the bundle carries no SVG library.
 *
 * Scale: the sheet root carries its model frame (see sheetFrame.ts), which
 * gives millimetres per sheet pixel; paper mm = model mm / scale. The sheet
 * is centred on the paper and clipped to it if it does not fit, and a small
 * stamp in the corner records the scale and paper it was laid out for.
 */

import { PAPER, PdfDoc, PT_PER_MM, type PaperName } from './pdf'
import { parseSheetFrame } from './sheetFrame'
import { sheetSvg } from '../data/sheet'
import { building } from '../data/building'

/** Paper kept clear round the sheet, mm. The sheet has its own pad inside this. */
const EDGE_MM = 5

export interface StyledPdfOptions {
  paper: PaperName
  scale: number
  /** Sheet layer visibility by id (the `L-<id>` groups); missing ids are shown. */
  layers?: Record<string, boolean>
  /** The sheet to print; defaults to the active home's bundled sheet. */
  svg?: string
}

/** Paper needed for the whole sheet at a scale, and whether the chosen paper takes it. */
export function styledFit(
  paper: PaperName,
  scale: number,
  scales: readonly number[] = [50, 75, 100, 150, 200],
  svg: string = sheetSvg,
): { needW: number; needH: number; fits: boolean; best: number | null } {
  const f = parseSheetFrame(svg)
  const mmPerPx = 1 / f.sc
  const need = (sc: number): [number, number] => [(f.w * mmPerPx) / sc, (f.h * mmPerPx) / sc]
  const ok = (sc: number): boolean => {
    const [w, h] = need(sc)
    return w <= PAPER[paper].w - EDGE_MM * 2 && h <= PAPER[paper].h - EDGE_MM * 2
  }
  const [needW, needH] = need(scale)
  return { needW, needH, fits: ok(scale), best: scales.find(ok) ?? null }
}

// ------------------------------------------------------------------ SVG subset

type Mat = [number, number, number, number, number, number]
const IDENT: Mat = [1, 0, 0, 1, 0, 0]
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

function parseTransform(t: string | undefined): Mat {
  let m: Mat = IDENT
  if (!t) return m
  const re = /(translate|rotate|scale|matrix)\s*\(([^)]*)\)/g
  let hit: RegExpExecArray | null
  while ((hit = re.exec(t))) {
    const a = hit[2].split(/[\s,]+/).filter(Boolean).map(Number)
    if (hit[1] === 'translate') m = mul(m, [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0])
    else if (hit[1] === 'scale') m = mul(m, [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0])
    else if (hit[1] === 'rotate') {
      const r = ((a[0] ?? 0) * Math.PI) / 180
      const c = Math.cos(r)
      const s = Math.sin(r)
      const cx = a[1] ?? 0
      const cy = a[2] ?? 0
      m = mul(m, [1, 0, 0, 1, cx, cy])
      m = mul(m, [c, s, -s, c, 0, 0])
      m = mul(m, [1, 0, 0, 1, -cx, -cy])
    } else if (hit[1] === 'matrix' && a.length === 6) m = mul(m, a as Mat)
  }
  return m
}

interface Attrs {
  [k: string]: string | undefined
}

function parseAttrs(s: string): Attrs {
  const out: Attrs = {}
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
  let hit: RegExpExecArray | null
  while ((hit = re.exec(s))) out[hit[1]] = hit[2]
  return out
}

const decode = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Numbers out of a points/path string. */
const nums = (s: string): number[] => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number)

/** M/L/H/V/Z absolute paths (what the sheet writers emit) into rings. */
function pathRings(d: string): Array<{ pts: Array<[number, number]>; closed: boolean }> {
  const out: Array<{ pts: Array<[number, number]>; closed: boolean }> = []
  let cur: Array<[number, number]> = []
  let closed = false
  const flush = (): void => {
    if (cur.length) out.push({ pts: cur, closed })
    cur = []
    closed = false
  }
  const re = /([MLHVZmlhvz])([^MLHVZmlhvz]*)/g
  let hit: RegExpExecArray | null
  let px = 0
  let py = 0
  while ((hit = re.exec(d))) {
    const cmd = hit[1]
    const a = nums(hit[2])
    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case 'M':
        flush()
        for (let i = 0; i + 1 < a.length; i += 2) {
          px = rel ? px + a[i] : a[i]
          py = rel ? py + a[i + 1] : a[i + 1]
          cur.push([px, py])
        }
        break
      case 'L':
        for (let i = 0; i + 1 < a.length; i += 2) {
          px = rel ? px + a[i] : a[i]
          py = rel ? py + a[i + 1] : a[i + 1]
          cur.push([px, py])
        }
        break
      case 'H':
        for (const v of a) {
          px = rel ? px + v : v
          cur.push([px, py])
        }
        break
      case 'V':
        for (const v of a) {
          py = rel ? py + v : v
          cur.push([px, py])
        }
        break
      case 'Z':
        closed = true
        flush()
        break
    }
  }
  flush()
  return out
}

interface Frame {
  layer: string | null
  hidden: boolean
  m: Mat
  opacity: number
  /** Inherited presentation attributes. */
  attrs: Attrs
}

const INHERITED = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'font-size', 'font-weight', 'text-anchor', 'letter-spacing', 'font-family']

/**
 * Walk the sheet and paint it. `X`/`Y` map sheet px to page pt; `P` is pt per px
 * for widths and sizes.
 */
function paintSvg(doc: PdfDoc, svg: string, X: (x: number) => number, Y: (y: number) => number, P: number, layers: Record<string, boolean>): { texts: number; shapes: number } {
  const frame = parseSheetFrame(svg)
  const stack: Frame[] = [{ layer: null, hidden: false, m: IDENT, opacity: 1, attrs: {} }]
  const top = (): Frame => stack[stack.length - 1]
  let texts = 0
  let shapes = 0
  let alpha = 1

  const setAlpha = (a: number): void => {
    if (Math.abs(a - alpha) < 0.005) return
    // ExtGState alpha is part of the graphics state; scope it with q/Q
    // so a later element at full opacity is not painted faint
    doc.restore()
    doc.save()
    doc.setAlpha(a)
    alpha = a
  }

  const paintShape = (
    a: Attrs,
    rings: Array<{ pts: Array<[number, number]>; closed: boolean }>,
    circle: { cx: number; cy: number; r: number } | null,
    isLine: boolean,
  ): void => {
    const f = top()
    const fillRaw = a.fill ?? f.attrs.fill ?? (isLine ? 'none' : '#000000')
    const strokeRaw = a.stroke ?? f.attrs.stroke ?? 'none'
    const fill = colour(fillRaw)
    const stroke = colour(strokeRaw)
    if (!fill && !stroke) return
    const op = (Number(a.opacity ?? 1) || 1) * f.opacity
    setAlpha(op)
    if (fill) doc.setFill(fill)
    if (stroke) {
      doc.setStroke(stroke)
      const sw = Number(a['stroke-width'] ?? f.attrs['stroke-width'] ?? 1)
      doc.setWidth(Math.max(0.12, sw * P))
      const dash = nums(a['stroke-dasharray'] ?? f.attrs['stroke-dasharray'] ?? '')
      doc.setDash(dash.length >= 2 ? [dash[0] * P, dash[1] * P] : dash.length === 1 ? [dash[0] * P, dash[0] * P] : null)
      const cap = a['stroke-linecap'] ?? f.attrs['stroke-linecap']
      doc.setLineCap(cap === 'round' ? 1 : cap === 'square' ? 2 : 0)
    }
    if (circle) {
      const [cx, cy] = apply(f.m, circle.cx, circle.cy)
      const k = Math.sqrt(Math.abs(f.m[0] * f.m[3] - f.m[1] * f.m[2]))
      doc.circle(X(cx), Y(cy), circle.r * k * P)
    } else {
      for (const r of rings) {
        const pts = r.pts.map(([x, y]) => {
          const [tx, ty] = apply(f.m, x, y)
          return [X(tx), Y(ty)] as [number, number]
        })
        doc.poly(pts, r.closed || (!!fill && !isLine))
      }
    }
    doc.paint(!!fill, !!stroke)
    if (stroke) doc.setDash(null)
    shapes++
  }

  const tagRe = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g
  let hit: RegExpExecArray | null
  doc.save()
  while ((hit = tagRe.exec(svg))) {
    const closing = hit[1] === '/'
    const name = hit[2]
    const selfClose = hit[4] === '/'
    if (closing) {
      if (name === 'g' && stack.length > 1) stack.pop()
      continue
    }
    const a = parseAttrs(hit[3])
    const f = top()

    if (name === 'svg') continue
    if (name === 'g') {
      const layer = a.id?.startsWith('L-') ? a.id.slice(2) : f.layer
      const hidden = f.hidden || (layer !== null && layers[layer] === false)
      const attrs: Attrs = { ...f.attrs }
      for (const k of INHERITED) if (a[k] !== undefined) attrs[k] = a[k]
      stack.push({
        layer,
        hidden,
        m: mul(f.m, parseTransform(a.transform)),
        opacity: f.opacity * (Number(a.opacity ?? 1) || 1),
        attrs,
      })
      if (selfClose) stack.pop()
      continue
    }
    if (f.hidden) {
      continue
    }
    const local = a.transform ? mul(f.m, parseTransform(a.transform)) : f.m
    const withLocal = <T,>(fn: () => T): T => {
      if (local === f.m) return fn()
      stack.push({ ...f, m: local })
      const r = fn()
      stack.pop()
      return r
    }

    switch (name) {
      case 'rect': {
        const pct = (v: string | undefined, whole: number): number =>
          v === undefined ? 0 : v.endsWith('%') ? (Number(v.slice(0, -1)) / 100) * whole : Number(v)
        const x = pct(a.x, frame.w)
        const y = pct(a.y, frame.h)
        const w = pct(a.width, frame.w)
        const h = pct(a.height, frame.h)
        withLocal(() =>
          paintShape(
            a,
            [
              {
                pts: [
                  [x, y],
                  [x + w, y],
                  [x + w, y + h],
                  [x, y + h],
                ],
                closed: true,
              },
            ],
            null,
            false,
          ),
        )
        break
      }
      case 'line':
        withLocal(() =>
          paintShape(
            a,
            [
              {
                pts: [
                  [Number(a.x1 ?? 0), Number(a.y1 ?? 0)],
                  [Number(a.x2 ?? 0), Number(a.y2 ?? 0)],
                ],
                closed: false,
              },
            ],
            null,
            true,
          ),
        )
        break
      case 'polygon':
      case 'polyline': {
        const v = nums(a.points ?? '')
        const pts: Array<[number, number]> = []
        for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]])
        if (pts.length >= 2) withLocal(() => paintShape(a, [{ pts, closed: name === 'polygon' }], null, name === 'polyline'))
        break
      }
      case 'circle':
        withLocal(() => paintShape(a, [], { cx: Number(a.cx ?? 0), cy: Number(a.cy ?? 0), r: Number(a.r ?? 0) }, false))
        break
      case 'path': {
        const rings = pathRings(a.d ?? '')
        if (rings.length) withLocal(() => paintShape(a, rings, null, true))
        break
      }
      case 'text': {
        if (selfClose) break
        const end = svg.indexOf('</text>', tagRe.lastIndex)
        if (end < 0) break
        const raw = svg.slice(tagRe.lastIndex, end).replace(/<[^>]*>/g, '')
        tagRe.lastIndex = end
        const s = decode(raw).replace(/\s+/g, ' ').trim()
        if (!s) break
        const size = Number(a['font-size'] ?? f.attrs['font-size'] ?? 16) * P
        if (size < 1.4) break // illegible at this scale; leave it off rather than smudge the sheet
        const [tx, ty] = apply(local, Number(a.x ?? 0), Number(a.y ?? 0))
        // sheet y is down, the page's is up: a clockwise SVG rotation is an
        // anticlockwise one on the page
        const rot = -(Math.atan2(local[1], local[0]) * 180) / Math.PI
        const fill = colour(a.fill ?? f.attrs.fill ?? '#000000')
        if (!fill) break
        setAlpha((Number(a.opacity ?? 1) || 1) * f.opacity)
        doc.setFill(fill)
        const anchor = (a['text-anchor'] ?? f.attrs['text-anchor'] ?? 'start') as 'start' | 'middle' | 'end'
        const weight = a['font-weight'] ?? f.attrs['font-weight'] ?? 'normal'
        const ls = Number(a['letter-spacing'] ?? f.attrs['letter-spacing'] ?? 0) * P
        doc.text(X(tx), Y(ty), size, s, {
          bold: weight === 'bold' || Number(weight) >= 600,
          rot: Math.abs(rot) < 0.01 ? undefined : rot,
          anchor,
          charSpace: ls || undefined,
        })
        texts++
        break
      }
      default:
        break
    }
  }
  doc.restore()
  return { texts, shapes }
}

/** '#rgb', '#rrggbb' or a handful of names; 'none' and anything unknown is no paint. */
function colour(v: string): string | null {
  const s = v.trim().toLowerCase()
  if (!s || s === 'none' || s === 'transparent') return null
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s)
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
  const named: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', grey: '#808080', gray: '#808080' }
  return named[s] ?? null
}

// --------------------------------------------------------------------- export

export function exportStyledPdf(opts: StyledPdfOptions): Blob {
  const svg = opts.svg ?? sheetSvg
  const frame = parseSheetFrame(svg)
  const paper = PAPER[opts.paper]
  const doc = new PdfDoc(paper.w * PT_PER_MM, paper.h * PT_PER_MM)

  // paper mm per sheet px, then pt per px
  const mmPerPx = 1 / frame.sc / opts.scale
  const P = mmPerPx * PT_PER_MM
  const sheetWmm = frame.w * mmPerPx
  const sheetHmm = frame.h * mmPerPx
  const fits = sheetWmm <= paper.w - EDGE_MM * 2 && sheetHmm <= paper.h - EDGE_MM * 2
  const ox = ((paper.w - sheetWmm) / 2) * PT_PER_MM
  const oy = ((paper.h - sheetHmm) / 2) * PT_PER_MM
  const X = (x: number): number => ox + x * P
  const Y = (y: number): number => oy + (frame.h - y) * P

  doc.save()
  doc.clipRect(EDGE_MM * PT_PER_MM, EDGE_MM * PT_PER_MM, (paper.w - EDGE_MM * 2) * PT_PER_MM, (paper.h - EDGE_MM * 2) * PT_PER_MM)
  // the browser clips the sheet to its own viewport (the lobby slab runs off
  // the bottom edge); the page must too, or it spills onto the surrounding paper
  doc.clipRect(X(0), Y(frame.h), frame.w * P, frame.h * P)
  paintSvg(doc, svg, X, Y, P, opts.layers ?? {})
  doc.restore()

  // a discreet stamp: the sheet's own title block does not know what paper it went on
  const stamp =
    `${building.meta.project} · ${building.meta.drawing} ${building.meta.revision} · ` +
    `SCALE 1:${opts.scale} @ ${opts.paper}` +
    (fits ? '' : ' (CLIPPED — use a larger sheet or a smaller scale)') +
    ' · printed as displayed'
  doc.setFill('#7b756b')
  doc.text((paper.w - EDGE_MM) * PT_PER_MM, (EDGE_MM - 3) * PT_PER_MM, 5.5, stamp, { anchor: 'end' })
  doc.endPage()
  return doc.build()
}
