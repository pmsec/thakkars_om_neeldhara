/**
 * Minimal vector PDF writer, plus the true-scale sheet layout.
 *
 * Hand-rolled rather than pulled from a library so the offline bundle stays small and
 * the output is genuinely vector at a known scale — an architect can put a ruler on the
 * print and it will measure correctly.
 */

import { buildSheet, titleBlock, type Prim, type SheetOptions } from './sheet'
import { getModel } from '../geometry/model'
import type { Pt } from '../geometry/vec'

const PT_PER_MM = 72 / 25.4

export const PAPER = {
  A1: { w: 841, h: 594 },
  A3: { w: 420, h: 297 },
} as const

export type PaperName = keyof typeof PAPER

class PdfDoc {
  private objects: string[] = []
  private content = ''
  private pages: Array<{ w: number; h: number; content: string }> = []

  constructor(
    private wPt: number,
    private hPt: number,
  ) {}

  private cmd(s: string): void {
    this.content += `${s}\n`
  }

  setStroke(hex: string): void {
    const [r, g, b] = hexToRgb(hex)
    this.cmd(`${r} ${g} ${b} RG`)
  }

  setFill(hex: string): void {
    const [r, g, b] = hexToRgb(hex)
    this.cmd(`${r} ${g} ${b} rg`)
  }

  setWidth(w: number): void {
    this.cmd(`${w.toFixed(3)} w`)
  }

  setDash(pattern: [number, number] | null): void {
    this.cmd(pattern ? `[${pattern[0].toFixed(2)} ${pattern[1].toFixed(2)}] 0 d` : '[] 0 d')
  }

  poly(pts: Array<[number, number]>, close: boolean): void {
    if (pts.length === 0) return
    this.cmd(`${pts[0][0].toFixed(3)} ${pts[0][1].toFixed(3)} m`)
    for (let i = 1; i < pts.length; i++) this.cmd(`${pts[i][0].toFixed(3)} ${pts[i][1].toFixed(3)} l`)
    if (close) this.cmd('h')
  }

  stroke(): void {
    this.cmd('S')
  }

  fill(evenOdd = true): void {
    this.cmd(evenOdd ? 'f*' : 'f')
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.cmd(`${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)} re`)
  }

  text(x: number, y: number, size: number, s: string, opts: { bold?: boolean; rot?: number; anchor?: 'start' | 'middle' | 'end' } = {}): void {
    const font = opts.bold ? '/F2' : '/F1'
    // Helvetica average advance ≈ 0.52 em; good enough for centring plan annotation.
    const wEst = s.length * size * 0.52
    const dx = opts.anchor === 'middle' ? -wEst / 2 : opts.anchor === 'end' ? -wEst : 0
    this.cmd('BT')
    this.cmd(`${font} ${size.toFixed(2)} Tf`)
    if (opts.rot) {
      const a = (opts.rot * Math.PI) / 180
      const c = Math.cos(a)
      const sn = Math.sin(a)
      this.cmd(`${c.toFixed(5)} ${sn.toFixed(5)} ${(-sn).toFixed(5)} ${c.toFixed(5)} ${(x + dx * c).toFixed(3)} ${(y + dx * sn).toFixed(3)} Tm`)
    } else {
      this.cmd(`1 0 0 1 ${(x + dx).toFixed(3)} ${y.toFixed(3)} Tm`)
    }
    this.cmd(`(${escapePdf(s)}) Tj`)
    this.cmd('ET')
  }

  save(): void {
    this.cmd('q')
  }

  restore(): void {
    this.cmd('Q')
  }

  clipRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h)
    this.cmd('W n')
  }

  endPage(): void {
    this.pages.push({ w: this.wPt, h: this.hPt, content: this.content })
    this.content = ''
  }

  build(): Blob {
    if (this.content.trim()) this.endPage()
    this.objects = []
    const pageObjIds: number[] = []
    // 1 catalog, 2 pages, then per page: page obj + content obj. Fonts last.
    const firstPageObj = 3
    this.pages.forEach((_, i) => pageObjIds.push(firstPageObj + i * 2))
    const fontRegular = firstPageObj + this.pages.length * 2
    const fontBold = fontRegular + 1

    this.objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    this.objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    this.pages.forEach((pg, i) => {
      const pid = pageObjIds[i]
      this.objects[pid] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w.toFixed(2)} ${pg.h.toFixed(2)}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${pid + 1} 0 R >>`
      this.objects[pid + 1] = `<< /Length ${pg.content.length} >>\nstream\n${pg.content}\nendstream`
    })
    this.objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    this.objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'

    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    for (let i = 1; i < this.objects.length; i++) {
      offsets[i] = out.length
      out += `${i} 0 obj\n${this.objects[i]}\nendobj\n`
    }
    const xref = out.length
    out += `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`
    for (let i = 1; i < this.objects.length; i++) {
      out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    out += `trailer\n<< /Size ${this.objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    return new Blob([out], { type: 'application/pdf' })
  }
}

function hexToRgb(hex: string): [string, string, string] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(4)) as [
    string,
    string,
    string,
  ]
}

const escapePdf = (s: string): string =>
  // Latin-1 only; the middot and multiplication sign are the two we actually use.
  s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/·/g, '\\267')
    .replace(/×/g, '\\327')
    .replace(/²/g, '\\262')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–|—/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, '?')

export interface PdfOptions extends Partial<SheetOptions> {
  paper: PaperName
  /** Denominator of the drawing scale: 50, 75 or 100. */
  scale: number
}

/**
 * Lay the plan out at a true scale on the chosen sheet, with a title block.
 * The model is in mm; paperMm = modelMm / scale; pt = paperMm * 72/25.4.
 */
export function exportPdf(opts: PdfOptions): Blob {
  const model = getModel()
  const { prims } = buildSheet(opts, model)
  const paper = PAPER[opts.paper]
  const doc = new PdfDoc(paper.w * PT_PER_MM, paper.h * PT_PER_MM)

  const marginMm = opts.paper === 'A1' ? 15 : 10
  const tbHeightMm = opts.paper === 'A1' ? 34 : 24
  const drawWmm = paper.w - marginMm * 2
  const drawHmm = paper.h - marginMm * 2 - tbHeightMm

  // Model-space extent we need to show, including the dimension chains.
  const bb = model.envelopeBBox
  const pad = 2600
  const mx0 = bb.minX - pad
  const my0 = bb.minY - pad
  const mw = bb.maxX - bb.minX + pad * 2
  const mh = bb.maxY - bb.minY + pad * 2

  // Millimetres of paper per millimetre of model.
  const k = 1 / opts.scale
  const fitsW = mw * k <= drawWmm
  const fitsH = mh * k <= drawHmm

  // PDF y is up; the model's y is down. Flip, and centre what we can.
  const originXmm = marginMm + Math.max(0, (drawWmm - mw * k) / 2)
  const originYmm = marginMm + tbHeightMm + Math.max(0, (drawHmm - mh * k) / 2) + Math.min(drawHmm, mh * k)

  const X = (x: number): number => (originXmm + (x - mx0) * k) * PT_PER_MM
  const Y = (y: number): number => (originYmm - (y - my0) * k) * PT_PER_MM
  // Model mm -> paper pt, for line widths and text.
  const S = (v: number): number => v * k * PT_PER_MM

  doc.save()
  doc.clipRect(marginMm * PT_PER_MM, (marginMm + tbHeightMm) * PT_PER_MM, drawWmm * PT_PER_MM, drawHmm * PT_PER_MM)
  for (const prim of prims) drawPrim(doc, prim, X, Y, S)
  doc.restore()

  drawTitleBlock(doc, paper, marginMm, tbHeightMm, opts, fitsW && fitsH)
  doc.endPage()
  return doc.build()
}

