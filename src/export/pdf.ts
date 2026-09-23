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

export const PT_PER_MM = 72 / 25.4

export const PAPER = {
  A1: { w: 841, h: 594 },
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
} as const

export type PaperName = keyof typeof PAPER

/** The model-space breathing room the sheet leaves round the envelope for the dimension chains. */
export const SHEET_PAD = 2600

/** Margin and title-block height for a sheet. The layout and the UI must agree, so both read this. */
export function sheetFrame(paper: PaperName): { margin: number; tb: number } {
  if (paper === 'A1') return { margin: 15, tb: 34 }
  if (paper === 'A3') return { margin: 10, tb: 24 }
  return { margin: 7, tb: 16 }
}

/**
 * What the ACTIVE home needs on paper at a given scale, and whether it fits.
 * The Export panel used to state one home's length as a fixed sentence, which
 * was wrong the moment a second home existed.
 */
export function sheetFit(
  paper: PaperName,
  scale: number,
  scales: readonly number[] = [50, 75, 100, 150, 200],
): { needW: number; needH: number; drawW: number; drawH: number; fits: boolean; best: number | null; extent: number } {
  const bb = getModel().envelopeBBox
  const mw = bb.maxX - bb.minX + SHEET_PAD * 2
  const mh = bb.maxY - bb.minY + SHEET_PAD * 2
  const { margin, tb } = sheetFrame(paper)
  const drawW = PAPER[paper].w - margin * 2
  const drawH = PAPER[paper].h - margin * 2 - tb
  const ok = (sc: number): boolean => mw / sc <= drawW && mh / sc <= drawH
  return {
    needW: mw / scale,
    needH: mh / scale,
    drawW,
    drawH,
    fits: ok(scale),
    best: scales.find(ok) ?? null,
    extent: Math.max(mw, mh),
  }
}

export class PdfDoc {
  private objects: string[] = []
  private content = ''
  private pages: Array<{ w: number; h: number; content: string }> = []
  /** Constant-alpha graphics states used so far, by alpha (e.g. 0.45 -> /GS45). */
  private alphas = new Map<number, string>()

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

  /** 0 butt, 1 round, 2 square. */
  setLineCap(cap: 0 | 1 | 2): void {
    this.cmd(`${cap} J`)
  }

  /**
   * Constant alpha for both strokes and fills, as an ExtGState. Wrap in
   * save()/restore() to scope it; alpha 1 emits nothing.
   */
  setAlpha(alpha: number): void {
    const a = Math.max(0, Math.min(1, alpha))
    if (a >= 0.999) return
    const key = Math.round(a * 100)
    let name = this.alphas.get(key)
    if (!name) {
      name = `/GS${key}`
      this.alphas.set(key, name)
    }
    this.cmd(`${name} gs`)
  }

