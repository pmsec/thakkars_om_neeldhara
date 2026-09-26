"""
What cannot move in Ekta's flat — read off the builder's DWG by import.py.

Columns are the closed rectangles on DA_COLUMN that sit inside the flat. The
long 230 mm strips on that layer are external wall zones rather than columns
and are not listed. This flat is not a mirrored pair, so there is no mirror
line.
"""

EXTENT = (-1500, -1500, 13500, 14500)

MIRROR_X = None


def mirror(z):
    raise NotImplementedError("Ekta's flat is not a mirrored pair")


NAMED = [
    ("column 1", 8295, 470, 8525, 1670, 'column'),
    ("column 2", -150, 770, 80, 1970, 'column'),
    ("column 3", 3050, 770, 3280, 1670, 'column'),
    ("column 4", 8295, 6695, 8525, 7895, 'column'),
    ("column 5", 6720, 7895, 6950, 9125, 'column'),
]

# Common property, not part of the flat: the lift core and staircase, west.
COMMON = ("lift core, lifts and staircase", -4000, 3500, -300, 13000)
