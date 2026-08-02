# 14th floor, Neeldhara — where plan A-101 breaks the builder's structure

Comparison of the proposed plan (A-101 rev 101, and the matplotlib source that
generates it) against the builder's DWG — Daisaria & Associates, redevelopment
of Neeldhara CHS, 15.03.2024.

Everything here is derived from those files. Nothing outside `CAD/` was touched.

**Start with `drawings/06-clash-map.png`.** Grey is the builder's slab; the
white gaps inside it are shafts with no floor; pink is plan floor drawn over
those gaps; red is a column or beam.

---

## Which flats these are

Your two are the mirrored pair in the **west wing** — DWG blocks
`A$C1c7226e4` (north) and `14TH 2` (south), mirrored about the 150 mm party
wall, labelled **RERA 1088 sq ft carpet / 1242 sq ft with balconies** each.
The other two flats on the floor (1073 and 1524 sq ft) are in the east wing
and are not yours.

Plan A-101's model coordinates and the builder's geometry are put in one
frame: **X** runs along the length of the home (0 = the left outer wall
centreline as A-101 draws it), **Y** is depth (0 = the deck parapet
centreline). A-101's own numbers go in unchanged.

---

## The short answer

| | |
|---|---|
| Overflowing the outer walls | **No.** The plan sits inside the shell everywhere — 450–475 mm inside it at each end. |
| Building over ducts / voids / shafts | **Yes — 14.9 m² (160 sq ft), in four places.** Two of them are open shafts running the full height of the building. |
| Breaking beams / columns | **Yes — 10 of the 14 columns in these flats stand inside drawn rooms.** The other 4 fall outside the plan's envelope altogether. A-101 shows none of them. |
| Annexing common property | The absorbed lobby is **8.9 m² of the lift and fire-lift landing**, none of which is inside either flat's carpet area. |

The retained deck voids are the one thing that is handled correctly — the plan
leaves both of them clear.

---

## 1. Outer walls — nothing overflows

Measured from the builder's `DA_BUILDING LINE`, the closed polyline that traces
the slab edge round the whole floor:

| Plan face | Position | Builder slab continues |
|---|---|---|
| West end wall, outer face | X = −120 | **475 mm further** |
| East end wall, outer face | X = 24 600 | **450 mm further** |
| Deck parapet, outer face | Y = −120 | 125 mm further |
| Entry-side wall, outer face | Y = 10 970 | 2000 mm+ (into the lift core) |

So the plan never oversails the slab. The opposite: **there is roughly 330 mm
of clear real floor beyond your drawn wall at each end**, inside the builder's
own 150 mm end wall. That is the same 960 mm shortfall described in §5 seen
from the other side.

---

## 2. Ducts, voids and shafts — 14.9 m² of floor that is not there

This is the serious one. Four zones, all confirmed twice over: they are notches
in the `DA_BUILDING LINE` slab outline **and** notches in the RERA carpet-area
polygons (carpet area excludes shafts by definition).

### 2.1 The main service duct — 1000 × 4950 mm, one at each end — CRITICAL

| | |
|---|---|
| West | X 4555 – 5555, Y 6175 – 11 125 |
| East | X 18 925 – 19 925, Y 6175 – 11 125 |
| Plan floor drawn over it | **4.73 m² (51 sq ft) each side** |
| Rooms affected | parents'/karan's **pod**, **bath**, **suite band**, **wardrobe** |

This is not a small pipe chase. It is a 1 m wide slot cut into the slab from
the south face and running the full depth of the service bay — and it is
**open to sky**. The builder's `M.TOILET 02` and `COMMON TOILET` both have
**windows opening into it** (layer `DA_WINDOW`, at X 4405–4555 and
X 5555–5705). It is the ventilation shaft for the internal toilets on every
floor of the building.

A-101 draws continuous floor straight across it. Nothing in that zone can be
built without closing a shaft that serves the whole stack — which is not a
single-flat decision.

### 2.2 The secondary duct — 1345 × 770 mm, one at each end

| | |
|---|---|
| West | X 5555 – 6900, Y 8550 – 9320 |
| East | X 17 580 – 18 925, Y 8550 – 9320 |
| Plan floor drawn over it | **1.05 m² (11 sq ft) each side** |
| Rooms affected | kitchen and parents' bath (west); guest/service WC and karan's bath (east) |

