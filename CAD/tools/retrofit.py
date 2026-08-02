"""
Shared machinery for the retrofit: which builder walls stay, which come out,
and the raster masks for the new design.

A builder wall is KEPT if it is part of the shell — the slab edge, or the
enclosure of a shaft, duct or void.  Everything else inside the two flats is
infill partition and comes out, which is what merging two flats means.
Columns and beams are never touched and are not classified here.
"""

import math
import os
import sys

import numpy as np

import clash as C
import design as D
import frame

HERE = os.path.dirname(os.path.abspath(__file__))

# footprint of the two flats plus the absorbed lobby, in frame mm
HOME = (-700, -400, 25200, 11200)
TOL = 260          # a wall this close to the shell or a shaft is part of it


def _near_shell(mx, my, bl_segs, zones):
    for x1, y1, x2, y2 in bl_segs:
        if x1 == x2:
            if abs(mx - x1) < TOL and min(y1, y2) - TOL < my < max(y1, y2) + TOL:
                return True
        elif y1 == y2:
            if abs(my - y1) < TOL and min(x1, x2) - TOL < mx < max(x1, x2) + TOL:
                return True
    for a, b, c, d in zones:
        if a - TOL < mx < c + TOL and b - TOL < my < d + TOL:
            return True
    return False


def keep_demo():
    """Builder DA_WALL segments inside the home, split into keep and demo."""
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    bl_segs = [(bl[i][0], bl[i][1], bl[(i + 1) % len(bl)][0], bl[(i + 1) % len(bl)][1])
               for i in range(len(bl))]
    zones = [(a, b, c, d) for _, a, b, c, d, _ in C.NAMED]

    segs, _ = frame.load_cad(x0=40000, y0=10000, x1=135000, y1=75000)
    keep, demo = [], []
    for lyr, x1, y1, x2, y2 in segs:
        if lyr not in ('DA_WALL', 'DA_Wall2'):
            continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if not (HOME[0] < mx < HOME[2] and HOME[1] < my < HOME[3]):
            continue
        (keep if _near_shell(mx, my, bl_segs, zones) else demo).append((x1, y1, x2, y2))
    return keep, demo


# ------------------------------------------------------------------ design
def bez(P, t):
    u = 1 - t
    return (u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0],
            u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1])


def bez_x(P, y):
    lo, hi = 0.0, 1.0
    for _ in range(50):
        m = (lo + hi) / 2
        if bez(P, m)[1] < y:
            lo = m
        else:
            hi = m
    return bez(P, (lo + hi) / 2)[0]


def pod_polys():
    """Family room, music den and great room as polygons."""
    ys = list(np.linspace(D.BODY_N, D.BODY_S, 160))
    west_curve = [(bez_x(D.POD_W, y), y) for y in ys]
    east_curve = [(bez_x(D.POD_E, y), y) for y in ys]

    # family room: pod bay to the curve, less the walled-off service duct
    fam = ([(D.POD_W0, D.BODY_N)] + west_curve
           + [(bez_x(D.POD_W, D.BODY_S), D.BODY_S), (D.DUCT_W1 + 150, D.BODY_S),
              (D.DUCT_W1 + 150, 6175), (D.POD_W0, 6175)])
    den = [(2 * D.MID - x, y) for x, y in fam]
    great = west_curve + list(reversed(east_curve))
    return fam, den, great


def poly_rooms():
    """Every room that is not a rectangle: (name, sub, polygon, note, label xy).

    The rectangular ones live in design.ROOMS; these are the two pods and the
    great room, which are cut by the pod glazing curves."""
    fam, den, great = pod_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    return [
        ('FAMILY ROOM', '', fam, pod_note, (6550, 6250)),
        ('MUSIC + WORK DEN', '', den, pod_note, (D.M(6550), 6250)),
        ('GREAT ROOM', '', great, 'party wall removed  ·  7840 across', (D.MID, 3450)),
        ('ENTRY GALLERY', '', gallery_poly(),
         '2920 across  ·  800 through to the kitchen and to help\'s room',
         (D.MID, 9600)),
    ]


def _gal_arc(r, a0, a1, n=60):
    cx, cy = D.GAL_CX, D.GAL_CY
    return [(cx + math.cos(math.radians(a)) * r, cy + math.sin(math.radians(a)) * r)
            for a in np.linspace(a0, a1, n)]


COL_N = 9325                  # top of the two 1800-deep gallery columns


def _gal_ends(r):
    """The angles at which a face of radius r leaves the column top and meets
    the entrance wall, east side; the west side is 180 minus each."""
    top = math.degrees(math.asin((COL_N - D.GAL_CY) / r))
    bot = math.degrees(math.asin((D.BAY_S - D.GAL_CY) / r))
    return top, bot


def gallery_poly():
    """The gallery floor: the pocket between the two columns, closed by the
    service-bay north wall, the two arcs and the entrance wall."""
    _cx, _cy, r, t, _g = D.GALLERY
    ri = r - t / 2
    top, bot = _gal_ends(ri)
    w, e = 10630, D.M(10630)
    return ([(w, D.BAY_N), (e, D.BAY_N), (e, COL_N)]
            + _gal_arc(ri, top, bot)                      # east arc, inner face
            + _gal_arc(ri, 180 - bot, 180 - top)          # west arc, inner face
            + [(w, COL_N)])


def fillets():
    """The two solid corners left behind the arcs, between each column and the
    entrance wall.  Masonry, not floor — the 1800 column means there is nothing
    to reach them from."""
    top, bot = _gal_ends(D.GAL_RO)
    return [[(10630, COL_N), (10630, D.BAY_S)]
            + _gal_arc(D.GAL_RO, 180 - bot, 180 - top),
            [(D.M(10630), COL_N), (D.M(10630), D.BAY_S)]
            + _gal_arc(D.GAL_RO, bot, top)]


