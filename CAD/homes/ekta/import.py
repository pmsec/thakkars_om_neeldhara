#!/usr/bin/env python3
"""
THE IMPORT, FROM THE BUILDER'S DWG TO design.py.

    dwg2dxf 14th_floor_neeldhara_ekta.dwg           LibreDWG
    tools/extract_dwg.py                            flatten block inserts
    tools/import_shell.py                           pair wall faces -> centrelines
    homes/ekta/import.py     <- this file           make it a plan
    tools/draw_home.py / tools/export_app.py        sheet, and the app's data

Run it again and design.py is rewritten from source/shell.json. That is the
point: this file, not design.py, is where a question about "why is this wall
here" gets answered, and design.py is downstream of it until somebody starts
designing the flat by hand — at which point this file is retired and design.py
becomes the source, as it already is for Om Neeldhara.

What it has to fix, and why:

  square()   the builder draws walls up to 13 mm off square. A planar
             subdivision turns that into slivers.
  grid()     a 125 partition flush with a 150 external wall carries its
             centreline 12.5 mm off it. Invisible on paper; a hole in a
             subdivision, and a room leaks out through it.
  merge()    pairing two faces can find the same wall twice, and a wall drawn
             in pieces comes back as overlapping collinear runs.
  connect()  the builder breaks every wall at a door jamb and stops it at the
             plaster line, so paired centrelines end in mid-air and nothing
             encloses anything. Ends are pushed along their own axis onto the
             nearest thing they can reach.

    python3 homes/ekta/import.py

"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools'))
import home                                              # noqa: E402

D = home.dir_for('ekta')
sh = json.load(open(os.path.join(D, 'source', 'shell.json')))

# ---- carpet boundary, in order, local mm (traced from DA_CARPET AREA RERA)
CARPET = [(605,2620),(2295,2620),(2295,8200),(0,8200),(0,12320),(3050,12320),
          (3050,11700),(8295,11700),(8445,11700),(8445,12320),(11470,12320),
          (11470,3965),(8445,3965),(8445,4575),(6800,4575),(6800,1400),
          (6800,1250),(3800,1250),(3800,1400),(605,1400),(605,2460)]
BALCONY = [(3800,0),(6850,0),(6850,1250),(3800,1250)]

def dedupe(p):
    out=[]
    for q in p:
        if not out or (abs(q[0]-out[-1][0])>0.5 or abs(q[1]-out[-1][1])>0.5): out.append(q)
    return out

def signed_area(p):
    return sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2

def offset(poly, d):
    """Outward offset of a rectilinear polygon by d, by shifting each edge
    along its outward normal and re-intersecting neighbours."""
    p = dedupe(poly)
    if signed_area(p) < 0: p = p[::-1]      # make CCW
    n = len(p)
    lines=[]
    for i in range(n):
        a, b = p[i], p[(i+1)%n]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = (dx*dx+dy*dy)**.5
        ux, uy = dx/L, dy/L
        nx, ny = uy, -ux                     # outward for CCW in screen coords
        lines.append(((a[0]+nx*d, a[1]+ny*d), (ux, uy)))
    out=[]
    for i in range(n):
        (p1,(u1x,u1y)) = lines[i-1]
        (p2,(u2x,u2y)) = lines[i]
        den = u1x*u2y - u1y*u2x
        if abs(den) < 1e-9:
            out.append(p2); continue
        t = ((p2[0]-p1[0])*u2y - (p2[1]-p1[1])*u2x)/den
        out.append((p1[0]+u1x*t, p1[1]+u1y*t))
    out = [(round(x,1), round(y,1)) for x,y in out]
    # drop repeated and collinear vertices: a zero-length envelope edge makes
    # a degenerate cycle in the planar subdivision
    ded = []
    for q in out:
        if not ded or abs(q[0]-ded[-1][0]) > 1 or abs(q[1]-ded[-1][1]) > 1:
            ded.append(q)
    if len(ded) > 2 and abs(ded[0][0]-ded[-1][0]) <= 1 and abs(ded[0][1]-ded[-1][1]) <= 1:
        ded.pop()
    keep = []
    n = len(ded)
    for i in range(n):
        a, b, c = ded[i-1], ded[i], ded[(i+1) % n]
        if abs((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) > 1:
            keep.append(b)
    return keep

ENV = offset(CARPET, 150)
def area(p): return abs(signed_area(p))/1e6
print(f'carpet {area(CARPET):.2f} m2   envelope(+150) {area(ENV):.2f} m2')

def inside(px, py, poly):
    c = False
    n = len(poly)
    for i in range(n):
        x1,y1 = poly[i]; x2,y2 = poly[(i+1)%n]
        if (y1 > py) != (y2 > py) and px < (x2-x1)*(py-y1)/(y2-y1)+x1:
            c = not c
    return c

# The extraction box necessarily reaches past the flat — the lift core and
# the neighbour's walls sit right against it. Keep only walls whose midpoint
# is inside this flat's envelope.
def keep(w):
    return inside((w[0]+w[2])/2, (w[1]+w[3])/2, ENV)

# The model DERIVES the external walls from the envelope, exactly as Home 1
# does — so an extracted wall sitting on the envelope's own centreline is a
# duplicate of one the app will build itself, and must not be emitted twice.
CENT = offset(CARPET, 75)

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx-ax, by-ay
    L2 = dx*dx + dy*dy
    t = 0 if L2 == 0 else max(0, min(1, ((px-ax)*dx + (py-ay)*dy)/L2))
    return ((px-(ax+t*dx))**2 + (py-(ay+t*dy))**2)**.5

def on_envelope(w, tol=90):
    mx, my = (w[0]+w[2])/2, (w[1]+w[3])/2
    n = len(CENT)
    return min(seg_dist(mx, my, CENT[i], CENT[(i+1)%n]) for i in range(n)) < tol

dropped = [w for w in sh['walls'] if not keep(w)]
def square(w, tol=40):
    """A wall the builder drew 13 mm off square is still a square wall. The
    skew is drafting noise, and a planar subdivision turns it into slivers."""
    x1, y1, x2, y2, t = w[:5]
    if abs(x2 - x1) <= tol and abs(y2 - y1) > tol:
        x = round((x1 + x2) / 2, 1); x1 = x2 = x
    elif abs(y2 - y1) <= tol and abs(x2 - x1) > tol:
        y = round((y1 + y2) / 2, 1); y1 = y2 = y
    return (x1, y1, x2, y2, t)

def grid(walls, cent, tol=25):
    """A 125 partition whose face is flush with a 150 external wall carries its
    centreline 12.5 mm off that wall's. Half an inch is below anything anyone
    can build to, and on the sheet it is invisible — but a planar subdivision
    reads it as a hole, and the room leaks out through it. So pull lines that
    are within half an inch of the envelope centreline, or of each other, onto
    one shared coordinate."""
    xs = sorted({round(x, 1) for x, y in cent})
    ys = sorted({round(y, 1) for x, y in cent})

    def pull(v, g):
        for c in g:
            if abs(v - c) <= tol:
                return c
        return v

    out = []
    for x1, y1, x2, y2, t in walls:
        if abs(x2 - x1) < abs(y2 - y1):
            x = pull(x1, xs); out.append((x, y1, x, y2, t))
        else:
            y = pull(y1, ys); out.append((x1, y, x2, y, t))
    # now cluster what is left: parallel lines still within tol of each other
    for k, sel in ((0, lambda w: abs(w[2]-w[0]) < abs(w[3]-w[1])), (1, lambda w: not (abs(w[2]-w[0]) < abs(w[3]-w[1])))):
        vals = sorted({w[k] for w in out if sel(w)})
        rep = {}
        i = 0
        while i < len(vals):
            j = i
            while j + 1 < len(vals) and vals[j+1] - vals[j] <= tol:
                j += 1
            c = round(sum(vals[i:j+1]) / (j - i + 1), 1)
            for v in vals[i:j+1]:
                rep[v] = c
            i = j + 1
        out = [((rep[w[0]], w[1], rep[w[0]], w[3], w[4]) if sel(w) and k == 0 else
                (w[0], rep[w[1]], w[2], rep[w[1]], w[4]) if sel(w) and k == 1 else w)
               for w in out]
    return out

def snap(walls, cent, tol=400):
    W = [list(w) for w in walls]
    # 1. ends near the envelope centreline are pulled onto it
    n = len(cent)
    for w in W:
        for e in (0, 2):
            px, py = w[e], w[e+1]
            best, bp = tol, None
            for i in range(n):
                a, b = cent[i], cent[(i+1)%n]
                dx, dy = b[0]-a[0], b[1]-a[1]
                L2 = dx*dx+dy*dy
                t = 0 if L2 == 0 else max(0, min(1, ((px-a[0])*dx+(py-a[1])*dy)/L2))
                qx, qy = a[0]+t*dx, a[1]+t*dy
                d = ((px-qx)**2+(py-qy)**2)**.5
                if d < best: best, bp = d, (qx, qy)
            if bp:
                w[e], w[e+1] = round(bp[0],1), round(bp[1],1)
    # 2. ends near each other are welded, keeping the wall axis-aligned
    pts = [(i, e) for i in range(len(W)) for e in (0, 2)]
    for a in range(len(pts)):
        ia, ea = pts[a]
        for b in range(a+1, len(pts)):
            ib, eb = pts[b]
            if ia == ib: continue
            dx = W[ia][ea]-W[ib][eb]; dy = W[ia][ea+1]-W[ib][eb+1]
            if abs(dx) < tol and abs(dy) < tol and (dx or dy):
                mx = round((W[ia][ea]+W[ib][eb])/2, 1)
                my = round((W[ia][ea+1]+W[ib][eb+1])/2, 1)
                for (i, e) in ((ia, ea), (ib, eb)):
                    horiz = abs(W[i][3]-W[i][1]) < abs(W[i][2]-W[i][0])
                    if horiz: W[i][e] = mx
                    else:     W[i][e+1] = my
    return [tuple(w) for w in W]

walls = [square(w) for w in sh['walls'] if keep(w) and not on_envelope(w, 120)]
walls = snap(walls, CENT)
walls = [square(w) for w in walls]
walls = grid(walls, CENT)


def merge(walls, tol=30, gap=1300):
    """Pairing a wall's two faces can find the same wall twice, and a wall
    drawn in pieces comes back as overlapping collinear runs. Both make
    degenerate cycles in the subdivision, so collapse them into one run."""
    out = []
    for w in sorted(walls, key=lambda w: -max(abs(w[2]-w[0]), abs(w[3]-w[1]))):
        x1, y1, x2, y2, t = w
        vert = abs(x2 - x1) < tol
        hit = None
        for i, o in enumerate(out):
            ox1, oy1, ox2, oy2, ot = o
            if (abs(ox2 - ox1) < tol) != vert or abs(ot - t) > tol:
                continue
            if vert and abs(ox1 - x1) > tol:
                continue
            if not vert and abs(oy1 - y1) > tol:
                continue
            a0, a1 = sorted((y1, y2) if vert else (x1, x2))
            b0, b1 = sorted((oy1, oy2) if vert else (ox1, ox2))
            if min(a1, b1) - max(a0, b0) > -gap:       # touching, overlapping
                # or separated by no more than a doorway: the builder breaks a
                # wall at every door, and a broken wall encloses nothing
                hit = (i, min(a0, b0), max(a1, b1))
                break
        if hit is None:
            out.append((x1, y1, x2, y2, t))
        else:
            i, lo, hi = hit
            o = out[i]
            out[i] = ((o[0], lo, o[0], hi, o[4]) if vert else (lo, o[1], hi, o[1], o[4]))
    return out

def prune(walls, cent, tol=60):
    """Drop walls with a FREE END. A wall that stops in mid-air cannot bound
    a room, and in a planar subdivision it makes a degenerate two-point cycle.
    The builder's drawing is full of them — door jambs, short returns — and
    they carry no information about how the flat divides."""
    def on_env(px, py):
        n = len(cent)
        return min(seg_dist(px, py, cent[i], cent[(i+1) % n]) for i in range(n)) < tol

    W = list(walls)
    changed = True
    while changed:
        changed = False
        for i, w in enumerate(W):
            free = False
            for e in (0, 2):
                px, py = w[e], w[e+1]
                if on_env(px, py):
                    continue
                touch = False
                for j, o in enumerate(W):
                    if i == j:
                        continue
                    for f in (0, 2):
                        if abs(o[f]-px) < tol and abs(o[f+1]-py) < tol:
                            touch = True
                    # a T-junction: the end lands on another wall's span
                    if seg_dist(px, py, (o[0], o[1]), (o[2], o[3])) < tol:
                        touch = True
                if not touch:
                    free = True
            if free:
                W.pop(i)
                changed = True
                break
    return W


def connect(walls, cent, maxext=2400, tol=1.0, corner=80):
    """CLOSE THE NETWORK.

    The builder draws wall FACES, and he breaks every one of them at a door
    jamb and stops it at the plaster line. Pair those faces into centrelines
    and you get runs that end in mid-air: nothing encloses anything, so the
    planar subdivision finds one face for the whole flat and no room derives.

    A derived room is a face of the centreline arrangement, so every wall end
    has to land exactly on something. Each end is pushed — or pulled — along
    its OWN axis to the nearest thing it can reach: a perpendicular wall, or
    the envelope centreline. Nothing moves sideways, so no wall leaves the
    line the builder drew it on; only its length changes, and only by the
    width of a doorway."""
    W = [list(w) for w in walls]
    CE = [(cent[i], cent[(i + 1) % len(cent)]) for i in range(len(cent))]

    def vert(w):
        return abs(w[2] - w[0]) < abs(w[3] - w[1])

    def targets(i, want_horiz):
        """Lines the end can land on, as (perp coord, span lo, span hi, owner)."""
        for j, o in enumerate(W):
            if j == i:
                continue
            if vert(o) == want_horiz:      # want_horiz: target must be horizontal
                continue
            if want_horiz:
                yield (o[1], min(o[0], o[2]), max(o[0], o[2]), j)
            else:
                yield (o[0], min(o[1], o[3]), max(o[1], o[3]), j)
        for a, b in CE:
            horiz = abs(a[1] - b[1]) < abs(a[0] - b[0])
            if horiz != want_horiz:
                continue
            if want_horiz:
                yield (a[1], min(a[0], b[0]), max(a[0], b[0]), None)
            else:
                yield (a[0], min(a[1], b[1]), max(a[1], b[1]), None)

    for _ in range(6):
        moved = False
        for i in range(len(W)):
            w = W[i]
            v = vert(w)
            for e in (0, 2):
                px, py = w[e], w[e + 1]
                ox, oy = w[2 - e], w[3 - e]
                # outward: the direction this end points away from the wall
                d = (1 if py > oy else -1) if v else (1 if px > ox else -1)
                along = py if v else px
                across = px if v else py
                strict, loose = [], []
                for perp, lo, hi, owner in targets(i, want_horiz=v):
                    delta = d * (perp - along)
                    if delta < -tol or delta > maxext:
                        continue
                    if lo - corner <= across <= hi + corner:
                        # inside the target's span, or within a corner of its end
                        strict.append((delta, perp, owner))
                    elif owner is not None and lo - maxext <= across <= hi + maxext:
                        # only a WALL can be lengthened to meet us; the envelope
                        # centreline is the building and does not move
                        loose.append((delta, perp, owner))
                pick = min(strict or loose, default=None)
                if pick is None or pick[0] <= tol:
                    continue
                delta, perp, owner = pick
                if v:
                    W[i][e + 1] = round(perp, 1)
                else:
                    W[i][e] = round(perp, 1)
                moved = True
                if owner is not None and not strict:
                    # we landed past the end of the wall we aimed at: bring that
                    # wall's nearest end out to meet us, or the T is a near miss
                    o = W[owner]
                    ov = vert(o)
                    k = 0 if abs((o[1] if ov else o[0]) - across) < abs((o[3] if ov else o[2]) - across) else 2
                    if ov:
                        o[k + 1] = round(across, 1)
                    else:
                        o[k] = round(across, 1)
        if not moved:
            break
    return [tuple(w) for w in W]

before = len(walls)
walls = merge(walls)
print(f'walls merged {before} -> {len(walls)}')
walls = connect(walls, CENT)
walls = merge(walls, gap=1)
print(f'after connect {len(walls)}')
walls = sorted(walls, key=lambda w:(w[1],w[0]))

# SNAP THE NETWORK SHUT. A derived room is a face enclosed by wall
# centrelines, so a wall that stops 60 mm short of the one it meets leaks the
# room into its neighbour. The builder draws faces, not centrelines, so those
# gaps are inevitable in an import; closing them is the price of deriving
# rooms rather than drawing them.
sh['glazing'] = [g for g in sh['glazing']
                 if inside((g[0]+g[2])/2, (g[1]+g[3])/2, ENV)]
cols_all = sh['columns']
sh['columns'] = [c for c in cols_all
                 if inside((c[0]+c[2])/2, (c[1]+c[3])/2, ENV)]
print(f'walls kept {len(walls)}, dropped {len(dropped)} outside the envelope')
print(f'columns kept {len(sh["columns"])} of {len(cols_all)}')
cols  = sh['columns']

ROOMS = [
 # One anchor per DERIVED FACE. The builder's plan names thirteen spaces, but
 # four of them (the foyer, and three stretches of passage) are alcoves off a
 # larger room rather than rooms the walls enclose — with no door schedule read
 # yet, nothing separates them, so naming them would claim a face twice. The
 # balcony is outside the envelope entirely, like Home 1's deck.
 ('LIVING / DINING','', (3901,5558), 'the long room, with the foyer as its entrance alcove — 14\'9" x 21\'11" as the builder set it out'),
 ('KITCHEN','',        (5325,9974), "7' x 11'11\" plus the utility return"),
 ('BEDROOM','',        (1015,10545),'10\'0" x 13\'6"'),
 ('M.BEDROOM 01','',   (9204,10550),'10\'0" x 13\'6", with its own toilet'),
 ('M.BEDROOM 02','',   (9065,6122), '10\'0" x 13\'6", with its own toilet'),
 ('TOILET 01','MASTER',(7110,10530),'4\'6" x 8\'1"'),
 ('TOILET 02','MASTER',(7079,5807), '4\'6" x 8\'0"'),
 ('TOILET','COMMON',   (3503,10531),'4\'6" x 8\'1"'),
 ('PASSAGE','',        (3408,8701), "4'6\" x 2'11\", between the bedroom and the common toilet"),
]

def fmt(seq, per=4, ind='    '):
    out, line = [], ind
    for i, v in enumerate(seq):
        s = str(v) + ('' if i == len(seq)-1 else ',')
        if len(line) + len(s) > 90:
            out.append(line.rstrip()); line = ind
        line += s + ' '
    out.append(line.rstrip())
    return '\n'.join(out)

src = f'''"""
EKTA'S FLAT — 14th floor, Neeldhara. Next door to Om Neeldhara.

