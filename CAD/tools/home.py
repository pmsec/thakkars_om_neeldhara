"""
Which home the tools operate on.

The machinery in tools/ is shared; a HOME is a directory under CAD/homes/
holding the things that are actually about one building:

    homes/<id>/design.py      the plan — walls, openings, rooms, furniture
    homes/<id>/retrofit.py    that home's bespoke generators (curves, joinery)
    homes/<id>/immovables.py  its columns, beams, shafts and grid extents
    homes/<id>/home.json      name, source drawing, where its output goes

select() puts the chosen home's directory at the FRONT of the import path,
so `import design` / `import retrofit` resolve to that home. It reads the
home from --home on the command line, or $OM_HOME, and otherwise falls back
to om-neeldhara — which is why every existing command still behaves exactly
as it did, byte for byte.

It is idempotent and safe to call from anywhere: the first call wins, so a
tool that forgets is still correct, and --home is honoured no matter which
module happens to trigger the first call.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CAD = os.path.abspath(os.path.join(HERE, '..'))
HOMES = os.path.join(CAD, 'homes')
DEFAULT = 'om-neeldhara'

_selected = None
_meta = None


def _from_argv():
    for i, a in enumerate(sys.argv):
        if a == '--home' and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith('--home='):
            return a.split('=', 1)[1]
    return None


def available():
    if not os.path.isdir(HOMES):
        return []
    return sorted(d for d in os.listdir(HOMES)
                  if os.path.isfile(os.path.join(HOMES, d, 'design.py')))


def select(name=None):
    """Resolve `import design` to a home. Call before importing it."""
    global _selected, _meta
    if _selected is not None:
        return _selected
    name = name or _from_argv() or os.environ.get('OM_HOME') or DEFAULT
    d = os.path.join(HOMES, name)
    if not os.path.isfile(os.path.join(d, 'design.py')):
        sys.exit(f'home.select: no home named {name!r} in {HOMES}\n'
                 f'  available: {", ".join(available()) or "(none)"}')
    sys.path.insert(0, d)
    _selected = name
    with open(os.path.join(d, 'home.json')) as fh:
        _meta = json.load(fh)
    return name


def current():
    return _selected or select()


def meta():
    current()
    return _meta


def dir_of(name=None):
    return os.path.join(HOMES, name or current())


def _path(key, fallback):
    """A configured output directory, absolute. Home 1 keeps the original
    CAD/drawings and CAD/out; a new home gets its own, so two homes can never
    write over each other."""
    rel = (meta().get('paths') or {}).get(key, fallback)
    p = os.path.join(CAD, rel)
    os.makedirs(p, exist_ok=True)
    return p


def drawings_dir():
    return _path('drawings', os.path.join('homes', current(), 'drawings'))


def out_dir():
    return _path('out', os.path.join('homes', current(), 'out'))
