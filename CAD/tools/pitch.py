"""
The family pitch: one PDF, front to back.

    python3 tools/pitch.py

Reads  drawings/07-round1-layout.svg      (the review sheet, re-rastered hi-res)
       out/pitch/textured.png             (from pitch_textured.py)
       out/pitch/view-*.png               (from pitch_persp.py)
Writes out/OmNeeldhara-Family-Pitch.pdf

Every page is authored as SVG, converted through MuPDF so the type stays
vector, and merged.  Raster panels ride along as base64 data URIs, resized
to roughly 2x their placed size first so the file stays lean.
"""

import base64
import io
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fitz
from PIL import Image

PITCH = os.path.join(HERE, '..', 'out', 'pitch')
OUT = os.path.join(HERE, '..', 'out', 'OmNeeldhara-Family-Pitch.pdf')

PW, PH = 1500, 844                 # page, 16:9-ish

INK = '#26221c'
CREAM = '#f7f1e4'
CREAM2 = '#efe6d2'
ACCENT = '#8a6440'
TEAL = '#2c5c61'
GREY = '#847b6c'
RULE = '#c9bda4'

FONT = 'Helvetica,Arial,sans-serif'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


# ------------------------------------------------------------------ images
_plan_hires = None


def plan_hires():
    """The review sheet rendered once at high resolution, for room crops."""
    global _plan_hires
    if _plan_hires is None:
        svg = os.path.join(HERE, '..', 'drawings', '07-round1-layout.svg')
        pm = fitz.open(svg)[0].get_pixmap(matrix=fitz.Matrix(2.2, 2.2))
        _plan_hires = Image.frombytes('RGB', (pm.width, pm.height), pm.samples)
    return _plan_hires


# the review sheet's own mapping: Sheet(-3200,-2400,26600,16100,width=4200,pad=90)
_SC = (4200 - 180) / (26600 + 3200)


def plan_crop(a, b, c, d):
    """Crop the hi-res sheet by frame coordinates (mm)."""
    m = 2.2
    x0 = (90 + (a + 3200) * _SC) * m
    y0 = (90 + (b + 2400) * _SC) * m
    x1 = (90 + (c + 3200) * _SC) * m
    y1 = (90 + (d + 2400) * _SC) * m
    return plan_hires().crop((int(x0), int(y0), int(x1), int(y1)))


