"""
One symbol library, used by both the review drawing and the DXF writer, so the
two can never drift apart.

symbol(kind, x0, y0, x1, y1) returns a list of primitives in frame mm:

    ('rect',   x0, y0, x1, y1, style)
    ('circle', cx, cy, r,      style)
    ('line',   x0, y0, x1, y1, style)
    ('arc',    cx, cy, r, a0, a1, style)   degrees, Y downwards
    ('poly',   [(x, y), ...],  style)

Styles are 'solid' (drawn object), 'soft' (upholstery, backs), 'light' (a line
inside an object), 'dash' (something over, not in plan), 'glass', 'green',
'water'.
"""

import math

MID = 12240

# How far a recliner's footrest projects when it is DEPLOYED, in mm.  600 is
# the middle of the real range (450-650) and is what every recliner in the
# plan gets unless it is named below.
FOOT = 600

# The two that cannot have the full 600, keyed by the north-west corner of the
# seat box.  450 is the LOW END OF THE REAL RANGE, not a fudge — these are the
# two chairs that would have to be specified as short-throw units.
#
#   (4900, 3120)  the parents' pod recliner.  Its sofa starts at X 6300 and
#                 the seat's east face is on 5700, so 600 lands the footrest
#                 exactly on the sofa's arm.  450 leaves 150.
#   (9673, 3532)  the great room's single recliner.  Its footrest and the
#                 great-room sofa's deploy into the same corner of the room
#                 at right angles; at 600 and 600 they overlap by 39.  The
#                 sofa keeps its full 600 because two people sit on it, and
#                 this chair takes the 450, which leaves 111 between them.
FOOT_EXCEPT = {(4900, 3120): 450, (9673, 3532): 450}


def _rr(x0, y0, x1, y1, style='solid'):
    return ('rect', x0, y0, x1, y1, style)


def _rrect(a, b, c, d, r, sel='ne se sw nw'):
    """rectangle with corners filleted by r — all four, or only those in sel.

    sel exists because a band butted on to a bigger shape must NOT be eased
    where it meets it.  Round both and the two fillets leave a lens-shaped
    gap along a joint that is actually flush, and a sofa's back reads as a
    cushion floating behind it.  So a back band eases only its outer two
    corners, and a recliner's footrest only the two at its far end.
    """
    pts = []
    for nm, cx0, cy0, a0, a1, sq in (('ne', c - r, b + r, -90, 0, (c, b)),
                                     ('se', c - r, d - r, 0, 90, (c, d)),
                                     ('sw', a + r, d - r, 90, 180, (a, d)),
                                     ('nw', a + r, b + r, 180, 270, (a, b))):
        if nm in sel:
            pts += [(cx0 + math.cos(math.radians(t)) * r,
                     cy0 + math.sin(math.radians(t)) * r)
                    for t in range(a0, a1 + 1, 6)]
        else:
            pts.append(sq)
    return pts


