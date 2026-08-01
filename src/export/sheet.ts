/**
 * A renderer-neutral description of the drawing sheet.
 *
 * The screen, the PDF, the SVG and the DXF all consume this, so they cannot drift apart.
 * Built from the geometry module only.
 */

import { building } from '../data/building'
import { fixtures } from '../data/fixtures'
import { furniture } from '../data/furniture'
import { buildDimensions } from '../geometry/dimensions'
import { getModel, type BuiltModel } from '../geometry/model'
import { formatFeetInches, formatMm, sqFt, sqM } from '../geometry/units'
import { bbox, type BBox, type Pt } from '../geometry/vec'
import { archPath, dimGeometry, doorSwing, sliderLeaves, windowLines } from '../render2d/draw'
import { placeLabel } from '../render2d/labels'

export interface PrimPoly {
  t: 'poly'
  layer: string
  rings: Pt[][]
  closed: boolean
  fill?: string
  stroke?: string
  width?: number
  dash?: [number, number]
}

export interface PrimText {
  t: 'text'
  layer: string
  at: Pt
  s: string
  size: number
  anchor: 'start' | 'middle' | 'end'
  colour: string
  rot?: number
  bold?: boolean
}

export type Prim = PrimPoly | PrimText

export interface SheetOptions {
  furniture: boolean
  fixtures: boolean
  dimensions: boolean
  labels: boolean
  roundToInch: boolean
  /** Building fabric only — what the architect wants in CAD. */
  fabricOnly: boolean
}

export const defaultSheetOptions: SheetOptions = {
  furniture: true,
  fixtures: true,
  dimensions: true,
  labels: true,
  roundToInch: false,
  fabricOnly: false,
}

const INK = '#232120'
const GLASS = '#3F7A8C'
const ACCENT = '#2C5C61'
const GREY = '#8B867D'
const TXT2 = '#7B756B'

const ROOM_FILL: Record<string, string> = {
  habitable: '#E9DFCB',
  circulation: '#EFE8DA',
  wet: '#DBDFDB',
  service: '#EBE6DC',
  storage: '#EDE7DA',
  outdoor: '#D5CDBD',
  void: '#E4E2DD',
}

function arcToPoly(op: ReturnType<typeof doorSwing>['arc'], from: Pt, to: Pt, hinge: Pt, r: number): Pt[] {
  void op
  const a0 = Math.atan2(from.y - hinge.y, from.x - hinge.x)
  let a1 = Math.atan2(to.y - hinge.y, to.x - hinge.x)
  while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI
  while (a0 - a1 > Math.PI) a1 += 2 * Math.PI
  const out: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24
    out.push({ x: hinge.x + Math.cos(a) * r, y: hinge.y + Math.sin(a) * r })
  }
  return out
}

