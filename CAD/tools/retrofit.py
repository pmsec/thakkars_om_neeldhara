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
    """Bezier of any degree, by de Casteljau — the pod glazing is a cubic now,
    because a quadratic cannot be narrow where the great room wants width and
    wide where the pod needs it."""
    pts = list(P)
    while len(pts) > 1:
        pts = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1])
               for a, b in zip(pts, pts[1:])]
    return pts[0]


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
    great = west_curve + gal_apse() + list(reversed(east_curve))
    return fam, den, great


def gal_apse():
    """The gallery's apse, as it bites into the great room's south edge.

    Empty when the arch stays south of the great room, which is what a
    shallower one would do."""
    ro = D.GAL_RO
    if D.GAL_CY - ro >= D.BODY_S:
        return []
    x = D.gal_cross(D.BODY_S)
    a0 = D._ang(x, D.BODY_S)
    return _gal_arc(ro, a0, 540 - a0)


def poly_rooms():
    """Every room that is not a rectangle: (name, sub, polygon, note, label xy).

    The rectangular ones live in design.ROOMS; these are the two pods and the
    great room, which are cut by the pod glazing curves."""
    fam, den, great = pod_polys()
    kitchen, helps, gallery, wc, store = lobby_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    return [
        ('GUEST / SERVICE WC', '', wc, '', (16620, 9760)),
        ('STORE', '', store, '', (18200, 10250)),
        ('FAMILY ROOM', '', fam, pod_note, (6550, 6250)),
        ('MUSIC + WORK DEN', '', den, pod_note, (D.M(6550), 6250)),
        ('GREAT ROOM', '', great,
         'party wall removed  ·  6250 at the deck, 8220 at the waist, 7280 at the pods',
         (D.MID, 3450)),
        ('KITCHEN', '', kitchen,
         'kitchen and utility as one room  ·  the dry balcony is its utility end',
         (8700, 9500)),
        ("HELP'S ROOM", '', helps, '', (14780, 9150)),
        ('ENTRY GALLERY', '', gallery,
         'a U on the two columns  ·  3220 wide x 3260 deep  ·  '
         'semicircular apse, 230 throughout',
         (D.MID, 9950)),
    ]


# ------------------------------------------------- the guest WC's arched wall
def wc_pt(u, off=0.0):
    """A point on the WC apse, offset normal to itself.

    u runs 0 (springing, on the great-room wall) to 1 (where it dies into the
    east wall).  off > 0 is away from the corner the ellipse is struck from —
    help's room's side and the store's."""
    th = u * math.pi / 2
    c, s = math.cos(th), math.sin(th)
    x, y = D.WC_CX - D.WC_A * c, D.WC_CY + D.WC_B * s
    nx, ny = -c / D.WC_A, s / D.WC_B          # outward normal of the ellipse
    m = math.hypot(nx, ny)
    return x + off * nx / m, y + off * ny / m


def wc_pts(off=0.0, n=90):
    return [wc_pt(u, off) for u in np.linspace(0, 1, n)]


def wc_wall():
    """The apse as filled bands, with help's room's door taken out of it."""
    h = D.T_WC / 2
    runs, cur = [], []
    for u in np.linspace(0, 1, 200):
        if D.WC_DOOR[0] <= u <= D.WC_DOOR[1]:
            if len(cur) > 1:
                runs.append(cur)
            cur = []
        else:
            cur.append(u)
    if len(cur) > 1:
        runs.append(cur)
    return [[wc_pt(u, -h) for u in run] + [wc_pt(u, h) for u in reversed(run)]
            for run in runs]


