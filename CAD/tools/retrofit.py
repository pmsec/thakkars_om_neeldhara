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


def _arc(cx, cy, r, a0, a1, n=90):
    return [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / n)) * r,
             cy + math.sin(math.radians(a0 + (a1 - a0) * i / n)) * r)
            for i in range(n + 1)]


def lobby_polys():
    """Kitchen, help's room and entry gallery.

    The gallery is a drum, and a drum in a rectangular pocket leaves four dead
    corners — 3.06 m2 of them.  So the drum's own wall is the boundary: the
    kitchen wraps it on the west and help's room on the east, and the corners
    become floor in those two rooms instead of waste in the gallery.
    """
    cx, cy, r, t, _gaps = D.GALLERY
    ro, ri = r + t / 2, r - t / 2

    # where the drum's outer face crosses the south wall of the service bay
    ay = math.degrees(math.asin((D.BAY_S - cy) / ro))          # 62.2 deg
    kw, ke = 7050, 16150                                       # outer room faces

    kitchen = ([(kw, D.BAY_N)] + _arc(cx, cy, ro, 270, 180 - ay)
               + [(kw, D.BAY_S)])
    helps = ([(ke, D.BAY_N)] + _arc(cx, cy, ro, 270, 360 + ay)
             + [(ke, D.BAY_S)])
    gallery = _arc(cx, cy, ri, 0, 360, 180)[:-1]
    return kitchen, helps, gallery


def poly_rooms():
    """Every room that is not a rectangle: (name, sub, polygon, note, label xy).

    The rectangular ones live in design.ROOMS; these are the pods, the great
    room, and the three rooms round the entry drum."""
    fam, den, great = pod_polys()
    kitchen, helps, gallery = lobby_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    return [
        ('FAMILY ROOM', '', fam, pod_note, (6550, 6250)),
        ('MUSIC + WORK DEN', '', den, pod_note, (D.M(6550), 6250)),
        ('GREAT ROOM', '', great, 'party wall removed  ·  7840 across', (D.MID, 3450)),
        ('KITCHEN', '', kitchen, 'on the builder stack  ·  wrapped round the drum',
         (8600, 9500)),
        ("HELP'S ROOM", '', helps, '', (14950, 9500)),
        ('ENTRY GALLERY', '', gallery, '2300 clear', (D.MID, 9825)),
    ]


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
