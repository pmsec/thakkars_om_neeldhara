#!/usr/bin/env python3
"""
THE HOME-1-IS-UNTOUCHED PROOF.

Multi-home work must never change what an existing home generates. This
regenerates a home and compares every output against recorded hashes.

    python3 golden.py                 # check om-neeldhara
    python3 golden.py --home <id>     # check another home
    python3 golden.py --update        # re-record (only when a change is INTENDED)

Run it after any change to shared machinery. A CHANGED line means the
refactor moved geometry — which for an untouched design is always a bug.
"""

import hashlib
import json
import os
import subprocess
import sys

import home

HERE = os.path.dirname(os.path.abspath(__file__))
home.select()
GOLD = os.path.join(home.dir_of(), 'golden.json')


def sha(path):
    with open(path, 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:16]


def outputs():
    d = home.drawings_dir()
    names = home.meta().get('golden', ['07-round1-layout.svg', '07-round1-layout.png'])
    return {n: os.path.join(d, n) for n in names}


def main():
    update = '--update' in sys.argv
    print(f'home: {home.current()}')
    # Home 1 is drawn by draw_design.py, which imports its retrofit module; an
    # imported home has none and is drawn by draw_home.py. Pick by origin.
    drawer = 'draw_home.py' if home.meta().get('origin') == 'imported' else 'draw_design.py'
    r = subprocess.run([sys.executable, os.path.join(HERE, drawer),
                        '--home', home.current()],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'{drawer} failed:\n{r.stderr[-2000:]}')

    now = {n: sha(p) for n, p in outputs().items() if os.path.isfile(p)}
    if update:
        json.dump(now, open(GOLD, 'w'), indent=2, sort_keys=True)
        print(f'recorded {len(now)} outputs -> {os.path.relpath(GOLD, HERE)}')
        return

    if not os.path.isfile(GOLD):
        sys.exit(f'no golden record yet — run: python3 golden.py --home {home.current()} --update')
    want = json.load(open(GOLD))
    bad = 0
    for n, h in sorted(want.items()):
        got = now.get(n)
        if got == h:
            print(f'  IDENTICAL  {n}')
        else:
            bad += 1
            print(f'  CHANGED!!  {n}  now={got} golden={h}')
    print('GOLDEN OK — this home is untouched' if not bad
          else f'GOLDEN FAILED — {bad} output(s) moved')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
