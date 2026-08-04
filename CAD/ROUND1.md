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
ventilate into it through windows. Each bath is now **1930 clear × 3520 at its
deepest** (69 sq ft, against the builder's own 40) with a real openable window,
and its north side is an arch rather than a wall — see *The master baths are
arches too*, below.

**3. The suite becomes one L-shaped room.** The wall between the suite and the
wing strip comes out for the northern 5300, so the brief's "one room ·
cupboards + dressing + terrace" reads properly. **350 sq ft each**, with the
bath off the south end behind an arched wall.

**And the wall between each bed and its pod comes out too**, replaced by a
sliding glass partition. What is left as wall is the 1420 at the north end —
nearly all of it the builder's column — and the 475 at the south. Between them,
**3555 of opening, Y 2620 to 6175, in two interlocking leaves of 1778.** One
leaf would need 3555 of parking and the deck is 2620 deep; two leaves stacked
take 1778, which fits.

Two things about it are forced rather than chosen:

* The panels run on the **pod face** of the wall line, X 4540–4600, not on its
  centreline. A builder column **230 × 1200 at X 4300–4530 / Y 1200–2400** sits
  square on the route north, and only a track east of 4530 gets past it. Ten
  millimetres of clearance, and the panels read flush with the wall's own east
  face at 4529.
* So they park **on the deck**, X 4540–4600 / **Y 842–2620** — beside the gym on
  the parents' side, behind the spa on Karan's. A straight track has to stay in
  line with its opening; reaching the 2040 between the gym and the void would
  need an L-track slide-and-stack, and the turn would land on the grass.

They stop as soon as they are clear of the opening — leading edge **flush with
the pod's north face at 2620** — rather than running on to the parapet. They
only have to get out of the way, and the deck beyond them is deck, not a garage.

The deck's south glazing therefore starts at 4650 instead of 4530, so the panels
have a slot to pass through.

The drawing shows **both states on purpose**: the parents' pair shut, closing
the bed off from the pod, with the parked position dashed on the deck; Karan's
pair open and stacked on the deck, with the shut position dashed across the
opening. Between the two halves the plan explains itself.

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
| GREAT ROOM | 37.8 | 407 |
| ALL-WEATHER DECK (net of the two voids) | 35.8 | 385 |
| MASTER SUITE — parents | 32.5 | 350 |
| MASTER SUITE — karan | 32.5 | 350 |
| FAMILY ROOM | 21.3 | 230 |
| MUSIC + WORK DEN | 21.3 | 230 |
| KITCHEN (one room with the utility) | 11.7 | 126 |
| ENTRY GALLERY | 9.4 | 101 |
| PARENTS' BATH | 6.5 | 69 |
| KARAN'S BATH | 6.5 | 69 |
| HELP'S ROOM | 4.4 | 47 |
| TERRACE ×2 | 3.7 each | 40 each |
| GUEST / SERVICE WC | 3.0 | 33 |
| STORE | 2.4 | 26 |
| **total of named rooms** | **232.6** | **2504** |

The great room is 407 sq ft against A-101's 474, and reads 6250 across the
removed party wall at the deck, 7280 at the waist and 7280 at the pods — the
pod glazing turns once at the top and then runs straight. It gives 2.1 m² back
to the entry gallery's apse and another 1.6 to the kitchen's bump, both of
which project into it.

---

## The master baths are arches

The bath used to be a rectangle in the corner of the wing strip: 1518 clear ×
2820, north wall straight across, west wall straight down. At that width it
could not carry a fitting on both long walls — a 550 vanity opposite a 600 pan
left **350 between their fronts**, against the 600 you want in front of a pan.
It was the one genuinely bad room on the drawing.

Karan drew the fix: a single curve springing off the pod partition, cresting
inside the suite, and turning down to become the bath's own west wall. The bath
takes the ground it needs from the suite, and the suite gets a curved wall
instead of a corner.

### The set-out

Two quadrants meeting at the crown with a shared horizontal tangent, so the
join does not read. A single ellipse cannot do it — the crown is 1240 in from
one end and only 690 from the other, and one ellipse cannot put its widest
point off-centre like that.

| | |
|---|---|
| east flank | ellipse, semi-axes 1550 × 1500, leaving the pod wall at about 52° |
| west flank | quarter circle, radius 765, turning the sweep vertical |
| crown | X 3165, Y 5950 on the centreline — 700 further into the suite than the old wall |
| meets the pod wall at | Y 6550 on the centreline; the band spans 6432–6678 |
| thickness | 150 throughout, offset along the curve's own normal |

That last row is why the sweep needed its own machinery. The circular-arc code
that draws the entry gallery cannot express an ellipse, so the faces are struck
by offsetting the centreline along its own normal (`retrofit.mb_pt`), the same
method the guest WC's apse uses.

**It clears the sliding partition.** The suite-to-pod sliders close over Y
2620–6175. The sweep's outer face reaches the pod wall at 6432, so **257 of the
partition is left as the slider's south jamb** — a jamb, not a collision.

### What the room does now

| | mm | ft |
|---|---|---|
| clear width at the shower | 1930 | 6'-4" |
| deepest, crown to the south wall | 3520 | 11'-7" |
| clear floor, net of every fitting | 3.25 m² | 35 sq ft |
| **largest circle that fits on the clear floor** | **1300** | **4'-3"** |
| door, clear | 800 | 2'-7" |
| in front of the pan | 1330 | 4'-4" |
| pan to the shower screen | 355 | 1'-2" |
| console front to the pan | 653 | 2'-2" |
| walk-in shower | 1850 × 950 | 6'-1" × 3'-1" |

**A correction on that last figure.** When the arch was first drawn I reported
1500, and said it met the wheelchair turning circle. It did not: that reading
came off a 16-direction probe, which overestimates. Sampled properly it was
**1400** even before any joinery, and with the cupboard, the shelves and the
bin in it is **1300**. So the room does not meet the 1500 standard — it is
still far better than the guest WC, which manages 1000, and 1300 is a
comfortable bathroom, but it is not an accessible one. The bin is worth 100 of
that and is the one thing here you can move with your foot.

### The fittings

* **The arched vanity, and the mirror over it** — both struck off the sweep
  itself, not stood against it. A straight top against a curved wall touches at
  one point and gaps either side; these are the same curve offset inwards, so
  they bed on the wall for their whole length. The console runs the **whole
  arc, 2543 long**, pod wall to the foot of the west flank, and the mirror runs
  with it — so what you face at the basin is a mirror that wraps with the room
  rather than a flat sheet fighting it.
  It cannot run at one depth. 520 is right at the basin end, where the east
  flank's radius of curvature never drops below 1500; but the west flank is a
  690 inner radius, and 520 into that leaves 170 and closes the corner off to a
  point. So it eases over its whole length to **340 at the foot** — one
  unbroken taper, not a deep bit and a thin bit — which still leaves 350 of
  radius at the tightest part of the turn. The basin sits at the duct end,
  100 clear of the wall behind, where the plumbing is.
* **The pan** goes on the duct wall, because the soil stack is directly behind
  it. 600 out from the wall, 620 wide.
* **The shower** takes the whole south end — 1850 × 950 behind a glass screen.
  At 1930 clear a full-width wet zone is simpler than a cubicle with a dead gap
  beside it. 1850 rather than 1930 because the builder leaves a 230 × 1000
  column on the duct's corner and 80 of it stands in that corner of the room.

### And the storage, which is the rest of the run

The console is not the whole of the joinery. The arch, and the two walls it
dies into, carry a continuous run — and each piece is where it is because that
is the one stretch of wall nothing else wants.

| | | |
|---|---|---|
| console + mirror | 1743 on the arch | 520 deep at the basin, 395 where the cupboard starts |
| **cupboard** | 800 on the arch, to its foot | 395 → 340 deep, one door |
| **shelves** | 822 down the duct wall | 432 → 400 deep, stopping 120 short of the pan |
| **bin** | 300 × 300 | in the 300 between the arch's foot and the door jamb |

* **The cupboard** takes the last 800 of the arch. It is the end of the run,
  it is out of the wet zone, and it picks up the same face as the console
  beside it — so the two read as one length of joinery with a door on the end
  rather than two pieces meeting.
* **The shelves** carry the run on round the corner and down the duct wall.
  The console's end cut *is* the shelves' top, so the joinery turns out of the
  arch without a joint. This is the only piece with a shelf in it: towels, bath
  mats, the things a bathroom has to keep and a vanity has nowhere for.
* **The bin** fills the 300 of straight wall between the foot of the arch and
  the door jamb — too short for anything hung, too shallow for anything deep,
  and exactly a bin.

### The door is drawn open

Almost every door on this drawing is left as a gap in a wall, because which way
it swings does not change the plan. This one is drawn, because Karan asked to
see it work. **800 clear, hinged on the south jamb**, so the leaf opens back
along the wall it is in and clears the run from the door to the shower instead
of standing across it. Open, it reaches X 3275 — 530 short of the pan.

### One wall that was missing

The bath's east side is the enclosure to the builder's main service duct, and
**it had never been drawn** — the shell arrives with the shaft simply open, so
there was nothing there in either the builder's fabric or ours. The bath cannot
be closed without it. It is now a 150 wall from Y 6650 to the outer wall,
picking up exactly where the pod partition above it leaves off, so the two read
as one line. It is also what the pan sits on.

### The cost

The suite pays for it: **377 → 350 sq ft** each. The bath goes **48 → 69**. Net
across the home is −0.9 m², which is the extra masonry — a curve is longer than
the straight line it replaces.

---

## Karan's wardrobes

Two wardrobes on the south wall of Karan's suite, **1387 and 1388 wide, both
600 deep**. His side only — nothing has gone into the parents' suite.

**600 is the depth, and it is not a round number chosen for neatness.** A
shoulder on a hanger is 550–580, so a rail running left-to-right needs 600 of
carcass. Anything shallower and the doors will not shut on a coat, and the unit
turns into shelves with a rail in it.

They are set off **Y 9465, not the wall face at 9545**. The builder leaves a
1200 × 230 column on this wall whose face stands 80 proud of it, so the run is
scribed to the deepest obstruction and packed out behind over the stretch where
there is no column — which is what a joiner would do anyway. The alternative is
600 for two thirds of the run and 520 for the rest, which is worse.

The run's east end butts the end wall, where the builder's 3880 window comes
down to Y 9465. So the wardrobe's 600 return stands across the last 600 of it,
leaving 3280. That is the only thing the wardrobes cost.

### The dressing screen, the gap, and the dresser opposite it

A pane of **brown tinted glass** runs from the bath wall along **Y 7795** and
**stops 800 short of the end wall**. Everything south of it — the wardrobes,
the space in front of them, the way into the bath — becomes one screened
dressing area you can cross in a towel with the bedroom on the other side.

| | mm | ft |
|---|---|---|
| the strip | 2775 × 1750 | 9'-1" × 5'-9" |
| partition, one pane | 1980 × 120 | 6'-6" |
| **the gap — the way in** | **795** | **2'-7"** |
| wardrobes, two of | 990 | 3'-3" each |
| dresser | 795 × 450 | 2'-7" × 1'-6" |
| clear in front of the wardrobes | 1040 | 3'-5" |
| clear in front of the dresser | 1190 | 3'-11" |
| gap to the mirror — the light path | 1615 | 5'-4" |

Those two clearances are **face to face** — wardrobe carcass to the south face
of the partition. That face now sits exactly on the bath door's north jamb, so
the strip is bounded by the door opening and nothing else, and the whole 120
of partition is taken off the bedroom side.

**What that means with the doors open.** 1040 is comfortable to stand and
dress in. But a 988 unit split into two 494 leaves projects 494 when a leaf is
open, leaving **546 beside it** — enough to reach past, not enough to stand.
Three leaves of 329 leave 711. **Sliding doors project nothing at all** and
keep the full 1040 whatever is open, at the cost of only ever reaching half the
unit at a time. At 1040 the run is on the edge of wanting sliders, and the
choice is the joiner's to make with Karan — the plan works either way.

### The partition is wood at the bottom and glass above it

Karan's bed backs on to this partition, so it cannot be glass all the way down.
It is **120 thick, wood up to headboard height, tinted glass above that** —
drawn on plan as the wood band with the glass shown as an inset stripe inside
it: one line, two materials up it.

Three reasons, and each on its own would be enough. A headboard needs something
solid to sit against and to screw a bracket into. Glass to the floor would put
the back of that headboard on show from the dressing side, which is the one
view the screen exists to prevent. And a partition a king bed leans on is a
piece of construction, not a pane — hence 120 rather than 60.

The glass still runs the full length above, so the strip keeps its privacy and
every bit of its borrowed daylight.

**The gap is doing three jobs, which is why it is a gap and not a door.** It is
the way in. It is what stops the strip being a dead end reachable only through
the bathroom. And it is the aperture that throws the end wall's 3880 window
across the strip onto the dresser mirror square opposite it, 1615 away. A
sliding leaf — which is what was drawn a round ago — would have done only the
first of those.

**The screen, the gap, the joinery and the dresser are all set out on two
lines, not four.** The glass and the wardrobe run stop at the same X (24130),
so the pane and the joinery under it are exactly the same length; the gap and
the dresser start at the same X and end at the same X, so the dresser sits
square under the opening. Nothing is nearly-aligned.

**The trade.** Hanging goes from 2775 to **1975** — two wardrobes of 988
instead of two of 1387. The 800 became the dresser. The dresser is 450 deep
rather than 600 because it is a place to sit at, not to hang in, and 450 leaves
1220 in front of it for a stool.

### The bed moves to the end wall

Three rounds of trying to put a bed on the partition ended the same way: with
the bath on one side of it, the wardrobes behind it and the way into the
dressing area squeezing past. Four things in one corner. **The bed leaves that
corner.**

It goes to the end wall, and the reason is that the end wall carries the one
solid stretch in the whole suite:

| | |
|---|---|
| Y 1350 – 1950 | window, 600 |
| **Y 1950 – 5585** | **BLANK, 3635 — the headboard wall** |
| Y 5585 – 9465 | window, 3880 |

3635 takes an 1800 bed and a **550 table each side** with 370 and 365 to spare
at the two ends — so the whole group sits in the blank stretch without standing
in front of either window. That is the fit that makes this position right, and
it is the only wall in the suite where it exists.

The head sits on **X 24850, not the wall face at 24930**: the builder leaves a
230 × 1200 column here whose face is 80 proud over the bed's northern 280. Bed
and both tables are set to that line, so the three read as one run.

### The headboard is the whole wall, and it swallows the column

**3635 long, window jamb to window jamb, 200 thick.** One decision, and it
settles three separate things at once:

* **The column disappears into it.** The builder leaves a 230 × 1200 column on
  this wall standing **80 proud** over Y 1950–3150. At 200 the headboard passes
  **120 clear in front of it**, so the column is inside the joinery and the wall
  reads flat. Nothing is boxed out, nothing is left sticking into the room, and
  the column is still on the drawing where the architect needs to see it.
* **It covers no glass.** It stops precisely on the 600 window's south jamb at
  Y 1950 and the 3880 window's north jamb at Y 5585, so it can be full height.

### The bed centres on the room, not on the headboard

It used to be centred on the headboard, at Y 2802–4732. That put it **602 off
the back of the bench sofa** and left the whole southern half of the room as
empty floor — which is exactly what it looked like.

It now centres on **the two walls it lies between**: the terrace wall at
Y 1350 and the dressing screen's north face at Y 7675. **6325 clear, an 1930
bed, 2197 to each of them.** It moves 745 south, and the walk behind the bench
sofa goes from 602 to **1347**.

**The headboard does not move with it, and it cannot.** It is already hard on
both window jambs; any southward shift puts full-height joinery across the
3880 window. So the bed slides along a headboard that stays put, and the price
is the symmetry Karan asked for earlier:

| | before | now |
|---|---|---|
| headboard showing north of the bed | 852 | **1597** |
| headboard showing south of the bed | 852 | **107** |
| north side table | on the headboard | on the headboard |
| south side table | on the headboard | **in front of the window** |

That is the one thing in this round worth a second look. It stops reading as a
board behind a bed and starts reading as **a panelled wall with the bed at one
end of it** — which is a legitimate thing for it to be, given it is 3635 long
and 200 thick and swallows a column, but it is not what was drawn before.

If the asymmetry is worse than the centring, the alternative is to move the bed
only **252** instead of 745 and trim the headboard to 3130 — exactly bed plus
both tables — so both tables land on it and the bed is centred on it again.
That costs 505 of the column left sticking out at the north end, and the bed
ends up 492 north of the room's centre rather than on it.

### The bed — square at the head, curved at the foot

**1930 × 2032 — the US EASTERN KING, 76 × 80 in**, not the Indian 1800 × 2000
that was drawn first. The wall carries it: it costs 66 of headboard each side
and 32 of floor at the foot, and nothing else changes. The real price is that
the mattress and every fitted sheet then have to be imported.

**The foot corners come off at 594** — a third of the width — and
**the head is square**, so the bed sits flush on the headboard instead of
leaving two crescent gaps behind the pillows. Curve where you see it, square
where it has to meet something.

| | mm | ft |
|---|---|---|
| headboard | 3635 × 200 | 11'-11" × 0'-8" |
| — showing north of the bed | 1597 | 5'-3" |
| — showing south of the bed | 107 | 0'-4" |
| — in front of the column's face | 120 | 0'-5" |
| mattress | 1930 × 2032 | 6'-4" × 6'-8" |
| foot corner radius | 594 | 1'-11" |
| side tables, each | 550 × 450 | 1'-10" × 1'-6" |
| clear west of the bed | 2623 | 8'-7" |
| clear north, to the terrace wall | 2197 | 7'-2" |
| clear south, to the dressing screen | 2197 | 7'-2" |

**It sleeps 1930 across**, which is a full American king and 130 more than the
Indian one. The round bed, for comparison, managed 1482 at the shoulders — 741
each. Two rounded corners at the foot are the whole of what is given up here,
and nobody sleeps in the corners of a bed.

**The mattress is still not a catalogue item** — a 594 radius on two corners has
to be cut — but the frame and base do the shaping and only the foot end is
affected. If you would rather it were entirely off the shelf, about 250 reads
as softened rather than arched and most makers will do it.

**And the room is no longer crowded at the bottom.** The bath, the wardrobes and
the dressing gap have the southern half to themselves; the bed has the northern
half with 2655 of open floor beside it.

### The console round the outside of the arch

The bath's arch is the best wall in the bedroom and it had nothing on it. A
console now runs **the whole of it** — off the pod partition, over the crown,
down the straight tail and dead into the dressing partition.

| | mm | ft |
|---|---|---|
| curved run on the arch | 2721 | 8'-11" |
| straight tail | 960 | 3'-2" |
| **total** | **3681** | **12'-1"** |
| depth | 400 | 1'-4" |
| cupboard under it | 1.58 m² | 17 sq ft |
| wall cabinet over, at the partition end | 900 × 250 | 3'-0" × 0'-10" |

It is struck as an **offset of the sweep's own outer face**, so it beds on the
curve for its whole length — the same move as the vanity on the inside, and the
reason both of them sit on the wall instead of touching it at a point.

**Offsetting outward is the easy direction.** Pushing out from a convex curve
only ever increases the radius, so unlike the vanity inside there is no depth
at which this one folds on itself. 400 is a choice, not a limit.

**The pod-wall end tapers from 400 to 250 and then stops against that wall in a
431 face**, at Y 6002 — above the springing, not at it. Both of the obvious
alternatives are wrong:

* **A square 400 cut** overhangs. Offsetting outward at the springing throws
  the front face straight *through* the pod wall, so a naive square end pushes
  400 into the pod.
* **A taper run out to zero** ends the console in a knife point at the corner —
  a sliver of joinery nobody can build and nothing can stand on.

Tapering to 250 and clipping the front where *it* crosses the wall does both
jobs: the end face is a clean vertical on X 4405, and the top is still 250 wide
where it meets the wall. Footprint 1.57 m².

Cupboards under it the whole way; one wall cabinet over the straight tail at
the partition end, drawn dashed because it is over, not in plan. The top is for
the art and the plants.

### The loose furniture

Three sofas, a table and a plant, all Karan's side.

**A conversation pod across the terrace opening.** Not chairs stood in the
terrace: a **bench sofa inside the room** with its back to the bed, facing north
through the slider, and **a single sofa at each end of the terrace** facing in,
with a round table between them. Open the slider and the three of them are one
group; shut it and the bench still faces the view.

| | mm | ft |
|---|---|---|
| bench sofa, in the room | 2000 × 800 | 6'-7" × 2'-7" |
| — off the terrace wall | 50 | 0'-2" |
| — to the bed | 1347 | 4'-5" |
| single sofas, each | 800 | 2'-7" |
| — clear at each end of the terrace | 100 | 0'-4" |
| — clear top and bottom of its 1200 depth | 200 | 0'-8" |
| centre table, round | 750 | 2'-6" |
| — to each single sofa | 275 | 0'-11" |

The terrace is only **1200 deep and 3100 long**, and that is the whole reason
the bench is inside rather than out. Three pieces and a table will not fit in
1200; two singles and a table will, with 200 top and bottom and 100 at each
end. Putting the third seat on the room's side of the glass is what makes the
group work at all.

**Karan's terrace label had to move for it.** The room label sits in the middle
of its rectangle by default, and the middle of this one is now exactly where
the centre table is. `ROOMS` entries carry an optional label anchor now; his
terrace uses it, and drops into the gap between the bench and the bed.

**The reading chair and its ottoman are out.** They stood in the floor between
the arch console and the bed, and the bed has now moved 745 south into it. Two
loose pieces in the last 2200 before the dressing screen would have turned the
one clear run in the suite — bed to screen to bath — back into an obstacle
course. The floor stays open instead.

**A low wooden table with a big plant on it**, and it takes the north-west
corner properly rather than sitting near it: **900 × 900 with a 1200 spread**,
and the spread reaches **both** faces of the corner — the column's at X 20180
and the wall under the sealed shaft at Y 1350. The table is centred under it
with an equal 150 to each. So the plant fills the corner, and screens the
builder's column — which stands 105 into the room — instead of standing beside
it.

Drawn plant-first, table-over: the spread is 900 against a 700 top, so the
other way round the foliage swallows the table and you cannot see what it
stands on.

### The bath door had to move for the line

It has come south until its far jamb lands flush on the shower screen at
Y 8595, which is also where the glass meets that wall — so the screen starts
exactly on the door frame's edge and the two read as one line rather than two
things missing each other by a few hundred.

Moving it forced the hinge over. The parents' door hinges south, so its leaf
falls back along its own wall; Karan's cannot, because a south hinge on the new
position swings the leaf straight across the way into the shower. **His hinges
north**, and the open leaf lies back along the very line the screen runs on
outside.

**Karan's side only.** The parents' bath is exactly as shipped — without a
screen to line up with, there is nothing there for the move to buy.

---

## The parents' suite is two rooms now

The brief changed: a permanent bed for Karan's parents, a wall bed for his
grandmother when she stays, and something between them — because the two will
want different air, and because whoever comes out of the bath should be able to
reach a cupboard and dress without crossing the bedroom.

The west-wall cupboard run that used to be here is gone. The suite splits on a
line the room already draws.

### The partition sits on the arch's crown

Its north face lands on **Y 5875**, which is exactly the crown of the bath's
sweep — the northernmost point that arch reaches, at X 3165. So it does not cut
the room arbitrarily: it continues a line the bath already makes, and the two
read as one boundary.

It is built of two things, and neither of them is a wall:

| | |
|---|---|
| X −450 → 1400 | a full-height **joinery block, 720 deep** |
| X 1400 → 2732 | **brown tinted glass**, the same as Karan's screen |

**The glass is the door.** One leaf, **1332**, sliding west into a pocket formed
in the *back* of the cupboards — the block is 720 because it is a 120 cavity in
front of a 600 cupboard, not a 720 cupboard. Shut, the two zones are separately
heatable, which is the whole reason the partition exists. Open, the leaf is
inside the cupboards and the suite is one room again.

**It was a masonry wall with a hinged door first, and that was wrong twice.**
The bath's sweep comes back west to X 2325 just below the partition, so the
passage south of the east end of the opening was only 292 deep before it met
the arch; and a 900 leaf hinged there fouled the arch by 161. Nothing slides
into anything now, so nothing can foul it.

Above the cupboards it is glass too — tinted from 2100 to the ceiling, the whole
length. Solid to the ceiling would make the dressing zone a cell.

### The parents' bed is Karan's bed, mirrored

The same bed, the same headboard treatment, the same side tables, handed so the
head is square on the **west** wall and the rounded foot faces east down the
room and out through the pod slider.

| | mm | ft |
|---|---|---|
| bed | 1930 × 2032 | 6'-4" × 6'-8" |
| foot corner radius | 594 | 1'-11" |
| headboard | 3925 × 200 | 12'-11" × 0'-8" |
| side tables | 550 × 450 | 1'-10" × 1'-6" |
| to the terrace wall, and to the partition | 1297 each | 4'-3" |
| clear east of the bed | 2623 | 8'-7" |

The headboard is the **whole blank wall**, Y 1950 to 5875 — window jamb above,
partition below. Karan's is 3635 for the same reason on his end wall, and there
it swallows a column; here there is none, so it is simply the full stretch and
the joinery runs on into the partition block without a break.

### The grandmother's wall bed is a queen, on the column

A cabinet 400 deep that is shut fifty-one weeks of the year, and a **queen,
1500 × 2000**, that folds out of it when she is here. Not a sofa bed: nothing to
unfold nightly, nothing to make up twice.

The cabinet's south end is fixed on the 600 window's north jamb at Y 8945 —
anything past that stands in front of glass — so 1500 of cabinet runs back to
7445, and its northern 300 comes off the builder's column and is packed out.

**A side table each side**, 500 × 480, going back to the wall face rather than
the column's, so all three pieces share one flush front and read as a single
2500 run. Bed up they are the dressing zone's console; bed down they are hers.

| | mm | ft |
|---|---|---|
| bed | 1500 × 2000 | 4'-11" × 6'-7" |
| cabinet | 1500 × 400 | 4'-11" × 1'-4" |
| the whole run on the wall | 2500 | 8'-2" |
| bed down, to the bath wall | 370 | 1'-3" |
| cupboard doors to the head of the bed | 850 | 2'-9" |

With the bed down you do not walk past its foot. That corner is the bed's —
which is why the laundry basket and the dressing console both came out of this
zone. **The mirror stays**, 940 on the bath wall in the corner, with nothing
under it: you face east into it with the south window on your right, so the
light is on your face and not behind it.

### The console curls round this arch too

The same piece as Karan's, struck as an offset of the sweep's own outer face,
400 deep, tapering to 250 at the pod wall and stopping there in a 431 face. No
wall cabinet — that belongs on a straight tail and this one has none.

**It is cut by the sliding screen.** The leaf shuts on Y 5875–5995 and the
console crosses that line, so a slot runs through it and the leaf slides into
the slot and stops against the arch. The two ends of the slot are found rather
than chosen: u 0.264 and u 0.618 are the first and last sections of the console
whose 400 depth touches the leaf's line with 20 of tolerance either side.

**There is no piece south of the slot.** The console stops there. A return below
it would have sat in the grandmother's zone and narrowed the way in to 525 by
the time the arch turns vertical, which is not a doorway. So the curl runs from
the pod wall over the crown, meets the leaf, and ends.

### A study desk in the north-east corner

Karan's father's desk, in the one corner of the suite with two solid walls and
nothing else wanting them — the sealed shaft's south wall above it at Y 1350 and
the pod wall on its east at X 4405. Both are blank: the terrace slider stops at
X 2750 and the pod's own opening does not start until Y 2620.

| | mm | ft |
|---|---|---|
| desk, north leg | 1400 × 600 | 4'-7" × 2'-0" |
| desk, return | 600 × 670 | 2'-0" × 2'-2" |
| cabinets over, both legs | 350 deep | 1'-2" |
| chair | 550 swivel | 1'-10" |

The return stops dead on Y 2620, the north jamb of the pod's sliding partition,
so the desk never stands in that opening.

### The parents' pod gets a sitting group

Its north half had nothing in it but the glass roof over the bay. It took four
goes. It started as three boxes facing each other across nothing, which is a row
of furniture, not a group; the second recliner came out because it stood in the
route from the deck to the dining table; and the round centre table came out
last.

What is there now is an **L**, closed on the west and the south and open to the
deck and to the great room:

* **sofa 1700 × 800 mm (5′-7″ × 2′-8″)**, back to the dining end, facing north
  through the slider
* **one recliner 800 × 900 mm (2′-8″ × 3′-0″)** at the west end, turned in
* **and no tables at all.** The round centre table went first, then the three
  that replaced it — the one on the terrace line, the corner table in the
  angle of the L, and the one on the sofa's arm

**Being straight about the tables:** there is now nowhere in this group to put
a cup down. The nearest surface is the dining table, 1130 mm (3′-8″) south of
the sofa's back. The floor it buys is real — the pod reads as one open room
rather than a furnished corner — but a side table is a thing you notice the
absence of rather than the presence of, and any of them goes back in one line
whenever it is wanted.

**The deck line is completely clear.** The round centre table stood in the
slider and left **575 mm (1′-11″)** to get out; the 500 side table that
replaced it on that line has gone too. The pod's slider is now open end to
end — **2850 mm (9′-4″)**.

**The sofa group moved 300 mm (1′-0″) east**, because the recliner's footrest
was finishing 60 mm (2″) off the sofa's west arm and reading as touching it.
East was the only direction free: the recliner cannot go west, since what is
behind it is not a wall but the suite's sliding partition and its track, and
it cannot go north without standing in the slider that was just cleared. So
the chair did not move — the sofa did.

* **600 mm (2′-0″)** from the recliner's east face to the sofa
* **360 mm (1′-2″)** from the tip of its footrest, reclined
* **641 mm (2′-1″)** east of the sofa to the pod glazing — with nothing
  standing beside it any more, the sofa could go further east still if the gap
  wants opening

Measured: **1150 mm (3′-9″)** in front of the sofa, **1130 mm (3′-8″)** behind
it to the dining table.

**What it costs.** The recliner stands 370 mm (1′-3″) off the suite's sliding
partition, over Y 3120–4020 of its 3555 mm (11′-8″) opening. Nothing else is
near it at all now, so the way through from the bedroom is the **2155 mm
(7′-1″)** south of the chair plus the 500 mm (1′-8″) north of it.

### What this layout costs

**The cupboards.** 1850 × 600 on the partition, against the 2820 the west wall
used to carry. For two people that is **925 each**, and the planning minimum is
about 1000 per adult — so the parents' hanging storage is now *below* minimum.
It is the real price of the three-way split and it is not hidden here.

Three ways back, none of them taken yet: a 790 run on the bath wall above the
mirror; cupboards on the partition's north face as well, which puts them back
in the bedroom; or overflow somewhere else in the home.

| the suite, in two | m² | sq ft |
|---|---|---|
| parents, north of the partition | 21.97 | **236** |
| — with the terrace | 25.69 | 277 |
| grandmother, south of it | 9.76 | **105** |
| — free floor, wall bed up | | 85 |
| — free floor, wall bed down | | 56 |

## The suite windows — a correction, and why it matters

The glazing schedule used to carry **three invented windows on each wing end
wall and a mirrored south window in Karan's suite**. None of them exist. They
were written by assuming the two ends of the home are symmetric. **They are
not**, and it is not a small difference:

| | parents' (west) | Karan's (east) |
|---|---|---|
| end wall | 600 at the terrace + 600 at the south corner | 600 at the terrace + **one 3880** |
| south wall | **3200**, the length of the strip | **nothing** |

The builder gave the parents a long south window and gave Karan one enormous
end-wall window instead. The two suites end up with almost the same glazing —
about 4400 each — by completely different means.

Everything above is read off the source drawing's own `DA_WINDOW` layer, and
`design.py` now carries those openings verbatim, with the mirror rule
deliberately **not** applied to them.

**What this changes.** Karan's wardrobes cost no window at all: there was never
one on that wall. It also means the same move in the parents' suite is a
genuinely different proposition — their south wall is a real 3200 window, and
wardrobes there would take it. Worth knowing before that round starts.

**And one thing it gains.** The parents' 3200 south window runs X −450 to 2750.
The bath's new west wall crosses it at 2325–2475, so **275 of that window now
falls inside the parents' bath** — a south-facing slot in a room that was going
to be lit artificially. It is narrow, but it is real daylight and a real
openable pane, and it is there for nothing.

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

## The pod glazing — one bend, then straight

The tinted glass between the great room and each pod leaves the deck wall at
**65 degrees**, turns through a single arc over the top **1708** — minimum
radius **3036** — and then runs **dead straight for the remaining 3947** to the
service-bay wall. No inflection, no reverse, no second bend.

Control points, west side; the east is the mirror:

```
(9115, 2620)  (8608, 3708)  (8600, 3800)  (8600, 8400)
```

### It used to be an S, and here is why that went

The first version was a cubic with a **985 bow**, its radius swinging from 2037
to effectively straight and back, meeting the deck wall at **41 degrees** with a
visible kink. Three separate objections killed it, and each is worth keeping
written down because each will come back:

* **13% deviation over 6 m is the ambiguous zone.** Too curved to read as a
  straight wall, too shallow to read as a curve — it read as *a wall that isn't
  quite straight*. This one is at **8.8%** and does not claim to be a curve at
  all: it is a splayed wall with an eased corner.
* **It was off-vocabulary.** Every other curve in this home is a tight,
  complete arc you read instantly — the bath sweep is a 765 quarter circle, the
  entry apse a true 1725 semicircle, the guest WC a quarter ellipse. A 3 m
  radius stretched over 6 m was the only shallow gesture in the plan, and the
  eye calibrates on the confident ones.
* **It gave neither pod a straight wall.** The den in particular wants one — a
  desk, a bookcase and a sideboard all want a flat back. Each pod now has
  **3947 of straight wall**, and a width that never varies by more than 2.

### The south end lands at 8600 and cannot move

It mirrors to **15880** on the service-bay wall. The guest WC's apse springs at
15000 and this glazing lands at 15880 — **880 of wall, and the WC door is 800 of
it.** Any curve that wants a wider mouth at the bottom takes the door out. One
earlier re-fit did exactly that, landing 240 inside the door opening.

### What it costs, and what it does not

| | great room | each pod | the three together |
|---|---|---|---|
| the original strong S | 445 sq ft | 218 | 881 |
| the re-drawn S | 434 | 224 | 882 |
| **one bend, then straight** | **422** | **230** | **882** |

**The three spaces together never change.** The curve creates nothing and
destroys nothing — it only decides where the line between the great room and
the pods sits. Whole-home total is 2504 sq ft in every version.

The great room's narrow point is **20'-6" in all of them** — that is set by the
deck end, not by the curve. What the curve buys is the swell in the middle, and
going straight takes 3 ft off it: 27'-0" on the strong S down to 23'-11" here.

---

## The dining table is not round

It was a 1400 round, and a round table in a pod **2894 wide** is the wrong shape
for the room. The seat facing the glass and the seat facing the duct wall had
**200 and 215** behind them — neither chair could be pulled out to sit in.

A long table turned to run **down** the pod uses its 5780 of depth instead of
fighting its 2894 of width.

**1100 × 2200 — 3'-7" × 7'-3" — with all four edges arched.** It is a
superellipse, `|x/A|^n + |y/B|^n = 1` at n = 5. The long edges bow so gently
where the chairs sit — **23 out of 1100, one in 48** — that a chair meets what
reads as a straight edge, while the two ends arch enough to carry a seat.

| on the same 1100 × 2200 footprint | top area |
|---|---|
| true oval | 1.90 m² |
| rectangle, corners filleted 400 | 2.28 |
| **superellipse** | **2.30** |
| *(the 1400 round, for reference)* | *1.54* |

It beats even the filleted rectangle because the edges bow **out** instead of
the corners being cut **in** — and a true oval loses the table exactly where the
outer diners sit, narrowing to 2'-11" under them.

| | mm | ft |
|---|---|---|
| table | 1100 × 2200 | 3'-7" × 7'-3" |
| rim per person, three a side | 733 | 2'-5" |
| clear behind the chairs, **both** sides | 559 | 1'-10" |
| table end to the hatch wall | 500 | 1'-8" |

**Six, and no end chairs.** An occasional seventh was dashed in at the north end
and has come out. Both ends of the table stay clear, and that is what lets you
walk round them: the south end is the serving stance at the hatch, and the north
end is the run up to the sitting group.

**This is also the clearest argument for the straight glazing.** Under the S the
pod's width varied along its length, so where you put the table mattered — this
same table had **178** on the glass side when it moved north far enough to seat
an eighth. Past a straight screen the pod is a constant 2894 and the table can
sit anywhere in it.

---

## The great room is furnished, and so is the deck

Both came off the reference sheet.

### The whole deck is real grass

Not two bays of it set into a hard deck — grass end to end, from the planted
strip's south face at Y 190 to the glazing line at 2470, all 15 420 of it. The
only things it goes round are the two retained voids, which are holes in the
slab.

| | m² | sq ft |
|---|---|---|
| grass, as two bays | 10.53 | 113 |
| **grass, the whole deck** | **31.06** | **334** |
| plus the planted strip | 5.24 | 56 |
| **green, total** | **36.30** | **391** |

**Two things this needs and has not got, both worth settling before it is
priced:**

1. **The suites' sliding glass panels park on the deck**, on a track at
   X 4540–4600 and its mirror. A track cannot run through turf — it wants a
   hard strip, and that strip will be visible in the lawn.
2. **Grass wears where people walk**, and the way out of the great room crosses
   it. A paved threshold in front of the slider is the usual answer. It is
   **not drawn**, because it is not what was asked for — but it is the first
   thing a landscaper will raise.

### The parapet edge stays inside

The 340 mm (1′-2″) band along the parapet is a **grass strip inside it**, planted,
with the trellis on the parapet above and the creepers climbing from that bed.
It is not a trough hung off the outside.

Hanging it outboard was looked at, because it is worth real floor — **5.24 m²
(56 sq ft)** across the whole deck, **2.12 m² (23 sq ft)** in the strip in front
of the great room, and it would take the deck's clear depth from 2280 mm (7′-6″)
to the full 2620 mm (8′-7″). Two things said no:

* **The parapet is 100 mm (4″) thick.** Slab edge at Y −250, deck inner face at
  Y −150. Cantilevering a planted, water-filled steel trough off 100 mm of
  parapet at the 14th floor, with wind on it, is a structural engineer's
  problem, not a fabricator's.
* **It would project past the building line** — the only thing in this whole
  drawing that would. Everything else stays inside the builder's envelope,
  which is what makes the layer-state comparison work.

**Worth knowing:** 340 mm (1′-2″) is thin for a bed that has to carry creepers
to 1.5 m. 450 mm (1′-6″) would be a comfortable root run, and it would cost the
deck another 110 mm (4″) of depth — 1.7 m² (18 sq ft) over the full length. Say
the word if you want that trade.

### The deck: two recliners backing on to the voids

The reference's own note is the instruction — *two 2-seat recliners back onto
the voids, facing the fountain at the deck centre* — and it is a good one,
because it turns the one thing on the deck that cannot be used for anything
into the thing the seats lean on.

Each recliner's back is on a void enclosure's inner face — **X 9115** on the
west, **X 15365** on the east. They face each other across the fountain, with
**1355 mm (4′-5″)** from each footrest to its rim. Each has a small table at
its **north** arm, which is the only free side: void behind, fountain in front,
parapet planter 510 mm (1′-8″) beyond the table.

**1345 mm (4′-5″) wide and not 1400**, and that is not a rounding. The deck's
south glazing runs at **Y 2545** between the two voids, and a seat that
oversails it is inside the great room. So they run Y 1200–2545 — the void's own
north edge to the glass line.

They stand in front of **900 mm (3′-0″)** of the 6250 mm (20′-6″) slider at
each end, which leaves **4450 mm (14′-7″)** of it clear to walk through.

### The great room: an L of two sofas with a tree in the corner

Not a U of loose chairs — **an L**, from the interior reference: two continuous
sofas meeting at a right angle, with a **planter box filling the angle between
their two ends and a tall tree growing out of it**. In a U the corner is the
awkward bit nobody sits in; here it is the thing you look at.

**One bench sofa and four recliners** — not a sofa in a row. The L and the tree
in its corner are the same idea; what changed is what the two arms are made of.

| | |
|---|---|
| four recliners, facing the deck | 800 × 900 mm (2′-7″ × 2′-11″) each |
| the row, 4 × 800 with 150 between | 3650 mm (11′-12″), centred on X 12240 |
| bench sofa, back west, turned in | 2000 × 800 mm (6′-7″ × 2′-7″) |
| planter box in the angle | 950 mm (3′-1″) square |
| tree canopy | 1710 mm (5′-7″) across |
| two side tables, at the free ends | 500 mm (1′-8″) square |

**No centre table.** The one that was there was 1400 × 1200 mm (4′-7″ × 3′-11″)
— nearly twice a normal coffee table's depth — and about 0.36 m² (4 sq ft) of
its top was out of arm's reach from either seat. Nothing replaces it: what sits
between the bench and the row is **3800 × 2050 mm (12′-6″ × 6′-9″)** of clear
floor, 7.8 m² (84 sq ft) of it.

The whole group is now **5.88 m² (63 sq ft)** of furniture — **16%** of the
room, down from 7.36 m² (79 sq ft). Six to seven seats: the bench takes two or
three, and each recliner is its own chair facing the deck.

**The corner is on the west, and that is the one real choice here.** The great
room already has a planter on its south-east wall — the one that answers the
kitchen's bump — so putting the tree on the east would stack all the greenery
down one side of the room. West balances it.

**What sets the depth is the entry gallery's apse.** Its crown is at Y 7485 and
the arched portal into this room is *in* it, X 11715–12765 — so the long sofa's
back cannot go near it. At Y 6550 there is **935 mm (3′-1″)** between the two,
which is the passage you come out of the front door into, widening to **1434 mm
(4′-8″)** at the sofa's west end as the apse falls away.

The rest: **450 mm (1′-6″)** from the centre table to the long sofa and **700 mm
(2′-4″)** to the short one; **1430 mm (4′-8″)** west of the group to the pod
glazing and **1600 mm (5′-3″)** east; **1355 mm (4′-5″)** from the short sofa's
north end up to the deck glass, of which the side table takes 500.

The canopy is drawn **dashed**, because it is overhead — it oversails each sofa
by about **380 mm (1′-3″)**, which is the whole reason for a tree there rather
than a pot.

### A drawing that disagreed with itself

Caught while checking this render: the sheet printed the deck as **40.4 m² /
435 sq ft** under a note reading *net of the two retained voids*, while
`verify.py` printed **35.8 / 385**. The sheet was using the gross rectangle.

There is now one implementation — `retrofit.rect_room_area()` — used by the
render, the DXF and the audit alike. Same rule the dimensions already follow:
compute it once, so the label and the geometry cannot disagree.

---

## The music + work den gets its two things

The den was named for music and work and had neither in it. It now has both:
a **work console** along the pod's glazed screen and an **electronic drum kit**
in the south-east corner, where the great-room wall meets the service-duct wall.

### The kit

A Roland TD with **four toms and three cymbals** — a big configuration. Pads,
rack and cymbal arms want **1790 mm (5′-10″)** across, and with the throne
behind it the whole thing is **1890 mm (6′-2″)** front to back.

It nests into the corner and **the drummer faces south**, into it. That is not
a preference, it is the only orientation that works:

* **Against the east wall facing west**, the drummer would sit at about X 17200
  — 620 mm (2′-0″) off the console. They would be in each other's laps.
* **On the diagonal**, which is how a lot of people set a kit into a corner, a
  1790 × 1500 kit becomes a 2330 mm (7′-8″) square, and the bay is 2895 × 2225
  (9′-6″ × 7′-4″). It does not go.

Facing south, the drummer has **3750 mm (12′-4″)** of open pod behind them,
**150 mm (6″)** from the left crash to the duct wall, and **140 mm (6″)** from
the kick to the great-room wall. It is drawn right-handed — floor tom and ride
on the room side, hi-hat against the east wall. Flip it about its centreline
for a left-hander; nothing else moves.

### The console is not where it was first marked

Marked at the south end it would have run Y 6175–8400, in the bay that is only
**2895 mm (9′-6″)** wide. The arithmetic does not work there:

| | |
|---|---|
| kit | 1790 mm (5′-10″) |
| a chair actually in use | 600 mm (2′-0″) |
| console | 700 mm (2′-4″) |
| **wanted** | **3090 mm (10′-2″)** |
| **bay gives** | **2895 mm (9′-6″)** |

195 mm (8″) short — so swivelling out of the desk chair would have put its back
on the nearest cymbal.

**Moved 1375 mm (4′-6″) north** it runs Y 4800–7000 instead. That puts the
chair in the part of the pod that is **4070 mm (13′-4″)** wide rather than
2895 mm (9′-6″), and hands the whole south bay to the drums. It costs nothing:
same **700 mm (2′-4″)** depth, same **2200 mm (7′-3″)** of top, and it still
starts **108 mm (4″)** south of the pod screen's portal at Y 4692, so the way
in from the great room is untouched. The desk chair now sits **680 mm (2′-3″)**
clear of the drummer's throne, and the kit's westernmost cymbal is **255 mm
(10″)** off the console's front edge.

**700 deep and not 600**: a 27-inch screen on a stand plus a keyboard in front
of it does not fit on 600 without the screen overhanging the back edge. The
screen faces **east**, because with the desk's back on the glass there is only
one side to sit at — you work looking west, through the screen and the pod
glazing into the great room. 300 mm (1′-0″) of the 700 goes to the monitor and
its foot; the 400 mm (1′-4″) in front of it is the keyboard.

**Both ends are bullnosed, 350 mm (1′-2″).** This house does not do square
corners on anything that stands free — the baths are arches, the gallery is an
apse, the dining table is a superellipse, run B's nose is eased 300 and its far
end is struck off the apse. The console floats along the glass with neither end
against anything, so both get the full half-width round. It costs **0.05 m²
(0.6 sq ft)** of top: 1.49 m² (16 sq ft) instead of 1.54.

### Two recliners, not a sitting group

The parents' arrangement was mirrored in here first — a sofa and a recliner in
an L — and then taken out again. What is here instead is **two recliners side
by side, both facing north through the deck slider**, with a small table
between them.

* **recliners 800 × 900 mm (2′-8″ × 3′-0″)** each
* **a rectangular side table, 450 × 600 mm (1′-6″ × 2′-0″)**, between them
* **2050 mm (6′-9″)** overall

The two pods are deliberately no longer a mirrored pair, and that is the point:
this one is a den for one or two people looking at the deck, not a room to
receive in. An L wants somebody sitting in the return talking across the
corner — which is what the parents' pod is for.

**The pair is centred on X 18405, which is the centre of Karan's deck slider**,
not the centre of the room. It sits square on the opening it faces, because
that is the alignment you notice from the chairs.

The table's back is **on the chairs' own back line**, not centred on the seat.
Reclined, your elbow is near the back of the chair; a table centred on the seat
would be level with your knees.

Clearances: **780 mm (2′-7″)** from the tip of a reclined footrest to the deck
line, **230 mm (9″)** from the chair backs to the north end of the work
console, **815 mm (2′-8″)** west to the mandir and pantry units, **520 mm
(1′-8″)** east to the suite's sliding partition. Karan's deck slider —
**2850 mm (9′-4″)** — is clear end to end, like his parents'.

---

## The kitchen steps into the great room

The kitchen was **10.5 m² / 113 sq ft** — the one room in the home with no
slack in it. Its north wall now steps **600 north**, into the great room, over
the whole stretch it is free to move: from **X 8600**, where the pod glazing
lands, east to where the gallery apse comes through at **11 210**. That is
2610 of wall, and it takes the kitchen to **11.7 m² / 126 sq ft**.

The step starts exactly on the glazing and not a millimetre west of it, for a
reason that is not tidiness: **west of 8600 the same wall is the family pod's
south wall**, and moving it there would eat the pod. Landing on the glazing
line also buys the drawing something — the screen comes down off the deck,
dies on the bump's north-west corner, and wall and glass read as one line from
the parapet to the kitchen.

### And a planter answers it across the room

The east side **cannot** take a bump. Behind that wall are help's room (4.4 m²)
and the guest WC (3.0 m²), and both are already at their minimum. So what
answers the kitchen across the great room is not a room but a thing standing in
front of the wall: a **planter, 600 deep**, on the same two lines, with the
same curved end where it dies into the apse. From the middle of the room the
two read as a pair.

**It is not the full mirror, and it cannot be.** The bump runs 2610; its mirror
would run past X 15 000, where the guest WC's apse springs and its door stands.
The planter stops there — **880 short** — and that missing 880 is exactly the
WC door, which is the one place on this wall where symmetry was never
available.

### 600, because that is one counter deep

300 was drawn first and rejected, and the reason is the counter, not the floor.
A 300 recess behind a 600 worktop is a slot no arm reaches into — dead space,
and the complaint that started this round.

At **600** the counter can turn the corner and follow the wall. And the number
does something better than fit: the front of the upper leg lands **exactly** on
the back of the lower one, both on BAY_N at Y 8525. The two faces line up
rather than nearly lining up, and the run reads as one worktop that steps.

The kitchen is **11.7 m² / 126 sq ft**; the great room gives up 1.6 m² and is
**37.8 m² / 407 sq ft**.

**What it costs is the apse.** The arch's crown is at Y 7485, so with the wall
at 7800 only **315** of it projects past the walls either side, and it barely
reads as an apse from inside the great room. That is the trade, made knowingly.

### Run B turns the corner

The old run went straight past the bump — 2650 long, 600 deep, ignoring the
fact that the wall behind its eastern end had stepped away. It now follows the
wall: along the old line to the return, round it, and on along the new wall
until the apse cuts it off.

| | worktop |
|---|---|
| straight run B | 1.59 m² |
| **turning the corner** | **2.65 m²** |

Two thirds more, and no dead space behind any of it.

* **leg 1** — 2425 (7′-11″) from the kitchen's west face to the step, its nose
  eased 300 so nobody turns a sharp corner into it
* **leg 2** — 2321 (7′-7″) along its back, against the new wall
* **the end is struck off the apse.** The front edge meets the arch at Y 8525,
  the back edge 463 further east at 7925, and the end face is the arc between
  them. A square end would have to stop at the nearer of the two and throw
  away half a metre of worktop for the sake of being a rectangle.

The aisle in front of leg 2 is **1850 (6′-1″)** against 1250 in front of leg 1,
and there is still **1086 (3′-7″)** of clear floor at the gallery's service
door.

**What it produces at the turn is an ordinary L-kitchen blind corner.** It is
not a place for a sink or a hob, so **the sink has moved** west out of it, to
X 8100–8660 — which also puts it 1400 mm (4′-7″) nearer the stack than it was.

### The blind corner, and the magic corner that serves it

**A correction first, because the number was wrong when it was first said.**
The block where the two legs of run B stack is 600 × 1200 mm (2′-0″ × 3′-11″) —
but only *half* of that is blind. The lower leg's half, Y 8525–9125, faces
north into the room and opens perfectly well. What is blind is the upper leg's
half: **600 × 600 mm (2′-0″ × 2′-0″)** at X 8725–9325 / Y 7925–8525. Its own
front sits on Y 8525, and Y 8525 is exactly where the lower leg's carcass
begins — so a door there would open into the back of another cupboard.

So it has no door. The only way in is sideways, through the **500 mm (1′-8″)**
door of the unit east of it at X 9325–9825, and past arm's reach is the corner
nobody ever sees again.

**A magic corner solves it.** Two tiers of wire trays: the front pair rides on
the door, and when you swing it open the rear pair slides out from the blind
600 and follows it into the room. Roughly **0.36 m² (4 sq ft)** of floor-level
storage goes from unreachable to in-your-hand.

It is **drawn**, not just noted — and drawn in *both states*, the way the
sliding panels are: the trays stowed in the corner, the same trays standing
out in the floor in front of the door, and the path between them. The floor
they swing into is clear, because the lower leg's worktop stops at X 9325.

A carousel (lazy Susan) is the cheaper fitting but it does not work here: it
needs a bi-fold door on the corner itself, and this layout runs one leg
straight past the other instead.

### The south wall is one unbroken L too

It used to be three pieces with two **400 mm (1′-4″)** gaps in it — fridge,
gap, hob counter, gap, appliance corner. Neither gap was wanted: both came
from setting the hob counter 400 in from each jamb of its window, and what
they read as was two slots of floor too narrow to stand in and too shallow to
store in.

The run is now continuous from the fridge's side at X 7800 to the gallery leg —
**2600 mm (8′-6″)** — and then turns **675 mm (2′-3″)** north up it.

| | worktop |
|---|---|
| three pieces, two 400 gaps | 1.49 m² (16 sq ft) |
| **one unbroken L** | **1.94 m² (21 sq ft)** |

**Closing the western gap is not just worktop — it fixes a real defect.** The
hob sits at X 8500–9100 and had only **300 mm (1′-0″)** of counter to its left,
which is not enough to set a hot pan down on. It has **700 mm (2′-4″)** now,
and 700 to its right before the corner. The hob itself has not moved; it is
still centred on its window at 8800.

Every corner that stands in the room is eased 200 mm (8″) like the rest of the
kitchen. Two are not: the L's inside corner, where two worktops are mitred and
a mason does not scoop a curve out of an internal angle; and the west end,
which butts the fridge — 700 deep, so it stands 100 mm (4″) proud of the
worktop and that end face is never seen.

**Kitchen worktop, both runs together: 4.59 m² (49 sq ft).**

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
* both master baths — arched vanity with the basin set into it, WC on the
  duct wall, full-width walk-in shower
* guest / service WC — shower, WC, basin
* the bunk in help's room
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

* **the two master baths** — settled and in the DXF. The arched wall, the
  console and mirror struck off it, the cupboard on the end of the arch, the
  shelves turning down the duct wall, the bin, the pan on the stack, the
  full-width shower, and the door drawn open. 6.5 m² / 69 sq ft each,
  1930 clear; see *The master baths are arches*, above
* entry hall size — kept as drawn, with the lift lobby now shown for reference
* **help's room, the guest WC and the store** — re-cut round the WC's elliptical
  apse. Help's room 4.4 m², WC 3.0, store 2.4; see the section above
* all A-101 furniture — resolved, two pieces moved (see above)
* **the dining table** — a long table seating six, in the parents' pod at the
  serving hatch — replaced by a 1100 × 2200 superellipse turned down the pod,
  six seats, three a side, ends left clear, 1'-10" on both sides. See *The
  dining table is not round*
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
* **the parents' bed and their loose furniture.** Their wardrobes and dressing
  console are in — see the section above. There is no bed in that suite, and
  nothing loose: no chairs, no terrace furniture, no plants
* **the beds.** They are off the drawing for now — a bed sitting in the suite
  while the joinery is being set out only argues with it. One commented line in
  `design.py` brings each one back, mirrored, when the wardrobes are settled

## Still to be confirmed, not by me

* **Deck loading** — the spa, the two grass beds, the fountain and the
  retractable glass roof, all on a 15 420 × 2620 deck along the building edge.
* **How the glass roofs land** — the retractable roof over the deck and the
  high roof over the two terraces.

Neither is a layout question, and neither blocks the next round.
