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
     "one room  ·  bed, murphy nook, cupboards, dressing"),
    ("MASTER SUITE", "KARAN",
     [(M(STRIP_W1), 1350, END_E - 150, BATH_N), (M(SUITE_W_E), BATH_N, END_E - 150, WING_S)],
     "one room  ·  bed, murphy nook, cupboards, dressing"),
    ("TERRACE", "PARENTS", [(-350, 0, SUITE_W_E, 1200)],
     "under high glass roof  ·  hoisted drying rack"),
    ("TERRACE", "KARAN", [(M(SUITE_W_E), 0, M(-350), 1200)],
     "under high glass roof  ·  hoisted drying rack"),
    ("PARENTS' BATH", "", [(STRIP_W0, BATH_N, STRIP_W1, WING_S)],
     "window east into the builder's service duct"),
    ("KARAN'S BATH", "", [(M(STRIP_W1), BATH_N, M(STRIP_W0), WING_S)],
     "window west into the builder's service duct"),
    ("FAMILY ROOM", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay"),
    ("MUSIC + WORK DEN", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay"),
    ("GREAT ROOM", "", [], "living + dining  ·  opens to the deck"),
    ("ALL-WEATHER DECK", "", [(POD_W0, DECK_N, M(POD_W0), DECK_S)],
     "15 420 long × 2620 deep  ·  net of the two retained voids"),  # voids cut out below
    ("KITCHEN", "", [(7050, BAY_N, 10400, BAY_S)],
     "3350 × 2450 on the existing stack"),
    ("UTILITY", "", [(5705, 9470, 6900, 11025)], "the builder's dry balcony"),
    ("ENTRY GALLERY", "", [(10630, BAY_N, 13850, 11125)],
     "2450 dia  ·  in the absorbed lobby, between the two columns"),
    ("HELP'S ROOM", "", [(14080, BAY_N, 16130, BAY_S)], ""),
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

    # --- family-room / music-den pods: wall off the service duct
    (DUCT_W1 + 75, 6175, DUCT_W1 + 75, BODY_S, T_INT, []),
    (M(DUCT_W1 + 75), 6175, M(DUCT_W1 + 75), BODY_S, T_INT, []),

    # --- service bay
    (7050 - 75, BAY_N, 7050 - 75, BAY_S, T_INT, []),               # kitchen west
    (10400 + 75, BAY_N + 800, 10400 + 75, BAY_S, T_INT, []),       # kitchen east
    (M(7050 - 75), BAY_N, M(7050 - 75), BAY_S, T_INT, []),
    (M(10400 + 75), BAY_N + 800, M(10400 + 75), BAY_S, T_INT, []),
    (16205, BAY_N, 16205, BAY_S, T_THIN, [(1050, 1850)]),          # help's room / WC

    # --- the absorbed lobby: new entrance wall on the building line
    (10630, 11050, 13850, 11050, 240,
     [(170, 1070), (1920, 2970)]),                                 # service + main doors
]

# circular gallery wall: centre, radius, thickness, list of (start, end) gaps in
# degrees measured with Y downwards, 0 = east, 90 = south
GALLERY = (MID, 9825, 1225, T_INT,
           [(255, 285),      # north, to the great room
            (75, 105),       # south, to the entrance
            (165, 195),      # west, service route to the kitchen
            (-15, 15)])      # east, to help's room

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

# ------------------------------------------------------- openings in old walls
# Cut through builder masonry that stays.  (x1, y1, x2, y2, label)
CUT_OPENINGS = [
    (4405, 4975, 4530, 6025, 'suite -> family room, 1050 slider'),
    (M(4530), 4975, M(4405), 6025, 'suite -> music den, 1050 slider'),
    (10400, BAY_N, 10630, 9325, 'gallery -> kitchen, 800'),
    (13850, BAY_N, 14080, 9325, "gallery -> help's room, 800"),
    (11105, BODY_S, 13375, BAY_N, 'gallery -> great room, 2270 arched'),
    (6900, 9800, 7050, 10600, 'kitchen -> utility, 800'),
    (M(7050), 9800, M(6900), 10600, 'WC -> store, 800'),
    (8600, BODY_S, 9800, BAY_N, 'kitchen serving hatch, 1200'),
]

# ------------------------------------------------------------------- furniture
# Every item from A-101's own source, resolved onto the real shell.  Where a
# piece could stay exactly where A-101 draws it, it did; the note says so where
# it had to move and why.
#
#   (kind, x0, y0, x1, y1, label)
#
# Kinds: rug grass planter spa fountain gym drum pooja tv counter island sink
#        hob chimney shelves appliance wc basin shower cshower joinery hanging
#        console table dining chair sofa recliner bed-n bed-s bed-e bed-w
#        murphy dryrack plant mirror bunk

_ONCE = [
    # ---------------------------------------------------------------- deck
    ('planter',  POD_W0, DECK_N, M(POD_W0), DECK_N + 340, 'planter + trellis on the parapet'),
    ('grass',    4700, 320, 7360, 2300, 'workout bay on real grass'),
    ('gym',      4760, 340, 5460, 2280, 'all-in-one strength trainer'),
    ('grass',    17120, 320, 19780, 2300, 'spa deck on real grass'),
    ('spa',      17930, 400, 19680, 2150, '4-seat spa'),
    ('plant',    17250, 2120, 17660, 2440, ''),
    ('plant',    15020, 2120, 15430, 2440, ''),
    ('fountain', 11640, 560, 12840, 1760, 'marble fountain, centre of the deck'),
    ('sofa',     9190, 1120, 10140, 2430, '2-seat recliner, back on the void'),
    ('sofa',     14415, 1120, 15365, 2430, '2-seat recliner, back on the void'),
    # ---------------------------------------------------------- great room
    ('rug',      10500, 2900, 15100, 5700, ''),
    ('recliner', 11690, 4890, 12510, 5710, ''),
    ('recliner', 12690, 4890, 13510, 5710, ''),
    ('recliner', 14330, 3350, 15150, 4170, ''),
    ('recliner', 14330, 4270, 15150, 5090, ''),
    ('chair',    9265, 3050, 10065, 3850, 'armchair'),
    ('sidetable', 11210, 5100, 11660, 5550, ''),
    ('sidetable', 13540, 5100, 13990, 5550, ''),
    ('sidetable', 9615, 3900, 10035, 4320, ''),
    ('sidetable', 13960, 3350, 14330, 3720, ''),
    ('sidetable', 13960, 4720, 14330, 5090, ''),
    # dining: A-101 puts it in the parents' pod at (6420, 6900).  That corner
    # is now the service duct, and the pod's remaining lower half is 2350 wide
    # against the 2520 the table and its six chairs need.  Moved to the great
    # room beside the serving hatch, which also puts it next to the kitchen.
    ('dining',   9600, 6350, 11000, 7750, 'round 1400 dia, seats 6 · six loose chairs'),
    # ------------------------------------------------------------- kitchen
    ('counter',  7100, 8575, 10350, 9135, 'run'),
    ('sink',     7620, 8700, 8180, 9010, ''),
    ('shelves',  8600, 8525, 9800, 8725, 'hatch shelf, deepened into the kitchen'),
    ('island',   7150, 10000, 9900, 10800, 'peninsula island'),
    ('hob',      8180, 10230, 8820, 10570, ''),
    ('chimney',  8000, 10050, 9600, 10750, 'chimney over'),
    ('appliance', 9700, 10075, 10400, 10775, 'tall fridge'),
    # ------------------------------------------------------------- utility
    ('appliance', 5850, 9700, 6550, 10400, 'washer + dryer, stacked'),
    ('shelves',  5750, 10500, 6850, 10900, 'racks'),
    # ------------------------------------------------- entry gallery, floor
    ('mirror',   13760, 8600, 13820, 9220, ''),
    # --------------------------------------------------------- help's room
    ('bunk',     14180, 8700, 15080, 10600, 'bunk'),
    ('joinery',  15200, 10200, 16100, 10535, 'wardrobe at the foot'),
    ('mirror',   16050, 8600, 16110, 9220, 'mirror on the east wall'),
    # ------------------------------------------------- guest / service WC
    ('shower',   16330, 8575, 17380, 9375, ''),
    ('wc',       16480, 9700, 17100, 10320, ''),
    ('basin',    16480, 10450, 17100, 10890, ''),
    # --------------------------------------------------------------- store
    ('shelves',  17640, 9620, 18760, 10100, 'store racks'),
]

# Everything in _MIRROR is drawn on both halves of the home.
_MIRROR = [
    # -------------------------------------------------------- master suite
    ('bed-e',    700, 6975, 2700, 8775, 'king 1800 × 2000, head on the bath wall'),
    ('sidetable', 2300, 6500, 2700, 6900, ''),
    ('sidetable', 2300, 8850, 2700, 9250, ''),
    ('murphy',   -450, 2350, 10, 3720, "granny's double, wall-mounted"),
    ('sofa',     10, 2350, 860, 3720, '2-seat under the murphy'),
    ('joinery',  -450, 4400, 150, 6500, 'cupboards'),
    # ------------------------------------------------- dressing, in the strip
    ('console',  2905, 1400, 3805, 1850, 'dressing console + mirror'),
    ('hanging',  3805, 2000, 4405, 4450, 'hanging run, 6 doors — 930 clear alongside'),
    ('joinery',  2875, 4900, 3475, 6450, 'shelved cupboard'),
    # ---------------------------------------------------------------- bath
    ('counter',  3855, 6900, 4405, 8300, 'vanity'),
    ('basin',    3955, 7350, 4355, 7850, ''),
    ('wc',       2905, 7500, 3505, 8120, ''),
    ('cshower',  3455, 8595, 4405, 9545, 'curved glass shower'),
    # ------------------------------------------------------------- terrace
    ('planter',  -250, 0, 2650, 260, 'planter'),
    ('dryrack',  300, 300, 2100, 820, 'hoisted drying rack over'),
    ('chair',    400, 350, 1050, 1000, ''),
    ('chair',    1700, 350, 2350, 1000, ''),
    ('sidetable', 1150, 500, 1550, 900, ''),
    # ----------------------------------------------------------------- pod
    ('rug',      5500, 3400, 7800, 4800, ''),
    ('recliner', 5740, 3490, 6560, 4310, ''),
    ('recliner', 6940, 3490, 7760, 4310, ''),
    ('sidetable', 6440, 3590, 7060, 4210, ''),
    ('pooja',    7750, 2700, 8850, 3300, 'mandir'),
    # A-101's wall TV is at X 4790, which is inside the service duct.  It moves
    # on to the new wall that closes that duct, facing the same way.
    ('tv',       5705, 6600, 5825, 8000, 'wall TV on the duct wall'),
    ('sofa',     6100, 7000, 7500, 8000, '3-seat'),
    ('sidetable', 7700, 7200, 8100, 7600, ''),
]

# Items that belong to one half only, mirrored by hand because they differ.
_EAST_ONLY = [
    ('counter',  15630, 2700, 16730, 3300, 'pantry / drinks, behind the void'),
    ('appliance', 15700, 3350, 16140, 3750, 'under-counter fridge'),
    ('appliance', 16230, 3360, 16590, 3740, 'coffee machine'),
    ('drum',     17150, 6900, 18650, 8300, 'drum kit'),
]

_FLIP = {'bed-e': 'bed-w', 'bed-w': 'bed-e', 'bed-n': 'bed-n', 'bed-s': 'bed-s'}
FURNITURE = (list(_ONCE) + list(_MIRROR)
             + [(_FLIP.get(k, k), M(c), b, M(a), d, lab)
                for k, a, b, c, d, lab in _MIRROR]
             + list(_EAST_ONLY))

# Annular pieces in the entry gallery: (r0, r1, a0, a1, back, label)
GALLERY_FURNITURE = [
    (780, 1080, 195, 250, False, 'curved console'),
    (730, 1080, 290, 345, True, 'curved bench'),
]

# Curved tinted-glass changing screens: straight leg then a quarter round.
# (x of the straight leg, y start, y of the corner, x the return runs to)
SCREENS = [(2812, 6650, 3550, 2100), (M(2812), 6650, 3550, M(2100))]

# The lift core and landing beyond the entry hall — shown for reference only.
REFERENCE = (9400, 11125, 16300, 15700)

# ------------------------------------------------------------------ dimensions
# (x1, y1, x2, y2, text)
DIMS = [
    (END_W, -1500, END_E, -1500, 'OVERALL  25 680'),
    (END_W, -900, POD_W0, -900, "WING  5130"),
    (POD_W0, -900, M(POD_W0), -900, 'CONTINUOUS DECK  15 420'),
    (M(POD_W0), -900, END_E, -900, "WING  5130"),
    (POD_W0, -350, 7500, -350, '3050'),
    (7500, -350, 9115, -350, '1535'),
    (9115, -350, MID, -350, '3050'),
    (MID, -350, M(9115), -350, '3050'),
    (M(9115), -350, M(7500), -350, '1535'),
    (M(7500), -350, M(POD_W0), -350, '3050'),
    (-1500, DECK_N, -1500, DECK_S, 'DECK 2620'),
    (-1500, BODY_N, -1500, BODY_S, 'MAIN BODY 5780'),
    (-1500, BAY_N, -1500, BAY_S, 'SERVICE BAY 2450'),
    (-2300, 0, -2300, WING_S, 'WING DEPTH 9545'),
    (M(-2300), DECK_N, M(-2300), 11125, 'OVERALL DEPTH 11 275'),
]
