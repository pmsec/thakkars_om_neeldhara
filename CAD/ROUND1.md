# Round 1 — the layout set out on the builder's shell

**Drawing:** `out/round1-layout.dxf` — the builder's own DXF with the proposal
added on `PROP-*` layers.
**Review image:** `drawings/07-round1-layout.png`.

Freeze the `PROP-*` layers and you have the builder's drawing back, unchanged:
all 15 original modelspace entities, all 351 blocks and all 32 layers are
preserved untouched.

| Layer | What's on it |
|---|---|
| `PROP-WALL-NEW` | new masonry, solid-hatched |
| `PROP-WALL-DEMO` | existing partitions to come out, dashed |
| `PROP-KEEP` | shafts, ducts and voids that must stay clear |
| `PROP-GLAZ` | glazing, sliding glass, the pod screens |
| `PROP-OPEN` | new openings cut in retained masonry |
| `PROP-FURN` | fixed joinery and the pieces that set the plan |
| `PROP-TEXT` | room names and areas |
| `PROP-DIM` | the set-out dimensions |

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
inside the 3220 clear between the lobby columns. **The two existing flat doors
merge into a single 2270 arched opening** into the great room — the builder's
own structure doing the work.

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
| ENTRY GALLERY | 8.4 | 90 |
| KITCHEN | 8.2 | 88 |
| HELP'S ROOM | 5.0 | 54 |
| PARENTS' BATH | 4.4 | 48 |
| KARAN'S BATH | 4.4 | 48 |
| TERRACE ×2 | 3.7 each | 40 each |
| GUEST / SERVICE WC | 2.8 | 30 |
| UTILITY | 1.9 | 20 |
| STORE | 1.8 | 19 |
| **total of named rooms** | **234.1** | **2519** |

The great room is 485 sq ft against A-101's 474, and 7840 across the removed
party wall rather than 7690.

---

## Calls I made — overrule any of them

**The lobby is enclosed to Y 11 125**, the line of the building's own outer
wall, which gives an 8.4 m² entry hall and leaves the lift and fire-lift
landing beyond it as circulation. Extending to the lift doors would add about
4.9 m² and is a one-line change — say the word.

**The recovered 960 × 275 mm** went to the master suites and the great room
along the length, and to the service bay in depth.

**The columns** are buried in walls where they land conveniently and left as
piers where they don't. The two end-wall piers in each suite (Y 1950–3150 and
7745–8945) are well placed to flank a bed or a wardrobe run.

**The pods lose their inner corner** to the service duct — 1000 × 2225 out of
21 m². I've walled it off and made the resulting face the media wall, with
dining in the clear northern half and a pair of chairs in the southern half.

**The furniture is indicative**, not resolved — enough to show the plan works.

---

## For Round 2 — tell me in words

1. Is the entry hall the right size, or do you want the full landing?
2. The baths are now 1530 wide rather than 2100. Deep enough, or would you
   rather steal width from the suite?
3. Dining in the family-room pod, or in the great room near the kitchen hatch?
   The hatch is 1200 wide at X 8600–9800.
4. Help's room and WC are in the east service bay, opposite the kitchen. That
   puts the help's room a long way from the kitchen — swap them?
5. Anything about the suites: bed position, murphy nook, wardrobe runs.

---

## Still to be confirmed, not by me

* That the builder's `DA_WALL` partitions — the party wall in particular — are
  infill and not structural. One answer from whoever holds the structural
  drawings settles it.
* Deck loading: the spa, the two grass beds, the fountain and the glass roof.
* How the retractable deck roof and the two terrace roofs are supported.
