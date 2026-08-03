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
| `PROP-SCREEN` | the entry gallery U — 230, built on the two columns, and the curved door on its axis |
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

The end is a **true semicircle**. The sag equals the half-span, 1725, which
puts the centre on the line of the column tops — and two things follow, which
are the whole reason for it. The tangent at the springing is **vertical**, so
the arc leaves the column parallel to it: no radial cut against a flat leg top,
no notch, nothing to patch. And the crown lands **1040 north of the service
bay**, so the gallery ends in an apse you read from inside the great room.

That is the second attempt. The first was a segmental arch, which springs where
the columns actually stop but leaves its pier at 47° off vertical against a
flat leg top — a notch outside, an overhang inside, and a springer block at
each end to fill it. Moving the crown north instead of shortening the arc gets
the same "springs off the column" and loses the notch. The springer blocks are
still in the code for a shallower arch, but they draw nothing here: on a
semicircle they collapse to a 4° patch, and with the 800 ahead of each column
now a doorway, a patch there would be a fragment of wall standing in it.

The apse breaks through the service-bay north wall, so that wall stops on each
side of it and the apse's own curved wall is the boundary between.

**3220 wide × 3260 deep. 9.4 m², 101 sq ft.**

**Four ways in, and none of them is through a leg** — you cannot put a door
through a 230 × 1800 structural column, so both legs stay solid. One is in the
arch, two are in the 800 ahead of each column, and one is in the entrance wall.

| | width | opening |
|---|---|---|
| entrance wall | 1050 | the front door, from the lift lobby |
| ahead of the west column | 800 | gallery → kitchen, for staff |
| arch, crown | 1050 | gallery → great room |
| ahead of the east column | 800 | gallery → help's room, for staff |

The two service doors are **not set out by eye**. Once the apse pushes north,
the only stretch with the kitchen behind it is the **800 between the column top
and the great-room wall**; north of that the arch faces the great room, and a
door there opens into the wrong room. So each service door takes that whole 800
— jambed by the column below and the wall above — and what is left of the arch
is two **1400 piers** flanking the 1050 door on the axis.

**They are hinged, glass, and they swing into the gallery.** Sliding was tried
three ways and none of them pays:

| | clear opening |
|---|---|
| curved leaf on the arch's 1725 radius | 776, but it can only slide on the face of the arch and stand proud of it |
| pocket inside the 800, single leaf | 400 — the pocket eats half the run |
| pocket inside the 800, three-panel telescopic | ~550, on specialist track |
| pocket carried over the column | 800, but the leg goes 230 → 320 and the gallery loses 180 of width |
| **hinged** | **~730, and the leg stays 230** |

A pocket needs a cavity at least as long as the leaf and in line with it, and
that 800 has nothing beyond either end — the great room north, a structural
column south. On a serving door the width wins, and hinges are ordinary
ironmongery on a door used twenty times a day.

They swing **into the gallery**, which is 3220 × 3260 of circulation with
nothing in it; the swing is clear through its full quarter. The far side is the
kitchen's approach to its counter end and help's room's landing, where a leaf
standing open would cost something. And coming out of the kitchen with your
hands full you push.

The **door on the axis** keeps its curved leaf, drawn shut on the arch's own
1725 radius — it is 1050 wide in a curved wall, so a hinge is out and it slides
on the face of the arc.

The corners the arch leaves behind it stay open to the kitchen and to help's
room through the builder's own **800 clear above each column** — floor in those
rooms, not waste.

The apse cost the kitchen its run-B counter length: run B stops at 9550 instead
of 10350, because a deep apse hugs the columns and the door beside the column
had 165 of clear approach. It now has 850, and the sink moves west with the
counter, still at its east end.

At 230 the U is masonry, not the wood screen it started as — that follows from
asking it to match the column. Finish it in wood if you want the same effect.

---

## Room schedule