export function buildSheet(
  opts: Partial<SheetOptions> = {},
  model: BuiltModel = getModel(),
): { prims: Prim[]; bounds: BBox } {
  const o = { ...defaultSheetOptions, ...opts }
  const p: Prim[] = []
  const ft = (mm: number): string => formatFeetInches(mm, o.roundToInch ? 1 : 16)

  // ---- room floors
  for (const room of model.rooms) {
    p.push({
      t: 'poly',
      layer: room.def.category === 'void' ? 'VOIDS' : 'ROOMS',
      rings: [room.polygon, ...room.holes],
      closed: true,
      fill: ROOM_FILL[room.def.category] ?? '#EFE8DA',
      stroke: room.def.category === 'void' ? '#B8B5AE' : undefined,
      width: 20,
    })
  }

  // ---- glass roofs
  for (const g of building.glassRoofs) {
    p.push({
      t: 'poly',
      layer: 'GLASS-ROOF',
      rings: [
        [
          { x: g.extent[0], y: g.extent[1] },
          { x: g.extent[2], y: g.extent[1] },
          { x: g.extent[2], y: g.extent[3] },
          { x: g.extent[0], y: g.extent[3] },
        ],
      ],
      closed: true,
      stroke: GLASS,
      width: g.kind === 'barrel' ? 40 : 25,
      dash: g.kind === 'barrel' ? undefined : [260, 180],
    })
  }

  // ---- tree cages, which project past the slab edge and carry the foot of the glass
  for (const c of building.cages) {
    p.push({
      t: 'poly',
      layer: 'CAGES',
      rings: [
        [
          { x: c.from, y: c.at - c.projection },
          { x: c.to, y: c.at - c.projection },
          { x: c.to, y: c.at },
          { x: c.from, y: c.at },
        ],
      ],
      closed: true,
      stroke: '#3A4740',
      width: 45,
    })
  }

  // ---- furniture and fixtures
  if (o.fixtures && !o.fabricOnly) {
    for (const f of fixtures) {
      const [w, d] = f.size
      p.push({
        t: 'poly',
        layer: 'FIXTURES',
        rings: [
          [
            { x: f.at.x - w / 2, y: f.at.y - d / 2 },
            { x: f.at.x + w / 2, y: f.at.y - d / 2 },
            { x: f.at.x + w / 2, y: f.at.y + d / 2 },
            { x: f.at.x - w / 2, y: f.at.y + d / 2 },
          ],
        ],
        closed: true,
        fill: '#FCFBF8',
        stroke: '#A79E90',
        width: 30,
      })
    }
  }
  if (o.furniture && !o.fabricOnly) {
    for (const f of furniture) {
      p.push({
        t: 'poly',
        layer: 'FURNITURE',
        rings: [
          [
            { x: f.x, y: f.y },
            { x: f.x + f.w, y: f.y },
            { x: f.x + f.w, y: f.y + f.d },
            { x: f.x, y: f.y + f.d },
          ],
        ],
        closed: true,
        fill: f.kind === 'rug' ? '#EEE4D3' : '#FCFBF8',
        stroke: '#A79E90',
        width: 28,
      })
    }
  }

  // ---- walls
  // Every ring of every polygon in one path, filled even-odd. The union's outer ring is
  // the building perimeter and its holes are the room interiors, so painting the outer
  // ring and then repainting the holes would blank out the rooms and furniture below it.
  p.push({
    t: 'poly',
    layer: 'WALLS',
    rings: model.wallFootprint.flatMap((poly) => poly.map((ring) => ring.map(([x, y]) => ({ x, y })))),
    closed: true,
    fill: INK,
  })

  // ---- openings
  for (const op of model.openings) {
    if (op.type === 'window') {
      for (const [a, b] of windowLines(op)) {
        p.push({ t: 'poly', layer: 'GLAZING', rings: [[a, b]], closed: false, stroke: GLASS, width: 44 })
      }
      continue
    }
    if (op.type === 'door') {
      const sw = doorSwing(op)
      p.push({ t: 'poly', layer: 'DOORS', rings: [[sw.leaf[0], sw.leaf[1]]], closed: false, stroke: INK, width: 46 })
      p.push({
        t: 'poly',
        layer: 'DOORS',
        rings: [arcToPoly(sw.arc, sw.leaf[1], op.hinge === 0 ? op.p2 : op.p1, sw.leaf[0], op.width)],
        closed: false,
        stroke: '#756E64',
        width: 26,
        dash: [110, 80],
      })
      continue
    }
    if (op.type === 'slider') {
      for (const [a, b] of sliderLeaves(op)) {
        p.push({ t: 'poly', layer: 'DOORS', rings: [[a, b]], closed: false, stroke: GLASS, width: 64 })
      }
      continue
    }
    if (op.type === 'arch') {
      const d = archPath(op)
      const pts = d
        .slice(1)
        .split('L')
        .map((s) => {
          const [x, y] = s.split(',').map(Number)
          return { x, y }
        })
      p.push({ t: 'poly', layer: 'DOORS', rings: [pts], closed: false, stroke: ACCENT, width: 42, dash: [140, 110] })
      continue
    }
    const n = { x: -op.dir.y * 95, y: op.dir.x * 95 }
    for (const q of [op.p1, op.p2]) {
      p.push({
        t: 'poly',
        layer: 'DOORS',
        rings: [[{ x: q.x - n.x, y: q.y - n.y }, { x: q.x + n.x, y: q.y + n.y }]],
        closed: false,
        stroke: INK,
        width: 38,
      })
    }
  }

  // ---- curved glass walls
  for (const [id, pts] of model.curves) {
    p.push({ t: 'poly', layer: 'CURVED-GLASS', rings: [pts], closed: false, stroke: GLASS, width: 140 })
    void id
  }
  for (const s of building.screens) {
    const pts: Pt[] = []
    for (let i = 0; i <= 48; i++) {
      const t = i / 48
      const u = 1 - t
      pts.push({
        x: u * u * s.curve.p0.x + 2 * u * t * s.curve.p1.x + t * t * s.curve.p2.x,
        y: u * u * s.curve.p0.y + 2 * u * t * s.curve.p1.y + t * t * s.curve.p2.y,
      })
    }
    p.push({ t: 'poly', layer: 'SCREENS', rings: [pts], closed: false, stroke: GLASS, width: 66, dash: [330, 210] })
  }

  // ---- envelope outline, drawn last so it reads as the cut line
  p.push({ t: 'poly', layer: 'ENVELOPE', rings: [model.envelope], closed: true, stroke: INK, width: 30 })

  // ---- labels
  // Uses the same placement as the screen (rotated in tall rooms, wrapped when long,
  // subtitles dropped when they will not fit), so the print matches what was on screen.
  if (o.labels || o.fabricOnly) {
    for (const room of model.rooms) {
      const lab = placeLabel(room, o.roundToInch ? 1 : 16)
      if (!lab) continue
      // The CAD-fabric export keeps room names for orientation but drops the metrics.
      const lines = o.fabricOnly ? [] : lab.lines
      const rows = lab.name.length + lines.length
      const top = -((rows - 1) * lab.size * 0.6)
      const layer = o.fabricOnly ? 'ROOM-NAMES' : 'LABELS'
      const place = (dy: number, s: string, size: number, colour: string, bold: boolean): void => {
        // Offset along the label's own baseline direction, which rotation flips.
        const at =
          lab.rotation === 0
            ? { x: lab.at.x, y: lab.at.y + dy }
            : { x: lab.at.x + dy, y: lab.at.y }
        p.push({ t: 'text', layer, at, s, size, anchor: 'middle', colour, bold, rot: lab.rotation })
      }
      lab.name.forEach((line, i) => place(top + i * lab.size * 1.06, line, lab.size, '#2A2724', true))
      lines.forEach((line, i) =>
        place(top + (lab.name.length + i * 0.62) * lab.size * 1.06, line, lab.size * 0.56, TXT2, false),
      )
    }
  }

  // ---- dimension chains
  if (o.dimensions && !o.fabricOnly) {
    for (const chain of buildDimensions(model)) {
      for (const seg of chain.segments) {
        const g = dimGeometry(seg.from, seg.to, chain.offset)
        p.push({ t: 'poly', layer: 'DIMS', rings: [[g.a, g.b]], closed: false, stroke: GREY, width: 22 })
        p.push({ t: 'poly', layer: 'DIMS', rings: [g.w1], closed: false, stroke: GREY, width: 16 })
        p.push({ t: 'poly', layer: 'DIMS', rings: [g.w2], closed: false, stroke: GREY, width: 16 })
        p.push({
          t: 'text',
          layer: 'DIMS',
          at: g.mid,
          s: `${seg.label ? `${seg.label}  ` : ''}${formatMm(seg.value).replace(' mm', '')} · ${ft(seg.value)}`,
          size: chain.emphasis ? 260 : 210,
          anchor: 'middle',
          colour: '#5E5951',
          rot: chain.axis === 'y' ? -90 : 0,
        })
      }
    }
  }

  const pts: Pt[] = []
  for (const prim of p) {
    if (prim.t === 'poly') for (const r of prim.rings) pts.push(...r)
    else pts.push(prim.at)
  }
  return { prims: p, bounds: bbox(pts) }
}

/** Title-block text for the sheet exports. */
export function titleBlock(model: BuiltModel = getModel()): string[][] {
  const t = model.totals
  return [
    [building.meta.project, `DWG ${building.meta.drawing}  ·  ${building.meta.revision}`],
    ['Proposed furniture layout plan', building.meta.date],
    [
      `Carpet ${sqFt(t.carpet).toFixed(0)} sq ft (${sqM(t.carpet).toFixed(0)} m²)`,
      `Gross ${sqFt(t.envelope).toFixed(0)} sq ft (${sqM(t.envelope).toFixed(0)} m²)`,
    ],
    [
      `Great room ${sqFt(model.roomById.get('R-GREAT')!.area).toFixed(0)} sq ft`,
      building.meta.scaleNote,
    ],
  ]
}
