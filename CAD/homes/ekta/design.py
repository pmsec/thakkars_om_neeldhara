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
    # --- north-west: the guest room
    (3125, -75, 3125, 1670, 125, [], 'partition', 'W-GUEST-E',
     'the north-west return. It runs from the north wall to the south face of '
     'the column at 3050-3280 x 770-1670 and stops there — the column stays, '
     'the wall ahead of it is gone.', 0),

    # --- the kitchen, the whole width of the north band



    # --- the kitchen counter: one curve between the two columns
    # Solid timber to 1050, the counter height, and brown tinted glass above it
    # to 2400 — so from the sofa the kitchen is a lit band behind glass, and
    # from inside it the cook is not shut in a box. The 1000 gap at 1050 to
    # 1800 is the SERVING HATCH: an unglazed hole at counter level, plates
    # over rather than around.
    (3125, 1670, 8370, 1670, 200,
     [('window', 3525, 5100, 1050, 2400),
      ('cased', 5100, 6100, 1050, 1800),
      ('window', 6100, 7970, 1050, 2400)],
     'partition', 'W-KIT-BAR',
     'kitchen | living. Springs off the south face of the column at 3050-3280 '
     'and lands on the one at 8295-8525, bowing 1730 into the living room. '
     'Deep in the middle, steep at the ends: the bowl is the kitchen and the '
     'pinch points are where the tall units go. 200 thick because it is a '
     'counter, not a partition.', 1730),
    (8370, 545, 8370, 1670, 125, [], 'partition', 'W-KIT-E',
     'kitchen | living, east. Packs out beside the column and closes the '
     'kitchen against the east half of the flat.', 0),

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

_BAR = ((3125.0, 1670.0), (5747.5, 5130.0), (8370.0, 1670.0))   # p0, control, p2
FACE = 100.0        # half of the 200 counter, so the slab starts at its face
DEPTH = 400.0       # projection: knee room under, plates on top
SEAT = 700.0        # stool centres, measured from the counter centreline


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


def _shelf(t0=0.22, t1=0.78, n=64):
    """The slab: the counter face on the inside, the same curve pushed out by
    DEPTH on the outside, and a square cut across each end."""
    inner, outer = [], []
    for i in range(n + 1):
        px, py, nx, ny = _bar_point(t0 + (t1 - t0) * i / n)
        inner.append((round(px + nx * FACE, 1), round(py + ny * FACE, 1)))
        outer.append((round(px + nx * (FACE + DEPTH), 1),
                      round(py + ny * (FACE + DEPTH), 1)))
    return inner + outer[::-1]


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


SHELF = _shelf()
STOOLS = _stools()
_sx = [p[0] for p in SHELF]
_sy = [p[1] for p in SHELF]

# Loose furniture. (kind, x1, y1, x2, y2, label, room, height, poly)
# Four stools, set on the curve's own outward normal 640 from the counter face
# so they sit square to it rather than square to the plan.
FURNITURE = [
    ('table', min(_sx), min(_sy), max(_sx), max(_sy),
     'counter shelf', 'R-LIVING-DINING', 1050, SHELF),
] + [
    ('stool', a, b, c, d, 'bar stool', 'R-LIVING-DINING', 750)
    for a, b, c, d in STOOLS
]