def uri(im, maxw):
    """A PIL image as a data URI, downscaled to maxw if wider."""
    if im.width > maxw:
        im = im.resize((maxw, int(maxw * im.height / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def uri_file(path, maxw):
    return uri(Image.open(path), maxw)


def wrap(t, n):
    out, line = [], ''
    for w in t.split():
        if len(line) + len(w) + 1 > n and line:
            out.append(line)
            line = w
        else:
            line = (line + ' ' + w).strip()
    if line:
        out.append(line)
    return out


# ------------------------------------------------------------------- pages
class Page:
    def __init__(self, bg=CREAM):
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" '
                  f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                  f'width="{PW}" height="{PH}">',
                  # numeric, not 100%: convert_to_pdf mis-sizes percentage
                  # rects and leaves a white band down the page
                  f'<rect x="0" y="0" width="{PW}" height="{PH}" '
                  f'fill="{bg}"/>']

    def text(self, x, y, s, size=15, col=INK, anchor='start', weight='normal',
             letter=0, style=None):
        ls = f' letter-spacing="{letter}"' if letter else ''
        st = f' font-style="{style}"' if style else ''
        self.o.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{col}" '
                      f'text-anchor="{anchor}" font-weight="{weight}" '
                      f'font-family="{FONT}"{ls}{st}>{esc(s)}</text>')

    def rule(self, x0, y, x1, col=RULE, w=1.2):
        self.o.append(f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" '
                      f'stroke="{col}" stroke-width="{w}"/>')

    def rect(self, x, y, w, h, fill='none', stroke='none', sw=1, rx=0):
        self.o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
                      f'rx="{rx}"/>')

    def image_fit(self, im_uri, iw, ih, x, y, w, h, frame=True):
        """Place an image inside a box, centred, aspect kept."""
        s = min(w / iw, h / ih)
        dw, dh = iw * s, ih * s
        dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
        self.o.append(f'<image x="{dx:.0f}" y="{dy:.0f}" width="{dw:.0f}" '
                      f'height="{dh:.0f}" xlink:href="{im_uri}"/>')
        if frame:
            self.rect(dx, dy, dw, dh, stroke='#b9ad94', sw=1.4)
        return dx, dy, dw, dh

    def header(self, no, title, sub=''):
        self.text(70, 78, f'{no:02d}', 30, ACCENT, weight='bold', letter=2)
        self.text(128, 78, title.upper(), 30, INK, weight='bold', letter=3)
        if sub:
            self.text(130, 106, sub, 15, GREY, letter=1)
        self.rule(70, 122, PW - 70)

    def footer(self, page_no):
        self.rule(70, PH - 52, PW - 70)
        self.text(70, PH - 30, 'OM NEELDHARA  ·  FLOOR 14  —  THE FAMILY PITCH',
                  11, GREY, letter=2)
        self.text(PW - 70, PH - 30, f'{page_no}', 13, GREY, anchor='end')

    def bullets(self, x, y, w, items, size=14.5, gap=9, col=INK):
        cy = y
        maxc = int(w / (size * 0.52))
        for head, body in items:
            lines = wrap(body, maxc)
            self.o.append(f'<circle cx="{x + 4}" cy="{cy - 5}" r="3.2" '
                          f'fill="{ACCENT}"/>')
            if head:
                self.text(x + 18, cy, head, size, INK, weight='bold')
                cy += size + 4
            for ln in lines:
                self.text(x + 18, cy, ln, size, col)
                cy += size + 4
            cy += gap
        return cy

    def svg(self):
        return '\n'.join(self.o) + '</svg>'


def caption(p, x, y, w, title, note):
    p.text(x, y, title.upper(), 12.5, TEAL, letter=2, weight='bold')
    p.text(x, y + 17, note, 11.5, GREY)


IND = ('indicative illustration — generated from the plan geometry, '
       'not a photograph')


# ================================================================== content
GREAT = [
    ('', 'One room from the gallery arch to the parapet: the party wall '
         'between the two flats is gone, and the great room, the deck and '
         'both pods read as a single 95 m² (1,020 sq ft) heart.'),
    ('The seating', 'A 2-seat recliner sofa with a tree growing off its west '
         'end, a single recliner, a rocking chair and an armchair — all '
         'centred on a hand-shaped rug, every seat within 1.7–3.3 m '
         '(5′-7″–10′-10″) of every other for one conversation.'),
    ('The console', 'Behind the sofa, 1600 × 350 mm (5′-3″ × 1′-2″): one '
         'lamp, two succulents, books and a bowl. The lamp is one of the '
         'three low lights that hold the room in the evening.'),
    ('The floor', 'The same 190 mm (7½″) timber boards run from inside the '
         'room, under the glass line, out across the deck — the floor '
         'refuses to admit where in ends and out begins.'),
    ('The apse', 'You enter through an arched portal in a semicircular '
         'sweep — crown at 7.5 m (24′-6″) on the axis — flanked by two '
         'art-deco wall sconces at the centres of the two arcs.'),
    ('The pods', 'Both pods stand behind curved glass screens with open '
         'portals — no doors anywhere on the main floor.'),
]

DECK = [
    ('', 'A 15.4 m (50′-7″) long, 2.6 m (8′-7″) deep all-weather deck — '
         'air-conditioned, glazed, with a retractable glass roof. It is '
         'not a balcony off the great room; it is the great room’s north '
         'half.'),
    ('The fountain', 'A marble fountain, 980 mm (3′-3″) of water, on the '
         'exact centre of the home. Every main seat faces it.'),
    ('The recliners', 'Two 2-seat recliners, 1600 × 900 mm (5′-3″ × 3′-0″), '
         'backs on the two retained voids, facing each other across the '
         'fountain — with side tables at their free arms.'),
    ('The spa', 'A 4-seat spa, 1750 mm (5′-9″) square, sunk in the east '
         'grass bed; the all-in-one gym, 1200 × 2000 mm (3′-11″ × 6′-7″), '
         'stands in the west one. Real grass grows under both.'),
    ('The planting', 'A 340 mm (1′-1″) planted strip runs the whole parapet '
         'under a trellis — greenery at the rail, fourteen floors up.'),
]

