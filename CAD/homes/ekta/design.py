"""
EKTA'S FLAT — 14th floor, Neeldhara. Next door to Om Neeldhara.

THIS FILE IS THE DESIGN. It started as the output of homes/ekta/import.py —
every number below was read off the builder's DWG and every room checked
against his own dimension text — and from here it is hand-edited, the way
Om Neeldhara's design.py is.

    import.py                the record of what the BUILDER drew. Re-running
                             it now needs --force; `--to design.imported.py`
                             writes a fresh copy of his plan to diff against.
    design.imported.py       that copy, frozen at handover.

    RERA        1073 sq ft  =  carpet 1032 + balcony 41
    carpet      95.83 m2 (1032 sq ft) — his figure exactly
    balcony     3.75 m2 (40 sq ft)
    envelope    107.68 m2 (1159 sq ft) to the outer face
    frame       the flat's north-west corner is (0, 0); x east, y SOUTH, so
                the sheet reads the same way up as the DWG

This is the flat AS THE BUILDER HANDS IT OVER — geometry with no reasoning
behind it, because a DWG carries no intent. Om Neeldhara's design.py reads
the other way round: every number there has a comment saying why. That is
what this file becomes when somebody starts designing the flat.
"""

import math

# --------------------------------------------------------------- the shell
# Outer face of the external walls: the floor plate (carpet + balcony) pushed
# out by one 150 wall.
ENVELOPE = [
    (-150, -150), (3200, -150), (3200, 470), (8295, 470), (8295, -150), (11620, -150),
    (11620, 8505), (8295, 8505), (8295, 7895), (6950, 7895), (6950, 12470), (3650, 12470),
    (3650, 11070), (455, 11070), (455, 9550), (2145, 9550), (2145, 4270), (-150, 4270)
]

# The RERA carpet boundary exactly as drawn, measured to the inside faces.
CARPET = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0), (11470, 8355),
    (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070), (3800, 11070), (3800, 10920),
    (605, 10920), (605, 9700), (2295, 9700), (2295, 4120), (0, 4120)
]

# The balcony slab. RERA counts it separately from the carpet.
BALCONY = [(3800, 11070), (6800, 11070), (6800, 12320), (3800, 12320)]

# Carpet + balcony as one polygon: the floor you can stand on. Everything
# between this and ENVELOPE is external wall.
PLATE = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0), (11470, 8355),
    (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070), (6800, 12320), (3800, 12320),
    (3800, 11070), (3800, 10920), (605, 10920), (605, 9700), (2295, 9700), (2295, 4120),
    (0, 4120)
]

# ------------------------------------------------------- the kitchen line
# THE KITCHEN IS A U WITH ROUNDED CORNERS, not a bowl. Straight down both
# sides, flat along the bottom, and a generous radius where they meet — so
# every wall in it is a wall you can stand a run of units against, and the
# corners are turned rather than pinched.
#
# The parabola that was here before had no straight anywhere: its curvature
# was tightest exactly where the counter is longest, and it ran to nothing at
# the ends. This shape is the opposite — it is mostly straight, and the only
# curvature is in two corners with one radius between them.

# Slid east so the kitchen's right-hand wall lands ON column 1 rather than
# beside it — same footprint, one thickness, not two. What the move uncovered
# on the west is the only place in this flat a second bathroom can go and
# still reach the north shaft.
KX0, KX1 = 4495.0, 8410.0     # centrelines of the two sides
KTOP, KBOT = 545.0, 3400.0    # the north wall, and how far south the U reaches
KR = 900.0                    # corner radius — the "no sharp curve" number

# THE WALL AND THE COLUMN ARE THE SAME RECTANGLE. Column 1 is 8295-8525, 230
# thick; the kitchen wall is now 230 too and centred on 8410, so along the
# column's whole length the two footprints coincide exactly. Before this the
# wall's east face merely BUTTED the column's west face and the pair read as
# 430 (1'-5") of solid on the kitchen's right-hand side — a wall with a column
# stuck to it. Now only one thickness shows, and the kitchen gains the 230 it
# was giving away.
KT = 230.0          # kitchen wall thickness, = the column

FACE = KT / 2       # a slab starts at the wall's face, not its centreline
DEPTH = 400.0       # slab projection: knee room under, plates on top
SEAT = 700.0        # stool centres, measured from the wall centreline
TAPER = 0.22        # the fraction at each end over which a slab dies away
SPAN = (0.27, 0.73) # the stretch of the U a slab runs along, by arc
SEATS = (0.35, 0.65)


def _round_u(n=32):
    """Down one side, round the corner, along the bottom, round and back up."""
    pts = [(KX0, KTOP), (KX0, KBOT - KR)]
    cx, cy = KX0 + KR, KBOT - KR
    for i in range(1, n + 1):                       # left corner
        a = (math.pi / 2) * i / n
        pts.append((cx - KR * math.cos(a), cy + KR * math.sin(a)))
    cx = KX1 - KR
    for i in range(n + 1):                          # bottom, then right corner
        a = (math.pi / 2) * i / n
        pts.append((cx + KR * math.sin(a), cy + KR * math.cos(a)))
    pts.append((KX1, KTOP))
    out = []
    for q in pts:
        q = (round(q[0], 1), round(q[1], 1))
        if not out or abs(q[0] - out[-1][0]) > 0.5 or abs(q[1] - out[-1][1]) > 0.5:
            out.append(q)
    return out


