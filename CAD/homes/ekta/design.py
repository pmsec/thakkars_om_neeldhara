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

# ------------------------------------------------------- the counter shelf
# The counter's eating side. A slab bolted to the south face of W-KIT-BAR at
# 1050, sawn square at both ends. Its inner edge is the counter's own curve
# and its outer edge is that curve offset — so the shelf is a true crescent of
# constant width, not a slab that happens to sit near a curve.
#
# It was a live edge for one round. A natural edge is a good idea beside a
# straight wall, where the wobble is the only thing moving; against a curve
# this strong it just fought it, and two competing curves read as one badly
# drawn one.
#
# BOTH FACES CARRY ONE. The eating side is the living room's; the mirror of it
# inside the kitchen is where plates are put down and picked up through the
# hatch. Each is a lens: full depth across the seats, tapering away to nothing
# at both ends so the slab dies into the counter rather than stopping against
# it with a cut end in mid-air.

_BAR = ((3500.0, 545.0), (5750.0, 6255.0), (8000.0, 545.0))   # p0, control, p2
FACE = 100.0        # half of the 200 counter, so the slab starts at its face
DEPTH = 400.0       # projection: knee room under, plates on top
SEAT = 700.0        # stool centres, measured from the counter centreline
TAPER = 0.28        # the fraction at each end over which the slab dies away
SPAN = (0.12, 0.88) # how far along the counter the slabs run


def _bar_point(t):
    """A point on the counter centreline, and the outward (south) normal."""
    (x0, y0), (cx, cy), (x2, y2) = _BAR
    u = 1.0 - t
    px = u * u * x0 + 2 * u * t * cx + t * t * x2
    py = u * u * y0 + 2 * u * t * cy + t * t * y2
    tx = 2 * u * (cx - x0) + 2 * t * (x2 - cx)
    ty = 2 * u * (cy - y0) + 2 * t * (y2 - cy)
    L = math.hypot(tx, ty) or 1.0
    nx, ny = ty / L, -tx / L
    if ny < 0.0:
        nx, ny = -nx, -ny
    return px, py, nx, ny


def _taper(f):
    """Full depth through the middle, smoothstepped away at both ends.

    Smoothstep rather than a sine because it leaves the slab at FULL width
    across every seat and spends the taper where nobody sits; and because it
    reaches zero with zero slope, so the edge runs into the counter face
    tangentially instead of arriving at it as a spike.
    """
    u = min(f, 1.0 - f) / TAPER
    if u >= 1.0:
        return 1.0
    return u * u * (3.0 - 2.0 * u)


def _arc_run(t0=0.0, t1=1.0, n=400):
    """Cumulative length along the counter, and the parameters that go with
    it. Everything that has to be evenly spread on this wall — the openings,
    the stools — is spread on THIS, not on the Bezier parameter."""
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]
    pts = [_bar_point(t)[:2] for t in ts]
    run = [0.0]
    for i in range(1, len(pts)):
        run.append(run[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                        pts[i][1] - pts[i - 1][1]))
    return ts, run


def _t_at_arc(frac, t0=0.0, t1=1.0):
    ts, run = _arc_run(t0, t1)
    want = run[-1] * frac
    i = min(range(len(run)), key=lambda j: abs(run[j] - want))
    return ts[i]


def _arc_x(frac):
    """The x an opening sits at, given where along the ARC it belongs. Wall
    openings are authored against the chord, so this is the translation."""
    return round(_bar_point(_t_at_arc(frac))[0], 1)


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



    # --- the kitchen: ONE curve, north wall to north wall
    # It used to spring off the two columns and need a short straight wall at
    # each end to close the corners. Those corners were the problem: they held
    # the kitchen out to the full 5245 of the north band and gave the rooms
    # either side nothing. So the curve now starts and finishes ON THE NORTH
    # WALL, and the whole boundary is one line — the counter at the bottom of
    # it, the kitchen's own side walls where it stands up at the ends.
    #
    # The columns fall outside it now, standing in the living room until
    # whatever divides that space picks them up.
    (3500, 545, 8000, 545, 200,
     [('window', _arc_x(0.12), _arc_x(0.38), 1050, 2400),
      ('cased', _arc_x(0.38), _arc_x(0.62), 1050, 1800),
      ('window', _arc_x(0.62), _arc_x(0.88), 1050, 2400)],
     'partition', 'W-KIT-BAR',
     'kitchen | living. Timber to 1050, brown tinted glass to 2400, and a '
     'serving hatch at the bottom of the bowl. Openings are placed by '
     'FRACTION OF THE ARC and converted to positions on the chord, because on '
     'a curve this steep equal steps along the chord are nothing like equal '
     'steps along the wall.', 2855),

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
    ('KITCHEN', '', (5700, 1400),
     'behind the counter curve — 5245 of working wall north, the bowl south'),
    ('LIVING / DINING', '', (4400, 7500),
     'everything the kitchen curve does not enclose, from the front door to '
     'the balcony and out to the blind east wall. Four stools at the counter.'),
    ('FOYER', '', (1375, 10300), 'the way in'),
    ('BALCONY', '', (5300, 11700), 'off the living room'),
]

def _slab(sign, depth, n=80):
    """One lens against the counter. sign +1 is the living-room side, -1 the
    kitchen side; the geometry is otherwise identical, which is the point."""
    t0, t1 = SPAN
    inner, outer = [], []
    for i in range(n + 1):
        f = i / n
        px, py, nx, ny = _bar_point(t0 + (t1 - t0) * f)
        nx, ny = nx * sign, ny * sign
        inner.append((round(px + nx * FACE, 1), round(py + ny * FACE, 1)))
        d = FACE + depth * _taper(f)
        outer.append((round(px + nx * d, 1), round(py + ny * d, 1)))
    ring, out = inner + outer[::-1], []
    for q in ring:                     # the tips coincide; drop the repeats
        if not out or abs(q[0] - out[-1][0]) > 0.5 or abs(q[1] - out[-1][1]) > 0.5:
            out.append(q)
    return out


def _even_t(t0, t1, count, n=400):
    """Parameters spaced evenly BY ARC LENGTH along the counter.

    Spacing by the Bezier parameter instead put the four stools where the
    maths was even rather than where the seats are: bunched at the flat
    bottom, spread up the steep ends. On a curve this steep the two are not
    the same thing and only one of them is where people sit.
    """
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]
    pts = [_bar_point(t)[:2] for t in ts]
    run = [0.0]
    for i in range(1, len(pts)):
        run.append(run[-1] + math.hypot(pts[i][0] - pts[i - 1][0],
                                        pts[i][1] - pts[i - 1][1]))
    out, total = [], run[-1]
    for k in range(count):
        want = total * (k + 0.5) / count
        i = min(range(len(run)), key=lambda j: abs(run[j] - want))
        out.append(ts[i])
    return out


def _stools(count=4, size=450.0, t0=0.26, t1=0.74):
    out = []
    for t in _even_t(t0, t1, count):
        px, py, nx, ny = _bar_point(t)
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