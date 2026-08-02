# 14th floor, Neeldhara — builder CAD vs. proposed plan A-101

Comparison of the builder's DWG (`14th_floor_neeldhara_2.dwg`, Daisaria &
Associates, redevelopment of Neeldhara CHS, dated 15.03.2024) against the
proposed furniture layout plan A-101 rev 101.

Everything in this folder is derived from those two files. Nothing outside
`CAD/` was touched.

---

## 1. Which flats these are

The 14th floor holds four flats. Yours are the two in the **west wing**:
blocks `A$C1c7226e4` (north) and `14TH 2` (south), exact mirror images of each
other about the 150 mm party wall at CAD y = 44409. The builder labels each of
them **RERA 1088 sq ft** carpet / **1242 sq ft** with balconies. The other two
flats (`11TH 2nd` at 1073 sq ft and `11TH 3` at 1524 sq ft) are in the east
wing and are not yours.

The correspondence to A-101 is exact and unambiguous — every room on A-101 maps
onto a builder room:

| A-101 | Builder DWG |
|---|---|
| MASTER SUITE 3200 × 8070 | M.BEDROOM 01 (13'6"×10'6") + M.BEDROOM 02 (13'0"×10'6") merged |
| TERRACE UNDER HIGH GLASS ROOF | BALCONY 3'7"×10'2" |
| SEALED SHAFT, no access | S.S. + VOID at the wing end |
| FAMILY ROOM / MUSIC + WORK DEN, 3665 bay | MULTIPURPOSE ROOM 7'4"×12' |
| GREAT ROOM, 3845 bays | LIVING ROOM 19'0"×12'7", ×2 |
| ALL-WEATHER DECK, 2620 deep | BALCONY 8'7"×10', ×2 |
| VOID 1585 × 1350 "retained" | the void/duct box in the deck, ×2 |
| KITCHEN, "retained on the existing stack" | KITCHEN 8'×11', ×2 |
| GUEST / SERVICE WC, HELP'S ROOM, LAUNDRY | the east service bay of both flats |
| ABSORBED LOBBY 4125 | LOBBY 13'6"×11'1" (the common lift lobby) |

---

## 2. The one mistake that causes most of the others

**A-101 chains the builder's clear room dimensions as if they were centreline
dimensions.** Every internal wall between two rooms has been dropped from the
running dimension.

The builder's numbers on A-101 are individually right — 3845, 3665, 3200,
1530, 2620, 5780, 2450, 3350 are all verbatim from the DWG's own dimension
entities. They have just been added up without the walls in between:

```
A-101, half the home:        3845 + 3665 + 1530 + 3200          = 12240
Builder, same half:     75 + 3845 + 125 + 3665 + 125 + 1530 + 125 + 3200 + 150 = 12840
                        ^^                ^^^         ^^^         ^^^      ^^^
                     half the        the walls A-101 does not carry     end wall
                    party wall                                       drawn 150, not 240
```

That is **480 mm lost per half, 960 mm over the whole home**, and the same
thing happens in the depth direction (150 + 125 = **275 mm lost**).

The consequence is not that the plan is too big — it is that the plan is
**too small**, and therefore every fixed thing in the building (voids, shafts,
columns, the kitchen stack) sits in the wrong place relative to the rooms
drawn on it.

---

## 3. Where the plan breaks the architectural plan

Ordered by how much it matters. Frame coordinates are as used in the drawings:
**X** runs along the length of the home, **Y** is the depth from the deck
parapet, both in millimetres.

### 3.1 The overall envelope is 960 mm short — CRITICAL

| | Builder DWG | A-101 | |
|---|---|---|---|
| Overall length, outer face to outer face | **25 680** | 24 720 | **−960 mm** |
| Overall length, wall centreline to centreline | **25 530** | 24 480 | **−1050 mm** |
| Total depth, deck face to service-bay face | **11 125** | 10 850 | **−275 mm** |
| Wing depth, centreline to centreline | **9 570** | 9 170 | **−400 mm** |

The note `OVERALL 24 480 mm · 80'-4"` should read **25 530** on a centreline
basis, or 25 680 face to face (84'-2"). The dimension is wrong by about 3'-5".

On A-101's own gross-area basis (`15020 × 10850 + 2 × 4730 × 9170`, which
reproduces its printed 249.7 m² exactly), the real shell works out at
**270.4 m² / 2911 sq ft** against the **249.7 m² / 2688 sq ft** printed.
There is roughly **20 m² (223 sq ft) of real home the plan does not draw.**

See `drawings/01-overlay-whole-home.png` — the grey plan sits inside the black
builder shell, with a real column and a real end wall stranded outside it at
each end.

### 3.2 The "VOID SET-OUT PER BUILDER" note is not the builder's set-out — CRITICAL

A-101 states `2875 + 1585 + 3050 = 7510 = MPR 3665 + LIVING 3845`, and derives
a 15 020 continuous deck from it.

The builder's DWG carries this dimension string along the deck edge, as one
contiguous chain, spanning X 4530 to 19950:

```
3050 + 1535 + 3050  |  150 party wall  |  3050 + 1535 + 3050   =  15 420
```

So:

| | Builder | A-101 | |
|---|---|---|---|
| Wing wall to void | **3050** | 2875 | −175 |
| Void, along the deck | **1535** | 1585 | +50 |
| Void to centreline | 3050 | 3050 | ✓ |
| **Continuous deck** | **15 420** | 15 020 | **−400 mm** |

The `15 020 · 49'-3"` on the deck dimension line should be **15 420 (50'-7")**,
and the two halves are separated by a 150 mm party wall that the note ignores.

### 3.3 The retained void is mis-set-out and mis-labelled — HIGH

The builder's void, measured off the wall faces:

* clear opening **1235 × 1120**
* structural box, outer face to outer face **1615 × 1420** (X 15 365–16 980,
  Y 1200–2700)
* allowance in the deck chain **1535**

A-101 calls it **1585 × 1350** and draws its box at X 15 215–16 950,
Y 1195–2695 — **shifted 150 mm towards the centre of the home**, and 80 mm
deeper than the real one.

Worse, the outboard side of the real void is not a wall at all: it is a
**230 × 1500 structural column**. A-101 draws a 150 mm wall there. See
`drawings/03-deck-and-retained-void.png`.

### 3.4 The sealed shaft is drawn in the wrong place — HIGH

A-101: `SEALED SHAFT · no access · 1530 × 1350`, box at X 19 750–21 280,
Y 200–1550 (mirrored at the other end).

The builder's shaft at the wing end is an S.S. (hatched, 1480 × 350) plus a
VOID (1480 × 600) inside one enclosure at **X 20 100–21 580, Y 150–1200** —
1530 wide as A-101 says, but only **1050 deep, not 1350**, and sitting
**275–375 mm further outboard**.

Net effect at each end of the home:

* a strip about **225 × 880 mm of A-101's terrace floor is actually open
  shaft.** Small in area, but it is a hole in the slab, not a wall you can
  move — the terrace as drawn has no floor there;
* A-101's shaft wall at X 21 205–21 355 would be built **over** the real
  shaft opening;
* A-101's shaft runs 275 mm deeper into the plan than the real one, so about
  **275 × 1380 mm of real terrace floor is drawn as shaft** and thrown away.

See `drawings/02-wing-end-and-sealed-shaft.png`.

### 3.5 No columns are shown, and eight of them stand in drawn rooms — HIGH

The DWG has **14 columns** in these two flats (layer `DA_COLUMN`). A-101 shows
none. Running each one against A-101's masonry (`data/column-clashes.csv`):

| Column | Size | Result |
|---|---|---|
| West end wall, deck side | 230 × 1200 | **outside the plan entirely** |
| West end wall, entry side | 230 × 1200 | **outside the plan entirely** |
| East end wall, deck side | 230 × 1200 | **outside the plan entirely** |
| East wing outer wall | 1200 × 230 | 60% inside the plan, 95% in open space |
| West wing / deck line | 230 × 1200 | stands in the drawn terrace |
| East wing / deck line | 230 × 1200 | stands in the drawn terrace |
| Lift lobby, west jamb | 230 × 1800 | stands in the drawn kitchen / lobby |
| Lift lobby, east jamb | 230 × 1800 | stands in the drawn lobby / help's room |
| Service-bay beam, east | 1495 × 230 | stands in the drawn Karan's bath |
| Parents' bath zone | 230 × 1000 | stands in the drawn parents' bath |
| West wing, entry side | 230 × 1000 | 76% in the drawn parents' suite |
| East wing, entry side | 230 × 1200 | 80% in the drawn Karan's suite |
| Retained void, both sides | 230 × 1500 | mostly resolved, ~30% projecting |

The three "outside the plan entirely" columns are the clearest proof of §3.1:
they are real, they are structural, and the plan is too short to contain them.

One caveat: the two unit blocks in the DWG are mirrored but not byte-identical,
and a few columns appear on one side only. The list above is what the DWG
actually draws. Assume the mirror exists and have it confirmed on site before
committing to anything that depends on a column *not* being there.

### 3.6 The absorbed lobby is 905 mm wider than the physical opening — HIGH

A-101 draws `ABSORBED LOBBY 4125 · 13'-6"` as a **width** along the home, and
fits a 2450-diameter round ENTRY GALLERY into it.

In the DWG, `LOBBY 13'6" × 11'1"` is **4125 deep and about 3378 wide** — the
13'-6" is the depth, running from the flat doors out to the lift doors. Along
the home, the lobby is bounded by two **230 × 1800 columns** at X 10 400–10 630
and X 13 850–14 080, giving **3220 mm clear**, 3680 mm over the columns.

So A-101's absorbed lobby is **905 mm too wide**, and its side walls land on
and past those two columns and into both kitchens.

The 2450 round room itself does fit in the 3220 clear — that part works. What
does not work is the width the dimension claims.

Two further points on this area, both non-dimensional but load-bearing for
approvals:

* Of the lobby's 4125 depth, only about **2575 mm lies inside the building's
  outer wall line** (Y 8550–11 125). The remaining 1550 mm is the lift landing
  itself, outside that line. The enclosable part is roughly **89 sq ft**, not
  the 109 sq ft claimed.
* The DWG shows the **FIRE LIFT** and its landing, a **WET RISER**, **E.D.**
  and **L.V.D.** opening off this lobby, and both flat entrances are **F.R.D.
  (fire-rated doors) 01 and 02**. Enclosing the lobby means enclosing a fire
  lift landing — a society and fire-NOC question before it is a design one.

See `drawings/04-entry-lobby-and-east-bay.png`.

### 3.7 Smaller things

* **Great room across the party wall.** A-101 says `GREAT ROOM AT DECK 7690`,
  which is 3845 + 3845. The party wall between them is 150, so the real figure
  is **7840**.
* **Master suite depth.** A-101 says `3200 × 8070`. 8070 is 4110 + 3960, the
  two bedrooms; the 125 mm wall between them makes the real depth **8195**.
  The 3200 width is correct.
* **Kitchen widening.** The kitchen is correctly identified as 3350 × 2450 on
  the existing stack. Widening it to 3900 pushes it **330 mm east into the
  lift-lobby column** at X 10 400–10 630. The widening works to about 3550,
  not 3900, unless the column is picked up.
* **Deck inner edge.** A-101's deck runs to Y 2620, which is the *inner* face
  of the existing 150 mm wall between balcony and living room. The real deck
  stops at Y 2470. Fine if that wall is being removed — it is a partition, not
  structure — but it should be shown as removed rather than absorbed.
* **Wing set-back.** `wings set back 200 from the deck line — per builder`.
  The DWG has the deck parapet at Y −250 and the wing/terrace edge at Y 0, so
  the set-back is **250**, not 200.
* **Master bathrooms.** A-101's 2100 × 2450 baths sit in the service bay. The
  builder's M.TOILET 01/02 are 2430 × 1530 and sit in the wing. This is a
  relocation, not an error — but note that Karan's bath as drawn sits over the
  **DRY BALCONY** sunk slab (good, drainage is already there) and over the
  1495 × 230 beam in §3.5 (not good).

---

## 4. What A-101 gets right

Worth saying, because most of the drawing is sound:

* Deck depth **2620**, main body **5780**, service bay **2450** — all exact.
* Living bay **3845**, family/den bay **3665**, bedroom width **3200**,
  terrace strip **1530**, kitchen **3350 × 2450** — all exact.
* The mirror geometry, the party-wall centreline, and the identification of
  which walls are structural and which are partitions are all correct.
* The retained-void and sealed-shaft *concept* is right; only the numbers and
  positions are off.

The drawing is not wrong in kind. It is wrong in arithmetic, and the arithmetic
error runs one way — everything is drawn slightly small.

---

## 5. Corrected set-out to work from

Half the home, from the party wall centreline outwards. Add the mirror.

| From centre | To | Element | Dimension |
|---|---|---|---|
| 0 | 75 | half the party wall | 75 |
| 75 | 3920 | LIVING bay | **3845** |
| 3920 | 4045 | wall | 125 |
| 4045 | 7710 | FAMILY ROOM / MUSIC DEN bay | **3665** |
| 7710 | 7835 | wall | 125 |
| 7835 | 9365 | terrace / shaft strip | **1530** |
| 9365 | 9490 | wall | 125 |
| 9490 | 12 690 | MASTER SUITE | **3200** |
| 12 690 | 12 840 | end wall | 150 |
| | | **half overall** | **12 840** |

Depth, from the deck parapet face:

| From | To | Element | Dimension |
|---|---|---|---|
| −250 | −150 | deck parapet | 100 |
| −150 | 2470 | DECK | **2620** |
| 2470 | 2620 | wall (removable partition) | 150 |
| 2620 | 8400 | MAIN BODY | **5780** |
| 8400 | 8525 | wall | 125 |
| 8525 | 10 975 | SERVICE BAY | **2450** |
| 10 975 | 11 125 | external wall | 150 |

Deck set-out, per half, from the wing wall inwards: **3050 + 1535 + 3050**,
with a 150 party wall at the centre. Continuous deck **15 420**.

Fixed items that must not move:

| Item | Position (X) | Position (Y) | Size |
|---|---|---|---|
| Retained void, east | 15 365 – 16 980 | 1200 – 2700 | 1615 × 1420 outer, 1235 × 1120 clear |
| Retained void, west | 7500 – 9115 | 1200 – 2700 | mirror |
| Sealed shaft, east | 20 100 – 21 580 | 150 – 1200 | 1480 × 1050 clear |
| Sealed shaft, west | 2900 – 4380 | 150 – 1200 | mirror |
| Lift-lobby columns | 10 400 – 10 630 and 13 850 – 14 080 | 9325 – 11 125 | 230 × 1800 |
| Wing/deck columns | 4300 – 4530 and 19 950 – 20 180 | 1200 – 2400 | 230 × 1200 |
| Void-side columns | 7500 – 7730 and 16 750 – 16 980 | 1200 – 2700 | 230 × 1500 |
| End-wall columns | −600 – −370 and 24 850 – 25 080 | 1950 – 3150 | 230 × 1200 |
| Service-bay beam | 17 430 – 18 925 | 9320 – 9550 | 1495 × 230 |
| Kitchen stack | 14 080 – 17 430 (mirror 7050 – 10 400) | 8525 – 10 975 | 3350 × 2450 |

---

## 6. Files

```
CAD/
  README.md                             this report
  drawings/
    01-overlay-whole-home.png/.svg      A-101 in grey, builder shell in black
    02-wing-end-and-sealed-shaft        the sealed shaft mismatch
    03-deck-and-retained-void           the void set-out and its column
    04-entry-lobby-and-east-bay         the absorbed lobby and its columns
    05-builder-14th-floor-context       the whole floor, for orientation
  data/
    builder-dimensions.json             all 320 DIMENSION entities from the DWG
    setout-comparison.csv               builder figure vs A-101 figure
    column-clashes.csv                  each column vs A-101's masonry
  source/
    14th_floor_neeldhara_2.dwg          as supplied
    floorplan-A101-rev101.pdf           as supplied
    floor14.dxf.gz                      DWG converted to DXF (gzipped)
    builder-geometry.json               flattened CAD geometry, shell only
  tools/
    frame.py                            the common measurement frame
    extract_dwg.py                      DXF -> geometry + dimensions
    draw.py                             produces drawings/
    analyse.py                          produces data/*.csv
```

## 7. Reproducing this

The DWG is AutoCAD 2018 (AC1032), which ezdxf cannot read, so it is converted
first with LibreDWG:

```bash
dwg2dxf -o CAD/source/floor14.dxf CAD/source/14th_floor_neeldhara_2.dwg
pip install ezdxf pymupdf
cd CAD
python3 tools/extract_dwg.py source/floor14.dxf
python3 tools/draw.py
python3 tools/analyse.py
```

Two things make the comparison trustworthy rather than a visual fit:

1. **The PDF scale is exact.** A-101's deck is 1049.94 pt long and dimensioned
   15 020 mm, giving 14.30559 mm/pt. At that scale every wall on the sheet
   lands on a round number — 240 and 150 mm walls, 9170 wing depth, 24 480
   overall, 1585 × 1350 voids. The scale is not approximated.
2. **The alignment uses two structural anchors**, both confirmed by the DWG's
   own dimension entities: the party-wall centreline (the mid-point of the
   home on both drawings) and the 5780 mm main body. Neither was eyeballed.

---

*Concept-stage review of dimensions and set-out only. Not a structural
assessment, and not a check of anything that needs society, fire or municipal
approval — of which the lobby absorption is the obvious one.*
