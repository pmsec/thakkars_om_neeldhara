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
SUITE_W_E = 2750        # suite / strip — terrace set-out only now, see MB_*
STRIP_W0, STRIP_W1 = 2875, 4405     # dressing + bath strip, clear
POD_W0 = 4530           # wing wall / pod
POD_W1 = 8195           # family-room bay, 3665
LIV_W0 = 8320           # living bay, 3845
DUCT_W0, DUCT_W1 = 4555, 5555       # main service duct - KEEP CLEAR
BATH_N = 6650           # old dressing / bath split — superseded by the sweep


# ------------------------------------------------- the master baths' sweep
# The bath's north side is not a wall across the strip any more.  It springs
# off the pod partition, crests inside the suite, and then turns down and
# BECOMES the bath's west wall — one continuous sweep, and the vanity is
# struck off it rather than stood against it.
#
# Two quadrants meeting at the crown with a shared horizontal tangent, so the
# join is invisible:
#   east flank   a long shallow ellipse leaving the pod wall at about 50°
#   west flank   a quarter circle that turns the sweep vertical
# Everything below is the CENTRELINE of a T_MB wall; the faces are offset from
# it along its own normal (retrofit.mb_pt), which is the only way to band a
# curve that is not a circular arc.
T_MB = 150
MB_XE = STRIP_W1                    # 4405 — east face, on the pod / duct line
MB_CX, MB_CY = 3165, 5950           # the crown, on the centreline
MB_YE = 6550                        # where the centreline meets the pod wall
MB_AE = 1550                        # east flank, semi-axis along X
MB_BE = (MB_YE - MB_CY) / (1 - _m.sqrt(1 - ((MB_XE - MB_CX) / MB_AE) ** 2))
MB_RW = 765                         # west flank, a quarter circle
MB_YW = MB_CY + MB_RW               # 6715 — where it has turned vertical
MB_XW = MB_CX - MB_RW + T_MB / 2    # 2475 — the bath's west face below that
MB_DOOR = (300, 1100)               # parents': the door, along the straight wall
# Karan's door moves south so its far jamb lands flush on the shower screen at
# Y 8595, which is also where the dressing screen below meets this wall.  His
# side only — the parents' bath is as shipped, and without a screen to line up
# with there is nothing there for the move to buy.
MB_DOOR_E = (1080, 1880)            # Karan's: Y 7795 - 8595

# ------------------------------------------- Karan's dressing screen
# Brown tinted glass across the south strip of his suite, on the line of his
# bath door's north jamb.  It makes the wardrobes, the walk in front of them
# and the bath door into one private strip you can cross in a towel, without
# closing it off from the bedroom or taking any light off it.
#
# It stops short of the end wall rather than running the whole way, and the 795
# it leaves is the way in — no leaf, no track, nothing to slide.  That gap does
# three things at once: it is the door, it is what keeps the strip from being a
# dead end reachable only through the bath, and it is the aperture that throws
# the end-wall window's light across the strip onto the dresser mirror facing
# it.  A sliding leaf would have done only the first.
#
# It is not one material.  The bed's head backs on to it, so the bottom of it
# is WOOD — a dado you can lean a headboard against and screw a bracket into —
# and only above the headboard does it become tinted glass.  Glass all the way
# down would put the back of a headboard on show from the dressing side and
# give the bed nothing to sit against.  120 thick rather than 60 for the same
# reason: a partition a king bed leans on is a piece of construction.
#
# SCR_Y is its SOUTH face, on the bath door's north jamb, so the strip is
# bounded exactly by the door opening.  The 120 is taken off the bedroom side,
# which has it to spare; the dressing side keeps its 1070.
SCR_Y = 7795                        # SOUTH face, on the door's north jamb
T_SCR = 120
SCR_GAP = 795                       # left open at the end-wall end



# The two retained deck voids stay exactly as built: opening plus the builder's
# own enclosure (a 230 column on the outboard face, 150 walls elsewhere).
VOID_KEEP = [(7500, 1200, 9115, 2620), (2 * 12240 - 9115, 1200, 2 * 12240 - 7500, 2620)]


