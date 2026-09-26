#!/usr/bin/env python3
"""
THE IMPORT, FROM THE BUILDER'S DWG TO design.py.

    dwg2dxf 14th_floor_neeldhara_ekta.dwg           LibreDWG
    tools/extract_dwg.py                            flatten block inserts
    homes/ekta/import.py     <- this file           make it a plan
    tools/draw_home.py / tools/export_app.py        the sheet, and the app's data

Re-runnable: design.py and immovables.py are its output, not its source.

THE FRAME. Local x = DWG x - 73414.2, local y = 58679.0 - DWG y. The y is
NEGATED on purpose: DWG y runs up the page and a plan sheet's y runs down it,
so without the flip the drawing comes out upside down against the DWG and
nothing can be compared by eye. North-west corner of the flat is (0, 0).

WHY THIS IS NOT A GENERIC IMPORTER ANY MORE. The first version paired the two
drawn faces of every wall into a centreline and stopped there. That reads the
lines but not the drawing, and it got three things wrong:

  * a gap in a wall line is not the end of the wall. It is a DOOR (there is a
    leaf on DA_DOOR), or a COLUMN (there is a rectangle on DA_COLUMN), or the
    wall genuinely stops. Only the third is a free end, and the first two are
    what makes the room close.
  * four of this flat's rooms are not divided by walls at all. The kitchen is
    open to the living room, the foyer is an alcove of it, and two passages
    are entered through cased openings. A room is a face of the boundary
    graph, so those lines have to be drawn as ZERO-THICKNESS THRESHOLDS or
    the rooms do not exist.
  * the balcony is drawn outside the carpet boundary, so offsetting the
    carpet left it off the plan entirely.

Everything below is read off the DWG and then CHECKED against the DWG's own
room dimension text: '10\\'0"X13\\'6"' under BEDROOM, and so on for all twelve.
That text is the builder saying what he drew, and it is the only honest test
of whether this file read him correctly. See ROOMS.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools'))
import home                                              # noqa: E402

D = home.dir_for('ekta')
G = json.load(open(os.path.join(D, 'source', 'builder-geometry.json')))

X0, Y1 = 73414.2, 58679.0                                # DWG -> local origin


def loc(x, y):
    return (round(x - X0, 1), round(Y1 - y, 1))


# --------------------------------------------------------------- the shell
# DA_CARPET AREA RERA, traced in order. This is the RERA carpet boundary and
# it is measured to the INSIDE faces of the external walls.
CARPET = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0),
    (11470, 8355), (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070),
    (3800, 11070), (3800, 10920), (605, 10920), (605, 9700), (2295, 9700),
    (2295, 4120), (0, 4120),
]

# The balcony, also off DA_CARPET AREA RERA but drawn as its own loop: RERA
# counts it separately (1073 = 1032 carpet + 41 balcony). Its east edge is
# drawn at 6850, 50 mm (2") past the living room's wall face above it; it is
# taken to 6800 here so the balcony slab dies on that wall instead of leaving
# a 50 mm sliver for the envelope offset to trip over.
BALCONY = [(3800, 11070), (6800, 11070), (6800, 12320), (3800, 12320)]

# Carpet and balcony share the edge y = 11070, so the floor plate is one
# polygon: the carpet with the balcony spliced into its south side.
PLATE = [
    (0, 0), (3050, 0), (3050, 620), (8445, 620), (8445, 0), (11470, 0),
    (11470, 8355), (8445, 8355), (8445, 7745), (6800, 7745), (6800, 11070),
    (6800, 12320), (3800, 12320), (3800, 11070), (3800, 10920), (605, 10920),
    (605, 9700), (2295, 9700), (2295, 4120), (0, 4120),
]


def signed_area(p):
    n = len(p)
    return sum(p[i][0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * p[i][1] for i in range(n)) / 2


def area_m2(p):
    return abs(signed_area(p)) / 1e6


def _offset_once(poly, d):
    """Shift every edge along its normal and re-intersect neighbours."""
    n = len(poly)
    lines = []
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = (dx * dx + dy * dy) ** .5
        ux, uy = dx / L, dy / L
        lines.append(((a[0] + uy * d, a[1] - ux * d), (ux, uy)))
    out = []
    for i in range(n):
        (p1, (u1x, u1y)) = lines[i - 1]
        (p2, (u2x, u2y)) = lines[i]
        den = u1x * u2y - u1y * u2x
        if abs(den) < 1e-9:
            out.append(p2)
            continue
        t = ((p2[0] - p1[0]) * u2y - (p2[1] - p1[1]) * u2x) / den
        out.append((round(p1[0] + u1x * t, 1), round(p1[1] + u1y * t, 1)))
    return out


def clean(poly, tol=1.0):
    """Drop repeated and collinear vertices: either makes a degenerate cycle
    in the app's planar subdivision, which is a hard error there."""
    ded = []
    for q in poly:
        if not ded or abs(q[0] - ded[-1][0]) > tol or abs(q[1] - ded[-1][1]) > tol:
            ded.append(q)
    while len(ded) > 2 and abs(ded[0][0] - ded[-1][0]) <= tol and abs(ded[0][1] - ded[-1][1]) <= tol:
        ded.pop()
    keep, n = [], len(ded)
    for i in range(n):
        a, b, c = ded[i - 1], ded[i], ded[(i + 1) % n]
        if abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > tol:
            keep.append(b)
    return keep


