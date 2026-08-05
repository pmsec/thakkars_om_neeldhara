/**
 * SVG, DXF, PNG and CSV exports. All driven by the same sheet description as the PDF.
 */

import { buildSheet, type Prim, type SheetOptions } from './sheet'
import sheetSvgRaw from '../assets/plan-sheet.svg?raw'
import { getModel } from '../geometry/model'
import { building } from '../data/building'
import { formatFeetInches, sqFt, sqM } from '../geometry/units'
import { runIntegrity } from '../geometry/integrity'

const PAD = 2600

// ------------------------------------------------------------------------- SVG

export function exportSvg(opts: Partial<SheetOptions> = {}): string {
  const model = getModel()
  const { prims } = buildSheet(opts, model)
  const bb = model.envelopeBBox
  const x = bb.minX - PAD
  const y = bb.minY - PAD
  const w = bb.maxX - bb.minX + PAD * 2
  const h = bb.maxY - bb.minY + PAD * 2

  const body = prims.map(primToSvg).join('\n  ')
  // width/height in real millimetres so the SVG opens at 1:1 in a vector editor.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${(w / 1000).toFixed(3)}mm" height="${(h / 1000).toFixed(3)}mm">`,
    `  <title>${building.meta.project} — ${building.meta.drawing} ${building.meta.revision}</title>`,
    `  <desc>Exported from the project portal. Model units millimetres. 1 user unit = 1 mm.</desc>`,
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#F5F3EE"/>`,
    `  ${body}`,
    '</svg>',
  ].join('\n')
}

function primToSvg(p: Prim): string {
  if (p.t === 'text') {
    const rot = p.rot ? ` transform="rotate(${p.rot} ${p.at.x.toFixed(1)} ${p.at.y.toFixed(1)})"` : ''
    return `<text x="${p.at.x.toFixed(1)}" y="${p.at.y.toFixed(1)}" font-size="${p.size.toFixed(0)}" fill="${p.colour}" text-anchor="${p.anchor}" font-family="Helvetica, Arial, sans-serif"${p.bold ? ' font-weight="700"' : ''}${rot}>${escapeXml(p.s)}</text>`
  }
  const d = p.rings
    .map((r) => `M${r.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('L')}${p.closed ? 'Z' : ''}`)
    .join(' ')
  const attrs = [
    `d="${d}"`,
    `fill="${p.fill ?? 'none'}"`,
    p.fill ? 'fill-rule="evenodd"' : '',
    p.stroke ? `stroke="${p.stroke}"` : 'stroke="none"',
    p.stroke ? `stroke-width="${(p.width ?? 20).toFixed(0)}"` : '',
    p.dash ? `stroke-dasharray="${p.dash[0]} ${p.dash[1]}"` : '',
    `data-layer="${p.layer}"`,
  ].filter(Boolean)
  return `<path ${attrs.join(' ')}/>`
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ------------------------------------------------------------------------- DXF

/**
 * DXF R12 (AC1009). LINE, POLYLINE and TEXT only — the most portable subset, which
 * every CAD package reads without complaint. Layers mirror the sheet's layer names.
 * Y is negated because DXF is Y-up and the model is Y-down.
 */
export function exportDxf(opts: Partial<SheetOptions> = {}): string {
  const { prims } = buildSheet({ ...opts, fabricOnly: opts.fabricOnly ?? true })
  const layers = [...new Set(prims.map((p) => p.layer))]
  const out: string[] = []
  const g = (code: number, value: string | number): void => {
    out.push(String(code), String(value))
  }

  g(0, 'SECTION')
  g(2, 'HEADER')
  g(9, '$INSUNITS')
  g(70, 4) // millimetres
  g(9, '$EXTMIN')
  g(10, 0)
  g(20, -10850)
  g(9, '$EXTMAX')
  g(10, 24480)
  g(20, 0)
  g(0, 'ENDSEC')

  g(0, 'SECTION')
  g(2, 'TABLES')
  g(0, 'TABLE')
  g(2, 'LAYER')
  g(70, layers.length)
  layers.forEach((name, i) => {
    g(0, 'LAYER')
    g(2, name)
    g(70, 0)
    g(62, (i % 7) + 1)
    g(6, 'CONTINUOUS')
  })
  g(0, 'ENDTAB')
  g(0, 'ENDSEC')

  g(0, 'SECTION')
  g(2, 'ENTITIES')
  for (const p of prims) {
    if (p.t === 'text') {
      g(0, 'TEXT')
      g(8, p.layer)
      g(10, p.at.x.toFixed(3))
      g(20, (-p.at.y).toFixed(3))
      g(30, 0)
      g(40, p.size.toFixed(2))
      g(1, p.s.replace(/\n/g, ' '))
      if (p.rot) g(50, -p.rot)
      g(72, p.anchor === 'middle' ? 1 : p.anchor === 'end' ? 2 : 0)
      if (p.anchor !== 'start') {
        g(11, p.at.x.toFixed(3))
        g(21, (-p.at.y).toFixed(3))
        g(31, 0)
      }
      continue
    }
    for (const ring of p.rings) {
      if (ring.length < 2) continue
      g(0, 'POLYLINE')
      g(8, p.layer)
      g(66, 1)
      g(10, 0)
      g(20, 0)
      g(30, 0)
      g(70, p.closed ? 1 : 0)
      for (const q of ring) {
        g(0, 'VERTEX')
        g(8, p.layer)
        g(10, q.x.toFixed(3))
        g(20, (-q.y).toFixed(3))
        g(30, 0)
      }
      g(0, 'SEQEND')
      g(8, p.layer)
    }
  }
  g(0, 'ENDSEC')
  g(0, 'EOF')
  return out.join('\r\n')
}

// ------------------------------------------------------------------------- PNG

/**
 * Rasterise the sheet at a chosen DPI, sized as if printed at `scale` (1:75 by default).
 * Everything in the SVG is inline, so the canvas is never tainted and toBlob works from
 * a file:// origin.
 */
/**
 * Rasterise THE CAD SHEET — the drawing the 2D tab shows — at the chosen DPI
 * for the chosen paper width at the chosen scale.
 *
 * Silent-failure fixes, all found the hard way:
 *   - a data: URI of a multi-hundred-kB SVG fails to load as an <img> on
 *     some browsers; a Blob URL does not
 *   - canvases above the platform limit (iOS Safari most of all) draw
 *     nothing and toBlob() yields null, which the old code force-unwrapped;
 *     the size now steps down until the canvas actually works, and a null
 *     blob raises a real error instead of doing nothing
 */
export async function exportPng(dpi: number, _opts: Partial<SheetOptions> = {}, scale = 50): Promise<Blob> {
  const model = getModel()
  const bb = model.envelopeBBox
  const paperWmm = (bb.maxX - bb.minX + PAD * 2) / scale
  const sheetAspect = 2675 / 4200
  let px = Math.round((paperWmm / 25.4) * dpi)

  const svg = sheetSvgRaw
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not rasterise the CAD sheet'))
      img.src = url
    })
    // Step the size down until the platform accepts the canvas AND fills it.
    for (; px >= 1000; px = Math.floor(px * 0.75)) {
      const py = Math.round(px * sheetAspect)
      if (px * py > 60_000_000 || px > 16000) continue
      const canvas = document.createElement('canvas')
      canvas.width = px
      canvas.height = py
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#faf8f4'
      ctx.fillRect(0, 0, px, py)
      ctx.drawImage(img, 0, 0, px, py)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      )
      if (blob && blob.size > 1000) return blob
    }
    throw new Error('This browser could not produce a canvas large enough for that DPI — try a lower one')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ------------------------------------------------------------------------- CSV