IMPORTED, not yet authored. Every number below was read out of the builder's
DWG by tools/import_shell.py: the walls are the two faces of each drawn wall
paired into a centreline, the columns are the rectangles on DA_COLUMN, and
the envelope is the RERA carpet boundary offset out by one wall.

    RERA        1073 sq ft  =  carpet 1032 + balcony 41
    carpet      {area(CARPET):.2f} m2 ({area(CARPET)*10.7639:.0f} sq ft) — matches the builder's figure
    local frame the flat's north-west corner is (0, 0); x runs east, y south

This is the flat AS THE BUILDER HANDS IT OVER. It is deliberately thin: rows
of coordinates with no reasoning behind them, because a DWG carries geometry
and not intent. Home 1's design.py reads the other way round — every number
there has a comment saying why. That is what this file becomes as we work on
it: the first thing to do is give these coordinates names.
"""

# --------------------------------------------------------------- the shell
# Outer face of the external walls: the carpet boundary pushed out by 150.
ENVELOPE = [
{fmt([(int(x),int(y)) for x,y in ENV])}
]

# The RERA carpet boundary exactly as drawn, kept for checking areas against
# the builder's 1073 sq ft.
CARPET = [
{fmt([(int(x),int(y)) for x,y in CARPET])}
]

BALCONY = {[(int(x),int(y)) for x,y in BALCONY]}

# ------------------------------------------------------------- the walls
# (x1, y1, x2, y2, thickness, openings, kind) — centrelines from paired
# faces. 'exterior' walls sit on the envelope and are not clipped to it.
# Openings are empty: door positions are in the DWG as arcs and have not been
# read yet, so every room is currently drawn sealed.
NEW_WALLS = [
'''
for w in walls:
    kind = 'partition'
    src += (f'    ({int(w[0])}, {int(w[1])}, {int(w[2])}, {int(w[3])}, '
            f'{int(w[4])}, [], {kind!r}),\n')
src += ''']

# ------------------------------------------------------------- glazing
# Window runs on DA_WINDOW, as drawn.
GLAZING = [
'''
seen=set()
for g in sh['glazing']:
    k=(round(g[0]),round(g[1]),round(g[2]),round(g[3]))
    if k in seen: continue
    seen.add(k)
    if max(abs(k[2]-k[0]), abs(k[3]-k[1])) < 400: continue
    src += f'    ({k[0]}, {k[1]}, {k[2]}, {k[3]}, \'window\'),\n'
src += ''']

# --------------------------------------------------------------- rooms
# name, subtitle, anchor point, note. NO SHAPES: the room polygons are
# derived from the wall centrelines, so an anchor is all a room needs.
ROOMS = [
'''
for n, sub, (ax, ay), note in ROOMS:
    src += f'    ({n!r}, {sub!r}, ({ax}, {ay}), {note!r}),\n'
src += ''']

# Loose furniture: nothing yet. This flat has not been designed.
FURNITURE = []
'''
open(os.path.join(D, 'design.py'), 'w').write(src)

imm = f'''"""
What cannot move in Ekta's flat — read off the builder's DWG.