def _run(pts):
    r = [0.0]
    for i in range(1, len(pts)):
        r.append(r[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                    pts[i][1] - pts[i - 1][1]))
    return r


U_LINE = _round_u()
ARC = _run(U_LINE)[-1]      # the U as it reads: what openings are measured on

# THE LAST 40 MM. Rooms are faces of the wall graph, and a wall that stops
# short of the boundary leaves no face — the kitchen ran out into the living
# room the first time this wall was moved onto the column. The external wall's
# line turns north at x 8370 (its outer face is the 8295 the column stands on,
# and it is 150 thick), so the U's right-hand leg, now centred on 8410, misses
# that corner by exactly the 40 between them. T-KIT-NE below closes it: a
# threshold, not a wall, because the gap is already solid — it is the inside of
# the external wall — and drawing 40 mm of 230 wall there only put a mitred
# notch across the column.
ENV_NE = 8370.0
KITCHEN_LINE = U_LINE
KITCHEN_RUN = _run(KITCHEN_LINE)


def _kit_bot_arc(x):
    """The distance along the kitchen wall to a point on its FLAT BOTTOM.

    Openings on a polyline are distances along it, and the bottom of the U is
    two arcs and a leg from the start — a number nobody should be typing. The
    run is measured off the line itself, so the arcs can be re-cut and the
    hatch stays where it was put.
    """
    i0 = next(i for i, q in enumerate(KITCHEN_LINE) if abs(q[1] - KBOT) < 0.5)
    return round(KITCHEN_RUN[i0] + (x - KITCHEN_LINE[i0][0]), 1)


def _arc_d(frac):
    """A distance along the kitchen wall, from a fraction of it. Openings on
    this wall are authored this way because there is no axis to measure
    against — the wall turns two corners."""
    return round(ARC * frac, 1)


def _pt_at(d):
    """The point d millimetres along the kitchen wall."""
    d = min(max(d, 0.0), ARC)
    i = next((j for j in range(1, len(KITCHEN_RUN)) if KITCHEN_RUN[j] >= d),
             len(KITCHEN_RUN) - 1)
    a, b = KITCHEN_LINE[i - 1], KITCHEN_LINE[i]
    seg = KITCHEN_RUN[i] - KITCHEN_RUN[i - 1] or 1.0
    u = (d - KITCHEN_RUN[i - 1]) / seg
    return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u


def _bar_point(f, h=90.0):
    """Position and OUTWARD normal at fraction f along the kitchen wall.

    The tangent is taken across a 180 mm window rather than from the segment
    the point happens to land on. A polyline's normal jumps at every vertex,
    and offsetting a slab 500 out from it put a 40 mm sawtooth along both
    corners; averaging across the joint takes it out.
    """
    d = ARC * min(max(f, 0.0), 1.0)
    px, py = _pt_at(d)
    ax, ay = _pt_at(d - h)
    bx, by = _pt_at(d + h)
    tx, ty = bx - ax, by - ay
    L = math.hypot(tx, ty) or 1.0
    # The U is traced down the left side, along the bottom and back up, so
    # (ty, -tx) points INTO the kitchen. Outward is the other one.
    return px, py, -ty / L, tx / L


# ------------------------------------------------- the north-west quarter
# THE WING BECOMES A ROOM. The flat's north-west arm — 3050 (10'-0") wide and
# 4120 (13'-6") deep, with windows on two sides — was hanging open into the
# living room. Two walls close it and put the flat's first bathroom in the only
# pocket that can hold one:
#
#   W-BED-E   straight down x 3125, which is the external return wall's own
#             centreline carried south, so the wall reads as that wall
#             continuing rather than as a new one starting.
#   W-NW      ONE curve, from the kitchen to the wing's outside corner. It is
#             what closes the quarter off from the living room, and it carries
#             both doors: the bedroom's, and the bathroom's second one.
#
# The pocket between them, 1180 (3'-10") wide and reaching the north wall where
# the drainage is, is the bath. It opens BOTH ways: a door west into the
# bedroom, and a door south out of the curve, so the living room has a WC
# without going through the bedroom.
#
# THE CURVE BOWS INTO THE BEDROOM, not out into the living room. W-BED-E lands
# on it and splits it into the bath's stretch and the bedroom's, and which way
# it bows decides how that split falls: bowed out into the living room, as it
# was first drawn, the bedroom's share collapses to 942 (3'-1") and its door
# has no jamb at either end. Bowed this way the two stretches come out
# 1483 (4'-10") and 1498 (4'-11"), and each takes a 900 (2'-11") door with
# room to spare. The sweep also opens the living room's corner instead of
# pushing into it.
BED_E = 3125.0                  # the return wall's line, carried south
NW_A = (4495.0, 2500.0)         # on the kitchen wall, where its corner begins
NW_B = (2220.0, 4195.0)         # the wing's outside corner
NW_BOW = 400.0
NW_DOOR = 850.0                 # both doors in the curve


