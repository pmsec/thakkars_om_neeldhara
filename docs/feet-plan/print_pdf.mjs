/**
 * The feet plan on A1 landscape at 1:40, with its title block:
 *   node docs/feet-plan/print_pdf.mjs <in.svg> <out.pdf>
 * The SVG carries the sheet's pixel-per-millimetre scale in data-frame /
 * data-pad (as every CAD sheet does), so the true print size is derived, not
 * guessed. CHROMIUM_PATH overrides the browser (defaults to the one here).
 */
import { readFileSync } from 'fs'
import { chromium } from 'playwright'

const [src, out] = process.argv.slice(2)
const svg = readFileSync(src, 'utf8')
const m = svg.match(/width="(\d+)" height="(\d+)" data-frame="([-\d. ]+)" data-pad="(\d+)"/)
const [wPx, hPx] = [Number(m[1]), Number(m[2])]
const [fx0, , fx1] = m[3].split(' ').map(Number)
const pad = Number(m[4])
const pxPerMm = (wPx - 2 * pad) / (fx1 - fx0)          // sheet px per model mm
const SCALE = 35                                        // fills A1's width; the feet scale bar is on the sheet
const wMm = wPx / pxPerMm / SCALE
const hMm = hPx / pxPerMm / SCALE

const html = `<!doctype html><html><head><style>
  @page { size: 841mm 594mm; margin: 0 }
  html, body { margin: 0; background: #faf8f4; font-family: Helvetica, Arial, sans-serif; color: #1f1d1a }
  .page { width: 841mm; height: 594mm; box-sizing: border-box; padding: 14mm 16mm; display: flex; flex-direction: column }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 0.6mm solid #1f1d1a; padding-bottom: 4mm }
  h1 { font-size: 11mm; margin: 0; letter-spacing: 0.4mm }
  .sub { font-size: 5mm; margin-top: 2mm; color: #2c5c61 }
  .meta { text-align: right; font-size: 4mm; line-height: 1.5 }
  .sheet { flex: 1; display: flex; align-items: center; justify-content: center }
  .sheet svg { width: ${wMm.toFixed(2)}mm; height: ${hMm.toFixed(2)}mm }
  .notes { font-size: 3.6mm; line-height: 1.55; color: #3b3833; border-top: 0.3mm solid #b9b5ab; padding-top: 3mm; columns: 2; column-gap: 12mm }
</style></head><body><div class="page">
  <div class="head">
    <div><h1>OM NEELDHARA — FLOOR 14 · HOME 1</h1>
      <div class="sub">Every space and every significant piece: length × width × height, in feet and inches</div></div>
    <div class="meta">Scale 1:${SCALE} on A1<br/>Round 1 layout · concept drawing, not for construction</div>
  </div>
  <div class="sheet">${svg.replace(/^<\?xml[^>]*>/, '').replace('<svg ', `<svg viewBox="0 0 ${wPx} ${hPx}" `)}</div>
  <div class="notes">
    Spaces: length × width are the overall extent of the space, longest side first; height is floor to ceiling.
    The deck and the two terraces are open to the glass vault, which rises from the ceiling line to its crown.
    Shafts and ducts are open through the building and carry no ceiling height.<br/>
    Furniture and joinery: length × width × height of the piece. A curved or L-shaped run is measured along
    its length, at its working depth. A loft is sized by its box and hangs above what is drawn under it.
  </div>
</div></body></html>`

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({ path: out, width: '841mm', height: '594mm', printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log(`wrote ${out}: sheet ${wMm.toFixed(0)} x ${hMm.toFixed(0)} mm at 1:${SCALE} on A1`)
