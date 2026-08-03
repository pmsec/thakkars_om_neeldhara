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

import math
import math as _m

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
    # GUEST / SERVICE WC, HELP'S ROOM and STORE are not rectangles either — the
    # WC's apse cuts all three.  See retrofit.lobby_polys().
]

# --------------------------------------------------- entry gallery, setting out
# The setting-out has to come before the walls, because the service-bay north
# wall is cut by whatever the gallery's end does — so that wall is written in
# terms of these numbers rather than in numbers that have to be kept in step
# with them by hand.
#
# The two legs sit exactly on the builder's two 230 x 1800 columns.  The end is
# a TRUE SEMICIRCLE: the sag equals the half-span, which puts the centre on the
# line of the column tops.  Two things follow, and both are the point of it.
# The tangent at the springing is vertical, so the arc leaves the column
# parallel to it — no radial cut against a flat leg top, no notch, nothing to
# patch.  And the crown lands 925 north of the service bay, so the gallery ends
# in a proper apse that reads from inside the great room.
T_GAL = 230                                    # same as the column, so it reads
GAL_W, GAL_E = 10400, M(10400)                 # OUTER faces of the two columns
COL_N = 9325                                   # top of the two columns
GAL_CX = MID
GAL_DOOR_W, GAL_DOOR_E = 11715, 12765          # the great-room door, on the axis

_HALF = MID - (GAL_W + T_GAL / 2)              # 1725, leg centreline to centre
_SAG = _HALF                                   # semicircle: springs at COL_N
GAL_R = (_HALF ** 2 + _SAG ** 2) / (2 * _SAG)  # 1725
_CROWN = COL_N - _SAG                          # 7600, centreline at the crown
GAL_CY = _CROWN + GAL_R                        # 9325 — on the column tops
GAL_RO, GAL_RI = GAL_R + T_GAL / 2, GAL_R - T_GAL / 2


def gal_cross(y, r=None):
    """x where the gallery circle of radius r crosses the line y, west side.

    None when it does not reach that line at all — which is what a shallower
    arch would do, and the callers fall back rather than break."""
    r = GAL_RO if r is None else r
    d = r * r - (y - GAL_CY) ** 2
    return GAL_CX - _m.sqrt(d) if d > 0 else None


# Where the apse breaks through the service-bay north wall.  Taken on the
# wall's NORTH face, so the wall runs a little way INTO the arch and the two
# merge, rather than stopping short of it and leaving a hairline.
_BRK_W = gal_cross(BODY_S) or GAL_DOOR_W
_BRK_E = M(_BRK_W)

# ------------------------------------------ the guest WC's arched wall
# The guest WC is an arch on plan too: a quarter ELLIPSE struck from the
# north-east corner of the service bay, springing off the great-room wall and
# dying into the east wall.  Help's room and the store wrap round the outside
# of it.
#
# An ellipse and not a circle because the two walls it has to reach are not the
# same distance away — 2430 along the great-room wall, 1675 down the east one.
# A circle is tangent to both only if it is a quarter round, and a quarter round
# wide enough to carry a door off the great room (it has to spring west of
# 15880, where the pod glazing lands) would run the whole 2450 depth of the bay
# and leave help's room a berth again.  The ellipse reaches west without
# reaching south, which is exactly the shape of the problem.
WC_CX, WC_CY = 17430, BAY_N        # the corner it is struck from
WC_A, WC_B = 2430, 1675            # semi-axes, on the centreline of the wall
T_WC = 110
WC_SPRING = WC_CX - WC_A           # 15000, on the great-room wall
WC_DIE = WC_CY + WC_B              # 10200, on the east wall
WC_DOOR = (0.42, 0.64)             # help's room's door, as a fraction of the arc
STORE_W = 16800                    # the store's new west wall


def wc_y(x):
    """y of the apse centreline where it crosses this x."""
    c = (WC_CX - x) / WC_A
    return WC_CY + WC_B * _m.sqrt(max(0.0, 1 - c * c))


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
    #     It stops where the gallery apse breaks through it and starts again on
    #     the far side; between those two points the apse's own curved wall is
    #     the boundary, so there is nothing for this one to do.  The serving
    #     hatch and help's room door are gaps in it.
    (6900, 8462.5, _BRK_W, 8462.5, 125, [(0, 1100)]),   # serving hatch only
    # Help's room has no door on to the great room any more — it is reached
    # from the entry gallery, and through it the WC.  The one opening left in
    # this run is the guest WC's.  The apse springs at 15000 and the pod glazing
    # lands at 15880, so there is 880 of great-room wall in front of the WC and
    # the door can be a proper 800 rather than the 600 a straight wall allowed.
    (_BRK_E, 8462.5, 17580, 8462.5, 125,
     [(15020 - _BRK_E, 15820 - _BRK_E)]),               # guest WC, off the great room

    # --- service bay
    # (the kitchen / utility wall is gone — the two are one space now)
    # WC / secondary duct.  This one stops where the apse dies into the east
    # wall: below that the store runs straight through, so its old cross-wall
    # and the door in it are both gone.
    (M(7050 - 75), BAY_N, M(7050 - 75), 10255, T_INT, []),         # WC / duct
    # The store's new west wall, from the apse down to the outer wall.  The
    # store is entered from help's room through it — which is where a staff
    # store should be entered from, rather than through the guest WC.
    # The opening is hard against the apse rather than centred: the wall is only
    # 893 long, and centring a door in it leaves two jambs too short to be
    # anything.  The apse is one jamb, and what is left is a 190 return.
    (STORE_W, wc_y(STORE_W) - 60, STORE_W, BAY_S, T_THIN, [(0, 700)]),

    # --- the absorbed lobby: new entrance wall on the building line, sitting
    #     in the 150 between the service bay and the building line.  One door,
    #     centred on the home, lining up with the drum's south opening.
    (10630, 11050, 13850, 11050, T_INT, [(1085, 2135)]),
]