GALLERY = [
    ('', 'The entry is a U of 230 mm (9″) walls built on the two columns, '
         '3220 mm (10′-7″) wide and 3260 mm (10′-8″) deep, closed by a '
         'semicircular apse.'),
    ('Curved doors', 'The doors into the home slide along the arc itself — '
         'drawn shut they complete the circle, drawn open they vanish into '
         'the wall’s own curve.'),
    ('The console', 'On the west leg, 1400 × 450 mm (4′-7″ × 1′-6″), '
         'corners eased, mirror over — keys, letters and one lamp.'),
    ('Two chairs', 'On the east leg, 700 × 750 mm (2′-4″ × 2′-6″) each — '
         'a place to put shoes on, or for a guest to wait in comfort.'),
    ('The sconces', 'Two wall-mounted art-deco lamps at the centres of the '
         'apse arcs light the arrival — the first of the home’s low, warm '
         'evening lights.'),
]

KITCHEN = [
    ('', 'One working room of 11.7 m² (126 sq ft), kitchen and utility '
         'together, with the dry balcony as its service end.'),
    ('The hob run', 'Hob 600 × 510 mm (2′-0″ × 1′-8″) with 45 mm (2″) of '
         'counter clear front and back; the integrated dishwasher sits '
         'exactly beneath it.'),
    ('The sink run', 'Sink 600 × 450 mm (2′-0″ × 1′-6″), held 65 mm (2½″) '
         'off the blind corner so the drainer never fights the wall.'),
    ('The magic corner', 'The blind corner cabinet carries a pull-out '
         '“magic corner” — drawn on the plan both stowed and swung out, '
         'because hardware you cannot see is hardware you will not buy.'),
    ('The hatch', 'A 1100 mm (3′-7″) serving hatch opens through the wall '
         'into the family room — food passes, people don’t have to.'),
]

FAMILY = [
    ('', 'The west pod: 21.3 m² (230 sq ft) behind its curved glass '
         'screen, holding the six-seat dining table.'),
    ('The table', 'Six seats with the serving hatch directly behind — '
         'dinner lands on the table three steps from the hob.'),
    ('The portal', 'The pod’s open doorway was moved south on the '
         'parents’ side — Y 4700–5523 — so the walk from their suite '
         'lands straight at the table, never around it.'),
    ('The corner units', 'Curved corner joinery closes the pod’s square '
         'corners, echoing the screens — nothing in the two pods ends in '
         'a point.'),
    ('Glass roof', 'Like the den, the pod’s 3665 × 2280 mm (12′-0″ × '
         '7′-6″) bay carries a glass roof — daylight from above, deep in '
         'the plan.'),
]

DEN = [
    ('', 'The east pod is Karan’s: music and work in 21.3 m² (230 sq ft), '
         'behind the same curved glass.'),
    ('The work console', 'A long console runs Y 4800–7000 hard against the '
         'east screen — 2.2 m (7′-3″) of desk. It is why this pod’s portal '
         'cannot move: the door and the desk share one wall.'),
    ('The drums', 'The e-drum kit sits in the south-east corner, as far '
         'from both suites as the plan allows.'),
    ('Two recliners', 'Side by side, both facing north to the deck and '
         'the fountain — 800 × 900 mm (2′-8″ × 3′-0″) each, with a '
         'shared table between.'),
    ('The screen', 'Karan’s screen carries a 900 mm (3′-0″) wood dado '
         'with tinted glass over — privacy seated, connection standing.'),
]