  /** Concatenate an affine matrix onto the CTM. */
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.cmd(`${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${e.toFixed(3)} ${f.toFixed(3)} cm`)
  }

  /** A full circle as four Béziers (kappa 0.5523). */
  circle(cx: number, cy: number, r: number): void {
    const k = 0.5523 * r
    this.cmd(`${(cx + r).toFixed(3)} ${cy.toFixed(3)} m`)
    const seg = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void =>
      this.cmd(`${x1.toFixed(3)} ${y1.toFixed(3)} ${x2.toFixed(3)} ${y2.toFixed(3)} ${x3.toFixed(3)} ${y3.toFixed(3)} c`)
    seg(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    seg(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    seg(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    seg(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    this.cmd('h')
  }

  /** Fill and stroke the current path in one go (PDF `B*`), or just one of them. */
  paint(fill: boolean, stroke: boolean): void {
    if (fill && stroke) this.cmd('B*')
    else if (fill) this.cmd('f*')
    else if (stroke) this.cmd('S')
    else this.cmd('n')
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

  text(
    x: number,
    y: number,
    size: number,
    s: string,
    opts: { bold?: boolean; rot?: number; anchor?: 'start' | 'middle' | 'end'; charSpace?: number } = {},
  ): void {
    const font = opts.bold ? '/F2' : '/F1'
    const cs = opts.charSpace ?? 0
    // Helvetica average advance ≈ 0.52 em; good enough for centring plan annotation.
    const wEst = s.length * size * 0.52 + Math.max(0, s.length - 1) * cs
    const dx = opts.anchor === 'middle' ? -wEst / 2 : opts.anchor === 'end' ? -wEst : 0
    this.cmd('BT')
    this.cmd(`${font} ${size.toFixed(2)} Tf`)
    if (cs) this.cmd(`${cs.toFixed(3)} Tc`)
    if (opts.rot) {
      const a = (opts.rot * Math.PI) / 180
      const c = Math.cos(a)
      const sn = Math.sin(a)
      this.cmd(`${c.toFixed(5)} ${sn.toFixed(5)} ${(-sn).toFixed(5)} ${c.toFixed(5)} ${(x + dx * c).toFixed(3)} ${(y + dx * sn).toFixed(3)} Tm`)
    } else {
      this.cmd(`1 0 0 1 ${(x + dx).toFixed(3)} ${y.toFixed(3)} Tm`)
    }
    this.cmd(`(${escapePdf(s)}) Tj`)
    if (cs) this.cmd('0 Tc')
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
    const gsFirst = fontBold + 1
    const gsEntries = [...this.alphas.entries()]
    const extG = gsEntries.length
      ? ` /ExtGState << ${gsEntries.map(([, name], i) => `${name} ${gsFirst + i} 0 R`).join(' ')} >>`
      : ''

    this.objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    this.objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    this.pages.forEach((pg, i) => {
      const pid = pageObjIds[i]
      this.objects[pid] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w.toFixed(2)} ${pg.h.toFixed(2)}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${extG} >> /Contents ${pid + 1} 0 R >>`
      this.objects[pid + 1] = `<< /Length ${pg.content.length} >>\nstream\n${pg.content}\nendstream`
    })
    this.objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    this.objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    gsEntries.forEach(([key], i) => {
      const a = (key / 100).toFixed(2)
      this.objects[gsFirst + i] = `<< /Type /ExtGState /CA ${a} /ca ${a} >>`
    })

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
    .replace(/…/g, '...')
    // formatMm separates thousands with a THIN SPACE, and the catch-all below
    // used to turn it into a '?', so every dimension on every PDF read
    // "25?680". Typographic spaces degrade to an ordinary space.
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
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

  const { margin: marginMm, tb: tbHeightMm } = sheetFrame(opts.paper)
  const drawWmm = paper.w - marginMm * 2
  const drawHmm = paper.h - marginMm * 2 - tbHeightMm

  // Model-space extent we need to show, including the dimension chains.
  const bb = model.envelopeBBox
  const pad = SHEET_PAD
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
  // Helvetica averages ~0.52 em; trim what will not fit rather than let it run
  // off the sheet (the scale note overran the box on A4)
  const clip = (t: string, maxW: number, size: number): string => {
    const n = Math.floor(maxW / (size * 0.52))
    return t.length <= n ? t : `${t.slice(0, Math.max(1, n - 3)).trimEnd()}...`
  }
  const col2 = x + w * 0.62
  // the scale stamp shares the last row's baseline, so that row's text stops short of it
  const stamp = `SCALE 1:${opts.scale} @ ${opts.paper}${fits ? '' : ' (CLIPPED — use a larger sheet)'}`
  const stampW = stamp.length * fs * 0.52 + 10
  const last = rows.length - 1
  rows.forEach((row, i) => {
    const ty = y + hh - lineH * (i + 1)
    const s1 = i === 0 ? fs * 1.35 : fs
    const s2 = i === 0 ? fs * 1.05 : fs
    const right = x + w - 6 - (i === last ? stampW : 0)
    doc.text(x + 6, ty, s1, clip(row[0], col2 - (x + 6) - 8, s1), { bold: i === 0 })
    doc.text(col2, ty, s2, clip(row[1], Math.max(20, right - col2), s2), { bold: i === 0 })
  })
  doc.setFill('#7B756B')
  doc.text(x + w - 6, y + hh - lineH * rows.length, fs, stamp, { anchor: 'end' })
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