Columns are the rectangles on DA_COLUMN inside the flat. The service shafts
and voids are the S.S. and VOID pockets on the south and east faces. This
flat is NOT mirrored, so there is no mirror line.
"""

EXTENT = (-1500, -1500, 13500, 14500)

MIRROR_X = None


def mirror(z):
    raise NotImplementedError("Ekta's flat is not a mirrored pair")


NAMED = [
'''
for i, c in enumerate(cols, 1):
    imm += f'    ("column {i}", {int(c[0])}, {int(c[1])}, {int(c[2])}, {int(c[3])}, \'column\'),\n'
imm += ''']

# Common property, not part of the flat: the lift core and staircase to the west.
COMMON = ("lift core and staircase", -6000, 0, -300, 9000)
'''
open(os.path.join(D, 'immovables.py'), 'w').write(imm)

json.dump({
  "id": "ekta",
  "name": "Ekta — 14th floor, Neeldhara",
  "subtitle": "imported from the builder's DWG · 1073 sq ft RERA",
  "source": "homes/ekta/source/14th_floor_neeldhara_ekta.dwg",
  "sheet": "homes/ekta/drawings/plan.svg",
  "origin": "imported",
  "paths": {"drawings": "homes/ekta/drawings", "out": "homes/ekta/out"},
  "golden": ["plan.svg", "plan.png"]
}, open(os.path.join(D,'home.json'),'w'), indent=2)
print('wrote design.py, immovables.py, home.json')
