"""
The DXF for an IMPORTED home — Ekta's, and anything else read from a DWG.

WHY THIS IS NOT build_dxf.py. That file is Om Neeldhara's end to end: it opens
source/floor14.dxf by name, applies a frame tied to that drawing, and imports
retrofit.py, which only Home 1 has. Bending it to take a second home would put
Home 1's only shipped artefact — a 2.9 MB drawing the architect works in — at
risk for the sake of a home that needs none of its machinery. So this is a
separate tool, and build_dxf.py is not touched. Home 1 cannot change because
nothing it reads has changed.

WHAT IT WRITES. Two files, and they are for different people.

  <id>-layout.dxf              the builder's own DXF with our design added on
                               PROP-* layers. 3.8 MB, everything he drew still
                               in it, for the architect who wants to check our
                               plan against his.
  <id>-layout-standalone.dxf   the design and the shell alone, no builder file
                               underneath. ~110 KB, the one to email.

Both carry the shell on PROP-SHELL. In the builder's file the shell lives
inside his unit blocks on the same DA_* layers as the partitions nobody built,
so switching those off to read our plan takes the external walls, the columns
and the glazing with it. import.py already extracted exactly that geometry into
source/shell.json, in this frame, so it is copied through and the drawing
survives the switch.

THE FRAME IS THE IMPORTER'S, READ BACK. import.py mapped the drawing into the
design's frame with `local = (x - x0, y1 - y)`; that pair now lives in
home.json, and this maps back through it. Nothing is measured twice, so the
layout cannot land anywhere but where it was read from.

    python3 tools/build_dxf_home.py --home ekta
    python3 tools/build_dxf_home.py --home ekta --standalone
"""

import json
import math
import os
import sys

import ezdxf

import home
home.select()
import design as D                                    # noqa: E402
import draw_home as DH                                # noqa: E402  (geometry)

try:
    import immovables as IMM                          # noqa: E402
except ImportError:
    IMM = None

HERE = os.path.dirname(os.path.abspath(__file__))
CAD = os.path.join(HERE, '..')

# (name, aci colour, linetype)
LAYERS = [
    ('PROP-WALL-NEW', 1, 'CONTINUOUS'),      # red — every wall is new
    ('PROP-THRESHOLD', 8, 'DASHED'),         # grey — a room line nobody builds
    ('PROP-DOOR', 6, 'CONTINUOUS'),          # magenta — leaf and swing
    ('PROP-GLAZ', 4, 'CONTINUOUS'),          # cyan — glass over a solid base
    ('PROP-SCREEN', 32, 'CONTINUOUS'),       # brown — sliding screens
    ('PROP-FURN', 9, 'CONTINUOUS'),
    ('PROP-COLUMN', 2, 'CONTINUOUS'),        # yellow — structure, for reference
    ('PROP-ENVELOPE', 7, 'CONTINUOUS'),
    ('PROP-TEXT', 3, 'CONTINUOUS'),
    ('PROP-SHELL', 7, 'CONTINUOUS'),         # what the builder handed over
]


def frame():
    f = (home.meta().get('frame') or {})
    if not f:
        sys.exit('build_dxf_home: this home has no "frame" in home.json — the\n'
                 'importer\'s local = (x - x0, y1 - y) pair. Without it the\n'
                 'layout cannot be put back where it was read from.')
    return float(f['x0']), float(f['y1'])


