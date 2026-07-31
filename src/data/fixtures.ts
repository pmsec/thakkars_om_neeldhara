/**
 * Sanitaryware and fitted appliances.
 *
 * These are part of the BUILDING FABRIC, not the furniture layer: they are plumbed,
 * fixed, and they are what ties each wet room to its retained stack. Keeping them here
 * rather than in `furniture.ts` is what lets the furniture layer be switched off — and
 * excluded from the integrity checks (brief §4) — while the wet-stack check still runs.
 *
 * Positions are the reference points used in floor-plan-source.py.
 */

import type { FixtureDef } from './schema'

export const fixtures: FixtureDef[] = [
  // ---- parents' bath (retained Master Toilet 01 stack)
  { id: 'FX-P-WC', kind: 'wc', at: { x: 4370, y: 4560 }, size: [500, 420], rotation: 180, room: 'R-P-BATH', stack: 'STK-P-BATH', label: 'WC' },
  { id: 'FX-P-BASIN', kind: 'basin', at: { x: 3620, y: 4560 }, size: [620, 440], room: 'R-P-BATH', stack: 'STK-P-BATH', label: 'Basin' },
  { id: 'FX-P-SHOWER', kind: 'shower', at: { x: 3965, y: 3170 }, size: [1350, 900], room: 'R-P-BATH', stack: 'STK-P-BATH', label: 'Shower' },

  // ---- Karan's bath (retained Master Toilet 01 stack)
  { id: 'FX-K-WC', kind: 'wc', at: { x: 20110, y: 4560 }, size: [500, 420], rotation: 0, room: 'R-K-BATH', stack: 'STK-K-BATH', label: 'WC' },
  { id: 'FX-K-BASIN', kind: 'basin', at: { x: 20860, y: 4560 }, size: [620, 440], room: 'R-K-BATH', stack: 'STK-K-BATH', label: 'Basin' },
  { id: 'FX-K-SHOWER', kind: 'shower', at: { x: 20515, y: 3170 }, size: [1350, 900], room: 'R-K-BATH', stack: 'STK-K-BATH', label: 'Shower' },

  // ---- guest bath (retained common-toilet stack)
  { id: 'FX-G-WC', kind: 'wc', at: { x: 13620, y: 10450 }, size: [420, 500], rotation: 90, room: 'R-GUEST-BATH', stack: 'STK-GUEST', label: 'WC' },
  { id: 'FX-G-BASIN', kind: 'basin', at: { x: 14320, y: 9200 }, size: [620, 440], rotation: 180, room: 'R-GUEST-BATH', stack: 'STK-GUEST', label: 'Basin' },

  // ---- service WC
  { id: 'FX-S-WC', kind: 'wc', at: { x: 5340, y: 10480 }, size: [420, 500], rotation: 90, room: 'R-SVC-WC', stack: 'STK-SVC-WC', label: 'WC' },
  { id: 'FX-S-BASIN', kind: 'basin', at: { x: 5990, y: 10440 }, size: [440, 620], rotation: 90, room: 'R-SVC-WC', stack: 'STK-SVC-WC', label: 'Basin' },
  { id: 'FX-S-SHOWER', kind: 'shower', at: { x: 5500, y: 10020 }, size: [700, 560], room: 'R-SVC-WC', stack: 'STK-SVC-WC', label: 'Shower' },

  // ---- laundry / dry balcony
  { id: 'FX-WASHER', kind: 'washer', at: { x: 6720, y: 10470 }, size: [580, 580], room: 'R-LAUNDRY', stack: 'STK-LAUNDRY', label: 'Washing machine' },
  { id: 'FX-DRYER', kind: 'dryer', at: { x: 7350, y: 10470 }, size: [580, 580], room: 'R-LAUNDRY', stack: 'STK-LAUNDRY', label: 'Dryer' },

  // ---- kitchen (retained stack; sink is the plumbed fixture)
  { id: 'FX-K-SINK', kind: 'sink', at: { x: 9880, y: 8770 }, size: [500, 420], room: 'R-KITCHEN', stack: 'STK-KITCHEN', label: 'Sink' },
  { id: 'FX-K-HOB', kind: 'hob', at: { x: 10850, y: 10480 }, size: [700, 600], room: 'R-KITCHEN', label: 'Hob, 4 burner' },
  { id: 'FX-K-FRIDGE', kind: 'fridge', at: { x: 11860, y: 10420 }, size: [640, 760], room: 'R-KITCHEN', label: 'Tall fridge' },
  { id: 'FX-K-CTR-N', kind: 'counter', at: { x: 10565, y: 8770 }, size: [3230, 620], room: 'R-KITCHEN', label: 'Counter run, north' },
  { id: 'FX-K-CTR-S', kind: 'counter', at: { x: 10190, y: 10480 }, size: [2480, 620], room: 'R-KITCHEN', label: 'Counter run, south' },
  { id: 'FX-K-HATCH-CTR', kind: 'counter', at: { x: 11630, y: 8770 }, size: [900, 620], room: 'R-KITCHEN', label: 'Serving hatch counter' },

  // ---- pantry / coffee bar in Karan's den, with the hatch through to the deck
  { id: 'FX-PANTRY', kind: 'counter', at: { x: 17270, y: 2990 }, size: [1780, 620], room: 'R-K-DEN', label: 'Pantry / coffee bar' },
  { id: 'FX-PANTRY-SINK', kind: 'sink', at: { x: 16760, y: 2990 }, size: [320, 320], room: 'R-K-DEN', label: 'Coffee bar sink' },
]
