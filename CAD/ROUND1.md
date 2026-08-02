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
| `PROP-REF` | the builder's indicative partition layout — **layer off** |
| `PROP-REF-CORE` | the lift lobby, lifts and fire lift beyond the flat |
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
wall, which gives an 8.4 m² entry hall. The lift lobby, the lift and the fire
lift beyond it are now drawn on the sheet for reference, boxed and labelled as
common. Extending the flat to the lift doors would add about 4.9 m² and is a
one-line change — say the word.

**There is nothing to demolish.** You took the flats as bare shell, so every
wall in the layout is new. What is drawn as existing is only the shell: the
external walls and the enclosures round the shafts, ducts and voids — which
have to be there, because those are open holes in the slab. The builder's
indicative partition layout is on `PROP-REF`, switched off, in case it is ever
useful for seeing where they intended plumbing.

**The recovered 960 × 275 mm** went to the master suites and the great room
along the length, and to the service bay in depth.

**The columns** are buried in walls where they land conveniently and left as
piers where they don't. The two end-wall piers in each suite (Y 1950–3150 and
7745–8945) are well placed to flank a bed or a wardrobe run.

**The pods lose their inner corner** to the service duct — 1000 × 2225 out of
21 m². I've walled it off and made the resulting face the media wall, with
dining in the clear northern half and a pair of chairs in the southern half.

**Every piece of furniture from A-101 is now resolved onto the real shell.**
Where a piece could stay exactly where A-101 draws it, it did. Two had to move
and both are noted on the drawing:

* the **dining table** — A-101 puts it in the parents' pod at (6420, 6900).
  That corner is now the service duct, and the pod's remaining lower half is
  2350 wide against the 2520 the 1400 table and its six chairs need. It has
  moved into the great room beside the serving hatch, which also puts it next
  to the kitchen. Say the word if you want it back in the pod at a smaller
  size, or somewhere else entirely.
* the **wall TV** — A-101 puts it at X 4790, also inside the duct. It moves on
  to the new wall that closes the duct, facing the same way into the pod.

One thing I trimmed: A-101 has one hanging run in the dressing strip, but I had
drawn two facing each other, which left only 330 mm to walk through. It is back
to one 600-deep run with 930 clear alongside, plus a shelved cupboard.

---

## Settled in this round

* entry hall size — kept as drawn, with the lift lobby now shown for reference
* baths — left as they are
* help's room and WC — left where they are
* all A-101 furniture — resolved, two pieces moved (see above)
* internal walls — the flats came as bare shell, so there is nothing to
  demolish and no question about which existing walls are load-bearing. The
  only fabric that has to stay is the shell, and none of the layout touches it.

## Open for the next round

* the dining table's new home, if the great room is not where you want it
* anything about the suites: bed position, murphy nook, cupboard runs
* the entry gallery's four openings — north to the great room, south to the
  entrance, west to the kitchen, east to help's room

## Still to be confirmed, not by me

* **Deck loading** — the spa, the two grass beds, the fountain and the
  retractable glass roof, all on a 15 420 × 2620 deck along the building edge.
* **How the glass roofs land** — the retractable roof over the deck and the
  high roof over the two terraces.

Neither is a layout question, and neither blocks the next round.