const csvCell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (rows: Array<Array<string | number>>): string => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

export function roomScheduleCsv(): string {
  const model = getModel()
  const rows: Array<Array<string | number>> = [
    ['ID', 'Room', 'Zone', 'Category', 'Width mm', 'Depth mm', 'Width ft-in', 'Depth ft-in', 'Carpet sq ft', 'Carpet m²', 'Gross sq ft', 'Rev 4 published sq ft', 'Ceiling mm', 'Finish', 'Openings', 'Notes'],
  ]
  for (const r of model.rooms) {
    const ops = model.connections.filter((c) => c.a === r.id || c.b === r.id).map((c) => c.openingId)
    rows.push([
      r.id,
      r.name,
      r.def.zone,
      r.def.category,
      Math.round(r.width),
      Math.round(r.depth),
      formatFeetInches(r.width),
      formatFeetInches(r.depth),
      sqFt(r.area).toFixed(1),
      sqM(r.area).toFixed(2),
      sqFt(r.grossArea).toFixed(1),
      r.def.publishedSqFt ?? '',
      r.ceiling,
      r.def.finish ?? '',
      ops.join(' '),
      r.def.notes ?? '',
    ])
  }
  return csv(rows)
}

export function openingScheduleCsv(): string {
  const model = getModel()
  const rows: Array<Array<string | number>> = [
    ['ID', 'Type', 'Wall', 'Width mm', 'Width ft-in', 'Sill mm', 'Head mm', 'Connects', 'Label', 'Notes'],
  ]
  for (const op of model.openings) {
    const conn = model.connections.find((c) => c.openingId === op.id)
    rows.push([
      op.id,
      op.type,
      op.wallId,
      Math.round(op.width),
      formatFeetInches(op.width),
      op.sill ?? 0,
      op.head ?? '',
      conn ? `${conn.a} — ${conn.b}` : '',
      op.label ?? '',
      op.notes ?? '',
    ])
  }
  return csv(rows)
}

export function integrityCsv(): string {
  const rep = runIntegrity()
  const rows: Array<Array<string | number>> = [['Check', 'Title', 'Result', 'Requirement', 'Actual', 'Tolerance']]
  for (const c of rep.checks) {
    rows.push([c.id, c.title, c.pass ? 'PASS' : c.severity === 'warn' ? 'ADVISORY' : 'FAIL', c.requirement, c.actual, c.tolerance ?? ''])
  }
  return csv(rows)
}

// ------------------------------------------------------------------------- helper

export function download(name: string, data: Blob | string, mime = 'text/plain'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: `${mime};charset=utf-8` }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
