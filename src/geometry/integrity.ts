/**
 * Dimensional integrity (brief §2).
 *
 * ONE implementation, used by two consumers: the Vitest suite, which fails the build,
 * and the "Model integrity" panel in the portal, which shows the architect the same
 * numbers rather than just asserting that it all adds up.
 *
 * Every check reports the actual measured value, not just a boolean.
 */

import { fixtures } from '../data/fixtures'
import { building } from '../data/building'
import { reachableFrom, serviceBreaches, serviceRoomIds } from './graph'
import { buildModel, getModel, type BuiltModel } from './model'
import { barrelProfile, buildSolids } from './solid'
import { formatFeetInches, parseFeetInches, sqFt, sqM } from './units'
import { area, dist, pointInPolygon, segIntersect, signedArea, type Poly, type Pt } from './vec'
import polygonClipping from 'polygon-clipping'

const pc = ((polygonClipping as unknown as { default?: typeof polygonClipping }).default ??
  polygonClipping) as typeof polygonClipping

export interface Check {
  id: string
  title: string
  /** What the brief demands, in words the architect can read. */
  requirement: string
  pass: boolean
  /** The measured result, always populated — this is the point of the panel. */
  actual: string
  tolerance?: string
  detail?: string[]
  severity: 'fail' | 'warn'
}

export interface IntegrityReport {
  checks: Check[]
  passed: number
  failed: number
  warnings: number
  generatedFrom: string
}

const mm2ToBoth = (a: number): string => `${sqFt(a).toFixed(1)} sq ft / ${sqM(a).toFixed(2)} m²`

/** Area of a MultiPolygon expressed as [poly][ring][pt][x,y]. */
function multiArea(mp: number[][][][]): number {
  let a = 0
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const r = area(ring.map(([x, y]) => ({ x, y })))
      a += i === 0 ? r : -r
    })
  }
  return a
}

function closeRing(p: Poly): [number, number][] {
  const r: [number, number][] = p.map((q) => [q.x, q.y])
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0])
  return r
}

