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
    if kind == 'pooja':
        out = [_rr(a, b, c, d, 'solid'), _rr(a + 60, b + 60, c - 60, d - 60, 'soft'),
               _rr(cx - 170, b + 140, cx + 170, d - 120, 'solid')]
        for dx in (0.16, 0.84):
            out.append(('circle', a + w * dx, d - 150, 70, 'light'))
        return out
    if kind == 'tv':
        return [_rr(a, b, c, d, 'solid'),
                _rr(a + w * 0.42, b + 35, c, d - 35, 'soft')]
    if kind == 'sidetable':
        return [_rr(a, b, c, d, 'solid')]
    if kind in ('counter', 'island', 'joinery', 'appliance', 'shelves', 'console',
                'bunk', 'mirror'):
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
    if kind in ('sofa', 'recliner', 'chair'):
        out = [_rr(a, b, c, d, 'solid')]
        back = 190 if kind == 'sofa' else 170
        if kind == 'chair':
            out.append(('circle', cx, cy, min(w, h) * 0.25, 'soft'))
            return out
        if w >= h:
            out.append(_rr(a, d - back, c, d, 'soft'))
            for i in (1, 2):
                out.append(('line', a + i * w / 3, b + 80, a + i * w / 3, d - back - 50,
                            'light'))
        else:
            out.append(_rr(c - back, b, c, d, 'soft'))
            for i in (1, 2):
                out.append(('line', a + 80, b + i * h / 3, c - back - 50, b + i * h / 3,
                            'light'))
        if kind == 'recliner':
            out.append(_rr(a + w * 0.16, d, a + w * 0.84, d + h * 0.3, 'soft'))
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
    if kind == 'murphy':
        out = [_rr(a, b, c, d, 'solid'), _rr(a + 80, b + 90, c - 80, d - 90, 'soft')]
        out.append(_rr(a, b, a + 2000, d, 'dash') if c - a < d - b
                   else _rr(a, b, c, b + 2000, 'dash'))
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
