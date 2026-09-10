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

import immovables as IMM


# ------------------------------------------------------ how a number is said
# Metric governs and imperial is the gloss, but a label that carries both has
# to carry them CONSISTENTLY, and a typed conversion goes stale the moment the
# number it describes moves. Anything a label quotes is measured and passed
# through here.
def _ft(mm):
    """mm as feet and inches, rounded to the nearest inch."""
    n = int(round(mm / 25.4))
    return f"{n // 12}'-{n % 12}\""


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


def _col_face(name, i):
    """A named column's face, read off the immovables list rather than typed.
    A door set out to clear a column should not be able to drift from it."""
    return next(c[i] for c in IMM.NAMED if c[0] == name)


# COLUMN 3 STANDS IN THIS WALL. It is 3050-3280 x 770-1670, so it straddles
# x 3125 for 900 (2'-11") of the wall's length, and the door cannot be in it.
# THE DOOR IS AT THE WALL'S SOUTH END, 100 (4") short of where the wall meets
# the curve, because it is a slider now and the panel has to park somewhere:
# south of the old position (1770-2520) the wall had only 500 (1'-8") left
# before the curve, less than a leaf, so the panel was parking NORTH over the
# desk and the painting. From the south end it parks north over the 750
# between it and the desk's stretch, which is blank wall.
BED_BATH_W = 750.0
BED_BATH_DOOR = (BED_S - 100.0 - BED_BATH_W, BED_S - 100.0)

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
SEB_SY = 8430.0     # the arm's south wall — where it ONCE ended
SEB_T = 150.0
SEB_RW, SEB_RE = 900.0, 400.0

# THE ROOM IS CUT BACK OFF COLUMN 4'S NORTH FACE. It came out 5.90 m2 (63 sq
# ft), and 1.5 of that was the pocket east of the column and the tail below it
# — 850 (2'-9") of throat and a corner, floor you walked through to reach the
# fittings and never stood in. The east room, which is the only room that door
# opens off, has better use for it.
#
# So the east run stops at the column instead of carrying on to the flat's
# south wall, and a new wall closes the room across. NEITHER LINE IS CHOSEN:
# the cut is column 4's own north face, and the return south is the flat's
# notch wall carried north — the same move the arm screen makes with the
# kitchen's line. The return also gives the shower a built east wall where it
# had only the column's face.
# The room's id is DERIVED IN THE EXPORTER from its name and subtitle, so
# renaming the subtitle renames the id and every piece of furniture pointing at
# the old one falls on the floor. It is written once here and used by name.
SEB_ROOM = 'R-BATH-EAST-ROOM'

SEB_CUT = _col_face('column 4', 2) + SEB_T / 2      # 6770, on the north face
SEB_RET = 8370.0                                    # the notch wall's own line


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
    pts.append((SEB_EX, SEB_CUT))
    out = []
    for q in pts:
        q = (round(q[0], 1), round(q[1], 1))
        if not out or abs(q[0] - out[-1][0]) > 0.5 or abs(q[1] - out[-1][1]) > 0.5:
            out.append(q)
    return out


SEB_LINE = _seb_line()
SEB_RUN = _run(SEB_LINE)

# THE DOOR IS STILL IN THE EAST RUN, but that run is now 895 (2'-11") long
# instead of 2630, so the door is what fits in it rather than what was wanted:
# 700 (2'-4") with a 98 (4") jamb each side. It opens EAST into the room, which
# is the only room it can open off now.
#
# Openings on a polyline are distances ALONG it, so the runs are measured
# rather than typed: down the west side, round the big corner, across the top,
# round the tight one, and only then south.
_SEB_EAST0 = ((SEB_S - SEB_NY - SEB_RW)
              + math.pi / 2 * SEB_RW
              + (SEB_EX - SEB_RE) - (SEB_WX + SEB_RW)
              + math.pi / 2 * SEB_RE)
SEB_DOOR_W = 700.0
_seb_east_run = SEB_CUT - SEB_T / 2 - (SEB_NY + SEB_RE)         # 895
_seb_jamb = (_seb_east_run - SEB_DOOR_W) / 2
SEB_DOOR = (_SEB_EAST0 + _seb_jamb,
            _SEB_EAST0 + _seb_jamb + SEB_DOOR_W)

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
# 10 (0.4") off the kitchen wall's east face, which is 8525. Hard against it
# the screen's south end stood 3.5 mm inside the wall: the wall mitres where it
# turns west at y 2500 and its face flares east through the corner. Nothing
# anybody would see, and wrong in the model.
ARM_PARK_X = 8535.0
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
# ONE SLAB THROUGH THE WALL. Inside the kitchen it is 600 (2'-0") of serving
# counter, flush with the worktop; outside it runs 1400 (4'-7") into the living
# room as the eating bar, two chairs a side. The wall under it stays solid — a
# sill above zero never cuts a wall in plan, and the base of this one is
# holding the slab up.
# THE SERVING COUNTER IS AS DEEP AS THE WORKTOP. One number, used twice: the
# slab reaches 600 (2'-0") into the kitchen, which is where the worktop's front
# edge comes round the corner to, so the two are one continuous surface and
# neither can drift from the other. It was 400 and stood 200 (8") proud of the
# counter it is supposed to serve.
CTOP_D = 600.0                      # worktop depth, everywhere
BAR_IN, BAR_OUT = CTOP_D, 1400.0    # kitchen side, living side
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
# where the east leg goes straight: the U's total arc less the straight leg
KIT_E_LEG = ARC - (KBOT - KR - KTOP)                # 6897.2
# and where the west leg stops being straight: the corner begins here
KIT_W_LEG = KBOT - KR - KTOP                        # 1955
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
     # (type, from, to, sill, head, side, label, glass). The label and the
     # glass travel to the app: 'tinted' is the brown glass the walkthrough
     # sets in the opening, and a label with 'hatch' in it is drawn there as
     # Home 1's lifting sash over its counter.
     # THE WEST LEG IS THE BATH'S WALL. The small bath sits against it from
     # the north wall down to where the curve begins at y 2500, so tinted
     # glass on the straight leg looked from the worktop straight into the
     # shower. The leg is solid its whole length now, with the wall cabinet
     # on it, and the glass starts where the corner does - that stretch looks
     # into the living room. (Karan's call.)
     [('window', KIT_W_LEG, HATCH[0], 1050, 2400, 0,
       'brown tinted glass over the timber dado, round the corner', 'tinted'),
      ('cased', HATCH[0], HATCH[1], BAR_TOP, 2100, 0,
       'serving hatch — a lifting sash over the counter'),        # the hatch
      ('window', HATCH[1], KDOOR[0], 1050, 2400, 0,
       'brown tinted glass over the timber dado', 'tinted'),
      ('door', KDOOR[0], KDOOR[1], 0, 2100, -1,
       'the kitchen door — swings out into the living room'),     # the way in
      # THE EAST LEG LOOKS INTO THE FAMILY ROOM, so this stretch carries a
      # timber slat blind on the room side that lifts to open (Karan's call).
      # It starts where the leg goes straight, not at the door's jamb: the
      # 564 (1'-10") of curve left between the door and the tangent is solid
      # wall, because glass bent round a 900 radius beside a door read as a
      # sliver of brown nobody asked for.
      ('window', KIT_E_LEG, _arc_d(0.896), 1050, 2400, 0,
       'brown tinted glass over the timber dado — a timber slat blind on the '
       'room side, lifts to open', 'tinted')],
     'partition', 'W-KIT', 'kitchen | living', 0, KITCHEN_LINE),

    # --- 40 mm of nothing, so the kitchen closes. See ENV_NE above.
    (KX1, KTOP, ENV_NE, KTOP, 0, [], 'threshold', 'T-KIT-NE',
     'the kitchen wall to the external wall corner — solid already', 0),

    # --- the north-west quarter
    (BED_E, KTOP, BED_E, BED_S, 150,
     # A SLIDER, NOT A LEAF. Swung into the bedroom the leaf's arc reached
     # x 2300 and the Murphy bed, down, reaches 2460 - the door could not
     # open with the bed out. Into the bath there is a WC in the way. So one
     # timber panel slides on the BEDROOM face and parks south over the wall
     # (the north is the desk's stretch), and neither room gives up anything.
     [('slider', BED_BATH_DOOR[0], BED_BATH_DOOR[1], 0, 2100, -1,
       'the bath door — one timber panel sliding on the bedroom face, '
       'parking south over the wall: a leaf swinging into the room lands on '
       'the Murphy bed when it is down')],
     'partition', 'W-BED-E',
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
     [('slider', ARM_N + ARM_REVEAL, ARM_S - ARM_REVEAL, 0, 2400, +1,
       "sliding screen — three timber panels of 900 (2'-11\"), stacking "
       'north against the kitchen wall')],
     'partition', 'W-ARM', 'room | living — the sliding screen', 0),

    # --- the south-east bath: one wall, round the column
    (SEB_WX, SEB_S, SEB_EX, SEB_CUT, SEB_T,
     [('door', SEB_DOOR[0], SEB_DOOR[1], 0, 2100, +1)], 'partition', 'W-SEB',
     'bath 02 | living and room — up the notch line, round the top, and down '
     'only as far as column 4', 0, SEB_LINE),

    # --- and the wall that closes it across, off the column's north face and
    # back down the notch wall's own line to where that wall starts.
    (SEB_EX, SEB_CUT, SEB_RET, SEB_S, SEB_T, [], 'partition', 'W-SEB-S',
     'bath 02 | room — the cut, and the shower’s east wall', 0,
     [(SEB_EX, SEB_CUT), (SEB_RET, SEB_CUT), (SEB_RET, SEB_S)]),

    # --- the way in
    (2220, 9625, 2220, 10995, 125, [('cased', 9875, 10725)], 'partition', 'W-FOYER-E',
     'foyer | living', 0),

    # --- the balcony line: glass end to end, and the folding door in it
    # Zero thickness, so the plan still draws it as the dashed line it always
    # was and the floor runs out to the glass. The KIND is glazing, not
    # threshold: the app stands a pane on a glazing line. THE DOOR IS A
    # FULL-HEIGHT BI-FOLD (Karan's call, after Home 1's bath divider): three
    # glazed leaves in timber frames, head at the ceiling so nothing sits over
    # it, folding OUT on to the balcony and stacking at the west jamb. Still
    # typed 'slider' so the sheet draws the line it always did; the label is
    # what the walkthrough reads.
    (3725, 10995, 6875, 10995, 0,
     [('slider', 3885, 6720, 0, 3050, 0,
       'the balcony door — three glazed leaves in timber frames, full height, '
       'folding out on to the balcony and stacking at the west jamb')],
     'glazing', 'T-BALC', 'living | balcony — glass end to end, the sliding '
     'door in it', 0, None, 'clear'),
]

