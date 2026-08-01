/**
 * Preset cameras, DERIVED from the rooms rather than hand-placed.
 *
 * Hand-placed cameras went stale silently the moment the plan-to-scene mapping was
 * corrected, because they had been dialled in against mirrored geometry. Deriving them
 * fixes that, but derivation has its own failure mode — a formula that is right for a
 * 10 m great room can put the camera inside a wall for a 3 m kitchen. Hence this module
 * is pure and separately tested: `src/tests/cameras.test.ts` raycasts from every preset
 * to its target and fails if anything is in the way.
 */

import * as THREE from 'three'
import { getModel } from '../geometry/model'
import { S } from './prism'

export interface Preset {
  id: string
  label: string
  room?: string
  /** Which side to stand on: +1 looks from the lobby side, -1 from the deck side. */
  from?: 1 | -1
}

export const PRESETS: Preset[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'great', label: 'Great room', room: 'R-GREAT' },
  { id: 'deck', label: 'Deck', room: 'R-DECK' },
  { id: 'podP', label: "Parents' pod", room: 'R-P-HALL' },
  { id: 'podK', label: "Karan's pod", room: 'R-K-HALL' },
  { id: 'service', label: 'Service wing', room: 'R-KITCHEN' },
  { id: 'suiteP', label: "Parents' suite", room: 'R-P-SUITE' },
  { id: 'suiteK', label: "Karan's suite", room: 'R-K-SUITE' },
]

export interface CameraShot {
  pos: THREE.Vector3
  look: THREE.Vector3
}

export function presetCamera(p: Preset): CameraShot {
  const model = getModel()
  const env = model.envelopeBBox

  if (!p.room) {
    const cx = ((env.minX + env.maxX) / 2) * S
    const cy = ((env.minY + env.maxY) / 2) * S
    const span = (env.maxX - env.minX) * S
    return {
      pos: new THREE.Vector3(cx, span * 0.78, cy + span * 1.02),
      look: new THREE.Vector3(cx, 0.6, cy),
    }
  }

  const room = model.roomById.get(p.room)!
  const cx = room.centroid.x * S
  const cy = room.centroid.y * S
  const span = Math.max(room.width, room.depth) * S
  const depth = room.depth * S
  const side = p.from ?? 1
  const ceiling = model.data.levels.ceiling * S
  const targetY = 0.3

  // How steeply the camera must look down to see over the room's own near wall: the
  // sight line drops from camera to target, and half a room depth short of the target it
  // still has to be above the ceiling. Shallow views into a small service room are simply
  // not possible, which is why this is derived rather than a fixed elevation.
  //
  // The deck is the reason there is no "view it from outside" case: Rev 4 draws a solid
  // 240 mm external wall along the whole north face, INCLUDING in front of the deck, with
  // no opening in it. A 3050 mm wall 1.2 m from the deck's centre cannot be seen over
  // from the north at any angle, so the deck is viewed from the great room side, which is
  // open to it. See the note in the brief page — that wall is worth querying.
  const slope = Math.max(1.0, (ceiling - targetY + 0.6) / Math.max(0.6, depth / 2))

  // Framing: a 52 degree vertical field on a wide viewport is roughly 62 degrees across,
  // so half the span must sit within tan(31 degrees) of the view distance.
  const framing = Math.max(4, span * 0.95) / Math.sqrt(1 + slope * slope)

  // Clearance: the steeper the slope, the smaller the horizontal component of that view
  // distance — for the kitchen it collapsed to 1.2 m and put the camera INSIDE the south
  // external wall. Stand back past the room's own edge and the wall beyond it, always.
  const clearance = depth / 2 + 1.6

  const back = Math.max(framing, clearance)
  // Aim slightly past the room, away from the camera, so the rooms being looked over
  // drop out of the bottom of the frame.
  const lookZ = cy - side * depth * 0.3
  return {
    pos: new THREE.Vector3(cx, targetY + slope * back, cy + side * back),
    look: new THREE.Vector3(cx, 1.0, lookZ),
  }
}
