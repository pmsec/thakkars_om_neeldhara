/**
 * THE SINGLE SOURCE OF TRUTH for the building fabric.
 *
 * Every number here is a millimetre integer taken from `docs/floor-plan-source.py`
 * (DWG A-101 Rev 4), which is authoritative. Where the brief's §3 table and the Python
 * source could disagree, the source wins; they were reconciled and they agree.
 *
 * Nothing in this file is a room polygon. Rooms carry an `anchor` point only — their
 * shape is computed in `src/geometry/model.ts` by subdividing the wall centrelines and
 * insetting each face by half the adjoining wall thicknesses. Move a wall below and the
 * rooms, areas, schedules, 3D model and exports all move with it.
 *
 * Coordinates: x 0 -> 24480 along the building; y 0 (deck edge) -> 10850 (lobby).
 */

import type { BuildingData } from './schema'

const T_EXT = 240
const T_INT = 150
const T_THIN = 110

/** Curved glass pod walls (brief §3.3). Bow AWAY from the great room, into the pods. */
export const POD_PARENTS = {
  p0: { x: 8395, y: 2620 },
  p1: { x: 7350, y: 5300 },
  p2: { x: 7000, y: 8400 },
}
export const POD_KARAN = {
  p0: { x: 16085, y: 2620 },
  p1: { x: 17130, y: 5300 },
  p2: { x: 17480, y: 8400 },
}

/** Mirror axis for the two wings. Used by the test suite to prove the plan is symmetric. */
export const MIRROR_X = 12240