# ---------------------------------------------- the balcony's open edges
# (x1, y1, x2, y2, id, parapet, rail, note) — endpoints on the envelope.
#
# THE BALCONY IS NOT WALLED IN. The builder draws its three outer edges on
# DA_RAILING, a 100 mm band and not a wall, and the envelope was derived from
# the carpet line, which runs round the outside of it — so an app that builds
# a wall on every envelope edge stands the balcony inside a full-height box.
# These three edges are open above a parapet: 900 (2'-11") of solid, a glass
# balustrade to 1200 (3'-11"), and the sky from there.
ENVELOPE_OPEN = [
    (3650, 11070, 3650, 12470, 'EO-BALC-W', 900, 1200,
     'balcony, west edge — parapet and glass balustrade, open above'),
    (3650, 12470, 6950, 12470, 'EO-BALC-S', 900, 1200,
     'balcony, south edge — parapet and glass balustrade, open above'),
    (6950, 12470, 6950, 11070, 'EO-BALC-E', 900, 1200,
     'balcony, east edge — parapet and glass balustrade, open above'),
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
     "1180 (3'-10\") wide against the north wall, where the drainage is. "
     'Shower and WC only — the basin is on the curve outside the door, so '
     'this room holds two fittings instead of three. Reached from the bedroom '
     'and, separately, from the living room'),
    ('BATH', 'EAST ROOM', (7900, 5900),
     "cut back off column 4's north face: 2425 (7'-11\") wide and 1220 (4'-0\") "
     'deep across the top, with the shower reaching south beside the column. '
     'Its one door opens east, into the room — it was never common, whatever '
     'the old label said. The builder had his second toilet here, on the only '
     'other stack in the flat'),
    ('ROOM', '', (10100, 3200),
     "the east arm: 3025 (9'-11\") wide, windows north and south, the party "
     'wall blind down one side. Shut off from the living room by a sliding '
     'screen on the kitchen’s line'),
    ('FOYER', '', (1375, 10300), 'the way in'),
    ('BALCONY', '', (5300, 11700), 'off the living room'),
]

# THE BALCONY'S FLOOR IS THE LIVING ROOM'S, carried out through the folding
# door: oak, not stone, so with the leaves stacked the two read as one floor
# (Karan's call). The name here is the room's, the value the id the app gives
# the room it follows.
FLOOR_FOLLOWS = {'BALCONY': 'R-LIVING-DINING'}

# THE BELLY GLASS OVER THE BALCONY (Karan's call, after Home 1's deck): one
# retractable bellied vault the width of the balcony, parapet to parapet.
# Its section runs across the balcony in (plan y, height): it springs from
# the south parapet line at the floor, bellies about 400 (1'-4") out past the
# parapet, peaks near 3300 (10'-10") over the balcony's middle and lands on
# the living room's face at the ceiling. The two ends are glazed gables, so
# the balcony is enclosed; the Roof switch telescopes it open to the sky.
# (id, name, kind, extent, section, gable ends, retractable, glazing, note)
GLASS_ROOFS = [
    ('ROOF-BALC', 'A retractable bellied glass vault over the balcony', 'barrel',
     (3650, 11070, 6950, 12470),
     {'p0': (12470, 0), 'p1': (13400, 1900), 'p1b': (12500, 4100), 'p2': (11070, 3050)},
     ('x0', 'x1'), True, 'Laminated glass',
     "Springs from the balcony's south parapet, bellies out over the street, "
     'peaks above the ceiling and lands on the living room face; glazed '
     'gables close the two sides'),
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
# THE LIST IS EMPTY. Six corners were clad and it was too much — a 600 cove in
# every corner of two rooms stops being a detail and becomes the wall
# treatment, and it read as decoration applied to the plan rather than as the
# plan, which is the same thing that killed the arches.
#
# Nothing is deleted. _clad() below still does both cases from one
# construction, and the corners come back by putting any of these lines in.
# One or two, in the places worth making something of, is a different
# proposition from all of them:
#
#     (0, 0, (1, 0), (0, 1), 'R-BEDROOM'),
#     (3050, 0, (-1, 0), (0, 1), 'R-BEDROOM'),
#     (0, 4120, (0, -1), (1, 0), 'R-BEDROOM'),
#     (8445, 0, (0, 1), (1, 0), 'R-LIVING-DINING'),
#     (11470, 0, (-1, 0), (0, 1), 'R-LIVING-DINING'),
#     (11470, 8355, (0, -1), (-1, 0), 'R-LIVING-DINING'),
CLAD_CORNERS = []
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


# ------------------------------------------------------------- shapes
# Generic outlines, for any piece that deserves one instead of a
# rectangle. They live here because everything below uses them.
def _round_rect(x0, y0, x1, y1, r, n=10):
    """A rectangle with a radius at each corner — top-left first, clockwise.
    A radius of 0 leaves that corner square, so a piece against a wall can be
    turned on the two edges you actually see and left sharp on the two you
    do not."""
    tl, tr, br, bl = r if isinstance(r, (tuple, list)) else (r, r, r, r)
    out = []

    def corner(cx, cy, rad, a0):
        if rad <= 0:
            out.append((cx, cy))
            return
        for i in range(n + 1):
            a = a0 + (math.pi / 2) * i / n
            out.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))

    corner(x0 + tl, y0 + tl, tl, math.pi)
    corner(x1 - tr, y0 + tr, tr, -math.pi / 2)
    corner(x1 - br, y1 - br, br, 0.0)
    corner(x0 + bl, y1 - bl, bl, math.pi / 2)
    return [(round(a, 1), round(b, 1)) for a, b in out]


