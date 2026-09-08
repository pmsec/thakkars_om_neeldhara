/**
 * The planted strips inside the parapets - the deck's and both terraces' - as
 * a clipped hedge with small leaves, in a rhythm: six feet of hedge, then a
 * globe lamp in a short gap, then six feet of hedge again.
 *
 * Each run of hedge is a dark green core wrapped in a few thousand leaf cards
 * (one instanced mesh, so it costs one draw call), with small white flowers
 * scattered over its face and top. It tops out around 1900 mm: from inside the
 * home the eye is at 1620, so the sightline over it climbs and the city drops
 * out - bushes and sky. Every card stays inside the drawn bed, so the 2D-to-3D
 * footprint gate holds for the hedge exactly as for a sofa.
 */

import * as THREE from 'three'
import type { FurnitureItem } from '../data/furniture'
import { S } from './prism'

export interface HedgeMats {
  bed: THREE.Material
  leaf: THREE.Material
  leafDark: THREE.Material
}

export const HEDGE_TOP = 1900
const BUSH = 1829          // six feet of hedge
const GAP = 450            // the lamp's gap between bushes
const LEAF = 80

/** Deterministic jitter, the same on every load and in both renderers. */
function jitter(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

let leafTex: THREE.CanvasTexture | null = null
/** The leaf cut-out; null where there is no canvas (the test runner), and then the cards are plain. */
function leafTexture(): THREE.CanvasTexture | null {
  if (leafTex) return leafTex
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 64, 64)
  // an ovate leaf with a lighter mid-vein
  ctx.fillStyle = '#4f7f36'
  ctx.beginPath()
  ctx.moveTo(32, 2)
  ctx.bezierCurveTo(58, 14, 58, 44, 32, 62)
  ctx.bezierCurveTo(6, 44, 6, 14, 32, 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(190,220,150,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(32, 6)
  ctx.lineTo(32, 58)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  leafTex = t
  return t
}

export function hedgeGroup(f: FurnitureItem, M: HedgeMats, bed?: THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group()
  if (bed) g.add(bed)
  const alongX = f.w >= f.d
  const long = alongX ? f.w : f.d
  const across = alongX ? f.d : f.w
  const half = Math.max(50, across / 2 - 10)      // the foliage never leaves the bed
  const H = HEDGE_TOP

  // the rhythm along the strip: bush, gap with a lamp, bush ... a last bush is
  // kept if it is at least half a bush long
  const runs: Array<[number, number]> = []
  const lamps: number[] = []
  let s = 0
  while (s < long - 10) {
    const e = Math.min(long, s + BUSH)
    if (e - s >= BUSH * 0.45) runs.push([s, e])
    s = e + GAP
    if (s < long - 10) lamps.push(e + GAP / 2)
  }

  // materials: the leaf card is the renderer's own leaf material with the leaf
  // texture cut out of it, so the technical tab keeps its clipping planes
  const tex = leafTexture()
  const leafMat = (M.leaf as THREE.MeshStandardMaterial).clone()
  leafMat.side = THREE.DoubleSide
  const darkMat = (M.leafDark as THREE.MeshStandardMaterial).clone()
  darkMat.side = THREE.DoubleSide
  if (tex) {
    leafMat.map = tex
    leafMat.alphaTest = 0.5
    leafMat.color = new THREE.Color(0xdde8cf)
    darkMat.map = tex
    darkMat.alphaTest = 0.5
    darkMat.color = new THREE.Color(0xa9bf95)
  }
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.8 })
  const coreMat = (M.leafDark as THREE.MeshStandardMaterial).clone()
  coreMat.color = new THREE.Color(0x2e4a24)

  const toWorld = (u: number, v: number, h: number) => ({
    x: (alongX ? f.x + u : f.x + f.w / 2 + v) * S,
    y: h * S,
    z: (alongX ? f.y + f.d / 2 + v : f.y + u) * S,
  })

  const leafGeo = new THREE.PlaneGeometry(LEAF * S, LEAF * 0.85 * S)
  const flowerGeo = new THREE.SphereGeometry(20 * S, 6, 5)
  const dummy = new THREE.Object3D()

  let seed = 0
  for (const [u0, u1] of runs) {
    const len = u1 - u0
    // the core, a little inside the leaf skin
    const core = new THREE.Mesh(
      new THREE.BoxGeometry((alongX ? len - 60 : half * 2 - 40) * S, (H - 380) * S, (alongX ? half * 2 - 40 : len - 60) * S),
      coreMat,
    )
    const cw = toWorld((u0 + u1) / 2, 0, 300 + (H - 380) / 2)
    core.position.set(cw.x, cw.y, cw.z)
    core.castShadow = true
    core.receiveShadow = true
    g.add(core)

    // leaf cards over both faces, both ends and the top, in two greens
    const perFace = Math.round((len / 55) * ((H - 300) / 55))
    const perTop = Math.round((len / 55) * ((half * 2) / 55))
    const perEnd = Math.round(((half * 2) / 55) * ((H - 300) / 55))
    const total = perFace * 2 + perTop + perEnd * 2
    for (const [mat, share] of [[leafMat, 0.65], [darkMat, 0.35]] as const) {
      const count = Math.max(1, Math.round(total * share))
      const inst = new THREE.InstancedMesh(leafGeo, mat, count)
      inst.castShadow = true
      for (let i = 0; i < count; i++) {
        seed++
        const r1 = jitter(seed, 1)
        const r2 = jitter(seed, 2)
        const r3 = jitter(seed, 3)
        const which = r1 * total
        let u: number
        let v: number
        let h: number
        let nx = 0
        let ny = 0
        let nz = 0
        if (which < perFace * 2) {
          const side = which < perFace ? -1 : 1
          u = u0 + 30 + r2 * (len - 60)
          v = side * (half - 40)
          h = 330 + r3 * (H - 360)
          nz = side
        } else if (which < perFace * 2 + perTop) {
          u = u0 + 30 + r2 * (len - 60)
          v = -(half - 40) + r3 * 2 * (half - 40)
          h = H - 40 + jitter(seed, 4) * 40
          ny = 1
        } else {
          const side = which < perFace * 2 + perTop + perEnd ? -1 : 1
          u = side < 0 ? u0 + 40 : u1 - 40
          v = -(half - 40) + r2 * 2 * (half - 40)
          h = 330 + r3 * (H - 360)
          nx = side
        }
        const p = toWorld(u, v, h)
        dummy.position.set(p.x, p.y, p.z)
        // face the card roughly along the surface normal, then tumble it a little
        const normal = alongX ? new THREE.Vector3(nx, ny, nz) : new THREE.Vector3(nz, ny, nx)
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.normalize())
        dummy.rotateX((jitter(seed, 5) - 0.5) * 1.2)
        dummy.rotateY((jitter(seed, 6) - 0.5) * 1.2)
        dummy.rotateZ(jitter(seed, 7) * Math.PI * 2)
        const sc = 0.8 + jitter(seed, 8) * 0.5
        dummy.scale.set(sc, sc, sc)
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
      }
      inst.instanceMatrix.needsUpdate = true
      g.add(inst)
    }

    // small white flowers over the room face and the top
    const nFlowers = Math.max(6, Math.round(len / 90))
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, nFlowers)
    for (let i = 0; i < nFlowers; i++) {
      seed++
      const onTop = jitter(seed, 9) < 0.4
      const u = u0 + 60 + jitter(seed, 10) * (len - 120)
      const side = Math.sign((alongX ? 1 : 1) * (jitter(seed, 11) - 0.5)) || 1
      const v = onTop ? (jitter(seed, 12) - 0.5) * 2 * (half - 50) : side * (half - 30)
      const h = onTop ? H - 10 : 500 + jitter(seed, 13) * (H - 600)
      const p = toWorld(u, v, h)
      dummy.position.set(p.x, p.y, p.z)
      dummy.quaternion.identity()
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      flowers.setMatrixAt(i, dummy.matrix)
    }
    flowers.instanceMatrix.needsUpdate = true
    g.add(flowers)
  }

  // the globe lamps in the gaps: a slim post, a glowing globe, and the light it throws
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 })
  const globeMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc866, emissiveIntensity: 1.8, roughness: 0.4 })
  lamps.forEach((u, li) => {
    const base = toWorld(u, 0, 0)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 22 * S, 700 * S, 10), postMat)
    post.position.set(base.x, 300 * S + 350 * S, base.z)
    post.castShadow = true
    g.add(post)
    const globe = new THREE.Mesh(new THREE.SphereGeometry(Math.min(150, half - 10) * S, 20, 14), globeMat)
    globe.position.set(base.x, 1150 * S, base.z)
    g.add(globe)
    // every globe glows; every third one carries a real light with a wider throw,
    // which lights the run the same and costs a third of the shading
    if (li % 3 === 0) {
      const light = new THREE.PointLight(0xffd27a, 1.5, 5.5, 1.6)
      light.position.set(base.x, 1150 * S, base.z)
      g.add(light)
    }
  })
  return g
}