def wc_console(u0=0.0, u1=0.38, d0=120, d1=400, grow=0.20, fade=0.10):
    """The curved console at the WC door, with the basin set into it.

    A straight vanity in an apse is a lie: it touches the wall at one point and
    gaps either side of it.  This one is struck off the same ellipse, offset
    inwards, so it sits on the wall for its whole length.  The offset is safe —
    400 against a radius of curvature of 1154 at the springing, which is the
    tightest the apse ever gets.

    It GROWS out of the wall rather than starting at full depth.  It begins at
    the door jamb, and at 400 deep there it would leave only 425 of the 800
    door to walk through; as a 120 ledge it leaves 645, and it is at full depth
    by the time it reaches the bowl.  So the basin is the first thing your hand
    reaches and there is still a door to walk through."""
    h = D.T_WC / 2
    us = list(np.linspace(u0, u1, 60))

    def dep(u):                                          # out of the wall, and
        s = min(1.0, (u - u0) / grow, (u1 - u) / fade)   # back into it again
        return d0 + (d1 - d0) * s * s * (3 - 2 * s)      # smoothstep

    band = ([wc_pt(u, -h) for u in us]
            + [wc_pt(u, -h - dep(u)) for u in reversed(us)])
    bx, by = wc_pt(0.24, -h - 210)
    return [('poly', band, 'solid'), ('circle', bx, by, 172, 'light')]


def wc_out_door(hinge=15020, jamb=15820, y=8400):
    """The guest WC's door off the great room, hinged west, swinging OUT.

    Every other door on this drawing is a gap in a wall, because which way it
    swings does not change the plan.  This one does.  The apse has no floor to
    spare for a leaf inside it, and the door is there so you can step in, wash
    your hands and step out — so it opens into the great room, and it is drawn
    that way rather than left to the joiner to guess."""
    w = jamb - hinge
    arc = [(hinge + w * math.cos(math.radians(t)), y - w * math.sin(math.radians(t)))
           for t in np.linspace(90, 0, 24)]
    return [('poly', [(hinge, y)] + arc, 'light'),
            ('line', hinge, y, hinge, y - w, 'solid')]


def wc_door(leaf=60):
    """Help's room's door into the WC, curved on the apse and drawn shut."""
    us = np.linspace(*D.WC_DOOR, 30)
    return [[wc_pt(u, -leaf / 2) for u in us]
            + [wc_pt(u, leaf / 2) for u in reversed(us)]]


def _gal_arc(r, a0, a1, n=60):
    cx, cy = D.GAL_CX, D.GAL_CY
    return [(cx + math.cos(math.radians(a)) * r, cy + math.sin(math.radians(a)) * r)
            for a in np.linspace(a0, a1, n)]


COL_N = D.COL_N               # top of the two 230 x 1800 gallery columns


def lobby_polys():
    """Kitchen, help's room and the entry gallery.

    The gallery is a U spanning column to column: two legs lining the columns,
    closed across the north by a semicircular apse springing off the top of
    each one.  The apse projects past the service-bay line into the great room,
    so the kitchen and help's room each run up to it along that line and then
    follow it down to their column — the corners north of each column are
    floor in those rooms, through the 800 the builder leaves above the column,
    not waste.
    """
    r, t = D.GAL_R, D.T_GAL
    ro, ri = D.GAL_RO, D.GAL_RI
    kw = 6900                              # far face of the kitchen
    sw = D.STORE_W - D.T_THIN / 2          # store's west face, 16345
    iw, ie = D.GAL_W + t, D.GAL_E - t      # inner faces of the two legs

    # the kitchen now includes the builder's dry balcony — one room, one area
    kitchen = ([(kw, D.BAY_N)] + _gal_arc(ro, D._BN0, D._A0)
               + [(D.GAL_W, COL_N), (D.GAL_W, D.BAY_S), (kw, D.BAY_S),
                  (kw, 11025), (5705, 11025), (5705, 9470), (kw, 9470)])
    gallery = ([(iw, D.BAY_S), (iw, COL_N)] + _gal_arc(ri, D._A0, D._A1)
               + [(ie, COL_N), (ie, D.BAY_S)])

    # Help's room and the store both run round the OUTSIDE of the WC's apse;
    # the WC is what is left inside it.  Splitting the outside at the store's
    # west face is what gives the two of them their curved wall each.
    out = wc_pts(D.T_WC / 2)
    h_arc = [p for p in out if p[0] <= sw]
    s_arc = [p for p in out if p[0] >= sw]
    helps = ([h_arc[0]] + _gal_arc(ro, D._BN1, D._A1)
             + [(D.GAL_E, COL_N), (D.GAL_E, D.BAY_S), (sw, D.BAY_S),
                (sw, h_arc[-1][1])] + list(reversed(h_arc)))
    store = (s_arc + [(D.WC_CX, D.WC_DIE + D.T_WC / 2), (17580, 10255),
                      (17580, 9550), (18825, 9550), (18825, D.BAY_S),
                      (sw, D.BAY_S), (sw, s_arc[0][1])])
    wc = ([(D.WC_CX, D.BAY_N), (D.WC_CX, D.WC_DIE - D.T_WC / 2)]
          + list(reversed(wc_pts(-D.T_WC / 2))))
    return kitchen, helps, gallery, wc, store