def _ellipse(cx, cy, rx, ry, n=32):
    return [(round(cx + rx * math.cos(2 * math.pi * i / n), 1),
             round(cy + ry * math.sin(2 * math.pi * i / n), 1))
            for i in range(n)]


# Loose furniture. (kind, x1, y1, x2, y2, label, room, height, poly, ghost, face)
# `face` is the way a piece faces — a sofa's front, a sleeper's view down the
# bed — for the app; left out, the app reads 'facing east' off the label, and
# turns a chair toward the nearest table.
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
# THE DESK STANDS 100 (4") OFF THE NORTH WALL, which is glass from sill height
# up: flush, its top ran into the window's reveal. 1050 (3'-5") long on the
# east wall, a pedestal of drawers and a cupboard at its north end, and the
# bath's sliding panel parks on the wall south of it without touching it.
WARD = (0.0, 3520.0, 1900.0, 4120.0)          # 1900 x 600
# THE MURPHY IS TWO PIECES, as the grandmother's in Home 1 is: a cabinet on
# the wall that the mattress folds up into, and a sofa in front of it that the
# bed comes down OVER. The walkthrough draws exactly these two and folds the
# bed down from the cabinet's face, so what it shows is what the plan says.
MURPHY_CAB = 380.0                             # the cabinet, off the wall
MURPHY_SOFA = 520.0                            # the sofa in front of it
MURPHY_FOLDED = MURPHY_CAB + MURPHY_SOFA        # 900: cabinet + sofa, off the wall
MURPHY_L = 2000.0                              # the mattress: queen, 1500 x 2000
# Down, the mattress reaches MURPHY_L past the cabinet's face — 80 + 380 +
# 2000 = 2460, which leaves 590 (1'-11") to the east wall and clears the desk
# chair, whose seat ends at y 925.
MURPHY = (80.0, 1050.0, 80.0 + MURPHY_CAB + MURPHY_L, 2550.0)   # folded DOWN
DESK = (2450.0, 100.0, 3050.0, 1150.0)        # 600 x 1050, 100 off the window
DESK_CHAIR = (1950.0, 475.0, 2400.0, 925.0)

FURNITURE += [
    ('wardrobe', *WARD,
     "wardrobe — 1900 x 600 (6'-3\" x 2'-0\"), stopping 104 (4\") clear of "
     'the bedroom door’s leaf',
     'R-BEDROOM', 2400),
    # THE SOFA IS WHAT IS THERE; the bed is what the room can become. So the
    # sofa is drawn solid and the bed's footprint dashed around it — the plan
    # shows the everyday state and says what happens to it, rather than showing
    # a bed that is up against the wall for twenty-three hours a day.
    ('wardrobe', MURPHY[0], MURPHY[1], MURPHY[0] + MURPHY_CAB, MURPHY[3],
     f"wall bed cabinet — queen 1500 x {MURPHY_L:.0f} folds down over the "
     f"sofa; {MURPHY_CAB:.0f} ({_ft(MURPHY_CAB)}) deep on the west wall",
     'R-BEDROOM', 2200),
    ('sofa', MURPHY[0] + MURPHY_CAB, MURPHY[1], MURPHY[0] + MURPHY_FOLDED,
     MURPHY[3],
     f"sofa in front of the wall bed — 1500 x {MURPHY_SOFA:.0f} (4'-11\" x "
     f"{_ft(MURPHY_SOFA)}), facing east; the bed folds down over it inside "
     'the dashed line',
     'R-BEDROOM', 800, _round_rect(MURPHY[0] + MURPHY_CAB, MURPHY[1],
                                   MURPHY[0] + MURPHY_FOLDED, MURPHY[3],
                                   (40, 200, 200, 40)), False, 'E'),
    ('bed', *MURPHY,
     f"Murphy bed DOWN — queen, 1500 x {MURPHY_L:.0f} (4'-11\" x 6'-7\") past "
     'the cabinet: the footprint it takes, not a bed standing there',
     'R-BEDROOM', 600, None, True),
    ('table', *DESK,
     "desk — 1050 x 600 (3'-5\" x 2'-0\") on the east wall, window to the left; "
     'a pedestal of two drawers over a cupboard at the north end, a pencil '
     'drawer under the top',
     'R-BEDROOM', 750),
    ('chair', *DESK_CHAIR, 'desk chair', 'R-BEDROOM', 850),
]

# ------------------------------------------------- the kitchen's working run
# ONE RUN, NOT AN L. It starts at the serving counter's west edge — which is
# also the tangent point where the south wall stops and the corner begins —
# turns the 785 (2'-7") inner radius, goes up the west leg and along the north
# wall to the fridge. 6048 (19'-10") of 600 (2'-0") worktop in one unbroken
# piece, and it does extend from the serving counter: they meet at x 5395 with
# nothing between them.
#
# Drawing it as an L would have needed two pieces and a joint in the corner.
# The U already has the corner turned, so the counter turns with it: at 600
# deep against a 785 radius the front edge comes round on 185 (7"), which is a
# corner cabinet with a curved face rather than the dead square that a 90
# degree corner leaves.
CTOP_D = 600.0


def _counter(fx, n=24):
    """The worktop, from the serving counter round to the fridge."""
    cx, cy = KX0 + KR, KBOT - KR        # the south-west corner's centre
    ro = KR - KT / 2                    # 785, the face it sits against
    ri = ro - CTOP_D                    # 185, its own front edge
    wx, ny = KX0 + KT / 2, KTOP + 75    # the west and north inner faces
    out = []
    for i in range(n + 1):              # along the wall: south, round, west
        t = (math.pi / 2) * i / n
        out.append((cx - ro * math.sin(t), cy + ro * math.cos(t)))
    out += [(wx, ny), (fx, ny),
            (fx, ny + CTOP_D), (wx + CTOP_D, ny + CTOP_D), (wx + CTOP_D, cy)]
    for i in range(1, n + 1):           # and back along the front
        t = (math.pi / 2) * (n - i) / n
        out.append((cx - ri * math.sin(t), cy + ri * math.cos(t)))
    return [(round(a, 1), round(b, 1)) for a, b in out]


# THE FRIDGE IS IN THE NORTH-EAST CORNER, its back on the north wall and its
# door facing south — straight down the east leg at the kitchen door, so it
# opens toward whoever has just walked in rather than onto the worktop.
# (Karan's call: the corner was 750 (2'-6") of worktop nobody could reach
# round, and the fridge below it on the east leg had its door on the run.)
#
# WHAT IT COSTS is the corner window. The north wall's windows are 5035-6435
# and 7235-7985, and a 900 fridge ending on the east face at 8295 starts at
# 7395 — so it stands in front of 590 (1'-11") of the 750 (2'-6") window, at
# 1900 tall. The worktop now stops at the fridge's west side, 7395, and the
# corner is the fridge, not a counter.
FRIDGE_W, FRIDGE_D = 900.0, 750.0
FRIDGE_Y = KTOP + 75                    # 620 — hard on the north wall
FRIDGE = (KX1 - KT / 2 - FRIDGE_W, FRIDGE_Y,
          KX1 - KT / 2, FRIDGE_Y + FRIDGE_D)

# The run stops at the fridge when the fridge is in the corner; dropped south
# it would clear the north wall and the worktop would go the whole way.
COUNTER = _counter(FRIDGE[0] if FRIDGE_Y < KTOP + 75 + CTOP_D else KX1 - KT / 2)
_CTOP_FX = FRIDGE[0] if FRIDGE_Y < KTOP + 75 + CTOP_D else KX1 - KT / 2


