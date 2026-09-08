/**
 * Draw-call reduction for the walkthrough.
 *
 * The house is built as thousands of small meshes - every jar, mug, drop and
 * rib its own draw call - and on an iPad that, not the triangle count, is
 * what drags the frame rate down. Nothing here moves after it is built, so
 * every mesh that shares a material (and the same set of vertex attributes)
 * is baked into one geometry in world space. Lights, instanced meshes, and
 * anything under a named group (the toggled sets: doors, roof, ceiling, wall
 * bed) are merged within their own group so the switches still work.
 */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

function attrKey(g: THREE.BufferGeometry): string {
  return Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '|n')
}

/** Merge every plain mesh directly or indirectly under `root`, in place. */
export function mergeStatic(root: THREE.Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true)
  let before = 0
  let after = 0
  // toggled sets keep their own merged meshes so visibility still flips as one
  const named: THREE.Object3D[] = []
  root.traverse((o) => { if (o !== root && o.name && o.parent && !isUnderNamed(o.parent, root)) named.push(o) })
  const roots = [root, ...named]
  for (const r of roots) {
    const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>()
    const doomed: THREE.Mesh[] = []
    r.traverse((o) => {
      if (o !== r && named.includes(o)) return
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return
      // skip anything inside a named set unless r is that set
      if (r === root && isUnderNamed(o, root)) return
      if (Array.isArray(o.material)) return
      const g = o.geometry as THREE.BufferGeometry
      if (!g.attributes.position) return
      before++
      const key = o.material.uuid + '|' + attrKey(g)
      let b = buckets.get(key)
      if (!b) { b = { mat: o.material, geos: [], cast: false, receive: false }; buckets.set(key, b) }
      const clone = g.clone()
      clone.applyMatrix4(o.matrixWorld)
      // strip attributes the others in this bucket may lack: normal and position are enough
      b.geos.push(clone)
      b.cast = b.cast || o.castShadow
      b.receive = b.receive || o.receiveShadow
      doomed.push(o)
    })
    for (const m of doomed) m.parent?.remove(m)
    for (const b of buckets.values()) {
      const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false)
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, b.mat)
      mesh.castShadow = b.cast
      mesh.receiveShadow = b.receive
      mesh.frustumCulled = true
      r.add(mesh)
      after++
    }
  }
  // drop groups left empty
  const empties: THREE.Object3D[] = []
  root.traverse((o) => { if (o !== root && o.children.length === 0 && !(o instanceof THREE.Mesh) && !(o instanceof THREE.Light) && !o.name) empties.push(o) })
  for (const e of empties) e.parent?.remove(e)
  return { before, after }
}

function isUnderNamed(o: THREE.Object3D, root: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o
  while (p && p !== root) {
    if (p.name) return true
    p = p.parent
  }
  return false
}
