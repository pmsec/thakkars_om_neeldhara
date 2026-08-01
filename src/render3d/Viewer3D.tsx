/**
 * The 3D viewer. Every mesh comes from `geometry/solid.ts`, which is derived from the
 * same walls as the 2D plan — there are no coordinates in this file.
 *
 * Scene units are metres (model mm / 1000). Model x -> scene x, model y -> scene z,
 * height -> scene y.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { getModel } from '../geometry/model'
import { buildSolids, type Prism } from '../geometry/solid'
import { building } from '../data/building'
import { furniture } from '../data/furniture'
import { fixtures } from '../data/fixtures'
import { bezierAt } from '../geometry/bezier'
import { pointInPolygon, type Poly } from '../geometry/vec'
import { formatLength } from '../geometry/units'
import { useStore } from '../ui/store'
import { hourLabel, solarPosition, sunVector } from './sun'

const model = getModel()
const solids = buildSolids(model)
const S = 0.001 // mm -> m

const MAT = {
  plaster: new THREE.MeshStandardMaterial({ color: 0xefeae1, roughness: 0.95, metalness: 0 }),
  exterior: new THREE.MeshStandardMaterial({ color: 0xe4ded2, roughness: 0.95 }),
  partition: new THREE.MeshStandardMaterial({ color: 0xf2eee7, roughness: 0.95 }),
  lintel: new THREE.MeshStandardMaterial({ color: 0xe8e2d7, roughness: 0.95 }),
  // Enough tint to read as the signature curved glass wall rather than vanishing.
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x9dc4d1,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.6,
    thickness: 0.02,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  }),
  roofGlass: new THREE.MeshPhysicalMaterial({
    color: 0xbcd8e4,
    roughness: 0.04,
    transmission: 0.72,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  }),
  mullion: new THREE.MeshStandardMaterial({ color: 0x3f7a8c, roughness: 0.5, metalness: 0.3 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xd8c39c, roughness: 0.72 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xcfd4cf, roughness: 0.55 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xc4b79f, roughness: 0.85 }),
  vinyl: new THREE.MeshStandardMaterial({ color: 0xdcd6c9, roughness: 0.8 }),
  furniture: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.85 }),
  soft: new THREE.MeshStandardMaterial({ color: 0xe3d9c6, roughness: 0.95 }),
  green: new THREE.MeshStandardMaterial({ color: 0x8fae8a, roughness: 0.9 }),
}

function floorMaterial(finish: string): THREE.Material {
  if (/stone/i.test(finish)) return MAT.stone
  if (/deck/i.test(finish)) return MAT.deck
  if (/vinyl/i.test(finish)) return MAT.vinyl
  return MAT.wood
}

function shapeFrom(poly: Poly, holes: Poly[] = []): THREE.Shape {
  const s = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x * S, p.y * S)))
  for (const h of holes) s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x * S, p.y * S))))
  return s
}

/** Extrude a plan polygon upward between two heights. */
function prismMesh(poly: Poly, base: number, top: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: (top - base) * S, bevelEnabled: false })
  // The shape lives in XY and extrudes along +Z; rotate so it stands up in Y.
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, top * S, 0)
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function prismMaterial(p: Prism): THREE.Material {
  switch (p.kind) {
    case 'wall-exterior':
      return MAT.exterior
    case 'wall-partition':
      return MAT.partition
    case 'wall-curved-glass':
    case 'glazing':
    case 'screen':
      return MAT.glass
    case 'lintel':
      return MAT.lintel
    default:
      return MAT.plaster
  }
}

const PRESETS: Array<{ id: string; label: string; room?: string; pos: [number, number, number]; look: [number, number, number] }> = [
  { id: 'overview', label: 'Overview', pos: [12.24, 17, 21], look: [12.24, 0, 5.4] },
  { id: 'great', label: 'Great room', room: 'R-GREAT', pos: [12.24, 6, 14], look: [12.24, 1.2, 5.5] },
  { id: 'deck', label: 'Deck', room: 'R-DECK', pos: [12.24, 5, -8], look: [12.24, 1.4, 1.3] },
  { id: 'podP', label: "Parents' pod", room: 'R-P-HALL', pos: [2.5, 7.5, 13], look: [5.8, 1.2, 6.0] },
  { id: 'podK', label: "Karan's pod", room: 'R-K-HALL', pos: [22, 7.5, 13], look: [18.0, 1.2, 6.0] },
  { id: 'service', label: 'Service wing', room: 'R-KITCHEN', pos: [10.5, 8, 18], look: [10.5, 1.2, 9.6] },
  { id: 'suiteP', label: "Parents' suite", room: 'R-P-SUITE', pos: [-5, 6, 8], look: [1.6, 1.2, 4.0] },
  { id: 'suiteK', label: "Karan's suite", room: 'R-K-SUITE', pos: [30, 6, 8], look: [22.9, 1.2, 4.0] },
]