def _ctop_run():
    """How long the worktop is, measured rather than typed: the quarter round
    the south-west corner, up the west leg, along the north wall to the end."""
    return (math.pi / 2 * (KR - KT / 2)
            + (KBOT - KR) - (KTOP + 75)
            + _CTOP_FX - (KX0 + KT / 2))
_cx = [q[0] for q in COUNTER]
_cy = [q[1] for q in COUNTER]

FURNITURE += [
    ('table', min(_cx), min(_cy), max(_cx), max(_cy),
     f"worktop — 600 (2'-0\") deep, {_ctop_run():.0f} ({_ft(_ctop_run())}) in "
     'one run from the serving counter round the corner to the fridge',
     'R-KITCHEN', 900, COUNTER),
    ('shelves', *FRIDGE,
     "fridge — 900 x 750 (2'-11\" x 2'-6\") in the north-east corner, back to "
     'the north wall, door facing the kitchen door',
     'R-KITCHEN', 1900, None, False, 'S'),
]

# ------------------------------------------------- the sink and the hob
# THE SINK IS ON THE WEST RUN, just north of where the corner's curve ends at
# y 2500, its long side along the run and the tap at the back against the
# west wall. It was under the hatch on the serving slab; Karan moved it here
# so the slab stays a clear pass-through and the tap is out of the sash's
# way. THE HOB IS ON THE NORTH RUN under the big window, centred on it.
SINK_W, SINK_D = 420.0, 520.0                                          # across, along
SINK_C = (KX0 + KT / 2 + CTOP_D / 2, KBOT - KR - 400.0)                # (4910, 2100)
SINK = (SINK_C[0] - SINK_W / 2, SINK_C[1] - SINK_D / 2,
        SINK_C[0] + SINK_W / 2, SINK_C[1] + SINK_D / 2)
HOB_W, HOB_D = 580.0, 500.0
HOB_C = ((5035.0 + 6435.0) / 2, KTOP + 75 + CTOP_D / 2)               # (5735, 920)
HOB = (HOB_C[0] - HOB_W / 2, HOB_C[1] - HOB_D / 2,
       HOB_C[0] + HOB_W / 2, HOB_C[1] + HOB_D / 2)
FURNITURE += [
    ('console', *SINK,
     f"sink — {SINK_W:.0f} x {SINK_D:.0f} ({_ft(SINK_W)} x {_ft(SINK_D)}) on the "
     'west run just past the corner, tap at the back',
     'R-KITCHEN', 900, _round_rect(*SINK, 40)),
    ('console', *HOB,
     f"hob — {HOB_W:.0f} x {HOB_D:.0f} ({_ft(HOB_W)} x {_ft(HOB_D)}), four "
     'burners, on the north run centred under the window',
     'R-KITCHEN', 900),
]

# --------------------------------------------------- what goes in the north bath
# THE TRAY'S LEG IS THE COLUMN'S. It runs down the west wall to where column 3
# ends, at y 1670, so the shower finishes on a line the structure already
# draws instead of stopping 150 short of it for no reason. That makes the legs
# 1050 (3'-5") rather than 900, the tray 0.551 m2 (5.9 sq ft) instead of 0.405,
# and 742 (2'-5") from the corner to the hypotenuse instead of 636 — a better
# shower for nothing, and read off immovables so it cannot drift.
#
# THE WC IS BACK, AND IT SWAPS WITH THE BASIN. It was asked for in the pocket
# between the tray's hypotenuse and the console, and that pocket cannot hold
# one: with the back on the east wall, its depth and its width trade off along
# the hypotenuse — 3800 west face gives 580 deep and 700 wide, 3780 gives 600
# deep and 680 wide. A WC needs 600 and 700 at once, and no line on that
# diagonal gives both.
#
# South of the tray the room is its full 1180 (3'-10") and the WC fits, so the
# two fittings change places: WC on the east wall below the tray, basin on the
# east wall beside it in the wedge. Both stay on one wall, which is one run of
# soil and one run of waste.
#
# WHAT IT COSTS is the clearance in front of the pan: 580 (1'-11") to the west
# wall, against the 600 you would want. That is not a placing error, it is the
# room — 1180 wide less 600 of WC leaves 580, wherever it stands. What is in
# front of it is the doorway, so with the door open the space reads as more
# than it measures.
#
# THE BASIN IS A CONSOLE NOW, not a box: a 450 x 500 top with its two exposed
# corners turned on 160 (6") and the wall corners on 40, and the bowl drawn as
# the oval it is.
# AND THE TRAY STARTS AT THE COLUMN, NOT THE WALL. Column 3 stands 80 (3")
# proud of the bath's west face for 900 (2'-11") of its height, so a tray set
# out from the wall had the column inside it — 0.069 m2 (0.7 sq ft) of it,
# which is a notch cut in a moulded tray or a leak. Both legs now run off the
# column's own faces: east face for the corner, south face for the length.
BATH_TRI = _col_face('column 3', 4) - (KTOP + 75)      # 1050
BATH_X = _col_face('column 3', 3)                      # 3280, the east face
BATH_SHOWER = [(BATH_X, 620.0), (BATH_X + BATH_TRI, 620.0),
               (BATH_X, 620.0 + BATH_TRI)]
BATH_E = 4380.0                                        # the east wall's face
BATH_WC_D, BATH_WC_W = 600.0, 700.0
# The WC's north edge IS the tray's south vertex, so it starts exactly where
# the shower stops and the room goes full width.
BATH_WC = (BATH_E - BATH_WC_D, 620.0 + BATH_TRI,
           BATH_E, 620.0 + BATH_TRI + BATH_WC_W)
BATH_WC_CIST = _round_rect(BATH_E - 200.0, BATH_WC[1], BATH_E, BATH_WC[3], 20)
BATH_WC_PAN = _round_rect(BATH_WC[0], (BATH_WC[1] + BATH_WC[3]) / 2 - 200.0,
                          BATH_E - 200.0, (BATH_WC[1] + BATH_WC[3]) / 2 + 200.0,
                          (190, 40, 40, 190))

# AND THE BASIN COMES OUT ALTOGETHER. Tray, WC and basin in 1180 (3'-10") was
# congested however it was arranged — the wedge north of the WC is 450 (1'-6")
# deep at its widest and you stood in it with the shower screen 380 (1'-3")
# away. It goes onto the curve outside the door instead, which is where a wash
# basin belongs in a flat this size: off the living room, reachable without
# opening the bathroom.
#
# WHAT IT COSTS is that the bedroom's occupant has no basin behind a closed
# door. That is the trade, and it is the ordinary one.

#     BATH_SHELF = (4100.0, 620.0, 4380.0, 900.0)      # 280 corner shelf


_tx = [q[0] for q in BATH_SHOWER]
_ty = [q[1] for q in BATH_SHOWER]

FURNITURE += [
    ('screen', min(_tx), min(_ty), max(_tx), max(_ty),
     f"shower — triangular corner tray, {BATH_TRI:.0f} ({_ft(BATH_TRI)}) legs, "
     "off column 3's east face and down to where it ends, under the window; "
     'no screen, the head on the west wall',
     'R-BATH', 2100, BATH_SHOWER),
    ('console', BATH_E - 200.0, BATH_WC[1], BATH_E, BATH_WC[3],
     f"WC cistern — {BATH_WC_W:.0f} ({_ft(BATH_WC_W)}) wide against the east "
     'wall, below the shower',
     'R-BATH', 900, BATH_WC_CIST),
    ('console', BATH_WC[0], (BATH_WC[1] + BATH_WC[3]) / 2 - 200.0,
     BATH_E - 200.0, (BATH_WC[1] + BATH_WC[3]) / 2 + 200.0,
     f"WC — 400 x {BATH_WC_D:.0f} (1'-4\" x {_ft(BATH_WC_D)}) projection, "
     f"facing west with {_ft(BATH_WC[0] - 3200.0)} clear in front — which is "
     'the room, not the placing: 1180 wide less 600 of WC',
     'R-BATH', 400, BATH_WC_PAN),
]


