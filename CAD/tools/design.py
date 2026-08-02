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
    (SUITE_W_E + 62, BATH_N, STRIP_W1 + 75, BATH_N, T_INT, [(700, 1600)]),
    (SUITE_W_E + 62, BATH_N, SUITE_W_E + 62, WING_S, T_INT, []),
    (M(SUITE_W_E + 62), BATH_N, M(STRIP_W1 + 75), BATH_N, T_INT, [(700, 1600)]),
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
    (POD_W0, 1275, 7500, 1275, 'terrace-glass'),
    (M(POD_W0), 1275, M(7500), 1275, 'terrace-glass'),
    # suite <-> terrace, full-height sliding
    (-350, 1275, SUITE_W_E, 1275, 'slider'),
    (M(SUITE_W_E), 1275, M(-350), 1275, 'slider'),
    # deck <-> great room and pods: the old 150 partition comes out
    (POD_W0, DECK_S + 75, 7500, DECK_S + 75, 'slider'),
    (9115, DECK_S + 75, 15365, DECK_S + 75, 'slider'),
    (M(7500), DECK_S + 75, M(POD_W0), DECK_S + 75, 'slider'),
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
# (kind, x0, y0, x1, y1, label).  MIRROR items are repeated on the other side;
# ONCE items are not.
_MIRROR = [
    # master suite
    ('bed-w',    -350, 7250, 1650, 9050, 'king 1800 × 2000, head on the end wall'),
    ('joinery',  1900, 6800, 2750, 9450, 'wardrobe run'),
    ('joinery',  -450, 1350, 200, 4900, 'cupboards'),
    ('sofa',     500, 2500, 1850, 3800, 'murphy bed over a 2-seat sofa'),
    ('joinery',  STRIP_W0, 1350, STRIP_W1, 1950, 'dressing console'),
    ('joinery',  STRIP_W0, 2250, STRIP_W0 + 600, BATH_N - 100, 'hanging run'),
    ('joinery',  STRIP_W1 - 600, 2250, STRIP_W1, BATH_N - 100, 'hanging run'),
    # bath
    ('counter',  STRIP_W0, BATH_N + 150, STRIP_W1, BATH_N + 700, 'vanity'),
    ('shower',   STRIP_W0 + 80, WING_S - 980, STRIP_W0 + 980, WING_S - 80, 'shower'),
    ('wc',       STRIP_W1 - 700, BATH_N + 1050, STRIP_W1 - 80, BATH_N + 1670, 'wc'),
    # terrace
    ('joinery',  -250, 150, 1100, 550, 'drying rack over'),
    # pod
    ('table',    5660, 3550, 7060, 4950, 'dining, 1400 dia, seats 6'),
    ('joinery',  DUCT_W1 + 150, 6400, DUCT_W1 + 500, BODY_S - 100, 'media wall'),
    ('sofa',     6450, 7300, 7150, 8000, 'armchair'),
    ('sofa',     7250, 7300, 7950, 8000, 'armchair'),
]
_ONCE = [
    # kitchen + utility
    ('counter',  7100, BAY_N + 50, 10350, BAY_N + 650, 'run + sink'),
    ('counter',  7100, BAY_S - 900, 9900, BAY_S - 60, 'island + hob'),
    ('appliance', 5850, 9700, 6550, 10400, 'washer + dryer'),
    # entry gallery
    ('joinery',  10690, BAY_N + 60, 11000, 10500, 'service run'),
    ('joinery',  13480, BAY_N + 60, 13790, 10500, 'console'),
    # help's room + WC + store
    ('bed',      14200, 8720, 15100, 10620, 'bunk'),
    ('joinery',  15250, 10100, 16130, 10600, 'wardrobe'),
    ('shower',   16330, BAY_N + 60, 17380, BAY_N + 860, 'shower'),
    ('wc',       16420, BAY_S - 780, 17040, BAY_S - 160, 'wc'),
    ('joinery',  17640, 9620, 18760, 10100, 'store racks'),
    # great room
    ('sofa',     10300, 4400, 12200, 5700, '3-seat'),
    ('sofa',     12900, 4400, 14800, 5700, '3-seat'),
    ('table',    11750, 5900, 12730, 6880, 'low table'),
    ('sofa',     10500, 6900, 13980, 7900, 'long bench'),
    # deck
    ('grass',    4870, 470, 7300, 2300, 'workout bay on grass'),
    ('spa',      17850, 470, 19600, 2220, 'spa'),
    ('table',    11640, 710, 12840, 1910, 'fountain'),
    ('sofa',     9300, 1300, 10250, 2350, '2-seat recliner'),
    ('sofa',     14230, 1300, 15180, 2350, '2-seat recliner'),
]
FURNITURE = list(_ONCE) + list(_MIRROR) + [
    (k, M(c), b, M(a), d, lab) for k, a, b, c, d, lab in _MIRROR]

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
