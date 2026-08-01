# Full-Floor Residence — project portal

An inspectable 2D floor plan and a 3D model of the same house, both driven by **one
dimensionally-exact geometry source**, for DWG A-101 Rev 4.

Two mirror-image 2BHK flats on one floor of a Mumbai building, merged into a single home.
The portal exists so an architect can open it, measure anything, see that the numbers
reconcile, and hand it to contractors.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the dimensional-integrity suite
npm run verify     # tests + typecheck, what CI should run
npm run build      # -> dist/index.html, a single self-contained file
```

`npm run build` produces **one HTML file** with the JavaScript, the CSS and the builder's
sanctioned plan all inlined. Double-click it. No server, no dev environment, no network —
it runs from `file://`, which is how it gets handed over.

---

## The rule that everything else follows

**There is one source of truth and it is `src/data/building.ts`.**

Every length in the model is an integer number of millimetres. Feet-inches, square feet
and square metres are derived at display time and are never stored or round-tripped
through.

**Rooms are not drawn.** A room record carries a name, a category, a finish and a single
anchor point. It carries no shape. Shapes are computed:

1. Wall centrelines — including the two curved glass pod walls, flattened from their
   Bézier definitions — go into a planar subdivision (`src/geometry/planar.ts`). Every
   crossing is split, a half-edge graph is walked to find the faces the walls enclose,
   and holes are attached to the face containing them.
2. Each face is carved by the union of the wall footprints (`src/geometry/model.ts`).
   That is the same thing as insetting every edge by half its wall's thickness, done as a
   boolean so it stays well-behaved at awkward corners.
3. A room claims the face its anchor lands in. If two rooms claim one face, or a face
   goes unclaimed, the build fails.

So a room's area is a consequence of the walls around it, not a number someone typed.

---

## How to change a wall and have everything follow

Everything downstream is derived, so you only ever edit `src/data/building.ts`. What you
do **not** get is mind-reading about topology: if a wall you move is the one four other
walls die on, you have to move those too. The suite's job is to make that impossible to
get wrong silently, and it names each problem in turn. Both examples below were run.

### Example 1 — thicken every internal wall

Genuinely a one-line change, because it alters no topology. In `src/data/building.ts`:

```ts
const T_INT = 200   // was 150
```

```bash
npm test
```

Everything moves, and the suite stays green:

| | before | after |
|---|---|---|
| Carpet total | 1790.2 sq ft | 1753.6 sq ft |
| Wall footprint | 321.5 sq ft | 361.5 sq ft |
| Parents' bath | 33.9 sq ft | 31.9 sq ft |
| Great room | 563.8 sq ft | 557.8 sq ft |
| Reconciliation | 0.00000 % | 0.00000 % |

Nothing else was touched. The room polygons, both schedules, the wall poly, the 3D
prisms, the floor slabs, the room labels (which re-fit to the smaller rooms), and the PDF,
SVG and DXF exports all followed.

### Example 2 — widen the parents' bathroom by 200 mm

This one moves a wall, so it touches topology. Start by moving just the obvious wall,
`W-P-POD-W`, from x 4730 to x 4930, and run `npm test`:

```
Error: Rooms R-P-DRESSING and R-P-BATH both claim face 16
```

The bath, dressing and wardrobe walls all terminate on `W-P-POD-W`. Leaving them at 4730
left them 200 mm short, the faces they used to separate merged, and two rooms tried to
claim one face. Move the boundaries that land on that line too — `W-P-BATH-N`,
`W-P-BATH-S`, `W-P-WARD-N`, `W-P-POD-MID`, the glazing screen `G-FAMILY-DECK`, and the
shaft edge `V-SHAFT-W-2` — and run again:

```
Error: Opening GZ-01 (0..3665) falls outside run G-FAMILY-DECK (0..3465.0)
```

The glazing screen got 200 mm shorter but its opening still spans the old length. Change
it to `at: [0, 3465]` and run again. Now the model builds, and the suite reports the
consequences:

| | before | after |
|---|---|---|
| Parents' bath | 33.9 sq ft (1380 wide) | 38.8 sq ft (1580 wide) |
| Parents' dressing | 11.4 sq ft | 13.1 sq ft |
| Parents' wardrobe | 33.6 sq ft | 38.5 sq ft |
| Family room | 74.2 sq ft | 69.5 sq ft |
| Parents' pod hall | 86.5 sq ft | 79.3 sq ft |
| Reconciliation | 0.00000 % | 0.00000 % |

and one check fails, correctly:

```
mirror: The two wings mirror about x = 12 240
  R-P-BATH vs R-K-BATH: areas 38.78 / 33.87 sq ft, mirrored centroid off by 100.00 mm
  R-P-DRESSING vs R-K-DRESSING: ...
  R-P-FAMILY vs R-K-DEN: ...
```

Karan's side needs the same move. Nothing let you ship half of it.

### What the suite is watching for

- **Area reconciliation** — rooms + walls + shafts must still equal the envelope to within
  0.25 %. It currently reconciles to 0.0000 %.
- **Wet stacks** — move a bathroom far enough and its fixture group's centroid drifts more
  than 300 mm from the retained riser, and the build fails. You cannot quietly move a
  bathroom off its plumbing.
- **Reachability** — close a doorway and the suite names the room that is now cut off,
  from the main entrance or from the service entrance.
- **Face coverage** — a leftover sliver that no room claims is a failure, not a rounding
  detail.

### Then look at it

`npm run dev`, then the **Model integrity** tab. Every check shows its measured number,
not just a tick.

---

## Layout

```
src/
  data/                    AUTHORED. Millimetres. Nothing derived.
    building.ts            envelope, wall schedule, curves, openings, rooms, stacks, roofs
    fixtures.ts            sanitaryware and fitted joinery — building fabric
    furniture.ts           loose furniture — its own layer, excluded from every check
    schema.ts              types for the above

  geometry/                DERIVED. Framework-free: no React, no Three.js, no DOM.
    units.ts               mm <-> ft-in <-> sq ft / m², all display-time
    vec.ts                 2D primitives
    bezier.ts              the curved pod walls and the day-bed screen
    planar.ts              planar subdivision: split, walk faces, inset
    model.ts               assembles everything into the BuiltModel
    solid.ts               the same walls extruded into 3D, as plain data
    graph.ts               circulation graph and reachability
    dimensions.ts          dimension chains, by wall id — never by coordinate
    integrity.ts           the checks, shared by the test suite and the UI

  render2d/                SVG plan viewer
  render3d/                Three.js viewer + NOAA solar position
  export/                  sheet description -> PDF / SVG / DXF / PNG / CSV
  ui/                      shell, panels, schedules, brief, integrity page
  tests/                   Vitest

docs/
  floor-plan-source.py     the Python program that generated Rev 4 — the geometry came
                           from reading this, not from tracing the images
  floor-plan-A101-rev4.png the Rev 4 render, for comparison
```

`src/geometry/` imports nothing from a framework or a renderer, so it can be pointed at an
IFC or DXF writer later without touching anything else. The 3D viewer is a translation
layer over `solid.ts`; there is not a single coordinate literal in either renderer.

---

## The integrity suite

`npm test` — 15 checks, all currently green.