| | m² | sq ft |
|---|---|---|
| GREAT ROOM | 41.4 | 445 |
| ALL-WEATHER DECK (net of the two voids) | 35.8 | 385 |
| MASTER SUITE — parents | 35.0 | 377 |
| MASTER SUITE — karan | 35.0 | 377 |
| FAMILY ROOM | 20.2 | 218 |
| MUSIC + WORK DEN | 20.2 | 218 |
| KITCHEN (one room with the utility) | 10.5 | 113 |
| ENTRY GALLERY | 9.4 | 101 |
| PARENTS' BATH | 4.4 | 48 |
| KARAN'S BATH | 4.4 | 48 |
| HELP'S ROOM | 4.4 | 47 |
| TERRACE ×2 | 3.7 each | 40 each |
| GUEST / SERVICE WC | 3.0 | 33 |
| STORE | 2.4 | 26 |
| **total of named rooms** | **233.6** | **2514** |

The great room is 445 sq ft against A-101's 474, and reads 6250 across the
removed party wall at the deck, 8220 at the waist and 7280 at the pods — the
pod glazing is a cubic now, not an arc. It gives 2.1 m² back to the entry
gallery's apse, which projects into it.

---

## The guest WC is an arch too

The north-east corner of the service bay had to hold three things: a staff
bunk room reached from the entry gallery, a guest WC reached from the great
room, and the store. Three straight walls could not do it. The great room only
reaches **15880** on the service-bay wall — east of that the pod glazing lands
and it is the den — so the WC's door width and help's room's width came out of
the same run of wall, one for one. A 600 door left help's room 920, which is a
berth with no floor for a cupboard.

So the WC's wall is a **quarter ellipse**, struck from the corner at
(17430, 8525), semi-axes **2430 and 1675**. It springs off the great-room wall
at 15000 and dies into the east wall at 10200. Help's room and the store wrap
round the outside of it.

An ellipse and not a circle because the two walls it has to reach are not the
same distance away. A circle is tangent to both only as a quarter round, and a
quarter round springing west of 15880 would run the full 2450 depth of the bay.
The ellipse reaches west without reaching south — which is the shape of the
problem.

| | before | after |
|---|---|---|
| HELP'S ROOM | 2.3 m² / 25 sq ft | **4.4 / 47** |
| GUEST / SERVICE WC | 5.7 / 61 | **3.0 / 33** |
| STORE | 1.8 / 19 | **2.4 / 26** |

It also buys the door: **880** of great-room wall in front of the WC instead of
600, so that door is a proper **800**.

**The doors.** The WC has two — 800 off the great room, and a 776 off help's
room, curved on the apse and drawn shut like the gallery's. Help's room has
the gallery's service door and the one into the WC; it has **no door on to the
great room** any more. The store is entered from help's room through a 700
opening hard against the apse, which is where a staff store should be entered
from rather than through the guest WC as it was.

**The great-room door swings OUT.** It is the only door on the sheet drawn with
its leaf and swing, because it is the only one where the direction changes
anything: there is no floor inside the apse to give a leaf, and the point of
the door is to step in, wash your hands and step out.

**The basin is a curved console** struck off the same ellipse, offset inwards,
so it sits on the wall for its whole **1015** rather than touching it at one
point. It grows out of the wall and dies back into it — a **120 ledge** at the
door jamb, **400** deep at the bowl. At full depth from the springing it would
leave only 425 of the 800 door to walk through; as a ledge it leaves **645**.
A 344 bowl is set into it, and the tap has to be **wall-mounted**: there is 38
behind the rim, and deepening the console to take a deck tap would cut the
basin's activity space below the minimum.

**Space check**, measured off the geometry rather than estimated:

| | provided | minimum in general use |
|---|---|---|
| shower enclosure | 900 × 750 | 750 × 750 |
| drying space in front of it | 1380 | 700 |
| pan — space in front | 905 | 600 |
| pan — width across it | 750 (375 each side) | 750 |
| basin — space in front | 755 | 700 |
| door — clear walk-through | 645 | 600 |
| largest free circle on the floor | 1000 | — |

It clears throughout, with the pan's width and the door the tightest of them.
**It is not an accessible WC** — a wheelchair turning circle is 1500 and this
is 1000. Nothing asked for it; it is a limit of the space, stated so nobody
discovers it later. Confirm the figures above against the local code.