export const building: BuildingData = {
  meta: {
    project: 'Full-Floor Residence',
    drawing: 'A-101',
    revision: 'Rev 4',
    date: 'August 2026',
    scaleNote: 'Concept drawing, not for construction. Wet areas retained on existing stacks.',
  },

  // Stepped outline, OUTER face of the external wall.
  envelope: [
    { x: 0, y: 0 },
    { x: 24480, y: 0 },
    { x: 24480, y: 8400 },
    { x: 18600, y: 8400 },
    { x: 18600, y: 10850 },
    { x: 3200, y: 10850 },
    { x: 3200, y: 8400 },
    { x: 0, y: 8400 },
  ],

  thickness: { exterior: T_EXT, interior: T_INT, partition: T_THIN },
  levels: { ceiling: 3050, doorHead: 2100, windowSill: 900, windowHead: 2300 },

  // Openings in the external wall, given on the OUTER face and projected onto the
  // centreline by the model builder.
  exteriorOpenings: [
    // West elevation — parents' master suite
    { id: 'W-01', type: 'window', abs: [{ x: 0, y: 2000 }, { x: 0, y: 3400 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-02', type: 'window', abs: [{ x: 0, y: 4200 }, { x: 0, y: 5900 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-03', type: 'window', abs: [{ x: 0, y: 6500 }, { x: 0, y: 8100 }], sill: 900, head: 2300, nonCirculating: true },
    // East elevation — Karan's master suite
    { id: 'W-04', type: 'window', abs: [{ x: 24480, y: 2000 }, { x: 24480, y: 3400 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-05', type: 'window', abs: [{ x: 24480, y: 4200 }, { x: 24480, y: 5900 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-06', type: 'window', abs: [{ x: 24480, y: 6500 }, { x: 24480, y: 8100 }], sill: 900, head: 2300, nonCirculating: true },
    // South of each wing
    { id: 'W-07', type: 'window', abs: [{ x: 400, y: 8400 }, { x: 2400, y: 8400 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-08', type: 'window', abs: [{ x: 22080, y: 8400 }, { x: 24080, y: 8400 }], sill: 900, head: 2300, nonCirculating: true },
    // Lobby wall
    { id: 'W-09', type: 'window', abs: [{ x: 3500, y: 10850 }, { x: 4800, y: 10850 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-10', type: 'window', abs: [{ x: 6450, y: 10850 }, { x: 7550, y: 10850 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-11', type: 'window', abs: [{ x: 9400, y: 10850 }, { x: 11600, y: 10850 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-12', type: 'window', abs: [{ x: 15150, y: 10850 }, { x: 15750, y: 10850 }], sill: 900, head: 2300, nonCirculating: true },
    { id: 'W-13', type: 'window', abs: [{ x: 17300, y: 10850 }, { x: 18300, y: 10850 }], sill: 900, head: 2300, nonCirculating: true },
    // Entrances from the building lobby
    {
      id: 'F-1401',
      type: 'door',
      abs: [{ x: 12400, y: 10850 }, { x: 13200, y: 10850 }],
      hinge: 1,
      side: 1,
      head: 2100,
      label: 'SERVICE ENTRY',
      notes: 'House help enters here and reaches the whole service zone without entering the house.',
    },
    {
      id: 'F-1402',
      type: 'door',
      abs: [{ x: 15900, y: 10850 }, { x: 17000, y: 10850 }],
      hinge: 0,
      side: -1,
      head: 2100,
      label: 'MAIN ENTRANCE',
    },
  ],

  // The external wall along the deck edge is DELETED and replaced by the glass canopy,
  // which now runs to floor level. Rev 4 drew a continuous 240 mm wall right around the
  // outline, including in front of the deck; that is what put a blank 3050 mm wall
  // between the deck and the view. Confirmed removed by the client.
  envelopeGlazing: [
    // Each private terrace is a corner, so BOTH its exposed edges are glazed. They now
    // carry the SAME condition as the deck: no upright pane on either edge, because a
    // curved canopy of their own comes down to floor level on the north line and closes
    // the return with a gable cut to that same curve.
    {
      id: 'EG-P-TERRACE-N',
      p1: { x: 0, y: 0 },
      p2: { x: 3200, y: 0 },
      pane: false,
      label: "Parents' terrace — the curved canopy springs from here",
      notes:
        'No upright pane and no wall: ROOF-P-TERRACE springs from floor level on this ' +
        'line and is the terrace\u2019s enclosure, exactly as the barrel vault is the deck\u2019s.',
    },
    {
      id: 'EG-P-TERRACE-W',
      p1: { x: 0, y: 1100 },
      p2: { x: 0, y: 0 },
      pane: false,
      label: "Parents' terrace — west return, closed by the canopy gable",
      notes:
        'Enclosed by the glazed gable at the x0 end of ROOF-P-TERRACE, cut to the vault ' +
        'section rather than standing as a full-height rectangular pane.',
    },
    {
      id: 'EG-K-TERRACE-N',
      p1: { x: 21280, y: 0 },
      p2: { x: 24480, y: 0 },
      pane: false,
      label: "Karan's terrace — the curved canopy springs from here",
      notes:
        'No upright pane and no wall: ROOF-K-TERRACE springs from floor level on this ' +
        'line and is the terrace\u2019s enclosure.',
    },
    {
      id: 'EG-K-TERRACE-E',
      p1: { x: 24480, y: 0 },
      p2: { x: 24480, y: 1100 },
      pane: false,
      label: "Karan's terrace — east return, closed by the canopy gable",
      notes: 'Enclosed by the glazed gable at the x1 end of ROOF-K-TERRACE.',
    },
    {
      id: 'EG-DECK',
      p1: { x: 4730, y: 0 },
      p2: { x: 19750, y: 0 },
      pane: false,
      label: 'Deck edge — the curved canopy springs from here',
      notes:
        'No upright pane and no wall: the barrel vault itself comes down to floor level on ' +
        'this line and is the exterior enclosure for the full 15 020 mm of deck.',
    },
  ],

  walls: [
    // ---------------------------------------------------------------- parents' wing
    {
      id: 'W-P-TERRACE',
      points: [{ x: 0, y: 1100 }, { x: 3200, y: 1100 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-P-TERR', type: 'slider', at: [300, 1500], head: 2300, label: 'Terrace slider' }],
    },
    {
      id: 'W-P-SUITE-E',
      points: [{ x: 3200, y: 1100 }, { x: 3200, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-P-SUITE-DRESS', type: 'cased', at: [4050, 4770], head: 2100 }],
    },
    {
      id: 'W-P-BATH-N',
      points: [{ x: 3200, y: 2620 }, { x: 4730, y: 2620 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [
        {
          id: 'W-14',
          type: 'window',
          at: [400, 1200],
          sill: 900,
          head: 2300,
          nonCirculating: true,
          notes: 'Ventilates into the west building shaft. Intentional — matches the sanctioned plan.',
        },
      ],
    },
    {
      id: 'W-P-BATH-S',
      points: [{ x: 3200, y: 5050 }, { x: 4730, y: 5050 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-P-BATH', type: 'door', at: [400, 1200], hinge: 0, side: -1, head: 2100 }],
    },
    {
      id: 'W-P-WARD-N',
      points: [{ x: 3200, y: 5970 }, { x: 4730, y: 5970 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-P-WARD', type: 'cased', at: [200, 1200], head: 2100 }],
    },
    {
      id: 'W-P-POD-W',
      points: [{ x: 4730, y: 2620 }, { x: 4730, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-P-DRESS-HALL', type: 'cased', at: [2530, 3250], head: 2100 }],
    },
    {
      id: 'W-P-POD-MID',
      // East end lands on the parents' curve at y = 4900 (x = 7651.79).
      points: [{ x: 4730, y: 4900 }, { x: 7651.789, y: 4900 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-P-FAMILY-HALL', type: 'cased', at: [600, 1700], head: 2100 }],
    },
    {
      id: 'W-P-SOUTH',
      points: [{ x: 3200, y: 8400 }, { x: 8395, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
    },

    // ---------------------------------------------------------------- great room south
    {
      id: 'W-GREAT-S',
      points: [{ x: 8395, y: 8400 }, { x: 16085, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [
        {
          id: 'D-SERVICE',
          type: 'door',
          at: [3945, 4845],
          hinge: 1,
          side: 1,
          head: 2100,
          sealed: true,
          label: 'Sealed service door',
          notes: 'The single internal connection between the sealed service zone and the house.',
        },
        {
          id: 'O-ENTRY-ARCH',
          type: 'arch',
          at: [6705, 7690],
          head: 2400,
          label: 'Arched opening',
        },
      ],
    },

    // ---------------------------------------------------------------- Karan's wing
    {
      id: 'W-K-TERRACE',
      points: [{ x: 21280, y: 1100 }, { x: 24480, y: 1100 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-K-TERR', type: 'slider', at: [1700, 2900], head: 2300, label: 'Terrace slider' }],
    },
    {
      id: 'W-K-SUITE-W',
      points: [{ x: 21280, y: 1100 }, { x: 21280, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-K-SUITE-DRESS', type: 'cased', at: [4050, 4770], head: 2100 }],
    },
    {
      id: 'W-K-BATH-N',
      points: [{ x: 19750, y: 2620 }, { x: 21280, y: 2620 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [
        {
          id: 'W-15',
          type: 'window',
          at: [330, 1130],
          sill: 900,
          head: 2300,
          nonCirculating: true,
          notes: 'Ventilates into the east building shaft.',
        },
      ],
    },
    {
      id: 'W-K-BATH-S',
      points: [{ x: 19750, y: 5050 }, { x: 21280, y: 5050 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-K-BATH', type: 'door', at: [330, 1130], hinge: 1, side: -1, head: 2100 }],
    },
    {
      id: 'W-K-WARD-N',
      points: [{ x: 19750, y: 5970 }, { x: 21280, y: 5970 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-K-WARD', type: 'cased', at: [330, 1330], head: 2100 }],
    },
    {
      id: 'W-K-POD-E',
      points: [{ x: 19750, y: 2620 }, { x: 19750, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-K-DRESS-HALL', type: 'cased', at: [2530, 3250], head: 2100 }],
    },
    {
      id: 'W-K-POD-MID',
      // West end lands on Karan's curve at y = 4900 (x = 16828.21).
      points: [{ x: 16828.211, y: 4900 }, { x: 19750, y: 4900 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'O-K-DEN-HALL', type: 'cased', at: [1221.789, 2321.789], head: 2100 }],
    },
    {
      id: 'W-K-SOUTH',
      points: [{ x: 16085, y: 8400 }, { x: 19750, y: 8400 }],
      thickness: T_INT,
      kind: 'interior',
      notes: 'Clipped to the envelope centreline at x = 18480; beyond that the external wall takes over.',
    },
    {
      id: 'W-GEAR-N',
      points: [{ x: 18450, y: 6900 }, { x: 19750, y: 6900 }],
      thickness: T_THIN,
      kind: 'partition',
    },
    {
      id: 'W-GEAR-W',
      points: [{ x: 18450, y: 6900 }, { x: 18450, y: 8400 }],
      thickness: T_THIN,
      kind: 'partition',
      openings: [{ id: 'D-GEAR', type: 'door', at: [400, 1200], hinge: 0, side: -1, head: 2100 }],
    },

    // ---------------------------------------------------------------- east bay / service
    {
      id: 'W-HELP-E',
      points: [{ x: 5100, y: 8400 }, { x: 5100, y: 10850 }],
      thickness: T_THIN,
      kind: 'partition',
      openings: [{ id: 'O-HELP', type: 'cased', at: [0, 800], head: 2100 }],
    },
    {
      id: 'W-SVC-CORR-S',
      points: [{ x: 5100, y: 9200 }, { x: 8890, y: 9200 }],
      thickness: T_THIN,
      kind: 'partition',
      openings: [
        { id: 'D-SVC-WC', type: 'door', at: [300, 1000], hinge: 0, side: -1, head: 2100 },
        { id: 'D-LAUNDRY', type: 'door', at: [1500, 2200], hinge: 0, side: -1, head: 2100 },
        { id: 'D-STORE', type: 'door', at: [2900, 3500], hinge: 0, side: -1, head: 2100 },
      ],
    },
    {
      id: 'W-SVCWC-E',
      points: [{ x: 6300, y: 9200 }, { x: 6300, y: 10850 }],
      thickness: T_THIN,
      kind: 'partition',
    },
    {
      id: 'W-LAUNDRY-E',
      points: [{ x: 7700, y: 9200 }, { x: 7700, y: 10850 }],
      thickness: T_THIN,
      kind: 'partition',
    },
    {
      id: 'W-KITCHEN-W',
      points: [{ x: 8890, y: 8400 }, { x: 8890, y: 10850 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-KITCHEN', type: 'door', at: [50, 800], hinge: 0, side: -1, head: 2100 }],
    },
    {
      id: 'W-KITCHEN-E',
      points: [{ x: 12240, y: 8400 }, { x: 12240, y: 10850 }],
      thickness: T_INT,
      kind: 'interior',
      openings: [{ id: 'D-VESTIBULE', type: 'door', at: [1350, 2150], hinge: 0, side: 1, head: 2100 }],
    },
    {
      id: 'W-GUESTBATH-W',
      points: [{ x: 13300, y: 8400 }, { x: 13300, y: 10850 }],
      thickness: T_THIN,
      kind: 'partition',
    },
    {
      id: 'W-GUESTBATH-E',
      points: [{ x: 14700, y: 8400 }, { x: 14700, y: 10850 }],
      thickness: T_THIN,
      kind: 'partition',
      openings: [{ id: 'D-GUESTBATH', type: 'door', at: [1450, 2250], hinge: 0, side: 1, head: 2100 }],
    },

    // ---------------------------------------------------------------- curved glass pods
    {
      id: 'W-CURVE-PARENTS',
      curve: POD_PARENTS,
      thickness: T_INT,
      kind: 'curved-glass',
      label: "Parents' pod — curved glass wall",
      notes: 'Bows away from the great room. Arched portal at t 0.42–0.60.',
    },
    {
      id: 'W-CURVE-KARAN',
      curve: POD_KARAN,
      thickness: T_INT,
      kind: 'curved-glass',
      label: "Karan's pod — curved glass wall",
      notes: 'Bows away from the great room. Arched portal at t 0.42–0.60.',
    },

    // ---------------------------------------------------------------- glazing to the deck
    // Modelled at zero thickness: these are frameless full-height glazed screens. Frame
    // depth is a glazing-contractor dimension and is deliberately not invented here.
    // The upright glass screens that used to stand here are DELETED. The deck is enclosed
    // by the curved canopy, so a straight glass wall on this line was a second skin inside
    // the first. The family room and the den now open onto the deck exactly as the great
    // room does; the line survives only as a floor-finish change.
    {
      id: 'G-FAMILY-DECK',
      points: [{ x: 4730, y: 2620 }, { x: 8395, y: 2620 }],
      thickness: 0,
      kind: 'threshold',
      label: 'Family room open to the deck — no wall',
      openings: [{ id: 'GZ-01', type: 'threshold', at: [0, 3665], head: 3050 }],
    },
    {
      id: 'G-DEN-DECK',
      points: [{ x: 16085, y: 2620 }, { x: 19750, y: 2620 }],
      thickness: 0,
      kind: 'threshold',
      label: 'Den open to the deck — no wall',
      openings: [{ id: 'GZ-02', type: 'threshold', at: [0, 3665], head: 3050 }],
    },
    {
      id: 'TH-GREAT-DECK',
      points: [{ x: 8395, y: 2620 }, { x: 16085, y: 2620 }],
      thickness: 0,
      kind: 'threshold',
      label: 'Great room fully open to the deck — no wall',
      openings: [{ id: 'TH-01', type: 'threshold', at: [0, 7690], head: 3050 }],
      notes: 'Floor-finish change only. There is no wall on this line (brief §3.6).',
    },

    // ---------------------------------------------------------------- shaft edges
    // The shafts are open building voids. The sanctioned plan shows no wall on these
    // four lines, so they are modelled as zero-thickness boundaries at the zone extents
    // given in brief §3.4. No dimension has been invented.
    { id: 'V-SHAFT-W-1', points: [{ x: 3200, y: 120 }, { x: 3200, y: 1100 }], thickness: 0, kind: 'void-edge' },
    { id: 'V-SHAFT-W-2', points: [{ x: 4730, y: 120 }, { x: 4730, y: 2620 }], thickness: 0, kind: 'void-edge' },
    { id: 'V-SHAFT-E-1', points: [{ x: 21280, y: 120 }, { x: 21280, y: 1100 }], thickness: 0, kind: 'void-edge' },
    { id: 'V-SHAFT-E-2', points: [{ x: 19750, y: 120 }, { x: 19750, y: 2620 }], thickness: 0, kind: 'void-edge' },
  ],

  // Lift / building cores sitting in the deck band. Three sides only — the fourth is the
  // y = 2620 threshold line, which they share.
  cores: [
    {
      id: 'CORE-W',
      name: 'Lift / void — building core',
      points: [
        { x: 9200, y: 2620 },
        { x: 9200, y: 1035 },
        { x: 10550, y: 1035 },
        { x: 10550, y: 2620 },
      ],
      notes: 'Building core, 1350 × 1585. Not usable floor.',
    },
    {
      id: 'CORE-E',
      name: 'Lift / void — building core',
      points: [
        { x: 13930, y: 2620 },
        { x: 13930, y: 1035 },
        { x: 15280, y: 1035 },
        { x: 15280, y: 2620 },
      ],
      notes: 'Building core, 1350 × 1585. Not usable floor.',
    },
  ],

  rooms: [
    // ---- outdoor
    { id: 'R-P-TERRACE', name: "Parents' private terrace", anchor: { x: 1600, y: 600 }, category: 'outdoor', zone: 'outdoor', carpet: false, finish: 'Timber deck boards', notes: '3120 × 1100 nominal. Under its own curved glass canopy, which is also its enclosure on both exposed edges.' },
    { id: 'R-DECK', name: 'All-weather deck', anchor: { x: 12240, y: 500 }, category: 'outdoor', zone: 'outdoor', carpet: false, publishedSqFt: 378, finish: 'Timber deck boards', ceiling: 3400, notes: 'Under the retractable curved acoustic glass roof. Merged into the great room, not a separate balcony.' },
    { id: 'R-K-TERRACE', name: "Karan's private terrace", anchor: { x: 22880, y: 600 }, category: 'outdoor', zone: 'outdoor', carpet: false, finish: 'Timber deck boards', notes: '3120 × 1100 nominal. Under its own curved glass canopy, which is also its enclosure on both exposed edges.' },

    // ---- voids
    { id: 'R-SHAFT-W', name: 'Void / shaft (west)', anchor: { x: 3965, y: 1300 }, category: 'void', zone: 'core', carpet: false, finish: 'Open shaft', notes: 'Open building shaft, 1530 × 2620. Not usable floor and NOT a planter — corrected in Rev 4.' },
    { id: 'R-SHAFT-E', name: 'Void / shaft (east)', anchor: { x: 20515, y: 1300 }, category: 'void', zone: 'core', carpet: false, finish: 'Open shaft', notes: 'Open building shaft, 1530 × 2620. Not usable floor and NOT a planter — corrected in Rev 4.' },
    { id: 'R-CORE-W', name: 'Lift / void (west core)', anchor: { x: 9875, y: 1800 }, category: 'void', zone: 'core', carpet: false, finish: 'Building core' },
    { id: 'R-CORE-E', name: 'Lift / void (east core)', anchor: { x: 14605, y: 1800 }, category: 'void', zone: 'core', carpet: false, finish: 'Building core' },

    // ---- parents' pod
    { id: 'R-P-SUITE', name: "Master suite — parents", anchor: { x: 1600, y: 4000 }, category: 'habitable', zone: 'parents', carpet: true, publishedSqFt: 251, finish: 'Oak plank', notes: 'MB-01 + MB-02 merged. Includes the day-bed nook for the grandmother, screened by a curved sliding partition.' },
    { id: 'R-P-BATH', name: "Parents' bath", anchor: { x: 3965, y: 3800 }, category: 'wet', zone: 'parents', carpet: true, publishedSqFt: 40, finish: 'Stone', notes: 'Retained on the existing Master Toilet 01 stack (2430 × 1530 in the sanctioned plan).' },
    { id: 'R-P-DRESSING', name: "Parents' dressing", anchor: { x: 3965, y: 5510 }, category: 'circulation', zone: 'parents', carpet: true, finish: 'Oak plank' },
    { id: 'R-P-WARDROBE', name: "Parents' walk-in wardrobe", anchor: { x: 3965, y: 7200 }, category: 'storage', zone: 'parents', carpet: true, publishedSqFt: 40, finish: 'Oak plank', notes: 'Ex-Master Toilet 02. Plumbing capped, NOT removed, so the change is reversible.' },
    { id: 'R-P-FAMILY', name: 'Family room', anchor: { x: 6000, y: 3700 }, category: 'habitable', zone: 'parents', carpet: true, publishedSqFt: 80, finish: 'Oak plank', ceiling: 3070, notes: 'Flat glass roof over.' },
    { id: 'R-P-HALL', name: "Parents' pod hall", anchor: { x: 5800, y: 6600 }, category: 'circulation', zone: 'parents', carpet: true, publishedSqFt: 96, finish: 'Oak plank', notes: 'Contains the pooja niche.' },

    // ---- shared
    { id: 'R-GREAT', name: 'Great room', anchor: { x: 12240, y: 5500 }, category: 'habitable', zone: 'shared', carpet: true, publishedSqFt: 582, finish: 'Oak plank', notes: 'Living + dining. Widens from 7690 at the deck edge to 10480 at the dining end. Fully open to the deck.' },

    // ---- Karan's pod
    { id: 'R-K-DEN', name: 'Music + work den', anchor: { x: 18400, y: 3700 }, category: 'habitable', zone: 'karan', carpet: true, publishedSqFt: 80, finish: 'Oak plank', ceiling: 3070, notes: 'Flat glass roof over. Electronic drum kit, guitars, working couch. Pantry / coffee bar with a hatch to the deck.' },
    { id: 'R-K-HALL', name: "Karan's pod hall", anchor: { x: 18000, y: 5600 }, category: 'circulation', zone: 'karan', carpet: true, publishedSqFt: 96, finish: 'Oak plank', notes: 'Rev 4 publishes 96 sq ft for this hall, which is the figure BEFORE the gear store is taken out of it. See the integrity report.' },
    { id: 'R-K-GEAR', name: 'Gear store', anchor: { x: 19100, y: 7650 }, category: 'storage', zone: 'karan', carpet: true, finish: 'Oak plank' },
    { id: 'R-K-BATH', name: "Karan's bath", anchor: { x: 20515, y: 3800 }, category: 'wet', zone: 'karan', carpet: true, publishedSqFt: 40, finish: 'Stone', notes: 'Retained on the existing Master Toilet 01 stack.' },
    { id: 'R-K-DRESSING', name: "Karan's dressing", anchor: { x: 20515, y: 5510 }, category: 'circulation', zone: 'karan', carpet: true, finish: 'Oak plank' },
    { id: 'R-K-WARDROBE', name: "Karan's walk-in wardrobe", anchor: { x: 20515, y: 7200 }, category: 'storage', zone: 'karan', carpet: true, publishedSqFt: 40, finish: 'Oak plank', notes: 'Ex-Master Toilet 02. Plumbing capped, NOT removed.' },
    { id: 'R-K-SUITE', name: 'Master suite — Karan', anchor: { x: 22880, y: 4000 }, category: 'habitable', zone: 'karan', carpet: true, publishedSqFt: 251, finish: 'Oak plank', notes: 'MB-01 + MB-02 merged.' },

    // ---- service zone (sealed)
    { id: 'R-HELP', name: "Help's room", anchor: { x: 4150, y: 9600 }, category: 'habitable', zone: 'service', carpet: true, publishedSqFt: 50, finish: 'Vinyl', notes: 'Live-in, 24/7.' },
    { id: 'R-SVC-CORR', name: 'Service corridor', anchor: { x: 7000, y: 8800 }, category: 'circulation', zone: 'service', carpet: true, finish: 'Vinyl' },
    { id: 'R-SVC-WC', name: 'Service WC', anchor: { x: 5700, y: 10000 }, category: 'wet', zone: 'service', carpet: true, finish: 'Stone' },
    { id: 'R-LAUNDRY', name: 'Laundry / dry balcony', anchor: { x: 7000, y: 10000 }, category: 'service', zone: 'service', carpet: true, finish: 'Stone', notes: 'Retained on the existing dry-balcony stack.' },
    { id: 'R-STORE', name: 'Storeroom', anchor: { x: 8295, y: 10000 }, category: 'storage', zone: 'service', carpet: true, finish: 'Vinyl', notes: 'Heavy shelving both sides for home supplies.' },
    { id: 'R-KITCHEN', name: 'Kitchen', anchor: { x: 10565, y: 9600 }, category: 'wet', zone: 'service', carpet: true, publishedSqFt: 88, finish: 'Stone', notes: 'One kitchen only, deliberately placed away from Karan’s wing. Retained on the existing stack.' },
    { id: 'R-SVC-VEST', name: 'Service vestibule', anchor: { x: 12770, y: 9600 }, category: 'circulation', zone: 'service', carpet: true, finish: 'Vinyl', notes: 'Reached directly from the building lobby by F-1401.' },

    // ---- shared east bay
    { id: 'R-GUEST-BATH', name: 'Guest bath', anchor: { x: 14000, y: 9600 }, category: 'wet', zone: 'shared', carpet: true, finish: 'Stone', notes: 'Retained on the existing common-toilet stack.' },
    { id: 'R-ENTRY', name: 'Entry gallery', anchor: { x: 16650, y: 9600 }, category: 'circulation', zone: 'shared', carpet: true, publishedSqFt: 103, finish: 'Oak plank' },
  ],

  // Riser positions. PROVENANCE MATTERS: these are derived from the Rev 4 fixture
  // layout, not from a site survey. They make the integrity suite a real regression
  // guard — move a plumbed fixture and the build fails — but they must be confirmed
  // against the sanctioned plumbing drawings before anything is demolished.
  stacks: [
    { id: 'STK-P-BATH', name: "Parents' bath stack (ex Master Toilet 01)", at: { x: 3990, y: 4100 }, room: 'R-P-BATH', provenance: 'Rev 4 fixture layout; wet room matches sanctioned Master Toilet 01 at 2430 × 1530.' },
    { id: 'STK-K-BATH', name: "Karan's bath stack (ex Master Toilet 01)", at: { x: 20490, y: 4100 }, room: 'R-K-BATH', provenance: 'Rev 4 fixture layout; mirror of STK-P-BATH about x = 12240.' },
    { id: 'STK-GUEST', name: 'Guest bath stack (ex common toilet)', at: { x: 13970, y: 9830 }, room: 'R-GUEST-BATH', provenance: 'Rev 4 fixture layout; sanctioned common toilet 2250 × 1220 re-planned within the same wet zone.' },
    { id: 'STK-KITCHEN', name: 'Kitchen stack', at: { x: 9880, y: 8770 }, room: 'R-KITCHEN', provenance: 'Rev 4 sink position; kitchen retained at the sanctioned 3350 × 2450.' },
    { id: 'STK-SVC-WC', name: 'Service WC stack', at: { x: 5610, y: 10310 }, room: 'R-SVC-WC', provenance: 'Rev 4 fixture layout.' },
    { id: 'STK-LAUNDRY', name: 'Dry balcony / laundry stack', at: { x: 7040, y: 10470 }, room: 'R-LAUNDRY', provenance: 'Rev 4 appliance positions; retained on the sanctioned dry-balcony stack.' },
    { id: 'STK-P-WARD-CAP', name: "Parents' ex-toilet stack — CAPPED", at: { x: 3965, y: 7185 }, room: 'R-P-WARDROBE', capped: true, provenance: 'Ex Master Toilet 02. Capped, not removed, so the wardrobe conversion is reversible.' },
    { id: 'STK-K-WARD-CAP', name: "Karan's ex-toilet stack — CAPPED", at: { x: 20515, y: 7185 }, room: 'R-K-WARDROBE', capped: true, provenance: 'Ex Master Toilet 02. Capped, not removed.' },
  ],

  glassRoofs: [
    {
      id: 'ROOF-DECK',
      name: 'Retractable barrel vault over the deck',
      kind: 'barrel',
      // y0 is negative because the glass oversails the building line as it bulges out.
      extent: [4730, -700, 19750, 2620],
      // Section in ABSOLUTE (model y, height). It springs from floor level ON the building
      // line, bulges roughly 690 mm beyond it at about 3.2 m, peaks near 4.45 m, and lands
      // on the building face at 3050 — flush with the top of the walls, so the canopy and
      // the flat pod roofs meet edge to edge instead of the canopy floating above them.
      section: { p0: { x: 0, y: 0 }, p1: { x: -2200, y: 6600 }, p2: { x: 2620, y: 3050 } },
      retractable: true,
      glazing: 'Laminated acoustic glass',
      notes: 'HIGHEST-RISK ELEMENT. Now also the deck\u2019s enclosing wall, not just its roof: it runs to floor level where the external wall used to be. Covers an open balcony, so it needs society NOC and most likely BMC permission. Single glazing will not stop road noise — laminated acoustic glass is required, not optional.',
    },
    {
      id: 'ROOF-P-TERRACE',
      name: "Curved glass canopy over the parents' private terrace",
      kind: 'barrel',
      // Same family as the deck vault, scaled to an 1100 mm span instead of 2620. y0 is
      // negative because the glass oversails the building line as it bulges out.
      extent: [0, -300, 3200, 1100],
      // Absolute (model y, height). Springs from FLOOR LEVEL on the building line at
      // y = 0, bulges 292 mm beyond it at about 1.4 m, peaks at 3597, and lands on the
      // terrace wall head at y = 1100, height 3050 — flush with the top of the walls.
      section: { p0: { x: 0, y: 0 }, p1: { x: -930, y: 5000 }, p2: { x: 1100, y: 3050 } },
      // The west return is the building's own face, so it is closed by a gable cut to the
      // section. The east end faces the open building shaft and is deliberately left open.
      gableEnds: ['x0'],
      glazing: 'Laminated acoustic glass',
      notes:
        'Replaces the upright glass walls on both exposed edges of the terrace. Like the ' +
        'deck vault it is enclosure as well as roof, so the same consents apply: it covers ' +
        'an open balcony and needs society NOC and most likely BMC permission.',
    },
    {
      id: 'ROOF-K-TERRACE',
      name: "Curved glass canopy over Karan's private terrace",
      kind: 'barrel',
      extent: [21280, -300, 24480, 1100],
      section: { p0: { x: 0, y: 0 }, p1: { x: -930, y: 5000 }, p2: { x: 1100, y: 3050 } },
      // Mirror of the parents' canopy about x = 12240, so the closed end is the east one.
      gableEnds: ['x1'],
      glazing: 'Laminated acoustic glass',
      notes: 'Mirror of ROOF-P-TERRACE about x = 12 240. Same consents apply.',
    },
    {
      id: 'ROOF-FAMILY',
      name: 'Flat glass roof over the family room',
      kind: 'flat',
      extent: [4730, 2620, 8395, 4900],
      height: 3050,
      glazing: 'Laminated glass',
    },
    {
      id: 'ROOF-DEN',
      name: 'Flat glass roof over the music + work den',
      kind: 'flat',
      extent: [16085, 2620, 19750, 4900],
      height: 3050,
      glazing: 'Laminated glass',
    },
  ],

  portals: [
    { id: 'PORTAL-P', wall: 'W-CURVE-PARENTS', t: [0.42, 0.6], springing: 2180, rise: 620, label: 'Arched portal — parents’ pod' },
    { id: 'PORTAL-K', wall: 'W-CURVE-KARAN', t: [0.42, 0.6], springing: 2180, rise: 620, label: 'Arched portal — Karan’s pod' },
  ],

  screens: [
    {
      id: 'SCREEN-DAYBED',
      name: 'Day-bed screen',
      curve: { p0: { x: 0, y: 4100 }, p1: { x: 1700, y: 4580 }, p2: { x: 3200, y: 4100 } },
      height: 2250,
      notes: 'Curved sliding partition screening the grandmother’s day bed. Sliding, so it does not divide the suite into two rooms and does not appear in the room schedule.',
    },
  ],
}
