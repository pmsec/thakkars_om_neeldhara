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

# Slid 595 east so the kitchen's east FACE lands on 8295, the west face of
# the column at 8295-8525 — flush, with no sliver left between them. The
# width is unchanged at 3700; the whole room moved rather than shrank, and
# what it uncovers on the west is the only place in this flat a second
# bathroom can go and still reach the north shaft.
KX0, KX1 = 4495.0, 8195.0     # centrelines of the two sides
KTOP, KBOT = 545.0, 3400.0    # the north wall, and how far south the U reaches
KR = 900.0                    # corner radius — the "no sharp curve" number

FACE = 100.0        # half of the 200 counter, so a slab starts at its face
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


KITCHEN_LINE = _round_u()


def _run(pts):
    r = [0.0]
    for i in range(1, len(pts)):
        r.append(r[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                    pts[i][1] - pts[i - 1][1]))
    return r


KITCHEN_RUN = _run(KITCHEN_LINE)
ARC = KITCHEN_RUN[-1]


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
    (KX0, KTOP, KX1, KTOP, 200,
     [('window', _arc_d(0.104), _arc_d(0.44), 1050, 2400),
      ('cased', _arc_d(0.44), _arc_d(0.56), 1050, 1800),
      ('window', _arc_d(0.56), _arc_d(0.896), 1050, 2400)],
     'partition', 'W-KIT', 'kitchen | living', 0, KITCHEN_LINE),

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
     'a U with 900 corners: 3700 of working wall north, 1955 down each side, '
     'and the counter along the bottom'),
    ('LIVING / DINING', '', (4400, 7500),
     'everything the kitchen curve does not enclose, from the front door to '
     'the balcony and out to the blind east wall. Four stools at the counter.'),
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


SHELF = _slab(+1, DEPTH)     # the eating side, in the living room
LEDGE = _slab(-1, DEPTH)     # its mirror, the serving side in the kitchen
STOOLS = _stools()
_sx = [p[0] for p in SHELF]
_sy = [p[1] for p in SHELF]
_lx = [p[0] for p in LEDGE]
_ly = [p[1] for p in LEDGE]

# Loose furniture. (kind, x1, y1, x2, y2, label, room, height, poly)
# Four stools, set on the curve's own outward normal 640 from the counter face
# so they sit square to it rather than square to the plan.
FURNITURE = [
    ('table', min(_sx), min(_sy), max(_sx), max(_sy),
     'counter shelf — the eating side', 'R-LIVING-DINING', 1050, SHELF),
    ('table', min(_lx), min(_ly), max(_lx), max(_ly),
     'serving ledge — inside the kitchen', 'R-KITCHEN', 1050, LEDGE),
] + [
    ('stool', a, b, c, d, 'bar stool', 'R-LIVING-DINING', 750)
    for a, b, c, d in STOOLS
]