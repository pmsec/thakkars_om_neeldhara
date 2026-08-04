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


def _rr(x0, y0, x1, y1, style='solid'):
    return ('rect', x0, y0, x1, y1, style)


def _rrect(a, b, c, d, r):
    """rectangle with all four corners filleted by r"""
    pts = []
    for cx0, cy0, a0, a1 in ((c - r, b + r, -90, 0), (c - r, d - r, 0, 90),
                             (a + r, d - r, 90, 180), (a + r, b + r, 180, 270)):
        pts += [(cx0 + math.cos(math.radians(t)) * r,
                 cy0 + math.sin(math.radians(t)) * r) for t in range(a0, a1 + 1, 6)]
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
        out = [_rr(a, b, c, d, 'green')]
        n = max(2, int(w // 620) or 2)
        for i in range(n + 1):
            out.append(('circle', a + w * i / n, cy, min(118, h / 2 - 10), 'green'))
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
        out = [_rr(a, b, c, d, 'solid')]
        if kind == 'shelves':
            n = max(2, int(max(w, h) // 430))
            for i in range(1, n):
                if w >= h:
                    out.append(('line', a + i * w / n, b, a + i * w / n, d, 'light'))
                else:
                    out.append(('line', a, b + i * h / n, c, b + i * h / n, 'light'))
        if kind == 'console':
            out.append(_rr(a + 60, b, c - 60, b + 55, 'glass'))     # mirror over
        if kind == 'console-s':                     # the same, wall on the south
            out.append(_rr(a + 60, d - 55, c - 60, d, 'glass'))
        if kind == 'console-w':                     # and the same, wall west
            out.append(_rr(a, b + 60, a + 55, d - 60, 'glass'))
        if kind == 'console-e':                     # and east
            out.append(_rr(c - 55, b + 60, c, d - 60, 'glass'))
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
    if kind == 'wc-e':                     # the same pan, turned to face west,
        return [('circle', cx - w * 0.05, cy, min(w, h) * 0.38, 'solid'),
                _rr(c - w * 0.28, cy - h * 0.22, c, cy + h * 0.22, 'soft')]
    if kind == 'wc-w':                     # and its mirror, facing east
        return [('circle', cx + w * 0.05, cy, min(w, h) * 0.38, 'solid'),
                _rr(a, cy - h * 0.22, a + w * 0.28, cy + h * 0.22, 'soft')]
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
        out = [_rr(a, b, c, d, 'solid')]
        back = 190 if base == 'sofa' else 170
        if base == 'chair':
            out.append(('circle', cx, cy, min(w, h) * 0.25, 'soft'))
            return out
        if side in ('s', 'n'):
            y0, y1 = (d - back, d) if side == 's' else (b, b + back)
            out.append(_rr(a, y0, c, y1, 'soft'))
            for i in (1, 2):
                x_ = a + i * w / 3
                out.append(('line', x_, y1 + 50 if side == 'n' else b + 80,
                            x_, d - back - 50 if side == 's' else d - 80, 'light'))
        else:
            x0, x1 = (c - back, c) if side == 'e' else (a, a + back)
            out.append(_rr(x0, b, x1, d, 'soft'))
            for i in (1, 2):
                y_ = b + i * h / 3
                out.append(('line', x1 + 50 if side == 'w' else a + 80, y_,
                            c - back - 50 if side == 'e' else c - 80, y_, 'light'))
        if base == 'recliner':
            # the footrest, out the way the chair FACES — it used to be drawn
            # south whichever way the recliner was turned, which put it through
            # whatever stood in front of an east or west facing one
            if side == 's':
                out.append(_rr(a + w * 0.16, b - h * 0.3, a + w * 0.84, b, 'soft'))
            elif side == 'n':
                out.append(_rr(a + w * 0.16, d, a + w * 0.84, d + h * 0.3, 'soft'))
            elif side == 'w':
                out.append(_rr(c, b + h * 0.16, c + w * 0.3, b + h * 0.84, 'soft'))
            else:
                out.append(_rr(a - w * 0.3, b + h * 0.16, a, b + h * 0.84, 'soft'))
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
        # A WALL BED.  The cabinet is what is really there — solid, 400 deep,
        # closed 51 weeks of the year.  The bed is drawn DASHED in the position
        # it takes when it is folded down, because that is the thing you need to
        # see the room around, and it is not there in plan the rest of the time.
        L = 2000                                   # the bed, folded down
        out = [_rr(a, b, c, d, 'solid')]
        if kind.endswith('-e'):
            out += [_rr(c, b, c + L, d, 'dash'),
                    _rr(c, b + 90, c + 320, d - 90, 'dash')]        # the pillow end
        else:
            out += [_rr(a - L, b, a, d, 'dash'),
                    _rr(a - 320, b + 90, a, d - 90, 'dash')]
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