export function Viewer3D({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { state, set } = useStore()
  const mount = useRef<HTMLDivElement>(null)
  const api = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    orbit: OrbitControls
    lock: PointerLockControls
    sun: THREE.DirectionalLight
    hemi: THREE.HemisphereLight
    groups: Record<string, THREE.Group>
    clipHeight: THREE.Plane
    clipSection: THREE.Plane
    lintels: THREE.Object3D[]
    highlight: THREE.Mesh | null
  } | null>(null)
  const [walk, setWalk] = useState(false)
  const [roomLabel, setRoomLabel] = useState('')
  const [measure, setMeasure] = useState<THREE.Vector3[]>([])
  const [measureText, setMeasureText] = useState('')
  const keys = useRef<Record<string, boolean>>({})

  // ---------------------------------------------------------------- scene setup
  useEffect(() => {
    const el = mount.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xdfe6ea)

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500)
    camera.position.set(12.24, 17, 21)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(12.24, 0, 5.4)
    orbit.enableDamping = true
    orbit.maxPolarAngle = Math.PI * 0.495

    const lock = new PointerLockControls(camera, renderer.domElement)
    scene.add(lock.object)

    const hemi = new THREE.HemisphereLight(0xdfeaf0, 0x9e9484, 1.1)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const cam = sun.shadow.camera
    cam.left = -22
    cam.right = 22
    cam.top = 22
    cam.bottom = -22
    cam.near = 1
    cam.far = 120
    scene.add(sun)
    scene.add(sun.target)

    // Ground plane so the building reads as sitting on something.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xcdc7bb, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(12.24, -0.16, 5.4)
    ground.receiveShadow = true
    scene.add(ground)

    const clipHeight = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.05)
    const clipSection = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1000)

    const groups: Record<string, THREE.Group> = {
      fabric: new THREE.Group(),
      glassRoof: new THREE.Group(),
      furniture: new THREE.Group(),
      podParents: new THREE.Group(),
      podKaran: new THREE.Group(),
      slabs: new THREE.Group(),
    }
    Object.values(groups).forEach((g) => scene.add(g))

    const lintels: THREE.Object3D[] = []
    const clip = [clipHeight, clipSection]

    // ---- floor slabs
    for (const slab of solids.slabs) {
      const geo = new THREE.ExtrudeGeometry(shapeFrom(slab.polygon, slab.holes), {
        depth: slab.thickness * S,
        bevelEnabled: false,
      })
      geo.rotateX(-Math.PI / 2)
      const mat = (floorMaterial(slab.finish) as THREE.MeshStandardMaterial).clone()
      mat.clippingPlanes = clip
      const m = new THREE.Mesh(geo, mat)
      m.receiveShadow = true
      m.userData.roomId = slab.roomId
      groups.slabs.add(m)
    }

    // ---- walls, glazing, screens
    for (const p of solids.prisms) {
      const mat = (prismMaterial(p) as THREE.MeshStandardMaterial).clone()
      mat.clippingPlanes = clip
      const mesh = prismMesh(p.polygon, p.base, p.top, mat)
      mesh.userData.wallId = p.wallId
      const zone = podOf(p)
      if (zone === 'parents') groups.podParents.add(mesh)
      else if (zone === 'karan') groups.podKaran.add(mesh)
      else groups.fabric.add(mesh)
      if (p.kind === 'lintel') lintels.push(mesh)
    }

    // ---- mullions on the curved glass walls, so they read as glazing not as a blob
    for (const [id, pts] of model.curves) {
      const portal = building.portals.find((q) => q.wall === id)
      const wall = building.walls.find((w) => w.id === id)
      for (let i = 0; i < pts.length; i += 8) {
        const p = pts[i]
        if (portal && wall?.curve) {
          const a = bezierAt(wall.curve, portal.t[0])
          const b = bezierAt(wall.curve, portal.t[1])
          const lo = Math.min(a.y, b.y)
          const hi = Math.max(a.y, b.y)
          if (p.y > lo && p.y < hi) continue
        }
        const geo = new THREE.BoxGeometry(0.05, solids.ceiling * S, 0.05)
        const mat = MAT.mullion.clone()
        mat.clippingPlanes = clip
        const m = new THREE.Mesh(geo, mat)
        m.position.set(p.x * S, (solids.ceiling * S) / 2, p.y * S)
        m.castShadow = true
        ;(id.includes('PARENTS') ? groups.podParents : groups.podKaran).add(m)
      }
    }

    // ---- glass roofs
    for (const roof of solids.roofs) {
      if (roof.kind === 'flat') {
        const [x0, y0, x1, y1] = roof.extent
        const geo = new THREE.PlaneGeometry((x1 - x0) * S, (y1 - y0) * S)
        geo.rotateX(-Math.PI / 2)
        const m = new THREE.Mesh(geo, MAT.roofGlass)
        m.position.set(((x0 + x1) / 2) * S, (roof.height ?? 3070) * S, ((y0 + y1) / 2) * S)
        groups.glassRoof.add(m)
        continue
      }
      // Barrel vault: loft the section curve along x, and add ribs every 1500 mm.
      const [x0, y0, x1, y1] = roof.extent
      const sec = roof.section!
      const N = 40
      const profile: THREE.Vector2[] = []
      for (let i = 0; i <= N; i++) {
        const q = bezierAt(sec, i / N)
        profile.push(new THREE.Vector2(y0 + q.x, q.y))
      }
      // The section lives in the (model y, height) plane and is extruded along model x.
      // rotateY(+90°) maps geometry (x, y, z) to (z, y, -x), so the section's x is
      // negated first — otherwise the vault lands on the wrong side of the deck edge.
      const shape = new THREE.Shape(profile.map((p) => new THREE.Vector2(-p.x * S, p.y * S)))
      const geo = new THREE.ExtrudeGeometry(shape, { depth: (x1 - x0) * S, bevelEnabled: false })
      geo.rotateY(Math.PI / 2)
      geo.translate(x0 * S, 0, 0)
      const vault = new THREE.Mesh(geo, MAT.roofGlass)
      groups.glassRoof.add(vault)
      for (let x = x0; x <= x1 + 1; x += 1500) {
        const curve = new THREE.CatmullRomCurve3(
          profile.map((p) => new THREE.Vector3(x * S, p.y * S, p.x * S)),
        )
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 6, false), MAT.mullion)
        groups.glassRoof.add(tube)
      }
      void y1
    }

    // ---- furniture, as simple massed volumes
    for (const f of furniture) {
      if (f.height <= 0) continue
      const geo = new THREE.BoxGeometry(f.w * S, f.height * S, f.d * S)
      const mat = ((f.kind === 'plant' ? MAT.green : f.kind === 'rug' ? MAT.soft : MAT.furniture) as THREE.MeshStandardMaterial).clone()
      mat.clippingPlanes = clip
      const m = new THREE.Mesh(geo, mat)
      m.position.set((f.x + f.w / 2) * S, (f.height * S) / 2, (f.y + f.d / 2) * S)
      m.castShadow = f.kind !== 'rug'
      m.receiveShadow = true
      groups.furniture.add(m)
    }
    for (const f of fixtures) {
      const h = f.kind === 'counter' ? 900 : f.kind === 'fridge' ? 1900 : 800
      const geo = new THREE.BoxGeometry(f.size[0] * S, h * S, f.size[1] * S)
      const mat = MAT.furniture.clone()
      mat.clippingPlanes = clip
      const m = new THREE.Mesh(geo, mat)
      m.position.set(f.at.x * S, (h * S) / 2, f.at.y * S)
      m.castShadow = true
      groups.fabric.add(m)
    }

    api.current = {
      renderer,
      scene,
      camera,
      orbit,
      lock,
      sun,
      hemi,
      groups,
      clipHeight,
      clipSection,
      lintels,
      highlight: null,
    }

    let raf = 0
    const clock = new THREE.Clock()
    const resize = (): void => {
      const r = el.getBoundingClientRect()
      renderer.setSize(r.width, r.height, false)
      camera.aspect = r.width / Math.max(1, r.height)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const loop = (): void => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, clock.getDelta())
      if (lock.isLocked) {
        const speed = (keys.current['shift'] ? 4.2 : 1.9) * dt
        if (keys.current['w']) lock.moveForward(speed)
        if (keys.current['s']) lock.moveForward(-speed)
        if (keys.current['a']) lock.moveRight(-speed)
        if (keys.current['d']) lock.moveRight(speed)
        camera.position.y = 1.6
        const here = model.rooms.find((r) =>
          pointInPolygon({ x: camera.position.x / S, y: camera.position.z / S }, r.polygon),
        )
        setRoomLabel(here ? here.name : 'outside')
      } else {
        orbit.update()
      }
      renderer.render(scene, camera)
    }
    loop()

    const onKeyDown = (e: KeyboardEvent): void => {
      keys.current[e.key.toLowerCase()] = true
      if (e.key === 'Shift') keys.current['shift'] = true
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      keys.current[e.key.toLowerCase()] = false
      if (e.key === 'Shift') keys.current['shift'] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    lock.addEventListener('unlock', () => setWalk(false))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  // ---------------------------------------------------------------- reactive bits
  useEffect(() => {
    const a = api.current
    if (!a) return
    a.clipHeight.constant = state.cutaway * S
    // Lintels only make sense at full height (brief §6.3).
    const full = state.cutaway >= solids.ceiling - 1
    a.lintels.forEach((m) => (m.visible = full))
  }, [state.cutaway])

  useEffect(() => {
    const a = api.current
    if (!a) return
    const { axis, at } = state.section
    if (!axis) {
      a.clipSection.set(new THREE.Vector3(1, 0, 0), 1e6)
      return
    }
    const n = axis === 'x' ? new THREE.Vector3(-1, 0, 0) : axis === 'z' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, -1, 0)
    a.clipSection.set(n, at * S)
  }, [state.section])

  useEffect(() => {
    const a = api.current
    if (!a) return
    a.groups.glassRoof.visible = state.show3d.glassRoofs
    a.groups.furniture.visible = state.show3d.furniture
    a.groups.podParents.visible = state.show3d.podParents
    a.groups.podKaran.visible = state.show3d.podKaran
  }, [state.show3d])

  useEffect(() => {
    const a = api.current
    if (!a) return
    const pos = solarPosition(state.sun.day, state.sun.hour)
    const v = sunVector(pos, state.northAzimuth)
    const dist = 46
    a.sun.position.set(12.24 + v.x * dist, Math.max(0.6, v.y * dist), 5.4 + v.z * dist)
    a.sun.target.position.set(12.24, 0, 5.4)
    a.sun.target.updateMatrixWorld()
    const up = pos.altitude > 0
    a.sun.intensity = state.sun.mode === 'dusk' ? 0.7 : up ? 2.2 : 0.05
    a.sun.color.set(state.sun.mode === 'dusk' ? 0xffb37a : 0xfff3e0)
    a.sun.castShadow = state.sun.shadows && up
    a.hemi.intensity = state.sun.mode === 'dusk' ? 0.5 : up ? 1.1 : 0.35
    a.scene.background = new THREE.Color(state.sun.mode === 'dusk' ? 0x5d6a7a : up ? 0xdfe6ea : 0x2c3440)
  }, [state.sun, state.northAzimuth])

  const flyToRoom = useCallback((roomId: string) => {
    const a = api.current
    const room = model.roomById.get(roomId)
    if (!a || !room) return
    const c = room.centroid
    const span = Math.max(room.width, room.depth) * S
    a.orbit.target.set(c.x * S, 1.2, c.y * S)
    a.camera.position.set(c.x * S, Math.max(4, span * 0.9), c.y * S + Math.max(6, span * 1.5))
    a.orbit.update()
  }, [])

  useEffect(() => {
    if (state.flyTo) flyToRoom(state.flyTo.room)
  }, [state.flyTo, flyToRoom])

  // Highlight the hovered/selected room's floor.
  useEffect(() => {
    const a = api.current
    if (!a) return
    const target = state.selectedRoom ?? state.hoveredRoom
    a.groups.slabs.children.forEach((child) => {
      const m = child as THREE.Mesh
      const mat = m.material as THREE.MeshStandardMaterial
      mat.emissive = new THREE.Color(m.userData.roomId === target ? 0x2c5c61 : 0x000000)
      mat.emissiveIntensity = m.userData.roomId === target ? 0.28 : 0
    })
  }, [state.selectedRoom, state.hoveredRoom])

  // ---------------------------------------------------------------- picking
  const onClick = (e: React.MouseEvent): void => {
    const a = api.current
    if (!a || a.lock.isLocked) return
    const r = a.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, a.camera)
    const hits = ray.intersectObjects(a.scene.children, true)
    if (!hits.length) return
    const hit = hits[0]

    if (state.tool === 'measure') {
      // Snap to the nearest vertex of the face we hit.
      const p = snapToVertex(hit)
      const next = [...measure, p].slice(-2)
      setMeasure(next)
      if (next.length === 2) {
        const d = next[0].distanceTo(next[1]) / S
        setMeasureText(`${formatLength(d, state.units, state.roundToInch ? 1 : 16)}`)
      } else {
        setMeasureText('')
      }
      return
    }
    const roomId = findRoom(hit.point)
    if (roomId) set({ selectedRoom: roomId, flyTo: null })
  }

  const onMove = (e: React.MouseEvent): void => {
    const a = api.current
    if (!a || a.lock.isLocked || state.tool !== 'select') return
    const r = a.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, a.camera)
    const hits = ray.intersectObjects(a.groups.slabs.children, true)
    set({ hoveredRoom: hits.length ? (hits[0].object.userData.roomId as string) : null })
  }

  const screenshot = (): void => {
    const a = api.current
    if (!a) return
    a.renderer.render(a.scene, a.camera)
    a.renderer.domElement.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `residence-3d-${Date.now()}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }, 'image/png')
  }

  const sunPos = useMemo(() => solarPosition(state.sun.day, state.sun.hour), [state.sun])

  return (
    <div className="planwrap" ref={mount} onClick={onClick} onMouseMove={onMove}>
      {!compact && (
        <div className="toolbar">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="btn tiny"
              onClick={() => {
                const a = api.current
                if (!a) return
                a.camera.position.set(...p.pos)
                a.orbit.target.set(...p.look)
                a.orbit.update()
                if (p.room) set({ selectedRoom: p.room })
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            className="btn tiny"
            aria-pressed={walk}
            onClick={() => {
              const a = api.current
              if (!a) return
              if (walk) {
                a.lock.unlock()
                setWalk(false)
              } else {
                a.camera.position.y = 1.6
                a.lock.lock()
                setWalk(true)
              }
            }}
          >
            Walk (WASD)
          </button>
          <button className="btn tiny" onClick={screenshot}>
            Screenshot
          </button>
        </div>
      )}
      <div className="hud">
        <div>
          {walk ? `In: ${roomLabel} · Esc to exit` : `Sun ${hourLabel(state.sun.hour)} · alt ${sunPos.altitude.toFixed(1)}° · az ${sunPos.azimuth.toFixed(0)}°`}
        </div>
        <div>
          {measureText ? `3D measure: ${measureText}` : state.tool === 'measure' ? 'Click two corners' : `Cutaway ${state.cutaway} mm`}
        </div>
      </div>
    </div>
  )
}

function podOf(p: Prism): 'parents' | 'karan' | null {
  const id = p.wallId ?? p.id
  if (/PARENTS|W-P-|PORTAL-P|SCREEN/.test(id)) return 'parents'
  if (/KARAN|W-K-|PORTAL-K|W-GEAR/.test(id)) return 'karan'
  return null
}

function findRoom(point: THREE.Vector3): string | null {
  const p = { x: point.x / S, y: point.z / S }
  const r = model.rooms.find((room) => pointInPolygon(p, room.polygon) && !room.holes.some((h) => pointInPolygon(p, h)))
  return r ? r.id : null
}

/** Snap a raycast hit to the nearest vertex of the triangle it landed on. */
function snapToVertex(hit: THREE.Intersection): THREE.Vector3 {
  const mesh = hit.object as THREE.Mesh
  const geo = mesh.geometry as THREE.BufferGeometry
  const pos = geo.getAttribute('position')
  if (!pos || hit.face == null) return hit.point.clone()
  let best = hit.point.clone()
  let bestD = 0.35 // metres; beyond this, take the exact hit point
  for (const idx of [hit.face.a, hit.face.b, hit.face.c]) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, idx)
    mesh.localToWorld(v)
    const d = v.distanceTo(hit.point)
    if (d < bestD) {
      bestD = d
      best = v
    }
  }
  return best
}