PARENTS = [
    ('', 'The west wing: 32.5 m² (350 sq ft) in two zones — bed to the '
         'north, dressing to the south — split by a sliding partition.'),
    ('The partition', 'Brown tinted glass end to end: two bypass leaves of '
         '1591 mm (5′-3″) on a double track, no cupboard block and no '
         'pocket. Shut, two rooms that heat separately; open, one suite '
         'through the tint. Nothing swings, so nothing fouls the bath’s '
         'arch. The parents’ clothes hang in a full-height cupboard curled '
         'round the outside of that arch.'),
    ('Two baths in one cubicle', 'The arched sweep has moved 1600 mm '
         '(5′-3″) north, so the 1930 mm (6′-4″) cubicle is long enough for '
         'two baths: the parents’ under the arch, entered from the bed zone, '
         'and the grandmother’s at the south end, entered from her zone. A '
         'four-leaf folding wooden divider stands between them and folds back '
         'to make one long bath when she is away — she must not share a WC.'),
    ('The wall bed', 'The grandmother’s Murphy bed: a 400 mm (1′-4″) deep '
         'cabinet that is simply furniture 51 weeks a year — and folds '
         'down to a true QUEEN, 1500 × 2000 mm (4′-11″ × 6′-7″), when she '
         'stays. No nightly unfolding, no sofa-bed compromise.'),
    ('The sliders', 'The terrace wall is sliding glass end to end — '
         'open, the suite gains the terrace; shut, it is still all view.'),
    ('The bath', 'Behind an arched masonry sweep — 1930 mm (6′-4″) clear '
         '— a curved vanity with a 400 mm (1′-4″) bowl, WC and shower.'),
]

KARAN = [
    ('', 'The east wing mirrors the parents’ — 32.5 m² (350 sq ft) — '
         'then diverges in its joinery.'),
    ('The bed', 'A king, 1930 × 2032 mm (6′-4″ × 6′-8″), its headboard '
         'running window jamb to window jamb.'),
    ('The dressing screen', 'A wood-dado partition with tinted glass '
         'over — same language as the den’s screen, so his two rooms '
         'rhyme.'),
    ('The wardrobes', 'Two hanging wardrobes of 990 mm (3′-3″) each plus '
         'a dresser 750 mm (2′-6″) deep — a dresser is a place to sit at, '
         'not to hang in.'),
    ('The terrace', 'The same grass, tree and jhoola as the parents’ — '
         'see the terraces page.'),
]

BATHS = [
    ('', 'Three wet rooms, one language: every one enters through a '
         'curve, never a flat door in a flat wall.'),
    ('The master baths', 'Mirror images at 6.5 m² (69 sq ft): the arched '
         'sweep gives 1930 mm (6′-4″) clear, the vanity curves with the '
         'wall and carries a 400 mm (1′-4″) bowl.'),
    ('The guest WC', 'Its wall is a quarter-ellipse — the same geometry '
         'as the entry apse — with a curved console and 344 mm (1′-2″) '
         'bowl, a 900 mm (3′-0″) square shower, in 3.0 m² (33 sq ft).'),
    ('The pans', 'All three WCs are drawn at true size — 680 × 390 mm '
         '(2′-3″ × 1′-3″), pan and cistern — as is every appliance in '
         'the house. What you see is what fits.'),
    ('Service', 'Help’s room and its store are one room of 6.7 m² / 73 sq ft '
         'off the gallery, with its own door; the bunk lies at the east end.'),
]

TERRACES = [
    ('', 'Each suite ends in a terrace of 3.7 m² (40 sq ft) — real grass '
         'under a high glass roof, one tall tree in the centre line of '
         'each, planted in the open air.'),
    ('The tree', 'A real tree — frangipani or a short palm, 1.5–2 m '
         '(5′–6′-7″) — seen from the bed all year. The terrace roof is '
         'high glass: rain never lands, light always does.'),
    ('The jhoola', 'A single-seat swing on a 900 mm (3′-0″) frame with '
         '150 mm (6″) clear each side — the terrace’s one piece of '
         'furniture.'),
    ('In and out', 'The suite’s sliding glass opens the bedroom to the '
         'grass: the tree is “outside”, the bed is “inside”, and on a '
         'good evening the distinction stops mattering — which is the '
         'whole idea of the home.'),
]

