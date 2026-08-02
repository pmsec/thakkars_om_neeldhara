"""
Step 1 of the pipeline: turn the builder's DWG into things Python can read.

The DWG is AutoCAD 2018 (AC1032), which ezdxf cannot open directly, so it is
first converted to DXF with LibreDWG's dwg2dxf:

    dwg2dxf -o floor14.dxf 14th_floor_neeldhara_2.dwg

This script then walks the DXF, flattening every nested block reference into
world coordinates, and writes:

    source/builder-geometry.json    every line segment + text, by layer
    data/builder-dimensions.json    every DIMENSION entity with its measurement

Only the flattening is interesting.  The floor is assembled from unit blocks
inserted at scale 1000 from far-away origins, so nothing useful sits directly
in model space -- there are 14 INSERTs and one TEXT, and everything else is
several levels down.
"""

import collections
import json
import math
import os
import sys

import ezdxf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source')
DATA = os.path.join(HERE, '..', 'data')


def flatten(doc):
    segs, texts, skipped = [], [], collections.Counter()

    def polyline(layer, pts, closed):
        pts = list(pts)
        for i in range(len(pts) - 1):
            segs.append((layer, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
        if closed and len(pts) > 2:
            segs.append((layer, pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))

    def walk(entities, m, depth=0):
        if depth > 12:
            return
        for e in entities:
            t, lay = e.dxftype(), e.dxf.layer
            try:
                if t == 'INSERT':
                    blk = doc.blocks.get(e.dxf.name)
                    if blk is not None:
                        nm = (m @ e.matrix44()) if m is not None else e.matrix44()
                        walk(blk, nm, depth + 1)
                elif t == 'LINE':
                    a, b = e.dxf.start, e.dxf.end
                    if m is not None:
                        a, b = m.transform(a), m.transform(b)
                    segs.append((lay, a[0], a[1], b[0], b[1]))
                elif t in ('LWPOLYLINE', 'POLYLINE'):
                    if t == 'LWPOLYLINE':
                        pts = list(e.get_points('xy'))
                        closed = bool(e.closed)
                    else:
                        pts = [(v.dxf.location[0], v.dxf.location[1]) for v in e.vertices]
                        closed = e.is_closed
                    if m is not None:
                        pts = [tuple(m.transform((p[0], p[1], 0)))[:2] for p in pts]
                    polyline(lay, pts, closed)
                elif t in ('ARC', 'CIRCLE', 'ELLIPSE', 'SPLINE'):
                    if t == 'CIRCLE':
                        c, r = e.dxf.center, e.dxf.radius
                        pts = [(c[0] + r * math.cos(a), c[1] + r * math.sin(a))
                               for a in (i * math.pi / 18 for i in range(37))]
                    else:
                        pts = [tuple(p)[:2] for p in e.flattening(5)]
                    if m is not None:
                        pts = [tuple(m.transform((p[0], p[1], 0)))[:2] for p in pts]
                    polyline(lay, pts, False)
                elif t in ('TEXT', 'MTEXT', 'ATTRIB'):
                    s = e.plain_text() if hasattr(e, 'plain_text') else e.dxf.text
                    p = e.dxf.insert
                    if m is not None:
                        p = m.transform(p)
                    h = getattr(e.dxf, 'height', 0) or getattr(e.dxf, 'char_height', 0)
                    texts.append((lay, p[0], p[1], h, s))
                elif t == 'SOLID':
                    pts = [(p[0], p[1]) for p in
                           (e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx3, e.dxf.vtx2)]
                    if m is not None:
                        pts = [tuple(m.transform((p[0], p[1], 0)))[:2] for p in pts]
                    polyline(lay, pts, True)
                else:
                    skipped[t] += 1
            except Exception:
                skipped[t + ':error'] += 1

    walk(doc.modelspace(), None)
    return segs, texts, skipped


def dimensions(doc):
    """Every DIMENSION with its world position and measured value.

    Dimension entities carry no rotation here, so tracking scale + offset down
    the insert chain is enough and avoids ezdxf's OCS handling for DIMENSION.
    """
    out = []

    def walk(entities, sx, sy, ox, oy, depth=0):
        if depth > 10:
            return
        for e in entities:
            if e.dxftype() == 'INSERT':
                blk = doc.blocks.get(e.dxf.name)
                if blk is None:
                    continue
                base = blk.block.dxf.base_point
                walk(blk,
                     sx * e.dxf.xscale, sy * e.dxf.yscale,
                     ox + sx * (e.dxf.insert[0] - base[0] * e.dxf.xscale),
                     oy + sy * (e.dxf.insert[1] - base[1] * e.dxf.yscale),
                     depth + 1)
            elif e.dxftype() == 'DIMENSION':
                try:
                    tm = e.dxf.text_midpoint
                except Exception:
                    continue
                out.append({
                    'x': ox + sx * tm[0],
                    'y': oy + sy * tm[1],
                    'measurement': e.dxf.get('actual_measurement', 0),
                    'override': e.dxf.get('text', ''),
                })

    walk(doc.modelspace(), 1, 1, 0, 0)
    return out


def main(dxf_path):
    doc = ezdxf.readfile(dxf_path)
    segs, texts, skipped = flatten(doc)
    dims = dimensions(doc)

    per_layer = collections.Counter(s[0] for s in segs)
    print(f'{len(segs)} segments, {len(texts)} texts, {len(dims)} dimensions')
    print('skipped:', dict(skipped))
    for lay, n in per_layer.most_common():
        print(f'   {lay:26s} {n}')

    # Loose furniture is 87% of the segments and says nothing about the shell,
    # so it is dropped; everything else is kept, clipped to the 14th floor.
    drop = {'DA_FURNITURE', 'DA_FURNITURE HIDDEN'}
    box = (40000, 10000, 135000, 75000)

    def inside(a, b, c, e):
        return (box[0] <= min(a, c) and max(a, c) <= box[2]
                and box[1] <= min(b, e) and max(b, e) <= box[3])

    segs = [s for s in segs if s[0] not in drop and inside(*s[1:])]
    texts = [t for t in texts if box[0] <= t[1] <= box[2] and box[1] <= t[2] <= box[3]]
    print(f'kept {len(segs)} segments, {len(texts)} texts')

    with open(os.path.join(SRC, 'builder-geometry.json'), 'w') as fh:
        json.dump({'segs': segs, 'texts': texts}, fh)
    with open(os.path.join(DATA, 'builder-dimensions.json'), 'w') as fh:
        json.dump(dims, fh, indent=1)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(SRC, 'floor14.dxf'))
