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
  and help's room + WC in the mirrored bay.  Laundry moves into the west dry
  balcony, which is what it was built as; the east one is help's room's
  store end.

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
# BATH_N — where each bath's east wall starts — is set with the sweep below;
# the two sides differ now.


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
MB_CX = 3165                        # the crown's X, on the centreline
#
# THE TWO SWEEPS ARE NOT MIRRORS ANY MORE.  The parents' bath is TWO baths in
# one cubicle — the grandmother has a urinary infection from time to time and
# must not share a WC with the parents — so the parents' sweep has moved
# 1600 NORTH, crown at 4350, to make the cubicle long enough for two: the
# parents' half under the arch, entered from the bed zone, and the
# grandmother's half at the south end, entered from her zone through the door
# that was always there.  A folding wooden divider stands between them at
# MB_DIV, and opens to make the whole cubicle one bath when she is away.
# Karan's sweep stays exactly as first drawn (the _K set below); everything
# on his side is drawn in that frame — see retrofit.karan().
MB_CY = 4350                        # the parents' crown, on the centreline
MB_YE = MB_CY + 600                 # 4950 — where the centreline meets the pod wall
MB_AE = 1550                        # east flank, semi-axis along X
MB_BE = (MB_YE - MB_CY) / (1 - _m.sqrt(1 - ((MB_XE - MB_CX) / MB_AE) ** 2))
MB_RW = 765                         # west flank, a quarter circle
MB_YW = MB_CY + MB_RW               # 5115 — where it has turned vertical
MB_XW = MB_CX - MB_RW + T_MB / 2    # 2475 — the bath's west face below that
BATH_N = MB_YE + 100                # 5050 — the parents' bath's east wall starts here
MB_SHELF_END = 6060                 # the linen shelves stop 120 short of the pan
MB_DIV = (7150, 7250)               # the folding divider, north and south faces
# The parents' door: on the straight tail, between the foot of the arch and the
# glass partition — 700, Y 5130-5830, 45 above the partition's north face.
MB_DOOR_P = (15, 715)
# The grandmother's door: the door the bath always had, from the dressing zone,
# 800, Y 7300-8100, into the south half.
MB_DOOR = (2185, 2985)
# Karan's sweep, as first drawn: crown 5950, meets the pod wall at 6550,
# turns vertical at 6715, east wall from 6650, shelves to 7500.
MB_CY_K, MB_YE_K = 5950, 6550
MB_BE_K = (MB_YE_K - MB_CY_K) / (1 - _m.sqrt(1 - ((MB_XE - MB_CX) / MB_AE) ** 2))
MB_YW_K = MB_CY_K + MB_RW           # 6715
BATH_N_K = 6650
MB_SHELF_END_K = 7500
# Karan's door moves south so its far jamb lands flush on the shower screen at
# Y 8595, which is also where the dressing screen below meets this wall.
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
# THE VOIDS ARE STORES NOW.  The builder has agreed they can be floored and
# used as bulk storage — the one thing this home was short of — so each gets
# a floor and a 700 door cut through its north enclosure on to the deck walk
# (the recliners back on to their inner faces).  The store inside each is the
# builder's own opening, 1235 x 1120.  See immovables ('void store').
VOID_DOORS = [(8000, 8700), (2 * 12240 - 8700, 2 * 12240 - 8000)]


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
     "real grass under a high glass roof", (1200, 1980)),
    # Karan's terrace is furnished now — bench, two singles and a table — and
    # the middle of it is exactly where the table is.  The label drops into the
    # gap between the bench and the bed instead, and loses its note to fit.
    ("TERRACE", "KARAN", [(M(SUITE_W_E), 0, M(-350), 1200)], "", (23280, 2480)),
    ("FAMILY ROOM", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay", None),
    ("MUSIC + WORK DEN", "", [], "one pod  ·  glass roof over the 3665 × 2280 bay",
     None),
    ("GREAT ROOM", "", [], "living + dining  ·  opens to the deck", None),
    ("VOID STORE", "WEST", [(7730, 1350, 8965, 2470)],
     "floored  ·  door to the deck walk", None),
    ("VOID STORE", "EAST", [(M(8965), 1350, M(7730), 2470)],
     "floored  ·  door to the deck walk", None),
    ("ALL-WEATHER DECK", "", [(POD_W0, DECK_N, M(POD_W0), DECK_S)],
     "15 420 long × 2620 deep  ·  net of the two retained voids", None),  # voids below
    # KITCHEN, ENTRY GALLERY and HELP'S ROOM are not rectangles — the gallery
    # is a free-standing drum and the two rooms run up to it.  See
    # retrofit.lobby_polys().
    # GUEST / SERVICE WC and HELP'S ROOM (which the store is part of now) are
    # not rectangles either — the WC's apse cuts both.  See
    # retrofit.lobby_polys().
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

# --------------------------------------------- the kitchen's bump north
# The kitchen was 10.5 m2 and it is the one room in the home with no slack in
# it, so its north wall steps INTO the great room over the whole stretch it is
# free to — from the pod glazing's landing at X 8600 east to where the gallery
# apse comes through.  West of 8600 the same wall is the family pod's south
# wall and moving it would eat the pod, so the step starts exactly on the
# glazing: the screen comes down the deck, lands on the bump's north-west
# corner, and the line reads as one from the parapet to the kitchen.
#
# 600, which is ONE COUNTER DEEP, and that is the whole reason for the number.
# At 600 the counter can turn the corner and run along the new wall, and the
# front of the upper leg lands exactly on the back of the lower one at BAY_N —
# the two faces line up instead of nearly lining up.  At 300 it could not: a
# 300 recess behind a 600 counter is a slot you cannot reach into.
#
# What it costs is the apse.  The arch's crown is at Y 7485, so at 600 only 315
# of it projects past the walls either side and it barely reads as an apse from
# inside the great room.  That is the trade, and it was made knowingly.
KIT_BUMP = 600                       # how far north the wall goes
KIT_BUMP_W = 8600                    # west end — where the pod glazing lands
KIT_N = BODY_S - KIT_BUMP            # 8100, the bump's NORTH face
KIT_S = KIT_N + 125                  # 8225, its face inside the kitchen
# Where the bump dies into the apse, taken on its north face like _BRK_W above.
_BRK_K = gal_cross(KIT_N) or GAL_DOOR_W

# ------------------------------------------ the guest WC's arched wall
# The guest WC is an arch on plan too: a quarter ELLIPSE struck from the
# north-east corner of the service bay, springing off the great-room wall and
# dying into the east wall.  Help's room and the store wrap round the outside
# of it.
#
# An ellipse and not a circle because the two walls it has to reach are not the
# same distance away — 2430 along the great-room wall, 1495 down the east one.
# A circle is tangent to both only if it is a quarter round, and a quarter round
# wide enough to carry a door off the great room (it has to spring west of
# 15880, where the pod glazing lands) would run the whole 2450 depth of the bay
# and leave help's room a berth again.  The ellipse reaches west without
# reaching south, which is exactly the shape of the problem.
#
# It dies 1495 down, not 1675 as it first did: the bunk in the merged help's
# room lies along the south wall with its head on the east wall, so its north
# edge at 10075 runs past the duct's cheek, and the apse (and the cheek it dies
# into) has to be out of the way above that line.  The 180 it gives up was
# the sliver of floor south of the pan; there is still 900 in front of the pan.
WC_CX, WC_CY = 17430, BAY_N        # the corner it is struck from
WC_A, WC_B = 2430, 1495            # semi-axes, on the centreline of the wall
T_WC = 110
WC_SPRING = WC_CX - WC_A           # 15000, on the great-room wall
WC_DIE = WC_CY + WC_B              # 10020, on the east wall; outer face 10075
WC_DOOR = (0.41, 0.645)            # help's room's door, as a fraction of the arc
# There is no STORE_W any more: the wall between help's room and the store came
# down after the walkability check, and the two are one room.  See the note
# on the service-bay walls below.


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
    # The parents' tail carries TWO doors now: theirs at the top, into the
    # north half, and the grandmother's lower down, into hers.
    (MB_XW - T_MB / 2, MB_YW, MB_XW - T_MB / 2, WING_S, T_MB, [MB_DOOR_P, MB_DOOR]),
    (M(MB_XW - T_MB / 2), MB_YW_K, M(MB_XW - T_MB / 2), WING_S, T_MB, [MB_DOOR_E]),
    # The bath's east side is the enclosure to the builder's main service duct.
    # It was never drawn — the shell arrives with the shaft simply open — and
    # the bath cannot be closed without it.  It picks up exactly where the pod
    # partition above it leaves off, so the two read as one line, and it is the
    # wall the pan sits on because the soil stack is directly behind it.
    (MB_XE + T_INT / 2, BATH_N, MB_XE + T_INT / 2, WING_S, T_INT, []),
    (M(MB_XE + T_INT / 2), BATH_N_K, M(MB_XE + T_INT / 2), WING_S, T_INT, []),


    # --- suite <-> pod, the 125 line between the two.  The 1050 slider is a
    #     gap left in this wall; it is not a hole cut in anything.
    # The whole bed-to-pod stretch is open now — 3555 of it, Y 2620 to 6175 —
    # and a sliding partition closes it.  What is left as wall is the 1420 north
    # of that (which is nearly all the builder's 230 x 1200 column) and the 475
    # south of it.  See retrofit.suite_sliders().
    # The parents' opening is shorter now — 2620 to 4575, 1955 — because their
    # bath's sweep springs off this wall at 4950 and the cupboard on the
    # outside of the sweep wants the 475 above that; Karan's is the full 3555.
    (STRIP_W1 + 62, 1200, STRIP_W1 + 62, BATH_N, 125, [(1420, BATH_N - 1200 - 475)]),
    (M(STRIP_W1 + 62), 1200, M(STRIP_W1 + 62), BATH_N_K, 125, [(1420, 4975)]),

    # --- family-room / music-den pods: wall off the service duct
    (DUCT_W1 + 75, 6175, DUCT_W1 + 75, BODY_S, T_INT, []),
    (M(DUCT_W1 + 75), 6175, M(DUCT_W1 + 75), BODY_S, T_INT, []),

    # --- service bay, north wall: great room / pods above, service bay below.
    #     It stops where the gallery apse breaks through it and starts again on
    #     the far side; between those two points the apse's own curved wall is
    #     the boundary, so there is nothing for this one to do.  The serving
    #     hatch and help's room door are gaps in it.
    #     It is in three pieces now, because the kitchen steps north over its
    #     eastern half: the old line as far as the pod glazing (carrying the
    #     serving hatch), a 300 return standing on the glazing's own line, and
    #     the bump's north wall running on to the apse.
    (6900, 8462.5, KIT_BUMP_W + 125, 8462.5, 125, [(0, 1100)]),   # hatch only
    (KIT_BUMP_W + 62.5, KIT_N, KIT_BUMP_W + 62.5, BAY_N, 125, []),
    (KIT_BUMP_W, KIT_N + 62.5, _BRK_K, KIT_N + 62.5, 125, []),
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
    # wall, at 10075 on its outer face — which is the bunk's north edge, so the
    # bunk lies under it and past it without touching it.  Below that the room
    # runs straight through to the east wall.
    (M(7050 - 75), BAY_N, M(7050 - 75), WC_DIE + T_WC / 2, T_INT, []),  # WC / duct
    # THE WALL BETWEEN HELP'S ROOM AND THE STORE IS GONE.  With it up, help's
    # room was a 4.4 m2 triangle with a 1025 west leg, and the 1900 bunk sat on
    # the only floor in front of the WC door: a 700 body could not reach the
    # WC or the store from the entry door, whatever the door types were.  With
    # it down the two are one 7.1 m2 room, the bunk lies at the east end under
    # the duct and the store's shelving becomes a cupboard at the west end of
    # the south band — and a 700 body reaches 90% of the floor and every door.

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
# The kitchen's corner is not on that line any more — its wall steps north and
# meets the apse higher up, at KIT_S.  The two are 11 degrees apart and both
# are needed: _BN0 still sets help's room's corner and the arch's two service
# doors, _BN0K sets the kitchen's floor.
_BN0K = _ang(gal_cross(KIT_S), KIT_S) if gal_cross(KIT_S) else _BN0

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
# The arched openings in the two pod screens, as t-ranges on each Bezier.
# THEY ARE NO LONGER THE SAME, and that is not an oversight.  The parents'
# door moved 828 south, out from behind the family room's sofa and into the
# gap between that sitting group and the dining table.  The den's could not
# follow it: Karan's work console runs Y 4800-7000 hard against the east
# screen, so a door any lower there opens into the back of it.  Both keep the
# same 823 clear opening, struck as equal arc lengths rather than equal
# t-spans — the curve is not uniform, so equal t would not be equal door.
POD_PORTAL_W = (0.6015, 0.7263)           # Y 4700-5523, the parents' pod
POD_PORTAL_E = (0.42, 0.60)               # Y 3872-4692, the den — pinned
POD_PORTAL = POD_PORTAL_E                 # kept for anything reading the old name

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
    # The two openings the source showed on the south wall at 14300-15900 and
    # 16350-16800 - help's room and the guest WC - are NOT windows: that wall
    # faces the building's own common passage, not the open air, and the
    # client has it closed.  Help's room borrows light through its door and
    # the WC ventilates into the duct, which is what the duct is for.
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
    # parents' bed at the north end and the grandmother's wall bed at the south.
    # The cupboards that moved on to the partition between them are gone too:
    # the parents' hanging space is the full-height cupboard on the bath's
    # arch (retrofit.arch_console_par), and the partition is glass end to end.
    #
    # ------------------------- the WARDROBE, in the bedroom's north-east corner
    # THE STUDY DESK IS GONE FOR GOOD (Karan's call: no desk here and none in
    # the den either).  The corner it stood in — the sealed shaft's south wall
    # above, the builder's column at X 4300 on the east — takes a 1400 x 600
    # hanging wardrobe instead, back on the shaft wall, end on the column's
    # face.  With the partition cupboards gone and the arch cupboard only 400
    # deep, this is the parents' one wardrobe at hanging depth.
    ('hanging',   2900, 1350, 4300, 1950, "wardrobe  ·  1400 x 600, hanging"),

    # THE PARENTS' BED IS KARAN'S BED MIRRORED — the same bed, the same
    # headboard treatment, the same side tables, handed the other way so the
    # head is square on the WEST wall and the rounded foot faces east down the
    # room and out through the pod slider.
    #
    #   US EASTERN KING, 1930 x 2032, foot corners off at 594, head square
    #   headboard 200 thick, the whole blank stretch of wall
    #   side tables 550 x 450, 50 off the bed
    #
    # THE HEADBOARD IS THE WHOLE BLANK WALL, Y 1950 to 5875 — window jamb at the
    # top, the partition at the bottom, 3925 of it.  Karan's is 3635 for exactly
    # the same reason on his end wall, and there it swallows a column; here
    # there is no column to swallow, so it is simply the full stretch and the
    # joinery runs on into the partition block without a break.
    #
    # The bed CENTRES ON THE ROOM, not on the headboard — the same decision as
    # Karan's.  The two lines it lies between are the terrace wall at Y 1350 and
    # the partition's north face at 5875, 4525 clear, so an 1930 bed leaves 1297
    # to each.  That is why 97 of headboard shows above it and 697 below.
    ('joinery',   -450, 1950, -250, 5875, "headboard  ·  3925 x 200"),
    ('bed-rw',    -250, 2647, 1782, 4577,
     "king 1930 x 2032  ·  foot corners 594, head square on the headboard"),
    ('counter-r', -250, 2047, 200, 2597, "side table  ·  550 x 450"),
    ('counter-r', -250, 4627, 200, 5177, "side table  ·  550 x 450"),

    # ------------------------- THE PARTITION: TINTED GLASS, END TO END
    # It is not a masonry wall, and it is not joinery any more either.  The
    # line is the same — its north face lands on Y 5875, which is exactly the
    # crown of the bath's arch, the northernmost point that sweep reaches —
    # but THE CUPBOARD BLOCK IS GONE, and the whole 3182 from the west wall to
    # the arch is BROWN TINTED GLASS, the same glass as Karan's dressing
    # screen and the serving hatch.
    #
    # THE GLASS IS THE DOOR.  THREE leaves of 925 on a triple track — north,
    # middle, south — so all three slide behind one another and stack into a
    # third of the line: open, the leaves take 925 against the west wall and
    # 1850 of the 2775 is clear.  Two leaves left half the line shut whenever
    # it was open, which is why there are three.  No pocket, because there is
    # no cupboard to pocket into; bypass leaves need none.  Nothing swings,
    # so nothing can foul anything.
    #
    # Shut, the two zones are separately heatable, which is the whole reason
    # the partition exists.  Open, the suite reads as one room through the
    # tint.
    #
    # The glass runs from the west wall to the bath's straight west wall at
    # X 2325 — the sweep is north of this line now, so the line meets a flat
    # wall, not a curve.  2775 in all.  Tinted from the floor to the ceiling,
    # the whole length.
    ('tint',      -450, 5875, 475, 5915,
     "sliding screen  ·  brown tinted glass, leaf 1 of 3, 925, north track"),
    ('tint',      475, 5915, 1400, 5955,
     "sliding screen  ·  brown tinted glass, leaf 2 of 3, 925, middle track"),
    ('tint',      1400, 5955, 2325, 5995,
     "sliding screen  ·  brown tinted glass, leaf 3 of 3, 925, south track"),

    # THE GRANDMOTHER'S WALL BED, on the west wall of the dressing zone.
    # A cabinet 400 deep that is shut fifty-one weeks of the year, and a QUEEN
    # that folds down out of it when she is here — 1500 x 2000, because Karan's
    # father will sometimes sleep in here with his mother and neither a single
    # nor a snug double is fair on two adults.  Not a sofa bed: nothing to
    # unfold nightly, nothing to make up twice.
    #
    # The cabinet's south end is fixed on the 600 window's north jamb at Y 8945,
    # because anything past that stands in front of glass.  1500 of cabinet
    # therefore runs back to 7445.  The builder's 230 x 1200 column sits under
    # Y 7745-8945 with its face 80 proud, so the cabinet backs on to that face
    # at X -370 and its northern 300 has 80 of void behind it, packed out.
    #
    # A SIDE TABLE EACH SIDE, 500 long and 480 deep, flanking the cabinet on the
    # same wall.  Neither of them stands on the column, so they go back to the
    # wall face at X -450 and are 480 deep rather than 400 — and all three
    # pieces then share one flush front at X 30, a single 2500 run.  Standing
    # against the wall they are the dressing zone's console when the bed is up
    # and the bed's side tables when it is down.
    ('counter-r', -450, 6945, 30, 7445, "side table  ·  500 x 480"),
    # The wall bed is a SOFA WALL BED: a 400 cabinet on the wall and a two-seat
    # sofa, 550 deep, in front of it with its back to the cabinet.  Closed, the
    # dressing zone has a sofa; open, the queen folds down over the sofa.  The
    # unit's front is at X 580, 1730 clear to the mirror wall.
    ('murphy-e',  -370, 7445, 580, 8945,
     "wall bed  ·  QUEEN 1500 x 2000 folds down over a 2-seat sofa  ·  shown down, dashed"),
    ('counter-r', -450, 8945, 30, 9445, "side table  ·  500 x 480"),
    # A MIRROR ON THE BATH WALL AND NOTHING ELSE — no console under it.  It is in
    # the corner where the bath wall meets the south window, so you face east
    # into it with the window on your right: side light on your face, which is
    # the whole reason for putting it here rather than on the window wall, where
    # you would stand with the light behind you.
    #
    # The console that used to stand under it is gone.  With the wall bed down
    # this corner is the bed's, and a console here would be furniture you have
    # to edge round for the sake of a surface the cupboards already provide.
    ('mirror',    2310, 8605, 2400, 9545,
     "mirror  ·  940 on the bath wall, no console"),
    # THE GRANDMOTHER'S WARDROBE, on the bath's straight wall between the glass
    # partition and her bath door: 1300 x 600, hanging.  It clears the wall
    # bed (which folds down south of 7445) and the glass leaves, which stack at
    # the far end of the line.  Her door's leaf swings into the bath, so the
    # wardrobe can run right up to the jamb.
    ('hanging',   1725, 6000, 2325, 7300, "wardrobe  ·  1300 x 600, hanging"),

    ('sofa-e',   1750, 200, 2550, 1000,
     'single sofa  ·  800, facing west at the tree  ·  200 clear each side'),

    # ------------------------- THE PARENTS' CUBICLE: TWO BATHS
    # The vanities are NOT here — the parents' is a curved console struck off
    # the sweep, see retrofit.mb_console().  The cubicle is 1930 clear and runs
    # from the crown at 4350 to the outer wall at 9695; the folding wooden
    # divider at 7150-7250 splits it.
    #
    # NORTH HALF, the parents': under the arch.  The pan goes on the duct
    # wall, as far north as the duct allows — the builder's main duct starts
    # at 6175, and the soil stack is in it — with 700 in front of it.  The
    # shower is a 900 walk-in in the south-west corner against the divider,
    # open, no screen: at 1930 clear its floor doubles as the standing room
    # in front of the pan, which is what a wet room is.
    ('wc-e',     3725, 6180, 4405, 6570, ''),   # 680 x 390, on the duct wall
    ('shower',   2475, 6250, 3375, 7150, 'walk-in, 900 x 900, no screen'),
    # SOUTH HALF, the grandmother's: the pan and the walk-in shower exactly
    # where the bath always had them, and a wall-hung basin of her own on the
    # west wall between her door and the shower.
    ('wc-e',     3725, 7625, 4405, 8015, ''),   # 680 x 390      # 600 off the duct wall
    # 4325, not the wall at 4405: the builder leaves a 230 x 1000 column on
    # the duct's corner and 80 of it stands in this corner of the room.
    ('shower',   2475, 8595, 4325, 9545, 'walk-in, 1850 x 950'),
    ('basin',    2475, 8150, 2925, 8550, "basin  ·  450 x 400, wall hung"),

    # ------------------------- KARAN'S BATH, as first drawn (in his own frame)
    # The pan on the duct wall, the walk-in shower across the south end, and
    # the bin on the 300 of straight wall between the arch's foot and the door.
    ('wc-w',     20075, 7625, 20755, 8015, ''),  # 680 x 390
    ('shower',   20155, 8595, 22005, 9545, 'walk-in, 1850 x 950'),
    ('bin',      21705, 6715, 22005, 7015, ''),

    # ------------------------------- Karan's terrace: the conversation pod
    # Not chairs stood in the terrace.  A BENCH SOFA inside the room with its
    # back to the bed, facing north through the slider, and a single sofa at
    # each end of the terrace facing in — so the three of them and the centre
    # table make one group that works across the opening rather than on one
    # side of it.  Open the slider and it is a single room; shut it and the
    # bench still faces the view.
    #
    # THE BENCH IS GONE (Karan's call): the floor between the bed and the
    # terrace slider stays clear, so the room opens straight on to the
    # terrace and its tree. The two singles on the terrace still face in.
    # The two singles, 800 each, facing each other across the table.  100 clear
    # at each end of the terrace and 200 top and bottom of its 1200 depth.
    # THE CENTRE TABLE IS GONE AND A TREE STANDS WHERE IT STOOD.  The middle
    # of this terrace was always the thing the two singles looked at; a 750
    # round table is a poor answer to that and a real tree is a good one.
    # The east single became the jhoola.  Both are drawn in
    # retrofit.terrace_pieces(), which does the same on the parents' terrace.
    ('sofa-w',   21930, 200, 22730, 1000,
     'single sofa  ·  800, facing east at the tree  ·  200 clear each side'),

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
     "king 1930 x 2032  ·  foot corners 594, head square on the headboard"),
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
    # A GRASS STRIP, 340 wide, INSIDE the parapet and planted — the trellis is
    # on the parapet above it and the creepers climb from this bed.  Hanging it
    # outside instead would give the deck back 340 of depth over its whole
    # 15 420, but the parapet is only 100 thick, so a planted steel trough
    # cantilevered off it at the 14th floor is a structural question and a
    # facade projection past the building line.  Nothing else in this drawing
    # leaves the builder's envelope and this is not the thing to start with.
    ('planter',  POD_W0, DECK_N, M(POD_W0), DECK_N + 340,
     'grass strip  ·  340, inside the parapet, planted  ·  trellis over, creepers to 1.5 m'),
    # THE WHOLE DECK IS REAL GRASS, not two bays of it in a hard deck.  It runs
    # from the planted strip's south face at Y 190 to the glazing line at 2470,
    # end to end — 15 420 of it — and the only things it goes round are the two
    # retained voids, which are holes in the slab.  Five rectangles rather than
    # one because of those two holes; the striping picks up again either side.
    #
    # 31.1 m2 / 334 sq ft of it, against 10.5 / 113 as two bays — and with the
    # planted strip that is 36.3 / 391 of green on a 35.8 m2 deck, the overlap
    # being the strip, which is measured inside the deck and planted on top.
    #
    # TWO THINGS THIS NEEDS AND HAS NOT GOT YET, both worth settling before it
    # is priced:
    #   * the suites' sliding glass panels park on the deck on a track at
    #     X 4540-4600 and its mirror.  A track cannot run through turf; it
    #     wants a hard strip, and that strip will be visible.
    #   * grass wears where people walk, and the way out of the great room
    #     crosses it.  A paved threshold in front of the slider is the usual
    #     answer and is NOT drawn, because it is not what was asked for.
    ('grass',    POD_W0, DECK_N + 340, 7500, DECK_S, 'real grass, the whole deck'),
    ('grass',    7500, DECK_N + 340, 9115, 1200, 'real grass, north of the void'),
    # NOTHING BETWEEN THE VOIDS.  X 9115-15365 is the bay the great room walks
    # out on to, and it is boarded, not grassed — the same floor as the room
    # inside, on the same board grid, run through the slider.  See
    # retrofit.wood_floor().  The grass picks up again beyond each void.
    ('grass',    15365, DECK_N + 340, 16980, 1200, 'real grass, north of the void'),
    ('grass',    16980, DECK_N + 340, M(POD_W0), DECK_S, 'real grass, the whole deck'),
    ('gym',      4760, 340, 5960, 2340, 'all-in-one strength trainer  ·  1200 x 2000'),
    ('spa',      17930, 400, 19680, 2150, '4-seat spa'),
    ('fountain', 11640, 560, 12840, 1760, 'marble fountain, centre of the deck'),
    # ---------------------------------------------------------- great room
    # ------------------------- parents' pod: the sitting group
    # First drawn as three boxes marooned in the middle of the room facing each
    # other across nothing.  It was clumsy because it had no focus and nothing
    # to sit against — furniture in a row is not a group.
    #
    # It is composed on the room's own opening: the two-seater has its back to
    # the dining end and faces NORTH through the deck slider, with a centre
    # table in front of it and ONE recliner at the west end turned in.
    #
    # There were two recliners.  The east one came out — it stood in the pod's
    # own width between the sitting group and the glazed screen, which is the
    # route from the deck down to the dining table and on into the great room,
    # and there is no second thing on that side for it to belong to.  With it
    # gone the group is an L rather than a U: closed on the west and the south,
    # open to the deck on the north and to the great room on the east.
    #
    # THE ROUND CENTRE TABLE IS GONE, and so is the 500 side table that used to
    # stand on the terrace line at the recliner's left hand.  NOTHING IS ON
    # THAT LINE NOW: the pod's 2850 deck slider is clear end to end, against
    # 575 when the round table stood in it.
    #
    # AND NO TABLES AT ALL.  The round centre table went first, then the three
    # that replaced it: the one on the terrace line, the corner table in the
    # angle of the L, and the one on the sofa's arm.  What is left is two
    # seats and floor.
    #
    # It is worth being straight about what that means rather than dressing it
    # up: there is now nowhere in this group to put a cup down.  The nearest
    # surface is the dining table, 1130 south of the sofa's back.  The floor it
    # buys is real — the pod reads as one open room instead of a furnished
    # corner — but a side table is a thing you notice the absence of, not the
    # presence of, and it can go back in one line whenever it is wanted.
    #
    # THE SOFA STAYS 300 EAST of where it was drawn, which is where it went
    # when the recliner's footrest was finishing 60 off its west arm and
    # reading as touching it.  East was the only direction free: the recliner
    # cannot go west, since what is behind it is not a wall but the suite's
    # sliding partition and its track, and it cannot go north without standing
    # in the deck slider.  The chair has never moved.
    #   600 from the recliner's east face to the sofa
    #   360 from the tip of its footrest, reclined
    #
    # The recliner's footrest used to be drawn south whichever way the chair was
    # turned; it goes east now, which is where this one faces.
    #
    # Measured, all of it:
    #   1150 in front of the sofa, deck line to its north face
    #   1130 behind it, its back to the north end of the dining table
    #    641 east of the sofa to the pod glazing — the sofa could go further
    #        east now that nothing stands beside it, if the gap wants opening
    #   2850 of deck slider, all of it
    #
    # WHAT IT COSTS: the recliner stands 370 off the suite's sliding partition,
    # over Y 3120-4020 of its 3555 opening.  Nothing else is near it at all
    # now, so the way through from the bedroom is the 2155 south of the chair
    # plus the 500 north of it.
    ('recliner-w', 4900, 3120, 5700, 4020, "recliner  ·  800 x 900, facing east"),
    ('sofa-s',    6300, 3770, 8000, 4570, "sofa  ·  1700 x 800, facing the deck"),

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
    # SIX, AND NO END CHAIRS.  An occasional seventh was dashed in at the north
    # end and has come out.  Both ends of the table stay clear, and that is what
    # lets you walk round them: the south end is the serving stance at the hatch,
    # 500 off the wall, and the north end is the run up to the sitting group.
    ('dining-se', 6603, 5700, 7703, 7900,
     'superellipse 1100 x 2200  ·  six, seven with the north end chair'),
    # ------------------------------------------------- the deck: the two recliners
    # From the reference sheet: TWO 2-SEAT RECLINERS BACKING ON TO THE VOIDS,
    # FACING THE FOUNTAIN AT THE DECK CENTRE.  Each one's back is on the void
    # enclosure's inner face — 9115 on the west, 15365 on the east — so the
    # thing the deck cannot use for anything else becomes the thing the seats
    # lean on.  They face each other across the fountain at 11640-12840, 1355
    # from each footrest to its rim.
    #
    # 1600 LONG, NOT 1345.  They ran Y 1200-2545 for several rounds — the
    # void's own north edge down to the glass line — which looked tidy on the
    # sheet and gave 672 a seat.  A two-seat recliner sofa is 1500-1700 over
    # all, 750-850 a seat; 672 is a bench, not a recliner, and the arms would
    # touch a sitter's hips.  The south end cannot move — the deck's glazing
    # runs at Y 2545 and a seat that oversails it is inside the great room —
    # so the 255 was taken off the NORTH end instead, to Y 945.  Nothing is
    # north of them but open deck and their own side tables.
    #
    # Each has a small table at its NORTH arm, which is the only free side: the
    # void is behind, the fountain in front, the parapet planter beyond.  The
    # tables came north with the seats and lost 50 of depth to keep a foot of
    # planted strip showing north of them: 450 square on Y 495-945.
    ('recliner-w', 9115, 945, 10015, 2545,
     "2-seat recliner  ·  1600 x 900, back on the void, facing the fountain"),
    # THE DECK SIDE TABLES ARE GONE (Karan's call): a table north of each
    # recliner left 305 past the void and the deck read as three bays; without
    # them it is one walk, 1010 clear north of each void.
    ('recliner-e', 14465, 945, 15365, 2545,
     "2-seat recliner  ·  1600 x 900, back on the void, facing the fountain"),

    # ------------------------------------------------- the great room: living
    # The great room was 407 sq ft of empty floor.  It gets the reference
    # sheet's arrangement: a U OPENING NORTH TO THE DECK — sofa across the
    # bottom, an armchair turned in at each end, a centre table between them,
    # and a side table at every seat.  Everything is centred on X 12240.
    #
    # THE ONE THING THAT SETS THE DEPTH is the entry gallery's apse.  Its crown
    # is at Y 7485 on the axis and the arched portal into this room is IN it,
    # X 11715-12765 — so the sofa's back cannot go near it.  At Y 6500 there is
    # 985 between the two, which is the passage you come out of the front door
    # into.  It widens fast either side: the apse falls away to Y 7930 by the
    # sofa's west end, so the corners have 1430.
    #
    # North of the group there is 1055 of clear deck line, and the two pod
    # portals in the glazed screens are 1736 clear at both ends — the ways into
    # the family room and the den are not touched.
    # AN L OF TWO SOFAS WITH A TREE IN THE CORNER WHERE THEY MEET — 2800 along
    # the south facing the deck, 1700 turned in on the west, and a 950 square
    # planter box filling the angle between their two ends.  Not a U of loose
    # chairs: the seats are continuous and the corner, which in a U is the
    # awkward bit nobody sits in, is the thing you look at.
    #
    # THE CORNER IS ON THE WEST, and that is the one real choice here.  The
    # great room already has a planter on its SOUTH-EAST wall — the one that
    # answers the kitchen's bump — so putting the tree on the east would stack
    # all the greenery down one side of the room.  West balances it.
    #
    # 'sofa-w' / 'sofa-e' and not 'chair': the chair symbol is the dining one,
    # a seat with no side to it.
    # THE GREAT ROOM IS TWO PAIRS AND A RUG, not one group with strays in it.
    #
    #   east half   the 2-seat recliner sofa, square to the room and facing
    #               the deck, with its planter and tree built on to the east
    #               end, paired with the east deck recliner at 3261 across
    #               the slider line.  A console on its back line and a rug
    #               under the whole assembly.
    #
    #               It was turned a quarter turn left for one round, to stand
    #               north-south facing west, and turned back.  The turn was
    #               the only version of this room whose floor you could walk
    #               straight through from the front door — it cleared the
    #               gallery portal's lane by 62 — but it cost the sofa the
    #               deck, which is what the room is for.
    #   west half   TWO rocking chairs, genuinely parallel, 1500 apart with
    #               800 of clear floor between them, both on the same 28.0
    #               degree line at the east recliner.
    #
    # The pieces themselves are in retrofit: great_room_sofa(),
    # rocking_chairs() and console_top().  The rug and the console are the
    # only two here, because they are shapes the symbol library already draws.
    #
    # THE RUG IS 3000 x 2000 — a stock size, not a number invented to fit — and
    # the WHOLE assembly stands on it, sofa and planter alike, 250 clear each
    # side and 820 in front of the extended footrests.  It was drawn once at
    # 2400 x 1700 stopping on the planter's west face, to keep a soil box off
    # a rug, and it read as a rug sliding out from under the sofa to one side.
    # A liner under the planter is a cheaper answer than an off-centre rug.
    #
    # Its south edge is the sofa's own back line at 5037, so THE CONSOLE
    # STANDS ON THE BOARDS: a console with two legs on a rug and two off rocks
    # every time you put a glass down on it.
    # THE RUG IS NOT HERE ANY MORE.  It is no longer a rectangle, so it is
    # drawn by retrofit.great_room_rug() — full width of the room at 5622,
    # centred, with 500 of boarded floor showing off each pod screen.
    # A SIDE TABLE AT EVERY SEAT, which is what the reference has and what
    # the plan was missing: somewhere to put a cup down without leaning past
    # the person next to you.  400-450 square, which is as big as any of the
    # three gaps they sit in will take.
    ('sidetable', 9800, 3050, 10250, 3500,
     "side table  ·  450 square, north of the recliner"),
    ('sidetable', 13900, 3450, 14350, 3900,
     "side table  ·  450 square, east of the rocking chair"),
    ('sidetable', 12760, 4950, 13160, 5350,
     "side table  ·  400 square, between the sofa's east end and the armchair"),
    ('recliner-w', 9673, 3532, 10573, 4332,
     'recliner  ·  900 x 800, single, standing 305 off the planter\'s north '
     'face  ·  the L\'s west leg, facing east across the group'),
    ('counter-e', 10878, 5537, 12478, 5887,
     "console  ·  1600 x 350, four corners eased 90, on the sofa's back line  ·  "
     "two lamps, books and a bowl on it"),

    # ---------------------------------------- Karan's pod: the music + work den
    # The den was empty floor.  It gets the two things it is named for: a work
    # CONSOLE along the pod's glazed screen, and an ELECTRONIC DRUM KIT in the
    # south-east corner where the great-room wall meets the service-duct wall.
    #
    # THE CONSOLE IS NOT WHERE IT WAS FIRST MARKED, and the reason is arithmetic
    # rather than taste.  Marked at the south end it would have run Y 6175-8400,
    # in the bay that is only 2895 wide — and a TD kit with four toms and three
    # cymbals is 1790 across, a chair actually in use is 600, and the console is
    # 700.  That is 3090 wanted against 2895 there, so swivelling out of the
    # desk chair would have put its back on the nearest cymbal.
    #
    # Moved 1375 north it runs Y 4800-7000 instead, which puts the chair in the
    # part of the pod that is 4070 wide rather than 2895, and hands the whole
    # south bay to the drums.  It costs nothing: same 700 depth, same 2200 of
    # top, and it still starts 108 south of the pod screen's portal at Y 4692
    # so the way in from the great room is untouched.
    #
    # 700 and not 600: a 27-inch screen on a stand plus a keyboard in front of
    # it does not fit on 600 without the screen overhanging the back edge.
    # BOTH ENDS BULLNOSED, 350 — the house does not do square corners on
    # anything that stands free.  The baths are arches, the gallery is an apse,
    # the dining table is a superellipse, run B's nose is eased 300 and its far
    # end is struck off the apse.  This console floats along the glass with
    # neither end against anything, so both get the full half-width round and
    # it reads as a piece of the same drawing.  It costs 0.05 m2 of top.
    ('counter-b', 15880, 4800, 16580, 7000,
     "work console  ·  2200 x 700, back on the pod screen, both ends bullnosed"),
    # The screen faces EAST, because with the desk's back on the glass there is
    # only one side to sit at.  You work looking west, through the screen and
    # the pod glazing into the great room.  300 of the 700 goes to the monitor
    # and its foot; the 400 in front of it is the keyboard.
    ('screen-w', 15920, 5150, 16220, 5830, "monitor  ·  27 inch, facing east"),
    ('swivel',   16620, 5190, 17220, 5790, "desk chair  ·  600, swivel"),

    # ------------------------------- Karan's pod: the two recliners
    # NOT the parents' group after all.  It was mirrored in as a sofa and a
    # recliner in an L; it is TWO RECLINERS side by side instead, both facing
    # north through the deck slider, with a small table between them.
    #
    # The two pods stop being a mirrored pair, and that is the point: this one
    # is a den for one or two people looking at the deck, not a room to receive
    # in.  An L wants somebody to sit in the return and talk across the corner,
    # which is what the parents' pod is for.
    #
    # 800 + 450 + 800 = 2050, centred on Karan's deck slider at X 18405 — so
    # the pair sits square on the opening it faces rather than square on the
    # room, which is what you notice from the chairs.
    #
    # The table is 450 x 600, its back on the chairs' own back line at Y 4570,
    # because that is where your elbow is when you are actually reclined.  A
    # table centred on the seat would be level with your knees.
    ('recliner-s', 17380, 3670, 18180, 4570, "recliner  ·  800 x 900, facing the deck"),
    ('sidetable',  18180, 3970, 18630, 4570, "side table  ·  450 x 600, between the two"),
    ('recliner-s', 18630, 3670, 19430, 4570, "recliner  ·  800 x 900, facing the deck"),
    # The kit itself is circles struck off one centre — see retrofit.drum_kit().
    # 255 from its westernmost cymbal to the console's front edge, 150 to the
    # duct wall, 140 to the great-room wall, and open pod behind the drummer.

    # ------------------------------------------------------------- kitchen
    # Run B stops 850 short of the gallery: the apse springs vertically off the
    # column, so the only stretch of gallery wall the kitchen can have a door
    # in is right beside that column — and this counter used to run into it.
    # RUN B TURNS THE CORNER.  It used to run straight past the bump, 2650 long
    # and 600 deep, ignoring the fact that the wall behind its eastern end had
    # stepped 600 away — which left a 600 slot behind it that no arm reaches
    # over a worktop.  It now follows the wall: along the old line to the
    # return, round it, and on along the new wall until the apse cuts it off.
    # 2.65 m2 of worktop against 1.59 — two thirds more — and no dead space
    # anywhere behind it.
    # The polygon is in retrofit.kitchen_counter() — it has a curved end struck
    # off the apse, so it cannot be a rectangle.
    #
    # What that produces at the turn is an ordinary L-kitchen BLIND CORNER.
    # The block where the two legs stack is 600 x 1200, but only half of it is
    # blind: the lower leg's half faces north into the room and opens fine.
    # The upper leg's half — 600 x 600 at X 8725-9325 / Y 7925-8525 — has its
    # front on the line where the lower leg's carcass begins, so it can have no
    # door of its own.  A MAGIC CORNER serves it, drawn in
    # retrofit.magic_corner().  It is not a place for a sink or a hob.
    ('sink',     8060, 8600, 8660, 9050,
     'sink  ·  west of the blind corner, and 1400 nearer the stack than it was'),
    ('shelves',  6900, 8525, 8000, 8725,
     'serving hatch, 1100 — opens into the parents pod'),
    # --- the window run and the appliance corner, ONE UNBROKEN L
    # Three pieces with two 400 gaps between them, and neither gap was wanted:
    # both came from setting the hob counter 400 in from each jamb of its
    # window.  The run is now continuous from the fridge's side at X 7800 to
    # the gallery leg, then north up it.  The polygon is in
    # retrofit.hob_counter(); the hob has not moved off its window at 8800.
    #
    # The western 400 mattered more than the eastern one: the hob had 300 of
    # counter to its left, which is not enough to set a hot pan down on.  It
    # has 700 now, against 1300 on its right.
    ('under',    8500, 10390, 9100, 10960, 'integrated dishwasher  ·  600 x 570'),
    ('hob',      8500, 10420, 9100, 10930, 'hob  ·  600 x 510, 45 clear front and back'),
    # --- the fridge, west of the hob run, flush with the wall.  It sits clear
    #     of the window, which starts at 7800, so nothing stands in front of it.
    ('appliance', 7000, 10275, 7800, 10975, 'fridge  ·  flush with the wall'),
    # --- the small appliances: on the north run east of the sink, under the
    #     wall cabinets, where Karan wants them - the microwave and the air
    #     fryer, one each, and nothing else. The L's north leg by the gallery
    #     column is clear worktop with a condiment rack against the wall.
    ('under',    9500, 7965, 9950, 8345, 'microwave'),
    ('under',    10050, 7965, 10430, 8345, 'air fryer'),
    # The two pod corner units — mandir and coffee / pantry — are behind the
    # retained deck void, in the corner between its back wall and the pod
    # glazing.  Their shape follows the curve, so they are built in
    # retrofit.corner_units() where the Bezier lives.
    # ------------------------------- the utility end of the kitchen
    # The stacked washer and dryer, and nothing loose beside them: the laundry
    # basket and the dustbin that stood here came out after the walkthrough.
    ('appliance', 5755, 10375, 6355, 11025, 'washer + dryer, stacked'),
    # A FULL-HEIGHT RACK between the washer-dryer and the fridge, 600 x 600,
    # with the laundry basket in its base.  There is no room for another
    # opposite the washer — a 600 rack on the north end would leave 305 in
    # front of a front-loader — so that end gets a LOFT instead, 2300 up, the
    # full 1195 x 905 of the utility strip's north end.
    ('shelves',  6400, 10425, 7000, 11025, 'full-height rack  ·  600 x 600, basket in its base'),
    ('under',    5705, 9470, 6900, 10375, 'loft over  ·  2300 up, 1195 x 905'),
    # ------------------------------------------ help\'s room (with the store)
    # The bunk lies ALONG the south wall at the EAST end of the merged room,
    # head against the east wall, under the secondary duct.  That is the end
    # the old store was, and the end nothing has to be reached through: the
    # entry door, the WC door and the whole triangle under the apse are all
    # west of its foot at 16925, with 1550 of clear floor north of it.
    #
    # The 1245 x 525 pocket under the duct, at the bunk's head, has no floor
    # in front of it — the apse dies on the bunk's north edge — so it cannot
    # be reached standing.  It is bedside shelving, reached from the berths,
    # and the store's cupboard proper stands at the west end of the south
    # band instead, in the corner against the gallery's leg, where a person
    # stands in front of it on the room's main floor.
    ('bunk',     16925, 10075, 18825, 10975, 'bunk'),
    ('shelves',  17580, 9550, 18825, 10005, 'shelves at the bunk head'),
    # FULL-HEIGHT RACKS, 300 deep, floor to ceiling: down the gallery leg from
    # below the entry door's swing, along the south wall to the bunk's foot,
    # and round the outside of the apse to the WC door (retrofit.help_rack).
    # The 600 cupboard is gone — the racks carry more and take less floor.
    # The band in front of the south rack is 600 deep, the bunk's approach.
    ('shelves',  14080, 9400, 14380, 10675, 'full-height rack  ·  300 deep, on the gallery leg'),
    ('shelves',  14080, 10675, 16925, 10975, 'full-height rack  ·  300 deep, on the south wall'),
    # ------------------------------------------------- guest / service WC
    # One WC, one small basin, one very small shower — and nothing else, which
    # is what an apse this size will take.  The shower is flush into the corner
    # against the duct wall, and the pan is at the far end, where the apse dies
    # into that wall.  The basin is not here: it is set into a curved console
    # struck off the apse itself, immediately inside the door — see
    # retrofit.wc_console().
    ('shower',   16530, 8425, 17430, 9325, ''),   # 900 x 900
    # Turned a quarter, so its back is on the duct wall rather than floating in
    # the room.  700 deep from that wall, 620 wide, and it clears the apse: the
    # arc's inner face is at about 16235 on this pan's south line.
    ('wc-e',     16750, 9430, 17430, 9820, ''),  # 680 x 390
    # ------------------------------------------------------ the entry gallery
    # THE U HAS TWO LONG FACES AND NOTHING WAS AGAINST EITHER OF THEM.  Its
    # legs run Y 9325-11125 with 3220 between their inner faces, so both can
    # take a piece 800 deep and still leave a lane wider than the arch at the
    # far end of it.
    #
    # Console west, TWO CHAIRS east, all centred on the legs' own 1800 so they
    # read as a set rather than as things that happened to fit.  A painting
    # hangs on the leg above the console with a picture light over it — the
    # one thing an entry hall is actually for is the last look before you
    # leave, and this is what you look at.
    #
    # A 2-SEAT SOFA WAS DRAWN THERE FIRST and taken out.  A hall is somewhere
    # you sit for a minute to put a shoe on, not somewhere two people settle
    # side by side; two chairs 200 apart do that job and leave the wall
    # reading as a pair of pieces rather than one long lump.
    #
    # WHAT THE LANE BETWEEN THEM HAS TO CARRY is the walk from the front door
    # to the great room: 2020 clear with the console 450 deep, against the
    # arched portal's own 1050 at the far end of it.  Nothing on this route
    # narrows below the door it leads to.
    ('console-w', 10630, 9525, 11080, 10925,
     'console  ·  1400 x 450, against the U\'s west leg, corners eased 110  ·  '
     'painting over, picture light'),
    ('sofa-e',    13100, 9425, 13850, 10125,
     'chair  ·  700 x 750, against the U\'s east leg, facing west'),
    ('sofa-e',    13100, 10325, 13850, 11025,
     'chair  ·  700 x 750, against the U\'s east leg, facing west'),

]