| Check | What it proves |
|---|---|
| `envelope` | Closed, non-self-intersecting, matches the stepped outline |
| `area-reconciliation` | rooms + walls + shafts = envelope, within 0.25 % (actual: 0.0000 %) |
| `room-overlap` | No pair of rooms overlaps by more than 1 mm² |
| `openings` | Every opening lies inside its run; no two overlap on one run |
| `wet-stacks` | Every wet fixture group's centroid within 300 mm of its retained stack |
| `reach-main` | All 26 non-void rooms reachable from the main entrance |
| `reach-service` | Service zone reachable from F-1401 without entering the house, and joined to it by exactly one internal door |
| `unit-roundtrip` | mm → ft-in → mm within 1 mm (actual worst: 0.788 mm) |
| `bounds-3d` | 3D scene bounds equal the 2D envelope within 1 mm (actual: 0.0000 mm) |
| `faces-claimed` | Every enclosed space is a named room — no leftover slivers |
| `curved-walls` | Pods bow away from the great room; 7690 → 10480 mm |
| `mirror` | Mirror pairs match in area and in mirrored centroid |
| `polygons-valid` | Every derived polygon is finite, positive and non-degenerate |
| `published-areas` | *Advisory.* Derived vs Rev 4's published figures |
| `east-bay-asymmetry` | *Advisory.* Records an asymmetry that is real, so nobody "fixes" it |

### On feet-inches

The Rev 4 sheet rounds to the nearest whole inch. A whole inch is 25.4 mm, so a
nearest-inch string can be 12.7 mm out and **cannot** meet the brief's 1 mm round-trip
requirement. The portal therefore displays to the nearest 1/16", whose worst case is
0.794 mm. `27'-6"` still prints as `27'-6"` when the value really is exact to the inch.
There is a toggle for whole-inch display when you want to match the sheet; every dimension
carries millimetres alongside either way.

---

## Assumptions, and where to correct them

Recorded here and on the **Brief & constraints** page rather than buried.

- **North is not settled.** The Rev 4 sheet's north arrow points along the model's +x
  axis; the source script's header comment says north is −y. The 3D view exposes north as
  a setting, defaulting to the sheet. **The sun-path study is only as correct as that
  setting.**
- **Stack positions are Rev 4 derived, not surveyed.** They make the wet-area check a real
  regression guard, but confirm risers against the sanctioned plumbing drawings before
  demolition.
- **Glazed screens to the deck are zero-thickness in plan.** Frame depth is a glazing
  contractor's dimension and has not been invented. They get a nominal 20 mm pane in 3D
  for visibility only, and take no part in any area.
- **Shaft edges are zero-thickness boundaries.** The sanctioned plan shows no wall on
  those four lines, so none was added.
- **Carpet is measured inside the wall faces**; Rev 4's published figures are measured to
  zone extents, so they read higher. Both are shown side by side.
- **Doorway thresholds count as wall footprint** — the convention that makes the
  reconciliation exact.
- **The deck's outer wall has been deleted and glazed instead.** Rev 4 drew the external
  wall continuously around the outline, including the full north face in front of the deck,
  with no opening in it — a blank 3050 mm wall between the deck and the view. On the
  client's instruction that stretch is now floor-to-canopy structural glazing on the
  building line, continuous with the barrel vault. The deck's derived carpet area moved
  from 338.4 to 377.2 sq ft, against Rev 4's published 378, which only reconciles with the
  wall gone. **The two private terraces have had the same treatment**, on both exposed
  edges since each is a corner; their carpet went from 25.0 to 35.3 sq ft each. They are not
  under the vault, so their glass runs floor to ceiling and they stay open to the sky.

## Two things in Rev 4 worth a second look

Neither is a modelling error; both are in the drawing as issued.

- Karan's pod hall is published at 96 sq ft, the same as the parents'. That figure is
  taken **before** the gear store is subtracted from it.
- The east bay spans x 3200–18600, whose midpoint is 10900, while the wings mirror about
  12240. Rooms touching the south edge genuinely differ between the wings.

## Open constraints

- The **retractable glass roof over the deck** needs society NOC and most likely BMC
  permission. It is the highest-risk element in the design — resolve it early.
- Specify **laminated acoustic glass** for it. Single glazing will not stop road noise.
- **Verify the structural columns** at the merged-wall junctions on site before anything
  is demolished.
- Two ex-toilets become walk-in wardrobes with **plumbing capped, not removed**, so the
  change stays reversible.
