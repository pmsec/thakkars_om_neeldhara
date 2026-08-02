# Round 1 — the layout set out on the builder's shell

**Drawing:** `out/round1-layout.dxf` — the builder's own DXF with the proposal
added on `PROP-*` layers.
**Review image:** `drawings/07-round1-layout.png`.

Freeze the `PROP-*` layers and you have the builder's drawing back, unchanged:
all 15 original modelspace entities, all 351 blocks and all 32 layers are
preserved untouched.

| Layer | What's on it |
|---|---|
| `PROP-SHELL` | the existing shell — external walls, shaft and duct enclosures, beams, parapets, chajjas |
| `PROP-WALL-NEW` | new masonry, solid-hatched |
| `PROP-KEEP` | shafts, ducts and voids that must stay clear |
| `PROP-GLAZ` | glazing, sliding glass, the pod portals |
| `PROP-FURN` | fixed joinery and the layout |
| `PROP-TEXT` | room names, areas, and the layer-state notes |
| `PROP-DIM` | the set-out dimensions |
| `PROP-REF-CORE` | the lift lobby, lifts and fire lift beyond the flat |

## Layer states

The developer's file is built from **nested blocks whose references sit on
content layers** — both unit blocks sit on `DA_WALL`, and the block holding 31
of the 43 columns sits on layer `0`. In CAD, switching off a block reference's
layer hides the whole block. So `DA_WALL` off would take the shell, the beams
and the parapets with it, and `0` off would take most of the columns.

Everything that has to survive that switch is therefore copied on to
`PROP-SHELL`. Nothing of the developer's is moved, edited or deleted.

**To see the design only — turn OFF:**

```
DA_WALL              DA_TEXT IN SQ.FT      DA_DIMENSION
DA_DOOR              DA_TEXT 2             -CG-P-DIM
DA_WINDOW            DA_Text 1             DA_GUIDE LINE
DA_FURNITURE         DA_TEXT               DA_DRG BORDER
DA_FURNITURE HIDDEN  DA_LABL               boundary
DA_DOTTED LINES      DA_CARPET AREA RERA   DA_COLUMN HATCH
DA_ELEVATION FEATURE DA_HATCH              DA_ALUMINIUM
DA_LINE              DA_SUNK HATCH
```

Leave **`0`**, **`DA_COLUMN`** and **`DA_BUILDING LINE`** ON — the columns and
the slab edge live inside blocks that sit on those layers. Verified: this
leaves 14 columns, the slab edge and every `PROP-*` layer visible in the home,
and nothing else.

**To see the developer's drawing only** — turn OFF every `PROP-*` layer.
Verified: zero proposal entities visible, their sheet back exactly as issued.

**To compare** — the developer state, plus `PROP-WALL-NEW` and `PROP-TEXT`
switched back on. Their layout underneath, yours over it.

The same three notes are written on the drawing itself, on `PROP-TEXT`, to the
left of the title. Most CAD apps will save them as Layer States so you can
flip between them.

---

## Verification

`python3 tools/verify.py` runs the same audit that found the problems in A-101,
against this layout. All checks pass:

* no floor drawn anywhere the builder has no slab — **0.000 m² residual**
* every shaft, duct and void — **0.000 m² built over**, all eight
* the four columns that A-101 lost off the end of the plan are back inside it
* five columns are now fully absorbed in masonry; the rest appear as **piers**
  projecting 80–110 mm into a room, which is what they are

---

## The four moves that make it fit

**1. The envelope grows to the real one.** 25 680 long and 11 375 deep instead
of 24 720 × 11 090. Every bay is set out from the builder's own dimension
chains. The deck is 15 420, not 15 020, and its set-out is 3050 + 1535 + 3050
per half with a 150 party wall at the centre.