# Drawn on both halves of the home.
_MIRROR = [
    # The bed is OFF the drawing for now — the wardrobes and the bath come
    # first, and a bed sitting there while they are set out only argues with
    # them.  It goes back when the joinery is settled.  The symbol and the
    # mirror rule stay, so it is one line to bring back:
    #   ('bed-e', 700, 6975, 2700, 8775, 'king 1800 x 2000, head on the bath wall'),
    # The baths are NOT mirrored any more — the parents' cubicle holds two
    # baths and Karan's holds one — so both sets are in _ONCE.
]

_FLIP = {'bed-e': 'bed-w', 'bed-w': 'bed-e', 'bed-n': 'bed-n', 'bed-s': 'bed-s',
         'wc-e': 'wc-w', 'wc-w': 'wc-e'}
FURNITURE = (list(_ONCE) + list(_MIRROR)
             + [(_FLIP.get(k, k), M(c), b, M(a), d, lab)
                for k, a, b, c, d, lab in _MIRROR])

# GALLERY_FURNITURE holds pieces set out in POLAR coordinates, for anything
# that follows the apse's curve.  Nothing does yet: the gallery's console and
# sofa are both straight runs against the U's straight legs, so they live in
# _ONCE with everything else rectangular.  Curved joinery in the apse itself
# comes back when it is designed properly.
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