# The entry gallery: a U on plan, the same 230 as the columns it is built on,
# so column and wall read as one continuous piece rather than a thin thing
# stuck beside a thick one.  The set-out is above, with the walls it cuts.
#
# The two legs sit exactly on the columns, so the column IS the leg.
GAL_LEGS = [(GAL_W, COL_N, GAL_W + T_GAL, 11125),
            (GAL_E - T_GAL, COL_N, GAL_E, 11125)]


def _ang(x, y):
    return _m.degrees(_m.atan2(y - GAL_CY, x - GAL_CX)) % 360


# The springings, and the mirror of the west one — taken by symmetry about the
# crown rather than from atan2, which returns 0 for the east one and would make
# the sweep read backwards.
_A0 = _ang(GAL_W + T_GAL / 2, COL_N)             # 180 — due west of the centre
_A1 = 540 - _A0                                  # 360
_D0 = _ang(GAL_DOOR_W, GAL_CY - _m.sqrt(GAL_R ** 2 - (GAL_DOOR_W - MID) ** 2))
_D1 = 540 - _D0

# Where the apse crosses the service-bay north line, on its OUTER face.  This
# is the corner each of the two flanking rooms runs up to.
_BN0 = _ang(gal_cross(BAY_N), BAY_N) if gal_cross(BAY_N) else 270
_BN1 = 540 - _BN0

# centre, centreline radius, thickness, gaps in degrees (Y down, 0 = east).
# The first gap wraps past 0 and kills everything below the springings.
#
# The arch carries all three doors, because it is the only part of the U that
# is not a column.  It spans a full 180 — 5419 of arc.  The two service doors
# are NOT set out by eye: once the apse pushes north, the only stretch of arch
# with the kitchen on the other side of it is the 776 between the springing and
# the service-bay wall.  North of that the arch faces the great room, and a
# door there would open into the wrong room.  So each service door takes that
# whole stretch — jambed by the column at one end and by the wall at the other,
# with no thin pier between them to be nervous about.  That leaves two 1400
# piers flanking the 1050 door on the axis.
GALLERY = (GAL_CX, GAL_CY, GAL_R, T_GAL,
           [(_A1 + 0.2, _A0 - 0.2),              # below the two springings
            (_D0, _D1),                          # 1050 on the axis, great room
            (_A0 - 0.2, _BN0),                   # 776 service door, to the kitchen
            (_BN1, _A1 + 0.2)])                  # 776 service door, to help's room

# The U's two straight legs, 230 on the column footprint: the column IS the
# leg, so the wall runs from the entrance wall to the springing as one
# continuous thickness and the arch takes over from there.
# No opening in either: the leg IS the column, and you cannot put a door
# through a 230 x 1800 structural column.  The service doors go in the arch.
#
# --- the two pocket casings, and why they are where they are ----------------
# The service doors are STRAIGHT GLASS SLIDERS.  A leaf curved to 1725 can only
# slide on the face of the arch and stand proud of it; a straight one can vanish
# — but only into a pocket, and the whole 800 between the column top and the
# service-bay wall is opening.  There is nowhere in line with it to put one.
#
# So the pocket runs OVER the column: a wood casing on the leg, 90 thick, with
# the slot inside it.  The leaf slides south out of the opening and disappears
# along the column, which is 1800 long and only has to swallow 800.
#
# On the INNER face, not the outer.  A pocket casing has to stand in the plane
# of the opening it closes, and that opening ends at 10687 on the arch — 12 from
# this casing's centreline.  Put it on the kitchen side and it sits 280 off the
# opening and closes nothing.  It costs the gallery 90 a side: 3220 clear
# becomes 3040.
T_POCKET = 90
POCKET_W = GAL_W + T_GAL + T_POCKET / 2        # 10675, centreline of the casing
POCKET_E = M(POCKET_W)
GAL_SLIDE = COL_N - BAY_N                      # 800, the opening it closes

