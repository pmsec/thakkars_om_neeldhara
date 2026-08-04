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
    # The great room's south edge is not one straight line any more: the
    # kitchen's bump takes a 300 bite out of its western half, from the pod
    # glazing across to the apse.  Nothing comes out of the eastern half — the
    # planter that answers the bump is furniture standing on this floor, not a
    # room taken out of it, so the boundary there stays on BODY_S.
    great = (west_curve + [(D.KIT_BUMP_W, D.KIT_N)]
             + gal_apse() + list(reversed(east_curve)))
    return fam, den, great


def gal_apse():
    """The gallery's apse, as it bites into the great room's south edge.

    Lopsided, and it has to be: the kitchen's bump meets the arch at KIT_N on
    the west while help's room still meets it at BODY_S on the east, so the
    two ends of this arc are 300 apart in y.

    Empty when the arch stays south of the great room, which is what a
    shallower one would do."""
    ro = D.GAL_RO
    if D.GAL_CY - ro >= D.KIT_N:
        return []
    return _gal_arc(ro, D._ang(D.gal_cross(D.KIT_N), D.KIT_N),
                    540 - D._ang(D.gal_cross(D.BODY_S), D.BODY_S))


def rect_room_area(name, rects):
    """Area of a rectangular room in m2, with the deck's holes taken out.

    The two retained deck voids are holes in the deck, not floor.  They have to
    come off in EVERY consumer or the drawing contradicts itself — and it did:
    the sheet printed 40.4 m2 / 435 sq ft for the deck under a note that read
    'net of the two retained voids', while verify.py printed 35.8 / 385.  Same
    rule as the dimensions: one computation, so the label and the geometry
    cannot disagree.
    """
    a = sum((c - x) * (d - y) for x, y, c, d in rects) / 1e6
    if 'DECK' in name:
        a -= sum((c - x) * (d - y) for x, y, c, d in D.VOID_KEEP) / 1e6
    return a