**Help's room** is 4.4 m². The bunk lies **along the south wall** rather than
standing against the west one: stood on end, the gap between its head and the
apse was 96, because the apse leaves its springing vertically and hugs 15000
for the first half metre. Lying down it leaves the whole northern 1550 clear
and 755 past its foot to the store door. Cupboard on the west wall.

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
* **the mandir** in the parents' pod — a corner unit with an arched front,
  flush into the corner between the retained void's back wall and the pod
  glazing. That corner is **40.5°, not 90°** (the glazing leaves it heading
  south-west), so the unit is a wedge, which is what a shrine wants: the idol
  stands deep in it and you see it through the arch, and the point behind is
  the back of the niche rather than dead worktop. 1200 legs on each wall,
  arched front on a 1021 chord bulging 200 into the pod, and a **480 × 340**
  idol platform on the axis — 20 off the glass, 73 off the void wall, 130 clear
  in front. **0.64 m² / 6.9 sq ft**, against 0.24–0.54 for a normal counter
  mandir
* **the coffee / pantry** in Karan's pod — a straight run, the exact length of
  the void's back wall and flush with it. It is a **trapezoid, not a
  rectangle**: 1615 along the back but only **1051 along the front**, because
  the glazing leans away, so full 600 depth starts 563 in. The fittings are set
  out off *that* line and not off the back wall's length — setting out off the
  1615 is what left the old L-shaped version with 300-wide stretches. Sink 400,
  one machine 320, **400 of clear landing** between them, and the tapering end
  at the glass left as an open shelf. **0.78 m² / 8.4 sq ft**
  · 1051 is inside the 900–1200 usually wanted for a beverage point, but it
  will not also take a 500 landing; that wants 1220
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
* **help's room, the guest WC and the store** — re-cut round the WC's elliptical
  apse. Help's room 4.4 m², WC 3.0, store 2.4; see the section above
* all A-101 furniture — resolved, two pieces moved (see above)
* **the dining table** — a round 1400 seating six, in the parents' pod at the
  serving hatch, centred (7180, 6950). It fits because the pod glazing became a
  cubic S: 2895–3053 clear for the 2900 circle, 812 from the table edge to the
  hatch counter
* **the kitchen and the utility are one space** — the wall between them is
  removed in full, so the builder's dry balcony reads as the kitchen's utility
  end. The kitchen is 10.5 m² / 113 sq ft
* internal walls — the flats came as bare shell, so there is nothing to
  demolish and no question about which existing walls are load-bearing. The
  only fabric that has to stay is the shell, and none of the layout touches it.
* **openings** — there is no longer any such thing here as an opening cut in
  existing masonry, so the `PROP-OPEN` layer is gone. Every opening is a gap
  left in a new wall and lives with that wall, which is the only way the two
  can't disagree. Three walls that the old opening markers implied but that
  were never actually drawn are now in: the 125 line between each suite and
  its pod (with the 1050 slider as a gap in it), and the service-bay north
  wall, in two runs either side of the gallery's apse (with the 1100 serving
  hatch into the parents' pod and the guest WC's 800 door as the gaps in it).
* **the gallery's four openings** — 1050 on the axis to the great room, 1050
  south for the front door, and an 800 each side ahead of the column, west to
  the kitchen and east to help's room. The two service doors are hinged glass
  swinging into the gallery; the one on the axis is a curved slider
* **the gallery corners** — the corners the apse leaves behind it are open to
  the kitchen and to help's room through the builder's own 800 clear above each
  column, so they are floor in those rooms rather than waste

## Open for the next round

* the furniture, room by room, added back on purpose rather than inherited
* the two pods' furniture beyond the dining table and the corner units

## Still to be confirmed, not by me

* **Deck loading** — the spa, the two grass beds, the fountain and the
  retractable glass roof, all on a 15 420 × 2620 deck along the building edge.
* **How the glass roofs land** — the retractable roof over the deck and the
  high roof over the two terraces.

Neither is a layout question, and neither blocks the next round.