# ------------------------------------------------------- what goes in the arm
# THE BED IS TURNED 90 DEGREES FROM THE SKETCH, and it is what buys the king.
#
# Drawn with its length running north-south, the bed's WIDTH has to fit across
# the room's 2945 (9'-8"). A king is 1830 of that, leaving 1115 to split
# between the two sides — 557 each, or everything on one side and none on the
# other. A queen leaves 722 each, still under the 750 (2'-6") you want beside a
# bed you get out of in the dark.
#
# Turned, the LENGTH crosses the room instead: 2000 from the east wall leaves
# 945 (3'-1") at the foot, and the two long sides now face north and south with
# 800 (2'-7") and 2770 (9'-1") in front of them. Both sides work, and it takes
# the king.
#
# The head goes on the EAST wall because that wall is the blind party wall —
# 8355 (27'-5") of it with nothing to lose. Both windows stay clear, which is
# the whole argument for this room: it is lit from its two ends only.
BED_W, BED_L = 1830.0, 2000.0       # king
ARM_BED = (11470.0 - BED_L, 800.0, 11470.0, 800.0 + BED_W)

# THE DAYBED IS THE SOUTH END, flush to the window, and it is what everything
# else in the tail is now set out from. A single mattress is 900 (2'-11") wide,
# so that is the depth; the seat is built to it rather than the other way
# round. Its top is 7455 and the wardrobes stop there.
ARM_DAY_D = 900.0
ARM_DAY_N = 8355.0 - ARM_DAY_D                      # 7455, the seat's back

# ITS WEST END IS THE BATH'S EAST WALL LINE carried south. Run the full width
# of the tail, as marked, the daybed would have left the dressing console 310
# (1'-0") in front of it — the pocket between the bath's south wall and the
# window is 1510 (4'-11") deep, and a 400 console plus a 900 seat plus a
# person is 1900. Started on the wall line instead, the console gets 1110
# (3'-8") to sit at and the daybed is still 2020 (6'-8"), which is longer than
# a single bed.
ARM_DAY = (SEB_EX, ARM_DAY_N, 11470.0, 8355.0)
ARM_DAY_TOP = _round_rect(*ARM_DAY, (60, 60, 140, 140))
ARM_DAY_MAT = _round_rect(ARM_DAY[0] + 70, ARM_DAY[1] + 70,
                          ARM_DAY[2] - 70, ARM_DAY[3] - 130, 90)

# THE DRESSING CONSOLE goes on the bath's south wall, where it is marked, with
# a bowed front. 800 x 400 (2'-7" x 1'-4") and 1110 (3'-8") of floor in front
# of it — enough for a stool and to get past it to the daybed.
# Its west end is COLUMN 4'S EAST FACE. Started 25 (1") west of it the console
# stood 0.006 m2 inside the column — nothing you would see and a lie in the
# model, which is what the clash check is for.
_dress_w = _col_face('column 4', 3)                 # 8525
ARM_DRESS = (_dress_w, SEB_CUT + SEB_T / 2,
             _dress_w + 800.0, SEB_CUT + SEB_T / 2 + 400.0)
ARM_DRESS_TOP = _round_rect(*ARM_DRESS, (30, 30, 200, 200))

# THE WARDROBES ARE CUT SHORT AT THE DAYBED. 600 deep and 2055 (6'-9") long
# now, not 2855 — the last 800 (2'-7") of them was where the seat goes, and a
# wardrobe door over a daybed opens onto the cushions.
ARM_WARD = (11470.0 - 600.0, 5400.0, 11470.0, ARM_DAY_N)

# A CONSOLE ON THE EAST WALL SOUTH OF THE BED (Karan's call): 1200 x 400 with
# doors and a drawer, 200 (8") off the bed's foot-side edge at 2630 and well
# short of the wardrobes at 5400. The bedside pendant hangs over its north end.
CONSOLE_ROOM = (11470.0 - 400.0, 2830.0, 11470.0, 4030.0)

# THE TIMBER FRAME OVER THE DAYBED (Karan's call). A teak frame the width of
# the tail, wall to wall: a fin at the daybed's west end on the bath wall's
# line, a matching panel on the east wall, and a slim band along the ceiling
# between them, with a flower pendant hung from the band over the middle of
# the seat - the bed sits inside the frame. (It was an arch with 500 coves and
# a shelf column; both went, the coves as too much wood over the lamp.) The
# two legs stand ON the seat, from 520 (above the mattress) up, 350 (1'-2")
# deep off the window wall; they are on the plan because they are there at
# eye level, and the band is the walkthrough's.
ARCH_D = 350.0
ARCH_FIN = (ARM_DAY[0], 8355.0 - ARCH_D, ARM_DAY[0] + 40.0, 8355.0)
ARCH_PANEL_E = (11470.0 - 40.0, 8355.0 - ARCH_D, 11470.0, 8355.0)

FURNITURE += [
    ('bed', *ARM_BED,
     "king — 1830 x 2000 (6'-0\" x 6'-7\"), head on the blind party wall, "
     "945 (3'-1\") at the foot and both sides open; a hydraulic lift-up base "
     'over storage, hinged at the head',
     'R-ROOM', 600, None, False, 'W'),      # the sleeper looks west, to the foot
    ('console', *CONSOLE_ROOM,
     f"console cabinet — {CONSOLE_ROOM[3] - CONSOLE_ROOM[1]:.0f} x 400 "
     f"({_ft(CONSOLE_ROOM[3] - CONSOLE_ROOM[1])} x 1'-4\") on the east wall "
     'south of the bed: two doors, a drawer across the top, things on it',
     'R-ROOM', 800),
    ('wardrobe', *ARM_WARD,
     f"wardrobes — 600 x {ARM_WARD[3] - ARM_WARD[1]:.0f} (2'-0\" x "
     f"{_ft(ARM_WARD[3] - ARM_WARD[1])}) down the party wall, stopping where "
     'the daybed starts',
     'R-ROOM', 2400),
    ('daybed', *ARM_DAY,
     f"daybed — {ARM_DAY[2] - ARM_DAY[0]:.0f} x {ARM_DAY_D:.0f} "
     f"({_ft(ARM_DAY[2] - ARM_DAY[0])} x {_ft(ARM_DAY_D)}), built in flush to "
     'the south window; a lift-up seat on gas struts over the toy store, '
     'hinged along the window side',
     'R-ROOM', 450, ARM_DAY_TOP),
    ('daybed', ARM_DAY[0] + 70, ARM_DAY[1] + 70, ARM_DAY[2] - 70,
     ARM_DAY[3] - 130,
     "the mattress — 900 (2'-11\") wide, which is what set the depth; it "
     'lifts with the seat',
     'R-ROOM', 500, ARM_DAY_MAT),
    ('screen', *ARCH_FIN,
     "arch fin — the timber arch's west leg: 40 thick, 350 (1'-2\") deep, "
     'from the daybed seat to the ceiling',
     'R-ROOM', 3050),
    ('screen', *ARCH_PANEL_E,
     "arch panel — the timber frame's east leg: 40 thick, 350 (1'-2\") deep, "
     'on the east wall from the daybed seat to the ceiling',
     'R-ROOM', 3050),
    ('console', *ARM_DRESS,
     f"dressing console — {ARM_DRESS[2] - ARM_DRESS[0]:.0f} x 400 "
     f"({_ft(ARM_DRESS[2] - ARM_DRESS[0])} x 1'-4\") with a bowed front, on "
     f"the bath's south wall. The daybed starts east of it, so what is in "
     f"front is the floor to the window: {_ft(8355.0 - ARM_DRESS[3])}",
     'R-ROOM', 780, ARM_DRESS_TOP),
]


