/**
 * Dumps Home 1's derived rooms, furniture and fixtures for the feet-only
 * print (docs/feet-plan/feet_plan.py):
 *   FEET_DUMP=/tmp/home1-dump.json npx vite-node docs/feet-plan/dump.ts
 */
import { writeFileSync } from 'fs'
import { getModel } from '../../src/geometry/model'
import { furniture } from '../../src/data/furniture'
import { fixtures } from '../../src/data/fixtures'

{
  const m = getModel()
  writeFileSync(process.env.FEET_DUMP ?? '/tmp/home1-dump.json', JSON.stringify({
    ceiling: m.data.levels.ceiling,
    rooms: m.rooms.map((r) => ({ id: r.def.id, name: r.def.name, category: r.def.category, polygon: r.polygon })),
    furniture,
    fixtures,
  }))
}
