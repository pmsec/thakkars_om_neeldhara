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


RET = 260          # how far an enclosure may return past the corner of a shaft


def _shell_edges(bl_segs, zones):
    """Every line the shell is actually built along: the slab edge, plus the
    four sides of each shaft, duct and void."""
    edges = list(bl_segs)
    for a, b, c, d in zones:
        edges += [(a, b, c, b), (a, d, c, d), (a, b, a, d), (c, b, c, d)]
    return edges


def _clip_to_shell(x1, y1, x2, y2, edges):
    """Keep only the part of a builder wall that runs ALONG a shell edge.

    Being merely *near* one is not enough.  A partition that passes the corner
    of a duct sits within tolerance of the duct's edge for its whole length,
    so a plain proximity test kept the lot — and the surplus was drawn as a
    stray line with no wall to it, which is exactly what it was: a partition
    that was never built.  Returns the clipped segment, or None.
    """
    horiz, vert = abs(y2 - y1) < 1, abs(x2 - x1) < 1
    best = None
    for ex1, ey1, ex2, ey2 in edges:
        if horiz and abs(ey2 - ey1) < 1 and abs(y1 - ey1) < TOL:
            lo = max(min(x1, x2), min(ex1, ex2) - RET)
            hi = min(max(x1, x2), max(ex1, ex2) + RET)
            if hi - lo > 60 and (best is None or hi - lo > best[2] - best[0]):
                best = (lo, y1, hi, y1)
        elif vert and abs(ex2 - ex1) < 1 and abs(x1 - ex1) < TOL:
            lo = max(min(y1, y2), min(ey1, ey2) - RET)
            hi = min(max(y1, y2), max(ey1, ey2) + RET)
            if hi - lo > 60 and (best is None or hi - lo > best[3] - best[1]):
                best = (x1, lo, x1, hi)
    return best


def keep_demo():
    """Builder DA_WALL segments inside the home, split into keep and demo."""
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    bl_segs = [(bl[i][0], bl[i][1], bl[(i + 1) % len(bl)][0], bl[(i + 1) % len(bl)][1])
               for i in range(len(bl))]
    zones = [(a, b, c, d) for _, a, b, c, d, _ in C.NAMED] + list(D.VOID_KEEP)
    edges = _shell_edges(bl_segs, zones)

    segs, _ = frame.load_cad(x0=40000, y0=10000, x1=135000, y1=75000)
    keep, demo = [], []
    for lyr, x1, y1, x2, y2 in segs:
        if lyr not in ('DA_WALL', 'DA_Wall2'):
            continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if not (HOME[0] < mx < HOME[2] and HOME[1] < my < HOME[3]):
            continue
        clipped = _clip_to_shell(x1, y1, x2, y2, edges)
        (keep.append(clipped) if clipped else demo.append((x1, y1, x2, y2)))
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
    kitchen, helps, gallery = lobby_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    return [
        ('FAMILY ROOM', '', fam, pod_note, (6550, 6250)),
        ('MUSIC + WORK DEN', '', den, pod_note, (D.M(6550), 6250)),
        ('GREAT ROOM', '', great, 'party wall removed  ·  7840 across', (D.MID, 3450)),
        ('KITCHEN', '', kitchen,
         'kitchen and utility as one room  ·  the dry balcony is its utility end',
         (8700, 9500)),
        ("HELP'S ROOM", '', helps, '', (14900, 9500)),
        ('ENTRY GALLERY', '', gallery,
         'a U on the two columns  ·  3220 wide x 2450 deep  ·  230 throughout',
         (D.MID, 9750)),
    ]


def _gal_arc(r, a0, a1, n=60):
    cx, cy = D.GAL_CX, D.GAL_CY
    return [(cx + math.cos(math.radians(a)) * r, cy + math.sin(math.radians(a)) * r)
            for a in np.linspace(a0, a1, n)]


COL_N = D.COL_N               # top of the two 230 x 1800 gallery columns