Same crossed-box convention in the DWG, same open-to-sky boundary, immediately
south of the main duct.

### 2.3 The sealed shaft at each wing end — 1480 × 1200 mm

| | |
|---|---|
| Real opening, west | X 2900 – 4380, Y 0 – 1200 |
| Real opening, east | X 20 100 – 21 580, Y 0 – 1200 |
| A-101 draws its shaft at | X 3200 – 4730 / 19 750 – 21 280, Y 200 – 1550 |
| Plan floor drawn over the real opening | **1.66 m² (18 sq ft) each side** |

The size A-101 gives — 1530 × 1350 — is wrong twice: the real opening is
1480 × 1200, and it sits **300 mm further outboard and 200 mm further north**
than drawn. The consequence is that A-101's **private terrace** floor
(X 0–3200 / 21 280–24 480) runs 300 mm into the real shaft, while A-101's own
shaft box covers 350 mm of real floor that could have been terrace.

There is also a **beam across the shaft head** — layer `DA_BEAM`, X 2900–4380
and 20 100–21 580 at Y 100–250, 1480 × 150. A-101 does not show it, but its own
wing outer wall happens to sit on top of it, so it is a note rather than a clash.

### 2.4 The retained deck voids — correct

| | |
|---|---|
| Real clear opening | 1235 × 1120 mm, X 7730–8965 / 15 515–16 750, Y 1350–2470 |
| A-101 | 1585 × 1350, X 7605–9190 / 15 290–16 875, Y 1270–2620 |
| Plan floor over the opening | **none** |

The plan's void is drawn bigger than, and fully containing, the real one, so
nothing is built over a hole. It is 150 mm off-position towards the centre and
the stated size is wrong, but structurally this one is safe.

---

## 3. Columns and beams — A-101 shows none of the 14

Every column in the two flats (layer `DA_COLUMN`), tested against A-101's own
masonry. "In open room" means the plan draws no wall there, so the column
would be standing free in the middle of the space.

| Column | Size mm | Position | Result |
|---|---|---|---|
| Lift lobby, west jamb | 230 × 1800 | X 10 400, Y 9325 | **78% in the open** — inside the **kitchen** |
| Lift lobby, east jamb | 230 × 1800 | X 13 850, Y 9325 | **78% in the open** — inside the round **entry gallery** |
| Service-bay beam, east | 1495 × 230 | X 17 430, Y 9320 | **90% in the open** — through **karan's bath** |
| Parents' bath | 230 × 1000 | X 5555, Y 9320 | **100% in the open** |
| Wing / deck line, west | 230 × 1200 | X 4300, Y 1200 | 88% in the open — parents' terrace band |
| Wing / deck line, east | 230 × 1200 | X 19 950, Y 1200 | 88% in the open — karan's terrace band |
| Wing, entry side, east | 230 × 1200 | X 19 925, Y 8495 | 62% in the open — karan's wardrobe |
| Wing, entry side, west | 230 × 1000 | X 4325, Y 8695 | 55% in the open — parents' wardrobe |
| Deck void, west | 230 × 1500 | X 7500, Y 1200 | 14% — largely picked up by the void wall |
| Deck void, east | 230 × 1500 | X 16 750, Y 1200 | 14% — same |
| West end wall × 2 | 230 × 1200 | X −600, Y 1950 and 7745 | **outside the plan envelope** |
| East end wall | 230 × 1200 | X 24 850, Y 1950 | **outside the plan envelope** |
| East wing outer wall | 1200 × 230 | X 23 880, Y 9465 | **93% outside the plan envelope** |

Two of these are worth calling out on their own:

* **The round entry gallery.** A-101 centres it at X 13 625 with a 2450
  diameter, so it spans X 12 400 – 14 850. The east lobby column sits at
  X 13 850 – 14 080 — **225 mm off the centre of the round room, straight
  through it.** The round room does not fit where it is drawn; there is 3220 mm
  of clear width between the two lobby columns (X 10 630 – 13 850) and the
  gallery has to live inside that.
* **Karan's bath** is drawn over a 1495 × 230 beam running across it at
  Y 9320 – 9550, as well as over the secondary duct.

---

## 4. Openings and fixed items

* **The main entrance door** (X 13 175 – 14 075 at Y 10 850) runs **225 mm
  into the east lobby column**. The service entry door at X 11 150 – 11 950 is
  clear.
