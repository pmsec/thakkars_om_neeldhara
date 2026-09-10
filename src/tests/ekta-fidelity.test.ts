import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
// pick Ekta before the registry resolves the active home
;(globalThis as any).localStorage = { getItem: (k: string) => (k === 'om-active-home' ? 'ekta' : null), setItem() {}, removeItem() {} }
const { activeHomeId } = await import('../homes/registry')
const { furniture } = await import('../data/furniture')
const { fixtures } = await import('../data/fixtures')
const { wallCrossings, outsideEnvelope } = await import('../geometry/fidelity')
const { furnitureMesh } = await import('../render3d/Realistic')
const { S } = await import('../render3d/prism')
const { getModel } = await import('../geometry/model')
const { runIntegrity } = await import('../geometry/integrity')

/**
 * EKTA'S 2D<->3D FIDELITY. The suite's other gates run against the default
 * home only, because the app resolves one home per load; this file picks
 * Ekta before the registry resolves, and holds her to the same bars: nothing
 * outside the envelope, every 3D piece inside its drawn footprint, and no
 * wall crossings beyond the two the 2D drawing itself carries (the serving
 * counter through the kitchen wall by design, and the shower quadrant
 * against the curved bath wall).
 */
describe('Ekta fidelity', () => {
  it('is the active home', () => { expect(activeHomeId).toBe('ekta') })
  it('summary', () => {
    const model = getModel()
    console.log('AUDIT rooms', model.rooms.length, model.rooms.map((r) => `${r.def.name}:${(r.area / 1e6).toFixed(2)}`).join(' | '))
    console.log('AUDIT walls', model.walls.filter((w) => !w.isExterior).length, 'openings', model.walls.flatMap((w) => w.openings).map((o) => o.type).join(','))
    console.log('AUDIT furniture', furniture.length, 'fixtures', fixtures.length)
    const rep = runIntegrity(model)
    console.log('AUDIT integrity', rep.passed, '/', rep.checks.length, 'failed', rep.failed, rep.checks.filter((c) => !c.pass).map((c) => c.id).join(','))
  })
  it('no furniture crosses a wall beyond the two the drawing carries', () => {
    const c = wallCrossings()
    console.log('AUDIT crossings', c.map((x) => `${x.itemId} ${x.wallId} ${(x.areas[0] / 1e6).toFixed(3)}/${(x.areas[1] / 1e6).toFixed(3)}`).join(' ; '))
    expect(c.map((x) => x.wallId).sort()).toEqual(['W-KIT', 'W-SEB'])
  })
  it('nothing outside the envelope', () => {
    const o = outsideEnvelope()
    expect(o.map((x) => x.itemId)).toEqual([])
  })
  it('every 3D piece projects inside its footprint', () => {
    const stub = new Proxy({}, { get: () => new THREE.MeshStandardMaterial() }) as any
    const TOL = 30
    const bad: string[] = []
    for (const f of furniture) {
      if (f.kind === 'tree') continue
      const o = furnitureMesh(f, stub)
      if (!o) continue
      o.updateMatrixWorld(true)
      const bb = new THREE.Box3().setFromObject(o)
      if (bb.isEmpty()) continue
      const over = Math.max(f.x - TOL - bb.min.x / S, bb.max.x / S - (f.x + f.w + TOL), f.y - TOL - bb.min.z / S, bb.max.z / S - (f.y + f.d + TOL))
      if (over > 0) bad.push(`${f.id} (${f.label.slice(0, 40)}) +${over.toFixed(0)}mm`)
    }
    console.log('AUDIT projection', bad.length ? bad.join(' ; ') : 'all inside')
    expect(bad).toEqual([])
  })
})
