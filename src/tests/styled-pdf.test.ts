/**
 * The styled PDF prints the CAD sheet itself, so what reaches paper is what the
 * 2D tab shows. These checks pin the two things that matter: nothing on the
 * sheet is silently dropped by the converter, and the paper is at true scale.
 */

import { describe, expect, it } from 'vitest'
import { exportStyledPdf, styledFit } from '../export/styledPdf'
import { parseSheetFrame } from '../export/sheetFrame'
import { PT_PER_MM } from '../export/pdf'
import omSheet from '../homes/om-neeldhara/plan-sheet.svg?raw'
import ektaSheet from '../homes/ekta/plan-sheet.svg?raw'

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length

describe('styled PDF', () => {
  it('reads the frame the CAD generator stamps on the sheet', () => {
    const f = parseSheetFrame(omSheet)
    expect([f.w, f.h, f.pad, f.x0, f.y0, f.x1, f.y1]).toEqual([4200, 2675, 90, -3200, -2400, 26600, 16100])
    const e = parseSheetFrame(ektaSheet)
    expect([e.w, e.h, e.pad]).toEqual([3000, 3165, 80])
    expect(e.sc).toBeCloseTo((3000 - 160) / (13020 + 1550), 6)
    // a sheet without the stamp falls back to Om Neeldhara's frame
    expect(parseSheetFrame('<svg width="4200" height="2675"></svg>').x0).toBe(-3200)
  })

  it('paints every element of the Om Neeldhara sheet', async () => {
    const pdf = await exportStyledPdf({ paper: 'A1', scale: 50, svg: omSheet }).text()
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    // 103 texts on the sheet, all legible at 1:50 on A1, plus the stamp
    expect(count(pdf, / Tj\n/g)).toBe(count(omSheet, /<text\b/g) + 1)
    // the keep-clear hatches are drawn at 45 % and get a real ExtGState
    expect(pdf).toContain('/ExtGState << /GS45 ')
    expect(pdf).toContain('/CA 0.45 /ca 0.45')
    // every circle becomes four Béziers
    expect(count(pdf, / c\n/g)).toBe(count(omSheet, /<circle\b/g) * 4)
    // rotated group text (the west dimension chain) carries a rotation matrix
    expect(pdf).toMatch(/0\.00000 1\.00000 -1\.00000 0\.00000 [\d.]+ [\d.]+ Tm/)
  })

  it('lays the sheet out at true scale', async () => {
    const f = parseSheetFrame(omSheet)
    // one sheet px is 1/sc model mm; at 1:50 that is (1/sc)/50 paper mm
    const ptPerPx = (1 / f.sc / 50) * PT_PER_MM
    const pdf = await exportStyledPdf({ paper: 'A1', scale: 50, svg: omSheet }).text()
    // the page rect the sheet's paper fill draws: full sheet width in pt
    const m = /(-?[\d.]+) (-?[\d.]+) m\n(-?[\d.]+) (-?[\d.]+) l\n/.exec(pdf)
    expect(m).not.toBeNull()
    const w = Math.abs(Number(m![3]) - Number(m![1]))
    expect(w).toBeCloseTo(f.w * ptPerPx, 1)
    // and that is 4200 px * 7.413 mm/px / 50 = 622.7 mm of paper
    expect(w / PT_PER_MM).toBeCloseTo(622.7, 0)
    expect(styledFit('A1', 50, undefined, omSheet).fits).toBe(true)
    expect(styledFit('A3', 50, undefined, omSheet).fits).toBe(false)
    expect(styledFit('A3', 50, undefined, omSheet).best).toBe(100)
    expect(styledFit('A4', 150, undefined, omSheet).fits).toBe(true)
  })

  it('honours the layer toggles and paints Ekta too', async () => {
    const all = await exportStyledPdf({ paper: 'A1', scale: 50, svg: omSheet }).text()
    const noDims = await exportStyledPdf({ paper: 'A1', scale: 50, svg: omSheet, layers: { dims: false, furniture: false } }).text()
    expect(noDims.length).toBeLessThan(all.length * 0.8)
    const ekta = await exportStyledPdf({ paper: 'A3', scale: 50, svg: ektaSheet }).text()
    expect(count(ekta, / Tj\n/g)).toBe(count(ektaSheet, /<text\b/g) + 1)
  })
})