ROOM_PAGES = [
    ('Great Room', 'the heart — with the deck, one room',
     (8300, 2350, 16250, 8600), GREAT,
     [('view-great-north', 'Standing under the arch, looking north — the '
                           'seating, the glass line, the deck and the '
                           'fountain beyond'),
      ('view-great-south', 'From the deck glass looking south — the '
                           'console, the apse and its two sconces'),
      ('view-great-east', 'Across the seating group from the west portal')]),
    ('All-Weather Deck', 'in but out — glazed, cooled, planted',
     (4300, -700, 20300, 3000), DECK,
     [('view-deck', 'Looking east down the deck — recliners on the voids, '
                    'the fountain mid-way, the spa far end'),
      ('view-deck-west', 'From the spa end looking west — the gym far, '
                         'grass both ends')]),
    ('Entry Gallery', 'a drum of wood, doors that slide on the arc',
     (9900, 7300, 14600, 11500), GALLERY,
     [('view-gallery', 'Standing at the front doors — the arch into the '
                       'great room, sconces lit')]),
    ('Kitchen', 'one working room, hatch to the table',
     (6300, 7500, 10100, 11400), KITCHEN,
     [('view-kitchen', 'The working run — counters both sides, the window '
                       'over the sink')]),
    ('Family Room', 'the west pod — dining behind curved glass',
     (3600, 2400, 8700, 8700), FAMILY,
     [('view-family', 'The six-seat table, the serving hatch open in the '
                      'south wall')]),
    ('Music + Work Den', 'the east pod — Karan’s',
     (15600, 2400, 20900, 8700), DEN,
     [('view-den', 'From the portal — recliners at the glass, the work '
                   'console down the east side'),
      ('view-den-in', 'From the deck glass looking in — the drums far '
                      'corner')]),
    ('Master Suite — Parents', 'two zones and a pocket of glass',
     (-800, 1600, 5100, 9300), PARENTS,
     [('view-suite-parents', 'From the partition, over the bed to the '
                             'terrace glass and its tree'),
      ('view-dressing', 'The dressing zone — the Murphy bed folded down, '
                        'cupboards along the partition')]),
    ('Master Suite — Karan', 'the east wing, mirrored then made his',
     (19400, 1600, 25400, 9300), KARAN,
     [('view-suite-karan', 'Over the king to the terrace glass — '
                           'headboard jamb to jamb')]),
    ('Baths + Service', 'every wet room enters through a curve',
     (10400, 7900, 13600, 11450), BATHS,
     [('view-bath', 'A master bath — the curved vanity, the shower '
                    'behind glass')]),
    ('The Terraces', 'a tree outside every bed',
     (-700, -600, 3200, 1800), TERRACES,
     [('view-terrace', 'Karan’s terrace — grass, the tree, the jhoola'),
      ('view-suite-terrace', 'Standing on the parents’ grass, looking '
                             'into the suite through the open sliders')]),
]


# =================================================================== build
def cover(p):
    p.rect(46, 46, PW - 92, PH - 92, stroke=ACCENT, sw=1.6)
    p.rect(54, 54, PW - 108, PH - 108, stroke=RULE, sw=0.8)
    p.text(PW / 2, 150, 'THE THAKKAR FAMILY HOME', 19, GREY, anchor='middle',
           letter=7)
    p.text(PW / 2, 226, 'OM NEELDHARA', 64, INK, anchor='middle',
           weight='bold', letter=16)
    p.text(PW / 2, 268, 'FLOOR 14  ·  A FULL-FLOOR RESIDENCE', 17, ACCENT,
           anchor='middle', letter=5)
    im = Image.open(os.path.join(PITCH, 'textured.png'))
    w, h = im.size
    band = im.crop((int(w * 0.17), int(h * 0.10), int(w * 0.86), int(h * 0.72)))
    u = uri(band, 2400)
    p.image_fit(u, band.width, band.height, 170, 300, PW - 340, 400)
    p.text(PW / 2, 748, 'IN AND OUT  ·  OPEN AND CLOSE  —  BOTH AT ONCE',
           15, TEAL, anchor='middle', letter=4)
    p.text(PW / 2, 776, 'prepared for the family  ·  August 2026', 13, GREY,
           anchor='middle', letter=1)


