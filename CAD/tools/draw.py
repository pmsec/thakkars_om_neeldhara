"""
Draws the builder's CAD on top of plan A-101, in the common frame.

    python3 tools/draw.py

Output goes to drawings/.  Grey = A-101 as drawn.  Black = the builder's
walls.  Red = the builder's columns, which A-101 does not show at all.
"""

import os
import sys

import fitz

import frame

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'drawings')

CAD_COLOUR = {
    'DA_WALL': ('#111', 3.0, 'builder wall'),
    'DA_COLUMN': ('#e00000', 3.0, 'builder column'),
    'DA_WINDOW': ('#0aa07a', 1.2, 'window'),
    'DA_DOOR': ('#e08000', 1.2, 'door'),
    'DA_RAILING': ('#0088cc', 1.2, 'railing / parapet'),
    'DA_CHAJJA': ('#00aaaa', 1.0, 'chajja over'),
    'DA_BUILDING LINE': ('#cc00cc', 1.0, 'building line'),
    'DA_HATCH': ('#777', 1.2, 'shaft / sunk slab'),
    'DA_ELEVATION FEATURE': ('#8888ee', 1.0, 'louvre / feature'),
}


class Sheet:
    def __init__(self, x0, y0, x1, y1, width=2400, pad=70):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.sc = (width - 2 * pad) / (x1 - x0)
        self.w = width
        self.h = int((y1 - y0) * self.sc) + 2 * pad
        self.pad = pad
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" '
                  f'height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                  f'<rect width="100%" height="100%" fill="#ffffff"/>']

    def X(self, v):
        return self.pad + (v - self.x0) * self.sc

    def Y(self, v):
        return self.pad + (v - self.y0) * self.sc

    def grid(self, step=1000, major=5000):
        g = int(self.x0 // step) * step
        while g <= self.x1:
            if g >= self.x0:
                maj = g % major == 0
                self.o.append(
                    f'<line x1="{self.X(g):.1f}" y1="0" x2="{self.X(g):.1f}" '
                    f'y2="{self.h}" stroke="{"#a8c8e0" if maj else "#eeeeee"}" '
                    f'stroke-width="{1.0 if maj else 0.5}"/>')
                if maj:
                    self.o.append(f'<text x="{self.X(g) + 3:.1f}" y="16" '
                                  f'font-size="13" fill="#4488bb">{g}</text>')
            g += step
        g = int(self.y0 // step) * step
        while g <= self.y1:
            if g >= self.y0:
                maj = g % major == 0
                self.o.append(
                    f'<line x1="0" y1="{self.Y(g):.1f}" x2="{self.w}" '
                    f'y2="{self.Y(g):.1f}" stroke="{"#a8c8e0" if maj else "#eeeeee"}" '
                    f'stroke-width="{1.0 if maj else 0.5}"/>')
                if maj:
                    self.o.append(f'<text x="4" y="{self.Y(g) - 4:.1f}" '
                                  f'font-size="13" fill="#4488bb">{g}</text>')
            g += step

    def proposal(self, walls):
        for a, b, c, d in walls:
            if c < self.x0 or a > self.x1 or d < self.y0 or b > self.y1:
                continue
            self.o.append(
                f'<rect x="{self.X(a):.1f}" y="{self.Y(b):.1f}" '
                f'width="{max((c - a) * self.sc, 0.6):.1f}" '
                f'height="{max((d - b) * self.sc, 0.6):.1f}" '
                f'fill="#8fa3b8" fill-opacity="0.85"/>')

    def builder(self, segs, scale=1.0):
        for lay, a, b, c, d in segs:
            spec = CAD_COLOUR.get(lay)
            if not spec:
                continue
            if max(a, c) < self.x0 or min(a, c) > self.x1:
                continue
            if max(b, d) < self.y0 or min(b, d) > self.y1:
                continue
            col, lw, _ = spec
            self.o.append(
                f'<line x1="{self.X(a):.1f}" y1="{self.Y(b):.1f}" '
                f'x2="{self.X(c):.1f}" y2="{self.Y(d):.1f}" '
                f'stroke="{col}" stroke-width="{lw * scale:.1f}"/>')

    def labels(self, cad_texts, pdf_texts, size=11):
        for lay, a, b, s in cad_texts:
            if not (self.x0 <= a <= self.x1 and self.y0 <= b <= self.y1):
                continue
            for i, ln in enumerate(s.split('\n')):
                self.o.append(f'<text x="{self.X(a):.1f}" y="{self.Y(b) + i * size:.1f}" '
                              f'font-size="{size}" fill="#bb0000">{esc(ln)}</text>')
        for a, b, sz, s in pdf_texts:
            if not (self.x0 <= a <= self.x1 and self.y0 <= b <= self.y1) or not s.strip():
                continue
            self.o.append(f'<text x="{self.X(a):.1f}" y="{self.Y(b):.1f}" '
                          f'font-size="{size - 1}" fill="#004466">{esc(s)}</text>')

    def note(self, lines, size=19):
        y = self.h - 14 - size * len(lines)
        self.o.append(f'<rect x="0" y="{y - size:.1f}" width="{self.w}" '
                      f'height="{size * (len(lines) + 1) + 14:.1f}" fill="#ffffff" '
                      f'fill-opacity="0.92"/>')
        for ln in lines:
            self.o.append(f'<text x="{self.pad}" y="{y:.1f}" font-size="{size}" '
                          f'fill="#222">{esc(ln)}</text>')
            y += size

    def callout(self, x, y, text, colour='#cc0000'):
        self.o.append(f'<text x="{self.X(x):.1f}" y="{self.Y(y):.1f}" font-size="16" '
                      f'font-weight="bold" fill="{colour}">{esc(text)}</text>')

    def marker(self, x0, y0, x1, y1, colour='#cc0000'):
        self.o.append(
            f'<rect x="{self.X(x0):.1f}" y="{self.Y(y0):.1f}" '
            f'width="{(x1 - x0) * self.sc:.1f}" height="{(y1 - y0) * self.sc:.1f}" '
            f'fill="none" stroke="{colour}" stroke-width="2.5" stroke-dasharray="8 5"/>')

    def save(self, name):
        self.o.append('</svg>')
        svg = os.path.join(OUT, name + '.svg')
        with open(svg, 'w') as fh:
            fh.write('\n'.join(self.o))
        fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(1.25, 1.25)).save(
            os.path.join(OUT, name + '.png'))
        print('wrote', name)


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


LEGEND = [
    'GREY = plan A-101 as drawn      BLACK = builder wall      RED = builder column (A-101 shows none)',
    'CYAN = railing / parapet      GREEN = window      ORANGE = door      MAGENTA = building line      GREY LINE = shaft / sunk slab',
    'Grid 1 m; figures in millimetres.  X = along the home, Y = depth from the deck parapet.',
]


def main():
    segs, ctxt = frame.load_cad()
    walls, ptxt = frame.load_pdf()

    # ---------------------------------------------------------- whole home
    s = Sheet(-2000, -1200, 26400, 12400, width=3600)
    s.grid()
    s.proposal(walls)
    s.builder(segs, scale=0.8)
    s.marker(-600, -300, 0, 10400)
    s.marker(24480, -300, 25080, 10400)
    s.callout(-1900, -700, 'A-101 stops here')
    s.callout(24700, -700, 'A-101 stops here')
    s.callout(-1900, 11700, 'the builder shell is 25 680 mm long; A-101 draws 24 720 mm  '
                            '- 960 mm of real home is missing, 480 mm at each end')
    s.note(LEGEND)
    s.save('01-overlay-whole-home')

    # ---------------------------------------------------------- wing end
    s = Sheet(18200, -1000, 26200, 4400, width=2400)
    s.grid(500, 2000)
    s.proposal(walls)
    s.builder(segs)
    s.marker(21355, 320, 21580, 1200)
    s.labels(ctxt, ptxt)
    s.note(['End of the master-suite wing.  A-101 draws its SEALED SHAFT 1530 x 1350 at X 19750-21280, Y 200-1550;',
            'the builder shaft is 1530 x 1050 at X 20100-21580, Y 150-1200.  The dashed box is real open shaft',
            'that A-101 draws as terrace floor.  The end wall centreline is 525 mm further out than drawn.']
           + LEGEND[:1])
    s.save('02-wing-end-and-sealed-shaft')

    # ---------------------------------------------------------- deck + void
    s = Sheet(12600, -1000, 19400, 4400, width=2400)
    s.grid(500, 2000)
    s.proposal(walls)
    s.builder(segs)
    s.marker(16750, 1200, 16980, 2700)
    s.labels(ctxt, ptxt)
    s.note(['The retained void.  Builder set-out along the deck is 3050 + 1535 + 3050;',
            'A-101 says 2875 + 1585 + 3050.  The dashed box is a 230 x 1500 column that',
            'A-101 draws as a 150 mm wall.'] + LEGEND[:1])
    s.save('03-deck-and-retained-void')

    # ---------------------------------------------------------- entry / lobby
    s = Sheet(6800, 7000, 20600, 13400, width=3000)
    s.grid(500, 2000)
    s.proposal(walls)
    s.builder(segs)
    s.marker(10400, 9325, 10630, 11125)
    s.marker(13850, 9325, 14080, 11125)
    s.labels(ctxt, ptxt)
    s.note(['The absorbed lobby.  The two dashed 230 x 1800 columns are the real edges of',
            'the lift lobby - 3220 mm clear between them, not the 4125 mm A-101 draws.',
            'Below Y 11125 is the lift landing, outside the flat line.'] + LEGEND[:1])
    s.save('04-entry-lobby-and-east-bay')

    # ---------------------------------------------------------- floor context
    data_segs, data_txt = frame.load_cad(x0=40000, y0=10000, x1=135000, y1=75000)
    xs = [v for t in data_segs for v in (t[1], t[3])]
    ys = [v for t in data_segs for v in (t[2], t[4])]
    s = Sheet(min(xs) - 500, min(ys) - 500, max(xs) + 500, max(ys) + 500, width=3200)
    s.grid(5000, 20000)
    s.builder(data_segs, scale=0.55)
    s.labels(data_txt, [], size=9)
    s.note(['The whole 14th floor from the builder DWG, in the same frame.',
            'The merged home is the pair of mirrored units around X 0-25000, Y 0-11000.'])
    s.save('05-builder-14th-floor-context')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