def symbol(kind, a, b, c, d):
    w, h = c - a, d - b
    cx, cy = (a + c) / 2, (b + d) / 2
    out = []

    if kind == 'rug':
        return [_rr(a, b, c, d, 'soft')]
    if kind == 'grass':
        out = [_rr(a, b, c, d, 'green')]
        n = max(2, int(w // 700))
        for i in range(1, n):
            out.append(('line', a + i * w / n, b + 60, a + i * w / n, d - 60, 'green'))
        return out
    if kind == 'planter':
        # A GRASS STRIP INSIDE THE PARAPET, planted — not a trough hung off the
        # outside of it.  Nothing in this drawing projects past the building
        # line, and this was the only thing that was ever going to.
        # Grass first, then the shrubs standing in it.
        out = [_rr(a, b, c, d, 'green')]
        n = max(2, int(w // 700))
        for i in range(1, n):
            out.append(('line', a + i * w / n, b + 50, a + i * w / n, d - 50, 'green'))
        m = max(2, int(w // 1250) or 2)
        for i in range(m + 1):
            out.append(('circle', a + w * i / m, cy, min(118, h / 2 - 10), 'green'))
        return out
    if kind == 'treebox':
        # A built-in planter box with a tall tree growing out of it, in the
        # corner where two sofas meet.  Three things, in the order a section
        # would read them: the box itself, which is masonry and so is drawn
        # solid like joinery; the planting inside it; and the CANOPY, dashed,
        # because it is overhead — it oversails both sofas, which is the whole
        # reason for putting a tree there rather than a pot.
        out = [_rr(a, b, c, d, 'solid'), _rr(a + 90, b + 90, c - 90, d - 90, 'green')]
        r = min(w, h) * 0.9
        out.append(('circle', cx, cy, r, 'dash'))
        for k in range(6):
            ang = math.radians(k * 60 + 15)
            out.append(('circle', cx + math.cos(ang) * r * 0.5,
                        cy + math.sin(ang) * r * 0.5, r * 0.34, 'dash'))
        return out
    if kind == 'spa':
        out = [_rr(a, b, c, d, 'water')]
        out.append(_rr(a + 140, b + 140, c - 140, d - 140, 'water'))
        for i in (0, 1):
            for j in (0, 1):
                out.append(('circle', a + w * (0.31 + 0.38 * i),
                            b + h * (0.31 + 0.38 * j), min(w, h) * 0.135, 'light'))
        return out
    if kind == 'fountain':
        r = min(w, h) / 2
        out = [('circle', cx, cy, r, 'solid'), ('circle', cx, cy, r - 110, 'water'),
               ('circle', cx, cy, r * 0.42, 'solid'), ('circle', cx, cy, r * 0.20, 'light')]
        for k in range(8):
            ang = math.radians(k * 45)
            out.append(('line', cx + math.cos(ang) * r * 0.46, cy + math.sin(ang) * r * 0.46,
                        cx + math.cos(ang) * (r - 140), cy + math.sin(ang) * (r - 140),
                        'light'))
        return out
    if kind == 'gym':
        out = [_rr(a, b, c, d, 'solid'), _rr(a + 70, b + 90, c - 70, d - 90, 'soft')]
        for k in range(1, 8):
            yy = b + 90 + (h - 180) * k / 8
            out.append(('line', a + 70, yy, c - 70, yy, 'light'))
        for yy in (b + 150, d - 150):
            out.append(('circle', c + 90, yy, 80, 'light'))
        return out
    if kind == 'drum':
        r = min(w, h)
        out = [('circle', cx, cy + r * 0.12, r * 0.30, 'soft'),
               ('circle', cx - r * 0.33, cy - r * 0.11, r * 0.15, 'solid'),
               ('circle', cx + r * 0.01, cy - r * 0.18, r * 0.15, 'solid'),
               ('circle', cx + r * 0.36, cy + r * 0.07, r * 0.20, 'soft'),
               ('circle', cx - r * 0.43, cy + r * 0.19, r * 0.17, 'light'),
               ('circle', cx + r * 0.45, cy - r * 0.22, r * 0.19, 'light')]
        return out
    if kind == 'tv':
        return [_rr(a, b, c, d, 'solid'),
                _rr(a + w * 0.42, b + 35, c, d - 35, 'soft')]
    if kind == 'sidetable':
        # A rectangle, with the corners only eased — 16 per cent of the short
        # side.  counter-r's flat 200 would be nearly half the width on a table
        # this small and it would stop reading as a rectangle at all.
        return [('poly', _rrect(a, b, c, d, min(w, h) * 0.16), 'solid')]
    if kind == 'counter-re':
        # full bullnose on the east end — nobody turns a sharp corner into it —
        # and the far end's corners eased, like the rest of the kitchen
        r, f = h / 2, 200
        pts = [(a + f, b)]
        pts += [(c - r + math.cos(math.radians(t)) * r,
                 cy + math.sin(math.radians(t)) * r) for t in range(-90, 91, 5)]
        pts += [(a + f + math.cos(math.radians(t)) * f,
                 d - f + math.sin(math.radians(t)) * f) for t in range(90, 181, 6)]
        pts += [(a + f + math.cos(math.radians(t)) * f,
                 b + f + math.sin(math.radians(t)) * f) for t in range(180, 271, 6)]
        return [('poly', pts, 'solid')]
    if kind == 'counter-r':
        return [('poly', _rrect(a, b, c, d, 200), 'solid')]
    if kind == 'counter-e':
        # EDGES ONLY EASED, 90 — for a run that floats in a room but is not
        # long enough to carry a bullnose.  counter-b would strike a 175 half
        # round off a 350 console and turn it into a lozenge; counter-r's flat
        # 200 is more than half its depth.  90 is a hand running along an edge.
        return [('poly', _rrect(a, b, c, d, 90), 'solid')]
    if kind == 'counter-b':
        # bullnosed at BOTH ends — a stadium.  For a run that floats in a room
        # with neither end against anything, which is the only case where a
        # square corner in this house has nothing to be square against.
        return [('poly', _rrect(a, b, c, d, min(w, h) / 2), 'solid')]
    if kind == 'basket':
        return [('poly', _rrect(a, b, c, d, 90), 'solid'),
                ('poly', _rrect(a + 70, b + 70, c - 70, d - 70, 70), 'soft')]
    if kind == 'bin':
        r = min(w, h) / 2
        return [('poly', _rrect(a, b, c, d, 120), 'solid'),
                ('circle', cx, cy, r * 0.62, 'light')]
    if kind == 'under':
        return [_rr(a, b, c, d, 'dash')]
    if kind in ('counter', 'island', 'joinery', 'appliance', 'shelves', 'console',
                'console-s', 'console-w', 'console-e', 'bunk', 'mirror'):
        # A CONSOLE gets its corners eased; a counter does not.  The house rule
        # is that nothing standing FREE has a square corner, and a console in a
        # hall stands free on every side while a counter is built into a run
        # and has walls to be square against.  110, capped at 30 per cent of
        # the short side so a shallow one does not turn into a stadium.
        rr = min(110, min(w, h) * 0.3) if kind.split('-')[0] == 'console' else 0
        out = [('poly', _rrect(a, b, c, d, rr), 'solid') if rr
               else _rr(a, b, c, d, 'solid')]
        if kind == 'shelves':
            n = max(2, int(max(w, h) // 430))
            for i in range(1, n):
                if w >= h:
                    out.append(('line', a + i * w / n, b, a + i * w / n, d, 'light'))
                else:
                    out.append(('line', a, b + i * h / n, c, b + i * h / n, 'light'))
        if kind == 'console':
            out.append(_rr(a + rr + 40, b, c - rr - 40, b + 55, 'glass'))  # mirror
        if kind == 'console-s':                     # the same, wall on the south
            out.append(_rr(a + rr + 40, d - 55, c - rr - 40, d, 'glass'))
        if kind == 'console-w':                     # and the same, wall west
            out.append(_rr(a, b + rr + 40, a + 55, d - rr - 40, 'glass'))
        if kind == 'console-e':                     # and east
            out.append(_rr(c - 55, b + rr + 40, c, d - rr - 40, 'glass'))
        if kind == 'bunk':
            out.append(_rr(a + 70, b + 70, c - 70, d - 70, 'soft'))
            out.append(('line', a, d - 360, c, d - 360, 'light'))
        if kind == 'appliance':
            out.append(('circle', cx, cy, min(w, h) * 0.22, 'light'))
        if kind == 'mirror':
            out = [_rr(a, b, c, d, 'glass')]
        return out
    if kind == 'hanging':
        out = [_rr(a, b, c, d, 'solid')]
        if h >= w:                                   # run along y
            rx = a + w * 0.42
            out.append(('line', rx, b + 70, rx, d - 70, 'light'))
            for k in range(1, 6):
                yy = b + h * k / 6
                out.append(('line', a + 30, yy, c - 30, yy, 'light'))
        else:
            ry = b + h * 0.42
            out.append(('line', a + 70, ry, c - 70, ry, 'light'))
            for k in range(1, 6):
                xx = a + w * k / 6
                out.append(('line', xx, b + 30, xx, d - 30, 'light'))
        return out
    if kind == 'sink':
        return [_rr(a, b, c, d, 'light'), ('circle', cx, cy, min(w, h) * 0.36, 'light')]
    if kind == 'hob':
        for dx, dy in ((-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)):
            out.append(('circle', cx + w * dx, cy + h * dy, 108, 'light'))
        return out
    if kind == 'chimney':
        return [_rr(a, b, c, d, 'dash')]
    if kind == 'dryrack':
        out = [_rr(a, b, c, d, 'dash')]
        for i in range(6):
            xx = a + w * (i + 0.5) / 6
            out.append(('line', xx, b + 55, xx, d - 55, 'dash'))
        for xx in (a + 90, c - 90):
            out.append(('circle', xx, cy, 78, 'dash'))
        return out
    if kind == 'wc':
        return [('circle', cx, cy - h * 0.05, min(w, h) * 0.38, 'solid'),
                _rr(cx - w * 0.22, d - h * 0.28, cx + w * 0.22, d, 'soft')]
    # A WC PAN IS LONGER THAN IT IS WIDE, and the circle these used to be drew
    # it the other way round: a 620 box gave a 471 disc, wider across than a
    # real pan is and shorter front to back than one with a cistern behind it.
    # Now an oval pan with the cistern as a band on the wall — 390 across and
    # 680 nose to wall, which is what a close-coupled pan measures.
    if kind == 'wc-e':                     # pan faces west, cistern east
        return [('poly', _rrect(a, cy - h * 0.46, c - w * 0.27,
                                cy + h * 0.46, h * 0.46), 'solid'),
                _rr(c - w * 0.27, cy - h * 0.5, c, cy + h * 0.5, 'soft')]
    if kind == 'wc-w':                     # and its mirror, facing east
        return [('poly', _rrect(a + w * 0.27, cy - h * 0.46, c,
                                cy + h * 0.46, h * 0.46), 'solid'),
                _rr(a, cy - h * 0.5, a + w * 0.27, cy + h * 0.5, 'soft')]
    if kind == 'basin':
        return [_rr(a, b, c, d, 'solid'),
                ('circle', cx, cy, min(w, h) * 0.30, 'light')]
    if kind == 'shower':
        return [_rr(a, b, c, d, 'water'), ('line', a, b, c, d, 'light'),
                ('line', c, b, a, d, 'light'), ('circle', cx, cy, 95, 'light')]
    if kind == 'cshower':
        # quarter-round cubicle; the corner is the outboard bottom corner
        r = min(w, h)
        if cx < MID:
            ox, oy, a0, a1 = c, d, 180, 270
        else:
            ox, oy, a0, a1 = a, d, 270, 360
        pts = [(ox, oy)] + [(ox + math.cos(math.radians(t)) * r,
                             oy + math.sin(math.radians(t)) * r)
                            for t in range(a0, a1 + 1, 5)]
        return [('poly', pts, 'water'),
                ('circle', ox + math.cos(math.radians((a0 + a1) / 2)) * r * 0.45,
                 oy + math.sin(math.radians((a0 + a1) / 2)) * r * 0.45, 95, 'light')]
    if kind == 'swivel':        # a swivel recliner — round, because it rotates
        r = min(w, h) / 2
        return [('circle', cx, cy, r, 'solid'),          # the seat offset off
                ('circle', cx, cy - r * 0.22, r * 0.62, 'soft')]   # centre leaves
    if kind.split('-')[0] == 'screen':   # a monitor from above: panel and foot.
        # Suffix is which side its BACK is on, like the sofas.
        side = (kind.split('-') + ['n'])[1]
        if side == 'n':
            return [_rr(a, b, c, b + h * 0.34, 'solid'),
                    _rr(cx - w * 0.13, b + h * 0.34, cx + w * 0.13, d, 'light')]
        if side == 's':
            return [_rr(a, d - h * 0.34, c, d, 'solid'),
                    _rr(cx - w * 0.13, b, cx + w * 0.13, d - h * 0.34, 'light')]
        if side == 'w':
            return [_rr(a, b, a + w * 0.34, d, 'solid'),
                    _rr(a + w * 0.34, cy - h * 0.13, c, cy + h * 0.13, 'light')]
        return [_rr(c - w * 0.34, b, c, d, 'solid'),
                _rr(a, cy - h * 0.13, c - w * 0.34, cy + h * 0.13, 'light')]
    if kind == 'ottoman':                                # the back as a crescent
        return [('poly', _rrect(a, b, c, d, min(w, h) * 0.28), 'soft')]
    if kind.split('-')[0] in ('sofa', 'recliner', 'chair'):
        base = kind.split('-')[0]
        # which side the BACK is on.  Given explicitly as a suffix — sofa-w,
        # sofa-n — or, with none, guessed from the proportion the old way.
        side = kind.split('-')[1] if '-' in kind else ('s' if w >= h else 'e')

        # EVERY SEAT IN THIS PLAN HAS ITS CORNERS EASED.  Not a curve — 90 at
        # most, and less on anything small — because upholstery does not come
        # to a point and a plan full of sharp-cornered seats reads as boxes.
        # Each sub-rectangle caps the radius at 45 per cent of its own short
        # side, so a 190 back band eases to 85 and never pinches to nothing.
        rad = min(90.0, min(w, h) * 0.14)

        def _e(x0, y0, x1, y1, st, sel='ne se sw nw'):
            r = min(rad, min(abs(x1 - x0), abs(y1 - y0)) * 0.45)
            return ('poly', _rrect(min(x0, x1), min(y0, y1),
                                   max(x0, x1), max(y0, y1), r, sel), st)

        # which two corners of a band are the OUTER ones, by the side its
        # parent edge is on.  Everything else stays square and stays flush.
        OUT = {'s': 'se sw', 'n': 'ne nw', 'e': 'ne se', 'w': 'sw nw'}

        out = [_e(a, b, c, d, 'solid')]
        back = 190 if base == 'sofa' else 170
        if base == 'chair':
            out.append(('circle', cx, cy, min(w, h) * 0.25, 'soft'))
            return out
        if side in ('s', 'n'):
            y0, y1 = (d - back, d) if side == 's' else (b, b + back)
            out.append(_e(a, y0, c, y1, 'soft', OUT[side]))
            for i in (1, 2):
                x_ = a + i * w / 3
                out.append(('line', x_, y1 + 50 if side == 'n' else b + 80,
                            x_, d - back - 50 if side == 's' else d - 80, 'light'))
        else:
            x0, x1 = (c - back, c) if side == 'e' else (a, a + back)
            out.append(_e(x0, b, x1, d, 'soft', OUT[side]))
            for i in (1, 2):
                y_ = b + i * h / 3
                out.append(('line', x1 + 50 if side == 'w' else a + 80, y_,
                            c - back - 50 if side == 'e' else c - 80, y_, 'light'))
        if base == 'recliner':
            # the footrest, out the way the chair FACES — it used to be drawn
            # south whichever way the recliner was turned, which put it through
            # whatever stood in front of an east or west facing one
            #
            # IT IS AN ABSOLUTE 600, NOT A FRACTION OF THE CHAIR.  Drawn as
            # 30 per cent of the box it came out at 240-270, and a deployed
            # footrest does not project 270 — it projects 450-650 depending on
            # the mechanism.  Under-drawing it hides exactly the clash it
            # exists to show, which is the whole reason a recliner is drawn
            # differently from an armchair in the first place.
            P = FOOT_EXCEPT.get((a, b), FOOT)
            if side == 's':
                out.append(_e(a + w * 0.16, b - P, a + w * 0.84, b, 'soft', OUT['n']))
            elif side == 'n':
                out.append(_e(a + w * 0.16, d, a + w * 0.84, d + P, 'soft', OUT['s']))
            elif side == 'w':
                out.append(_e(c, b + h * 0.16, c + P, b + h * 0.84, 'soft', OUT['e']))
            else:
                out.append(_e(a - P, b + h * 0.16, a, b + h * 0.84, 'soft', OUT['w']))
        return out
    if kind == 'bed-rw':      # the same bed mirrored — head square on the WEST
        r = min(w, h) * 0.33
        pts = [(a, b)]
        pts += [(c - r + math.cos(math.radians(t)) * r,
                 b + r + math.sin(math.radians(t)) * r) for t in range(270, 361, 6)]
        pts += [(c - r + math.cos(math.radians(t)) * r,
                 d - r + math.sin(math.radians(t)) * r) for t in range(0, 91, 6)]
        pts += [(a, d)]
        out = [('poly', pts, 'solid')]
        x0, x1 = a + 150, a + 500
        out.append(_rr(x0, cy - 650, x1, cy - 30, 'soft'))
        out.append(_rr(x0, cy + 30, x1, cy + 650, 'soft'))
        return out
    if kind == 'bed-rr':      # corners off at the FOOT, square at the head (east)
        r = min(w, h) * 0.33
        pts = [(c, b)]
        pts += [(a + r + math.cos(math.radians(t)) * r,
                 b + r + math.sin(math.radians(t)) * r) for t in range(270, 179, -6)]
        pts += [(a + r + math.cos(math.radians(t)) * r,
                 d - r + math.sin(math.radians(t)) * r) for t in range(180, 91, -6)]
        pts += [(c, d)]
        out = [('poly', pts, 'solid')]
        x0, x1 = c - 500, c - 150          # pillows, head on the EAST side —
        out.append(_rr(x0, cy - 650, x1, cy - 30, 'soft'))    # kept inside the
        out.append(_rr(x0, cy + 30, x1, cy + 650, 'soft'))    # corner radius
        return out
    if kind == 'bed-round':
        r = min(w, h) / 2
        out = [('circle', cx, cy, r, 'solid')]
        y0, y1 = cy + r * 0.38, cy + r * 0.72     # the head is the SOUTH side
        out.append(_rr(cx - r * 0.66, y0, cx - 30, y1, 'soft'))
        out.append(_rr(cx + 30, y0, cx + r * 0.66, y1, 'soft'))
        return out
    if kind == 'tint':
        return [_rr(a, b, c, d, 'tint')]
    if kind == 'swing':
        # A door leaf drawn open, hinged at (a, b) and swinging to (a, d).
        # Most doors on this drawing are just gaps in a wall, because the swing
        # does not change the plan.  This one does: it is what makes the two
        # halves of the parents' suite separately heatable, so it is drawn.
        r = min(w, h)
        arc = [(a + r * math.cos(math.radians(t)), b + r * math.sin(math.radians(t)))
               for t in range(0, 91, 5)]
        return [('poly', [(a, b)] + arc, 'light'),
                ('line', a, b, a, b + r, 'solid')]
    if kind.startswith('murphy'):
        # A WALL BED WITH A SOFA IN FRONT.  The cabinet is what is really there —
        # solid, 400 deep, closed 51 weeks of the year — and what shows in front
        # of it while it is closed is a two-seat sofa, its back to the cabinet,
        # which the bed folds down OVER.  The bed is drawn DASHED in the position
        # it takes when it is folded down, because that is the thing you need to
        # see the room around, and it is not there in plan the rest of the time.
        # The rectangle given is the whole closed unit: cabinet plus sofa.
        L = 1905                                   # the bed, folded down: 60 x 75 in
        CAB = 400                                  # the cabinet
        if kind.endswith('-e'):
            out = [_rr(a, b, a + CAB, d, 'solid')]
            out += symbol('sofa-w', a + CAB, b, c, d)
            out += [_rr(a + CAB, b, a + CAB + L, d, 'dash'),
                    _rr(a + CAB, b + 90, a + CAB + 320, d - 90, 'dash')]   # the pillow end
        else:
            out = [_rr(c - CAB, b, c, d, 'solid')]
            out += symbol('sofa-e', a, b, c - CAB, d)
            out += [_rr(c - CAB - L, b, c - CAB, d, 'dash'),
                    _rr(c - CAB - 320, b + 90, c - CAB, d - 90, 'dash')]
        return out
    if kind.startswith('bed'):
        out = [_rr(a, b, c, d, 'solid')]
        hb = 200
        side = kind[-1]
        if side == 'n':
            out.append(_rr(a - 90, b, c + 90, b + hb, 'soft'))
        elif side == 's':
            out.append(_rr(a - 90, d - hb, c + 90, d, 'soft'))
        elif side == 'e':
            out.append(_rr(c - hb, b - 90, c, d + 90, 'soft'))
        else:
            out.append(_rr(a, b - 90, a + hb, d + 90, 'soft'))
        return out
    if kind == 'plant':
        r = min(w, h) / 2
        out = [('circle', cx, cy, r, 'green')]
        for k in range(6):
            ang = math.radians(k * 60 + 15)
            out.append(('circle', cx + math.cos(ang) * r * 0.5,
                        cy + math.sin(ang) * r * 0.5, r * 0.34, 'green'))
        return out
    if kind == 'table':
        return [('circle', cx, cy, min(w, h) / 2, 'solid')]
    if kind == 'dining-se':
        # ALL FOUR EDGES ARCHED — a superellipse, |x/A|^n + |y/B|^n = 1 at n = 5.
        # The two long edges bow so gently — 23 out of 1100 where the chairs sit,
        # one in 48 — that a chair meets what reads as a straight edge, while the
        # two ends arch enough to carry a seat.  It has no head, and it holds
        # more top than a rectangle on the same footprint because the edges bow
        # OUT instead of the corners being cut IN.
        A, B, n = w / 2, h / 2, 5.0
        pts = []
        for i in range(241):
            t = 2 * math.pi * i / 240
            ct, st = math.cos(t), math.sin(t)
            pts.append((cx + A * math.copysign(abs(ct) ** (2 / n), ct),
                        cy + B * math.copysign(abs(st) ** (2 / n), st)))
        out = [('poly', pts, 'solid')]

        def edge(yy):                       # half-width of the top at this y
            v = 1 - abs((yy - cy) / B) ** n
            return A * (v ** (1 / n)) if v > 0 else 0.0
        for k in (-1, 0, 1):                # three a side, on the flat run
            sy = cy + k * 700
            e = edge(sy)
            out.append(_rr(cx - e - 350, sy - 230, cx - e + 110, sy + 230, 'solid'))
            out.append(_rr(cx + e - 110, sy - 230, cx + e + 350, sy + 230, 'solid'))
        # SIX, and no end chairs.  There was an occasional seventh dashed in at
        # the north end; it came out.  Both ends of the table stay clear, which
        # is what lets you walk round them — the south end is the serving stance
        # at the hatch and the north end is the run up to the sitting group.
        return out
    if kind == 'dining':
        r = min(w, h) / 2
        out = [('circle', cx, cy, r, 'solid')]
        for k in range(6):
            ang = math.radians(k * 60)
            sx = cx + math.cos(ang) * (r + 330)
            sy = cy + math.sin(ang) * (r + 330)
            out.append(_rr(sx - 230, sy - 230, sx + 230, sy + 230, 'solid'))
        return out

    return [_rr(a, b, c, d, 'solid')]


def annular(cx, cy, r0, r1, a0, a1, back=False, seats=0):
    """Curved gallery furniture following the round wall."""
    th = [math.radians(t) for t in
          [a0 + (a1 - a0) * i / 60 for i in range(61)]]
    outer = [(cx + math.cos(t) * r1, cy + math.sin(t) * r1) for t in th]
    inner = [(cx + math.cos(t) * r0, cy + math.sin(t) * r0) for t in reversed(th)]
    out = [('poly', outer + inner, 'solid')]
    if back:
        bt = r1 - 175
        out.append(('poly', outer + [(cx + math.cos(t) * bt, cy + math.sin(t) * bt)
                                     for t in reversed(th)], 'soft'))
    return out