def index_page(p):
    p.header(0, 'Contents')
    rows = [
        ('01', 'The Idea — In & Out, Open & Close', '3'),
        ('02', 'The Plan — the whole floor, to scale', '4'),
        ('03', 'The Materials — the same floor, dressed', '5'),
    ]
    n = 4
    for i, (title, sub, crop, bullets, views) in enumerate(ROOM_PAGES):
        rows.append((f'{i + 4:02d}', f'{title} — {sub}', str(n)))
        n += 1 + (1 if views else 0)
    rows.append((f'{len(ROOM_PAGES) + 4:02d}', 'What Stays True — the rules '
                 'under the drawing', str(n)))
    y = 190
    for no, title, pg in rows:
        p.text(100, y, no, 16, ACCENT, weight='bold')
        p.text(150, y, title, 17, INK)
        p.text(PW - 100, y, pg, 16, GREY, anchor='end')
        p.rule(150, y + 12, PW - 100, col='#ded2b8', w=0.7)
        y += 44
    p.text(100, y + 30, 'Every room chapter is two pages: the plan and the '
                        'reasons, then the room as you would stand in it.',
           13.5, GREY, style='italic')


def philosophy(p):
    p.header(1, 'The Idea', 'in & out, open & close — both at once')
    x, w = 80, 640
    y = 180
    paras = [
        ('This home is designed around one deliberate contradiction.',
         'bold', 17),
        ('Every boundary that matters can be opened, and every one of them '
         'can be closed. The great room flows into the deck through one '
         'line of sliding glass; the pods sit behind curved screens with '
         'open portals; each suite opens to its own terrace through '
         'full-width sliders; even the parents’ dressing room is closed by '
         'a leaf of glass that disappears into the back of a cupboard.',
         'normal', 15),
        ('So is the deck inside or outside? It is glazed, cooled and '
         'floored in the same boards as the great room — but it is grass, '
         'a fountain and open planting at the rail. Is a pod open or '
         'private? Its glass curves around you, but its doorway has no '
         'door. The honest answer, until you look, is BOTH —',
         'normal', 15),
        ('a Schrödinger’s home: in and out at once, open and closed at '
         'once, and it only settles when you decide which you need '
         'that hour.',
         'bold', 15.5),
        ('Nothing here is a corridor, nothing is a dead door, and no room '
         'has only one way to be used. Close everything and eight rooms '
         'appear. Open everything and there is only one room, fifty '
         'metres of it, with a tree at each end.',
         'normal', 15),
    ]
    for txt, wt, sz in paras:
        for ln in wrap(txt, int(w / (sz * 0.52))):
            p.text(x, y, ln, sz, INK if wt == 'bold' else '#3a352c',
                   weight=wt)
            y += sz + 6
        y += 14

    # ---- the diagram: the openable house, drawn as nested zones
    dx, dy, dw, dh = 790, 170, 640, 540
    p.rect(dx, dy, dw, dh, fill=CREAM2, stroke=RULE, sw=1)
    p.text(dx + dw / 2, dy + 36, 'EVERY LINE HERE CAN OPEN', 14, TEAL,
           anchor='middle', letter=3, weight='bold')

    def zone(zx, zy, zw, zh, label, sub, dash=True):
        p.o.append(f'<rect x="{zx}" y="{zy}" width="{zw}" height="{zh}" '
                   f'rx="14" fill="#ffffff" fill-opacity="0.55" '
                   f'stroke="{ACCENT}" stroke-width="1.6"'
                   + (' stroke-dasharray="10 7"' if dash else '') + '/>')
        p.text(zx + zw / 2, zy + 24, label, 13.5, INK, anchor='middle',
               weight='bold', letter=1)
        if sub:
            p.text(zx + zw / 2, zy + 42, sub, 11, GREY, anchor='middle')

    def arrows(ax, ay, vertical=False):
        if vertical:
            p.o.append(f'<path d="M {ax} {ay - 16} L {ax} {ay + 16}" '
                       f'stroke="{TEAL}" stroke-width="2.4"/>')
            for s in (-1, 1):
                p.o.append(f'<path d="M {ax - 6} {ay + s * 10} L {ax} '
                           f'{ay + s * 16} L {ax + 6} {ay + s * 10}" '
                           f'stroke="{TEAL}" stroke-width="2.4" fill="none"/>')
        else:
            p.o.append(f'<path d="M {ax - 16} {ay} L {ax + 16} {ay}" '
                       f'stroke="{TEAL}" stroke-width="2.4"/>')
            for s in (-1, 1):
                p.o.append(f'<path d="M {ax + s * 10} {ay - 6} L '
                           f'{ax + s * 16} {ay} L {ax + s * 10} {ay + 6}" '
                           f'stroke="{TEAL}" stroke-width="2.4" fill="none"/>')

    zone(dx + 40, dy + 70, 170, 120, 'TERRACE', 'grass · tree · sky')
    zone(dx + 40, dy + 230, 170, 120, 'PARENTS’', 'suite')
    zone(dx + dw - 210, dy + 70, 170, 120, 'TERRACE', 'grass · tree · sky')
    zone(dx + dw - 210, dy + 230, 170, 120, 'KARAN’S', 'suite')
    zone(dx + 250, dy + 70, dw - 500, 120, 'DECK', 'glazed · cooled · grass',
         dash=False)
    zone(dx + 250, dy + 230, dw - 500, 120, 'GREAT ROOM', 'one floor through '
         'the glass', dash=False)
    zone(dx + 130, dy + 400, 170, 100, 'FAMILY POD', 'dining')
    zone(dx + dw - 300, dy + 400, 170, 100, 'DEN POD', 'music + work')
    arrows(dx + 125, dy + 210, vertical=True)          # terrace <-> parents
    arrows(dx + dw - 125, dy + 210, vertical=True)
    arrows(dx + dw / 2, dy + 210, vertical=True)       # deck <-> great room
    arrows(dx + 232, dy + 290)                         # parents <-> great
    arrows(dx + dw - 232, dy + 290)
    arrows(dx + 260, dy + 385, vertical=True)          # pods <-> great room
    arrows(dx + dw - 260, dy + 385, vertical=True)
    p.text(dx + dw / 2, dy + dh - 14, 'solid boxes never close · dashed '
           'lines are glass that slides away', 11.5, GREY, anchor='middle')