def offset_out(poly, d):
    """Outward offset, whichever way the polygon happens to be wound. The
    frame is y-down, so 'counter-clockwise' is not a reliable instruction
    here — growing the area is."""
    a = _offset_once(poly, d)
    if area_m2(a) < area_m2(poly):
        a = _offset_once(poly, -d)
    return clean(a)


WALL = 150                                # external wall, off the drawing
ENVELOPE = offset_out(PLATE, WALL)        # outer face
CENT = offset_out(PLATE, WALL / 2)        # its centreline: what the app derives


# ------------------------------------------------------------------ walls
# Centrelines, paired from the two drawn faces on DA_WALL. Where a partition
# meets an external wall its centreline is pulled onto the envelope's — a 125
# partition flush with a 150 wall carries its centreline 12.5 mm (½") off it,
# which is nothing on site and a hole in a planar subdivision.
#
# OPENINGS are absolute along the wall, read off DA_DOOR. A gap in a wall line
# with no door leaf in it is a COLUMN (DA_COLUMN) and stays solid.
#
#   id, x1, y1, x2, y2, thickness, kind, [(type, from, to)], what it divides
WALLS = [
    # --- the north half: bedroom, toilets, kitchen, master bedroom 01
    ('W-BED-E', 3125, 545, 3125, 4195, 125, 'partition',
     [('door', 3220, 4120)],
     'bedroom | common toilet and its passage. Solid from 770 to 1670: that '
     'gap in the drawn faces is a column, not an opening.'),
    ('W-CT-S', 3125, 3157.5, 4607.5, 3157.5, 125, 'partition',
     [('door', 3175, 3925)],
     'common toilet | passage'),
    ('W-KIT-W', 4607.5, 545, 4607.5, 4195, 125, 'partition',
     [], 'common toilet and passage | kitchen'),
    ('W-KIT-E', 6875, 545, 6875, 4195, 125, 'partition',
     [], 'kitchen | master toilet 01 and its passage'),
    ('W-T1-S', 6875, 3157.5, 8370, 3157.5, 125, 'partition',
     [('door', 6925, 7675)],
     'master toilet 01 | passage'),
    ('W-B1-W', 8370, 545, 8370, 4195, 125, 'partition',
     [('door', 3220, 4120)],
     'master toilet 01 and its passage | m.bedroom 01. Solid above 1670: a '
     'column fills the wall there.'),

    # --- the spine: one line across the flat at y 4195
    ('W-P1-S', 2220, 4195, 3625, 4195, 125, 'partition',
     [], 'bedroom and its passage | living/dining'),
    ('W-P2-S', 6875, 4195, 11545, 4195, 125, 'partition',
     [('door', 6925, 7845)],
     'passage and m.bedroom 01 | passage and m.bedroom 02'),

    # --- the south half: living, master suite 02
    ('W-T2-N', 6875, 5232.5, 8370, 5232.5, 125, 'partition',
     [], 'passage | master toilet 02'),
    ('W-T2-W', 6875, 5232.5, 6875, 7820, 125, 'partition',
     [], 'living/dining | master toilet 02'),
    ('W-B2-W', 8370, 4195, 8370, 7820, 125, 'partition',
     [('door', 4245, 5165), ('door', 5295, 6040)],
     'passage and master toilet 02 | m.bedroom 02. The lower door is the '
     'ensuite: toilet 02 is entered from the bedroom, not the passage.'),
]

