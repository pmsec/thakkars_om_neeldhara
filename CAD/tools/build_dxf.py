"""
Writes the Round 1 DXF: the builder's file with the new layout added.

    python3 tools/build_dxf.py

The builder's drawing is left exactly as it was — every original layer, every
entity, the whole 14th floor, in its own model coordinates.  The proposal goes
on new PROP-* layers on top, so freezing those gives back the builder's sheet
unchanged.

Layers added
    PROP-WALL-NEW     new masonry, hatched solid
    PROP-WALL-DEMO    existing partitions to come out, dashed
    PROP-KEEP         shafts, ducts and voids that must stay clear
    PROP-GLAZ         glazing, sliding glass and the pod screens
    PROP-OPEN         new openings cut in retained masonry
    PROP-FURN         fixed joinery and layout furniture
    PROP-TEXT         room names and areas
    PROP-DIM          the set-out dimensions

Output: out/round1-layout.dxf
"""

import math
import os
import sys

import ezdxf
import numpy as np
from ezdxf.enums import TextEntityAlignment

import clash as C
import design as D
import retrofit as R

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source')
OUT = os.path.join(HERE, '..', 'out')

# frame -> builder model space.  frame.py maps CAD (x, y) to (y - X0, x - Y0),
# so the inverse swaps the axes back.
FX0, FY0 = 32169.0, 60204.0


def P(x, y):
    return (y + FY0, x + FX0)


def poly(msp, pts, layer, closed=True):
    msp.add_lwpolyline([P(x, y) for x, y in pts], close=closed,
                       dxfattribs={'layer': layer})


def box(msp, a, b, c, d, layer):
    poly(msp, [(a, b), (c, b), (c, d), (a, d)], layer)


LAYERS = [
    ('PROP-WALL-NEW', 1, 'CONTINUOUS'),      # red
    ('PROP-WALL-DEMO', 8, 'DASHED'),         # grey
    ('PROP-KEEP', 6, 'DASHED'),              # magenta
    ('PROP-GLAZ', 4, 'CONTINUOUS'),          # cyan
    ('PROP-OPEN', 30, 'DASHED'),             # orange
    ('PROP-FURN', 9, 'CONTINUOUS'),
    ('PROP-TEXT', 3, 'CONTINUOUS'),          # green
    ('PROP-DIM', 2, 'CONTINUOUS'),           # yellow
]


def wall_pieces(x1, y1, x2, y2, t, ops):
    L = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    px, py = -uy, ux
    cuts = [0.0]
    for a, b in sorted(ops):
        cuts += [max(0.0, a), min(L, b)]
    cuts.append(L)
    h = t / 2
    out = []
    for i in range(0, len(cuts) - 1, 2):
        a, b = cuts[i], cuts[i + 1]
        if b - a <= 1:
            continue
        ax_, ay_ = x1 + ux * a, y1 + uy * a
        bx_, by_ = x1 + ux * b, y1 + uy * b
        out.append([(ax_ + px * h, ay_ + py * h), (bx_ + px * h, by_ + py * h),
                    (bx_ - px * h, by_ - py * h), (ax_ - px * h, ay_ - py * h)])
    return out


