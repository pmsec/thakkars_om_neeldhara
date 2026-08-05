/**
 * Style overrides: which saved material covers which surface, and which saved
 * 3D object stands in for which furniture piece.
 *
 * THE PLAN STAYS THE BOSS. A material only repaints a surface; an object is
 * FITTED into its piece's drawn footprint — scaled to fit, floored at 0,
 * turned in quarter steps — so the projection gate holds for custom meshes
 * exactly as it does for the built-in ones.
 *
 * Assignments live in localStorage (small), the heavy assets in IndexedDB.
 * Every change fires 'om-style-changed'; the 3D views listen and rebuild.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { FurnitureItem } from '../data/furniture'
import { materialLib, objectLib } from './libStore'
import { S } from './prism'

export interface StyleAssign {
  /** roomId -> material id; the special key '*' is every floor. */
  floors: Record<string, number>
  walls?: number | null
  /** furniture id -> saved object + quarter turns. */
  objects: Record<string, { objId: number; rot: number }>
}

const LS = 'om-style-assign'

export function getAssign(): StyleAssign {
  try {
    const a = JSON.parse(localStorage.getItem(LS) || '{}') as Partial<StyleAssign>
    return { floors: a.floors ?? {}, walls: a.walls ?? null, objects: a.objects ?? {} }
  } catch {
    return { floors: {}, walls: null, objects: {} }
  }
}

export function setAssign(a: StyleAssign): void {
  localStorage.setItem(LS, JSON.stringify(a))
  window.dispatchEvent(new Event('om-style-changed'))
}

// ------------------------------------------------------------- materials
const matCache = new Map<number, THREE.MeshStandardMaterial>()

function materialFromImage(dataUrl: string): THREE.MeshStandardMaterial {
  const img = new Image()
  const tex = new THREE.Texture(img)
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping // hides tile seams
  tex.repeat.set(1 / 1.2, 1 / 1.2)                     // ~1.2 m per tile
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  img.onload = () => { tex.needsUpdate = true }
  img.src = dataUrl
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })
}

/** Load every ASSIGNED material into the cache; call before a scene build. */
export async function primeStyle(): Promise<void> {
  const a = getAssign()
  const ids = new Set<number>(Object.values(a.floors))
  if (a.walls) ids.add(a.walls)
  for (const id of ids) {
    if (matCache.has(id)) continue
    const m = await materialLib.get(id)
    if (m) matCache.set(id, materialFromImage(m.image))
  }
  const objIds = new Set(Object.values(a.objects).map((o) => o.objId))
  await Promise.all([...objIds].map((id) => loadObjectProto(id)))
}

export function floorMaterial(roomId: string): THREE.MeshStandardMaterial | null {
  const a = getAssign()
  const id = a.floors[roomId] ?? a.floors['*']
  return id ? matCache.get(id) ?? null : null
}

export function wallMaterial(): THREE.MeshStandardMaterial | null {
  const a = getAssign()
  return a.walls ? matCache.get(a.walls) ?? null : null
}

// --------------------------------------------------------------- objects
interface Proto { group: THREE.Group; size: THREE.Vector3; min: THREE.Vector3 }
const objCache = new Map<number, Proto | 'loading' | 'failed'>()
const loader = new GLTFLoader()

function loadObjectProto(id: number): Promise<void> {
  const hit = objCache.get(id)
  if (hit && hit !== 'failed') return Promise.resolve()
  objCache.set(id, 'loading')
  return objectLib.get(id).then(
    (rec) =>
      new Promise<void>((resolve) => {
        if (!rec) { objCache.set(id, 'failed'); resolve(); return }
        loader.parse(
          rec.glb, '',
          (gltf) => {
            const g = gltf.scene
            const bb = new THREE.Box3().setFromObject(g)
            objCache.set(id, { group: g, size: bb.getSize(new THREE.Vector3()), min: bb.min.clone() })
            window.dispatchEvent(new Event('om-style-changed'))
            resolve()
          },
          () => { objCache.set(id, 'failed'); resolve() },
        )
      }),
  )
}

/**
 * The custom object for a piece, FITTED to the drawn footprint: uniform
 * scale so it fits w × d × height, floor on 0, centred, quarter-turned as
 * assigned. Returns null when none is assigned (or it failed) — the caller
 * falls back to the built-in mesh.
 */
export function customObject(f: FurnitureItem): THREE.Object3D | null {
  const a = getAssign()
  const asg = a.objects[f.id]
  if (!asg) return null
  const proto = objCache.get(asg.objId)
  if (!proto || proto === 'loading' || proto === 'failed') {
    if (!proto) void loadObjectProto(asg.objId)
    return null
  }
  const inst = proto.group.clone(true)
  const quarter = ((asg.rot % 4) + 4) % 4
  const swapped = quarter % 2 === 1
  const fw = (swapped ? f.d : f.w) * S
  const fd = (swapped ? f.w : f.d) * S
  const s = Math.min(
    fw / Math.max(proto.size.x, 1e-6),
    (f.height * S) / Math.max(proto.size.y, 1e-6),
    fd / Math.max(proto.size.z, 1e-6),
  )
  const holder = new THREE.Group()
  inst.scale.setScalar(s)
  // centre the mesh on its own bbox centre, floor at y 0
  const cxm = (proto.min.x + proto.size.x / 2) * s
  const czm = (proto.min.z + proto.size.z / 2) * s
  inst.position.set(-cxm, -proto.min.y * s, -czm)
  const spin = new THREE.Group()
  spin.add(inst)
  spin.rotation.y = (quarter * Math.PI) / 2
  holder.add(spin)
  holder.position.set((f.x + f.w / 2) * S, 0, (f.y + f.d / 2) * S)
  holder.traverse((o) => { o.castShadow = true; o.receiveShadow = true })
  return holder
}