def main():
    shell = '--standalone' not in sys.argv
    x0, y1 = frame()

    def P(x, y):
        """Design frame -> the builder's model space. The inverse of the map
        import.py read the drawing with."""
        return (round(x + x0, 3), round(y1 - y, 3))

    src = home.meta().get('dxf')
    if shell and src and os.path.exists(os.path.join(CAD, src)):
        doc = ezdxf.readfile(os.path.join(CAD, src))
        print(f'shell: {src}')
    else:
        doc = ezdxf.new('R2010')
        shell = False
        print('shell: none — the design alone')
    msp = doc.modelspace()

    # LibreDWG's DXF can leave the default MATERIAL objects as dangling
    # handles, which trips ezdxf on save. Rebuild them; nothing uses them.
    try:
        doc.materials.clear()
        doc.materials.create_required_entries()
    except Exception:
        pass
    if 'DASHED' not in doc.linetypes:
        doc.linetypes.add('DASHED', pattern=[20.0, 12.0, -8.0],
                          description='Dashed ____ ____ ____')
    for name, colour, lt in LAYERS:
        if name in doc.layers:
            doc.layers.remove(name)
        doc.layers.add(name, color=colour, linetype=lt)

    def poly(pts, layer, closed=True):
        msp.add_lwpolyline([P(a, b) for a, b in pts], close=closed,
                           dxfattribs={'layer': layer})

    def line(a, b, c, d, layer):
        msp.add_line(P(a, b), P(c, d), dxfattribs={'layer': layer})

    n = dict.fromkeys(
        ('wall', 'threshold', 'door', 'glaz', 'screen', 'furn', 'col', 'text',
         'shell'), 0)

    # ------------------------------------------------------------- envelope
    poly(getattr(D, 'ENVELOPE', []), 'PROP-ENVELOPE')

    # ----------------------------------------------------------------- shell
    # THE SHELL GOES ON ITS OWN LAYER. In the builder's file it lives inside
    # his unit blocks, on the same DA_* layers as the partitions he drew and
    # nobody built — so switching those off to see our plan takes the external
    # walls, the columns and the glazing with it. import.py already extracted
    # exactly that geometry into source/shell.json, in this frame, so it is
    # copied through here and the drawing survives the switch.
    shp = os.path.join(CAD, os.path.dirname(src or ''), 'shell.json') if src else ''
    if shp and os.path.exists(shp):
        with open(shp) as fh:
            sh = json.load(fh)
        for a, b, c, d_ in sh.get('carpet', []):     # segments, not points
            line(a, b, c, d_, 'PROP-SHELL')
            n['shell'] += 1
        for a, b, c, d_, t in sh.get('walls', []):
            poly(DH.wall_quad(a, b, c, d_, t), 'PROP-SHELL')
            n['shell'] += 1
        for a, b, c, d_ in sh.get('columns', []):
            poly([(a, b), (c, b), (c, d_), (a, d_)], 'PROP-SHELL')
            n['shell'] += 1
        for a, b, c, d_ in sh.get('glazing', []):
            line(a, b, c, d_, 'PROP-SHELL')
            n['shell'] += 1

    # ---------------------------------------------------------------- walls
    # The same solid/opening logic the sheet is drawn with, so the DXF and the
    # PNG cannot disagree about where a wall stops.
    for w in getattr(D, 'NEW_WALLS', []):
        x1, y_1, x2, y2, t = w[:5]
        ops = w[5] if len(w) > 5 else []
        bow = w[9] if len(w) > 9 else 0
        pts_in = w[10] if len(w) > 10 else None
        curve = list(pts_in) if pts_in else DH.bezier(x1, y_1, x2, y2, bow)

        if t <= 0:
            line(x1, y_1, x2, y2, 'PROP-THRESHOLD')
            n['threshold'] += 1
            continue

        if pts_in:
            run = DH.arc_runs(curve, ops)
            cuts = sorted((min(o[1], o[2]), max(o[1], o[2])) for o in ops
                          if (o[3] if len(o) > 3 else 0) <= 0)
            at, spans = 0.0, []
            for c0, c1 in cuts:
                if c0 > at:
                    spans.append((at, c0))
                at = max(at, c1)
            if at < run[-1]:
                spans.append((at, run[-1]))
            for d0, d1 in spans:
                piece = DH.sub_arc(curve, run, d0, d1)
                if len(piece) >= 2:
                    poly(DH.band(piece, t), 'PROP-WALL-NEW')
                    n['wall'] += 1
        else:
            for a, b in DH.solid_runs(x1, y_1, x2, y2, ops):
                piece = (DH.along(curve, (a[1] if a[0] == b[0] else a[0]),
                                  (b[1] if a[0] == b[0] else b[0]))
                         if bow else [a, b])
                if len(piece) >= 2:
                    poly(DH.band(piece, t), 'PROP-WALL-NEW')
                    n['wall'] += 1

        # openings: glass above a solid base, and doors that reach the floor
        run = DH.arc_runs(curve, ops)
        vert = abs(x2 - x1) < abs(y2 - y_1)
        for op in ops:
            kind, f0, f1 = op[:3]
            sill = op[3] if len(op) > 3 else 0
            if sill > 0:
                gl = (DH.sub_arc(curve, run, f0, f1) if pts_in
                      else DH.along(curve, f0, f1) if bow else (
                          [(x1, f0), (x1, f1)] if vert else [(f0, y_1), (f1, y_1)]))
                if len(gl) >= 2:
                    poly(gl, 'PROP-GLAZ', closed=False)
                    n['glaz'] += 1
                continue
            d0, d1 = ((f0, f1) if pts_in
                      else (DH._axis_arc(curve, run, vert, f0),
                            DH._axis_arc(curve, run, vert, f1)))
            if d0 is None or d1 is None:
                continue
            if kind == 'slider':
                gl = DH.sub_arc(curve, run, min(d0, d1), max(d0, d1))
                if len(gl) >= 2:
                    poly(gl, 'PROP-SCREEN', closed=False)
                    n['screen'] += 1
                continue
            side = op[5] if len(op) > 5 else 1
            d0, d1 = min(d0, d1), max(d0, d1)
            wdt = d1 - d0
            hx, hy = DH._at(curve, run, d0)
            tx, ty = DH._at(curve, run, min(d0 + 60.0, run[-1]))
            tx, ty = tx - hx, ty - hy
            L = math.hypot(tx, ty) or 1.0
            tx, ty = tx / L, ty / L
            nx, ny = ty * side, -tx * side
            line(hx, hy, hx + nx * wdt, hy + ny * wdt, 'PROP-DOOR')
            arc = []
            for i in range(25):
                a = (i / 24) * (math.pi / 2)
                c, sn = math.cos(a), math.sin(a)
                arc.append((hx + wdt * (nx * c + tx * sn),
                            hy + wdt * (ny * c + ty * sn)))
            poly(arc, 'PROP-DOOR', closed=False)
            n['door'] += 1

    # ------------------------------------------------------------- furniture
    for f in getattr(D, 'FURNITURE', []):
        if len(f) > 9 and f[9]:
            continue                        # a ghost is a drawing convention
        p = f[8] if len(f) > 8 else None
        poly(p or [(f[1], f[2]), (f[3], f[2]), (f[3], f[4]), (f[1], f[4])],
             'PROP-FURN')
        n['furn'] += 1

    # -------------------------------------------------- structure, for reference
    if IMM is not None:
        for c in getattr(IMM, 'NAMED', []):
            name, a, b, cc, d = c[0], c[1], c[2], c[3], c[4]
            poly([(a, b), (cc, b), (cc, d), (a, d)], 'PROP-COLUMN')
            n['col'] += 1

    # ----------------------------------------------------------------- names
    for r in getattr(D, 'ROOMS', []):
        name, sub, anchor = r[0], r[1], r[2]
        msp.add_text(name if not sub else f'{name} ({sub})',
                     height=180,
                     dxfattribs={'layer': 'PROP-TEXT',
                                 'insert': P(anchor[0] - len(name) * 55,
                                             anchor[1])})
        n['text'] += 1

    stem = f'{home.current()}-layout' + ('' if shell else '-standalone')
    out = os.path.join(home.out_dir(), f'{stem}.dxf')
    doc.saveas(out)
    print('wrote', os.path.relpath(out, CAD))
    print('  ' + ', '.join(f'{v} {k}' for k, v in n.items() if v))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
