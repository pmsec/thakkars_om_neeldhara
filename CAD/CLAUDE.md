# CAD — working agreement

## Scope

**This repo now holds MORE THAN ONE HOME.** The machinery in `tools/` is
shared; each building lives in `homes/<id>/`:

```
tools/                 shared: symbols, draw_design, verify, clash, build_dxf
homes/om-neeldhara/    design.py · retrofit.py · immovables.py · home.json · golden.json
homes/ekta/            imported from a DWG: source/ · import.py · design.py · immovables.py
homes/<new-home>/      the same shape
```

Every tool takes `--home <id>` and defaults to `om-neeldhara`, so every
command in this file still behaves exactly as it always did.

### THE PRIME DIRECTIVE — an existing home never changes

Work on one home must not alter another home's output, ever. Before touching
anything shared, and again afterwards:

```
python3 tools/golden.py                  # must end "GOLDEN OK"
python3 tools/golden.py --home <other>   # for each other home
```

`golden.json` in each home records the hash of everything it generates. A
`CHANGED!!` line for a design nobody edited is a bug in the refactor, never
an acceptable diff. Only run `--update` when a change to that home is
*intended and reviewed*.

Home-specific things live in the home, not the tools: the plan (`design.py`),
its bespoke generators (`retrofit.py`), its columns/beams/shafts and raster
window (`immovables.py`), and its name, source drawing and output paths
(`home.json`). `om-neeldhara` writes to `CAD/drawings` and `CAD/out` as it
always has — new homes write under `homes/<id>/` so two homes can never
overwrite each other.

### Importing a home from a DWG

Om Neeldhara was written; Ekta's flat was read. The chain is:

```
dwg2dxf <file>.dwg                LibreDWG, straight to DXF
tools/extract_dwg.py              flatten block inserts through their matrices
tools/import_shell.py             pair the two DRAWN FACES of each wall -> centreline
homes/<id>/import.py              make it a plan: square, grid, merge, connect
tools/draw_home.py --home <id>    the sheet
tools/export_app.py --home <id>   the web app's building.ts / fixtures.ts / furniture.ts
```

`import.py` is the honest place for every judgement the import needs, and it
says why each one exists. The builder draws faces, not centrelines; he draws
13 mm off square; he breaks every wall at a door jamb and stops it at the
plaster line. None of that matters on paper and all of it matters to a planar
subdivision, which is how the app DERIVES rooms from walls. Until somebody
starts designing the flat by hand, `import.py` is the source and `design.py`
is its output — re-runnable, and the record of what was assumed.

What is NOT imported yet: doors. The builder's door arcs are on their own
layer and have not been read, so every room comes through sealed.

Everything for this work lives in `CAD/`. **Do not touch any other file in the
repo.** Branch: `claude/cad-apartment-merge-miwnpm`.

## The loop — preview first, ship on the word

This is the agreed flow. Follow it for every change that moves geometry.

1. **Karan says what to change.**
2. **Edit, render, verify.** Edit `homes/<id>/design.py` (or whichever source
   the change belongs in), run `draw_design.py` for the PNG, and `verify.py`.
   Verify stays in the loop even in preview — it is fast and it is the one
   thing that proves no column, beam, duct or void has been broken. Never show
   a render of something structurally impossible.
3. **Show a zoomed crop of just the area that changed.** Add the full sheet
   only when the change is plan-wide. Crops are how flaws get caught; the full
   sheet hides them.
4. **Wait.** Karan says *ship it* / *change this* / *try it the other way*.
5. **On "ship it"**: run `build_dxf.py`, commit, push.

**Between rounds the DXF in the repo is stale** — it is the last shipped
version, not what is in the preview. Say so when it matters.

Nothing is committed while iterating, and this container is ephemeral. If a
round ends unresolved, drop a WIP commit.

### Exceptions — just do the whole thing

Anything that does not move geometry: colour, a label, a layer name, a legend
line, a note in the docs. The DXF rebuild costs nothing there and a round trip
is pure friction.

### When a decision is open

For a choice that could go several ways (the entry gallery went round three
times), render **two or three options as crops in one message** and let Karan
pick. Cheaper than converging one guess at a time.

## Why the loop is shaped this way

The PNG is *generated from* `design.py`. There is no throwaway sketch layer —
to show a render, the real edit has to happen first. So the "quick fix" and
the "real change" are the same step, and what gets approved is exactly what
ships. What is genuinely separable is the slow tail: `build_dxf.py` re-reads
and rewrites the builder's whole 2.9 MB drawing.

```
edit design.py ─┬─► draw_design.py ─► drawings/07-round1-layout.png   fast
                ├─► verify.py      ─► the clash checks                fast
                └─► build_dxf.py   ─► out/round1-layout.dxf           slow
```

## Commands

```
cd CAD/tools
gunzip -kf ../source/floor14.dxf.gz   # working copy, gitignored
python3 verify.py                     # must end "ALL CHECKS PASS"
python3 draw_design.py                # PNG + SVG
python3 golden.py                     # must end "GOLDEN OK"
python3 build_dxf.py                  # only on "ship it"
```

Add `--home <id>` to any of them to work on another home; with no flag they
all operate on `om-neeldhara`.

## How to quote a measurement — always both units

**Every number Karan is given carries metric first and imperial in brackets
after it. No exceptions, anywhere in chat.** The drawing and the source stay
metric; this is about how the numbers are *said*.

```
lengths   350 mm (1'-2")            2321 mm (7'-7")        2.6 m (8'-6")
areas     11.7 m² (126 sq ft)       2.65 m² (28.5 sq ft)
```

Round the imperial to the nearest inch for lengths and to whole square feet for
areas — it is there to be read, not to be built from. Metric is the number that
governs.

This applies to prose, tables, bullet lists and captions alike. A table column
headed `mm` still needs its sq ft / feet column beside it.

## Standing facts

* The flats came from the builder as **bare shell — no internal walls**. Every
  wall is new; every opening is a gap left in a wall, never a hole cut in
  something existing.
* Immovable: columns, beams, the outer walls, and all eight shafts, ducts and
  voids. `clash.py` holds the list and it is not negotiable.
* The society has agreed the lift lobby can be absorbed. Do not re-litigate.
* PNG renders are Karan's working view. The DXF is for the architect, who will
  toggle layers.
* The web app reads `CAD/drawings/07-round1-layout.svg` at runtime for its
  "Fetch latest plan" button. That path is Home 1's and must not move.
* Dimensions carry **no typed text** — every one is computed from its two
  points so the label and the geometry cannot disagree.
