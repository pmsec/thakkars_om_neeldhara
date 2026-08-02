"""
Round 1 layout — A-101's brief, set out on the builder's real structure.

All coordinates are in the frame defined by frame.py: X along the length of the
home, Y depth from the deck parapet, millimetres.  The frame is the same system
A-101's own source uses, so where a room is unchanged its numbers are unchanged.

Nothing here touches a column, a beam, a shaft, a duct or a void.  The list of
those is in clash.py and is treated as immovable.

What moved, and why
-------------------
* The envelope grows to the builder's real one: 25 680 long instead of 24 720,
  and 11 375 deep instead of 11 090.  Every bay below is set out from the
  builder's own dimension chains, not from A-101's running totals.

* The two master baths leave the service bay.  A-101 put them at X 4730-6830
  and 17 650-19 750, which is almost entirely the 1000 x 4950 open service
  duct.  They move into the wing strips, at the south end, against the same
  duct - which is what that duct is for: the builder's own M.TOILET 02 and
  COMMON TOILET ventilate into it through windows.  The baths gain a real
  window instead of a mechanical shaft.

* The wing strip becomes dressing + bath instead of dressing alone, and the
  wall between suite and strip comes out for the northern 5300, so the suite
  reads as one L-shaped room as the brief asks.

* The service bay keeps only what physically fits between the ducts: the
  kitchen on its existing stack, the entry hall between the two lobby columns,
  and help's room + WC in the mirrored bay.  Laundry and store move into the
  two dry balconies, which is what they were built as.

* The entry gallery is re-centred on the home's centreline at X 12240 and sits
  inside the 3220 clear between the lobby columns.  The two existing flat
  doors merge into one 2270 arched opening to the great room.

* The absorbed lobby is enclosed to Y 11 125 - the line of the building's own
  outer wall - which leaves the lift and fire-lift landing beyond it as
  circulation.  Extending to the lift doors is a one-line change if wanted.
"""

# --------------------------------------------------------------- shell datums
END_W, END_E = -600, 25080          # outer faces of the end walls
DECK_N, DECK_S = -150, 2470         # deck, inner faces
BODY_N, BODY_S = 2620, 8400         # main body
BAY_N, BAY_S = 8525, 10975          # service bay
WING_S = 9545                       # wing inner face of the south wall
MID = 12240                         # centreline of the home

# bay lines along the length, west half (mirror with M())
SUITE_W_E = 2750        # suite / strip
STRIP_W0, STRIP_W1 = 2875, 4405     # dressing + bath strip, clear
POD_W0 = 4530           # wing wall / pod
POD_W1 = 8195           # family-room bay, 3665
LIV_W0 = 8320           # living bay, 3845
DUCT_W0, DUCT_W1 = 4555, 5555       # main service duct - KEEP CLEAR
BATH_N = 6650           # dressing / bath split


# The two retained deck voids stay exactly as built: opening plus the builder's
# own enclosure (a 230 column on the outboard face, 150 walls elsewhere).
VOID_KEEP = [(7500, 1200, 9115, 2620), (2 * 12240 - 9115, 1200, 2 * 12240 - 7500, 2620)]


def M(v):
    """mirror a length-axis coordinate about the centre of the home"""
    return 2 * MID - v