def plan_page(p):
    p.header(2, 'The Plan', 'the whole floor to scale — dimensions in '
             'millimetres, every column and shaft honoured')
    u = uri_file(os.path.join(HERE, '..', 'drawings', '07-round1-layout.png'),
                 2700)
    im = Image.open(os.path.join(HERE, '..', 'drawings',
                                 '07-round1-layout.png'))
    p.image_fit(u, im.width, im.height, 70, 140, PW - 140, PH - 230,
                frame=False)
    p.text(PW / 2, PH - 66, 'total of named rooms 232.5 m² (2,503 sq ft) — '
           'the architect’s DXF version of this sheet carries every layer',
           12.5, GREY, anchor='middle')


def textured_page(p):
    p.header(3, 'The Materials', 'the same floor, dressed — oak, stone, '
             'grass, glass and warm light')
    path = os.path.join(PITCH, 'textured.png')
    im = Image.open(path)
    u = uri(im, 2700)
    p.image_fit(u, im.width, im.height, 70, 140, PW - 140, PH - 230,
                frame=False)
    p.text(PW / 2, PH - 66, 'timber where you sit, stone where water runs, '
           'grass where the sky is — and the fourteen red columns the whole '
           'plan honours', 12.5, GREY, anchor='middle')


def room_page(p, no, title, sub, crop, bullets):
    p.header(no, title, sub)
    im = plan_crop(*crop)
    u = uri(im, 1700)
    dx, dy, dw, dh = p.image_fit(u, im.width, im.height, 60, 150, 810,
                                 PH - 240)
    p.text(dx + 4, dy + dh + 24, 'from the working plan — true to scale',
           11.5, GREY)
    p.bullets(920, 190, PW - 990, bullets)