def _bez(a, b, bow, t):
    """A point on a bowed wall. Same construction the tools use: the control
    point is offset by TWICE the sagitta, so `bow` is a distance you can
    measure on the sheet."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1.0
    cx = (a[0] + b[0]) / 2 - dy / L * 2 * bow
    cy = (a[1] + b[1]) / 2 + dx / L * 2 * bow
    u = 1 - t
    return (u * u * a[0] + 2 * u * t * cx + t * t * b[0],
            u * u * a[1] + 2 * u * t * cy + t * t * b[1])


NW_PTS = [_bez(NW_A, NW_B, NW_BOW, i / 2000) for i in range(2001)]
NW_RUN = _run(NW_PTS)
NW_ARC = NW_RUN[-1]


def _nw_arc_at_x(x):
    return next((NW_RUN[i] for i in range(len(NW_PTS)) if NW_PTS[i][0] <= x),
                NW_ARC)


def _nw_x_at_arc(d):
    return round(next((NW_PTS[i][0] for i in range(len(NW_RUN))
                       if NW_RUN[i] >= d), NW_PTS[-1][0]), 1)


# Where W-BED-E dies ON the curve. A wall that stops short of another leaves
# the two rooms it separates as one face, so this is solved, not estimated.
_bed_arc = _nw_arc_at_x(BED_E)
BED_S = round(next(NW_PTS[i][1] for i in range(len(NW_RUN))
                   if NW_RUN[i] >= _bed_arc), 1)

# BOTH DOORS GO AT THE ENDS, not in the middle of their stretch. Centre them
# and the wall comes out as three short fragments with nothing between; push
# them out to the junctions and the 1180 (3'-10") in the middle survives as one
# unbroken piece of curve, which is the only part of it anybody reads. The
# jambs are the walls the doors butt against — the kitchen at one end, the
# outside wall at the other — so nothing is lost by it.
# Given in x because that is what the wall table takes; the export turns them
# back into arc length. Nothing here is typed in twice.
NW_REVEAL = 250.0               # so the curve still lands on something
NW_BATH_DOOR = (_nw_x_at_arc(NW_REVEAL),
                _nw_x_at_arc(NW_REVEAL + NW_DOOR))
NW_BED_DOOR = (_nw_x_at_arc(NW_ARC - NW_REVEAL - NW_DOOR),
               _nw_x_at_arc(NW_ARC - NW_REVEAL))

# --------------------------------------------------- the south-east bath
# THE SECOND BATHROOM GOES WHERE THE BUILDER PUT HIS. His TOILET 02 was here —
# 4'-6" x 8'-0", 36 sq ft on his own dimension text — sitting on the notch wall
# with its stack dropping into the south-east re-entrant below. That re-entrant
# is one of only two points in this flat a soil stack can reach; the other is
# the north notch, where BATH is.
#
# THE WALL GOES ROUND THE COLUMN, and the column ends up inside the room. The
# first version of this stopped short of it and took only the 1345 (4'-5") gap
# between the notch arris and the column's west face — a slot you could not do
# anything in but stand in single file. Taking the column in instead buys the
# whole width of the arm's south-west corner, and the column stops being an
# obstruction and starts being the shower's east wall.
#
# ONE WALL, four straight runs and two turns: up the notch wall's own line,
# a 900 corner, across the top, a 400 corner, and down to the flat's south wall
# in the arm. The 900 is the kitchen's radius; a curve that big is what makes
# the room read from the living side as a shape rather than as a box.
SEB_WX = 6875.0     # the notch wall's centreline, carried north
SEB_NY = 5400.0     # the top
SEB_EX = 9450.0     # the east side, out in the arm
SEB_S = 7820.0      # the notch wall — where the run starts
SEB_SY = 8430.0     # the arm's south wall — where it ends
SEB_T = 150.0
SEB_RW, SEB_RE = 900.0, 400.0


def _seb_line(n=32):
    pts = [(SEB_WX, SEB_S), (SEB_WX, SEB_NY + SEB_RW)]
    cx, cy = SEB_WX + SEB_RW, SEB_NY + SEB_RW
    for i in range(1, n + 1):                       # the big corner
        a = (math.pi / 2) * i / n
        pts.append((cx - SEB_RW * math.cos(a), cy - SEB_RW * math.sin(a)))
    cx, cy = SEB_EX - SEB_RE, SEB_NY + SEB_RE
    for i in range(1, n + 1):                       # the tight one
        a = (math.pi / 2) * i / n
        pts.append((cx + SEB_RE * math.sin(a), cy - SEB_RE * math.cos(a)))
    pts.append((SEB_EX, SEB_SY))
    out = []
    for q in pts:
        q = (round(q[0], 1), round(q[1], 1))
        if not out or abs(q[0] - out[-1][0]) > 0.5 or abs(q[1] - out[-1][1]) > 0.5:
            out.append(q)
    return out


SEB_LINE = _seb_line()
SEB_RUN = _run(SEB_LINE)

# THE DOOR IS IN THE EAST RUN, at its far end, and the top of the room is
# solid. It was in the top run first, which put the way in on the side the
# living room sees most of and broke the wall's best stretch of curve; down
# here it is in the corner the arm already leads to, and the doorway's far
# jamb is the external wall itself.
#
# Openings on a polyline are distances ALONG it, so the runs are measured
# rather than typed: down the west side, round the big corner, across the top,
# round the tight one, and only then south.
_SEB_EAST0 = ((SEB_S - SEB_NY - SEB_RW)
              + math.pi / 2 * SEB_RW
              + (SEB_EX - SEB_RE) - (SEB_WX + SEB_RW)
              + math.pi / 2 * SEB_RE)
SEB_DOOR = (_SEB_EAST0 + (7555.0 - (SEB_NY + SEB_RE)),
            _SEB_EAST0 + (8355.0 - (SEB_NY + SEB_RE)))          # 800 clear

# Inner faces, which is what the fixtures are set out from.
SEB_X0, SEB_X1 = SEB_WX + SEB_T / 2, SEB_EX - SEB_T / 2   # 6950 .. 9375
SEB_Y0 = SEB_NY + SEB_T / 2                               # 5475
SEB_Y1, SEB_Y2 = 7745.0, 8355.0     # the notch wall, and the arm's south wall

# ------------------------------------------------- the east arm, closed off
# THE ARM BECOMES A ROOM. 3025 (9'-11") wide and the length of the flat, with
# windows at both ends and a blind party wall down its side, it was the last
# big piece of the plan still reading as leftover living room. A screen on the
# kitchen's own line closes it.
#
# The line is not chosen, it is inherited: the kitchen's east wall is already
# at x 8410 — on column 1 — and it turns west at y 2500. Carrying that same x
# south to the bath's top wall at 5400 costs nothing and lines the two up
# exactly. Both ends land on a wall that is already there: (8410, 2500) is a
# vertex of KITCHEN_LINE, and (8410, 5400) is on W-SEB's straight top run.
ARM_X = 8410.0
ARM_N, ARM_S = 2500.0, 5400.0
ARM_REVEAL = 100.0      # a jamb at each end for the track to die into
ARM_LEAF = 900.0        # three of them, and nothing fixed

# WHERE THE PANELS GO WHEN THEY ARE OPEN. Not a fixed panel across the north
# third of the opening — that was the first version and it meant a third of
# the screen could never move. They run north instead, past the top of the
# opening, and stack flat against the kitchen wall's EAST face, on the room's
# side of it, where there is 1955 (6'-5") of wall and nothing in front of it.
# Open, the whole 2700 (8'-10") is clear.
#
# The track is face-fixed to that wall, so the panels' plane is 115 (4-1/2")
# east of the line the screen is drawn on. Every surface-mounted slider has
# that offset and no plan at this scale draws it; what is drawn is where the
# stack ends up, because that is the part that decides whether the room works.
ARM_PARK_X = 8525.0     # the kitchen wall's east face
ARM_PARK = [(ARM_PARK_X, ARM_N - ARM_LEAF), (ARM_PARK_X + 140.0, ARM_N - ARM_LEAF),
            (ARM_PARK_X + 140.0, ARM_N), (ARM_PARK_X, ARM_N)]

# ------------------------------------------- the hatch and the eating counter
# THE COUNTER STARTS WHERE THE WALL STOPS TURNING. Its west edge is KX0 + KR —
# the tangent point where the U's south-west corner runs out and the flat
# bottom begins — so the slab has straight wall under the whole of it, and the
# hatch's west jamb has a reason to be where it is. It sat in the middle of
# the bottom run before, which was where an old opening happened to be rather
# than anywhere in particular.
#
# THE HATCH IS THE COUNTER. Not an opening with a counter somewhere in it: the
# slab is the sill and the gap above it is the hatch, so the two are the same
# 800 (2'-7") and neither number can drift from the other. The tinted glass
# either side runs at 1050 (3'-5") as it does all round the U; this stretch
# drops to the counter top at 900 (2'-11") and is open from there to
# 2100 (6'-11").
#
# ONE SLAB THROUGH THE WALL. Inside the kitchen it is 400 (1'-4") of serving
# counter to put plates down on; outside it runs 1400 (4'-7") into the living
# room as the eating bar, two chairs a side. The wall under it stays solid — a
# sill above zero never cuts a wall in plan, and the base of this one is
# holding the slab up.
BAR_IN, BAR_OUT = 400.0, 1400.0     # kitchen side, living side
BAR_TOP = 900.0                     # counter height, and the hatch's sill
BAR_W = 800.0                       # the slab, and the hatch, 800 (2'-7")
BAR_SEATS = 2                       # a side
SEAT, SEAT_OFF, SEAT_GAP = 450.0, 400.0, 700.0

BAR_X0 = KX0 + KR                   # the tangent point: 5395
BAR_X1 = BAR_X0 + BAR_W
HATCH = (_kit_bot_arc(BAR_X0), _kit_bot_arc(BAR_X1))

# ----------------------------------------------------- the way into the kitchen
# THE KITCHEN HAD NO DOOR. Every opening in the U was a window at 1050 (3'-5")
# or the hatch at 900 (2'-11"), and the two legs die into the external wall, so
# the room closed on itself — you could see in and pass a plate through, and
# that was all. The U was cut for a counter that ran the whole way round and
# nobody ever put the doorway back.
#
# It goes in the SOUTH-EAST CORNER, starting at the tangent point where the
# flat bottom ends, so the flat bottom runs between two tangent points — the
# counter at one end and the door at the other — and the glass fills what is
# left. A corner is also the cheapest 850 (2'-9") of a kitchen to give up: the
# inside of a 900 (2'-11") turn is the one stretch of a U where a counter is
# reaching round a corner rather than being worked at.
#
# The opening curves, because the wall does. An 850 arc on a 900 radius has an
# 819 (2'-8") chord and 98 (4") of sagitta, so the frame is set on the chord
# and the reveal behind it splays — a flat leaf, a curved jamb. It swings OUT,
# into the living room, because everything on the inside of that corner is
# counter.
KDOOR_W = 850.0
KDOOR = (_kit_bot_arc(KX1 - KR), _kit_bot_arc(KX1 - KR) + KDOOR_W)

_BAR_N = KBOT - KT / 2 - BAR_IN     # 2885
_BAR_S = KBOT + KT / 2 + BAR_OUT    # 4915
BAR_SLAB = [(BAR_X0, _BAR_N), (BAR_X1, _BAR_N), (BAR_X1, _BAR_S), (BAR_X0, _BAR_S)]


def _bar_chairs():
    """Two a side, set out from the counter's own edges."""
    out = []
    for sx in (BAR_X0 - SEAT_OFF, BAR_X1 + SEAT_OFF):
        for k in range(BAR_SEATS):
            cy = KBOT + KT / 2 + 350.0 + k * SEAT_GAP
            out.append((round(sx - SEAT / 2, 1), round(cy - SEAT / 2, 1),
                        round(sx + SEAT / 2, 1), round(cy + SEAT / 2, 1)))
    return out