**2. The baths leave the service bay.** A-101 put them at X 4730–6830 and
17 650–19 750, which is almost entirely the 1000 × 4950 open service duct.
They move into the wing strips, at the south end, **against** that duct — which
is what it is for: the builder's own `M.TOILET 02` and `COMMON TOILET`
ventilate into it through windows. Each bath is now 1530 × 2895 (48 sq ft,
against the builder's own 40 sq ft) with a real openable window.

**3. The suite becomes one L-shaped room.** The wall between the suite and the
wing strip comes out for the northern 5300, so the brief's "one room ·
cupboards + dressing + terrace" reads properly. **377 sq ft each**, with a
2895-long bath off the south end.

**4. The service bay keeps only what physically fits between the two ducts.**
Kitchen on its existing stack (3350 × 2450), entry hall between the two lobby
columns, help's room + WC in the mirrored bay. Laundry and store go into the
two dry balconies, which is what the builder built them as.

The entry gallery is re-centred on the home's centreline at X 12240 and sits
inside the 3220 clear between the lobby columns.

**5. The gallery is drawn to the structure, not dropped into it.** A 2450
drum standing free in the 3220 × 2600 pocket left 3.06 m² of dead corner, and
there is no way to reach that corner: the builder's two **230 × 1800 columns**
stand between the pocket and the rooms either side and leave only **800 clear
at the north end of each**. So the circle is set out to the full 3220 between
those two columns and cut off by the service-bay north wall above and the
entrance wall below.

What is left is two arcs, each landing on a wall at **both** ends — on the
column at the top and on the entrance wall at the bottom. Nothing floats.
Nothing is left over except two small solid fillets behind the arcs, 0.22 m²
each, which are masonry. The room is **6.9 m² (74 sq ft), 2920 across** — both
bigger and rounder than the drum was, and honestly measured.

Four ways out, all of them gaps in a wall that continues either side: 900 north
to the great room, 1050 south for the front door, and the two 800 slots north
of the columns, west to the kitchen and east to help's room. Those two are the
only openings the structure allows, and they were always there — they are the
builder's own gaps.

---

## Room schedule

| | m² | sq ft |
|---|---|---|
| GREAT ROOM | 45.1 | 485 |
| ALL-WEATHER DECK (net of the two voids) | 35.8 | 385 |
| MASTER SUITE — parents | 35.0 | 377 |
| MASTER SUITE — karan | 35.0 | 377 |
| FAMILY ROOM | 19.4 | 209 |
| MUSIC + WORK DEN | 19.4 | 209 |
| KITCHEN | 8.2 | 88 |
| ENTRY GALLERY | 6.9 | 74 |
| HELP'S ROOM | 5.1 | 55 |
| PARENTS' BATH | 4.4 | 48 |
| KARAN'S BATH | 4.4 | 48 |
| TERRACE ×2 | 3.7 each | 40 each |
| GUEST / SERVICE WC | 2.8 | 30 |
| UTILITY | 1.9 | 20 |
| STORE | 1.8 | 19 |
| **total of named rooms** | **232.6** | **2504** |

The great room is 485 sq ft against A-101's 474, and 7840 across the removed
party wall rather than 7690.

---

## Calls I made — overrule any of them

**The lobby is enclosed to Y 11 125**, the line of the building's own outer
wall, which gives a 3220 × 2600 pocket between the two columns. The lift
lobby, the lift and the fire lift beyond it are drawn on the sheet for
reference, boxed and labelled as common. Extending the flat to the lift doors would add about 4.9 m² and is a
one-line change — say the word.

**One front door, not two.** The service door I had put in the entrance wall
west of the main one is out: the 1800 column means it could only ever have
opened into the gallery, a few steps from the main door, so it was a second
front door and nothing more. Service access is through the gallery and the 800
slot into the kitchen. Say the word if you want a separate one — it would have
to go in the kitchen's own south wall, on to the lift landing.

**There is nothing to demolish.** You took the flats as bare shell, so every
wall in the layout is new. What is drawn as existing is only the shell — on
`PROP-SHELL` — the external walls and the enclosures round the shafts, ducts
and voids, which have to be there because those are open holes in the slab,
plus the beams, parapets and chajjas.

**Dimensions carry no typed text.** Every one is computed from its two points,
which sit on the developer's own set-out lines, so the label and the geometry
cannot disagree. The deck reads 3050 + 1535 + 6250 + 1535 + 3050 = 15 420 —
the developer's chain, with the two middle bays continuous because there is no
party wall.

**The recovered 960 × 275 mm** went to the master suites and the great room
along the length, and to the service bay in depth.

**The columns** are buried in walls where they land conveniently and left as
piers where they don't. The two end-wall piers in each suite (Y 1950–3150 and
7745–8945) are well placed to flank a bed or a wardrobe run.

