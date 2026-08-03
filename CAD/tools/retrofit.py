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
    bath, suite = suite_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    suite_note = 'one room  ·  bed + dressing, joinery to be designed'
    bath_note = 'arched wall  ·  1930 clear'
    return [
        ('MASTER SUITE', 'PARENTS', suite, suite_note, (1150, 4200)),
        # not the mirror of the parents' anchor any more: that point is inside
        # Karan's bed.  His label sits in the open floor west of it.
        ('MASTER SUITE', 'KARAN', mirror_poly(suite), suite_note, (21300, 4400)),
        ("PARENTS' BATH", '', bath, bath_note, (3140, 7750)),
        ("KARAN'S BATH", '', mirror_poly(bath), bath_note, (D.M(3140), 7750)),
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


# ------------------------------------------------ the master baths' sweep
def mb_pt(u, off=0.0):
    """A point on the master bath's sweep, offset normal to itself.

    u runs -1 at the pod wall, through 0 at the crown, to +1 where the curve
    has finished turning and becomes the straight west wall.  Past -1 it keeps
    going, which is what lets each face be cut square on the pod wall instead
    of stopping wherever the offset happens to land.  off > 0 is INTO the bath
    — south over the crown, east down the west flank.

    Two quadrants, not one: a single ellipse cannot put its crown 1240 in from
    one end and 690 from the other.  They share a horizontal tangent at the
    crown, so the join does not read."""
    if u <= 0:                                   # east flank, off the pod wall
        th = -u * math.asin((D.MB_XE - D.MB_CX) / D.MB_AE)
        c, s = math.cos(th), math.sin(th)
        x, y = D.MB_CX + D.MB_AE * s, D.MB_CY + D.MB_BE * (1 - c)
        tx, ty = D.MB_AE * c, D.MB_BE * s        # d/dth, pointing east-south
        nx, ny = -ty, tx                         # left of it = into the bath
    else:                                        # west flank, a quarter circle
        ph = u * math.pi / 2
        c, s = math.cos(ph), math.sin(ph)
        x, y = D.MB_CX - D.MB_RW * s, D.MB_CY + D.MB_RW * (1 - c)
        tx, ty = -D.MB_RW * c, D.MB_RW * s       # d/dph, pointing west-south
        nx, ny = ty, -tx                         # right of it = into the bath
    m = math.hypot(nx, ny)
    return x + off * nx / m, y + off * ny / m


def mb_u_at_wall(off):
    """u where the sweep's `off` face crosses the pod wall.

    Bisection rather than algebra: the offset of an ellipse is not an ellipse,
    so there is nothing to solve in closed form.  x falls as u rises."""
    lo, hi = -1.6, 0.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if mb_pt(mid, off)[0] > D.MB_XE:
            lo = mid
        else:
            hi = mid
    return hi


def mb_pts(off=0.0, n=140):
    """The `off` face, from the pod wall round to where it turns vertical."""
    return [mb_pt(u, off) for u in np.linspace(mb_u_at_wall(off), 1.0, n)]


def mb_wall():
    """The sweep as one filled band, cut square on the pod wall."""
    h = D.T_MB / 2
    return [mb_pts(h) + list(reversed(mb_pts(-h)))]


MB_CAB = 800            # the cupboard at the west end, measured along the arc


def mb_dep(u, d_e=520, d_w=340, u_e=-1.0, u_w=1.0):
    """How far the console stands off the wall at u.

    It cannot run at one depth.  520 is right at the basin end, where the east
    flank's radius of curvature never drops below 1500 — but the west flank is
    a 690 inner radius, and 520 into that leaves 170 and closes the corner off
    to a point.  So it eases, over its whole length, to 340 at the foot: one
    unbroken taper rather than a deep bit and a thin bit, and it still leaves
    350 of radius at the tightest part of the turn.  The cupboard at the end
    picks up the same face, so the whole run is flush."""
    s = min(1.0, max(0.0, (u_w - u) / (u_w - u_e)))
    return d_w + (d_e - d_w) * s * s * (3 - 2 * s)              # smoothstep


def mb_u_from_end(run, n=600):
    """u that is `run` back from the foot of the arc, measured along the wall."""
    h = D.T_MB / 2
    us = np.linspace(mb_u_at_wall(h), 1.0, n)
    pts = [mb_pt(u, h) for u in us]
    d = 0.0
    for i in range(n - 1, 0, -1):
        d += math.dist(pts[i], pts[i - 1])
        if d >= run:
            return us[i - 1]
    return us[0]


def mb_console(mir=55):
    """The arched vanity and the mirror over it, both struck off the sweep.

    Karan asked for the vanity in the arc, and this is the only honest way to
    do it: a straight top against a curved wall touches it at one point and
    gaps either side.  This one is the same curve offset inwards, so it beds on
    the wall for its whole length.

    It runs from the pod wall to where the cupboard takes over at the west end
    of the arc — see mb_dep for why the depth eases along the way, and
    mb_shelves for the unit that carries the same face on down the duct wall.

    The mirror is the same curve again, a 55 band on the wall face, running the
    full length of the console — so what you face at the basin is a mirror that
    wraps with the room instead of a flat sheet fighting it.  It stops where
    the console does: there is no mirroring the front of a cupboard."""
    h = D.T_MB / 2
    u0, u1 = mb_u_at_wall(h), mb_u_from_end(MB_CAB)
    us = list(np.linspace(u0, u1, 160))

    back = [mb_pt(u, h) for u in us]
    band = back + [mb_pt(u, h + mb_dep(u)) for u in reversed(us)]
    glass = back + [mb_pt(u, h + mir) for u in reversed(us)]
    bx, by = mb_pt(u0 + 0.36, h + 300)   # 100 clear of the wall behind it
    return [('poly', band, 'solid'), ('circle', bx, by, 200, 'light'),
            ('poly', glass, 'glass')]


def mb_cabinet(door=55):
    """The wall cabinet at the west end of the arc, running to its foot.

    The last MB_CAB of the arc is a cupboard rather than open console: it is
    the end of the run, it is out of the wet zone, and it is the one stretch
    where nothing else wants the wall.  Same face as the console beside it, so
    the two read as one length of joinery with a door at the end of it — the
    inner line is that door."""
    h = D.T_MB / 2
    us = list(np.linspace(mb_u_from_end(MB_CAB), 1.0, 60))
    back = [mb_pt(u, h) for u in us]
    return [('poly', back + [mb_pt(u, h + mb_dep(u)) for u in reversed(us)],
             'solid'),
            ('poly', [mb_pt(u, h + mb_dep(u) - door) for u in us]
             + [mb_pt(u, h + mb_dep(u)) for u in reversed(us)], 'light')]


def mb_shelves(y_end=7500, taper=33):
    """The linen shelves at the pod-wall end, carrying the console on down.

    The console's end cut IS this unit's top, so the two read as one run of
    joinery turning out of the arc and down the duct wall.  433 deep at the top
    easing to 400, 822 along the wall, and it stops 120 short of the pan.  It
    is the only piece here with a shelf in it: towels, bath mats, the things a
    bathroom has to keep and a vanity has nowhere for."""
    h = D.T_MB / 2
    u0 = mb_u_at_wall(h)
    back, front = mb_pt(u0, h), mb_pt(u0, h + mb_dep(u0))
    fx, fy = front
    poly = [back, front, (fx + taper, y_end), (D.MB_XE, y_end)]
    out = [('poly', poly, 'solid')]
    for k in (1, 2):                                   # shelf dividers
        t = k / 3
        x_, y_ = fx + taper * t, fy + (y_end - fy) * t
        out.append(('line', x_, y_, D.MB_XE, y_, 'light'))
    return out


def mb_door(door=None, hinge='S'):
    """The bath door, drawn open into the room.  Always in the WEST frame; the
    east one is the mirror of it, with its own opening.

    Almost every door on this drawing is left as a gap in a wall, because which
    way it swings does not change the plan.  This one is drawn because Karan
    asked to see it work.

    The parents' one hinges SOUTH, so the leaf falls back along the wall it is
    in and clears the run from the door to the shower.  Karan's cannot: his
    door has moved down until its south jamb is flush with the shower screen,
    and a south hinge there would swing the leaf straight across the way into
    the shower.  So his hinges NORTH, and the leaf opens back along the same
    line his dressing screen runs on outside."""
    door = D.MB_DOOR if door is None else door
    y0, y1 = D.MB_YW + door[0], D.MB_YW + door[1]
    w, x = y1 - y0, D.MB_XW
    p, sgn = (y1, -1) if hinge == 'S' else (y0, 1)      # pivot, and which way
    arc = [(x + w * math.cos(math.radians(t)), p + sgn * w * math.sin(math.radians(t)))
           for t in np.linspace(0, 90, 28)]
    return [('poly', [(x, p)] + arc, 'light'),
            ('line', x, p, x + w, p, 'solid')]


def arch_console(dep=400, n=140, over=900, over_d=250, grow=0.42):
    """The console that curls round the OUTSIDE of the bath's arch.

    Written in the WEST frame like everything else on this sweep; it is drawn
    mirrored, because it is Karan's only.

    The bath's arch is the best wall in the bedroom and it had nothing on it.
    This runs the whole of it — off the pod partition, over the crown, down the
    straight tail, and dead into the dressing partition — struck as an offset of
    the sweep's own outer face, so it beds on the curve for its whole length
    the way the vanity does on the inside.

    Offsetting OUTWARD from a convex curve only ever increases the radius, so
    unlike the vanity inside there is no depth at which this one folds on
    itself: 400 is a choice, not a limit.

    It TAPERS TO NOTHING at the pod wall, over 626 of arc, and that is not
    decoration.  Cut square there instead, the console ends in a 400 blunt face
    standing in the doorway to the pod — and worse, offsetting outward at the
    springing throws the front face straight THROUGH that wall, so a naive
    square cut overhangs into the pod.  Running the depth out to zero solves
    both: the two faces meet at a point exactly on the wall, and there is
    nothing left to collide with.

    Cupboards under it the whole way; one wall cabinet over the straight tail at
    the partition end, drawn dashed because it is over, not in plan.  The top is
    for the art and the plants."""
    h = D.T_MB / 2
    u0 = mb_u_at_wall(-h)
    us = list(np.linspace(u0, 1.0, n))

    def d(u):                       # nothing at the pod wall, full depth by 626
        t = min(1.0, (u - u0) / grow)
        return dep * t * t * (3 - 2 * t)                        # smoothstep

    back = [mb_pt(u, -h) for u in us]
    front = [mb_pt(u, -h - d(u)) for u in us]
    ys, xb = D.SCR_Y - D.T_SCR, D.MB_XW - D.T_MB      # 7675, 2325
    return [('poly', back + [(xb, ys), (xb - dep, ys)] + list(reversed(front)),
             'solid'),
            ('rect', xb - over_d, ys - over, xb, ys, 'dash')]


def suite_screen():
    """Karan's dressing screen — brown tinted glass, in the EAST frame.

    It runs on the line of his bath door's north jamb, from the bath wall to
    the end wall, and it turns the south strip of his suite into one private
    place: the wardrobes, the 1070 you need in front of them to open a door and
    stand, and the way into the bath, all behind glass you cannot see through
    from the bed.

    Tinted rather than clear because the point is privacy, and glass rather than
    solid because the strip has no window of its own — every bit of its light
    comes through this pane.  But not glass all the way down: the bed's head
    backs on to it, so the bottom is a wood dado and only above the headboard
    does it become glass.  Both are drawn, the glass as an inset band inside
    the wood one: one line on plan, two materials up it.

    One fixed pane, stopping SCR_GAP short of the end wall.  The gap is the way
    in — no leaf, no track — and it is also the aperture that throws the end
    wall's window light across the strip onto the dresser mirror square opposite
    it, 1615 away."""
    y1, t, g = D.SCR_Y, D.T_SCR, D.SCR_GAP      # y1 is the SOUTH face
    y0 = y1 - t
    w, e = D.M(D.MB_XW - D.T_MB), D.END_E - 150

    def band(a, b, lo, hi, style):
        return ('poly', [(a, lo), (b, lo), (b, hi), (a, hi)], style)

    # the wood dado at full thickness, and the tinted glass over it drawn as an
    # inset band — one line on plan, two materials up it
    return [band(w, e - g, y0, y1, 'wood'),
            band(w, e - g, y0 + t / 3, y1 - t / 3, 'tint')]


def suite_polys():
    """(bath, suite) for the west end.  Mirror them for the east.

    The sweep is the whole boundary between the two, so neither is a rectangle
    any more: the bath is what is south-east of it, the suite is everything
    else in the wing."""
    inner, outer = mb_pts(D.T_MB / 2), mb_pts(-D.T_MB / 2)
    bath = (inner + [(D.MB_XW, D.WING_S), (D.MB_XE, D.WING_S)])
    suite = ([(D.END_W + 150, 1350), (D.MB_XE, 1350)] + outer
             + [(D.MB_XW - D.T_MB, D.WING_S), (D.END_W + 150, D.WING_S)])
    return bath, suite


def mirror_poly(p):
    return [(D.M(x), y) for x, y in reversed(p)]


def mirror_prim(p):
    """The mirror of one drawing primitive, about the centre of the home."""
    if p[0] == 'poly':
        return ('poly', mirror_poly(p[1]), p[2])
    if p[0] == 'circle':
        return ('circle', D.M(p[1]), p[2], p[3], p[4])
    if p[0] == 'line':
        return ('line', D.M(p[1]), p[2], D.M(p[3]), p[4], p[5])
    if p[0] == 'rect':
        return ('rect', D.M(p[3]), p[2], D.M(p[1]), p[4], p[5])
    raise ValueError(p[0])


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


def suite_sliders(t=60):
    """The partition between each master bed and its pod, drawn in BOTH states.

    3555 of opening, Y 2620 to 6175.  Two interlocking leaves of 1778.  One leaf
    would need 3555 of parking and the deck is 2620 deep, which is why there are
    two: stacked they take 1778.

    The two sides are drawn differently on purpose, so the plan shows how they
    work without a note.  The parents' pair is SHUT, closing the bed off from
    the pod, with the parked position dashed on the deck.  Karan's pair is OPEN
    and stacked on the deck behind the spa, with the shut position dashed across
    the opening.

    They run on the POD FACE of the wall line, X 4540-4600, not on its
    centreline.  They have to: a builder column 230 x 1200 sits at X 4300-4530 /
    Y 1200-2400, square on the route north, and only a track east of 4530 gets
    past it.  Ten millimetres of clearance, and the panels read flush with the
    wall's own east face at 4529.  The deck's south glazing starts at 4650 for
    the same reason — the panels pass through that line.
    """
    x0, mid = 4600, (2620 + 6175) / 2
    out = []
    for west, shut in ((True, True), (False, False)):
        def X(v):
            return v if west else D.M(v)

        def box(a, b, y0, y1, style):
            return ('poly', [(X(a), y0), (X(b), y0), (X(b), y1), (X(a), y1)], style)

        leaves = [box(x0 - t, x0, 2620, mid, 'glass' if shut else 'dash'),
                  box(x0 - t, x0, mid, 6175, 'glass' if shut else 'dash')]
        # Parked: the two leaves stacked behind each other, 1778 of the deck.
        # They stop as soon as they are clear of the opening — leading edge
        # flush with the pod's north face at 2620 — rather than running on to
        # the parapet.  They only have to get out of the way, and the deck
        # beyond them is deck, not a garage.
        p1, p0 = 2620, 2620 - (6175 - mid)
        park = [box(x0 - t, x0, p0, p1, 'dash' if shut else 'glass'),
                box(x0, x0 + t, p0, p1, 'dash' if shut else 'glass')]
        out += leaves + park
    return out

def corner_units():
    """The mandir and the coffee / pantry.  They no longer share a shape.

    The MANDIR is a corner unit: it fills the corner between the retained
    void's back wall and the pod glazing, flush into both, and its front is an
    arch.  That corner is 40.5 degrees, not 90 — the glazing leaves it heading
    south-west — so the unit is a wedge.  Which is what a shrine wants: the
    idol stands deep in it and you see it through the arch, and the point
    behind it is the back of the niche rather than dead worktop.

    The PANTRY is a straight run, the exact length of the void's back wall and
    flush with it — 1615, its far end following the glazing.  It was an L, and
    the corner of that L was the awkward part: the fittings were spread over
    two 1200 legs and the longest clear stretch of counter was 300.  In one
    line it is 515.

    Everything is built on the west pod and mirrored for the east.
    """
    P = D.POD_W
    cx0, cy0 = P[0][0], D.BODY_N                    # the corner: 9115, 2620
    ys = list(np.linspace(cy0, cy0 + 3200, 320))
    glass = [(bez_x(P, y), y) for y in ys]
    cum = [0.0]
    for a, b in zip(glass, glass[1:]):
        cum.append(cum[-1] + math.dist(a, b))

    def glass_at(dist):
        return next((g for g, s in zip(glass, cum) if s >= dist), glass[-1])

    def glass_to(dist):
        return [g for g, s in zip(glass, cum) if s <= dist]

    # ------------------------------------------------------------- mandir
    LEG, SAG, FRAME = 1200, 200, 70
    A, B = (cx0 - LEG, cy0), glass_at(LEG)
    ax, ay = (A[0] + B[0]) / 2 - cx0, (A[1] + B[1]) / 2 - cy0
    an = math.hypot(ax, ay)
    ax, ay = ax / an, ay / an                       # corner -> front, the axis

    def arch(a, b, sag):
        c = ((a[0] + b[0]) / 2 + ax * 2 * sag, (a[1] + b[1]) / 2 + ay * 2 * sag)
        return [bez((a, c, b), t) for t in np.linspace(0, 1, 44)]

    front = arch(B, A, SAG)
    # the arched surround, offset along the curve's OWN normal — offsetting
    # along the axis instead pushes the ends past the two walls it sits in
    inner = []
    for i, (x, y) in enumerate(front):
        a2, b2 = front[max(i - 1, 0)], front[min(i + 1, len(front) - 1)]
        tx, ty = b2[0] - a2[0], b2[1] - a2[1]
        tn = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / tn, tx / tn
        if (cx0 - x) * nx + (cy0 - y) * ny < 0:     # point it at the corner
            nx, ny = -nx, -ny
        inner.append((x + nx * FRAME, y + ny * FRAME))
    out = [('poly', [A, (cx0, cy0)] + glass_to(LEG) + front, 'solid'),
           ('poly', front + list(reversed(inner)), 'soft')]
    px, py = -ay, ax                                # across the wedge
    # the idol platform, 480 x 340, square to the axis and standing 850 back
    # from the corner: 20 off the glass, 73 off the void wall, 130 off the arch
    c, W, H = (cx0 + ax * 850, cy0 + ay * 850), 240, 170
    out.append(('poly', [(c[0] + px * W - ax * H, c[1] + py * W - ay * H),
                         (c[0] + px * W + ax * H, c[1] + py * W + ay * H),
                         (c[0] - px * W + ax * H, c[1] - py * W + ay * H),
                         (c[0] - px * W - ax * H, c[1] - py * W - ay * H)],
                'solid'))
    for k in (-1, 1):                               # a diya each side, in front
        out.append(('circle', cx0 + ax * 1120 + px * k * 180,
                    cy0 + ay * 1120 + py * k * 180, 78, 'light'))

    # ------------------------------------------------------------- pantry
    DEP = 600
    far = D.VOID_KEEP[0][0]                         # 7500, the void's far end
    run = ([(cx0, cy0), (far, cy0), (far, cy0 + DEP)]
           + [g for g in reversed(glass_to(cum[-1])) if g[1] <= cy0 + DEP])
    # The run is 1615 along the back wall but only 1051 along the front — the
    # glazing leans away from it — so full 600 depth starts 563 in.  An
    # appliance only wants 400 of that, which it has from 563 - 120 = 443 in;
    # the fittings are set out off THAT line, not off the back wall's length.
    # What is left at the glass end is a shelf that tapers to nothing: cups and
    # jars, not machines.
    pan = [('poly', run, 'solid'),
           ('rect', 7540, 2680, 7940, 3000, 'light'),      # sink 400 x 320
           ('circle', 7740, 2840, 150, 'light'),
           ('rect', 8340, 2680, 8660, 3000, 'solid')]      # the machine, 320
    out += [_mirror_prim(q) for q in pan]
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
    for q in wc_wall() + mb_wall() + [mirror_poly(q_) for q_ in mb_wall()]:
        C.put_poly(wl, q)
    return fl, wl, keep_wall_mask()