# ------------------------------------------ what goes in BATH 02 (east room)
# THE ROOM IS AN L NOW: a strip 2425 x 1220 (7'-11" x 4'-0") across the top,
# and a leg 1345 x 1050 (4'-5" x 3'-5") reaching south beside column 4. Four
# things have to go in it and the L decides which goes where.
#
# THE SHOWER TAKES THE NORTH-WEST, and it is a QUADRANT because the corner it
# sits in is not a corner — the wall turns through a 900 (2'-11") curve there,
# and a rectangular tray in a round corner leaves two slivers nobody can clean.
#
# ITS RADIUS IS SET BY THE ROUTE, not by the shower. Struck at 1220 — the depth
# of the strip, which is the figure that wants to be used — the screen came
# within 432 (1'-5") of the console's corner, and the walk from the basin to
# the WC went through that. Backed off to 1050 it leaves 602 (2'-0"), which is
# the passage. The tray is still a 1050 quadrant, which is a shower.
#
# THE BASIN GOES ON THE NORTH WALL, east of the shower, where the mirror is
# flat and the wall is straight for 1275 (4'-2").
#
# THE WC GOES DOWN THE LEG, on the south wall under the window. It faces north
# up the leg and out into the strip, which is why it has room: 1531 (5'-0") in
# front of it, where against any wall in the strip it would have had 620.
#
# THE CONSOLE IS SHALLOW, 200 (8"), against the cut wall, and the basin is
# 400 (1'-4") rather than the 450 a vanity would like. Between them is the way
# from the door to the WC and it comes to 620 (2'-0") — the minimum passage,
# and every millimetre of it was taken off one of those two.
SEB_SH_R = 1050.0                                   # what the route leaves
SEB_SH_C = (SEB_X0, SEB_Y0)                         # the corner it is struck from
SEB_ARC_C = (SEB_WX + SEB_RW, SEB_NY + SEB_RW)      # (7775, 6300), the wall's


def _seb_tray(n=28):
    """The shower floor: down the west wall, round the room's own 900 curve,
    along the north wall, and back on the tray's own arc. Two curves bending
    opposite ways, which is what the corner actually is."""
    cx, cy = SEB_ARC_C                              # the wall's curve
    ro = SEB_RW - SEB_T / 2                         # 825
    out = [(SEB_X0, SEB_SH_C[1] + SEB_SH_R)]
    out.append((SEB_X0, cy))                        # up to where the wall turns
    for i in range(n + 1):                          # round the wall
        a = (math.pi / 2) * i / n
        out.append((cx - ro * math.cos(a), cy - ro * math.sin(a)))
    out.append((SEB_SH_C[0] + SEB_SH_R, SEB_Y0))    # east along the north wall
    for i in range(n + 1):                          # and back on the tray's arc
        a = (math.pi / 2) * i / n
        out.append((SEB_SH_C[0] + SEB_SH_R * math.cos(a),
                    SEB_SH_C[1] + SEB_SH_R * math.sin(a)))
    return [(round(q[0], 1), round(q[1], 1)) for q in out]


SEB_TRAY = _seb_tray()

SEB_VAN = (8250.0, SEB_Y0, 9050.0, SEB_Y0 + 400.0)          # 800 x 400
SEB_VAN_TOP = _round_rect(*SEB_VAN, (40, 40, 200, 200))
SEB_BOWL = _ellipse((SEB_VAN[0] + SEB_VAN[2]) / 2, (SEB_VAN[1] + SEB_VAN[3]) / 2,
                    220, 150)

SEB_CON_D = 200.0
SEB_CON = (8250.0, SEB_CUT - SEB_T / 2 - SEB_CON_D, 9150.0, SEB_CUT - SEB_T / 2)
SEB_CON_TOP = _round_rect(*SEB_CON, (90, 90, 30, 30))

# The WC is centred on the leg, which is also centred on the window it sits
# under — the window is 7235-7985 and the leg is 6950-8295.
SEB_WC_W, SEB_WC_D = 700.0, 600.0
_wc_c = (SEB_X0 + _col_face('column 4', 1)) / 2             # 7622, the leg's middle
SEB_WC = (_wc_c - SEB_WC_W / 2, SEB_Y1 - SEB_WC_D,
          _wc_c + SEB_WC_W / 2, SEB_Y1)
SEB_WC_CIST = _round_rect(SEB_WC[0], SEB_WC[3] - 200.0, SEB_WC[2], SEB_WC[3], 20)
SEB_WC_PAN = _round_rect(_wc_c - 200.0, SEB_WC[1], _wc_c + 200.0,
                         SEB_WC[3] - 200.0, (190, 190, 40, 40))

_sx = [q[0] for q in SEB_TRAY]
_sy = [q[1] for q in SEB_TRAY]

FURNITURE += [
    ('screen', min(_sx), min(_sy), max(_sx), max(_sy),
     f"shower — a quadrant of {SEB_SH_R:.0f} ({_ft(SEB_SH_R)}), which is the "
     'depth of the room: it runs from the north wall to the cut wall and '
     'touches both. Curved screen, because the corner it sits in is a curve',
     SEB_ROOM, 2100, SEB_TRAY),
    ('console', *SEB_VAN,
     f"basin console — {SEB_VAN[2] - SEB_VAN[0]:.0f} x "
     f"{SEB_VAN[3] - SEB_VAN[1]:.0f} ({_ft(SEB_VAN[2] - SEB_VAN[0])} x "
     f"{_ft(SEB_VAN[3] - SEB_VAN[1])}) on the north wall, mirror flat above it",
     SEB_ROOM, 900, SEB_VAN_TOP),
    ('console', SEB_VAN[0] + 180., SEB_VAN[1] + 75.,
     SEB_VAN[2] - 180., SEB_VAN[3] - 75.,
     "basin — 440 x 300 (1'-5\" x 1'-0\") oval",
     SEB_ROOM, 880, SEB_BOWL),
    ('console', *SEB_CON,
     f"console — {SEB_CON[2] - SEB_CON[0]:.0f} x {SEB_CON_D:.0f} "
     f"({_ft(SEB_CON[2] - SEB_CON[0])} x {_ft(SEB_CON_D)}) against the cut "
     'wall. Shallow on purpose: every millimetre of it comes off the way past',
     SEB_ROOM, 850, SEB_CON_TOP),
    ('console', SEB_WC[0], SEB_WC[3] - 200., SEB_WC[2], SEB_WC[3],
     f"WC cistern — {SEB_WC_W:.0f} ({_ft(SEB_WC_W)}) against the south wall, "
     'under the window',
     SEB_ROOM, 900, SEB_WC_CIST),
    ('console', _wc_c - 200., SEB_WC[1], _wc_c + 200., SEB_WC[3] - 200.,
     f"WC — 400 x {SEB_WC_D:.0f} (1'-4\" x {_ft(SEB_WC_D)}) projection, facing "
     'north up the leg',
     SEB_ROOM, 400, SEB_WC_PAN),
]

# ------------------------------------------ the two swivels, at the balcony
# THE POINT OF THESE CHAIRS IS THAT THEY TURN. Set facing the balcony they are
# a view; turned round they are the living room's second seating group, which
# is what a 37.8 m2 (407 sq ft) room with one dining bar at the far end needs.
# So they are drawn as circles, and each carries a DASHED SWEEP — the 1200
# (3'-11") a seated person takes to come round — because a swivel chair that
# cannot complete the turn is just a chair.
#
# THE PAIR COMES SOUTH UNTIL THE SWEEPS TOUCH THE BALCONY LINE, which is as
# far as they can go: turn in them there and your feet reach the threshold and
# no further. That puts the seats 150 (6") off the opening, which is where a
# chair bought for a view belongs.
#
# THE WAY OUT IS BETWEEN THEM, not round them. The pair spans 2750 (9'-0")
# across its sweeps in an opening 3150 (10'-4") wide, so there was never a
# route past either end — 50 (2") at the west and 350 (1'-2") at the east.
# What there is, and always was, is the 650 (2'-2") between the two chairs:
# you walk down through it and step out. Held back far enough to walk in FRONT
# of them instead, they sat 795 (2'-7") off the glass, which is a chair in a
# room rather than a chair at a window.
#
# Across the room the pair is set out from the EAST WALL and not from the
# balcony's centre: put on the centre the eastern sweep came within 125 (5") of
# the wall. From the wall it clears by 350 (1'-2"), and 1550 (5'-1") between
# centres leaves the same 350 between the two sweeps — they turn without
# meeting anything. The pair ends up 225 (9") west of the balcony's middle,
# which nobody will find with a tape.
#
# THE OTTOMAN IS NORTH OF THEM, not in front of the view. Facing into the room
# it is a footstool 300 (1'-0") off the seats; facing the balcony it is behind
# you and out of the way. An ottoman on the balcony side would have had to be
# stepped over every time somebody went out.
SWIV_R = 450.0                  # the chair
SWIV_SWEEP = 600.0              # and what a seated person needs to come round
BALC_Y = next(w[1] for w in NEW_WALLS if w[7] == 'T-BALC')   # 10995
SWIV_Y = BALC_Y - 600.0         # SWIV_SWEEP, below — the sweep, tangent
SWIV_CLEAR = 350.0              # sweep to the east wall, and sweep to sweep
_liv_e = 6950.0 - 75.0          # the envelope's inner face down this side
SWIV_X = (_liv_e - SWIV_CLEAR - SWIV_SWEEP - (2 * SWIV_SWEEP + SWIV_CLEAR),
          _liv_e - SWIV_CLEAR - SWIV_SWEEP)
