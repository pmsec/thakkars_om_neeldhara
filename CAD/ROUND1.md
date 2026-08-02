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
| `PROP-SCREEN` | the entry gallery U — 230, built on the two columns, and its three curved doors |
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
* the shell is only what is genuinely built: `keep_demo()` keeps a builder wall
  only where it runs **along** a shell edge — the slab line or a side of a
  shaft — plus 260 for the corner return. Being merely near one is not enough,
  or a never-built partition that passes the corner of a duct gets drawn as
  existing fabric

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
Kitchen on its existing stack, entry hall between the two lobby columns,
help's room + WC in the mirrored bay. The two dry balconies become the
kitchen's utility end and the store, which is what the builder built them as —
and the wall between kitchen and utility comes out, so they are one room.

The entry gallery is re-centred on the home's centreline at X 12240 and sits
inside the 3220 clear between the lobby columns.

**5. The entry gallery is a U built on the two columns.** A circle standing
free in the pocket made little sense with the builder's two **230 × 1800
columns** in the middle of it. The U uses them: its two legs sit **exactly on
the columns**, at the same 230, so column and wall read as one continuous
piece rather than a thin thing stuck beside a thick one.

The curve is a **segmental arch**, springing off the top corner of each column
and rising to meet the great-room wall at the crown. A semicircle cannot do
that — tangent to the legs it has to spring half the span below the crown,
which is 800 south of where the columns stop, and the wedge between column and
curve is the gap. A segmental arch springs where the columns actually end.

A segmental arch leaves its pier at **47° off vertical**, and its end is cut
radially — square to the arc, not square to the leg. Those two faces cannot
meet, which leaves a notch outside and an overhang inside. A **springer block**
at each end fills it, its outer edge following the arc's own face rather than
cutting the corner with a chord. That is the piece a mason would cut, and it
is why the U now reads as one unbroken line.

**3220 wide × 2450 deep — the whole pocket. 6.7 m², 72 sq ft.**

**Four ways in, and three of them are in the arch** — because the arch is the
only part of the U that is not a column. You cannot put a door through a
230 × 1800 column, so both legs stay solid.

| | width | opening |
|---|---|---|
| entrance wall | 1050 | the front door, from the lift lobby |
| arch, west | 700 | gallery → kitchen, for staff |
| arch, crown | 1050 | gallery → great room |
| arch, east | 700 | gallery → help's room, for staff |

The arch is 3864 of arc and 2450 of that is opening, so what is left is **four
piers of 351**, set out evenly rather than left to fall where they may. On
their own they read as fragments — so each door is drawn **shut, with a leaf
curved on the arch's own 2370 radius**. Closed, the sweep runs unbroken from
leg to leg and the piers read as the frames the doors hang in.

For the joinery: a leaf curved to that radius **cannot swing** — the far edge
would drive into the wall — so these are **curved sliders on a track**. No
swing is drawn, deliberately. And a 700 leaf cannot pocket into a 351 pier, so
each has to slide across the face of the arch and sit proud on one side.

The two corners the arch leaves behind it stay open to the kitchen and to
help's room through the builder's own **800 clear above each column** — floor
in those rooms, not waste:

| | rectangle | now |
|---|---|---|
| KITCHEN | 8.2 m² / 88 sq ft | **8.7 / 94**, and 10.9 / 118 with the utility |
| HELP'S ROOM | 5.1 / 55 | **5.5 / 60** |

Both also have their own **900 door off the great room** in the service-bay
north wall, so neither depends on the gallery to be reached.

At 230 the U is masonry, not the wood screen it started as — that follows from
asking it to match the column. Finish it in wood if you want the same effect.

---

## Room schedule