def main():
    dxf = os.path.join(SRC, 'floor14.dxf')
    if not os.path.exists(dxf):
        raise SystemExit('run: gunzip -k source/floor14.dxf.gz')
    doc = ezdxf.readfile(dxf)
    msp = doc.modelspace()

    # LibreDWG's DXF leaves the three default MATERIAL objects as dangling
    # handles, which trips ezdxf on save.  Rebuild them; nothing else uses them.
    doc.materials.clear()
    doc.materials.create_required_entries()

    for name in ('DASHED',):
        if name not in doc.linetypes:
            doc.linetypes.add(name, pattern=[20.0, 12.0, -8.0],
                              description='Dashed ____ ____ ____')
    for name, colour, lt in LAYERS:
        if name in doc.layers:
            doc.layers.remove(name)
        doc.layers.add(name, color=colour, linetype=lt)

    # ------------------------------------------------------------ demolition
    keep, demo = R.keep_demo()
    for x1, y1, x2, y2 in demo:
        msp.add_line(P(x1, y1), P(x2, y2), dxfattribs={'layer': 'PROP-WALL-DEMO'})

    # ------------------------------------------------------- keep-clear zones
    for name, a, b, c, d, kind in C.NAMED:
        box(msp, a, b, c, d, 'PROP-KEEP')
        msp.add_text(f'{name.upper()} — {kind.upper()} — KEEP CLEAR  {c - a:.0f}x{d - b:.0f}',
                     height=90, rotation=90,
                     dxfattribs={'layer': 'PROP-KEEP'}
                     ).set_placement(P((a + c) / 2, (b + d) / 2),
                                     align=TextEntityAlignment.MIDDLE_CENTER)
    for a, b, c, d in D.VOID_KEEP:
        box(msp, a, b, c, d, 'PROP-KEEP')

    # ------------------------------------------------------------- new walls
    for x1, y1, x2, y2, t, ops in D.NEW_WALLS:
        for q in wall_pieces(x1, y1, x2, y2, t, ops):
            poly(msp, q, 'PROP-WALL-NEW')
            h = msp.add_hatch(color=1, dxfattribs={'layer': 'PROP-WALL-NEW'})
            h.paths.add_polyline_path([P(x, y) for x, y in q], is_closed=True)
            h.set_solid_fill(color=1)

    cx, cy, r, t, gaps = D.GALLERY

    def in_gap(a):
        for g0, g1 in gaps:
            lo, hi = g0 % 360, g1 % 360
            if lo <= hi:
                if lo <= a % 360 <= hi:
                    return True
            elif a % 360 >= lo or a % 360 <= hi:
                return True
        return False

    run = []
    for a in list(np.arange(0, 360.5, 1.5)) + [None]:
        if a is not None and not in_gap(a):
            run.append(math.radians(a))
            continue
        if len(run) > 1:
            inner = [(cx + math.cos(u) * (r - t / 2), cy + math.sin(u) * (r - t / 2))
                     for u in run]
            outer = [(cx + math.cos(u) * (r + t / 2), cy + math.sin(u) * (r + t / 2))
                     for u in reversed(run)]
            q = inner + outer
            poly(msp, q, 'PROP-WALL-NEW')
            h = msp.add_hatch(color=1, dxfattribs={'layer': 'PROP-WALL-NEW'})
            h.paths.add_polyline_path([P(x, y) for x, y in q], is_closed=True)
            h.set_solid_fill(color=1)
        run = []

    # --------------------------------------------------------------- glazing
    for Pc in (D.POD_W, D.POD_E):
        ts = np.linspace(0, 1, 120)
        pts = [R.bez(Pc, tt) for tt in ts]
        a, b = D.POD_PORTAL
        for m in (ts < a, ts > b):
            seg = [p for p, keep_ in zip(pts, m) if keep_]
            if len(seg) > 1:
                poly(msp, seg, 'PROP-GLAZ', closed=False)
        seg = [p for p, keep_ in zip(pts, (ts >= a) & (ts <= b)) if keep_]
        if len(seg) > 1:
            poly(msp, seg, 'PROP-OPEN', closed=False)
    for x1, y1, x2, y2, kind in D.GLAZING:
        msp.add_line(P(x1, y1), P(x2, y2), dxfattribs={'layer': 'PROP-GLAZ'})

    # ---------------------------------------------------------- new openings
    for x1, y1, x2, y2, lab in D.CUT_OPENINGS:
        box(msp, x1, y1, x2, y2, 'PROP-OPEN')
        msp.add_text(lab, height=70, rotation=90,
                     dxfattribs={'layer': 'PROP-OPEN'}
                     ).set_placement(P((x1 + x2) / 2, (y1 + y2) / 2),
                                     align=TextEntityAlignment.MIDDLE_CENTER)

    # -------------------------------------------------------------- furniture
    for kind, a, b, c, d, lab in D.FURNITURE:
        if kind == 'table':
            msp.add_circle(P((a + c) / 2, (b + d) / 2), min(c - a, d - b) / 2,
                           dxfattribs={'layer': 'PROP-FURN'})
            if 'dining' in lab:
                rr = min(c - a, d - b) / 2
                for k in range(6):
                    ang = math.radians(k * 60)
                    ccx = (a + c) / 2 + math.cos(ang) * (rr + 430)
                    ccy = (b + d) / 2 + math.sin(ang) * (rr + 430)
                    box(msp, ccx - 230, ccy - 230, ccx + 230, ccy + 230, 'PROP-FURN')
        else:
            box(msp, a, b, c, d, 'PROP-FURN')
            if kind == 'bed':
                box(msp, a, b, c, b + 200, 'PROP-FURN')
            elif kind == 'bed-w':
                box(msp, a, b, a + 200, d, 'PROP-FURN')
            elif kind == 'shower':
                msp.add_line(P(a, b), P(c, d), dxfattribs={'layer': 'PROP-FURN'})
                msp.add_line(P(c, b), P(a, d), dxfattribs={'layer': 'PROP-FURN'})

    # ----------------------------------------------------------------- labels
    fam, den, great = R.pod_polys()

    def parea(p):
        return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
                       for i in range(len(p)))) / 2e6

    def label(x, y, name, sub, a, note):
        msp.add_text(name, height=200, rotation=90, dxfattribs={'layer': 'PROP-TEXT'}
                     ).set_placement(P(x, y), align=TextEntityAlignment.MIDDLE_CENTER)
        if sub:
            msp.add_text(sub, height=120, rotation=90,
                         dxfattribs={'layer': 'PROP-TEXT'}
                         ).set_placement(P(x, y + 260),
                                         align=TextEntityAlignment.MIDDLE_CENTER)
        msp.add_text(f'{a:.1f} m2  /  {a * 10.7639:.0f} sq ft', height=110, rotation=90,
                     dxfattribs={'layer': 'PROP-TEXT'}
                     ).set_placement(P(x, y + (450 if sub else 260)),
                                     align=TextEntityAlignment.MIDDLE_CENTER)
        if note:
            msp.add_text(note, height=95, rotation=90,
                         dxfattribs={'layer': 'PROP-TEXT'}
                         ).set_placement(P(x, y + (630 if sub else 440)),
                                         align=TextEntityAlignment.MIDDLE_CENTER)

    for name, sub, rects, note in D.ROOMS:
        if not rects:
            continue
        big = max(rects, key=lambda r_: (r_[2] - r_[0]) * (r_[3] - r_[1]))
        a = sum((c - x) * (d - y) for x, y, c, d in rects) / 1e6
        label((big[0] + big[2]) / 2, (big[1] + big[3]) / 2 - 300, name, sub, a, note)
    label(6550, 6250, 'FAMILY ROOM', '', parea(fam),
          'one pod  ·  glass roof over the 3665 x 2280 bay')
    label(D.M(6550), 6250, 'MUSIC + WORK DEN', '', parea(den),
          'one pod  ·  glass roof over the 3665 x 2280 bay')
    label(D.MID, 3450, 'GREAT ROOM', '', parea(great),
          'party wall removed  ·  7840 across')

    # ------------------------------------------------------------ dimensions
    dimstyle = doc.dimstyles.get('Standard')
    dimstyle.dxf.dimtxt = 140
    dimstyle.dxf.dimasz = 90
    dimstyle.dxf.dimexe = 60
    dimstyle.dxf.dimexo = 60
    for x1, y1, x2, y2, txt in D.DIMS:
        p1, p2 = P(x1, y1), P(x2, y2)
        if y1 == y2:                       # runs along the home -> vertical in CAD
            dim = msp.add_linear_dim(base=(p1[0] - 250, 0), p1=p1, p2=p2,
                                           angle=90,
                                           dxfattribs={'layer': 'PROP-DIM'})
        else:
            dim = msp.add_linear_dim(base=(0, p1[1] - 250), p1=p1, p2=p2,
                                           angle=0,
                                           dxfattribs={'layer': 'PROP-DIM'})
        dim.render()

    # ------------------------------------------------------------------ title
    for i, line in enumerate([
            'FULL-FLOOR RESIDENCE — ROUND 1',
            'A-101 SET OUT ON THE BUILDER SHELL',
            'ALL COLUMNS, BEAMS, SHAFTS, DUCTS AND VOIDS HONOURED',
            'DIMENSIONS IN MILLIMETRES — CONCEPT DRAWING, NOT FOR CONSTRUCTION',
            'BUILDER GEOMETRY UNTOUCHED ON ITS ORIGINAL LAYERS; PROPOSAL ON PROP-*']):
        msp.add_text(line, height=[320, 180, 150, 130, 130][i], rotation=90,
                     dxfattribs={'layer': 'PROP-TEXT'}
                     ).set_placement(P(-2600 - i * 420, 0),
                                     align=TextEntityAlignment.MIDDLE_LEFT)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'round1-layout.dxf')
    doc.saveas(path)
    print('wrote', path, f'{os.path.getsize(path) / 1e6:.1f} MB')

    back = ezdxf.readfile(path)
    n = sum(1 for e in back.modelspace() if e.dxf.layer.startswith('PROP-'))
    print(f'read back OK — {n} proposal entities on {len(LAYERS)} PROP-* layers')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