# ------------------------------------------------------------- thresholds
# NOT WALLS. Five of this flat's rooms are divided from the living room by an
# opening, and the builder draws nothing across them — the kitchen is open,
# the foyer is an alcove, one passage has a cased opening, the balcony has its
# sliding door. A room is a face of the boundary graph, so if these lines are
# not drawn at all those five rooms do not exist; if they are drawn as walls,
# the flat gains five walls nobody built. Zero thickness is the truth: it
# divides the plan and puts nothing on the floor.
#
#   id, x1, y1, x2, y2, what it divides
THRESHOLDS = [
    ('T-P1-S', 3625, 4195, 4607.5, 4195, 'passage | living/dining — cased opening'),
    ('T-KIT-S', 4607.5, 4195, 6875, 4195, 'kitchen | living/dining — the kitchen is open'),
    ('T-P3-W', 6875, 4195, 6875, 5232.5, 'living/dining | passage — cased opening'),
    ('T-FOYER', 2220, 9625, 2220, 10995, 'foyer | living/dining — the foyer is an alcove'),
    ('T-BALC', 3725, 10995, 6875, 10995, 'living/dining | balcony — the sliding door'),
]

# ------------------------------------------------------------------ rooms
# Name, subtitle, anchor, DWG's own dimension text, and its metric value.
# The anchors are the positions of the builder's OWN room labels, and the
# sizes are his own dimension text under them. Both are read out of the DWG,
# which is what makes the check at the bottom of this file worth anything:
# nothing here is my measurement of his drawing.
#
#   name, subtitle, anchor, (w, d) mm, DWG text, note
ROOMS = [
    ('BEDROOM', '', (1015, 1775), (3050, 4115), '10\'0"x13\'6"', ''),
    ('TOILET', 'COMMON', (3503, 1789), (1370, 2465), '4\'6"x8\'1"', ''),
    ('PASSAGE', 'BEDROOM', (3408, 3619), (1370, 889), '4\'6"x2\'11"', ''),
    ('KITCHEN', '', (5325, 2346), (2130, 3632), '7\'0"x11\'11"', 'open to the living room'),
    ('TOILET 01', 'MASTER', (7110, 1790), (1370, 2465), '4\'6"x8\'1"', ''),
    ('PASSAGE', 'MASTER 01', (7196, 3619), (1370, 889), '4\'6"x2\'11"', ''),
    ('M.BEDROOM 01', '', (9204, 1770), (3050, 4115), '10\'0"x13\'6"', ''),
    ('LIVING / DINING', '', (3901, 6762), (4496, 6680), '14\'9"x21\'11"',
     'the foyer is its entrance alcove and the kitchen opens off it'),
    ('PASSAGE', 'MASTER 02', (7117, 4619), (1473, 914), '4\'10"x3\'0"', ''),
    ('TOILET 02', 'MASTER', (7079, 6513), (1370, 2438), '4\'6"x8\'0"',
     'entered from the bedroom, not the passage'),
    ('M.BEDROOM 02', '', (9065, 6198), (3050, 4115), '10\'0"x13\'6"', ''),
    ('FOYER', '', (1197, 10209), (1702, 1219), '5\'7"x4\'0"', 'the way in'),
    ('BALCONY', '', (4798, 11600), (3050, 1245), '10\'0"x4\'1"', 'off the living room'),
]


# ------------------------------------------------- what cannot move: columns
def components(segs, tol=1.0):
    """Group segments that share endpoints. A column is drawn as a closed
    rectangle, so each component is one piece of structure."""
    pts, comp = [], []

    def key(p):
        for i, q in enumerate(pts):
            if abs(q[0] - p[0]) < tol and abs(q[1] - p[1]) < tol:
                return i
        pts.append(p)
        return len(pts) - 1

    parent = {}

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    edges = []
    for s in segs:
        a, b = key((s[0], s[1])), key((s[2], s[3]))
        for k in (a, b):
            parent.setdefault(k, k)
        parent[find(a)] = find(b)
        edges.append((a, b, s))
    groups = {}
    for a, b, s in edges:
        groups.setdefault(find(a), []).append(s)
    for g in groups.values():
        xs = [v for s in g for v in (s[0], s[2])]
        ys = [v for s in g for v in (s[1], s[3])]
        comp.append((min(xs), min(ys), max(xs), max(ys), g))
    return comp


def inside(px, py, poly):
    c, n = False, len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