BAR_CHAIRS = _bar_chairs()

# ------------------------------------------------------------- the walls
# (x1, y1, x2, y2, thickness, openings, kind, id, note, bow)
#
# BOW is a wall's sagitta in mm — how far its middle stands off the straight
# line between its ends. EVERY WALL HERE IS 0. An earlier round curved the
# five walls that face the living room and sprang arches over their openings;
# it read as decoration applied to a plan rather than as the plan, so it is
# gone. The field and the machinery behind it stay: they are generic, they are
# what Om Neeldhara's pod screens are built from, and a curve that is doing
# real work — holding a stair, turning a corner the structure turns — can be
# put back in one number.
#
# What is left is straight, which is what a 96 m2 flat with five columns and
# three fixed shafts wants to be. Openings are (type, from, to) in absolute mm
# along the wall.
NEW_WALLS = [

    # --- the kitchen, the whole width of the north band



    # --- the kitchen: a U with rounded corners
    # The wall IS the polyline above. Timber to 1050, brown tinted glass to
    # 2400, and the serving hatch at the middle of the flat bottom. 900 of
    # solid at each top end, where the tall units and the fridge go.
    (KX0, KTOP, KX1, KTOP, KT,
     # The glass runs up to the hatch and picks up again after it, so moving
     # the counter moves the break in the glazing with it. 900 (2'-11") of
     # solid is left at each top end, where the tall units and the fridge go.
     [('window', _arc_d(0.104), HATCH[0], 1050, 2400),
      ('cased', HATCH[0], HATCH[1], BAR_TOP, 2100),           # the hatch
      ('window', HATCH[1], KDOOR[0], 1050, 2400),
      ('door', KDOOR[0], KDOOR[1], 0, 2100, -1),              # the way in
      ('window', KDOOR[1], _arc_d(0.896), 1050, 2400)],
     'partition', 'W-KIT', 'kitchen | living', 0, KITCHEN_LINE),

    # --- 40 mm of nothing, so the kitchen closes. See ENV_NE above.
    (KX1, KTOP, ENV_NE, KTOP, 0, [], 'threshold', 'T-KIT-NE',
     'the kitchen wall to the external wall corner — solid already', 0),

    # --- the north-west quarter
    (BED_E, KTOP, BED_E, BED_S, 150,
     # -1: the leaf swings into the BEDROOM. A 1180-wide bath has nowhere
     # to put it.
     [('door', 1400, 2150, 0, 2100, -1)], 'partition', 'W-BED-E',
     'bedroom | bath', 0),
    (NW_A[0], NW_A[1], NW_B[0], NW_B[1], 150,
     # Each opens into the room that has floor to spare for it: the bath's
     # into the living room, the bedroom's into the bedroom.
     [('door', NW_BATH_DOOR[0], NW_BATH_DOOR[1], 0, 2100, +1),   # bath | living
      ('door', NW_BED_DOOR[0], NW_BED_DOOR[1], 0, 2100, -1)],    # bedroom | living
     'partition', 'W-NW',
     'bedroom and bath | living — one curve, both doors', NW_BOW),

    # --- the sliding screen that makes the east arm a room
    # It runs on the KITCHEN'S OWN LINE, x 8410, carried south from the point
    # where the kitchen turns west (8410, 2500) to the bath's top wall — so
    # from the living room the kitchen's east side and this screen read as one
    # plane 2900 (9'-6") long, not as two things that nearly line up.
    #
    # 125 thick, because it is a screen and not masonry: three panels of 900
    # (2'-11"), all three sliding, running north to stack against the kitchen
    # wall. Closed, the arm is a room; open, the whole 2700 (8'-10") of it is
    # living room again — there is nothing fixed left in the way.
    (ARM_X, ARM_N, ARM_X, ARM_S, 125,
     [('slider', ARM_N + ARM_REVEAL, ARM_S - ARM_REVEAL, 0, 2400, +1)],
     'partition', 'W-ARM', 'room | living — the sliding screen', 0),

    # --- the south-east bath: one wall, round the column
    (SEB_WX, SEB_S, SEB_EX, SEB_SY, SEB_T,
     [('door', SEB_DOOR[0], SEB_DOOR[1], 0, 2100, +1)], 'partition', 'W-SEB',
     'bath 02 | living — up the notch line, round the top, down into the arm',
     0, SEB_LINE),

    # --- the way in
    (2220, 9625, 2220, 10995, 125, [('cased', 9875, 10725)], 'partition', 'W-FOYER-E',
     'foyer | living', 0),

    # --- the balcony line: an opening, not a wall
    (3725, 10995, 6875, 10995, 0, [], 'threshold', 'T-BALC',
     'living | balcony — the sliding door', 0),
]