def M(v):
    """mirror a length-axis coordinate about the centre of the home"""
    return 2 * MID - v


# --------------------------------------------------- Karan's bed and headboard
# The bed is off the partition entirely.  Down there it had the bath on one
# side, the wardrobes behind it and the way into the dressing area squeezing
# past — four things in one corner.  It moves to the END WALL, because the end
# wall carries the only solid stretch in the suite:
#
#   y 1350 - 1950   window, 600
#   y 1950 - 5585   BLANK, 3635          <- the headboard wall
#   y 5585 - 9465   window, 3880
#
# THE HEADBOARD IS THE WHOLE OF THAT STRETCH.  Window jamb to window jamb, 3635,
# 200 thick — and that one decision settles three separate things at once:
#
#  * the builder's 230 x 1200 column stands 80 proud of this wall over y 1950 -
#    3150.  At 200 the headboard passes 120 clear in front of it, so the column
#    is inside the joinery and the wall reads flat.  Nothing is boxed out and
#    nothing is left sticking into the room.
#  * the bed centres on it almost exactly — 3635 less an 1800 bed leaves 917
#    each side, equal left and right, which is what Karan asked for.
#  * it stops precisely on both window jambs, so a full-height headboard covers
#    no glass at either end.
HB_T = 200
HB_Y0, HB_Y1 = 1950, 5585           # the blank stretch, jamb to jamb
HB_X = END_E - 150 - HB_T           # 24730 — the headboard's FRONT face
# US EASTERN KING, 1930 x 2032 — 76 x 80 in.  Not the Indian 1800 x 2000 that
# was drawn first: Karan asked for the American size and the wall carries it.
# It costs 66 of headboard each side and 32 of floor at the foot.  The mattress
# and every fitted sheet then have to be imported, which is the real price.
BED_W, BED_L = 1930, 2032           # across, and out from the headboard
BED_R = 594                         # foot corners only; the head is square
# The bed is centred ON THE ROOM, not on the headboard.  The two walls it lies
# between are the terrace wall at Y 1350 and the dressing screen's north face at
# 7675 — 6325 clear — so an 1930 bed leaves 2197 to each of them, equal.  Centred
# on the headboard instead it sat at 2802, only 602 off the back of the bench
# sofa, and the whole of the south half of the room was empty floor.
#
# THE HEADBOARD DOES NOT MOVE WITH IT, and it cannot: it is already hard on both
# window jambs, so any southward shift puts joinery across the 3880 window.  The
# bed slides 745 south along a headboard that stays put.  What that costs is the
# symmetry — 1597 of headboard shows north of the bed and 107 south, instead of
# 852 each side.  It stops reading as a board behind a bed and starts reading as
# a panelled wall with the bed at one end of it, which is why the north side
# table lands on it and the south one does not.
BED_ROOM_N = 1350                   # terrace wall
BED_ROOM_S = SCR_Y - T_SCR          # 7675 — the dressing screen's north face
BED_Y0 = (BED_ROOM_N + BED_ROOM_S - BED_W) / 2
BED_Y1 = BED_Y0 + BED_W
TAB_W, TAB_D, TAB_GAP = 550, 450, 50