SCREEN_WALLS = [(a + T_GAL / 2, b, a + T_GAL / 2, d, T_GAL, [])
                for a, b, c, d in GAL_LEGS] + [
    (POCKET_W, BAY_N, POCKET_W, BAY_S, T_POCKET, [(0, GAL_SLIDE)]),
    (POCKET_E, BAY_N, POCKET_E, BAY_S, T_POCKET, [(0, GAL_SLIDE)]),
]

# --------------------------------------------------------------- pod glazing
# quadratic Bezier, bowing away from the great room, as A-101 draws it
# A CUBIC, not a quadratic.  A quadratic can only bow one way, so the width
# the great room wants in the middle and the width the pod needs at the
# serving hatch fight each other.  A cubic gives both: it waists in towards
# the pod at mid-depth and swells back out at the bottom, where the dining
# table sits.  Great room 43.4 m2 against 39.9 for the best quadratic that
# still takes the table, and the table stays at the hatch.
POD_W = ((9115, BODY_N), (6800, 4600), (9400, 6400), (8600, BODY_S))
POD_E = ((M(9115), BODY_N), (M(6800), 4600), (M(9400), 6400), (M(8600), BODY_S))
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
    # ------------------------------------------------- parents' pod: dining
    # Round 1400, six chairs, at the serving hatch end of the pod.  It needs a
    # 2900 clear circle; the pod's south end only gave 2295 until the glazing
    # was straightened, which is why that curve changed.
    ('dining',   6480, 6250, 7880, 7650, 'round 1400 dia, seats 6'),
    # ------------------------------------------------------------- kitchen
    # Run B stops 850 short of the gallery: the apse springs vertically off the
    # column, so the only stretch of gallery wall the kitchen can have a door
    # in is right beside that column — and this counter used to run into it.
    ('counter-re', 6900, 8575, 9550, 9175,
     'run B  ·  600 deep, end rounded off  ·  850 clear to the gallery door'),
    ('sink',     8930, 8700, 9490, 9010, 'sink, east end'),
    ('shelves',  6900, 8525, 8000, 8725,
     'serving hatch, 1100 — opens into the parents pod'),
    # --- the window run: hob only, integrated dishwasher under it
    ('counter-r', 8200, 10375, 9400, 10975,
     'hob counter  ·  centred on the window, 400 clear each side'),
    ('under',    8430, 10455, 9170, 10895, 'integrated dishwasher, under the hob'),
    ('hob',      8500, 10525, 9100, 10825, ''),
    # --- the fridge, west of the hob run, flush with the wall.  It sits clear
    #     of the window, which starts at 7800, so nothing stands in front of it.
    ('appliance', 7000, 10275, 7800, 10975, 'fridge  ·  flush with the wall'),
    # --- the appliance corner, flush with the entry gallery column
    ('counter-r', 9800, 9700, 10400, 10975, 'appliance corner  ·  600 deep'),
    ('under',    9860, 9770, 10340, 10190, 'microwave'),
    ('under',    9860, 10250, 10340, 10600, 'air fryer  ·  toaster'),
    ('under',    9860, 10660, 10340, 10920, 'coffee  ·  soda maker'),
    # The two pod corner units — mandir and coffee / pantry — are behind the
    # retained deck void, in the corner between its back wall and the pod
    # glazing.  Their shape follows the curve, so they are built in
    # retrofit.corner_units() where the Bezier lives.
    # ------------------------------- the utility end of the kitchen
    ('appliance', 5755, 10375, 6355, 11025, 'washer + dryer, stacked'),
    ('basket',   5755, 9470, 6255, 9970, 'laundry basket'),
    ('bin',      6305, 9470, 6855, 10020, 'dustbin'),
    # --------------------------------------------------------- help\'s room
    # The bunk turns and lies ALONG the south wall.  Standing it on end against
    # the west wall left a 96 gap between its head and the apse — the apse
    # leaves its springing vertically, so it hugs 15000 for the first half metre
    # and there is nothing to be gained there.  Lying down, the bunk leaves the
    # whole northern 1550 of the room clear, which is the walking space, and
    # 755 past its foot to the store door.
    ('bunk',     14090, 10075, 15990, 10975, 'bunk'),
    ('shelves',  14090, 9425, 14690, 10025, 'cupboard'),
    # ------------------------------------------------- guest / service WC
    # One WC, one small basin, one very small shower — and nothing else, which
    # is what an apse this size will take.  The shower is flush into the corner
    # against the duct wall, and the pan is at the far end, where the apse dies
    # into that wall.  The basin is not here: it is set into a curved console
    # struck off the apse itself, immediately inside the door — see
    # retrofit.wc_console().
    ('shower',   16530, 8575, 17430, 9325, ''),   # 900 x 750
    # Turned a quarter, so its back is on the duct wall rather than floating in
    # the room.  700 deep from that wall, 620 wide, and it clears the apse: the
    # arc's inner face is at 16439 on this pan's south line.
    ('wc-e',     16730, 9390, 17430, 10010, ''),
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