# --------------------------------------------------------------------- rooms
# (name, subtitle, list of rectangles, note)
ROOMS = [
    ("MASTER SUITE", "PARENTS",
     [(END_W + 150, 1350, STRIP_W1, BATH_N), (END_W + 150, BATH_N, SUITE_W_E, WING_S)],
     "one room  ·  bed + dressing, joinery to be designed"),
    ("MASTER SUITE", "KARAN",
     [(M(STRIP_W1), 1350, END_E - 150, BATH_N), (M(SUITE_W_E), BATH_N, END_E - 150, WING_S)],
     "one room  ·  bed + dressing, joinery to be designed"),
    ("TERRACE", "PARENTS", [(-350, 0, SUITE_W_E, 1200)],
     "under high glass roof"),
    ("TERRACE", "KARAN", [(M(SUITE_W_E), 0, M(-350), 1200)],
     "under high glass roof"),
    ("PARENTS' BATH", "", [(STRIP_W0, BATH_N, STRIP_W1, WING_S)],
     "window east into the builder's service duct"),
    ("KARAN'S BATH", "", [(M(STRIP_W1), BATH_N, M(STRIP_W0), WING_S)],
     "window west into the builder's service duct"),
    ("FAMILY ROOM", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay"),
    ("MUSIC + WORK DEN", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay"),
    ("GREAT ROOM", "", [], "living + dining  ·  opens to the deck"),
    ("ALL-WEATHER DECK", "", [(POD_W0, DECK_N, M(POD_W0), DECK_S)],
     "15 420 long × 2620 deep  ·  net of the two retained voids"),  # voids cut out below
    # KITCHEN, ENTRY GALLERY and HELP'S ROOM are not rectangles — the gallery
    # is a free-standing drum and the two rooms run up to it.  See
    # retrofit.lobby_polys().
    ("UTILITY", "", [(5705, 9470, 6900, 11025)], "the builder's dry balcony"),
    ("GUEST / SERVICE WC", "", [(16280, BAY_N, 17430, BAY_S)], ""),
    ("STORE", "", [(17580, 9550, 18825, 10975)], "the builder's dry balcony"),
]

# ------------------------------------------------------------------- new walls
# (x1, y1, x2, y2, thickness, [(from, to) openings along the wall])
T_INT, T_THIN = 150, 110

NEW_WALLS = [
    # --- wing strips: bath enclosure, both ends
    (SUITE_W_E + 62, BATH_N, STRIP_W1 + 75, BATH_N, T_INT, [(150, 1050)]),
    (SUITE_W_E + 62, BATH_N, SUITE_W_E + 62, WING_S, T_INT, []),
    (M(SUITE_W_E + 62), BATH_N, M(STRIP_W1 + 75), BATH_N, T_INT, [(150, 1050)]),
    (M(SUITE_W_E + 62), BATH_N, M(SUITE_W_E + 62), WING_S, T_INT, []),

    # --- suite <-> pod, the 125 line between the two.  The 1050 slider is a
    #     gap left in this wall; it is not a hole cut in anything.
    (STRIP_W1 + 62, 1200, STRIP_W1 + 62, BATH_N, 125, [(3775, 4825)]),
    (M(STRIP_W1 + 62), 1200, M(STRIP_W1 + 62), BATH_N, 125, [(3775, 4825)]),

    # --- family-room / music-den pods: wall off the service duct
    (DUCT_W1 + 75, 6175, DUCT_W1 + 75, BODY_S, T_INT, []),
    (M(DUCT_W1 + 75), 6175, M(DUCT_W1 + 75), BODY_S, T_INT, []),

    # --- service bay, north wall: great room / pods above, service bay below.
    #     Broken either side of the 1050 door into the entry gallery.  The
    #     kitchen door, the serving hatch and help's room door are gaps in it.
    (6900, 8462.5, 11715, 8462.5, 125, [(400, 1300), (1700, 2900)]),
    (12765, 8462.5, 17580, 8462.5, 125, [(1935, 2835)]),

    # --- service bay
    # (the kitchen / utility wall is gone — the two are one space now)
    (M(7050 - 75), BAY_N, M(7050 - 75), BAY_S, T_INT, [(1275, 2075)]),  # WC / store
    (16205, BAY_N, 16205, BAY_S, T_THIN, [(1050, 1850)]),          # help's room / WC

    # --- the absorbed lobby: new entrance wall on the building line, sitting
    #     in the 150 between the service bay and the building line.  One door,
    #     centred on the home, lining up with the drum's south opening.
    (10630, 11050, 13850, 11050, T_INT, [(1085, 2135)]),
]

# The entry gallery: a U on plan, the same 230 as the columns it is built on,
# so column and wall read as one continuous piece rather than a thin thing
# stuck beside a thick one.
#
# The two legs sit exactly on the two 230 x 1800 columns.  The curve is a
# SEGMENTAL ARCH springing off the top corner of each column and rising to the
# great-room wall at the crown.  A semicircle cannot do that: tangent to the
# legs it must spring half the span below the crown, which is 800 south of
# where the columns stop, and that leaves a wedge of gap between the column and
# the curve.  A segmental arch springs where the columns actually end.
#
import math as _m
import math

T_GAL = 230                                    # same as the column, so it reads
GAL_W, GAL_E = 10400, M(10400)                 # OUTER faces of the two columns
COL_N = 9325                                   # top of the two columns
GAL_CX = MID
GAL_DOOR_W, GAL_DOOR_E = 11715, 12765          # both doors, on the centreline

# The two legs sit exactly on the columns, so the column IS the leg.
GAL_LEGS = [(GAL_W, COL_N, GAL_W + T_GAL, 11125),
            (GAL_E - T_GAL, COL_N, GAL_E, 11125)]

# The curve is a segmental arch springing off the top corner of each column —
# no gap, nothing left over — and rising to touch the great-room wall at the
# crown.  A semicircle cannot do both: tangent to the legs it would have to
# spring 1610 below the crown, which is 800 south of where the columns end, and
# that is the gap.  A segmental arch springs where the columns actually stop.
_HALF = MID - (GAL_W + T_GAL / 2)              # 1725, leg centreline to centre
# The crown rides 60 up into the great-room wall, so that the arch still
# meets that wall at the two door jambs instead of stopping 50 short of it.
_CROWN = BAY_N + T_GAL / 2 - 60                # 8580, centreline at the crown
_SAG = COL_N - _CROWN                          # 685, rise of the arch
GAL_R = (_HALF ** 2 + _SAG ** 2) / (2 * _SAG)  # 2514.5
GAL_CY = _CROWN + GAL_R                        # 11154.5


def _ang(x, y):
    return _m.degrees(_m.atan2(y - GAL_CY, x - GAL_CX)) % 360


_A0, _A1 = _ang(GAL_W + T_GAL / 2, COL_N), _ang(GAL_E - T_GAL / 2, COL_N)
_D0 = _ang(GAL_DOOR_W, GAL_CY - _m.sqrt(GAL_R ** 2 - (GAL_DOOR_W - MID) ** 2))
_D1 = 540 - _D0

# centre, centreline radius, thickness, gaps in degrees (Y down, 0 = east).
# The first gap wraps past 0 and kills everything below the springings.
# The arch carries all three doors, because it is the only part of the U that
# is not a column.  It spans 93 degrees — 3864 of arc — and 1050 + 700 + 700
# of that is opening, so what is left is four piers.  They are set out evenly,
# 350 each, rather than left to fall where they may.
_SVC = math.degrees(700 / GAL_R)                 # a 700 service door
_PIER = ((_A1 - _A0) - (_D1 - _D0) - 2 * _SVC) / 4
GALLERY = (GAL_CX, GAL_CY, GAL_R, T_GAL,
           [(_A1 + 0.2, _A0 - 0.2),              # below the two springings
            (_D0, _D1),                          # 1050 at the crown, great room
            (_A0 + _PIER, _A0 + _PIER + _SVC),   # 700 service door, to the kitchen
            (_A1 - _PIER - _SVC, _A1 - _PIER)])  # 700 service door, to help's room

# The U's two straight legs, wood, lining the inner face of each column.
# The straight legs, 230 on the column footprint: the column IS the leg, so
# the wall runs from the entrance wall to the springing as one continuous
# thickness and the arch takes over from there.
# No opening in either: the leg IS the column, and you cannot put a door
# through a 230 x 1800 structural column.  The service doors go in the arch.
SCREEN_WALLS = [(a + T_GAL / 2, b, a + T_GAL / 2, d, T_GAL, [])
                for a, b, c, d in GAL_LEGS]

# --------------------------------------------------------------- pod glazing
# quadratic Bezier, bowing away from the great room, as A-101 draws it
POD_W = ((9115, BODY_N), (8000, 5030), (8000, BODY_S))
POD_E = ((M(9115), BODY_N), (M(8000), 5030), (M(8000), BODY_S))
POD_PORTAL = (0.42, 0.60)                 # arched opening, as a t-range

# straight glazing runs: (x1, y1, x2, y2, kind)
GLAZING = [
    # suite <-> terrace, full-height sliding
    (-350, 1275, SUITE_W_E, 1275, 'slider'),
    (M(SUITE_W_E), 1275, M(-350), 1275, 'slider'),
    # deck <-> great room and pods: the old 150 partition comes out
    (POD_W0, DECK_S + 75, 7500, DECK_S + 75, 'slider'),
    (9115, DECK_S + 75, 15365, DECK_S + 75, 'slider'),
    (M(7500), DECK_S + 75, M(POD_W0), DECK_S + 75, 'slider'),
    # windows in the external walls
    (-525, 2200, -525, 3800, 'window'),
    (-525, 4600, -525, 6400, 'window'),
    (-525, 7100, -525, 9000, 'window'),
    (M(-525), 2200, M(-525), 3800, 'window'),
    (M(-525), 4600, M(-525), 6400, 'window'),
    (M(-525), 7100, M(-525), 9000, 'window'),
    (400, 9620, 2400, 9620, 'window'),
    (M(2400), 9620, M(400), 9620, 'window'),
    (7800, 11050, 9800, 11050, 'window'),
    (14300, 11050, 15900, 11050, 'window'),
    (16350, 11050, 16800, 11050, 'window'),
]

# There is no such thing as an opening cut in existing masonry here: the flats
# came as bare shell, so every wall is new and every opening is simply a gap
# left in the run.  The gaps live with their walls, in NEW_WALLS and GALLERY.

# ------------------------------------------------------------------- furniture
# Stripped back to what is fixed, plumbed or built in — the pieces that prove
# the plan works.  All the loose furniture and speculative joinery inherited
# from A-101 has been taken out; it goes back in deliberately, later.
#
#   (kind, x0, y0, x1, y1, label)

_ONCE = [
    # ---------------------------------------------------------------- deck
    ('planter',  POD_W0, DECK_N, M(POD_W0), DECK_N + 340, 'planter + trellis on the parapet'),
    ('grass',    4700, 320, 7360, 2300, 'workout bay on real grass'),
    ('gym',      4760, 340, 5460, 2280, 'all-in-one strength trainer'),
    ('grass',    17120, 320, 19780, 2300, 'spa deck on real grass'),
    ('spa',      17930, 400, 19680, 2150, '4-seat spa'),
    ('fountain', 11640, 560, 12840, 1760, 'marble fountain, centre of the deck'),
    # ---------------------------------------------------------- great room
    # A-101's dining, moved out of the parents' pod: that corner is the
    # service duct, and the pod's remaining half is 2350 wide against the 2520
    # the table and six chairs need.  Beside the serving hatch, next to the
    # kitchen.
    ('dining',   9600, 6350, 11000, 7750, 'round 1400 dia, seats 6'),
    # ------------------------------------------------------------- kitchen
    ('counter-re', 7100, 8575, 10350, 9175,
     'run B  ·  600 deep, end rounded off for the entry door'),
    ('sink',     7620, 8700, 8180, 9010, ''),
    ('shelves',  8600, 8525, 9800, 8725, 'hatch shelf, deepened into the kitchen'),
    # --- the window run: hob only, integrated dishwasher under it
    ('counter',  7800, 10375, 9000, 10975, 'hob counter at the window  ·  600 deep'),
    ('under',    8080, 10455, 8820, 10895, 'integrated dishwasher, under the hob'),
    ('hob',      8150, 10525, 8750, 10825, ''),
    # --- the fridge, west of the hob run, flush with the wall.  It sits clear
    #     of the window, which starts at 7800, so nothing stands in front of it.
    ('appliance', 7000, 10275, 7800, 10975, 'fridge  ·  flush with the wall'),
    # --- the appliance corner, flush with the entry gallery column
    ('counter',  9800, 9700, 10400, 10975, 'appliance corner  ·  600 deep'),
    ('under',    9860, 9770, 10340, 10190, 'microwave'),
    ('under',    9860, 10250, 10340, 10600, 'air fryer  ·  toaster'),
    ('under',    9860, 10660, 10340, 10920, 'coffee  ·  soda maker'),
    # The two pod corner units — mandir and coffee / pantry — are behind the
    # retained deck void, in the corner between its back wall and the pod
    # glazing.  Their shape follows the curve, so they are built in
    # retrofit.corner_units() where the Bezier lives.
    # ------------------------------------------------------------- utility
    ('appliance', 5850, 9700, 6550, 10400, 'washer + dryer, stacked'),
    # --------------------------------------------------------- help\'s room
    ('bunk',     14180, 8700, 15080, 10600, 'bunk'),
    # ------------------------------------------------- guest / service WC
    ('shower',   16330, 8575, 17380, 9375, ''),
    ('wc',       16480, 9700, 17100, 10320, ''),
    ('basin',    16480, 10450, 17100, 10890, ''),
]

# Drawn on both halves of the home.
_MIRROR = [
    ('bed-e',    700, 6975, 2700, 8775, 'king 1800 × 2000, head on the bath wall'),
    # ---------------------------------------------------------------- bath
    ('counter',  3855, 6900, 4405, 8300, 'vanity'),
    ('basin',    3955, 7350, 4355, 7850, ''),
    ('wc',       2905, 7500, 3505, 8120, ''),
    ('cshower',  3455, 8595, 4405, 9545, 'curved glass shower'),
]

_FLIP = {'bed-e': 'bed-w', 'bed-w': 'bed-e', 'bed-n': 'bed-n', 'bed-s': 'bed-s'}
FURNITURE = (list(_ONCE) + list(_MIRROR)
             + [(_FLIP.get(k, k), M(c), b, M(a), d, lab)
                for k, a, b, c, d, lab in _MIRROR])

# The entry gallery is left empty — its curved console and bench come back
# when the joinery is designed properly.
GALLERY_FURNITURE = []

# The lift core and landing beyond the entry hall — shown for reference only.
REFERENCE = (9400, 11125, 16300, 15700)

# ------------------------------------------------------------------ dimensions
# (x1, y1, x2, y2, prefix).  The text is NEVER written by hand — every drawing
# computes it from the two points, so the label and the geometry cannot
# disagree.  The points sit on the builder's own set-out lines.
#
# Along the deck the builder's chain is 3050 + 1535 + 3050 per half with a 150
# party wall at the centre.  There is no party wall here, so the two middle
# bays read as one continuous 6250:  3050 + 1535 + 6250 + 1535 + 3050 = 15 420.
DIMS = [
    (END_W, -2100, END_E, -2100, 'OVERALL  '),
    (END_W, -1500, POD_W0, -1500, 'WING  '),
    (POD_W0, -1500, M(POD_W0), -1500, 'CONTINUOUS DECK  '),
    (M(POD_W0), -1500, END_E, -1500, 'WING  '),
    (POD_W0, -900, 7580, -900, ''),
    (7580, -900, 9115, -900, ''),
    (9115, -900, 15365, -900, ''),
    (15365, -900, 16900, -900, ''),
    (16900, -900, M(POD_W0), -900, ''),
    # wing set-out, both ends
    (END_W, 11900, END_W + 150, 11900, ''),
    (END_W + 150, 11900, SUITE_W_E, 11900, ''),
    (SUITE_W_E, 11900, SUITE_W_E + 150, 11900, ''),
    (SUITE_W_E + 150, 11900, 4380, 11900, ''),
    (4380, 11900, POD_W0, 11900, ''),
    (M(POD_W0), 11900, M(4380), 11900, ''),
    (M(4380), 11900, M(SUITE_W_E + 150), 11900, ''),
    (M(SUITE_W_E + 150), 11900, M(SUITE_W_E), 11900, ''),
    (M(SUITE_W_E), 11900, M(END_W + 150), 11900, ''),
    (M(END_W + 150), 11900, END_E, 11900, ''),
    # depth
    (-1400, DECK_N, -1400, DECK_S, 'DECK  '),
    (-1400, BODY_N, -1400, BODY_S, 'MAIN BODY  '),
    (-1400, BAY_N, -1400, BAY_S, 'SERVICE BAY  '),
    (-2200, 0, -2200, WING_S + 150, 'WING DEPTH  '),
    (26100, -250, 26100, 11125, 'OVERALL DEPTH  '),
]
