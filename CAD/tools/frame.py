"""
Common measurement frame for comparing the builder's CAD against plan A-101.

The two drawings are in different coordinate systems and orientations:

  * The builder's DWG holds the whole 14th floor.  The two mirrored flats that
    make up this home sit in the west wing, running north-south, and are
    assembled from blocks `A$C1c7226e4` (north unit) and `14TH 2` (south unit),
    mirrored about the 150 mm party wall at CAD y = 44409.

  * Drawing A-101 has the merged home running east-west on an A1 sheet.

Everything below is reduced to one frame, in millimetres:

    X  = along the length of the home.
         0 = the outer wall centreline drawn at the left end of A-101.
         Increasing X runs towards the other master suite.
    Y  = depth.
         0 = the deck's outer parapet centreline drawn on A-101.
         Increasing Y runs towards the entrance / service side.

The two anchors used to lock CAD into this frame are structural and
unambiguous:

    * the party wall centreline (CAD y = 44409) is the mid-point of the home,
      which on A-101 is X = 12240 (= 24480 / 2);
    * the builder's 5780 mm main body runs CAD x = 62824 .. 68604, which on
      A-101 is Y = 2620 .. 8400.

Both anchors are confirmed by the DWG's own DIMENSION entities (5780 and the
2620 / 2450 depth chain), so the alignment is not a visual fit.
"""

import json
import os

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source')

# ---------------------------------------------------------------- CAD -> frame
CAD_X0 = 32169.0   # frame_X = cad_y - CAD_X0
CAD_Y0 = 60204.0   # frame_Y = cad_x - CAD_Y0


def cad(x, y):
    """CAD model-space mm -> frame mm."""
    return (y - CAD_X0, x - CAD_Y0)


# ---------------------------------------------------------------- PDF -> frame
# A-101 is a vector PDF.  The deck is drawn 1049.94 pt long and dimensioned
# 15020 mm, which fixes the scale exactly; every wall then falls on a round
# number (240 / 150 / 110 mm walls, 9170 wing depth, 24480 overall).
PT2MM = 15020.0 / 1049.94          # 14.30559 mm per PDF point
PDF_OX, PDF_OY = 267.73, 251.65    # PDF pt of the frame origin


def pdf(x, y):
    """A-101 PDF points -> frame mm."""
    return ((x - PDF_OX) * PT2MM, (y - PDF_OY) * PT2MM)


# ---------------------------------------------------------------- loaders
def load_cad(path=None, x0=58000, y0=29000, x1=75500, y1=60500):
    """Flattened builder geometry, clipped to the two units, in frame mm."""
    path = path or os.path.join(SRC, 'builder-geometry.json')
    with open(path) as fh:
        data = json.load(fh)
    segs = []
    for lay, a, b, c, e in data['segs']:
        if not (x0 <= min(a, c) and max(a, c) <= x1):
            continue
        if not (y0 <= min(b, e) and max(b, e) <= y1):
            continue
        p1, p2 = cad(a, b), cad(c, e)
        segs.append((lay, p1[0], p1[1], p2[0], p2[1]))
    texts = []
    for lay, tx, ty, h, s in data['texts']:
        if x0 <= tx <= x1 and y0 <= ty <= y1 and s.strip():
            p = cad(tx, ty)
            texts.append((lay, p[0], p[1], s))
    return segs, texts


MASONRY = (0.137, 0.129, 0.125)   # the black fill A-101's legend calls MASONRY


def load_pdf(path=None):
    """A-101 masonry rectangles and text, in frame mm."""
    path = path or os.path.join(SRC, 'floorplan-A101-rev101.pdf')
    page = fitz.open(path)[0]

    def near(a, b, tol=0.02):
        return a and all(abs(u - v) < tol for u, v in zip(a, b))

    walls = []
    for dr in page.get_drawings():
        if not near(dr.get('fill'), MASONRY):
            continue
        r = dr['rect']
        a, b = pdf(r.x0, r.y0), pdf(r.x1, r.y1)
        walls.append((a[0], a[1], b[0], b[1]))

    texts = []
    for blk in page.get_text('dict')['blocks']:
        for line in blk.get('lines', []):
            for span in line['spans']:
                p = pdf(*span['origin'])
                texts.append((p[0], p[1], span['size'] * PT2MM, span['text']))
    return walls, texts