# ------------------------------------------------------------------ screens
# (x1, y1, x2, y2, bow, height, id, name, note)
#
# A SCREEN IS NOT A WALL. It stops short of the 3050 ceiling and it takes no
# part in deciding what a room is, so the family bedroom stays ONE room in the
# model — which is the truth of it, and the whole point of the brief.
SCREENS = []

# ------------------------------------------------------- openings in the shell
# (x1, y1, x2, y2, type, id, note) — endpoints on the OUTER face of the
# envelope. The external walls are derived from that outline, so an opening in
# one is authored against it rather than against a wall of ours.
EXTERIOR_OPENINGS = [
    (455, 9700, 455, 10920, 'door', 'D-ENTRY',
     "the front door, 1220 (4'-0\") — where the builder put it, and it does not "
     'move: the lobby beyond is common property.'),
]

# ------------------------------------------------------------- glazing
# Window runs on DA_WINDOW, as drawn.
GLAZING = [
    (80, -150, 3050, -150, 'window'),
    (8445, -150, 11470, -150, 'window'),
    (80, -90, 3050, -90, 'window'),
    (8445, -90, 11470, -90, 'window'),
    (80, -60, 3050, -60, 'window'),
    (8445, -60, 11470, -60, 'window'),
    (80, 0, 3050, 0, 'window'),
    (8445, 0, 11470, 0, 'window'),
    (3485, 470, 4235, 470, 'window'),
    (5035, 470, 6435, 470, 'window'),
    (7235, 470, 7985, 470, 'window'),
    (3485, 530, 4235, 530, 'window'),
    (5035, 530, 6435, 530, 'window'),
    (7235, 530, 7985, 530, 'window'),
    (3485, 560, 4235, 560, 'window'),
    (5035, 560, 6435, 560, 'window'),
    (7235, 560, 7985, 560, 'window'),
    (3485, 620, 4235, 620, 'window'),
    (5035, 620, 6435, 620, 'window'),
    (7235, 620, 7985, 620, 'window'),
    (7235, 7745, 7985, 7745, 'window'),
    (7235, 7805, 7985, 7805, 'window'),
    (7235, 7835, 7985, 7835, 'window'),
    (8525, 8355, 11470, 8355, 'window'),
    (8525, 8415, 11470, 8415, 'window'),
    (8525, 8445, 11470, 8445, 'window'),
    (2295, 10920, 3495, 10920, 'window'),
    (3885, 10920, 6720, 10920, 'window'),
    (2295, 10980, 3495, 10980, 'window'),
    (3885, 10980, 6720, 10980, 'window'),
    (2295, 11010, 3495, 11010, 'window'),
    (3885, 11010, 6720, 11010, 'window'),
    (3885, 11070, 6720, 11070, 'window'),
]

