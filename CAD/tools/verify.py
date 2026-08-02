"""
Runs the same audit as clash.py, but against the Round 1 design instead of
A-101.  Everything must come back clear.

    python3 tools/verify.py
"""

import os
import sys

import numpy as np

import clash as C
import design as D
import retrofit as R


def main():
    lay = C.builder_layers()
    bl = max(lay['DA_BUILDING LINE'], key=len)
    slab = C.blank()
    C.put_poly(slab, bl)
    cols = [('column', r) for r in C.rects(lay['DA_COLUMN'])] + \
           [('beam', r) for r in C.beam_rects()]

    fl, wl, kept = R.design_masks()
    allm = fl | wl                 # what Round 1 actually builds
    solid = wl | kept              # anything a column can hide inside

    print('=' * 74)
    print('ROUND 1 — VERIFICATION AGAINST THE BUILDER SHELL')
    print('=' * 74)

    fails = 0

    # 1 ------------------------------------------------ floor over no slab
    off = allm & ~slab
    a = C.area(off)
    if a > 0.05:
        fails += 1
        print(f'  FAIL  {a:.2f} m2 of design drawn where there is no slab, '
              f'bbox {C.bbox(off)}')
    else:
        print(f'  PASS  no design floor off the slab  ({a:.3f} m2 residual)')

    # 2 -------------------------------------------- shafts, ducts and voids
    worst = 0.0
    for name, x0, y0, x1, y1, kind in C.NAMED:
        m = C.blank()
        C.put_rect(m, x0, y0, x1, y1)
        built = m & allm
        worst = max(worst, C.area(built))
        flag = 'PASS' if C.area(built) < 0.05 else 'FAIL'
        if flag == 'FAIL':
            fails += 1
        print(f'  {flag}  {name:28s} {kind:11s} '
              f'{C.area(built):.3f} m2 built over')

    # 3 ------------------------------------------------- columns and beams
    print()
    for kind, r in sorted(cols, key=lambda c: c[1][0]):
        m = C.blank()
        C.put_rect(m, *r)
        if not (m & allm).sum():
            print(f'  n/a   {kind:6s} {r[2] - r[0]:5.0f} x {r[3] - r[1]:<5.0f} '
                  f'X {r[0]:6.0f} Y {r[1]:6.0f}   outside the home')
            continue
        exposed = m & fl & ~solid
        pct = 100 * exposed.sum() / m.sum()
        if pct < 12:
            print(f'  PASS  {kind:6s} {r[2] - r[0]:5.0f} x {r[3] - r[1]:<5.0f} '
                  f'X {r[0]:6.0f} Y {r[1]:6.0f}   absorbed in masonry')
        else:
            print(f'  PIER  {kind:6s} {r[2] - r[0]:5.0f} x {r[3] - r[1]:<5.0f} '
                  f'X {r[0]:6.0f} Y {r[1]:6.0f}   {pct:3.0f}% exposed in a room '
                  f'({C.area(exposed):.2f} m2) - shown as a pier')

    # 4 ------------------------------------------------------------ areas
    print()
    print('  room schedule')
    tot = 0.0
    rows = []
    for name, sub, rects, _ in D.ROOMS:
        if not rects:
            continue
        a = sum((c - x) * (d - y) for x, y, c, d in rects) / 1e6
        if 'DECK' in name:          # the two retained voids are holes in it
            a -= sum((c - x) * (d - y) for x, y, c, d in D.VOID_KEEP) / 1e6
        rows.append((f'{name} {sub}'.strip(), a))
    rows += [(n, R.poly_area(p)) for n, _s, p, _note, _xy in R.poly_rooms()]
    for n, a in sorted(rows, key=lambda r: -r[1]):
        tot += a
        print(f'    {n:26s} {a:6.1f} m2   {a * 10.7639:5.0f} sq ft')
    print(f'    {"TOTAL of named rooms":26s} {tot:6.1f} m2   {tot * 10.7639:5.0f} sq ft')

    print()
    print('  ' + ('ALL CHECKS PASS' if not fails else f'{fails} CHECK(S) FAILED'))
    return fails


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.exit(1 if main() else 0)