* **Both bath vanities** (X 5380–6730 and 17 750–19 100 at Y 8480–8980) sit
  **0.59 m² over the main service duct** — no floor, and no way to run waste.
* **The tall fridge** (X 9970 – 10 670) lands on the west lobby column, and
  the **curved bench** in the entry gallery lands on the east one.
* **The workout bay's grass** on the deck runs into the west deck-void column.
* The kitchen widening to 3900 pushes its east end to X 10 730, **330 mm into
  the west lobby column** at X 10 400 – 10 630.

---

## 5. The absorbed lobby

A-101 takes `ABSORBED LOBBY 4125 · 13'-6"` as a width along the home. In the
DWG, `LOBBY 13'6" × 11'1"` is **4125 deep and 3378 wide** — the 13'-6" is the
depth, running from the flat doors out to the lift doors.

* Along the home, the lobby is bounded by the two 230 × 1800 columns, giving
  **3220 mm clear**. A-101 draws 4125. That is **905 mm too wide**, and the
  extra lands on both columns and into both kitchens.
* The plan encloses **8.91 m² (96 sq ft)** of that space, and **none of it is
  inside either flat's carpet area** — it is all common property.
* The **FIRE LIFT** and its landing, the **WET RISER**, **E.D.** and **L.V.D.**
  all open off this lobby, and both flat entrances are **F.R.D. (fire-rated
  doors) 01 and 02**. Enclosing it means enclosing a fire-lift landing. That is
  a society and fire-NOC question before it is a design one.

The title block's `ABSORBED LOBBY 109 SQ FT` should read about **89 sq ft** for
the part inside the building's outer wall line; the remaining 1550 mm of the
lobby's depth is the lift landing outside that line.

---

## 6. Why the set-out drifts

Worth knowing because it explains most of §2 and §3 at once.

**A-101 chains the builder's clear room dimensions as if they were centreline
dimensions.** The individual numbers are right — 3845, 3665, 3200, 1530, 2620,
5780, 2450, 3350 are all verbatim from the DWG's own dimension entities. They
have just been added up without the walls between them:

```
A-101, half the home:        3845 + 3665 + 1530 + 3200                       = 12240
Builder, same half:     75 + 3845 + 125 + 3665 + 125 + 1530 + 125 + 3200 + 150 = 12840
                        ^^                ^^^         ^^^         ^^^      ^^^
                     half the        the walls A-101 does not carry     end wall
                    party wall                                      drawn 240, not 150
```

480 mm lost per half, **960 mm over the whole home**, and 275 mm in depth.
Because the plan is short, every fixed thing in the shell — shafts, columns,
the kitchen stack — lands in the wrong place relative to the rooms drawn on it.

| | Builder | A-101 | |
|---|---|---|---|
| Overall length, outer face to outer face | **25 680** | 24 720 | −960 |
| Overall length, centreline to centreline | **25 530** | 24 480 | −1050 |
| Continuous deck | **15 420** | 15 020 | −400 |
| Deck set-out per half | **3050 + 1535 + 3050** | 2875 + 1585 + 3050 | −125 |
| Great room across the party wall | **7840** | 7690 | −150 |
| Master suite depth (two bedrooms merged) | **8195** | 8070 | −125 |
| Total depth | **11 125** | 10 850 | −275 |
| Wing depth, centreline to centreline | **9570** | 9170 | −400 |

The note `VOID SET-OUT PER BUILDER · 2875 + 1585 + 3050 = 7510` is not the
builder's set-out. The DWG carries this as one contiguous dimension string
along the deck edge, X 4530 to 19 950:

```
3050 + 1535 + 3050  |  150 party wall  |  3050 + 1535 + 3050   =  15 420
```

On A-101's own gross-area basis (`15020 × 10850 + 2 × 4730 × 9170`, which
reproduces its printed 249.7 m² exactly), the real shell is **270.4 m² /
2911 sq ft** against the **249.7 m² / 2688 sq ft** printed — about **223 sq ft
of real home the plan does not draw**.

---

## 7. Corrected set-out

Half the home, from the party wall centreline outwards; mirror for the other half.

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

Deck set-out per half, from the wing wall inwards: **3050 + 1535 + 3050**,
150 party wall at the centre, continuous deck **15 420**.

### Things that cannot move