# --------------------------------------------------------------- rooms
# name, subtitle, anchor, note. NO SHAPES: every polygon is derived from the
# walls above, so an anchor is all a room needs. The builder's dimension text
# is gone from these because they are no longer his rooms.
#
# THE BRIEF: two adults and a child. That is one bedroom, not three — so the
# whole east block becomes a single family room with the child's end screened
# off inside it, and the two bedrooms the builder drew in the middle of the
# plan give their space back to the living room and the kitchen.
ROOMS = [
    ('KITCHEN', '', (6345, 1500),
     "a U with 900 (2'-11\") corners: 3685 (12'-1\") clear across the top, "
     "1880 (6'-2\") of straight wall down each side, and the counter and the "
     'door at the two ends of the bottom'),
    ('LIVING / DINING', '', (4400, 7500),
     'everything the kitchen does not enclose, from the front door to the '
     'balcony and out to the blind east wall.'),
    ('BEDROOM', '', (1400, 2200),
     "the flat's north-west arm, closed off: 3050 (10'-0\") wide, windows "
     'north and west'),
    ('BATH', '', (3750, 1500),
     "1180 (3'-10\") wide against the north wall, where the drainage is — "
     'reached from the bedroom and, separately, from the living room'),
    ('BATH', 'COMMON', (8000, 6100),
     "2425 (7'-11\") wide, with column 4 taken inside it as the shower's east "
     'wall — where the builder had his second toilet, on the only other stack '
     'in the flat'),
    ('ROOM', '', (10100, 3200),
     "the east arm: 3025 (9'-11\") wide, windows north and south, the party "
     'wall blind down one side. Shut off from the living room by a sliding '
     'screen on the kitchen’s line'),
    ('FOYER', '', (1375, 10300), 'the way in'),
    ('BALCONY', '', (5300, 11700), 'off the living room'),
]

def _taper(f):
    """Full depth through the middle, smoothstepped away at both ends, so a
    slab dies into the wall instead of stopping against it with a cut end."""
    u = min(f, 1.0 - f) / TAPER
    return 1.0 if u >= 1.0 else u * u * (3.0 - 2.0 * u)


def _slab(sign, depth, n=160):
    """One slab against the kitchen wall. sign +1 is the living-room side,
    -1 the kitchen side; the geometry is otherwise identical."""
    f0, f1 = SPAN
    inner, outer = [], []
    for i in range(n + 1):
        f = i / n
        px, py, nx, ny = _bar_point(f0 + (f1 - f0) * f)
        nx, ny = nx * sign, ny * sign
        inner.append((round(px + nx * FACE, 1), round(py + ny * FACE, 1)))
        d = FACE + depth * _taper(f)
        outer.append((round(px + nx * d, 1), round(py + ny * d, 1)))
    ring, out = inner + outer[::-1], []
    for q in ring:
        if not out or abs(q[0] - out[-1][0]) > 0.5 or abs(q[1] - out[-1][1]) > 0.5:
            out.append(q)
    return out