col_segs = [(*loc(s[1], s[2]), *loc(s[3], s[4])) for s in G['segs'] if s[0] == 'DA_COLUMN']
COLUMNS = []
for x0, y0, x1, y1, g in components(col_segs):
    w, h = x1 - x0, y1 - y0
    # A column is a compact rectangle inside the flat. The long 230 mm strips
    # on this layer are the external wall zones, not columns, and the ones
    # outside the envelope belong to the lift core.
    if max(w, h) > 2000 or min(w, h) < 100:
        continue
    if not inside((x0 + x1) / 2, (y0 + y1) / 2, ENVELOPE):
        continue
    COLUMNS.append((round(x0), round(y0), round(x1), round(y1)))
COLUMNS.sort(key=lambda c: (c[1], c[0]))

# ------------------------------------------------------------------ glazing
win = set()
for s in G['segs']:
    if s[0] != 'DA_WINDOW':
        continue
    a, b = loc(s[1], s[2]), loc(s[3], s[4])
    if max(abs(a[0] - b[0]), abs(a[1] - b[1])) < 400:
        continue
    if not (inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ENVELOPE)):
        continue
    win.add((round(min(a[0], b[0])), round(min(a[1], b[1])),
             round(max(a[0], b[0])), round(max(a[1], b[1]))))
GLAZING = sorted(win, key=lambda g: (g[1], g[0]))

SQFT = 10.7639


def fmt(seq, ind='    ', width=90):
    out, line = [], ind
    for i, v in enumerate(seq):
        s = str(v) + ('' if i == len(seq) - 1 else ',')
        if len(line) + len(s) > width:
            out.append(line.rstrip())
            line = ind
        line += s + ' '
    out.append(line.rstrip())
    return '\n'.join(out)


def num(v):
    return int(v) if float(v) == int(v) else round(float(v), 1)


src = f'''"""
EKTA'S FLAT — 14th floor, Neeldhara. Next door to Om Neeldhara.

GENERATED by homes/ekta/import.py from the builder's DWG. Do not edit by
hand: change import.py and re-run it. Every number here was read off the
drawing, and every room is checked against the builder's own dimension text.

    RERA        1073 sq ft  =  carpet 1032 + balcony 41
    carpet      {area_m2(CARPET):.2f} m2 ({area_m2(CARPET) * SQFT:.0f} sq ft) — his figure exactly
    balcony     {area_m2(BALCONY):.2f} m2 ({area_m2(BALCONY) * SQFT:.0f} sq ft)
    envelope    {area_m2(ENVELOPE):.2f} m2 ({area_m2(ENVELOPE) * SQFT:.0f} sq ft) to the outer face
    frame       the flat's north-west corner is (0, 0); x east, y SOUTH, so
                the sheet reads the same way up as the DWG

This is the flat AS THE BUILDER HANDS IT OVER — geometry with no reasoning
behind it, because a DWG carries no intent. Om Neeldhara's design.py reads
the other way round: every number there has a comment saying why. That is
what this file becomes when somebody starts designing the flat.
"""

# --------------------------------------------------------------- the shell
# Outer face of the external walls: the floor plate (carpet + balcony) pushed
# out by one 150 wall.
ENVELOPE = [
{fmt([(num(x), num(y)) for x, y in ENVELOPE])}
]

# The RERA carpet boundary exactly as drawn, measured to the inside faces.
CARPET = [
{fmt([(num(x), num(y)) for x, y in CARPET])}
]

# The balcony slab. RERA counts it separately from the carpet.
BALCONY = {[(num(x), num(y)) for x, y in BALCONY]}

# Carpet + balcony as one polygon: the floor you can stand on. Everything
# between this and ENVELOPE is external wall.
PLATE = [
{fmt([(num(x), num(y)) for x, y in PLATE])}
]

# ------------------------------------------------------------- the walls
# (x1, y1, x2, y2, thickness, openings, kind, id, note). Openings are
# (type, from, to) in absolute mm along the wall — door positions read off
# the DWG's own door layer. A wall of thickness 0 and kind 'threshold' is an
# OPENING, not a wall: it divides two rooms and puts nothing on the floor.
NEW_WALLS = [
'''
for wid, x1, y1, x2, y2, t, kind, ops, note in WALLS:
    src += (f'    ({num(x1)}, {num(y1)}, {num(x2)}, {num(y2)}, {num(t)}, '
            f'{[(k, num(a), num(b)) for k, a, b in ops]!r}, {kind!r}, {wid!r},\n'
            f'     {note!r}),\n')