**The pods lose their inner corner** to the service duct — 1000 × 2225 out of
21 m². I've walled it off and made the resulting face the media wall, with
dining in the clear northern half and a pair of chairs in the southern half.

**The furniture is stripped back to what is fixed, plumbed or built in.** The
loose pieces inherited from A-101 were landing in odd places once the rooms
changed shape, so they are out and will go back in deliberately.

Kept — 31 pieces, the ones that prove the plan works:

* kitchen — run, sink, hatch shelf, island, hob, chimney over, tall fridge
* utility — stacked washer and dryer
* both master baths — vanity, basin, WC, curved glass shower
* guest / service WC — shower, WC, basin
* both master beds, and the bunk in help's room
* the mandir in the parents' pod and the coffee / pantry in Karan's, both as
  corner units behind the retained deck void: one leg 1200 along the void's
  back wall, the other 1200 following the pod glazing, 600 deep throughout
* deck — the two grass beds, the strength trainer, the spa, the fountain and
  the parapet planter
* the dining table, in the great room beside the serving hatch

Removed — 65 pieces, including A-101's L-shaped curved-glass changing screen
in each suite: every side table, all the sofas, recliners and armchairs,
the rugs, the murphy nook, all the wardrobe, cupboard, hanging-run and
dressing-console joinery in both suites, the entry gallery's curved console and
bench and its two joinery runs, the mirrors, the wardrobe at the foot of the
bunk, the utility and store racks, the wall TV, the pantry counter and its two
the drum kit, the terrace chairs, tables, drying racks and planters, and the
plants. A-101's pantry counter is back, as the corner unit in Karan's pod.

The dining table's move still stands and is worth keeping in mind: A-101 puts
it in the parents' pod at (6420, 6900), which is now the service duct, and the
pod's remaining half is 2350 wide against the 2520 the table and six chairs
need. Beside the serving hatch it is also next to the kitchen.

---

## Settled in this round

* entry hall size — kept as drawn, with the lift lobby now shown for reference
* baths — left as they are
* help's room and WC — left where they are
* all A-101 furniture — resolved, two pieces moved (see above)
* internal walls — the flats came as bare shell, so there is nothing to
  demolish and no question about which existing walls are load-bearing. The
  only fabric that has to stay is the shell, and none of the layout touches it.
* **openings** — there is no longer any such thing here as an opening cut in
  existing masonry, so the `PROP-OPEN` layer is gone. Every opening is a gap
  left in a new wall and lives with that wall, which is the only way the two
  can't disagree. Three walls that the old opening markers implied but that
  were never actually drawn are now in: the 125 line between each suite and
  its pod (with the 1050 slider as a gap in it), and the service-bay north
  wall from the kitchen's west wall to the WC's east wall (with the 1200
  serving hatch and the gallery's north portal as gaps in it).
* the gallery's four openings — 900 north to the great room, 1050 south for
  the front door, and the builder's own 800 slots north of each column, west to
  the kitchen and east to help's room
* **the gallery corners** — they cannot become floor in the kitchen or help's
  room, because a 230 × 1800 column stands in the way of each. Drawing the
  circle to the full 3220 removes them instead: there is no dead corner left,
  only two 0.22 m² solid fillets.

## Open for the next round

* the furniture, room by room, added back on purpose rather than inherited
* the dining table's home, if the great room is not where you want it

## Still to be confirmed, not by me

* **Deck loading** — the spa, the two grass beds, the fountain and the
  retractable glass roof, all on a 15 420 × 2620 deck along the building edge.
* **How the glass roofs land** — the retractable roof over the deck and the
  high roof over the two terraces.

Neither is a layout question, and neither blocks the next round.
