/**
 * Circulation graph. Rooms are nodes; doors, sliders, cased openings, arches and the
 * great-room threshold are edges. Windows are not.
 *
 * Two separate reachability questions matter to this brief (§2.4):
 *   1. can you get from the main entrance to every room, and
 *   2. can the house help get from the service entrance to every service room WITHOUT
 *      passing through any room of the house.
 */

import type { BuiltModel, ConnectionEdge } from './model'

export interface ReachResult {
  reached: Set<string>
  unreachable: string[]
  /** Shortest path in rooms, keyed by destination. Useful for explaining a failure. */
  paths: Map<string, string[]>
}

export function reachableFrom(
  model: BuiltModel,
  startRoomId: string,
  opts: { allow?: (edge: ConnectionEdge) => boolean; within?: Set<string> } = {},
): ReachResult {
  const allow = opts.allow ?? (() => true)
  const within = opts.within
  const reached = new Set<string>([startRoomId])
  const paths = new Map<string, string[]>([[startRoomId, [startRoomId]]])
  const queue = [startRoomId]

  while (queue.length) {
    const here = queue.shift()!
    for (const edge of model.adjacency.get(here) ?? []) {
      if (!allow(edge)) continue
      const next = edge.a === here ? edge.b : edge.a
      if (reached.has(next)) continue
      if (within && !within.has(next)) continue
      reached.add(next)
      paths.set(next, [...(paths.get(here) ?? []), next])
      queue.push(next)
    }
  }

  const candidates = within
    ? model.rooms.filter((r) => within.has(r.id))
    : model.rooms.filter((r) => r.def.category !== 'void')

  return {
    reached,
    unreachable: candidates.filter((r) => !reached.has(r.id)).map((r) => r.id),
    paths,
  }
}

/** The room a given opening leads into from outside the envelope. */
export function roomBehindOpening(model: BuiltModel, openingId: string): string | undefined {
  const op = model.openings.find((o) => o.id === openingId)
  if (!op) return undefined
  const n = { x: -op.dir.y, y: op.dir.x }
  const reach = op.thickness / 2 + 60
  for (const sign of [1, -1]) {
    const probe = { x: op.mid.x + n.x * reach * sign, y: op.mid.y + n.y * reach * sign }
    const room = model.rooms.find(
      (r) =>
        r.polygon.length > 2 &&
        pointIn(probe, r.polygon) &&
        !r.holes.some((h) => pointIn(probe, h)),
    )
    if (room) return room.id
  }
  return undefined
}

function pointIn(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

export const serviceRoomIds = (model: BuiltModel): Set<string> =>
  new Set(model.rooms.filter((r) => r.def.zone === 'service').map((r) => r.id))

/**
 * Connections with exactly one end inside the service zone. The brief allows exactly one
 * of these — the sealed service door — plus the serving hatch, which does not circulate.
 */
export function serviceBreaches(model: BuiltModel): ConnectionEdge[] {
  const svc = serviceRoomIds(model)
  return model.connections.filter((c) => svc.has(c.a) !== svc.has(c.b))
}
