# CAD — working agreement

## Scope

Everything for this work lives in `CAD/`. **Do not touch any other file in the
repo.** Branch: `claude/cad-apartment-merge-miwnpm`.

## The loop — preview first, ship on the word

This is the agreed flow. Follow it for every change that moves geometry.

1. **Karan says what to change.**
2. **Edit, render, verify.** Edit `tools/design.py` (or whichever source the
   change belongs in), run `draw_design.py` for the PNG, and run `verify.py`.
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
python3 build_dxf.py                  # only on "ship it"
```

## Standing facts

* The flats came from the builder as **bare shell — no internal walls**. Every
  wall is new; every opening is a gap left in a wall, never a hole cut in
  something existing.
* Immovable: columns, beams, the outer walls, and all eight shafts, ducts and
  voids. `clash.py` holds the list and it is not negotiable.
* The society has agreed the lift lobby can be absorbed. Do not re-litigate.
* PNG renders are Karan's working view. The DXF is for the architect, who will
  toggle layers.
* Dimensions carry **no typed text** — every one is computed from its two
  points so the label and the geometry cannot disagree.