def views_page(p, no, title, views):
    p.header(no, title, 'standing in it — indicative, drawn from the plan’s '
             'own geometry')
    n = len(views)
    if n == 1:
        nm, cap = views[0]
        path = os.path.join(PITCH, nm + '.png')
        im = Image.open(path)
        u = uri(im, 2000)
        dx, dy, dw, dh = p.image_fit(u, im.width, im.height, 200, 150,
                                     PW - 400, PH - 280)
        caption(p, dx, dy + dh + 26, dw, cap, IND)
    elif n == 2:
        for i, (nm, cap) in enumerate(views):
            path = os.path.join(PITCH, nm + '.png')
            im = Image.open(path)
            u = uri(im, 1500)
            x = 70 + i * (PW / 2 - 40)
            dx, dy, dw, dh = p.image_fit(u, im.width, im.height, x, 170,
                                         PW / 2 - 105, PH - 320)
            caption(p, dx, dy + dh + 26, dw, cap, IND)
    else:
        nm, cap = views[0]
        im = Image.open(os.path.join(PITCH, nm + '.png'))
        u = uri(im, 1500)
        dx, dy, dw, dh = p.image_fit(u, im.width, im.height, 330, 145,
                                     PW - 660, 380)
        caption(p, dx, dy + dh + 8, dw, cap, IND)
        for i, (nm, cap) in enumerate(views[1:3]):
            im = Image.open(os.path.join(PITCH, nm + '.png'))
            u = uri(im, 1100)
            x = 120 + i * (PW / 2 - 60)
            dx, dy, dw, dh = p.image_fit(u, im.width, im.height, x, 566,
                                         PW / 2 - 180, 180)
            caption(p, dx, dy + dh + 8, dw, cap, '')


def back_page(p, no):
    p.header(no, 'What Stays True', 'the rules under the drawing')
    items = [
        ('The shell is honest', 'The flat came as a bare shell. Every wall '
         'in this plan is new, every opening is a gap left in a new wall — '
         'nothing is cut into the building.'),
        ('The structure is sacred', 'All 14 columns, every beam, all eight '
         'shafts, ducts and voids are exactly where the builder left them. '
         'An automated check runs on every change and must pass before '
         'anything is drawn.'),
        ('Everything is true to size', 'Every appliance, fixture and piece '
         'of furniture is drawn at its real catalogue size — beds, WCs, '
         'recliner footrests included. What you see fitting, fits.'),
        ('One source, two drawings', 'This pitch and the architect’s DXF '
         'are generated from the same source. The pretty version cannot '
         'drift from the buildable one.'),
        ('What is still open', 'Deck loading (spa, fountain, grass, roof) '
         'and the glass roofs need the structural engineer’s sign-off — '
         'neither changes the layout.'),
    ]
    p.bullets(120, 210, 800, items, size=16, gap=18)
    p.text(120, PH - 110, 'Drawn for the family, August 2026.', 15, ACCENT,
           weight='bold')


def main():
    doc = fitz.open()

    def add(build, *a, footer=None):
        p = Page()
        build(p, *a)
        if footer:
            p.footer(footer)
        pg = fitz.open('svg', p.svg().encode())
        pdf = fitz.open('pdf', pg.convert_to_pdf())
        doc.insert_pdf(pdf)

    add(lambda p: cover(p))
    add(lambda p: index_page(p), footer=2)
    add(lambda p: philosophy(p), footer=3)
    add(lambda p: plan_page(p), footer=4)
    add(lambda p: textured_page(p), footer=5)
    n = 6
    for i, (title, sub, crop, bullets, views) in enumerate(ROOM_PAGES):
        add(lambda p, i=i, n=n: room_page(p, i + 4, title, sub, crop,
                                          bullets), footer=n)
        n += 1
        if views:
            add(lambda p, i=i, n=n, t=title, v=views:
                views_page(p, i + 4, t, v), footer=n)
            n += 1
    add(lambda p, n=n: back_page(p, len(ROOM_PAGES) + 4), footer=n)

    doc.save(OUT, garbage=3, deflate=True)
    print('wrote', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB,',
          len(doc), 'pages')


if __name__ == '__main__':
    main()