# The ottoman keeps its 150 (6") off the sweeps, so it travels with them.
_otto_c = sum(SWIV_X) / 2
_otto_s = SWIV_Y - SWIV_SWEEP - 150.0
OTTO = (_otto_c - 400.0, _otto_s - 500.0, _otto_c + 400.0, _otto_s)   # 800 x 500

FURNITURE += [
    (kind, cx - r, SWIV_Y - r, cx + r, SWIV_Y + r, label, 'R-LIVING-DINING',
     h, _ellipse(cx, SWIV_Y, r, r), ghost, 'S')
    for cx in SWIV_X
    for kind, r, label, h, ghost in [
        ('armchair', SWIV_R,
         f"swivel chair — {2 * SWIV_R:.0f} ({_ft(2 * SWIV_R)}) across, facing "
         'the balcony or turned into the room',
         750, False),
        ('armchair', SWIV_SWEEP,
         f"the turn — {2 * SWIV_SWEEP:.0f} ({_ft(2 * SWIV_SWEEP)}) swept by "
         'somebody sitting in it, not a thing on the floor',
         0, True),
    ]
] + [
    ('stool', *OTTO,
     f"ottoman — {OTTO[2] - OTTO[0]:.0f} x {OTTO[3] - OTTO[1]:.0f} "
     f"({_ft(OTTO[2] - OTTO[0])} x {_ft(OTTO[3] - OTTO[1])}), shared, "
     f"{_ft(SWIV_Y - SWIV_R - OTTO[3])} off both seats",
     'R-LIVING-DINING', 420, _round_rect(*OTTO, 160)),
]


# ------------------------------------- the two-seater, against the bath wall
# BACK TO THE BATH WALL, FACING WEST across the room. Both its ends are read
# off something rather than chosen: the north end sits below where that wall's
# curve dies into its straight run — the tangent is (6875, 6300) — so the whole
# back is against straight wall, and the south end stops on column 5's north
# face, because the column projects to 6720 and the sofa is 6800 wide. What is
# left between them is 1495 (4'-11"), which is the sofa.
#
# IT HAS TO BE A WALL-HUGGER. There is nothing behind the back: a conventional
# recliner needs 400 (1'-4") to lean into and would have to stand that far off
# the wall, which puts its front where the room walks. The mechanism that
# slides the seat forward instead needs 75-100 (3-4"), which the 1495 gives it
# without moving anything.
SOFA2_D = 950.0                             # depth
SOFA2_E = SEB_WX - SEB_T / 2                # 6800 — the bath's west face
SOFA2_N = SEB_NY + SEB_RW + 100.0           # 6400, clear of the wall's tangent
SOFA2_S = _col_face('column 5', 2)          # 7895, where the column begins
SOFA2 = (SOFA2_E - SOFA2_D, SOFA2_N, SOFA2_E, SOFA2_S)

SOFA2_ARM = 180.0
SOFA2_BACK = 250.0
_s2_x0, _s2_x1 = SOFA2[0] + 60.0, SOFA2_E - SOFA2_BACK
_s2_y0, _s2_y1 = SOFA2_N + SOFA2_ARM, SOFA2_S - SOFA2_ARM
_s2_mid = (_s2_y0 + _s2_y1) / 2

FURNITURE += [
    ('sofa', *SOFA2,
     f"two-seater recliner — {SOFA2_S - SOFA2_N:.0f} x {SOFA2_D:.0f} "
     f"({_ft(SOFA2_S - SOFA2_N)} x {_ft(SOFA2_D)}), back to the bath wall, "
     'facing west. Wall-hugger action: there is nothing behind it to lean into',
     'R-LIVING-DINING', 850, _round_rect(*SOFA2, (140, 50, 50, 140))),
] + [
    ('sofa', _s2_x0, a, _s2_x1, b,
     f"seat — {b - a:.0f} ({_ft(b - a)}) wide, footrest out to "
     f"{_ft(SOFA2_D + 500.0)} from the wall",
     'R-LIVING-DINING', 420, _round_rect(_s2_x0, a, _s2_x1, b, (110, 30, 30, 110)))
    for a, b in [(_s2_y0, _s2_mid - 18.0), (_s2_mid + 18.0, _s2_y1)]
]


# ------------------------------- the diwan and the second recliner, west side
# AN L IN THE NORTH-WEST, closing the living room's other half: a two-seater
# across the top facing south, and a diwan down the west side facing east.
# With the pair of swivels to the south-east and the first recliner on the
# bath wall, the room finally has a middle instead of a long axis.
#
# BOTH BACKS ARE ON THE WEST WALL. Drawn free of it there was a 640 (2'-1")
# slot behind them, which is a slot and not a passage — you cannot walk it and
# you cannot reach into it. On the wall it is 640 of floor instead, and the
# route from the front door up the west side to the bedroom keeps its width.
#
# THE NORTH ARM IS THE L'S CHAISE (Karan's call, after the Kivik): the diwan's
# seat carried round the corner - back on the west wall in line with the
# diwan's, an arm on its north side, open on the south where it meets the
# diwan, and 1500 (4'-11") long to lie back on. It was a two-seater recliner
# facing south, which in the walkthrough read as a loose cushion butted
# against the diwan's end.
LIV_W = 2145.0 + 150.0          # the west wall's inner face

CHAISE_D = 950.0
CHAISE = (LIV_W, 5700.0, LIV_W + 1500.0, 5700.0 + CHAISE_D)
DIWAN_D, DIWAN_L = 900.0, 1900.0
DIWAN = (LIV_W, CHAISE[3], LIV_W + DIWAN_D, CHAISE[3] + DIWAN_L)

# THE CONSOLE at the diwan's south end, in place of the floor lamp (Karan's
# call): 1000 x 400 (3'-3" x 1'-4") on the west wall between the diwan and
# the foyer's corner at 9700, doors below and a drawer across the top, things
# on it. 60 (2") off the diwan, 90 (4") short of the corner.
CONSOLE_LIV = (LIV_W, DIWAN[3] + 60.0, LIV_W + 400.0, DIWAN[3] + 60.0 + 1000.0)
# AND A SECOND ONE NORTH OF THE CHAISE (Karan's call): the west wall runs
# 1505 (4'-11") clear from the curve's end at 4195 to the chaise's arm at
# 5700, and a 1300 x 400 console with doors and a drawer sits in it, 105 (4")
# off the corner and 100 (4") off the chaise.
CONSOLE_LIV_N = (LIV_W, 4300.0, LIV_W + 400.0, 5600.0)