def arch_haunches():
    """The springer blocks at the two ends of the arch.

    A segmental arch leaves its pier at an angle, and its end is cut radially —
    square to the arc, not square to the leg — so the slanted cut and the flat
    top of the leg cannot meet: a notch outside, an overhang inside.  These two
    pieces fill that, which is the springer stone a mason would cut.

    A semicircle springs vertically and the radial cut is horizontal, so there
    is nothing to fill — and now that the first 26 degrees of arc either side is
    the service door's opening, a patch there is not merely redundant, it is a
    fragment of wall standing in a doorway.  So: none, while the arch is a
    semicircle.  The code stays for a sag pulled back off the half-span, which
    is the case that needs them.
    """
    if abs(D.GAL_CY - D.COL_N) < 1:
        return []
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
        th0 = math.degrees(math.atan2(dy, dx))
        while th - th0 > 180:            # take the short way round to th, or
            th0 += 360                   # the east springer sweeps 356 degrees
        while th0 - th > 180:            # and fills the whole drum
            th0 -= 360
        u = math.radians(th)
        out.append([outer]
                   + _gal_arc(ro, th0, th, 24)
                   + [(cx + ri * math.cos(u), cy + ri * math.sin(u)), inner])
    return out


def gal_swing_doors(leaf=40):
    """The two service doors: hinged glass, swinging into the gallery.

    Not sliding.  A pocket needs a cavity as long as the leaf and in line with
    it, and the 800 ahead of each column has nothing beyond either end — the
    great room north, the structural column south.  Split for a pocket it gives
    400 clear, or about 550 with a three-panel telescopic, against 750 on
    hinges.  On a serving door the width wins.

    Hinged at the column top and opening INTO the gallery, which is 3220 x 3260
    of circulation with nothing in it.  The far side is the kitchen's approach
    to its counter end and help's room's landing, where a leaf standing open
    would cost something.  And coming out of the kitchen with your hands full
    you push, which is the way you want a serving door to go.
    """
    w, h = COL_N - D.BAY_N, leaf / 2
    out = []
    for hx, sgn in ((D.GAL_W + D.T_GAL / 2, 1), (D.GAL_E - D.T_GAL / 2, -1)):
        arc = [(hx + sgn * w * math.sin(math.radians(t)),
                COL_N - w * math.cos(math.radians(t)))
               for t in np.linspace(0, 90, 28)]
        out.append(('poly', [(hx, COL_N)] + arc, 'light'))
        out.append(('poly', [(hx, COL_N - h), (hx + sgn * w, COL_N - h),
                             (hx + sgn * w, COL_N + h), (hx, COL_N + h)], 'glass'))
    return out


def arch_doors(leaf=60):
    """The door on the axis, drawn SHUT.

    Its leaf is curved on the same radius as the wall it sits in, so closed,
    the arch reads as one continuous sweep.  A leaf curved to 1725 cannot swing
    — the far edge would drive into the wall — so it slides on the face of the
    arc, and no swing is drawn.

    Only this one.  The two service doors used to be curved leaves too; they
    are straight glass sliders now and live in gal_sliders().
    """
    cx, cy, r, t, gaps = D.GALLERY
    out = []
    for a0, a1 in gaps:
        if (a1 - a0) % 360 > 60:          # the big gap below the springings
            continue
        if abs(((a0 + a1) / 2) % 360 - 270) > 30:      # not on the axis
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
    for q in wc_wall():
        C.put_poly(wl, q)
    return fl, wl, keep_wall_mask()