# --------------------------------------------------------------------- rooms
# (name, subtitle, list of rectangles, note, label anchor or None)
# None puts the label in the middle of the biggest rectangle, which is right
# for an empty room and wrong for a full one.
ROOMS = [
    ("TERRACE", "PARENTS", [(-350, 0, SUITE_W_E, 1200)],
     "under high glass roof", None),
    # Karan's terrace is furnished now — bench, two singles and a table — and
    # the middle of it is exactly where the table is.  The label drops into the
    # gap between the bench and the bed instead, and loses its note to fit.
    ("TERRACE", "KARAN", [(M(SUITE_W_E), 0, M(-350), 1200)], "", (23280, 2480)),
    ("FAMILY ROOM", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay", None),
    ("MUSIC + WORK DEN", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay",
     None),
    ("GREAT ROOM", "", [], "living + dining  ·  opens to the deck", None),
    ("ALL-WEATHER DECK", "", [(POD_W0, DECK_N, M(POD_W0), DECK_S)],
     "15 420 long × 2620 deep  ·  net of the two retained voids", None),  # voids below
    # KITCHEN, ENTRY GALLERY and HELP'S ROOM are not rectangles — the gallery
    # is a free-standing drum and the two rooms run up to it.  See
    # retrofit.lobby_polys().
    # GUEST / SERVICE WC, HELP'S ROOM and STORE are not rectangles either — the
    # WC's apse cuts all three.  See retrofit.lobby_polys().
    # The two MASTER SUITES and their BATHS are not rectangles now either: the
    # sweep set out above is the boundary between each pair.  See
    # retrofit.suite_polys().
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
    # --- wing strips: bath enclosure, both ends.
    # The north wall and the west wall used to be two straight walls meeting in
    # a corner.  They are one thing now: the sweep does the north side and the
    # top of the west side, and this is only the straight tail of it, from
    # where the sweep has finished turning down to the outer wall.  The door is
    # a gap in that tail, hard against the curve.  See retrofit.mb_wall().
    # ------------------------- the PARENTS' partition
    # The suite is two rooms now: the parents' bed north of this line, and the
    # dressing zone with the grandmother's wall bed south of it.
    #
    # Its NORTH FACE LANDS ON Y 5875, which is exactly the crown of the bath's
    # arch — the northernmost point the sweep reaches, at X 3165.  So the
    # partition does not cut across the room arbitrarily: it continues a line
    # the bath already draws, and the two read as one boundary.
    #
    # It runs west to the end wall and east to X 2621, where the arch's own
    # outer face has come back down to meet the partition's south face at 6075.
    # Beyond that the arch is the wall.
    #
    # IT IS A REAL WALL WITH A REAL DOOR, not a screen with a gap.  A gap would
    # give privacy and nothing else; the whole point of it is that the two sides
    # can hold different temperatures, and that needs something that shuts.  The
    # door is 900, at the east end, on the direct line from the foot of the bed
    # to the bath.
    (-450, 5975, 2621, 5975, 200, [(2171, 3071)]),
    (MB_XW - T_MB / 2, MB_YW, MB_XW - T_MB / 2, WING_S, T_MB, [MB_DOOR]),
    (M(MB_XW - T_MB / 2), MB_YW, M(MB_XW - T_MB / 2), WING_S, T_MB, [MB_DOOR_E]),
    # The bath's east side is the enclosure to the builder's main service duct.
    # It was never drawn — the shell arrives with the shaft simply open — and
    # the bath cannot be closed without it.  It picks up exactly where the pod
    # partition above it leaves off, so the two read as one line, and it is the
    # wall the pan sits on because the soil stack is directly behind it.
    (MB_XE + T_INT / 2, BATH_N, MB_XE + T_INT / 2, WING_S, T_INT, []),
    (M(MB_XE + T_INT / 2), BATH_N, M(MB_XE + T_INT / 2), WING_S, T_INT, []),

    # --- suite <-> pod, the 125 line between the two.  The 1050 slider is a
    #     gap left in this wall; it is not a hole cut in anything.
    # The whole bed-to-pod stretch is open now — 3555 of it, Y 2620 to 6175 —
    # and a sliding partition closes it.  What is left as wall is the 1420 north
    # of that (which is nearly all the builder's 230 x 1200 column) and the 475
    # south of it.  See retrofit.suite_sliders().
    (STRIP_W1 + 62, 1200, STRIP_W1 + 62, BATH_N, 125, [(1420, 4975)]),
    (M(STRIP_W1 + 62), 1200, M(STRIP_W1 + 62), BATH_N, 125, [(1420, 4975)]),

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
# The two service doors are HINGED, not sliding, and the 800 ahead of each
# column is the doorway end to end.  A pocket needs a cavity as long as the leaf
# and in line with it, and there is nothing beyond either end of that 800 — the
# great room north, the structural column south.  Split for a pocket it gives
# 400 clear, or about 550 with a three-panel telescopic, against 750 on hinges.
# On a serving door the width wins, and it is ordinary ironmongery.
#
# It also keeps the leg at 230 on the column's own line, so column, doorway and
# arch read as one continuous thickness — which a pocket could not do either
# way round: on the column it made the leg 320, ahead of it it needed 120 on an
# offset line.  See retrofit.gal_swing_doors().
SCREEN_WALLS = [(a + T_GAL / 2, b, a + T_GAL / 2, d, T_GAL, [])
                for a, b, c, d in GAL_LEGS]

# --------------------------------------------------------------- pod glazing
# ONE BEND AND THEN STRAIGHT.  It leaves the deck wall at 65 degrees, turns
# through a single arc over the top 1708 — minimum radius 3036 — and then runs
# dead straight for the remaining 3947 to the service-bay wall.  No inflection,
# no reverse, no second bend.
#
# It used to be a cubic S: a bow of 985 with the radius swinging from 2037 to
# effectively straight and back, meeting the deck wall at 41 degrees with a
# visible kink.  Three separate objections killed it, and they are worth
# keeping written down because each one will come back:
#
#  * A CURVE AT 13% DEVIATION IS IN THE AMBIGUOUS ZONE.  Too curved to read as
#    a straight wall, too shallow to read as a curve.  This one is at 8.8% and
#    does not claim to be a curve at all: it is a splayed wall with an eased
#    corner, which is a different and safer move.
#  * IT WAS OFF-VOCABULARY.  Every other curve in this home is a tight complete
#    arc you read instantly — the bath sweep is a 765 quarter circle, the entry
#    apse a true 1725 semicircle, the guest WC a quarter ellipse.  A 3 m radius
#    stretched over 6 m was the only shallow gesture in the plan and it looked
#    weak beside them.
#  * IT GAVE NEITHER POD A STRAIGHT WALL.  The den in particular wants one — a
#    desk, a bookcase and a sideboard all want a flat back.  This gives each pod
#    3947 of straight wall and a pod width that never varies by more than 2.
#
# THE SOUTH END LANDS AT 8600 AND CANNOT MOVE.  It mirrors to 15880 on the
# service-bay wall; the guest WC's apse springs at 15000 and this glazing lands
# at 15880, so there are 880 of wall there and the WC door is 800 of it.  Any
# curve wanting a wider mouth at the bottom takes the door out.
#
# It costs 1.1 m2 of great room against the S — 40.3 down to 39.2 — and gives
# 0.5 m2 back to each pod.  The three spaces together are unchanged: the curve
# only decides where the line between them sits.
POD_W = ((9115, BODY_N), (8608, 3708), (8600, 3800), (8600, BODY_S))
POD_E = ((M(9115), BODY_N), (M(8608), 3708), (M(8600), 3800), (M(8600), BODY_S))
POD_PORTAL = (0.42, 0.60)                 # arched opening, as a t-range

# straight glazing runs: (x1, y1, x2, y2, kind)
GLAZING = [
    # suite <-> terrace, full-height sliding
    (-350, 1275, SUITE_W_E, 1275, 'slider'),
    (M(SUITE_W_E), 1275, M(-350), 1275, 'slider'),
    # deck <-> great room and pods: the old 150 partition comes out
    (4650, DECK_S + 75, 7500, DECK_S + 75, 'slider'),
    (9115, DECK_S + 75, 15365, DECK_S + 75, 'slider'),
    (M(7500), DECK_S + 75, M(4650), DECK_S + 75, 'slider'),
    # windows in the external walls
    # These are the builder's OWN openings, read off the source drawing's
    # DA_WINDOW layer, not invented and NOT mirrored.  The two wing ends are
    # not symmetric and it matters:
    #
    #   parents' end wall   600 at the terrace, 600 at the south corner
    #   parents' south wall 3200, the length of the strip
    #   KARAN'S end wall    600 at the terrace, and then one 3880
    #   Karan's south wall  NOTHING.  There is no window on it and never was.
    #
    # An earlier version of this list had three invented windows per end wall
    # and a mirrored copy of the parents' south window on Karan's side.  All of
    # it was wrong.  The builder gave the parents a south window and gave Karan
    # one enormous end-wall window instead; the two suites get about the same
    # glazing by completely different means.
    (-525, 1350, -525, 1950, 'window'),         # parents', end wall
    (-525, 8945, -525, 9545, 'window'),
    (-450, 9620, 2750, 9620, 'window'),         # parents', south wall — 3200
    (M(-525), 1350, M(-525), 1950, 'window'),   # Karan's, end wall
    (M(-525), 5585, M(-525), 9465, 'window'),   # Karan's one big one — 3880
    # Karan's south window is GONE — the wardrobe run took that wall.  It is
    # the only long blank wall in his suite (the whole east end is already
    # three windows), so the joinery and the window wanted the same 2775 and
    # the joinery won.  He still has 5100 of window on the end wall and the
    # 3100 terrace slider.  The parents' one above is untouched: this was
    # asked for on his side only.  One line brings it back:
    #   (M(2400), 9620, M(400), 9620, 'window'),
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
    # ------------------------- the PARENTS' suite, in two zones
    # THE OLD WEST-WALL CUPBOARD RUN IS GONE.  The west wall now carries the
    # parents' bed at the north end and the grandmother's wall bed at the south,
    # and the cupboards move on to the partition between them.
    #
    # THE PARENTS' BED, head on the west wall, facing east down the room and out
    # through the pod slider.  1800 x 2000 plus a 200 headboard.  It sits clear
    # of the 600 window at Y 1350-1950 above it and leaves 675 to the partition
    # below.  A side table each side, 500 x 450, on the same headboard line.
    ('joinery',   -450, 2400, -250, 5200, "headboard  ·  2800 x 200"),
    ('bed-w',     -250, 2900, 1750, 4700, "bed  ·  1800 x 2000, head on the west wall"),
    ('counter-r', -250, 2400, 250, 2900, "side table  ·  500 x 500"),
    ('counter-r', -250, 4700, 250, 5200, "side table  ·  500 x 500"),

    # THE CUPBOARDS GO ON THE PARTITION, facing SOUTH into the dressing zone —
    # which is the whole trick of this layout.  The bath opens into that zone,
    # so you come out of it, take clothes out of the cupboard and dress with the
    # partition between you and the bed.  One element, two jobs: it separates
    # the two sleeping zones and it is the changing screen.
    #
    # 2170 x 600, west of the door.  That is 650 less than the 2820 the west
    # wall carried, and it is the real cost of this layout — see the note in
    # ROUND1.md.  SLIDING doors, not hinged: with the wall bed down there is
    # 1070 in front of them, which is enough to stand in but not to swing a 750
    # leaf through.
    ('hanging',   -450, 6075, 1720, 6675, "cupboards  ·  2170 x 600, sliding"),

    # THE GRANDMOTHER'S WALL BED, on the west wall of the dressing zone.
    # A cabinet 400 deep that is shut fifty-one weeks of the year, and a single
    # bed that folds down out of it when she is here.  Not a sofa bed: nothing
    # to unfold nightly, nothing to make up twice.
    #
    # It sits EXACTLY ON THE COLUMN — the builder's 230 x 1200 at Y 7745-8945,
    # whose face stands 80 proud of the wall.  The cabinet is 1200 long and 400
    # deep off that proud face, so the column is behind it with no void, and the
    # cabinet stops dead on the 600 window's north jamb at 8945.
    # The door in the partition, hinged on its west jamb and swinging SOUTH into
    # the dressing zone, where there is 1070 of floor for it.  Open, the leaf
    # stands on the end of the cupboard run and blocks nothing.
    ('swing',     1721, 6075, 2621, 6975, "door  ·  900, into the dressing zone"),
    ('murphy-e',  -370, 7745, 30, 8945,
     "wall bed  ·  single 1200 x 1900, shown folded down"),
    # THE BASKET GOES IN THE CORNER, hard into the angle where the west window
    # and the south window meet — back on the south wall at Y 9545, end on the
    # west wall at X -450.  It lies ALONG THE SOUTH WALL, 700 x 500: turned the
    # other way it would need 700 of the west wall and there are only 600
    # between the column's south edge and the corner.
    #
    # It stands in front of the bottom of the 600 west window, which a 500-high
    # open basket may do — the sill is well above it — and it lines through with
    # the cupboards to 20, which is a joiner's tolerance.
    ('basket',    -450, 9045, 250, 9545, "laundry basket  ·  700 x 500, in the corner"),
    # The dressing console moves to the corner where the bath wall meets the
    # south window, and it goes on the BATH WALL, not under the window.  On the
    # window wall the mirror would cover 940 of a 3200 window and you would sit
    # with the light behind the glass, lighting the back of your own head.  On
    # the bath wall you face east into it with the south window on your right —
    # side light on your face, which is the whole point of putting it here.
    # Hard into the corner now: its back is ON the bath wall at X 2400 and its
    # end is ON the south wall at Y 9545, so it is jammed into the angle with
    # nothing behind it and nothing beside it.  It was 75 short of the bath
    # wall, which read as a gap rather than a corner.
    ('console-e', 1950, 8605, 2400, 9545,
     "dressing console  ·  940 x 450, mirror on the bath wall"),

    # ------------------------------- Karan's terrace: the conversation pod
    # Not chairs stood in the terrace.  A BENCH SOFA inside the room with its
    # back to the bed, facing north through the slider, and a single sofa at
    # each end of the terrace facing in — so the three of them and the centre
    # table make one group that works across the opening rather than on one
    # side of it.  Open the slider and it is a single room; shut it and the
    # bench still faces the view.
    #
    # The bench is IN THE ROOM: 2000 x 800, 50 off the terrace wall, centred on
    # the terrace's 3100 so it sits square between the two singles.
    ('sofa',     22280, 1400, 24280, 2200, 'bench sofa  ·  2000 x 800, back to the bed'),
    # The two singles, 800 each, facing each other across the table.  100 clear
    # at each end of the terrace and 200 top and bottom of its 1200 depth.
    ('sofa-w',   21830, 200, 22630, 1000, 'single sofa  ·  800, facing east'),
    ('sofa-e',   23930, 200, 24730, 1000, 'single sofa  ·  800, facing west'),
    ('table',    22905, 265, 23655, 1015, 'centre table  ·  750 round'),

    # The reading chair and its ottoman came out of this corner.  The bed moved
    # south into the floor they were standing on, and two pieces of loose
    # furniture in the last 2200 before the dressing screen would have turned
    # the one clear run in the suite back into an obstacle course.

    # ------------------------------- Karan's suite: the plant table
    # Low wooden table in the north-west corner, just inside the terrace, with
    # a big real plant on it.  Set off X 20280 because the builder leaves a
    # 230 x 1200 column here standing 105 into the room — the plant's spread
    # comes out to that column's face and no further.
    # It takes the corner properly: the spread reaches BOTH faces — the column's
    # at X 20180 and the wall under the sealed shaft at Y 1350 — so the plant
    # fills the corner rather than sitting near it, and the table is centred
    # under it with an equal 150 to each.
    # Plant first, table over it: the spread is 1200 against a 900 top, so drawn
    # the other way round the foliage swallows the table and you cannot see what
    # it stands on.
    ('plant',    20180, 1350, 21380, 2550, 'large plant  ·  1200 spread'),
    ('counter-r', 20330, 1500, 21230, 2400, 'low wooden table  ·  900 x 900'),

    # -------------------------------------------------- Karan's suite: the bed
    # A king, 1800 x 2000, head hard on the partition's north face.  Karan's
    # side only — the parents' suite has no partition to back on to.
    #
    # It cannot be centred in the bay and it is worth saying why.  Wall to wall
    # is 2775; the bed with its headboard is 1980; that leaves 795, and the 795
    # is already spoken for — it is the way into the dressing area.  So the bed
    # goes hard against the bath wall and the whole of the remainder becomes one
    # 885 walkway on the east side, which runs the bed's full length and then
    # straight on through the gap into the dressing strip.  A centred bed would
    # give 487 a side, which is not a side.
    #
    # The headboard lands exactly on the partition: 1980 long, the same as the
    # wood, from the bath wall to the edge of the gap.  Everything in this
    # corner of the home now sets out off two X lines, 22155 and 24135 — the
    # partition, the wardrobes under it, the headboard over it, and the gap and
    # the dresser beyond it.
    # Rectangular again, but with the corners taken right off — a 594 radius on
    # an 1800 x 2000, which is a third of the width, so what is left straight is
    # 612 across the head and 812 down each side.  It is the room's third curve
    # after the bath's arch and the console on it.
    ('joinery',  HB_X, HB_Y0, END_E - 150, HB_Y1,
     "headboard  ·  3635 x 200, window jamb to window jamb, column inside it"),
    # Rounded at the FOOT only — 594, a third of the width — and square at the
    # head, so the bed sits flush on the headboard instead of leaving two
    # crescent gaps behind the pillows.
    ('bed-rr',   HB_X - BED_L, BED_Y0, HB_X, BED_Y1,
     "king 1800 x 2000  ·  foot corners 594, head square on the headboard"),
    ('counter-r', HB_X - TAB_D, BED_Y0 - TAB_GAP - TAB_W, HB_X, BED_Y0 - TAB_GAP,
     "side table  ·  550 x 450"),
    ('counter-r', HB_X - TAB_D, BED_Y1 + TAB_GAP, HB_X, BED_Y1 + TAB_GAP + TAB_W,
     "side table  ·  550 x 450"),

    # ------------------------------------------- Karan's suite: the wardrobes
    # The south wall, which is the only long blank wall in the suite — the east
    # end is three windows and the north is the terrace slider.  2775 of it,
    # split in two.
    #
    # 600 deep, which is the depth a hanging rail needs: a shoulder on a hanger
    # is 550-580, so anything shallower turns into shelves.  Measured off Y 9465
    # rather than the wall face at 9545, because the builder leaves a 1200 x 230
    # column on this wall whose face is 80 proud of it — so the run is set to
    # the deepest obstruction and packed out behind, which is what a joiner
    # would do anyway.  Full 600 the whole way instead of 600 for two thirds and
    # 520 for the rest.
    #
    # Karan's side only, as asked.  Nothing goes in the parents' suite.
    # The run stops where the screen stops, at 24130, so the glass and the
    # joinery under it are exactly the same length and the gap and the dresser
    # are exactly the same length.  Two of 988 instead of two of 1387: the 800
    # went to the dresser, which is the trade Karan asked for.
    ('hanging',  22155, 8865, 23145, 9465, "wardrobe 1  ·  990 x 600, hanging"),
    ('hanging',  23145, 8865, 24135, 9465, "wardrobe 2  ·  990 x 600, hanging"),
    # The dresser, square opposite the gap in the screen — which is the point
    # of it.  The end wall's 3880 window lights the bedroom, the gap lets that
    # light through, and it lands on the mirror 1615 away.  450 deep rather
    # than the wardrobes' 600: a dresser is a place to sit at, not to hang in.
    ('console-s', 24135, 9015, 24930, 9465, "dresser  ·  795 x 450, mirror over"),

    # ---------------------------------------------------------------- deck
    ('planter',  POD_W0, DECK_N, M(POD_W0), DECK_N + 340, 'planter + trellis on the parapet'),
    ('grass',    4700, 320, 7360, 2300, 'workout bay on real grass'),
    ('gym',      4760, 340, 5460, 2280, 'all-in-one strength trainer'),
    ('grass',    17120, 320, 19780, 2300, 'spa deck on real grass'),
    ('spa',      17930, 400, 19680, 2150, '4-seat spa'),
    ('fountain', 11640, 560, 12840, 1760, 'marble fountain, centre of the deck'),
    # ---------------------------------------------------------- great room
    # ------------------------------------------------- parents' pod: dining
    # NOT A ROUND TABLE.  It was a 1400 round, and a round table in a pod only
    # 2894 wide is the wrong shape for the room: the seat facing the glass and
    # the seat facing the duct wall had 200 and 215 behind them, so neither
    # chair could be pulled out.  A long table turned to run DOWN the pod uses
    # the 5780 of depth instead of fighting the 2894 of width.
    #
    # 1100 x 2200, all four edges arched — see symbols.dining-se.  On the same
    # footprint it carries 2.30 m2 of top against 1.90 for a true oval and 1.54
    # for the 1400 round, because the edges bow OUT rather than the corners
    # being cut IN.  Three chairs a side at 700 centres, 733 of rim each.
    #
    # 559 behind the chairs on BOTH sides — the glazing runs dead straight past
    # this table now, so the pod's width does not vary along it and the table
    # could sit anywhere in the run.  Under the old S curve this same table had
    # 178 on the glass side.
    #
    # SEVEN, NOT EIGHT.  One occasional chair at the NORTH end, where 2270 of
    # open pod stands behind it.  Nothing at the south end: that end is the
    # serving stance at the hatch, 500 off the wall, and a chair there would sit
    # in the hatch itself.
    ('dining-se', 6603, 5700, 7703, 7900,
     'superellipse 1100 x 2200  ·  six, seven with the north end chair'),
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
    # The bed is OFF the drawing for now — the wardrobes and the bath come
    # first, and a bed sitting there while they are set out only argues with
    # them.  It goes back when the joinery is settled.  The symbol and the
    # mirror rule stay, so it is one line to bring back:
    #   ('bed-e', 700, 6975, 2700, 8775, 'king 1800 x 2000, head on the bath wall'),
    # ---------------------------------------------------------------- bath
    # The vanity is NOT here.  It is a curved console struck off the sweep, so
    # it sits on that wall for its whole length instead of touching it at one
    # point — see retrofit.mb_console().  What is left is the pan and the
    # shower, and both are set out off the two things that cannot move: the
    # soil stack is in the builder's main service duct, so the pan goes on the
    # duct wall, and the shower takes the whole south end because at 1930 clear
    # a full-width wet zone is simpler than a cubicle with a gap beside it.
    ('wc-e',     3805, 7620, 4405, 8240, ''),      # 600 off the duct wall
    # 4325, not the wall at 4405: the builder leaves a 230 x 1000 column on
    # the duct's corner and 80 of it stands in this corner of the room.
    ('shower',   2475, 8595, 4325, 9545, 'walk-in, 1850 x 950'),
    # The 300 of straight wall between the foot of the arch and the door jamb
    # is too short for anything hung and too shallow for anything deep.  It is
    # exactly a bin, and a bin has to go somewhere.
    ('bin',      2475, 6715, 2775, 7015, ''),
]

_FLIP = {'bed-e': 'bed-w', 'bed-w': 'bed-e', 'bed-n': 'bed-n', 'bed-s': 'bed-s',
         'wc-e': 'wc-w', 'wc-w': 'wc-e'}
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
    (END_W + 150, 11900, MB_XW - T_MB, 11900, ''),
    (MB_XW - T_MB, 11900, MB_XW, 11900, ''),
    (MB_XW, 11900, 4380, 11900, ''),
    (4380, 11900, POD_W0, 11900, ''),
    (M(POD_W0), 11900, M(4380), 11900, ''),
    (M(4380), 11900, M(MB_XW), 11900, ''),
    (M(MB_XW), 11900, M(MB_XW - T_MB), 11900, ''),
    (M(MB_XW - T_MB), 11900, M(END_W + 150), 11900, ''),
    (M(END_W + 150), 11900, END_E, 11900, ''),
    # depth
    (-1400, DECK_N, -1400, DECK_S, 'DECK  '),
    (-1400, BODY_N, -1400, BODY_S, 'MAIN BODY  '),
    (-1400, BAY_N, -1400, BAY_S, 'SERVICE BAY  '),
    (-2200, 0, -2200, WING_S + 150, 'WING DEPTH  '),
    (26100, -250, 26100, 11125, 'OVERALL DEPTH  '),
]