export function runIntegrity(model: BuiltModel = getModel()): IntegrityReport {
  const checks: Check[] = []
  const add = (c: Check): void => void checks.push(c)

  // ------------------------------------------------------------------ 1. envelope
  {
    const env = model.envelope
    const closed = env.length >= 3
    // Self-intersection: any two non-adjacent edges crossing.
    const crossings: string[] = []
    for (let i = 0; i < env.length; i++) {
      for (let j = i + 1; j < env.length; j++) {
        if (j === i || (j + 1) % env.length === i || (i + 1) % env.length === j) continue
        const hit = segIntersect(
          env[i],
          env[(i + 1) % env.length],
          env[j],
          env[(j + 1) % env.length],
        )
        if (hit) crossings.push(`edges ${i}-${j} at (${hit.point.x.toFixed(0)}, ${hit.point.y.toFixed(0)})`)
      }
    }
    const expected: Pt[] = [
      { x: -600, y: 0 },
      { x: 4530, y: 0 },
      { x: 4530, y: -150 },
      { x: 19950, y: -150 },
      { x: 19950, y: 0 },
      { x: 25080, y: 0 },
      { x: 25080, y: 9695 },
      { x: 18925, y: 9695 },
      { x: 18925, y: 11125 },
      { x: 5555, y: 11125 },
      { x: 5555, y: 9695 },
      { x: -600, y: 9695 },
    ]
    const matches =
      env.length === expected.length && env.every((p, i) => dist(p, expected[i]) < 1e-9)
    add({
      id: 'envelope',
      title: 'Envelope is closed, simple, and matches the stepped outline',
      requirement: 'Closed, non-self-intersecting, equal to the 12-vertex stepped outline of the CAD plan.',
      pass: closed && crossings.length === 0 && matches,
      actual:
        `${env.length} vertices, ${crossings.length} self-intersections, ` +
        `${(model.envelopeBBox.maxX - model.envelopeBBox.minX).toFixed(0)} × ` +
        `${(model.envelopeBBox.maxY - model.envelopeBBox.minY).toFixed(0)} mm, ` +
        `area ${mm2ToBoth(model.envelopeArea)}`,
      detail: crossings.length ? crossings : undefined,
      severity: 'fail',
    })
  }

  // -------------------------------------------------------- 2. area reconciliation
  {
    const t = model.totals
    add({
      id: 'area-reconciliation',
      title: 'Rooms + walls + shafts reconcile to the envelope',
      requirement: 'Σ(room areas) + Σ(wall footprint) + Σ(shaft/core areas) = envelope area, within 0.25 %.',
      pass: t.reconciliationPct <= 0.25,
      actual: `${t.reconciliationPct.toFixed(4)} % (${(t.reconciliationError / 1e6).toFixed(4)} m² out of ${sqM(t.envelope).toFixed(2)} m²)`,
      tolerance: '0.25 %',
      detail: [
        `Rooms (excluding voids):  ${mm2ToBoth(t.rooms)}`,
        `Shafts and cores:         ${mm2ToBoth(t.voids)}`,
        `Wall footprint (union):   ${mm2ToBoth(t.walls)}`,
        `Sum:                      ${mm2ToBoth(t.rooms + t.voids + t.walls)}`,
        `Envelope:                 ${mm2ToBoth(t.envelope)}`,
        `Carpet (habitable etc.):  ${mm2ToBoth(t.carpet)}`,
      ],
      severity: 'fail',
    })
  }

  // ------------------------------------------------------------ 3. no room overlap
  {
    const offenders: string[] = []
    let worst = 0
    for (let i = 0; i < model.rooms.length; i++) {
      for (let j = i + 1; j < model.rooms.length; j++) {
        const a = model.rooms[i]
        const b = model.rooms[j]
        // Cheap reject on bounding boxes before the boolean.
        if (
          a.bbox.maxX < b.bbox.minX ||
          b.bbox.maxX < a.bbox.minX ||
          a.bbox.maxY < b.bbox.minY ||
          b.bbox.maxY < a.bbox.minY
        ) {
          continue
        }
        const inter = pc.intersection([closeRing(a.polygon)], [closeRing(b.polygon)])
        const ov = multiArea(inter as unknown as number[][][][])
        if (ov > worst) worst = ov
        if (ov > 1) offenders.push(`${a.id} ∩ ${b.id} = ${ov.toFixed(2)} mm²`)
      }
    }
    add({
      id: 'room-overlap',
      title: 'No two rooms overlap',
      requirement: 'No pair of room polygons overlaps by more than 1 mm².',
      pass: offenders.length === 0,
      actual: `worst overlap ${worst.toFixed(3)} mm² across ${model.rooms.length} rooms`,
      tolerance: '1 mm²',
      detail: offenders.length ? offenders : undefined,
      severity: 'fail',
    })
  }

  // --------------------------------------------------------------- 4. openings fit
  {
    const problems: string[] = []
    for (const w of model.walls) {
      const ops = [...w.openings].sort((a, b) => a.from - b.from)
      for (const op of ops) {
        if (op.from < -0.5 || op.to > w.length + 0.5) {
          problems.push(
            `${op.id} spans ${op.from.toFixed(1)}–${op.to.toFixed(1)} on ${w.id}, whose run is 0–${w.length.toFixed(1)}`,
          )
        }
      }
      for (let i = 0; i < ops.length - 1; i++) {
        if (ops[i + 1].from < ops[i].to - 0.5) {
          problems.push(`${ops[i].id} and ${ops[i + 1].id} overlap on ${w.id}`)
        }
      }
    }
    add({
      id: 'openings',
      title: 'Every opening sits inside its wall, and none overlap',
      requirement: 'Each opening lies entirely within its parent run; no two openings on one run overlap.',
      pass: problems.length === 0,
      actual: `${model.openings.length} openings across ${model.walls.length} runs, ${problems.length} problems`,
      detail: problems.length ? problems : undefined,
      severity: 'fail',
    })
  }

  // ------------------------------------------------------------- 5. wet-area stacks
  {
    const problems: string[] = []
    const rows: string[] = []
    for (const stack of building.stacks) {
      const group = fixtures.filter((f) => f.stack === stack.id)
      if (stack.capped) {
        rows.push(`${stack.id}: capped, no fixtures — plumbing retained for reversibility`)
        continue
      }
      if (group.length === 0) {
        problems.push(`${stack.id} has no fixtures assigned`)
        continue
      }
      const cx = group.reduce((s, f) => s + f.at.x, 0) / group.length
      const cy = group.reduce((s, f) => s + f.at.y, 0) / group.length
      const d = Math.hypot(cx - stack.at.x, cy - stack.at.y)
      rows.push(
        `${stack.id}: ${group.length} fixtures, centroid (${cx.toFixed(0)}, ${cy.toFixed(0)}), ` +
          `stack (${stack.at.x}, ${stack.at.y}), offset ${d.toFixed(1)} mm`,
      )
      if (d > 300) problems.push(`${stack.id} centroid is ${d.toFixed(1)} mm from the stack`)
      // The stack must also actually be in the room it claims.
      const room = model.roomById.get(stack.room)
      if (!room) problems.push(`${stack.id} references unknown room ${stack.room}`)
      else if (!pointInPolygon(stack.at, room.polygon)) {
        problems.push(`${stack.id} lies outside ${stack.room}`)
      }
    }
    // Fixtures must sit in the room they are assigned to.
    for (const f of fixtures) {
      const room = model.roomById.get(f.room)
      if (!room) problems.push(`Fixture ${f.id} references unknown room ${f.room}`)
      else if (!pointInPolygon(f.at, room.polygon)) {
        problems.push(`Fixture ${f.id} at (${f.at.x}, ${f.at.y}) is outside ${f.room}`)
      }
    }
    add({
      id: 'wet-stacks',
      title: 'Wet fixtures stay on their retained stacks',
      requirement: 'Each wet-area fixture group’s centroid is within 300 mm of its declared retained stack.',
      pass: problems.length === 0,
      actual: `${building.stacks.length} stacks (${building.stacks.filter((s) => s.capped).length} capped), ${fixtures.length} fixtures, ${problems.length} problems`,
      tolerance: '300 mm',
      detail: [
        ...rows,
        'Stack coordinates are derived from the Rev 4 fixture layout, NOT from a site survey.',
        'Confirm riser positions against the sanctioned plumbing drawings before demolition.',
      ],
      severity: 'fail',
    })
  }

  // ------------------------------------------------- 6a. reachable from main entrance
  {
    const start = 'R-ENTRY'
    const res = reachableFrom(model, start)
    add({
      id: 'reach-main',
      title: 'Every room is reachable from the main entrance',
      requirement: 'From F-1402 / the entry gallery, every non-void room is reachable through openings.',
      pass: res.unreachable.length === 0,
      actual: `${res.reached.size} of ${model.rooms.filter((r) => r.def.category !== 'void').length} rooms reached from ${start}`,
      detail: res.unreachable.length
        ? res.unreachable.map((id) => `unreachable: ${id}`)
        : ['Shafts and lift cores are excluded — they are voids, not rooms.'],
      severity: 'fail',
    })
  }

  // --------------------------------------------- 6b. service access off the gallery
  {
    const svc = serviceRoomIds(model)
    const required = ['R-HELP', 'R-STORE', 'R-KITCHEN']
    const res = reachableFrom(model, 'R-ENTRY', { within: new Set([...svc, 'R-ENTRY']) })
    const missing = required.filter((id) => !res.reached.has(id))
    const breaches = serviceBreaches(model)
    add({
      id: 'reach-service',
      title: 'Service rooms hang straight off the entry gallery',
      requirement:
        'Kitchen, help’s room and the store are each reachable from the entry gallery without ' +
        'crossing any living room — the drum’s two service doors are exactly that.',
      pass: missing.length === 0,
      actual:
        `${res.reached.size - 1} service rooms reached from the gallery; ` +
        `${breaches.length} connection${breaches.length === 1 ? '' : 's'} between the service rooms and the rest`,
      detail: [
        ...missing.map((id) => `NOT reachable from the gallery within the service zone: ${id}`),
        ...breaches.map((b) => `${b.openingId}: ${b.a} ↔ ${b.b}`),
        'This home has no sealed staff zone by design — open but close applies to service too.',
      ],
      severity: 'fail',
    })
  }

  // -------------------------------------------------------- 7. unit display round-trip
  {
    const values: number[] = []
    for (const r of model.rooms) values.push(Math.round(r.width), Math.round(r.depth), Math.round(r.perimeter))
    for (const w of model.walls) values.push(Math.round(w.length))
    for (const o of model.openings) values.push(Math.round(o.width))
    values.push(24480, 10850, 8395, 7690, 10480, 3050, 2100, 900, 2300)

    let worst = 0
    let worstAt = 0
    for (const v of values) {
      if (v <= 0) continue
      const back = parseFeetInches(formatFeetInches(v, 16))
      const err = Math.abs(back - v)
      if (err > worst) {
        worst = err
        worstAt = v
      }
    }
    // Also quantify the nearest-inch rounding used on the Rev 4 sheet, so the architect
    // knows why every dimension is shown in millimetres alongside.
    let worstInch = 0
    for (const v of values) {
      if (v <= 0) continue
      worstInch = Math.max(worstInch, Math.abs(parseFeetInches(formatFeetInches(v, 1)) - v))
    }
    add({
      id: 'unit-roundtrip',
      title: 'Feet-inches round-trips back to millimetres',
      requirement: 'mm → ft-in string → mm is within 1 mm for every dimension displayed.',
      pass: worst < 1,
      actual: `worst error ${worst.toFixed(3)} mm at ${worstAt} mm, across ${values.length} dimensions (display precision 1/16")`,
      tolerance: '1 mm',
      detail: [
        `At 1/16" precision:      worst ${worst.toFixed(3)} mm — this is what the portal displays.`,
        `At nearest-inch:         worst ${worstInch.toFixed(2)} mm — the Rev 4 sheet convention, which cannot meet 1 mm.`,
        'This is why every dimension in the portal carries millimetres as well as feet-inches.',
      ],
      severity: 'fail',
    })
  }

  // ------------------------------------------------------------ 8. 3D bounds == 2D
  {
    const solids = buildSolids(model)
    const b3 = solids.bounds
    const b2 = model.envelopeBBox
    const errs = [
      Math.abs(b3.minX - b2.minX),
      Math.abs(b3.minY - b2.minY),
      Math.abs(b3.maxX - b2.maxX),
      Math.abs(b3.maxY - b2.maxY),
    ]
    const worst = Math.max(...errs)
    add({
      id: 'bounds-3d',
      title: '3D bounding box equals the 2D envelope',
      requirement: 'The 3D scene’s computed plan bounding box equals the 2D envelope bounds within 1 mm.',
      pass: worst < 1,
      actual:
        `3D (${b3.minX.toFixed(2)}, ${b3.minY.toFixed(2)}) – (${b3.maxX.toFixed(2)}, ${b3.maxY.toFixed(2)}) ` +
        `vs 2D (${b2.minX}, ${b2.minY}) – (${b2.maxX}, ${b2.maxY}); worst ${worst.toFixed(4)} mm`,
      tolerance: '1 mm',
      detail: [
        `${solids.prisms.length} prisms, ${solids.slabs.length} slabs, ${solids.roofs.length} roof surfaces`,
        'Covers the built fabric — walls, glazing and floors. The deck canopy deliberately',
        'oversails the building line by about 690 mm as it bulges out, so roof surfaces are',
        'excluded from this comparison rather than being made to fit it.',
      ],
      severity: 'fail',
    })
  }

  // ------------------------------------------ 9. every face is a room, and vice versa
  {
    add({
      id: 'faces-claimed',
      title: 'Every enclosed space is a named room',
      requirement: 'The wall subdivision produces no face that no room claims — no leftover slivers.',
      pass: model.unclaimedFaces.length === 0,
      actual: `${model.faces.length} faces, ${model.rooms.length} rooms, ${model.unclaimedFaces.length} unclaimed`,
      detail: model.unclaimedFaces.map(
        (f) =>
          `unclaimed face ${f.index}: ${mm2ToBoth(f.centrelineArea)} near (${f.outer[0].x.toFixed(0)}, ${f.outer[0].y.toFixed(0)})`,
      ),
      severity: 'fail',
    })
  }

  // ------------------------------------------------------- 10. curved wall integrity
  {
    const problems: string[] = []
    const p = building.walls.find((w) => w.id === 'W-CURVE-PARENTS')!.points!
    const k = building.walls.find((w) => w.id === 'W-CURVE-KARAN')!.points!
    // Both screens bow AWAY from the great room: the family pod's curve runs
    // west of its deck-edge start, the den's east of its.
    if (Math.min(...p.map((q) => q.x)) >= p[0].x)
      problems.push('Family pod screen does not bow away from the great room')
    if (Math.max(...k.map((q) => q.x)) <= k[0].x)
      problems.push('Den pod screen does not bow away from the great room')

    const great = model.roomById.get('R-GREAT')!
    const widthAtDeck = k[0].x - p[0].x
    const widthAtBack = Math.max(...k.map((q) => q.x)) - Math.min(...p.map((q) => q.x))
    if (Math.abs(widthAtDeck - 6250) > 1)
      problems.push(`Great room is ${widthAtDeck} mm at the deck, expected 6250`)
    if (Math.abs(widthAtBack - 7280) > 1)
      problems.push(`Great room is ${widthAtBack} mm at the pods, expected 7280`)

    add({
      id: 'curved-walls',
      title: 'Curved pod screens bow away from the great room',
      requirement:
        'Both pod screens are sampled from the CAD béziers and bow into the pods, giving the great ' +
        'room 6250 mm at the deck glass and 7280 mm between the pods.',
      pass: problems.length === 0,
      actual:
        `great room ${widthAtDeck} → ${widthAtBack} mm wide, gross ${mm2ToBoth(great.grossArea)}, ` +
        `${p.length + k.length} sampled screen vertices`,
      detail: problems.length ? problems : ['Screen polylines exported at t-steps of 1/200.'],
      severity: 'fail',
    })
  }

  // ------------------------------------------- 11. published areas (advisory, not fatal)
  {
    const rows: string[] = []
    let worstPct = 0
    for (const r of model.rooms) {
      if (r.def.publishedSqFt == null) continue
      const gross = sqFt(r.grossArea)
      const carpet = sqFt(r.area)
      const pct = ((gross - r.def.publishedSqFt) / r.def.publishedSqFt) * 100
      worstPct = Math.max(worstPct, Math.abs(pct))
      rows.push(
        `${r.name}: published ${r.def.publishedSqFt}, centreline gross ${gross.toFixed(1)} ` +
          `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %), carpet ${carpet.toFixed(1)} sq ft`,
      )
    }
    add({
      id: 'published-areas',
      title: 'Derived areas versus the Rev 4 published schedule',
      requirement:
        'Advisory. Rev 4 publishes areas measured to zone extents; the portal derives carpet area ' +
        'inside the wall faces. Both are shown so the difference is visible rather than hidden.',
      pass: worstPct < 30,
      actual: `largest divergence ${worstPct.toFixed(1)} % between published and centreline-gross`,
      detail: rows,
      severity: 'warn',
    })
  }

  // --------------------------------------------------- 12. mirror symmetry of the wings
  {
    // The wings mirror in fabric. The pods are excluded: the den carries the east
    // service duct as a notch and its portal sits lower on the curve, both deliberate.
    const pairs: Array<[string, string]> = [
      ['R-P-SUITE', 'R-K-SUITE'],
      ['R-P-BATH', 'R-K-BATH'],
      ['R-P-DRESSING', 'R-K-DRESSING'],
      ['R-SHAFT-W', 'R-SHAFT-E'],
      ['R-VOID-W', 'R-VOID-E'],
      ['R-P-TERRACE', 'R-K-TERRACE'],
    ]
    const rows: string[] = []
    let worstArea = 0
    let worstCentroid = 0
    for (const [a, b] of pairs) {
      const ra = model.roomById.get(a)!
      const rb = model.roomById.get(b)!
      const dA = Math.abs(ra.area - rb.area)
      // The mirror of ra's centroid about x = 12240 should land on rb's.
      const dC = Math.hypot(2 * 12240 - ra.centroid.x - rb.centroid.x, ra.centroid.y - rb.centroid.y)
      worstArea = Math.max(worstArea, dA)
      worstCentroid = Math.max(worstCentroid, dC)
      if (dA > 5000 || dC > 1) {
        rows.push(
          `${a} vs ${b}: areas ${sqFt(ra.area).toFixed(2)} / ${sqFt(rb.area).toFixed(2)} sq ft, ` +
            `mirrored centroid off by ${dC.toFixed(2)} mm`,
        )
      }
    }
    add({
      id: 'mirror',
      title: 'The two wings mirror about x = 12 240',
      requirement:
        'Mirror-paired rooms match in area to 0.005 m² and in mirrored centroid to 1 mm.',
      pass: rows.length === 0,
      actual: `worst area difference ${(worstArea / 1e6).toFixed(6)} m², worst centroid offset ${worstCentroid.toFixed(3)} mm, across ${pairs.length} pairs`,
      tolerance: '0.005 m² / 1 mm',
      detail: rows.length ? rows : undefined,
      severity: 'fail',
    })
  }

  // ---------------------------------------- 12b. the asymmetry that IS in the plan
  {
    const fam = model.roomById.get('R-P-FAMILY')!
    const den = model.roomById.get('R-K-DEN')!
    add({
      id: 'east-bay-asymmetry',
      title: 'Known asymmetries, all deliberate',
      requirement:
        'Advisory. Recorded so nobody mistakes them for modelling errors and "fixes" them on site.',
      pass: true,
      actual: `family ${sqFt(fam.area).toFixed(1)} sq ft vs den ${sqFt(den.area).toFixed(1)} sq ft`,
      detail: [
        `The den gives up ${sqFt(fam.area - den.area).toFixed(1)} sq ft to the east service duct — the family room has no such notch.`,
        'The pod portals sit at different heights on their curves: the den’s is pinned by Karan’s work console, the family room’s moved south so the parents land at the dining table.',
        'The kitchen bay and the entry drum are south-bay features with no mirror counterparts.',
      ],
      severity: 'warn',
    })
  }

  // ------------------------------------- 13. no two boundaries authored on the same line
  {
    const great = model.roomById.get('R-GREAT')!
    const positive = model.rooms.every((r) => r.area > 0 && Number.isFinite(r.area))
    const wound = model.rooms.every((r) => Math.abs(signedArea(r.polygon)) > 0)
    add({
      id: 'polygons-valid',
      title: 'Every derived room polygon is valid',
      requirement: 'Positive finite area, non-degenerate winding, at least three vertices.',
      pass: positive && wound && model.rooms.every((r) => r.polygon.length >= 3),
      actual: `${model.rooms.length} polygons, smallest ${mm2ToBoth(Math.min(...model.rooms.map((r) => r.area)))}, great room ${mm2ToBoth(great.area)}`,
      severity: 'fail',
    })
  }

  // ------------------------------- 14. every wall we deleted is enclosed by something
  {
    // Deleting a stretch of external wall and glazing it is only safe if something
    // actually closes the hole. A run with `pane: false` has no upright glass, so the
    // canopy has to do it: either it passes over that line and comes down to floor level
    // outboard of it, or a gable end of it stands on the line. This check is what stops
    // "remove that wall" from quietly leaving the building open to the weather.
    //
    // Note the enclosure line is no longer the building line. The canopies come down on
    // the outer face of the tree cages, so the glazed runs sit UNDER the glass rather
    // than beneath its springing, and the cage-to-canopy agreement is checked too.
    const problems: string[] = []
    const rows: string[] = []
    const barrels = building.glassRoofs.filter((r) => r.kind === 'barrel' && r.section)
    const ceiling = building.levels.ceiling
    const TOL = 1

    /** Plan y range the canopy actually covers, from the same profile the renderer uses. */
    const profileOf = (r: (typeof barrels)[number]) => {
      const sec = r.section!
      const prof = barrelProfile(sec, 400)
      return {
        lo: Math.min(...prof.map((q) => q.x)),
        hi: Math.max(...prof.map((q) => q.x)),
        springsAt: sec.p0.x,
        springHeight: sec.p0.y,
        lands: sec.p2.y,
      }
    }

    for (const g of building.envelopeGlazing ?? []) {
      const horizontal = Math.abs(g.p1.y - g.p2.y) < TOL
      const a = horizontal ? Math.min(g.p1.x, g.p2.x) : Math.min(g.p1.y, g.p2.y)
      const b = horizontal ? Math.max(g.p1.x, g.p2.x) : Math.max(g.p1.y, g.p2.y)
      if (g.pane !== false) {
        rows.push(`${g.id}: upright glazed pane, floor to ${ceiling} mm`)
        continue
      }
      let by = ''
      for (const r of barrels) {
        const pr = profileOf(r)
        const [x0, , x1] = r.extent
        if (
          horizontal &&
          pr.springHeight < TOL &&
          pr.springsAt <= g.p1.y + TOL &&
          pr.hi >= g.p1.y - TOL &&
          x0 - TOL <= a &&
          x1 + TOL >= b
        ) {
          const out = g.p1.y - pr.springsAt
          by =
            `${r.id} passes over this line and comes down to floor level ` +
            `${out.toFixed(0)} mm outboard of it, landing at ${pr.lands} mm`
          break
        }
        const gables = r.gableEnds ?? []
        const atGable =
          (gables.includes('x0') && Math.abs(x0 - g.p1.x) < TOL) ||
          (gables.includes('x1') && Math.abs(x1 - g.p1.x) < TOL)
        if (!horizontal && atGable && pr.lo - TOL <= a && pr.hi + TOL >= b) {
          by = `${r.id} closes this return with a glazed gable spanning y ${pr.lo.toFixed(0)}–${pr.hi.toFixed(0)}`
          break
        }
      }
      if (by) rows.push(`${g.id}: ${by}`)
      else problems.push(`${g.id} has no upright pane and no canopy over it — the envelope is open here`)
    }

    // A canopy that is also the wall has to meet the wall head, or there is a slot of
    // daylight where the two are supposed to merge. And it has to come down ON its cage:
    // the cage is the footing, so if the two drift the glass lands on nothing.
    const landings: string[] = []
    for (const r of barrels) {
      const lands = r.section!.p2.y
      landings.push(`${r.id} lands at ${lands} mm (wall head ${ceiling} mm)`)
      if (Math.abs(lands - ceiling) > TOL) {
        problems.push(`${r.id} lands at ${lands} mm, ${(lands - ceiling).toFixed(0)} mm off the wall head`)
      }

      const foot = r.section!.p0.x
      const cage = building.cages.find(
        (c) => c.from <= r.extent[0] + TOL && c.to >= r.extent[2] - TOL,
      )
      if (!cage) {
        problems.push(`${r.id} has no tree cage under its full length to come down on`)
      } else {
        const outer = cage.at - cage.projection
        landings.push(
          `${r.id} comes down at y ${foot} on ${cage.id}, whose outer face is at ${outer}`,
        )
        if (Math.abs(outer - foot) > TOL) {
          problems.push(
            `${r.id} comes down at y ${foot} but ${cage.id}'s outer face is at ${outer} — ` +
              `${Math.abs(outer - foot).toFixed(0)} mm apart`,
          )
        }
      }
    }

    add({
      id: 'envelope-enclosed',
      title: 'Every deleted stretch of external wall is enclosed by glass',
      requirement:
        'Each glazed envelope run either carries an upright pane, or is covered by a canopy ' +
        'that comes down to floor level outboard of it, or is closed by that canopy\u2019s gable. ' +
        'Every canopy meets the wall head, and comes down exactly on its tree cage.',
      pass: problems.length === 0,
      actual:
        `${(building.envelopeGlazing ?? []).length} glazed runs, ` +
        `${(building.envelopeGlazing ?? []).filter((g) => g.pane === false).length} with no upright pane, ` +
        `${barrels.length} canopies, ${building.cages.length} cages, ${problems.length} problems`,
      tolerance: '1 mm',
      detail: [...rows, ...landings, ...problems],
      severity: 'fail',
    })
  }

  const failed = checks.filter((c) => !c.pass && c.severity === 'fail').length
  const warnings = checks.filter((c) => !c.pass && c.severity === 'warn').length
  return {
    checks,
    passed: checks.filter((c) => c.pass).length,
    failed,
    warnings,
    generatedFrom: `${building.meta.drawing} ${building.meta.revision}`,
  }
}

/** Rebuild from scratch, used by tests that need a clean model. */
export const freshModel = (): BuiltModel => buildModel(building)