def _stools(count=4, size=450.0):
    f0, f1 = SEATS
    out = []
    for k in range(count):
        px, py, nx, ny = _bar_point(f0 + (f1 - f0) * (k + 0.5) / count)
        cx, cy = px + nx * SEAT, py + ny * SEAT
        h = size / 2
        out.append((round(cx - h, 1), round(cy - h, 1),
                    round(cx + h, 1), round(cy + h, 1)))
    return out


# THE COUNTER IS OFF. No shelf, no serving ledge, no bar stools — the kitchen
# wall is bare timber-and-glass again while the sleeping and the bathrooms get
# worked out, because a 400 (1'-4") slab either side of it was deciding how the
# living room reads before anything else had a place.
#
# "For now": the machinery above is untouched and the whole thing comes back by
# putting these three lines and the list under them back:
#
#     SHELF = _slab(+1, DEPTH)   # the eating side, in the living room
#     LEDGE = _slab(-1, DEPTH)   # its mirror, the serving side in the kitchen
#     STOOLS = _stools()
#
#     def _bb(poly):
#         xs = [q[0] for q in poly]; ys = [q[1] for q in poly]
#         return min(xs), min(ys), max(xs), max(ys)
#
#     FURNITURE = [
#         ('table', *_bb(SHELF), 'counter shelf — the eating side',
#          'R-LIVING-DINING', 1050, SHELF),
#         ('table', *_bb(LEDGE), 'serving ledge — inside the kitchen',
#          'R-KITCHEN', 1050, LEDGE),
#     ] + [('stool', a, b, c, d, 'bar stool', 'R-LIVING-DINING', 750)
#          for a, b, c, d in STOOLS]

# ----------------------------------------------------- the corner cladding
# EVERY CORNER OF THE LIVING ROOM AND THE BEDROOM IS TURNED IN TIMBER. A piece
# runs 600 (2'-0") along each face and swaps the 90 degrees for an arc tangent
# to both — a cove where the corner is an inside one, a bullnose where it is an
# arris. Paintings hang on the flat between them and the accent lights are set
# to wash the curve, which is the whole reason the corners are rounded: a sharp
# corner throws a hard line and a curved one graduates.
#
# ONE construction covers both cases. From the corner C, walk R along each face
# to P and Q; the arc that is tangent at both is centred on C + R*(a + b), and
# the timber is what lies between the corner and it. Where the room is on the
# open side that point is out in the room and the piece is a cove; where the
# room wraps the corner it is inside the wall and the piece is the arris taken
# off. Nothing else changes.
CLAD_R = 600.0
CLAD_H = 2700.0     # to a shadow gap below the ceiling, not tight to it

# (x, y, along face a, along face b, room). Directions are unit, and point the
# way the face actually runs from the corner.
CLAD_CORNERS = [
    (0, 0, (1, 0), (0, 1), 'R-BEDROOM'),
    (3050, 0, (-1, 0), (0, 1), 'R-BEDROOM'),
    (0, 4120, (0, -1), (1, 0), 'R-BEDROOM'),
    (8445, 0, (0, 1), (1, 0), 'R-LIVING-DINING'),
    (11470, 0, (-1, 0), (0, 1), 'R-LIVING-DINING'),
    (11470, 8355, (0, -1), (-1, 0), 'R-LIVING-DINING'),
]
# THREE CORNERS CAME OUT OF THIS LIST when the bath was drawn round the
# column. The notch's two arrises, (6800, 7745) and (8445, 7745): W-SEB now
# springs off one and the other is inside the bathroom. And (8445, 8355),
# which is now the bathroom's own south-west corner, behind the WC. None of
# the three is a corner of the living room any more, and their cladding was
# sitting on nothing — half of it buried in the new wall.

# THE BATH PENINSULA'S NOSE IS NOT IN THIS LIST. A 600 fillet needs 600 of wall
# behind it to be taken out of; those two corners are the ends of a 150
# partition, and cladding them just buries the curve inside the wall — it was
# tried and it drew as two little squares. Rounding that nose means making the
# wall itself turn, the way the kitchen's does, which is a different change.

# The wing's fourth corner, (2295, 4120), is not in the list: W-NW now springs
# off it, so there is no longer a corner there to turn.


def _clad(cx, cy, a, b, r=None, n=24):
    r = CLAD_R if r is None else r
    px, py = cx + a[0] * r, cy + a[1] * r
    qx, qy = cx + b[0] * r, cy + b[1] * r
    ox, oy = cx + (a[0] + b[0]) * r, cy + (a[1] + b[1]) * r
    a0 = math.atan2(py - oy, px - ox)
    a1 = math.atan2(qy - oy, qx - ox)
    while a1 - a0 > math.pi:
        a1 -= 2 * math.pi
    while a0 - a1 > math.pi:
        a1 += 2 * math.pi
    out = [(cx, cy)]
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        out.append((round(ox + r * math.cos(t), 1), round(oy + r * math.sin(t), 1)))
    return out


# Loose furniture. (kind, x1, y1, x2, y2, label, room, height, poly)
# 'screen' because that is the nearest thing the app already knows how to
# stand up: a panel of a given height with a shape of its own.
FURNITURE = []
for _cx, _cy, _a, _b, _room in CLAD_CORNERS:
    _poly = _clad(_cx, _cy, _a, _b)
    _xs = [q[0] for q in _poly]
    _ys = [q[1] for q in _poly]
    FURNITURE.append(('screen', min(_xs), min(_ys), max(_xs), max(_ys),
                      'corner cladding — curved timber', _room, CLAD_H, _poly))