| Item | X | Y | Size |
|---|---|---|---|
| Main service duct (open shaft) | 4555–5555 / 18 925–19 925 | 6175–11 125 | 1000 × 4950 |
| Secondary duct (open shaft) | 5555–6900 / 17 580–18 925 | 8550–9320 | 1345 × 770 |
| Sealed shaft, wing ends | 2900–4380 / 20 100–21 580 | 0–1200 | 1480 × 1200 |
| Retained deck voids | 7730–8965 / 15 515–16 750 | 1350–2470 | 1235 × 1120 clear |
| Lift-lobby columns | 10 400–10 630 and 13 850–14 080 | 9325–11 125 | 230 × 1800 |
| Wing / deck-line columns | 4300–4530 and 19 950–20 180 | 1200–2400 | 230 × 1200 |
| Deck-void columns | 7500–7730 and 16 750–16 980 | 1200–2700 | 230 × 1500 |
| End-wall columns | −600 to −370 and 24 850–25 080 | 1950–3150 | 230 × 1200 |
| Service-bay beam, east | 17 430–18 925 | 9320–9550 | 1495 × 230 |
| Shaft-head beams | 2900–4380 / 20 100–21 580 | 100–250 | 1480 × 150 |
| Kitchen stack | 14 080–17 430 / 7050–10 400 | 8525–10 975 | 3350 × 2450 |
| Clear width for the entry gallery | 10 630–13 850 | — | 3220 |

One caveat: the two unit blocks in the DWG are mirrored but not byte-identical,
and a few columns are drawn on one side only. The tables above are what the DWG
draws. Assume the mirror exists, and have it confirmed on site before relying
on a column *not* being somewhere.

---

## 8. Files

```
CAD/
  README.md                             this report
  drawings/
    06-clash-map.png/.svg               START HERE - every clash on one sheet
    01-overlay-whole-home                A-101 in grey over the builder shell
    02-wing-end-and-sealed-shaft         the sealed-shaft mismatch
    03-deck-and-retained-void            the void set-out and its column
    04-entry-lobby-and-east-bay          the lobby and its columns
    05-builder-14th-floor-context        the whole floor, for orientation
  data/
    clashes.csv                          every clash, machine readable
    column-clashes.csv                   each column vs A-101's masonry
    setout-comparison.csv                builder figure vs A-101 figure
    builder-dimensions.json              all 320 DIMENSION entities from the DWG
  source/
    14th_floor_neeldhara_2.dwg           as supplied
    floorplan-A101-rev101.pdf            as supplied
    floor14.dxf.gz                       DWG converted to DXF (gzipped)
    builder-geometry.json                flattened CAD geometry, shell only
  tools/
    frame.py            the common measurement frame
    plan_model.py       A-101 transcribed from its own matplotlib source
    extract_dwg.py      DXF -> geometry + dimensions
    clash.py            the structural audit
    draw.py             drawings 01-05
    draw_clash.py       drawing 06
    analyse.py          the set-out comparison
```

## 9. Reproducing

The DWG is AutoCAD 2018 (AC1032), which ezdxf cannot read, so convert it first
with LibreDWG:

```bash
dwg2dxf -o CAD/source/floor14.dxf CAD/source/14th_floor_neeldhara_2.dwg
pip install ezdxf pymupdf matplotlib
cd CAD
python3 tools/extract_dwg.py source/floor14.dxf
python3 tools/clash.py          # the structural audit
python3 tools/analyse.py        # the set-out comparison
python3 tools/draw.py && python3 tools/draw_clash.py
```

Three things make this a measurement rather than a visual fit:

1. **A-101's geometry is taken from its own source**, not traced off the PDF —
   the plan's model coordinates and the frame used here are the same system, so
   its numbers go in unchanged. (The PDF is used as a cross-check: its deck is
   1049.94 pt for 15 020 mm, giving 14.30559 mm/pt, at which every wall on the
   sheet lands on a round number.)
2. **The alignment uses two structural anchors**, both confirmed by the DWG's
   own dimension entities: the party-wall centreline and the 5780 mm main body.
3. **Where floor exists is read from two independent layers that agree** —
   `DA_BUILDING LINE`, the closed slab-edge polyline, and the RERA carpet-area
   polygons, which exclude every shaft by definition.

---

*A dimensional and set-out review only. It is not a structural assessment — the
DWG shows column outlines, not sizes, reinforcement or load paths — and it does
not cover anything needing society, fire or municipal approval, of which the
lobby absorption is the obvious one.*