def poly_rooms():
    """Every room that is not a rectangle: (name, sub, polygon, note, label xy).

    The rectangular ones live in design.ROOMS; these are the two pods and the
    great room, which are cut by the pod glazing curves."""
    fam, den, great = pod_polys()
    kitchen, helps, gallery, wc, store = lobby_polys()
    bath, suite = suite_polys()
    pod_note = 'one pod  ·  glass roof over the 3665 x 2280 bay'
    suite_note = 'one room  ·  bed + dressing, joinery to be designed'
    par_note = ('two zones  ·  bed north of the partition, '
                'dressing + wall bed south of it')
    bath_note = 'arched wall  ·  1930 clear'
    return [
        ('MASTER SUITE', 'PARENTS', suite, par_note, (3100, 3500)),
        # not the mirror of the parents' anchor any more: that point is inside
        # Karan's bed.  His label sits in the open floor west of it.
        ('MASTER SUITE', 'KARAN', mirror_poly(suite), suite_note, (21300, 4400)),
        ("PARENTS' BATH", '', bath, bath_note, (3140, 7750)),
        ("KARAN'S BATH", '', mirror_poly(bath), bath_note, (D.M(3140), 7750)),
        ('GUEST / SERVICE WC', '', wc, '', (16620, 9760)),
        ('STORE', '', store, '', (18200, 10250)),
        ('FAMILY ROOM', '', fam, pod_note, (6550, 6250)),
        # not the mirror of the family room's anchor: that point is on the
        # drummer's throne, and the open north half is the sofa's now.  What is
        # left is the band between the sofa's back and the kit.
        ('MUSIC + WORK DEN', '', den, pod_note, (18600, 5100)),
        ('GREAT ROOM', '', great,
         'party wall removed  ·  6250 at the deck, 8220 at the waist, 7280 at the pods',
         (D.MID, 3000)),
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


def arch_console(dep=400, dep_end=250, n=140, over=900, over_d=250,
                 grow=0.42):
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

    It TAPERS at the pod-wall end — 400 down to 250 — and then stops against
    that wall in a 431 face.  Not a knife point at the corner: run all the way
    out to zero and the console ends in a sliver of joinery nobody can build and
    nothing can stand on.  Not a square 400 cut either: offsetting outward at
    the springing throws the front face straight THROUGH the pod wall, so a
    square cut overhangs into the pod.  Tapering to 250 and clipping the front
    where IT crosses the wall does both jobs — the end face is a clean vertical
    on X = MB_XE, and the top is still 250 wide where it meets the wall.

    Cupboards under it the whole way; one wall cabinet over the straight tail at
    the partition end, drawn dashed because it is over, not in plan.  The top is
    for the art and the plants."""
    h = D.T_MB / 2
    u0 = mb_u_at_wall(-h)                          # the springing, on the wall

    def d(u):                       # 400 over most of it, easing to dep_end
        t = min(1.0, (u - u0) / grow)
        return dep_end + (dep - dep_end) * t * t * (3 - 2 * t)  # smoothstep

    # The front still reaches past the pod wall at the springing, so find where
    # IT crosses and start the front there; the back starts at u0, which is on
    # the wall already.  Both ends land on X = MB_XE, so the end face is a clean
    # vertical against that wall — 431 of it — instead of a knife point at the
    # corner.
    lo, hi = -1.6, 0.0
    for _ in range(60):
        m = (lo + hi) / 2
        if mb_pt(m, -h - d(m))[0] > D.MB_XE:
            lo = m
        else:
            hi = m
    back = [mb_pt(u, -h) for u in np.linspace(u0, 1.0, n)]
    front = [mb_pt(u, -h - d(u)) for u in np.linspace(hi, 1.0, n)]
    ys, xb = D.SCR_Y - D.T_SCR, D.MB_XW - D.T_MB      # 7675, 2325
    return [('poly', back + [(xb, ys), (xb - dep, ys)] + list(reversed(front)),
             'solid'),
            ('rect', xb - over_d, ys - over, xb, ys, 'dash')]


def arch_console_par(dep=400, dep_end=250, n=140, grow=0.42,
                     u_a=0.264, u_b=0.618):
    """The parents' version of the same curl round the bath's arch.

    Karan's runs the whole sweep and dies into his dressing screen at Y 7675.
    This one is CUT BY THE SLIDING SCREEN that divides the parents from the
    grandmother: the leaf shuts on the line Y 5875-5995 and the console crosses
    that line, so a slot runs through it and the leaf slides into the slot and
    stops against the arch.

    The two ends of the slot are found rather than guessed — u 0.264 and 0.618
    are the first and last sections of the console whose 400 depth touches the
    leaf's line with 20 of tolerance either side.  Between them there is nothing
    but the leaf.

    Everything else is Karan's: struck as an offset of the sweep's own outer
    face, 400 deep, tapering to 250 at the pod wall and stopping there in a 431
    face rather than a knife point.  No wall cabinet — that belongs on a
    straight tail and this one has none.

    THERE IS NO SOUTH PIECE.  The console stops at the slot.  A return below it
    would sit in the grandmother's zone and narrow the way in past it to 525 by
    the time the arch turns vertical, which is not a doorway.  So the curl runs
    from the pod wall over the crown, meets the leaf, and ends."""
    h = D.T_MB / 2
    u0 = mb_u_at_wall(-h)

    def d(u):
        t = min(1.0, (u - u0) / grow)
        return dep_end + (dep - dep_end) * t * t * (3 - 2 * t)

    lo, hi = -1.6, 0.0
    for _ in range(60):
        m = (lo + hi) / 2
        if mb_pt(m, -h - d(m))[0] > D.MB_XE:
            lo = m
        else:
            hi = m
    back = [mb_pt(u, -h) for u in np.linspace(u0, u_a, n)]
    front = [mb_pt(u, -h - d(u)) for u in np.linspace(hi, u_a, n)]
    return [('poly', back + list(reversed(front)), 'solid')]


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


def kitchen_counter(dep=600, r_end=300, r_ease=200):
    """Run B, turning the corner of the kitchen's bump.

    The bump is 600 deep and the counter is 600 deep, and that is not a
    coincidence — it is the reason the bump is 600.  It makes the front of the
    upper leg land EXACTLY on the back of the lower one at BAY_N, so the two
    legs meet on one line and the run reads as a single worktop that steps,
    rather than as two counters that nearly line up.

    Its east end is struck off the apse, like everything else that runs into
    that arch: the front edge meets it at BAY_N, the back edge 463 further east
    at KIT_S, and the end face is the arc between them.  A square end there
    would have to stop at the nearer of the two and throw away half a metre of
    worktop for the sake of being a rectangle.

    Clockwise from the eased west end: front edge east, round the corner of the
    step, along the upper leg, round the apse, back west along the wall.
    """
    kw = 6900                       # the kitchen's west face
    y0, y1 = D.BAY_N, D.KIT_S       # the two wall faces the counter backs on
    xr = D.KIT_BUMP_W + 125         # 8725 — the return's face, the inside corner
    xc = xr + dep                   # 9325 — the front edge's corner

    def arc(cx, cy, r, t0, t1, n=18):
        return [(cx + math.cos(math.radians(t)) * r,
                 cy + math.sin(math.radians(t)) * r)
                for t in np.linspace(t0, t1, n)]

    pts = [(kw + r_ease, y0 + dep), (xc - r_end, y0 + dep)]
    pts += arc(xc - r_end, y0 + dep - r_end, r_end, 90, 0)      # the step's nose
    pts += [(xc, y1 + dep), (D.gal_cross(y1 + dep), y1 + dep)]
    pts += _gal_arc(D.GAL_RO, D._ang(D.gal_cross(y1 + dep), y1 + dep),
                    D._ang(D.gal_cross(y1), y1), 24)            # the apse end
    pts += [(xr, y1), (xr, y0), (kw + r_ease, y0)]
    pts += arc(kw + r_ease, y0 + r_ease, r_ease, 270, 180)      # west end, eased
    pts += [(kw, y0 + dep - r_ease)]
    pts += arc(kw + r_ease, y0 + dep - r_ease, r_ease, 180, 90)
    return [('poly', pts, 'solid')]


def drum_kit(cx=17780, kick_y=7980):
    """Karan's electronic kit, in the den's south-east corner.

    A Roland TD with FOUR TOMS and THREE CYMBALS, which is a big configuration
    — the pads and arms want about 1790 across and 1500 front to back, and the
    throne another 500 behind that.  It nests into the corner made by the
    great-room wall at Y 8400 and the service-duct wall at X 18775, and the
    DRUMMER FACES SOUTH, into that corner, with the whole of the rest of the
    pod open behind them.

    Facing south is the only orientation that works.  Against the east wall
    facing west the drummer would sit at about X 17200, which is 620 off the
    console — they would be in each other's laps.  On the diagonal, which is
    how a lot of people set a kit into a corner, a 1790 x 1500 kit turns into
    a 2330 square and the bay is only 2895 x 2225.

    Drawn right-handed: facing south, the drummer's right is WEST, so the
    floor tom and the ride are on the room side and the hi-hat is against the
    east wall.  Flip it about cx for a left-hander; nothing else moves.

    cx is 17780 and not the bay's own centre, because a cymbal that touches a
    wall rings against it.  At 17780 the left crash clears the duct wall by
    150 and the kick clears the great-room wall by 140.
    """
    def pad(dx, dy, r, style='solid'):
        return ('circle', cx + dx, kick_y + dy, r, style)

    return [
        pad(0, -1360, 250, 'soft'),      # throne
        pad(125, -800, 175),             # snare, just off centre
        pad(0, 0, 280),                  # kick, 140 off the great-room wall
        pad(-325, -400, 150),            # rack tom 1
        pad(0, -500, 150),               # rack tom 2
        pad(325, -400, 150),             # rack tom 3
        pad(-560, -680, 215),            # floor tom, drummer's right
        pad(575, -830, 175, 'light'),    # hi-hat, drummer's left
        pad(-695, -280, 250, 'light'),   # ride, over the floor tom
        pad(-645, -1030, 210, 'light'),  # crash, right
        pad(635, -260, 210, 'light'),    # crash, left
    ]


def magic_corner():
    """The blind corner of run B, and the pull-out that gets into it.

    A CORRECTION FIRST, because the number was wrong when it was first said.
    The block where the two legs of run B stack is 600 x 1200 — but only half
    of that is blind.  The lower leg's half, Y 8525-9125, faces north into the
    room and opens perfectly well.  What is blind is the UPPER leg's half:
    600 x 600 at X 8725-9325 / Y 7925-8525.  Its own front is on Y 8525, and
    Y 8525 is exactly where the lower leg's carcass begins, so a door there
    would open into the back of another cupboard.

    So it has no door.  The only way in is sideways, through the unit east of
    it, and beyond the reach of an arm that is the far corner nobody sees.

    Drawn the way the sliding panels are drawn — in BOTH states, so the plan
    explains itself and the joinery schedule cannot quietly leave it out:

      * the blind carcass and the 500 door unit that serves it, dashed
      * the rear trays STOWED, in the blind corner
      * the same trays SWUNG OUT, standing in the floor in front of the door
      * the path between the two

    The floor they swing into is clear: the lower leg's worktop stops at
    X 9325, so X 9325-9825 / Y 8525-9125 is open.
    """
    BX0, BX1 = 8725, 9325           # the blind carcass
    DX0, DX1 = 9325, 9825           # the unit whose door is the only way in
    Y0, Y1 = D.KIT_S, D.BAY_N       # 7925 / 8525 — the upper leg's two faces
    out = [('rect', BX0, Y0, BX1, Y1, 'dash'),
           ('rect', DX0, Y0, DX1, Y1, 'dash'),
           ('rect', BX0 + 40, Y0 + 40, BX1 - 40, Y1 - 40, 'light')]   # stowed
    # the same trays, out in the room
    ox0, oy0 = DX0 + 20, Y1 + 40
    out.append(('rect', ox0, oy0, ox0 + 520, oy0 + 520, 'dash'))
    # and the path they take, with an arrowhead on the end
    a = (BX0 + BX1) / 2, (Y0 + Y1) / 2
    b = ox0 + 260, oy0 + 260
    ctl = DX1 - 40, Y1 - 300
    path = [(((1 - t) ** 2) * a[0] + 2 * (1 - t) * t * ctl[0] + t * t * b[0],
             ((1 - t) ** 2) * a[1] + 2 * (1 - t) * t * ctl[1] + t * t * b[1])
            for t in np.linspace(0, 1, 26)]
    for p, q in zip(path, path[1:]):
        out.append(('line', p[0], p[1], q[0], q[1], 'light'))
    ux, uy = b[0] - path[-2][0], b[1] - path[-2][1]
    n = math.hypot(ux, uy) or 1
    ux, uy = ux / n * 110, uy / n * 110
    for s_ in (0.5, -0.5):
        out.append(('line', b[0], b[1], b[0] - ux + s_ * uy, b[1] - uy - s_ * ux,
                    'light'))
    return out


def hob_counter(r=200):
    """The hob run and the appliance corner, as ONE L.

    It used to be two counters 400 apart, and a third 400 between the western
    one and the fridge.  Neither gap was doing anything — both came from
    setting the hob counter 400 in from each jamb of its window — and what they
    read as was two slots of floor too narrow to stand in and too shallow to
    store in.  The run is now UNBROKEN from the fridge's side at X 7800 to the
    gallery leg, and then turns north up it.

    Closing the western 400 is not just worktop.  The hob sits at 8500-9100 and
    had only 300 of counter to its left, which is not enough to put a hot pan
    down on; it has 700 now.  The hob itself has not moved — it is still
    centred on the window at 8800.

    Every corner that stands in the room is eased 200, like the rest of the
    kitchen.  Two are not.  The one at X 9800 / Y 10375 is the L's inside
    corner, where two worktops are mitred, and a mason does not scoop a curve
    out of an internal angle.  The west end is square because it butts the
    fridge, which is 700 deep and therefore stands 100 proud of the worktop —
    that end face is never seen.
    """
    W, E = 7800, D.GAL_W            # the fridge's east face, the gallery leg
    N, S = 10375, D.BAY_S           # 600 deep on the south wall
    LW, LN = 9800, 9700             # the leg: its west face, its north end

    def arc(cx, cy, t0, t1, n=10):
        return [(cx + math.cos(math.radians(t)) * r,
                 cy + math.sin(math.radians(t)) * r)
                for t in np.linspace(t0, t1, n)]

    pts = [(W, N), (LW, N), (LW, LN + r)]              # front, then the inside
    pts += arc(LW + r, LN + r, 180, 270)               # corner, left square
    pts += [(E - r, LN)]
    pts += arc(E - r, LN + r, 270, 360)
    pts += [(E, S - r)]
    pts += arc(E - r, S - r, 0, 90)
    pts += [(W, S)]
    return [('poly', pts, 'solid')]


def great_room_carpet():
    """The rug under the great room's sitting group.

    Under the U, symmetric on the home's axis at X 12240 like the seats.
    3780 x 2900, a 120 woven border inside the edge — every chair and the
    bench have their front feet on it, and the open middle of the U is rug.
    The tree's planter box sits 50 south of its edge, so no notch.

    Sized to stop 855 short of the deck glass line: the rug is the room's
    half of the composition, the grass is the garden's.
    """
    o = [(10350, 3450), (14130, 3450), (14130, 6350), (10350, 6350)]
    i = [(10470, 3570), (14010, 3570), (14010, 6230), (10470, 6230)]
    return [('poly', o, 'soft'), ('poly', i, 'light')]


# The fountain's planting is DELIBERATELY NOT DRAWN.  It was, twice: pots
# standing on the lawn around the bowl, then pots hooked over the rim with
# trailing flowers falling down the outside.  Neither earned its place.  A
# 1200 bowl is 1200 on the sheet however it is planted, so the collar told
# the architect nothing he needs and cost the drawing the one thing the
# fountain is there to read as — water on the home's axis.  Planting on the
# fountain is a finish, settled with whoever plants it, off this drawing.


def great_room_sofa(ax=12307, ay=5037, deg=0, L=1600, D=900, foot=280, box=900):
    """The great room's 2-seat recliner sofa, with its planter built on to it.

    SQUARE TO THE ROOM, not diagonal.  It was set out at 45 degrees for one
    round and turned back: a single piece on the slant in an otherwise empty
    room does not read as deliberate, it reads as knocked askew, and it put
    the tree's box across the middle of the floor at an angle nothing else in
    the plan shares.

    ax 12307 IS SET BY THE DEN'S DOORWAY AND BY NOTHING ELSE.  The piece was
    asked to move east until its east face landed on X 15365 — the line the
    east deck recliner's back sits on.  It cannot go that far.  The arched
    portal into Karan's den is in the east pod screen at Y 3872-4692, and the
    screen there stands at 15807; a planter face on 15365 would leave 442 to
    walk through, across the approach to a doorway.  A sofa parked in front
    of a door is the one mistake this drawing has already made once.

    So the piece goes east until the den's approach is 1000 and stops: the
    planter's east face is at 14807, 558 short of the line.  That 558 is the
    whole of the difference and it is not negotiable downward.

    What the move costs is the other half of the seating group.  The two deck
    recliners are pinned against the void walls at X 9565 and 14915, so the
    sofa's distance to each is decided entirely by where it sits between
    them.  Here it reads 3261 to the east recliner — a good conversation —
    and 4463 to the west one, which is out of the group.  Centred on 12240 it
    read 3811 to both.  This is a deliberate trade of one balanced group for
    one close pair, and the west recliner becomes a place to sit and look at
    the fountain rather than a seat in the conversation.

    The planter is not a separate object.  It shares the sofa's back line and
    its depth and butts its east end, so the two are built as one L of joinery
    — a sofa with a tree growing out of the end of it.  The tree keeps its
    1620 canopy, drawn dashed because it is overhead.

    (ax, ay) is the west end of the BACK line; s runs along the piece, t out
    from the back towards the front.  deg is kept as an argument, at 0, so the
    45 degree version is one number away if it is ever wanted back.
    """
    r = math.radians(deg)
    ux, uy = math.cos(r), math.sin(r)          # along the piece, to the SE
    vx, vy = math.sin(r), -math.cos(r)         # out of the back, to the NE

    def P(s, t):
        return (ax + ux * s + vx * t, ay + uy * s + vy * t)

    def quad(s0, t0, s1, t1, style, r=90.0, ease='all'):
        """A rectangle in the piece's own frame, corners eased.

        The easing is struck in (s, t) and only then mapped through P, so it
        stays a true fillet whatever angle the piece is set at.  r is capped
        at 45 per cent of the rectangle's own short side, so a 190 back band
        eases to 85 rather than closing up into a lozenge.
        """
        s0, s1 = min(s0, s1), max(s0, s1)
        t0, t1 = min(t0, t1), max(t0, t1)
        r = min(r, min(s1 - s0, t1 - t0) * 0.45)
        pts = []
        for nm, cs, ct, a0, a1, sq in (
                ('hi', s1 - r, t1 - r, 0, 90, (s1, t1)),
                ('hi', s0 + r, t1 - r, 90, 180, (s0, t1)),
                ('lo', s0 + r, t0 + r, 180, 270, (s0, t0)),
                ('lo', s1 - r, t0 + r, -90, 0, (s1, t0))):
            if ease in ('all', nm):
                pts += [P(cs + math.cos(math.radians(k)) * r,
                          ct + math.sin(math.radians(k)) * r)
                        for k in range(a0, a1 + 1, 6)]
            else:
                pts.append(P(*sq))
        return ('poly', pts, style)

    out = [quad(0, 0, L, D, 'solid'),                  # the sofa
           quad(0, 0, L, 190, 'soft', ease='lo'),      # its back
           quad(L * 0.16, D, L * 0.84, D + foot, 'soft', ease='hi')]  # footrests
    for f in (1 / 3, 2 / 3):                           # the two seat divisions
        a_, b_ = P(L * f, 270), P(L * f, D - 80)
        out.append(('line', a_[0], a_[1], b_[0], b_[1], 'light'))

    out.append(quad(L, 0, L + box, D, 'solid', 120))   # the planter — a BOX
    out.append(quad(L + 90, 90, L + box - 90, D - 90, 'green', 80))
    cx, cy = P(L + box / 2, D / 2)                     # again, corners eased
    rad = box * 0.9                                    # 120, with the canopy
    out.append(('circle', cx, cy, rad, 'dash'))        # dashed over it
    for k in range(6):
        a_ = math.radians(k * 60 + 15)
        out.append(('circle', cx + math.cos(a_) * rad * 0.5,
                    cy + math.sin(a_) * rad * 0.5, rad * 0.34, 'dash'))
    return out


def floor_island(n=400):
    """The timber island's outline — a closed curve through set control points.

    ONLY USED WHEN wood_floor(island=True).  It is the 'flowy floor' option:
    timber where you sit, stone where you walk, and one long organic curve
    between the two instead of a straight threshold anywhere.

    Its north edge is the deck slider itself, X 9115 to 15365 on Y 2620, so
    the island is NOT a separate pool — it is the great room's end of the same
    boarded floor that runs out on to the deck.  From there the boundary
    sweeps out to within a few hundred of each pod's glazing at mid-room,
    where the furniture is, and pulls back to a soft south edge that undulates
    around Y 6000-6500, north of the entry gallery's apse.

    THAT SOUTH EDGE IS THE IDEA.  You come in through the apse on to stone,
    cross a stone apron, and step on to timber where the room is lived in.
    The line between them is the one drawn element in this plan that is purely
    a curve — no radius, no centre, no tangent to anything.

    Catmull-Rom through the control points, so the curve passes THROUGH each
    one rather than near it, and the shape can be tuned by moving a point.
    """
    K = [(9115, 2620), (9020, 3200), (8930, 4000), (8880, 5000),
         (9500, 6100), (11050, 6480), (12240, 6180), (13600, 6520),
         (15000, 6150), (15600, 5000), (15550, 4000), (15460, 3200),
         (15365, 2620)]
    out = []
    for i in range(len(K) - 1):
        p0 = K[max(i - 1, 0)]
        p1, p2 = K[i], K[i + 1]
        p3 = K[min(i + 2, len(K) - 1)]
        for j in range(n // (len(K) - 1)):
            t = j / (n / (len(K) - 1))
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                       + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in (0, 1)))
    out.append(K[-1])
    return out


def wood_floor(board=190, island=False):
    """One wooden floor for the great room and the deck bay in front of it.

    The great room and the deck between the two voids are one room with a
    glass line across the middle of it — that has been the working assumption
    since the seating was laid out, and the floor is what makes it true.  Two
    finishes meeting at the slider would read as inside and outside no matter
    what the seating did.

    THE BOARDS ARE ON ONE GRID, and that is the whole of the detail.  They run
    NORTH-SOUTH, across the slider rather than along it, so every board starts
    on the deck and finishes in the great room; and every board line in both
    halves comes off the same set-out, centred on X 12240, so a board on the
    deck is the SAME board on the other side of the glass.  Boards laid to two
    separate grids and butted at a threshold read as two floors joined, which
    is exactly the thing this is meant to stop.

    190 is a normal engineered-oak width, and 12240 falls on a board centre.

    What stays grass: everything on the deck beyond the voids, west of 9115
    and east of 15365, and the 340 planted strip along the parapet.  The lawn
    was never the point of the deck bay in front of the great room — the point
    of that bay is that the room walks out on to it.

    The great room's outline is not a rectangle — its sides are the pod
    Beziers and its south end is the apse and the kitchen's bump — so each
    board is clipped against the real room polygon rather than a bounding box.
    """
    from matplotlib.path import Path

    _f, _d, great = pod_polys()
    timber = floor_island() if island else great
    room = Path(timber)

    N_DECK, S_DECK = D.DECK_N + 340, D.DECK_S
    W_DECK, E_DECK = 9115, 15365                  # between the two voids

    out = []
    if island:                                     # stone under the whole
        out.append(('poly', great, 'stone'))       # room, timber on top of it
        for y in np.arange(D.BODY_N + 900, D.BODY_S, 900):
            seg = [(x, y) for x in np.arange(8600, 15900, 40.0)]
            ok = Path(great).contains_points(seg)
            run = None
            for (x, _y), o in zip(seg + [seg[-1]], list(ok) + [False]):
                if o and run is None:
                    run = x
                elif not o and run is not None:
                    if x - run > 200:
                        out.append(('line', run, y, x, y, 'joint'))
                    run = None
    out.append(('poly', timber, 'plank'))
    out.append(('poly', [(W_DECK, N_DECK), (E_DECK, N_DECK),
                         (E_DECK, S_DECK), (W_DECK, S_DECK)], 'plank'))

    xs = [x for x in np.arange(D.MID - board / 2, D.END_W, -board) if x > 8500]
    xs += [x for x in np.arange(D.MID + board / 2, D.END_E, board) if x < 16000]
    for x in sorted(xs):
        if W_DECK < x < E_DECK:                    # the deck half of the board
            out.append(('line', x, N_DECK, x, S_DECK, 'board'))
        ys = np.arange(D.BODY_N, D.BODY_S, 40.0)   # and the great room half,
        inside = room.contains_points([(x, y) for y in ys])   # clipped to it
        run = None
        for y, ok in zip(list(ys) + [ys[-1]], list(inside) + [False]):
            if ok and run is None:
                run = y
            elif not ok and run is not None:
                if y - run > 200:
                    out.append(('line', x, run, x, y, 'board'))
                run = None
    return out


# THE JHOOLA IS GONE.  It was drawn in the great room's south-west quadrant
# for one round and taken out again.  It does not fit the deck, which is where
# a jhoola belongs — the fountain sits in the middle of that bay with a
# recliner against each void, leaving two gaps of 1625 against a frame of 1900
# — and in the great room it was a 1900 frame standing in the middle of the
# floor to seat two people who now have a pair of rocking chairs instead.


def console_top(a=12307, b=5037, c=13907, d=5387):
    """What stands on the console behind the sofa.

    A console 350 deep is a shelf, not a surface — everything on it has to be
    slim, and the lamps set the limit: a 260 shade leaves 45 either side of it
    and nothing wider will sit square.  A pair of them, one near each arched
    end, with a bowl and a stack of books between, spaced at 113, 115 and 122
    so the run reads as evenly filled rather than as four objects that landed
    where they landed.  Bowl before books and not after: the bowl and a lamp
    shade are both circles of much the same size, and set side by side they
    read as a pair of lamps that has slipped.

    The console itself is a STADIUM — both ends struck as full half-rounds off
    its own 350 depth.  That is the house rule, not a flourish: the baths are
    arches, the gallery is an apse, the dining table is a superellipse, the
    den's work console is bullnosed both ends, and run B's nose is eased 300.
    Nothing that stands free in this home has a square corner on it, and this
    piece stands free on both ends with a sofa in front of it.
    """
    # The console turns with the sofa, so this lays out along whichever of
    # the two is the long side and puts the objects on that line.  Written
    # once, in run coordinates, and mapped — the alternative is two copies
    # that drift apart the first time one of them is edited.
    horiz = (c - a) >= (d - b)
    lo, mid = (a, (b + d) / 2) if horiz else (b, (a + c) / 2)
    end = (c - a) if horiz else (d - b)

    def Q(u, v):
        return (lo + u, mid + v) if horiz else (mid + v, lo + u)

    out = []
    for u in (250, end - 250):                         # the two table lamps
        out.append(('circle', *Q(u, 0), 130, 'solid'))
        out.append(('circle', *Q(u, 0), 42, 'light'))
    out.append(('circle', *Q(598, 0), 105, 'solid'))    # a bowl,
    out.append(('circle', *Q(598, 0), 60, 'light'))
    out.append(('poly', [Q(818, -85), Q(1098, -85),
                         Q(1098, 85), Q(818, 85)], 'soft'))
    for k in (1, 2):                                   # and a stack of books
        out.append(('line', *Q(818 + 280 * k / 3, -85),
                    *Q(818 + 280 * k / 3, 85), 'light'))
    return out


def rocking_chairs(px=10400, py=4275, s=1500):
    """THE PAIR.  Two rocking chairs, genuinely parallel, side by side.

    Parallel is a real constraint and it is why this function exists.  A chair
    that aims itself at the recliner from its own seat centre cannot have a
    twin: move the twin 1500 sideways and it aims somewhere else, and the two
    read as knocked out of line rather than set out.  So the AIM IS COMPUTED
    ONCE, from the midpoint between the two chairs, and both are given the
    same vector.  28.0 degrees north of east, and the pair as a unit points at
    the east recliner's seat centre.

    (px, py) is that midpoint and s is the seat-centre spacing.  1500 leaves
    800 of clear floor between the two footprints — close enough that the two
    of them are one piece of furniture, wide enough for a side table to go in
    later without moving either chair.

    THE PAIR'S POSITION WAS SOLVED, not chosen.  It runs on the u axis, which
    at this angle is mostly north-south, and that is the direction the west
    half of the room actually has room in — the pod glazing and the gallery
    portal's lane leave only about 3000 across.  Four things bound it and all
    four are tight:

        deck glass          468 clear of the north-west chair
        gallery portal lane 351 clear of the south-east chair, so the walk in
                            from the front door is not touched
        family room's door  957 of approach, the same rule the sofa's east end
                            answers to at the other pod
        kitchen bump        the aft rock travel stays 100 off it

    WHAT EACH ONE SEES IS NOT THE SAME, and that is the point of a pair rather
    than a row.  The south-east chair looks over the sofa's extended footrests
    — 450 high, well under a seated eye — and its line lands on the east
    recliner.  The north-west chair's line leaves through the slider at
    X 11914 before it ever reaches the sofa, and goes out over open deck just
    east of the fountain to the parapet planting.  One view into the room, one
    straight out of it, from two chairs sitting side by side.
    """
    fx, fy = 14915 - px, 1872.5 - py
    n = math.hypot(fx, fy)
    ux, uy = -fy / n, fx / n                           # across the pair
    return (rocking_chair(px - s / 2 * ux, py - s / 2 * uy, face=(fx, fy))
            + rocking_chair(px + s / 2 * ux, py + s / 2 * uy, face=(fx, fy)))


def rocking_chair(cx=10430, cy=4330, W=700, D=750, rock=250, face=None):
    """One rocking chair, turned off square to face the east deck recliner.

    TURNED OFF SQUARE ON PURPOSE — the only thing in this plan that is.  The
    reason is not composition, it is a sightline, and with `face` left at None
    the chair computes its own: straight at the east recliner's seat centre at
    (14915, 1872).  Computed rather than typed, so moving either end re-aims
    the chair instead of leaving it pointing at where the seat used to be.

    `face` overrides that with an explicit vector, and it exists so that two
    of these can be PARALLEL — see rocking_chairs(), which is what the great
    room actually uses.  Left to aim themselves, two chairs 1500 apart point
    in two different directions.

    Drawn as raw polygons because the symbol library has no rotation in it.
    The rockers run past the seat both ways — 130 behind the back, 150 in
    front — because that is the actual floor footprint of a rocker and it is
    the thing that decides how much room it needs.  The dashed outline is the
    seat rocked back 250, which is the travel; keep that end clear.
    """
    if face is None:                                   # aim at the recliner
        face = (14915 - cx, 1872.5 - cy)
    n = math.hypot(*face)
    vx, vy = face[0] / n, face[1] / n                  # out of the back
    ux, uy = -vy, vx                                   # across the piece

    def P(s, t):
        return (cx + ux * s + vx * t, cy + uy * s + vy * t)

    def quad(s0, t0, s1, t1, style, r=70.0, ease='all'):
        """A rectangle in the piece's own frame, corners eased.

        The easing is struck in (s, t) and only then mapped through P, so it
        stays a true fillet whatever angle the piece is set at.  r is capped
        at 45 per cent of the rectangle's own short side, so a 190 back band
        eases to 85 rather than closing up into a lozenge.
        """
        s0, s1 = min(s0, s1), max(s0, s1)
        t0, t1 = min(t0, t1), max(t0, t1)
        r = min(r, min(s1 - s0, t1 - t0) * 0.45)
        pts = []
        for nm, cs, ct, a0, a1, sq in (
                ('hi', s1 - r, t1 - r, 0, 90, (s1, t1)),
                ('hi', s0 + r, t1 - r, 90, 180, (s0, t1)),
                ('lo', s0 + r, t0 + r, 180, 270, (s0, t0)),
                ('lo', s1 - r, t0 + r, -90, 0, (s1, t0))):
            if ease in ('all', nm):
                pts += [P(cs + math.cos(math.radians(k)) * r,
                          ct + math.sin(math.radians(k)) * r)
                        for k in range(a0, a1 + 1, 6)]
            else:
                pts.append(P(*sq))
        return ('poly', pts, style)

    out = []
    for side in (-1, 1):                               # the two rockers
        s = side * (W / 2 - 70)
        out.append(quad(s - 35, -D / 2 - 130, s + 35, D / 2 + 150, 'light'))
    out.append(quad(-W / 2, -D / 2, W / 2, D / 2, 'solid'))
    out.append(quad(-W / 2, -D / 2, W / 2, -D / 2 + 140, 'soft', ease='lo'))  # back
    out.append(quad(-W / 2, -D / 2 - rock, W / 2, D / 2 - rock, 'dash'))
    return out


def great_room_planter():
    """The kitchen's bump, mirrored, as a planted box in the great room.

    The east side of the great room cannot take a bump — behind that wall are
    help's room and the guest WC, and both are already at their minimum — so
    what answers the kitchen across the room is not a room but a thing standing
    in front of the wall.  Same 300 projection, same two lines at KIT_N and
    BODY_S, and the same curved end where it dies into the apse, so the two
    read as a pair from the middle of the room.

    It is NOT the full mirror and cannot be.  The bump runs 2267 from the
    glazing to the apse; its mirror would run past X 15000, where the guest
    WC's apse springs and its door stands.  So the planter stops there, 880
    short, and the missing 880 is exactly the WC door — which is the one place
    on this wall symmetry was never available.
    """
    a0 = 540 - D._ang(D.gal_cross(D.KIT_N), D.KIT_N)
    a1 = 540 - D._ang(D.gal_cross(D.BODY_S), D.BODY_S)
    box = _gal_arc(D.GAL_RO, a0, a1) + [(D.WC_SPRING, D.BODY_S),
                                        (D.WC_SPRING, D.KIT_N)]
    return [('poly', box, 'green')]


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

    # the kitchen now includes the builder's dry balcony — one room, one area,
    # and since this round it steps north over its eastern half as well
    kitchen = ([(kw, D.BAY_N), (D.KIT_BUMP_W + 125, D.BAY_N),
                (D.KIT_BUMP_W + 125, D.KIT_S)] + _gal_arc(ro, D._BN0K, D._A0)
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
    for _, _, rects, _, _anchor in D.ROOMS:
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