FURNITURE += [
    ('sofa', *CHAISE,
     f"chaise — {CHAISE[2] - CHAISE[0]:.0f} x {CHAISE_D:.0f} "
     f"({_ft(CHAISE[2] - CHAISE[0])} x {_ft(CHAISE_D)}), the L's lounger at the "
     "diwan's north end: back on the west wall, arm on the north side, open "
     'to the south',
     'R-LIVING-DINING', 850, _round_rect(*CHAISE, (50, 140, 140, 50))),
    ('console', *CONSOLE_LIV_N,
     f"console cabinet — {CONSOLE_LIV_N[3] - CONSOLE_LIV_N[1]:.0f} x 400 "
     f"({_ft(CONSOLE_LIV_N[3] - CONSOLE_LIV_N[1])} x 1'-4\") on the west wall "
     "between the bedroom door and the chaise: two doors, a drawer across the "
     'top, things on it',
     'R-LIVING-DINING', 800),
    ('console', *CONSOLE_LIV,
     f"console cabinet — {CONSOLE_LIV[3] - CONSOLE_LIV[1]:.0f} x 400 "
     f"({_ft(CONSOLE_LIV[3] - CONSOLE_LIV[1])} x 1'-4\") on the west wall "
     "between the diwan and the foyer: two doors, a drawer across the top, "
     'things on it',
     'R-LIVING-DINING', 800),
] + [
    ('daybed', *DIWAN,
     f"diwan — {DIWAN_L:.0f} x {DIWAN_D:.0f} ({_ft(DIWAN_L)} x "
     f"{_ft(DIWAN_D)}) against the west wall, facing east. A seat by day and "
     'the flat’s spare bed',
     'R-LIVING-DINING', 450, _round_rect(*DIWAN, 90)),
    ('daybed', DIWAN[0], DIWAN[1], DIWAN[0] + 225.0, DIWAN[3],
     f"the diwan’s bolster — 225 (0'-9\") along the wall",
     'R-LIVING-DINING', 700,
     _round_rect(DIWAN[0], DIWAN[1], DIWAN[0] + 225.0, DIWAN[3], 60)),
]


# --------------------------------------------- the wash basin, on the curve
# THE ONE UNBROKEN PIECE OF THE CURVE. Both doors were pushed out to the
# junctions so the middle of the bow survives whole, and what survives is 780
# (2'-7") of it between the bath's door and the bedroom's. That is where the
# basin goes: on the living-room face, immediately beside the bathroom door,
# so it is reached without opening anything.
#
# A console struck on the curve rather than a box in front of it — the wall is
# a bezier, not a circle, so it is offset point by point off its own normal
# and cannot drift from it.
def _nw_sub(d0, d1):
    return [NW_PTS[i] for i in range(len(NW_RUN)) if d0 <= NW_RUN[i] <= d1]


def _nw_offset(pts, d):
    """A stretch of the curve pushed d to its LIVING-ROOM side."""
    out = []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        run = math.hypot(dx, dy) or 1.0
        out.append((round(p[0] + dy / run * d, 1), round(p[1] - dx / run * d, 1)))
    return out


WASH_JAMB = 40.0
WASH_D = 450.0
# 40 (1.5") off the curve's face, not flush on it. W-BED-E lands on this wall
# at an angle, so its foot's corner projects 37 (1.5") past the face into the
# living room, and a console sitting flush had that corner inside it. Nothing
# visible at any scale anybody will look at this; wrong in the model.
WASH_BACK = 75.0 + 40.0
_wash_a = _nw_arc_at_x(NW_BATH_DOOR[1]) + WASH_JAMB
_wash_b = _nw_arc_at_x(NW_BED_DOOR[0]) - WASH_JAMB
WASH_W = _wash_b - _wash_a
_wash_c = _nw_sub(_wash_a, _wash_b)
WASH_TOP = (_nw_offset(_wash_c, WASH_BACK)
            + _nw_offset(_wash_c, WASH_BACK + WASH_D)[::-1])
_wash_mid = _wash_c[len(_wash_c) // 2]
_wash_n = _nw_offset([_wash_c[len(_wash_c) // 2 - 1], _wash_mid,
                      _wash_c[len(_wash_c) // 2 + 1]], WASH_BACK + WASH_D / 2)[1]
WASH_BOWL = _ellipse(_wash_n[0], _wash_n[1], 230, 180)

_wx = [q[0] for q in WASH_TOP]
_wy = [q[1] for q in WASH_TOP]

FURNITURE += [
    ('console', min(_wx), min(_wy), max(_wx), max(_wy),
     f"wash basin console — {WASH_W:.0f} ({_ft(WASH_W)}) of the curve, "
     f"{WASH_D:.0f} ({_ft(WASH_D)}) deep, on the living-room side beside the "
     'bathroom door',
     'R-LIVING-DINING', 900, WASH_TOP),
    ('console', _wash_n[0] - 230, _wash_n[1] - 180,
     _wash_n[0] + 230, _wash_n[1] + 180,
     "basin — 460 x 360 (1'-6\" x 1'-2\") oval, mirror over",
     'R-LIVING-DINING', 880, WASH_BOWL),
]


# ------------------------------------------- what makes the rooms read as lived in
# RUGS, PLANTS AND PLANTERS (Karan's call, for the walkthrough).  Each is on
# the sheet too, so the 2D and the 3D stay one drawing: a rug is a dashed
# outline the furniture stands on, a plant a circle.  Nothing here stands in
# a route: the living rugs lie under the two seating groups, the plant takes
# the dead corner between the recliner and the swivels on the east wall, and
# the balcony planters sit at its two ends, clear of the way out between the
# chairs.
# THE LIVING RUG IS A CENTREPIECE, not a floor: 1700 x 2300 (5'-7" x 7'-7")
# under the leaf chandelier, an oval with a live edge - the outline wanders
# in and out of the ellipse by up to 60 (2"), the way a hand-cut felt or a
# hide does - rather than the 2400 x 2800 rectangle that filled the room.
# (Karan's call.) Deterministic: the same edge every build.
def _live_oval(cx, cy, rx, ry, n=40, wobble=60.0):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        w = (math.sin(3 * a + 0.8) * 0.55 + math.sin(5 * a + 2.1) * 0.3
             + math.sin(8 * a + 0.3) * 0.15) * wobble
        r = 1.0 + w / min(rx, ry)
        out.append((round(cx + rx * r * math.cos(a), 1), round(cy + ry * r * math.sin(a), 1)))
    return out


RUG_LIV = _live_oval(4500.0, 7300.0, 850.0, 1150.0)
_rl_x = [q[0] for q in RUG_LIV]
_rl_y = [q[1] for q in RUG_LIV]

FURNITURE += [
    ('rug', min(_rl_x), min(_rl_y), max(_rl_x), max(_rl_y),
     "rug — 1700 x 2300 (5'-7\" x 7'-7\") wool centrepiece, an oval with a live "
     'edge, under the leaf chandelier',
     'R-LIVING-DINING', 12, RUG_LIV),
    # THE PLANT'S FOOTPRINT IS ITS SPREAD, NOT ITS POT: an areca in a 400 pot
    # is 650 (2'-2") across at the leaves, and the walkthrough keeps every leaf
    # inside the ring, so the ring is drawn at the spread.
    ('plant', 6150, 8150, 6800, 8800,
     "floor plant — 650 (2'-2\") spread on the east wall, between the recliner and the swivels",
     'R-LIVING-DINING', 1600),
    ('plant', 8580, 120, 9230, 770,
     "floor plant — 650 (2'-2\") spread in the room's north-west corner",
     'R-ROOM', 1400),
    ('rug', 1100, 1300, 2700, 3300,
     "rug — 1600 x 2000 (5'-3\" x 6'-7\") beside the sofa; the bed comes down over it",
     'R-BEDROOM', 12),
    ('rug', 8900, 2900, 11300, 4900,
     "rug — 2400 x 2000 (7'-10\" x 6'-7\") at the foot of the bed",
     'R-ROOM', 12),
    ('planter', 3850, 11950, 4200, 12300,
     "planter — 350 (1'-2\") square, the balcony's west end", 'R-BALCONY', 450),
    ('planter', 6450, 11950, 6800, 12300,
     "planter — 350 (1'-2\") square, the balcony's east end", 'R-BALCONY', 450),
]