| | m² | sq ft |
|---|---|---|
| GREAT ROOM | 43.4 | 468 |
| ALL-WEATHER DECK (net of the two voids) | 35.8 | 385 |
| MASTER SUITE — parents | 35.0 | 377 |
| MASTER SUITE — karan | 35.0 | 377 |
| FAMILY ROOM | 20.2 | 218 |
| MUSIC + WORK DEN | 20.2 | 218 |
| KITCHEN (one room with the utility) | 10.9 | 118 |
| ENTRY GALLERY | 6.7 | 72 |
| HELP'S ROOM | 5.5 | 60 |
| PARENTS' BATH | 4.4 | 48 |
| KARAN'S BATH | 4.4 | 48 |
| TERRACE ×2 | 3.7 each | 40 each |
| GUEST / SERVICE WC | 2.8 | 30 |
| STORE | 1.8 | 19 |
| **total of named rooms** | **233.7** | **2516** |

The great room is 468 sq ft against A-101's 474, and reads 6250 across the
removed party wall at the deck, 8220 at the waist and 7280 at the pods — the
pod glazing is a cubic now, not an arc.

---

## The pod glazing is an S

The tinted glass between the great room and each pod used to be a single bow.
A single bow can only go one way: every millimetre of width the great room
gained came out of the pod at exactly the depth the dining table wants. Pushed
far enough to be worth having, it shoved the table 3.4 m off the serving hatch,
which stops it being a serving hatch.

A cubic decouples the two ends. Control points, west side — the east is the
mirror:

```
(9115, 2620)  (6800, 4600)  (9400, 6400)  (8600, 8400)
```

It waists **into** the pod to X 8130 at Y 4500, where the pod has nothing but
circulation, and swells back to X 8758 at Y 7600, where the table sits. The
great room gets its width in the middle and the pod keeps its width at the
hatch.

Great room 39.9 → **43.4 m² (429 → 468 sq ft)** with the table still at the
hatch: centre (7180, 6950), 2895–3053 clear for the 2900 circle, 812 from the
table edge to the hatch counter.

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
front door and nothing more. The kitchen now has its own 900 door off the
great room, so service access does not depend on it. Say the word if you want
a separate one — it would go in the kitchen's own south wall, on to the lift
landing.

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

* **kitchen — one room with the utility, 10.9 m² / 118 sq ft.** The wall
  between them is gone, so the builder's dry balcony is simply its utility end.
  Three runs, all 600 deep, all with their corners eased:
  * **run B** along the north wall, X 6900–10350, sink at the east end, and a
    **full bullnose** on that end — you walk straight into it coming through
    the west arch door
  * **the hob run**, X 8200–9400, dead centre on the window, hob only with the
    integrated dishwasher under it, 400 clear to the fridge and 400 to the
    appliance corner
  * **the appliance corner**, X 9800–10400, flush with the west gallery
    column — microwave, air fryer and toaster, coffee and soda maker
  * the fridge sits between the fridge-side gap and the hob run, X 7000–7800,
    flush with the wall and clear of the window
  * the utility end: washer and dryer stacked flush with the outer wall,
    laundry basket and bin flush with the wall opposite
* the **serving hatch** is at the west end of run B, X 6900–8000, so it opens
  into the parents' pod — ready for the dining table to move there
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
* **the kitchen and the utility are one space** — the wall between them is
  removed in full, so the builder's dry balcony reads as the kitchen's utility
  end. The kitchen is 9.1 m² / 98 sq ft
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
* **the gallery corners** — the drum is a thin wood screen with nothing
  walling it off, so the space either side is simply kitchen and help's room
  floor. The two 1800 columns remain as piers, with a 385 niche behind each.

## Open for the next round

* the furniture, room by room, added back on purpose rather than inherited
* the dining table's home. Measured for the parents' pod, which is 2295 clear
  at the kitchen wall: a round 1400 is 600 short and a 1300 square 500 short,
  but a banquette on the duct wall with an 800 table seats six with 295 spare

## Still to be confirmed, not by me

* **Deck loading** — the spa, the two grass beds, the fountain and the
  retractable glass roof, all on a 15 420 × 2620 deck along the building edge.
* **How the glass roofs land** — the retractable roof over the deck and the
  high roof over the two terraces.

Neither is a layout question, and neither blocks the next round.