function drawPrim(
  doc: PdfDoc,
  prim: Prim,
  X: (x: number) => number,
  Y: (y: number) => number,
  S: (v: number) => number,
): void {
  if (prim.t === 'text') {
    const size = S(prim.size)
    if (size < 1.4) return // Illegible at this scale; leave it off rather than smudge the sheet.
    doc.setFill(prim.colour)
    doc.text(X(prim.at.x), Y(prim.at.y) - size * 0.36, size, prim.s, {
      bold: prim.bold,
      rot: prim.rot,
      anchor: prim.anchor,
    })
    return
  }
  const rings = prim.rings.map((r) => r.map((p) => [X(p.x), Y(p.y)] as [number, number]))
  if (prim.fill) {
    doc.setFill(prim.fill)
    for (const r of rings) doc.poly(r, true)
    doc.fill(true)
  }
  if (prim.stroke) {
    doc.setStroke(prim.stroke)
    doc.setWidth(Math.max(0.12, S(prim.width ?? 20)))
    doc.setDash(prim.dash ? [S(prim.dash[0]), S(prim.dash[1])] : null)
    for (const r of rings) {
      doc.poly(r, prim.closed)
      doc.stroke()
    }
    doc.setDash(null)
  }
}

function drawTitleBlock(
  doc: PdfDoc,
  paper: { w: number; h: number },
  margin: number,
  h: number,
  opts: PdfOptions,
  fits: boolean,
): void {
  const rows = titleBlock()
  const x = margin * PT_PER_MM
  const y = margin * PT_PER_MM
  const w = (paper.w - margin * 2) * PT_PER_MM
  const hh = h * PT_PER_MM

  doc.setStroke('#6F6860')
  doc.setWidth(0.9)
  doc.rect(x, y, w, hh)
  doc.stroke()

  doc.setFill('#232120')
  const lineH = hh / (rows.length + 0.6)
  const fs = Math.min(9, lineH * 0.62)
  rows.forEach((row, i) => {
    const ty = y + hh - lineH * (i + 1)
    doc.text(x + 6, ty, i === 0 ? fs * 1.35 : fs, row[0], { bold: i === 0 })
    doc.text(x + w * 0.62, ty, i === 0 ? fs * 1.05 : fs, row[1], { bold: i === 0 })
  })
  doc.setFill('#7B756B')
  doc.text(x + w - 6, y + 5, fs, `SCALE 1:${opts.scale} @ ${opts.paper}${fits ? '' : ' (CLIPPED — use a larger sheet)'}`, {
    anchor: 'end',
  })
}

/** Markup comments as a standalone annotation sheet (brief §5.10). */
export function exportMarkupPdf(
  markups: Array<{ id: string; at: Pt; text: string; author: string; date: string }>,
): Blob {
  const paper = PAPER.A3
  const doc = new PdfDoc(paper.w * PT_PER_MM, paper.h * PT_PER_MM)
  const M = 14 * PT_PER_MM
  let y = paper.h * PT_PER_MM - M

  doc.setFill('#232120')
  doc.text(M, y, 15, 'Full-Floor Residence — markup schedule', { bold: true })
  y -= 16
  doc.setFill('#7B756B')
  doc.text(M, y, 8.5, `DWG A-101 Rev 4  ·  ${markups.length} comment${markups.length === 1 ? '' : 's'}`)
  y -= 20

  doc.setStroke('#D8D3C8')
  doc.setWidth(0.6)
  for (const [i, m] of markups.entries()) {
    if (y < M + 40) {
      doc.endPage()
      y = paper.h * PT_PER_MM - M
    }
    doc.setFill('#232120')
    doc.text(M, y, 9.5, `${i + 1}.  ${m.text}`, { bold: true })
    y -= 12
    doc.setFill('#7B756B')
    doc.text(M + 12, y, 8, `${m.author}  ·  ${m.date}  ·  x ${Math.round(m.at.x)} mm, y ${Math.round(m.at.y)} mm`)
    y -= 8
    doc.poly(
      [
        [M, y],
        [paper.w * PT_PER_MM - M, y],
      ],
      false,
    )
    doc.stroke()
    y -= 12
  }
  doc.endPage()
  return doc.build()
}