def corner_units():
    """The mandir and the coffee / pantry, as drawing primitives.

    Both sit in their pod's north corner, behind the retained deck void: one
    leg along the void's back wall, the other following the pod glazing, so
    the unit is set out off the two walls that make the corner.  Everything is
    built on the west pod and mirrored for the east.
    """
    P = D.POD_W
    y0, x0 = D.BODY_N, D.POD_W[0][0]           # the corner: 2620, 9115
    DEP, LEG = 600, 1200

    def face(y):                               # the glazing, at depth y
        return bez_x(P, y)

    def shell(dep, leg, off):
        """outline of the unit, pulled in by `off` from the two walls"""
        return ([(x0 - leg, y0 + off), (x0 - leg, y0 + dep)]
                + [(face(y) - dep, y) for y in np.linspace(y0 + dep, y0 + leg, 40)]
                + [(face(y) - off, y) for y in np.linspace(y0 + leg, y0 + off, 60)])

    def on_glass(y, frac=0.5):                 # a point across the glazing leg
        return face(y) - DEP * frac

    out = []
    for what, flip in (('pooja', False), ('pantry', True)):
        p = [('poly', shell(DEP, LEG, 0), 'solid')]
        if what == 'pooja':
            p.append(('poly', shell(DEP - 90, LEG - 90, 90), 'soft'))
            sx, sy, s = 8600, 2950, 240        # the shrine, square on the corner
            p.append(('poly', [(sx, sy - s), (sx + s, sy), (sx, sy + s), (sx - s, sy)],
                      'solid'))
            p.append(('circle', x0 - LEG + 235, y0 + DEP / 2, 85, 'light'))
            p.append(('circle', on_glass(3600), 3600, 85, 'light'))
        else:
            p.append(('poly', shell(DEP - 90, LEG - 90, 90), 'light'))
            p.append(('rect', 8100, 2760, 8500, 3080, 'light'))     # sink
            p.append(('circle', 8300, 2920, 150, 'light'))
            for y in (3320, 3660):                                  # machines
                cxx = on_glass(y)
                p.append(('rect', cxx - 160, y - 160, cxx + 160, y + 160, 'solid'))
        if flip:
            p = [_mirror_prim(q) for q in p]
        out += p
    return out


def _mirror_prim(p):
    def X(v):
        return 2 * D.MID - v
    if p[0] == 'rect':
        return ('rect', X(p[3]), p[2], X(p[1]), p[4], p[5])
    if p[0] == 'circle':
        return ('circle', X(p[1]), p[2], p[3], p[4])
    if p[0] == 'line':
        return ('line', X(p[1]), p[2], X(p[3]), p[4], p[5])
    return ('poly', [(X(x), y) for x, y in p[1]], p[2])


def poly_area(p):
    return abs(sum(p[i][0] * p[(i + 1) % len(p)][1]
                   - p[(i + 1) % len(p)][0] * p[i][1]
                   for i in range(len(p)))) / 2e6


def keep_wall_mask():
    """The builder walls that stay, as a raster."""
    keep, _ = keep_demo()
    m = C.blank()
    for x1, y1, x2, y2 in keep:
        C.put_rect(m, min(x1, x2) - 80, min(y1, y2) - 80,
                   max(x1, x2) + 80, max(y1, y2) + 80)
    return m


def design_masks():
    """(floor, new walls, retained builder walls) rasters for Round 1.

    Retained walls are kept separate: they are existing fabric sitting on the
    shell and the shaft enclosures, so they must not be counted as new build
    when testing the design against those zones."""
    fl, wl = C.blank(), C.blank()
    for _, _, rects, _ in D.ROOMS:
        for a, b, c, d in rects:
            C.put_rect(fl, a, b, c, d)
    for _n, _s, p, _note, _xy in poly_rooms():
        C.put_poly(fl, p)

    for x1, y1, x2, y2, t, ops in D.NEW_WALLS:
        L = math.hypot(x2 - x1, y2 - y1)
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        cuts = [0.0]
        for a, b in sorted(ops):
            cuts += [max(0.0, a), min(L, b)]
        cuts.append(L)
        for i in range(0, len(cuts) - 1, 2):
            a, b = cuts[i], cuts[i + 1]
            if b - a <= 1:
                continue
            ax_, ay_ = x1 + ux * a, y1 + uy * a
            bx_, by_ = x1 + ux * b, y1 + uy * b
            C.put_rect(wl, min(ax_, bx_) - (t / 2 if ux == 0 else 0),
                       min(ay_, by_) - (t / 2 if uy == 0 else 0),
                       max(ax_, bx_) + (t / 2 if ux == 0 else 0),
                       max(ay_, by_) + (t / 2 if uy == 0 else 0))
    # the two retained voids stay as holes in the deck, with their enclosures
    for a, b, c, d in D.VOID_KEEP:
        C.put_rect(fl, a, b, c, d, False)

    cx, cy, r, t, gaps = D.GALLERY
    for a in np.arange(0, 360, 0.5):
        if any(((g0 % 360) <= (a % 360) <= (g1 % 360)) if g0 % 360 <= g1 % 360
               else ((a % 360) >= (g0 % 360) or (a % 360) <= (g1 % 360))
               for g0, g1 in gaps):
            continue
        rad = math.radians(a)
        C.put_rect(wl, cx + math.cos(rad) * (r - t / 2) - C.CELL,
                   cy + math.sin(rad) * (r - t / 2) - C.CELL,
                   cx + math.cos(rad) * (r + t / 2) + C.CELL,
                   cy + math.sin(rad) * (r + t / 2) + C.CELL)
    return fl, wl, keep_wall_mask()