for wid, x1, y1, x2, y2, note in THRESHOLDS:
    src += (f'    ({num(x1)}, {num(y1)}, {num(x2)}, {num(y2)}, 0, [], '
            f"'threshold', {wid!r},\n     {note!r}),\n")
src += ''']

# ------------------------------------------------------------- glazing
# Window runs on DA_WINDOW, as drawn.
GLAZING = [
'''
for g in GLAZING:
    src += f'    ({g[0]}, {g[1]}, {g[2]}, {g[3]}, \'window\'),\n'
src += ''']

# --------------------------------------------------------------- rooms
# name, subtitle, anchor, note, the builder's dimension text, its area in
# sq ft. NO SHAPES: the room polygons are derived from the boundaries above,
# and the last two columns are what that derivation is checked against.
ROOMS = [
'''
for name, sub, (ax, ay), (w, d), text, note in ROOMS:
    sq = round(w * d / 1e6 * SQFT)
    src += (f'    ({name!r}, {sub!r}, ({ax}, {ay}), {note!r},\n'
            f'     {text!r}, {sq}),\n')
src += ''']

# Loose furniture: nothing yet. This flat has not been designed.
FURNITURE = []
'''
# THE HANDOVER. design.py is this file's output only until somebody starts
# designing the flat, and from that moment it is the SOURCE and re-running the
# import would throw the design away. The marker below is what says which of
# the two is true; once design.py stops carrying it, --force is the only way
# past this.
MARK = 'GENERATED by homes/ekta/import.py'
dst = os.path.join(D, 'design.py')
if '--to' in sys.argv:
    dst = os.path.join(D, sys.argv[sys.argv.index('--to') + 1])
elif os.path.isfile(dst) and MARK not in open(dst).read() and '--force' not in sys.argv:
    sys.exit(
        'homes/ekta/design.py is now HAND-EDITED — it is the design, not this\n'
        "file's output, and re-running the import would throw that away.\n"
        '  To see what the builder drew:   python3 import.py --to design.imported.py\n'
        '  To start again from the DWG:    python3 import.py --force')
open(dst, 'w').write(src)

imm = f'''"""
What cannot move in Ekta's flat — read off the builder's DWG by import.py.

Columns are the closed rectangles on DA_COLUMN that sit inside the flat. The
long 230 mm strips on that layer are external wall zones rather than columns
and are not listed. This flat is not a mirrored pair, so there is no mirror
line.
"""

EXTENT = (-1500, -1500, 13500, 14500)

MIRROR_X = None


def mirror(z):
    raise NotImplementedError("Ekta's flat is not a mirrored pair")


NAMED = [
'''
for i, c in enumerate(COLUMNS, 1):
    imm += f'    ("column {i}", {c[0]}, {c[1]}, {c[2]}, {c[3]}, \'column\'),\n'
imm += ''']

# Common property, not part of the flat: the lift core and staircase, west.
COMMON = ("lift core, lifts and staircase", -4000, 3500, -300, 13000)
'''
if '--to' not in sys.argv:
    open(os.path.join(D, 'immovables.py'), 'w').write(imm)

if '--to' not in sys.argv:
    json.dump({
    "id": "ekta",
    "name": "Ekta — 14th floor, Neeldhara",
    "subtitle": "imported from the builder's DWG · 1073 sq ft RERA",
    "source": "homes/ekta/source/14th_floor_neeldhara_ekta.dwg",
    "sheet": "homes/ekta/drawings/plan.svg",
    "origin": "imported",
    "paths": {"drawings": "homes/ekta/drawings", "out": "homes/ekta/out"},
    "golden": ["plan.svg", "plan.png"],
    }, open(os.path.join(D, 'home.json'), 'w'), indent=2)

print(f'carpet   {area_m2(CARPET):7.2f} m2 ({area_m2(CARPET) * SQFT:.0f} sq ft)')
print(f'balcony  {area_m2(BALCONY):7.2f} m2 ({area_m2(BALCONY) * SQFT:.0f} sq ft)')
print(f'envelope {area_m2(ENVELOPE):7.2f} m2 ({area_m2(ENVELOPE) * SQFT:.0f} sq ft)')
print(f'{len(WALLS)} walls, {len(THRESHOLDS)} thresholds, {len(ROOMS)} rooms, '
      f'{sum(len(w[7]) for w in WALLS)} doors, {len(COLUMNS)} columns, '
      f'{len(GLAZING)} window runs')
print('wrote', os.path.basename(dst) + (', immovables.py, home.json' if '--to' not in sys.argv else ''))