def lobby_polys():
    """Kitchen, help's room and the entry gallery.

    The gallery is a U spanning column to column: two wood legs lining the
    columns, joined across the north by a semicircular end whose outer face is
    tangent to the service-bay north wall.  The two corners the curve leaves
    behind it, north of each column, are open to the kitchen and to help's
    room through the 800 the builder leaves above each column — so they are
    floor in those rooms, not waste.
    """
    r, t = D.GAL_R, D.T_GAL
    ro, ri = r + t / 2, r - t / 2
    kw, ke = 6900, 16150                   # far faces of the two rooms
    iw, ie = D.GAL_W + t, D.GAL_E - t      # inner faces of the two legs

    # the kitchen now includes the builder's dry balcony — one room, one area
    kitchen = ([(kw, D.BAY_N)] + _gal_arc(ro, 270, D._A0)
               + [(D.GAL_W, COL_N), (D.GAL_W, D.BAY_S), (kw, D.BAY_S),
                  (kw, 11025), (5705, 11025), (5705, 9470), (kw, 9470)])
    helps = ([(ke, D.BAY_N)] + _gal_arc(ro, 270, D._A1)
             + [(D.GAL_E, COL_N), (D.GAL_E, D.BAY_S), (ke, D.BAY_S)])
    gallery = ([(iw, D.BAY_S), (iw, COL_N)] + _gal_arc(ri, D._A0, D._A1)
               + [(ie, COL_N), (ie, D.BAY_S)])
    return kitchen, helps, gallery


def arch_haunches():
    """The springer blocks at the two ends of the arch.

    A segmental arch leaves its pier at 47 degrees off vertical, and its end is
    cut radially — square to the arc, not square to the leg.  So the slanted
    cut and the flat top of the leg cannot meet: it leaves a notch on the
    outside and a small overhang on the inside.  These two pieces fill that,
    which is exactly the springer stone a mason would cut.
    """
    cx, cy, r, t, _g = D.GALLERY
    ro, ri = r + t / 2, r - t / 2
    out = []
    # Each springer reaches 4 degrees INTO the arc, so it always overlaps
    # whatever the arc's own sampling actually drew and no hairline survives.
    # Its outer edge follows the arc's outer face rather than cutting the
    # corner off with a chord — a chord there is a visible nick.
    for th, (a, b, c, _d) in zip((D._A0 + 4, D._A1 - 4), D.GAL_LEGS):
        west = a < D.MID
        outer, inner = ((a, b), (c, b)) if west else ((c, b), (a, b))
        dx = outer[0] - cx                       # where the outer face of the
        dy = -math.sqrt(max(ro * ro - dx * dx, 0))   # arc crosses the leg's face
        th0 = math.degrees(math.atan2(dy, dx)) % 360
        u = math.radians(th)
        out.append([outer]
                   + _gal_arc(ro, th0, th, 24)
                   + [(cx + ri * math.cos(u), cy + ri * math.sin(u)), inner])
    return out


def arch_doors(leaf=60):
    """The three doors in the arch, drawn SHUT.

    Each leaf is curved on the same radius as the wall it sits in, so with the
    doors closed the arch reads as one continuous sweep and the U is whole.
    A leaf curved to a 2370 radius cannot swing — it has to slide on the face
    of the arc — so no swing is drawn; the leaf is shown where it lives.
    """
    cx, cy, r, t, gaps = D.GALLERY
    out = []
    for a0, a1 in gaps:
        if (a1 - a0) % 360 > 60:          # the big gap below the springings
            continue
        ang = np.linspace(a0, a1, 40)
        inner = [(cx + math.cos(math.radians(a)) * (r - leaf / 2),
                  cy + math.sin(math.radians(a)) * (r - leaf / 2)) for a in ang]
        outer = [(cx + math.cos(math.radians(a)) * (r + leaf / 2),
                  cy + math.sin(math.radians(a)) * (r + leaf / 2))
                 for a in reversed(ang)]
        out.append(inner + outer)
    return out


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

    for x1, y1, x2, y2, t, ops in list(D.NEW_WALLS) + list(D.SCREEN_WALLS):
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