# ------------------------------------------- what went in the south-east bath
# THE FIXTURES ARE OFF THE DRAWING. They were there to prove the room worked
# rather than to fix where anything goes, and they had done that: the point was
# that 1345 (4'-5") could not face a 900 cubicle at a 450 console, and that
# taking the column in solves it. The wall wraps the column now, the room is
# 2425 (7'-11") wide and the argument is over, so the boxes come off and the
# floor is left clear.
#
# Two numbers worth keeping out of it: the shower closes against the column's
# west face at 8295, and the WC wants the corner nearest the stack. That was
# the south-east one until the door moved into it, so the WC goes to the
# south-west instead — still over the notch, and now behind the door rather
# than in front of it.
COL4_W = 8295.0     # column 4's west face — what the shower closes against
COL4_E = 8525.0     # and its east face, where the way past it starts

# ------------------------------------------------- the counter and its chairs
# The slab is ONE piece and it is drawn as one: the wall is painted over it,
# so in plan it comes out as a serving counter on the kitchen side and an
# eating bar on the living side, which is what it is.
#
# 900 (2'-11") is a worktop inside and a counter-height bar outside, so the
# chairs are counter chairs — 600 (2'-0") to the seat, not 450 (1'-6"). If they
# should be ordinary dining chairs the living-room leg has to step down to 750
# (2'-6"), which makes it two slabs, not one.
FURNITURE += [
    ('table', BAR_X0, _BAR_N, BAR_X1, _BAR_S,
     "serving counter and eating bar — 800 (2'-7\") through the hatch, "
     "400 (1'-4\") in the kitchen and 1400 (4'-7\") out",
     'R-LIVING-DINING', BAR_TOP, BAR_SLAB),
] + [
    ('chair', a, b, c, d,
     "counter chair — 600 (2'-0\") seat to a 900 (2'-11\") top",
     'R-LIVING-DINING', 850)
    for a, b, c, d in BAR_CHAIRS
]

# The three panels shown where they park: stacked against the kitchen wall's
# east face, clear of the opening.
FURNITURE.append(
    ('screen', ARM_PARK[0][0], ARM_PARK[0][1], ARM_PARK[2][0], ARM_PARK[2][1],
     "the sliding screen, parked — three panels of 900 (2'-11\") stacked "
     "against the kitchen wall",
     'R-ROOM', 2400, ARM_PARK))

# --------------------------------------------------------- the bedroom's three
# A WARDROBE, A MURPHY BED AND A DESK — and between them they decide how big
# each other can be, so the numbers are worked out here rather than picked.
#
# THE BED IS A QUEEN, 1500 x 2000 (4'-11" x 6'-7"), and that is the size the
# room chooses rather than a preference. Folded down against the west wall it
# leaves 970 (3'-2") in front of the wardrobe — exactly enough to stand and
# open it. A king at 1830 would take that to 755 (2'-6"), which is a squeeze
# past a bed to reach a wardrobe you use every day. Its projection is the same
# either way; it is the width along the wall that costs.
#
# Its back sits at x 80, not 0: column 2 stands in the west wall from y 770 to
# 1970 and its face is the 80. The cabinet packs out to it rather than fighting
# it. Folded, cabinet and sofa together are about 900 (2'-11") deep and the
# room has 2070 (6'-9") of clear floor — which is the whole point of a Murphy
# bed in an 11.98 m2 (129 sq ft) room.
#
# THE WARDROBE STOPS AT 1900, not at the corner. The bedroom door's leaf is
# 851 long and hinged at (2825, 3283); swung open into the room it sweeps a
# quarter circle that reaches the wardrobe's north-east corner at anything past
# 2000. 1900 clears it by 104 (4") and still gives 1900 x 600 (6'-3" x 2'-0"),
# which is three bays.
#
# THE DESK ENDS AT y 1300 for the same kind of reason: the bath door swings
# west into the bedroom from y 1400, so the desk stops 100 short of it.
WARD = (0.0, 3520.0, 1900.0, 4120.0)          # 1900 x 600
MURPHY = (80.0, 1050.0, 2080.0, 2550.0)       # queen, folded DOWN
MURPHY_FOLDED = 900.0                          # cabinet + sofa, off the wall
DESK = (2450.0, 100.0, 3050.0, 1300.0)        # 600 x 1200 against the east wall
DESK_CHAIR = (1950.0, 475.0, 2400.0, 925.0)

FURNITURE += [
    ('wardrobe', *WARD,
     "wardrobe — 1900 x 600 (6'-3\" x 2'-0\"), stopping 104 (4\") clear of "
     'the bedroom door’s leaf',
     'R-BEDROOM', 2400),
    ('bed', *MURPHY,
     "Murphy bed, DOWN — queen, 1500 x 2000 (4'-11\" x 6'-7\"). Folded it is "
     "a sofa 900 (2'-11\") off the wall and the room has 2070 (6'-9\") clear",
     'R-BEDROOM', 600),
    ('table', *DESK,
     "desk — 1200 x 600 (3'-11\" x 2'-0\") on the east wall, window to the left",
     'R-BEDROOM', 750),
    ('chair', *DESK_CHAIR, 'desk chair', 'R-BEDROOM', 850),
]
