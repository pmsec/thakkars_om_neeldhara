#!/usr/bin/env python3
"""
Full-floor residence — two mirrored 2BHK flats merged into one home.
Presentation furniture-layout plan. Model units = millimetres.
Screen y increases downward (axis inverted), so 'north' = -y.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import (Polygon, Rectangle, Circle, Arc, Ellipse,
                                FancyBboxPatch)

# --------------------------------------------------------------- palette
PAPER    = "#F5F3EE"
INK      = "#232120"
WOOD     = "#E5D8C2"
WOODL    = "#D4C3A7"
STONE    = "#DBDFDB"
STONEL   = "#C5CAC5"
DECKC    = "#D5CDBD"
DECKL    = "#BFB5A1"
SERV     = "#EBE6DC"
SERVL    = "#D9D2C3"
GREEN    = "#94AD8F"
GREEND   = "#6C8B6A"
GLASS    = "#3F7A8C"
ACCENT   = "#2C5C61"
OCHRE    = "#A07A38"
FURN     = "#A79E90"
FURNF    = "#FCFBF8"
SOFT     = "#EFE8DA"
TXT      = "#2A2724"
TXT2     = "#7B756B"
FAINT    = "#9C968C"

SANS, SERIF = "TeX Gyre Heros", "Lora"

# ---- unit conversion -------------------------------------------------
def FT(mm):
    """millimetres -> feet-inches string"""
    inch = mm/25.4
    f = int(inch//12); i = int(round(inch - f*12))
    if i == 12: f, i = f+1, 0
    return f"{f}'-{i}\""
def SF(*mm):
    """mm^2 (or w,d in mm) -> whole square feet"""
    a = mm[0] if len(mm) == 1 else mm[0]*mm[1]
    return int(round(a*1.07639e-5))
def DIM(w, d, area=True):
    s = f"{w:,.0f} × {d:,.0f} mm  ·  {FT(w)} × {FT(d)}".replace(",", " ")
    return s + (f"  ·  {SF(w,d)} sq ft" if area else "")

# ---- curved pod walls: bow AWAY from the great room -------------------
PODP = ((8395., 2620.), (7350., 5300.), (7000., 8400.))
PODK = ((16085., 2620.), (17130., 5300.), (17480., 8400.))
def BZ(P, t):
    u = 1-t
    return (u*u*P[0][0] + 2*u*t*P[1][0] + t*t*P[2][0],
            u*u*P[0][1] + 2*u*t*P[1][1] + t*t*P[2][1])
def BZT(P, y):
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo+hi)/2
        if BZ(P, mid)[1] < y: lo = mid
        else: hi = mid
    return (lo+hi)/2
def PX(P, y):
    return BZ(P, BZT(P, y))[0]
T_EXT, T_INT, T_THIN = 240, 150, 110

fig = plt.figure(figsize=(32.0, 18.6), dpi=100)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(-3100, 27900)
ax.set_ylim(15900, -3600)
ax.set_aspect("equal")
ax.axis("off")
fig.patch.set_facecolor(PAPER)

Z = dict(floor=1, pat=2, tint=2.5, rug=3, furn=4, wall=6, cut=6.5,
         glass=7, door=8, dim=9, text=10)

TEXTS, FURNS = [], []

# --------------------------------------------------------------- primitives
def rect(x, y, w, h, **kw):
    p = Rectangle((x, y), w, h, **kw); ax.add_patch(p); return p

def poly(pts, **kw):
    kw.setdefault("closed", True)
    p = Polygon(np.asarray(pts, float), **kw); ax.add_patch(p); return p

def floor(x, y, w, h, fc, pattern=None, sp=300, lc=None, lw=0.7):
    rect(x, y, w, h, fc=fc, ec="none", zorder=Z["floor"])
    if pattern is None:
        return
    clip = Rectangle((x, y), w, h, transform=ax.transData)
    lc = lc or WOODL
    if pattern == "plank":
        n = int(h // sp) + 1
        for i in range(1, n):
            ln, = ax.plot([x, x+w], [y+i*sp]*2, color=lc, lw=lw,
                          zorder=Z["pat"], solid_capstyle="butt")
            ln.set_clip_path(clip)
        rng = np.random.default_rng(int(abs(x)+abs(y)) % 9973)
        for i in range(n):
            for f in (0.28, 0.66):
                xx = x + (f + rng.uniform(-0.09, 0.09)) * w
                ln, = ax.plot([xx, xx], [y+i*sp, y+(i+1)*sp], color=lc,
                              lw=lw*0.85, zorder=Z["pat"], solid_capstyle="butt")
                ln.set_clip_path(clip)
    elif pattern == "board":
        for i in range(1, int(w // sp) + 1):
            ln, = ax.plot([x+i*sp]*2, [y, y+h], color=lc, lw=lw,
                          zorder=Z["pat"], solid_capstyle="butt")
            ln.set_clip_path(clip)
    elif pattern == "grid":
        for i in range(1, int(w // sp) + 1):
            ln, = ax.plot([x+i*sp]*2, [y, y+h], color=lc, lw=lw, zorder=Z["pat"])
            ln.set_clip_path(clip)
        for i in range(1, int(h // sp) + 1):
            ln, = ax.plot([x, x+w], [y+i*sp]*2, color=lc, lw=lw, zorder=Z["pat"])
            ln.set_clip_path(clip)
    elif pattern == "diag":
        d = sp
        for k in range(int((w+h)//d)+2):
            ln, = ax.plot([x+k*d-h, x+k*d], [y+h, y], color=lc, lw=lw, zorder=Z["pat"])
            ln.set_clip_path(clip)

def wall(x1, y1, x2, y2, t=T_INT, openings=()):
    L = float(np.hypot(x2-x1, y2-y1))
    if L == 0: return
    ux, uy = (x2-x1)/L, (y2-y1)/L
    px, py = -uy, ux
    cuts = [0.0]
    for a, b in sorted(openings):
        cuts += [max(0.0, a), min(L, b)]
    cuts.append(L)
    h = t/2
    for i in range(0, len(cuts)-1, 2):
        a, b = cuts[i], cuts[i+1]
        if b - a <= 1: continue
        ax_, ay_ = x1+ux*a, y1+uy*a
        bx_, by_ = x1+ux*b, y1+uy*b
        poly([(ax_+px*h, ay_+py*h), (bx_+px*h, by_+py*h),
              (bx_-px*h, by_-py*h), (ax_-px*h, ay_-py*h)],
             fc=INK, ec="none", zorder=Z["wall"])

def cut(x1, y1, x2, y2, t=T_EXT):
    """Punch a visual opening through an already-drawn wall."""
    L = float(np.hypot(x2-x1, y2-y1))
    ux, uy = (x2-x1)/L, (y2-y1)/L
    px, py = -uy, ux
    h = t/2 + 12
    poly([(x1+px*h, y1+py*h), (x2+px*h, y2+py*h),
          (x2-px*h, y2-py*h), (x1-px*h, y1-py*h)],
         fc=PAPER, ec="none", zorder=Z["cut"])

def doorway(x1, y1, x2, y2, hinge=0, side=1, punch=None):
    """Door in the opening (x1,y1)-(x2,y2). side=+1 swings toward left normal."""
    if punch: cut(x1, y1, x2, y2, punch)
    L = float(np.hypot(x2-x1, y2-y1))
    ux, uy = (x2-x1)/L, (y2-y1)/L
    nx, ny = -uy*side, ux*side
    (hx, hy) = (x1, y1) if hinge == 0 else (x2, y2)
    (ox, oy) = (x2, y2) if hinge == 0 else (x1, y1)
    tx, ty = hx + nx*L, hy + ny*L
    ax.plot([hx, tx], [hy, ty], color=INK, lw=1.7, zorder=Z["door"],
            solid_capstyle="round")
    a_t = np.degrees(np.arctan2(ty-hy, tx-hx)) % 360
    a_o = np.degrees(np.arctan2(oy-hy, ox-hx)) % 360
    t1, t2 = (a_t, a_o) if (a_o - a_t) % 360 <= 180 else (a_o, a_t)
    ax.add_patch(Arc((hx, hy), 2*L, 2*L, theta1=t1, theta2=t2,
                     color="#756E64", lw=0.9, ls=(0, (4, 3)), zorder=Z["door"]))

def opening(x1, y1, x2, y2, arch=False, punch=None):
    """Cased opening; optional arch indication."""
    if punch: cut(x1, y1, x2, y2, punch)
    L = float(np.hypot(x2-x1, y2-y1))
    ux, uy = (x2-x1)/L, (y2-y1)/L
    nx, ny = -uy, ux
    for (px_, py_) in ((x1, y1), (x2, y2)):
        ax.plot([px_-nx*95, px_+nx*95], [py_-ny*95, py_+ny*95],
                color=INK, lw=1.4, zorder=Z["door"])
    if arch:
        th = np.linspace(0, np.pi, 60)
        mx, my = (x1+x2)/2, (y1+y2)/2
        cx = mx + ux*(-L/2)*np.cos(th)*-1
        ax.plot(mx + ux*(L/2)*np.cos(th), my + uy*(L/2)*np.cos(th) + ny*0,
                color=ACCENT, lw=0, zorder=Z["door"])
        pts_x = mx - ux*(L/2)*np.cos(th) + nx*(L*0.34)*np.sin(th)
        pts_y = my - uy*(L/2)*np.cos(th) + ny*(L*0.34)*np.sin(th)
        ax.plot(pts_x, pts_y, color=ACCENT, lw=1.5, ls=(0, (5, 4)), zorder=Z["door"])

def slider(x1, y1, x2, y2, punch=None):
    if punch: cut(x1, y1, x2, y2, punch)
    L = np.hypot(x2-x1, y2-y1)
    ux, uy = (x2-x1)/L, (y2-y1)/L
    nx, ny = -uy, ux
    for k, off in ((0.5, 70), (0.5, -70)):
        ax.plot([x1+nx*off, x1+ux*L*k+nx*off], [y1+ny*off, y1+uy*L*k+ny*off],
                color=GLASS, lw=2.4, zorder=Z["door"], solid_capstyle="butt")
        ax.plot([x1+ux*L*k-nx*off, x2-nx*off], [y1+uy*L*k-ny*off, y2-ny*off],
                color=GLASS, lw=2.4, zorder=Z["door"], solid_capstyle="butt")

def window(x1, y1, x2, y2, t=T_EXT):
    cut(x1, y1, x2, y2, t)
    L = np.hypot(x2-x1, y2-y1)
    ux, uy = (x2-x1)/L, (y2-y1)/L
    nx, ny = -uy, ux
    for k in (-0.30, 0.30):
        ax.plot([x1+nx*t*k, x2+nx*t*k], [y1+ny*t*k, y2+ny*t*k],
                color=GLASS, lw=1.6, zorder=Z["glass"], solid_capstyle="butt")

# --------------------------------------------------------------- text
def label(x, y, main, size=17, color=TXT, weight="bold", rot=0, track=0.0):
    if track:
        main = (" "*int(track)).join(main)
    t = ax.text(x, y, main, ha="center", va="center", fontsize=size, family=SANS,
                weight=weight, color=color, rotation=rot, zorder=Z["text"])
    TEXTS.append(t); return t

def note(x, y, s, size=10, color=TXT2, rot=0, ha="center", box=False, plate=False):
    kw = {}
    if plate:
        kw["bbox"] = dict(boxstyle="round,pad=0.22", fc=PAPER, ec="none", alpha=0.88)
    if box:
        kw["bbox"] = dict(boxstyle="round,pad=0.35", fc=PAPER, ec=ACCENT, lw=0.8)
    t = ax.text(x, y, s, ha=ha, va="center", fontsize=size, family=SANS,
                color=color, rotation=rot, zorder=Z["text"], **kw)
    TEXTS.append(t); return t

# --------------------------------------------------------------- furniture
def fbox(x, y, w, h, r=0, fc=FURNF, lw=1.1, ec=FURN):
    if r:
        r = min(r, w/2-1, h/2-1)
        p = FancyBboxPatch((x+r, y+r), w-2*r, h-2*r, boxstyle=f"round,pad={r}",
                           fc=fc, ec=ec, lw=lw, zorder=Z["furn"])
    else:
        p = Rectangle((x, y), w, h, fc=fc, ec=ec, lw=lw, zorder=Z["furn"])
    ax.add_patch(p); FURNS.append((x, y, x+w, y+h)); return p

def fline(pts, lw=1.0, color=FURN, ls="-"):
    a = np.asarray(pts, float)
    ax.plot(a[:, 0], a[:, 1], color=color, lw=lw, ls=ls, zorder=Z["furn"],
            solid_capstyle="round")

def fcirc(x, y, r, fc=FURNF, lw=1.1, ec=FURN):
    ax.add_patch(Circle((x, y), r, fc=fc, ec=ec, lw=lw, zorder=Z["furn"]))
    FURNS.append((x-r, y-r, x+r, y+r))

def rug(x, y, w, h, r=110, fc="#EEE4D3", ec="#D9CBB3"):
    r = min(r, w/2-1, h/2-1)
    ax.add_patch(FancyBboxPatch((x+r, y+r), w-2*r, h-2*r, boxstyle=f"round,pad={r}",
                                fc=fc, ec=ec, lw=1.0, zorder=Z["rug"]))

def bed(cx, cy, w=1830, l=2000, head="E"):
    if head in ("E", "W"):
        x, y, bw, bh = cx-l/2, cy-w/2, l, w
    else:
        x, y, bw, bh = cx-w/2, cy-l/2, w, l
    fbox(x, y, bw, bh, r=60)
    hb = 130
    if head == "E":
        fbox(x+bw-hb, y-90, hb, bh+180, fc=SOFT)
        fline([(x+bw*0.32, y+80), (x+bw*0.32, y+bh-80)])
        fbox(x+bw-620, y-700, 620, 520, r=45, fc="#F7F3EA")
        fbox(x+bw-620, y+bh+180, 620, 520, r=45, fc="#F7F3EA")
    elif head == "W":
        fbox(x, y-90, hb, bh+180, fc=SOFT)
        fline([(x+bw*0.68, y+80), (x+bw*0.68, y+bh-80)])
        fbox(x, y-700, 620, 520, r=45, fc="#F7F3EA")
        fbox(x, y+bh+180, 620, 520, r=45, fc="#F7F3EA")
    elif head == "N":
        fbox(x-90, y, bw+180, hb, fc=SOFT)
        fline([(x+80, y+bh*0.68), (x+bw-80, y+bh*0.68)])
    else:
        fbox(x-90, y+bh-hb, bw+180, hb, fc=SOFT)
        fline([(x+80, y+bh*0.32), (x+bw-80, y+bh*0.32)])

def sofa(x, y, w, d, face="N"):
    fbox(x, y, w, d, r=70)
    b = 190
    if face == "N":
        fbox(x, y+d-b, w, b, fc=SOFT)
        for i in (1, 2): fline([(x+i*w/3, y+80), (x+i*w/3, y+d-b-50)])
    elif face == "S":
        fbox(x, y, w, b, fc=SOFT)
        for i in (1, 2): fline([(x+i*w/3, y+b+50), (x+i*w/3, y+d-80)])
    elif face == "E":
        fbox(x, y, b, d, fc=SOFT)
        for i in (1, 2): fline([(x+b+50, y+i*d/3), (x+w-80, y+i*d/3)])
    else:
        fbox(x+w-b, y, b, d, fc=SOFT)
        for i in (1, 2): fline([(x+80, y+i*d/3), (x+w-b-50, y+i*d/3)])

def armchair(cx, cy, s=760):
    fbox(cx-s/2, cy-s/2, s, s, r=95)
    fcirc(cx, cy, s*0.25, fc="#F2EBDD")

def dining(cx, cy, w, h, nx, ny):
    fbox(cx-w/2, cy-h/2, w, h, r=55, fc="#F4EEE1")
    for i in range(nx):
        xx = cx-w/2 + w*(i+0.5)/nx
        fbox(xx-225, cy-h/2-520, 450, 450, r=60)
        fbox(xx-225, cy+h/2+70, 450, 450, r=60)
    for i in range(ny):
        yy = cy-h/2 + h*(i+0.5)/ny
        fbox(cx-w/2-520, yy-225, 450, 450, r=60)
        fbox(cx+w/2+70, yy-225, 450, 450, r=60)

def shelves(x, y, w, h, axis="v"):
    fbox(x, y, w, h, fc="#F1EBDD")
    if axis == "v":
        n = max(2, int(h//430))
        for i in range(1, n): fline([(x, y+i*h/n), (x+w, y+i*h/n)], lw=0.7)
    else:
        n = max(2, int(w//430))
        for i in range(1, n): fline([(x+i*w/n, y), (x+i*w/n, y+h)], lw=0.7)

def wc(cx, cy, rot=0):
    th = np.radians(rot)
    R = lambda px, py: (cx+px*np.cos(th)-py*np.sin(th), cy+px*np.sin(th)+py*np.cos(th))
    ax.add_patch(Ellipse(R(70, 0), 350, 420, angle=rot, fc=FURNF, ec=FURN,
                         lw=1.1, zorder=Z["furn"]))
    ax.add_patch(Polygon(np.array([R(-130, -190), R(-250, -190), R(-250, 190),
                                   R(-130, 190)]), closed=True, fc="#F2EBDD",
                         ec=FURN, lw=1.1, zorder=Z["furn"]))
    FURNS.append((cx-320, cy-320, cx+320, cy+320))

def basin(cx, cy, w=620, d=440, rot=0):
    th = np.radians(rot)
    R = lambda px, py: (cx+px*np.cos(th)-py*np.sin(th), cy+px*np.sin(th)+py*np.cos(th))
    ax.add_patch(Polygon(np.array([R(-w/2, -d/2), R(w/2, -d/2), R(w/2, d/2),
                                   R(-w/2, d/2)]), closed=True, fc=FURNF, ec=FURN,
                         lw=1.1, zorder=Z["furn"]))
    ax.add_patch(Ellipse((cx, cy), w*0.52, d*0.52, angle=rot, fc="#F0F4F5",
                         ec=FURN, lw=0.9, zorder=Z["furn"]))
    FURNS.append((cx-w/2, cy-d/2, cx+w/2, cy+d/2))

def shower(x, y, w, h):
    fbox(x, y, w, h, fc="#EFF4F5")
    fline([(x, y), (x+w, y+h)], lw=0.8); fline([(x+w, y), (x, y+h)], lw=0.8)
    fcirc(x+w/2, y+h/2, 95, fc="#FFFFFF")

def tub(x, y, w, h):
    fbox(x, y, w, h, r=110, fc="#EFF4F5")
    fbox(x+95, y+95, w-190, h-190, r=85, fc="#F8FBFC")

def plant(cx, cy, r=250):
    ax.add_patch(Circle((cx, cy), r, fc="#E8EEE4", ec=GREEND, lw=1.0, zorder=Z["furn"]))
    rng = np.random.default_rng(int(abs(cx)*3+abs(cy)) % 9973)
    for _ in range(7):
        a = rng.uniform(0, 2*np.pi); d = rng.uniform(0.24, 0.76)*r
        ax.add_patch(Circle((cx+np.cos(a)*d, cy+np.sin(a)*d), r*0.34,
                            fc=GREEN, ec=GREEND, lw=0.7, zorder=Z["furn"]))
    FURNS.append((cx-r, cy-r, cx+r, cy+r))

def guitar(cx, cy, s=1.0, rot=0):
    th = np.radians(rot)
    R = lambda px, py: (cx+(px*np.cos(th)-py*np.sin(th))*s,
                        cy+(px*np.sin(th)+py*np.cos(th))*s)
    ax.add_patch(Ellipse(R(0, 140), 400*s, 380*s, angle=rot, fc=FURNF, ec=FURN,
                         lw=1.0, zorder=Z["furn"]))
    ax.add_patch(Ellipse(R(0, -130), 310*s, 310*s, angle=rot, fc=FURNF, ec=FURN,
                         lw=1.0, zorder=Z["furn"]))
    a, b = R(0, -280), R(0, -740)
    ax.plot([a[0], b[0]], [a[1], b[1]], color=FURN, lw=2.3, zorder=Z["furn"],
            solid_capstyle="round")
    FURNS.append((cx-260*s, cy-780*s, cx+260*s, cy+360*s))

def drumkit(cx, cy, s=1.0):
    fcirc(cx, cy+200*s, 500*s, fc="#F2EBDD")
    fcirc(cx-540*s, cy-170*s, 240*s); fcirc(cx+20*s, cy-280*s, 240*s)
    fcirc(cx+580*s, cy+110*s, 320*s, fc="#F2EBDD")
    fcirc(cx-700*s, cy+300*s, 280*s, fc="#EFF4F5")
    fcirc(cx+730*s, cy-350*s, 320*s, fc="#EFF4F5")
    fcirc(cx-170*s, cy+540*s, 290*s)

def stair_dn(x, y, w, h, n=6):
    fbox(x, y, w, h, fc="#EFEAE0")
    for i in range(1, n): fline([(x, y+i*h/n), (x+w, y+i*h/n)], lw=0.8)

# =============================================================== GEOMETRY
OUTLINE = [(0, 0), (24480, 0), (24480, 8400), (18600, 8400),
           (18600, 10850), (3200, 10850), (3200, 8400), (0, 8400)]

# ---------------- floors: outdoor
floor(4730, 0, 15020, 2620, DECKC, "board", sp=310, lc=DECKL)
floor(0, 0, 3200, 1100, DECKC, "board", sp=310, lc=DECKL)
floor(21280, 0, 3200, 1100, DECKC, "board", sp=310, lc=DECKL)
floor(3200, 0, 1530, 2620, "#E4E2DD", "diag", sp=250, lc="#C9C6BF")
floor(19750, 0, 1530, 2620, "#E4E2DD", "diag", sp=250, lc="#C9C6BF")

# ---------------- floors: parents wing  (bath N, dressing, wardrobe S)
floor(0, 1100, 3200, 7300, WOOD, "plank", sp=310, lc=WOODL)
floor(3200, 2620, 1530, 2430, STONE, "grid", sp=330, lc=STONEL)
floor(3200, 5050, 1530, 920, WOOD, "plank", sp=310, lc=WOODL)
floor(3200, 5970, 1530, 2430, WOOD, "plank", sp=310, lc=WOODL)
floor(4730, 2620, 3665, 2280, WOOD, "plank", sp=310, lc=WOODL)
floor(4730, 4900, 3665, 3500, WOOD, "plank", sp=310, lc=WOODL)

# ---------------- floors: great room
floor(8395, 2620, 7690, 5780, WOOD, "plank", sp=310, lc=WOODL)

# ---------------- floors: karan wing
floor(16085, 2620, 3665, 2280, WOOD, "plank", sp=310, lc=WOODL)
floor(16085, 4900, 3665, 3500, WOOD, "plank", sp=310, lc=WOODL)
floor(19750, 2620, 1530, 2430, STONE, "grid", sp=330, lc=STONEL)
floor(19750, 5050, 1530, 920, WOOD, "plank", sp=310, lc=WOODL)
floor(19750, 5970, 1530, 2430, WOOD, "plank", sp=310, lc=WOODL)
floor(21280, 1100, 3200, 7300, WOOD, "plank", sp=310, lc=WOODL)

# ---------------- floors: east bay
floor(3200, 8400, 1900, 2450, SERV, "grid", sp=340, lc=SERVL)     # help
floor(5100, 8400, 3790, 800,  SERV, "grid", sp=340, lc=SERVL)     # corridor
floor(5100, 9200, 1200, 1650, STONE, "grid", sp=300, lc=STONEL)   # svc wc
floor(6300, 9200, 1400, 1650, STONE, "grid", sp=300, lc=STONEL)   # laundry
floor(7700, 9200, 1190, 1650, SERV, "grid", sp=340, lc=SERVL)     # store
floor(8890, 8400, 3350, 2450, STONE, "grid", sp=340, lc=STONEL)   # kitchen
floor(12240, 8400, 1060, 2450, SERV, "grid", sp=340, lc=SERVL)    # vestibule
floor(13300, 8400, 1400, 2450, STONE, "grid", sp=320, lc=STONEL)  # guest bath
floor(14700, 8400, 3900, 2450, WOOD, "plank", sp=310, lc=WOODL)   # entry gallery

for cx0 in (9200, 13930):
    floor(cx0, 1035, 1350, 1585, "#E4E2DD", "diag", sp=260, lc="#C9C6BF")

# ---------------- glass-roof tint
rect(4730, 0, 15020, 2620, fc="#D8E8EF", ec="none", alpha=0.40, zorder=Z["tint"])
def _tint(P, xin, y0, y1):
    ys = np.linspace(y0, y1, 40)
    pts = [(xin, y0)] + [(PX(P, y), y) for y in ys] + [(xin, y1)]
    poly(pts, fc="#D8E8EF", ec="none", alpha=0.30, zorder=Z["tint"])
_tint(PODP, 4730, 2620, 4900)
_tint(PODK, 19750, 2620, 4900)

# =============================================================== WALLS
ol = OUTLINE + [OUTLINE[0]]
for i in range(len(ol)-1):
    wall(*ol[i], *ol[i+1], T_EXT)

# parents wing
wall(0, 1100, 3200, 1100, T_INT, [(300, 1500)])
wall(3200, 1100, 3200, 8400, T_INT, [(4050, 4770)])
wall(3200, 2620, 4730, 2620, T_INT)
wall(3200, 5050, 4730, 5050, T_INT, [(400, 1200)])
wall(3200, 5970, 4730, 5970, T_INT, [(200, 1200)])
wall(4730, 2620, 4730, 8400, T_INT, [(2530, 3250)])
wall(4730, 4900, PX(PODP, 4900), 4900, T_INT, [(600, 1700)])
wall(3200, 8400, 8395, 8400, T_INT)

# great room south
wall(8395, 8400, 16085, 8400, T_INT, [(3945, 4845), (6705, 7690)])

# karan wing
wall(21280, 1100, 24480, 1100, T_INT, [(1700, 2900)])
wall(21280, 1100, 21280, 8400, T_INT, [(4050, 4770)])
wall(19750, 2620, 21280, 2620, T_INT)
wall(19750, 5050, 21280, 5050, T_INT, [(330, 1130)])
wall(19750, 5970, 21280, 5970, T_INT, [(330, 1330)])
wall(19750, 2620, 19750, 8400, T_INT, [(2530, 3250)])
_kx = PX(PODK, 4900)
wall(_kx, 4900, 19750, 4900, T_INT, [(18050-_kx, 19150-_kx)])
wall(16085, 8400, 19750, 8400, T_INT)
wall(18450, 6900, 19750, 6900, T_THIN)
wall(18450, 6900, 18450, 8400, T_THIN, [(400, 1200)])

# east bay
wall(5100, 8400, 5100, 10850, T_THIN, [(0, 800)])
wall(5100, 9200, 8890, 9200, T_THIN, [(300, 1000), (1500, 2200), (2900, 3500)])
wall(6300, 9200, 6300, 10850, T_THIN)
wall(7700, 9200, 7700, 10850, T_THIN)
wall(8890, 8400, 8890, 10850, T_INT, [(50, 800)])
wall(12240, 8400, 12240, 10850, T_INT, [(1350, 2150)])
wall(13300, 8400, 13300, 10850, T_THIN)
wall(14700, 8400, 14700, 10850, T_THIN, [(1450, 2250)])

# =============================================================== GLASS PODS
def pod_arc(P, portal):
    ts = np.linspace(0, 1, 500)
    P0 = np.array(P[0]); P1 = np.array(P[1]); P2 = np.array(P[2])
    pts = ((1-ts)**2)[:, None]*P0 + (2*(1-ts)*ts)[:, None]*P1 + (ts**2)[:, None]*P2
    ax.plot(pts[:, 0], pts[:, 1], color=GLASS, lw=17, alpha=0.10, zorder=Z["glass"]-0.6)
    a, b = portal
    for m in (ts < a, ts > b):
        ax.plot(pts[m, 0], pts[m, 1], color=GLASS, lw=5.5, zorder=Z["glass"],
                solid_capstyle="round")
        ax.plot(pts[m, 0], pts[m, 1], color="#FFFFFF", lw=1.5, zorder=Z["glass"]+0.1)
    mp = (ts >= a) & (ts <= b)
    ax.plot(pts[mp, 0], pts[mp, 1], color=ACCENT, lw=1.5, ls=(0, (5, 4)), zorder=Z["glass"])
    for idx in (np.argmax(ts >= a), np.argmax(ts > b)-1):
        p = pts[idx]; d = pts[min(idx+3, 499)] - pts[max(idx-3, 0)]
        d = d/np.linalg.norm(d); n = np.array([-d[1], d[0]])*160
        ax.plot([p[0]-n[0], p[0]+n[0]], [p[1]-n[1], p[1]+n[1]], color=ACCENT,
                lw=1.8, zorder=Z["glass"]+0.2)
    return pts, pts[int(len(ts)*(a+b)/2)]

ptsP, portalP = pod_arc(PODP, (0.42, 0.60))
ptsK, portalK = pod_arc(PODK, (0.42, 0.60))

for a, b in [(4730, 8395), (16085, 19750)]:
    ax.plot([a+130, b-130], [2620, 2620], color=GLASS, lw=4.5, zorder=Z["glass"],
            solid_capstyle="round")
    ax.plot([a+130, b-130], [2620, 2620], color="#FFFFFF", lw=1.4, zorder=Z["glass"]+0.1)

ax.plot([8395, 16085], [2620, 2620], color="#8E877C", lw=1.3, ls=(0, (9, 7)),
        zorder=Z["glass"])

tt = np.linspace(0, 1, 240)
P0, P1, P2 = np.array([0, 4100]), np.array([1700, 4580]), np.array([3200, 4100])
cp = ((1-tt)**2)[:, None]*P0 + (2*(1-tt)*tt)[:, None]*P1 + (tt**2)[:, None]*P2
ax.plot(cp[:, 0], cp[:, 1], color=GLASS, lw=2.6, ls=(0, (11, 7)), zorder=Z["glass"])

# =============================================================== OPENINGS
window(0, 2000, 0, 3400); window(0, 4200, 0, 5900); window(0, 6500, 0, 8100)
window(24480, 2000, 24480, 3400); window(24480, 4200, 24480, 5900)
window(24480, 6500, 24480, 8100)
window(400, 8400, 2400, 8400); window(22080, 8400, 24080, 8400)
window(3600, 2620, 4400, 2620, T_INT); window(20080, 2620, 20880, 2620, T_INT)
window(9400, 10850, 11600, 10850); window(6450, 10850, 7550, 10850)
window(3500, 10850, 4800, 10850); window(15150, 10850, 15750, 10850)
window(17300, 10850, 18300, 10850)

slider(300, 1100, 1500, 1100); slider(22980, 1100, 24180, 1100)

# entrances
doorway(12400, 10850, 13200, 10850, hinge=1, side=+1, punch=T_EXT)
doorway(15900, 10850, 17000, 10850, hinge=0, side=-1, punch=T_EXT)
note(12800, 11330, "SERVICE ENTRY  F-1401", 10, color=OCHRE)
note(16450, 11330, "MAIN ENTRANCE  F-1402", 11, color=TXT)

# sealed service door + arched entry
doorway(12340, 8400, 13240, 8400, hinge=1, side=+1)
opening(15100, 8400, 16085, 8400, arch=True)

# parents pod
opening(3200, 5150, 3200, 5870)
opening(3400, 5970, 4400, 5970)                      # wardrobe (walk-in)
doorway(3600, 5050, 4400, 5050, hinge=0, side=-1)    # bath
opening(4730, 5150, 4730, 5870)
opening(5330, 4900, 6430, 4900)
# karan pod
opening(21280, 5150, 21280, 5870)
opening(20080, 5970, 21080, 5970)
doorway(20080, 5050, 20880, 5050, hinge=1, side=-1)
opening(19750, 5150, 19750, 5870)
opening(18050, 4900, 19150, 4900)
doorway(18450, 7300, 18450, 8100, hinge=0, side=-1)
# service zone
opening(5100, 8400, 5100, 9200)
doorway(5400, 9200, 6100, 9200, hinge=0, side=-1)
doorway(6600, 9200, 7300, 9200, hinge=0, side=-1)
doorway(8000, 9200, 8600, 9200, hinge=0, side=-1)
doorway(8890, 8450, 8890, 9200, hinge=0, side=-1)
doorway(12240, 9750, 12240, 10550, hinge=0, side=+1)
doorway(14700, 9850, 14700, 10650, hinge=0, side=+1)

# =============================================================== FURNITURE
# ---- deck
rug(5250, 1000, 2650, 1450, fc="#D9D1C0", ec="#C2B8A3")
sofa(5450, 1150, 2250, 780, face="S")
armchair(6150, 2150, 760); armchair(7200, 2150, 760)
fbox(6300, 1980, 940, 560, r=60)
fbox(11150, 1180, 600, 1300, r=140); fbox(11850, 1180, 600, 1300, r=140)
fbox(12620, 1500, 620, 620, r=80)
dining(17150, 1400, 1800, 950, 3, 1)
for p in [(4980, 350), (8620, 400), (15650, 2260), (19480, 350),
          (11400, 2300), (7600, 380), (16800, 400),
          (10250, 2300), (13600, 380), (6300, 2300), (18100, 2300)]:
    plant(*p, r=235)
for cx0 in (9200, 13930):
    stair_dn(cx0+190, 1230, 970, 1180, 6)

# ---- parents suite
rug(620, 5400, 2320, 2400)
bed(2020, 6600, 1830, 2000, head="E")
fbox(200, 7700, 1150, 620, r=60)
armchair(2150, 1520, 700)
fbox(300, 2100, 900, 1900, r=80)
fbox(300, 2100, 900, 300, r=60, fc=SOFT)
fbox(1330, 2480, 560, 460, r=50)
plant(2830, 3600, 215)

# ---- parents band
wc(4370, 4560, rot=180); basin(3620, 4560, rot=0)
shower(3290, 2720, 1350, 900)
shelves(3270, 6070, 420, 2230); shelves(4260, 6070, 420, 2230)

# ---- parents family room
rug(5080, 3700, 2450, 1150)
sofa(5320, 3960, 2050, 820, face="N")
fbox(4820, 2740, 380, 1400, r=40)
plant(7500, 3150, 190)
plant(7450, 4620, 195)

# ---- parents hall
fbox(4830, 7760, 1300, 420, r=40)
armchair(5320, 6350, 800); plant(6350, 6420, 260)
th = np.linspace(0, np.pi, 60)
ax.plot(6280+430*np.cos(th), 8320-400*np.sin(th), color=OCHRE, lw=2.0, zorder=Z["glass"])
fbox(5960, 8020, 640, 290, r=30, fc="#F6EFDD", ec=OCHRE)

# ---- great room
rug(9880, 2880, 4720, 2500)
sofa(10590, 4180, 3300, 950, face="N")
fbox(11340, 3010, 1800, 820, r=70)
armchair(9880, 3320, 820); armchair(14100, 3320, 820)
dining(12240, 7350, 2400, 1000, 3, 1)
fbox(8620, 8060, 1250, 300, r=30)
armchair(8100, 6950, 820); armchair(16380, 6950, 820)
fbox(7850, 7500, 540, 540, r=60); fbox(16090, 7500, 540, 540, r=60)

# ---- karan den
fbox(16380, 2680, 1780, 620, r=0, fc="#EEE8DB")
fcirc(16760, 2990, 160, fc="#EFF4F5")
fbox(17240, 2760, 400, 460, r=40); fbox(17740, 2760, 400, 460, r=40)
sofa(16960, 3950, 2050, 830, face="N")
drumkit(19080, 4180, 0.52)
guitar(19470, 3060, 0.52)
rug(17020, 5000, 2450, 1650)

# ---- karan hall
fbox(17320, 5950, 1300, 420, r=40)
armchair(18100, 6300, 800); plant(17700, 7050, 235)
shelves(18520, 7020, 340, 1260); shelves(19350, 7020, 340, 1260)

# ---- karan band
wc(20110, 4560, rot=0); basin(20860, 4560, rot=0)
shower(19840, 2720, 1350, 900)
shelves(19810, 6070, 420, 2230); shelves(20800, 6070, 420, 2230)

# ---- karan suite
rug(21540, 5400, 2320, 2400)
bed(22460, 6600, 1830, 2000, head="W")
fbox(23130, 7700, 1150, 620, r=60)
fbox(22400, 1500, 1500, 700, r=60)
armchair(23520, 2520, 700)
plant(21600, 2400, 215)

# ---- kitchen
fbox(8950, 8460, 3230, 620, fc="#EEE8DB")
fbox(8950, 10170, 2480, 620, fc="#EEE8DB")
fcirc(9880, 8770, 195, fc="#EFF4F5")
for dx, dy in [(-165, -145), (165, -145), (-165, 145), (165, 145)]:
    fcirc(10850+dx, 10480+dy, 108, fc="#EFF4F5")
fbox(11540, 10040, 640, 760, r=40)
fbox(11180, 8460, 900, 620, r=30, fc="#F2EBDD")

# ---- service rooms
bed(4150, 9850, 900, 1800, head="N")
shelves(4700, 8560, 330, 900)
fbox(3290, 8560, 400, 900, r=40)
wc(5340, 10480, rot=90); basin(5990, 10440, rot=90)
shower(5150, 9740, 700, 560)
fbox(6430, 10180, 580, 580, r=40); fbox(7060, 10180, 580, 580, r=40)
fcirc(6720, 10470, 115, fc="#EFF4F5"); fcirc(7350, 10470, 115, fc="#EFF4F5")
fline([(6400, 9520), (7600, 9520)], lw=1.3); fline([(6400, 9700), (7600, 9700)], lw=1.3)
shelves(7760, 9300, 360, 1420); shelves(8460, 9300, 360, 1420)
shelves(12310, 8520, 320, 880); fbox(12300, 10250, 930, 400, r=40)
wc(13620, 10450, rot=90); basin(14320, 9200, rot=180)

# ---- entry gallery
rug(15180, 9120, 2650, 1400)
fbox(14790, 8520, 360, 1550, r=30)
fbox(17420, 8480, 1080, 380, r=30)
armchair(15120, 10270, 720); plant(18220, 10320, 250); plant(14990, 8820, 225)

# =============================================================== LABELS
label(1500, 4650, "MASTER SUITE", 21)
label(1500, 4970, "PARENTS", 12, color=ACCENT, weight="normal", track=2)
note(1500, 5230, "3200 × 7300 mm   ·   10'-6\" × 23'-11\"", 9)
note(1500, 5420, "251 sq ft   ·   MB-01 + MB-02 merged", 8.5)
label(2450, 2860, "DAY-BED NOOK", 11.5, color=ACCENT)
note(2450, 3080, "grandmother's visits", 9)
note(2450, 3260, "curved sliding screen", 9)
note(1600, 640, "PRIVATE TERRACE   3120 × 1100", 9.5)

note(3960, 4110, "2430 × 1530 mm · 8'-0\" × 5'-0\" · 40 sq ft", 8)
note(3960, 5510, "DRESSING", 9.5)
label(3950, 7080, "WALK-IN WARDROBE", 11, rot=90)
note(4160, 7080, "ex-toilet · capped", 8.5, rot=90)
note(3765, 7080, "1530 × 2430 mm · 5'-0\" × 8'-0\" · 40 sq ft", 7.5, rot=90)

label(6450, 2960, "FAMILY ROOM", 14)
note(6450, 3170, "3665 × 2280 mm  ·  12'-0\" × 7'-6\"", 8.5)
note(6450, 3340, "80 sq ft  ·  glass roof over", 8.5)
label(6400, 7000, "POD HALL", 12.5, color=TXT2, weight="normal")
note(6400, 7200, "96 sq ft", 8.5)
note(6280, 7830, "POOJA", 9, color=OCHRE)

label(12240, 5580, "GREAT ROOM", 25, track=3)
note(12240, 5900, "living + dining   ·   582 sq ft   ·   54.0 m²   ·   fully open to the deck", 11)
note(12240, 6120, "7690 – 10 480 wide × 5780 mm   ·   25'-3\" to 34'-5\" × 18'-11\"", 9.5)

label(12240, 520, "ALL-WEATHER DECK", 16, color=ACCENT, track=3)
note(12240, 790, "15 020 × 2620 mm   ·   49'-3\" × 8'-7\"   ·   378 sq ft", 10.5, color=ACCENT)
note(12240, 975, "retractable curved acoustic glass roof over", 9.5, color=ACCENT, plate=True)

label(17400, 3480, "MUSIC + WORK DEN", 13)
note(17400, 3660, "3665 × 2280 mm  ·  12'-0\" × 7'-6\"", 8.5)
note(17400, 3830, "80 sq ft  ·  glass roof over", 8.5)
note(17400, 2480, "PANTRY / COFFEE BAR  ·  hatch to deck", 9, color=ACCENT, plate=True)
label(17910, 7620, "POD HALL", 12.5, color=TXT2, weight="normal")
note(17910, 7820, "96 sq ft", 8.5)
note(19100, 7650, "GEAR STORE", 9, rot=90)

note(20520, 4110, "2430 × 1530 mm · 8'-0\" × 5'-0\" · 40 sq ft", 8)
note(20520, 5510, "DRESSING", 9.5)
label(20500, 7080, "WALK-IN WARDROBE", 11, rot=90)
note(20710, 7080, "ex-toilet · capped", 8.5, rot=90)
note(20315, 7080, "1530 × 2430 mm · 5'-0\" × 8'-0\" · 40 sq ft", 7.5, rot=90)

label(22980, 4650, "MASTER SUITE", 21)
label(22980, 4970, "KARAN", 12, color=ACCENT, weight="normal", track=2)
note(22980, 5230, "3200 × 7300 mm   ·   10'-6\" × 23'-11\"", 9)
note(22980, 5420, "251 sq ft   ·   MB-01 + MB-02 merged", 8.5)
note(22880, 640, "PRIVATE TERRACE   3120 × 1100", 9.5)

label(4200, 8610, "HELP'S ROOM", 9.5)
note(4300, 8770, "1900 × 2450 mm · 50 sq ft", 7.5)
note(4300, 8900, "6'-3\" × 8'-1\" · live-in", 7.5)
note(5700, 9400, "SERVICE WC", 8.5)
label(7000, 9420, "LAUNDRY", 9.5); note(7000, 9600, "dry balcony", 8.5)
note(8295, 9900, "STORE", 9, rot=90)
label(10565, 9450, "KITCHEN", 15)
note(10565, 9670, "3350 × 2450 mm  ·  11'-0\" × 8'-1\"  ·  88 sq ft", 9)
note(10565, 9860, "retained on the existing stack", 8.5)
note(12770, 9300, "SERVICE VESTIBULE", 8.5, rot=90, color=OCHRE)
label(14000, 9700, "GUEST", 10); label(14000, 9900, "BATH", 10)
label(16650, 9380, "ENTRY GALLERY", 14)
note(16650, 9620, "3900 × 2450 mm  ·  12'-10\" × 8'-1\"  ·  103 sq ft", 8.5)

note(11150, 8210, "sealed service door", 8.5, color=OCHRE, ha="right")
note(12240, 2790, "GREAT ROOM FULLY OPEN TO THE DECK — NO WALL", 9.5, color=FAINT)
note(3830, 1310, "VOID / SHAFT", 9.5, color="#8B877F", rot=90)
note(4110, 1310, "1530 × 2620 mm", 8, color="#9E9A91", rot=90)
note(20390, 1310, "VOID / SHAFT", 9.5, color="#8B877F", rot=90)
note(20670, 1310, "1530 × 2620 mm", 8, color="#9E9A91", rot=90)
for cx0 in (9875, 14605):
    note(cx0, 1780, "LIFT / VOID", 8.5, color="#8B877F", plate=True)
    note(cx0, 1970, "building core", 8, color="#9E9A91", plate=True)

for (px, py), lx, ha in ((portalP, 9200, "left"), (portalK, 15280, "right")):
    a = ax.annotate("ARCHED PORTAL", xy=(px, py), xytext=(lx, py+30), fontsize=9.5,
                    family=SANS, color=ACCENT, ha=ha, va="center", zorder=Z["text"],
                    arrowprops=dict(arrowstyle="-", color=ACCENT, lw=0.9,
                                    shrinkA=2, shrinkB=5))
    TEXTS.append(a)

for cx0, txt in ((6560, "PARENTS' POD"), (17920, "KARAN'S POD")):
    note(cx0, 5720, txt, 10.5, color=ACCENT, box=True)

# =============================================================== DIMENSIONS
def dimline(x1, y1, x2, y2, text, size=11):
    ax.plot([x1, x2], [y1, y2], color="#8B867D", lw=0.9, zorder=Z["dim"])
    ang = np.arctan2(y2-y1, x2-x1)
    tx, ty = -np.sin(ang)*95, np.cos(ang)*95
    for px_, py_ in ((x1, y1), (x2, y2)):
        ax.plot([px_-tx, px_+tx], [py_-ty, py_+ty], color="#8B867D", lw=0.9,
                zorder=Z["dim"])
    rot = 0 if abs(y2-y1) < abs(x2-x1) else 90
    t = ax.text((x1+x2)/2, (y1+y2)/2, text, ha="center", va="center", fontsize=size,
                family=SANS, color="#5E5951", rotation=rot, zorder=Z["dim"]+1,
                bbox=dict(boxstyle="round,pad=0.25", fc=PAPER, ec="none"))
    TEXTS.append(t)

dimline(0, -900, 3200, -900, "3200 · 10'-6\"")
dimline(3200, -900, 4730, -900, "1530 · 5'-0\"")
dimline(4730, -900, 19750, -900, "15 020 · 49'-3\"     CONTINUOUS DECK")
dimline(19750, -900, 21280, -900, "1530 · 5'-0\"")
dimline(21280, -900, 24480, -900, "3200 · 10'-6\"")
dimline(0, -1620, 24480, -1620, "OVERALL    24 480 mm  ·  80'-4\"", 13)

dimline(0, 11750, 8395, 11750, "PARENTS' WING    8395 · 27'-6\"")
dimline(8395, 11750, 16085, 11750, "GREAT ROOM AT DECK    7690 · 25'-3\"")
dimline(16085, 11750, 24480, 11750, "KARAN'S WING    8395 · 27'-6\"")
dimline(0, 12470, 24480, 12470, "OVERALL    24 480 mm  ·  80'-4\"", 13)

dimline(-950, 0, -950, 2620, "DECK 2620 · 8'-7\"")
dimline(-950, 2620, -950, 8400, "MAIN BODY 5780 · 18'-11\"")
dimline(-1700, 0, -1700, 10850, "OVERALL    10 850 mm  ·  35'-7\"", 13)
dimline(25600, 8400, 25600, 10850, "EAST BAY 2450 · 8'-1\"")

# =============================================================== NORTH
nx, ny = 26700, 1000
ax.add_patch(Circle((nx, ny), 440, fc="none", ec="#6F6860", lw=1.2, zorder=Z["text"]))
ax.add_patch(Polygon(np.array([[nx+340, ny], [nx-270, ny-155], [nx-155, ny],
                               [nx-270, ny+155]]), closed=True, fc=INK, ec="none",
                     zorder=Z["text"]))
TEXTS.append(ax.text(nx, ny-680, "N", ha="center", va="center", fontsize=15,
                     family=SANS, weight="bold", color=INK, zorder=Z["text"]))

# =============================================================== TITLE
TEXTS.append(ax.text(-2800, -2950, "FULL-FLOOR RESIDENCE", fontsize=36, family=SERIF,
                     weight="bold", color=INK, ha="left", va="center", zorder=Z["text"]))
TEXTS.append(ax.text(-2800, -2380,
    "TWO MIRRORED 2-BHK UNITS MERGED INTO ONE HOME    ·    PROPOSED FURNITURE LAYOUT PLAN",
    fontsize=13, family=SANS, color=TXT2, ha="left", va="center", zorder=Z["text"]))
TEXTS.append(ax.text(-2800, -2030,
    "DIMENSIONS IN MILLIMETRES AND FEET-INCHES    ·    WET AREAS RETAINED ON EXISTING STACKS    ·    CONCEPT DRAWING, NOT FOR CONSTRUCTION",
    fontsize=10.5, family=SANS, color=FAINT, ha="left", va="center", zorder=Z["text"]))

# =============================================================== LEGEND
LX, LY = -2800, 13500
items = [("wall", "MASONRY"), ("glass", "CURVED GLASS WALL"), ("win", "GLAZING"),
         ("roof", "GLASS ROOF OVER"), ("svc", "SEALED SERVICE ZONE"),
("core", "BUILDING CORE / VOID"),
         ("arch", "ARCHED OPENING")]
x = LX
for kind, txt in items:
    if kind == "wall":
        rect(x, LY-70, 400, 140, fc=INK, ec="none", zorder=Z["text"])
    elif kind == "glass":
        ax.plot([x, x+400], [LY, LY], color=GLASS, lw=5.5, zorder=Z["text"])
    elif kind == "win":
        for k in (-45, 45):
            ax.plot([x, x+400], [LY+k, LY+k], color=GLASS, lw=1.6, zorder=Z["text"])
    elif kind == "roof":
        rect(x, LY-90, 400, 180, fc="#D8E8EF", ec=GLASS, lw=0.8, zorder=Z["text"])
    elif kind == "svc":
        rect(x, LY-90, 400, 180, fc=SERV, ec=OCHRE, lw=0.9, zorder=Z["text"])
    elif kind == "wet":
        rect(x, LY-90, 400, 180, fc=STONE, ec="#A9ADA8", lw=0.9, zorder=Z["text"])
    elif kind == "core":
        rect(x, LY-90, 400, 180, fc="#E4E2DD", ec="#B8B5AE", lw=0.9, zorder=Z["text"])
    elif kind == "arch":
        th = np.linspace(0, np.pi, 40)
        ax.plot(x+200+200*np.cos(th), LY+70-140*np.sin(th), color=ACCENT, lw=1.8,
                zorder=Z["text"])
    TEXTS.append(ax.text(x+540, LY, txt, ha="left", va="center", fontsize=10.5,
                         family=SANS, color="#5E5951", zorder=Z["text"]))
    x += 540 + len(txt)*72 + 400

# =============================================================== TITLE BLOCK
BX, BY, BW, BH = 19100, 13000, 8500, 1950
rect(BX, BY, BW, BH, fc="none", ec="#6F6860", lw=1.4, zorder=Z["text"])
ax.plot([BX, BX+BW], [BY+640, BY+640], color="#6F6860", lw=0.8, zorder=Z["text"])
ax.plot([BX+4700, BX+4700], [BY, BY+BH], color="#6F6860", lw=0.8, zorder=Z["text"])
ax.plot([BX+6650, BX+6650], [BY+640, BY+BH], color="#6F6860", lw=0.8, zorder=Z["text"])
def tb(dx, dy, s, size=10.5, fam=SANS, w="normal", c=TXT):
    TEXTS.append(ax.text(BX+dx, BY+dy, s, fontsize=size, family=fam, weight=w,
                         color=c, va="center", zorder=Z["text"]))
tb(230, 370, "FULL-FLOOR RESIDENCE", 15, SERIF, "bold", INK)
tb(4900, 370, "DWG  A-101    ·    REV 4", 11.5)
tb(230, 1000, "PROPOSED FURNITURE LAYOUT PLAN", 11)
tb(230, 1350, "CARPET ≈ 1 900 SQ FT (176 m²)   ·   DECK ≈ 378 SQ FT (35 m²)", 10, c=TXT2)
tb(230, 1690, "GROSS ≈ 2 620 SQ FT (243 m²)   ·   GREAT ROOM 582 SQ FT", 10, c=TXT2)
tb(4900, 1000, "SCALE 1:75 @ A1"); tb(4900, 1350, "AUGUST 2026")
tb(4900, 1690, "ISSUE: CONCEPT")
tb(6820, 1000, "DRAFT FOR"); tb(6820, 1350, "INTERIOR"); tb(6820, 1690, "DESIGNER")

fig.canvas.draw()
fig.savefig("/mnt/user-data/outputs/floor-plan-A101-rev4.png", dpi=200, facecolor=PAPER)
fig.savefig("/mnt/user-data/outputs/floor-plan-A101-rev4.pdf", facecolor=PAPER)
fig.savefig("/home/claude/plan3.png", dpi=100, facecolor=PAPER)

# =============================================================== AUDIT
inv = ax.transData.inverted()
rend = fig.canvas.get_renderer()

def bbox_data(artist):
    bb = artist.get_window_extent(rend)
    (x0, y0), (x1, y1) = inv.transform([[bb.x0, bb.y0], [bb.x1, bb.y1]])
    return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))

def ov(a, b):
    return (max(0, min(a[2], b[2]) - max(a[0], b[0])) *
            max(0, min(a[3], b[3]) - max(a[1], b[1])))

warn = 0
for t in TEXTS:
    tb_ = bbox_data(t)
    area = (tb_[2]-tb_[0])*(tb_[3]-tb_[1])
    if area <= 0: continue
    hit = sum(ov(tb_, f) for f in FURNS)
    if hit / area > 0.30:
        warn += 1
        print(f"TEXT/FURN {hit/area:5.0%}  '{t.get_text()[:40]}' at "
              f"({tb_[0]:.0f},{tb_[1]:.0f})")
print(f"--- text/furniture collisions: {warn} of {len(TEXTS)} labels")

xs = [t for t in TEXTS]
oobs = [t for t in TEXTS
        if not (-3100 < bbox_data(t)[0] and bbox_data(t)[2] < 27900
                and -3600 < bbox_data(t)[1] and bbox_data(t)[3] < 15900)]
print(f"--- labels outside canvas: {len(oobs)}")
for t in oobs[:8]:
    print("   OOB:", t.get_text()[:40], [f"{v:.0f}" for v in bbox_data(t)])

ROOMS = [(4730,0,15020,2620),(0,0,3200,1100),(21280,0,3200,1100),
         (3200,0,1530,2620),(19750,0,1530,2620),
         (0,1100,3200,7300),(3200,2620,1530,2430),(3200,5050,1530,920),
         (3200,5970,1530,2430),(4730,2620,3665,2280),(4730,4900,3665,3500),
         (7000,2620,10480,5780),
         (16085,2620,3665,2280),(16085,4900,3665,3500),(19750,2620,1530,2430),
         (19750,5050,1530,920),(19750,5970,1530,2430),(21280,1100,3200,7300),
         (3200,8400,1900,2450),(5100,8400,3790,800),(5100,9200,1200,1650),
         (6300,9200,1400,1650),(7700,9200,1190,1650),(8890,8400,3350,2450),
         (12240,8400,1060,2450),(13300,8400,1400,2450),(14700,8400,3900,2450)]
def inside(b):
    x0,y0,x1,y1 = b
    for rx,ry,rw,rh in ROOMS:
        if x0>=rx-60 and y0>=ry-60 and x1<=rx+rw+60 and y1<=ry+rh+60:
            return True
    return False
bad = [f for f in FURNS if not inside(f)]
print(f"--- furniture crossing room bounds: {len(bad)} of {len(FURNS)}")
for b in bad[:14]:
    print("   ", [f"{v:.0f}" for v in b])
print("saved plan3.png")
