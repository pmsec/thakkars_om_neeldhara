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
import { barrelProfile, buildSolids, type Prism } from '../geometry/solid'
import { building } from '../data/building'
import { furniture, type FurnitureItem } from '../data/furniture'
import { fixtures } from '../data/fixtures'
import { bezierAt } from '../geometry/bezier'
import { pointInPolygon, type Poly } from '../geometry/vec'
import { prismGeometry, S } from './prism'
import { gableGeometry, gableJamb, vaultGeometry } from './canopy'
import { PRESETS, presetCamera } from './cameras'
import { formatLength } from '../geometry/units'
import { useStore } from '../ui/store'
import { hourLabel, solarPosition, sunVector } from './sun'

const model = getModel()
const solids = buildSolids(model)
const CENTRE = {
  x: ((model.envelopeBBox.minX + model.envelopeBBox.maxX) / 2) * 0.001,
  y: ((model.envelopeBBox.minY + model.envelopeBBox.maxY) / 2) * 0.001,
}

const MAT = {
  plaster: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95, metalness: 0 }),
  exterior: new THREE.MeshStandardMaterial({ color: 0xded7c9, roughness: 0.95 }),
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
  mullion: new THREE.MeshStandardMaterial({ color: 0x6f97a4, roughness: 0.45, metalness: 0.25 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xd2b184, roughness: 0.68 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xc8d0c9, roughness: 0.5 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xb99f7c, roughness: 0.82 }),
  vinyl: new THREE.MeshStandardMaterial({ color: 0xcdc7b9, roughness: 0.8 }),
  furniture: new THREE.MeshStandardMaterial({ color: 0xe6dccc, roughness: 0.85 }),
  soft: new THREE.MeshStandardMaterial({ color: 0xded3bf, roughness: 0.96 }),
  linen: new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.98 }),
  rug: new THREE.MeshStandardMaterial({ color: 0xc9b99e, roughness: 1 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.9 }),
  green: new THREE.MeshStandardMaterial({ color: 0x7d9c78, roughness: 0.9 }),
}

function floorMaterial(finish: string): THREE.Material {
  if (/stone/i.test(finish)) return MAT.stone
  if (/deck/i.test(finish)) return MAT.deck
  if (/vinyl/i.test(finish)) return MAT.vinyl
  return MAT.wood
}

/** Extrude a plan polygon upward between two heights. See `prism.ts` for the mapping. */
function prismMesh(poly: Poly, base: number, top: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(prismGeometry(poly, base, top), mat)
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
    renderer.toneMappingExposure = 1.0
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xb6c2c9)

    // near/far ratio drives depth precision. 0.1 to 500 is 5000:1, which leaves too few
    // bits at building distance and stipples every place two wall prisms abut — walls are
    // split at each opening, so those coincident faces are everywhere. 0.35 still clears
    // the 1.6 m walkthrough eye height.
    const camera = new THREE.PerspectiveCamera(52, 1, 0.35, 220)
    const home = presetCamera(PRESETS[0])
    camera.position.copy(home.pos)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.copy(home.look)
    orbit.enableDamping = true
    orbit.maxPolarAngle = Math.PI * 0.495

    const lock = new PointerLockControls(camera, renderer.domElement)
    scene.add(lock.object)

    const hemi = new THREE.HemisphereLight(0xdce8f0, 0x9c9484, 0.68)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff2dc, 3.0)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    // Thin 110-150 mm partitions viewed at a grazing angle self-shadow into stripes
    // unless the depth comparison is offset along the surface normal. normalBias is the
    // one that fixes acne on vertical faces; a larger constant bias just detaches the
    // contact shadows instead.
    sun.shadow.bias = -0.0002
    sun.shadow.normalBias = 0.06
    const cam = sun.shadow.camera
    // Fit the frustum to the building rather than a round number, so the 4096 map spends
    // its texels on the plan instead of on empty ground.
    const half = Math.max(model.envelopeBBox.maxX - model.envelopeBBox.minX, model.envelopeBBox.maxY - model.envelopeBBox.minY) * S * 0.62
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.near = 1
    cam.far = 120
    scene.add(sun)
    scene.add(sun.target)
    // A weak fill from the opposite side so north-facing surfaces are not dead black.
    const fill = new THREE.DirectionalLight(0xd8e6ef, 0.25)
    fill.position.set(-18, 22, -14)
    scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.14))

    // Ground plane so the building reads as sitting on something.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xa39e91, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(CENTRE.x, -0.35, CENTRE.y)
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
      // Slab sits just under the finished floor, so the top face is at level 0.
      const geo = prismGeometry(slab.polygon, -slab.thickness, 0, slab.holes)
      const mat = (floorMaterial(slab.finish) as THREE.MeshStandardMaterial).clone()
      mat.clippingPlanes = clip
      const m = new THREE.Mesh(geo, mat)
      m.receiveShadow = true
      m.userData.roomId = slab.roomId
      groups.slabs.add(m)
    }

    // ---- walls, glazing, screens
    // Each prism also gets a thin outline. Without it, adjacent off-white masses merge
    // into one another and the model reads as a heap of blocks rather than as rooms.
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8b8478, transparent: true, opacity: 0.32 })
    edgeMat.clippingPlanes = clip
    for (const p of solids.prisms) {
      const mat = (prismMaterial(p) as THREE.MeshStandardMaterial).clone()
      mat.clippingPlanes = clip
      const mesh = prismMesh(p.polygon, p.base, p.top, mat)
      mesh.userData.wallId = p.wallId
      if (!p.transparent) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), edgeMat)
        mesh.add(edges)
      }
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
      for (let i = 0; i < pts.length; i += 16) {
        const p = pts[i]
        if (portal && wall?.curve) {
          const a = bezierAt(wall.curve, portal.t[0])
          const b = bezierAt(wall.curve, portal.t[1])
          const lo = Math.min(a.y, b.y)
          const hi = Math.max(a.y, b.y)
          if (p.y > lo && p.y < hi) continue
        }
        const geo = new THREE.BoxGeometry(0.035, solids.ceiling * S, 0.035)
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
      // Barrel vault. The mesh construction lives in `canopy.ts`, where the test suite
      // can measure it — the canopy is enclosure now, not decoration, and the abstract
      // solid model holds no roof surfaces to check it against.
      const [x0, , x1] = roof.extent
      const profile = barrelProfile(roof.section!, 48)

      const vault = new THREE.Mesh(vaultGeometry(roof), MAT.roofGlass)
      vault.receiveShadow = true
      groups.glassRoof.add(vault)

      // Ribs roughly every 1500 mm, as the brief specifies.
      for (let x = x0; x <= x1 + 1; x += 1500) {
        const curve = new THREE.CatmullRomCurve3(
          profile.map((q) => new THREE.Vector3(x * S, q.y * S, q.x * S)),
        )
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.032, 6, false), MAT.mullion)
        tube.castShadow = true
        groups.glassRoof.add(tube)
      }
      // Purlins running the length, so the vault reads as glazing rather than a film.
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const q = bezierAt(roof.section!, t)
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, (x1 - x0) * S, 6),
          MAT.mullion,
        )
        rail.rotation.z = Math.PI / 2
        rail.position.set(((x0 + x1) / 2) * S, q.y * S, q.x * S)
        groups.glassRoof.add(rail)
      }

      // Gable ends. Where the vault stops against the building's own face rather than
      // against an open shaft, the end is closed with a glazed panel cut to the section —
      // curved along the vault, straight down the wall line. That is what encloses the
      // terraces' returns now that the upright panes are gone.
      for (const end of roof.gableEnds) {
        groups.glassRoof.add(new THREE.Mesh(gableGeometry(roof, end), MAT.roofGlass))
        const j = gableJamb(roof, end)
        const jamb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.032, j.height, 6),
          MAT.mullion,
        )
        jamb.position.set(j.x, j.height / 2, j.z)
        groups.glassRoof.add(jamb)
      }
    }

    // ---- furniture
    for (const f of furniture) {
      if (f.height <= 0) continue
      const obj = furnitureObject(f, clip)
      if (obj) groups.furniture.add(obj)
    }
    fixtures.forEach((f, i) => {
      // Some fitted items genuinely overlap in plan — the serving-hatch counter sits
      // within the north counter run, and the hob within the south one. In 2D that just
      // draws on top; in 3D it gives two boxes identical top faces at 900 mm, and no
      // amount of depth precision can break that tie, so it stipples. A couple of
      // millimetres of stagger resolves it and is far below any dimension that matters.
      const base = f.kind === 'counter' ? 900 : f.kind === 'fridge' ? 1900 : 800
      const h = base + (i % 5) * 2
      const geo = new THREE.BoxGeometry(f.size[0] * S, h * S, f.size[1] * S)
      const mat = MAT.furniture.clone()
      mat.clippingPlanes = clip
      const m = new THREE.Mesh(geo, mat)
      m.position.set(f.at.x * S, (h * S) / 2, f.at.y * S)
      m.castShadow = true
      m.receiveShadow = true
      groups.fabric.add(m)
    })

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
    a.sun.position.set(CENTRE.x + v.x * dist, Math.max(0.6, v.y * dist), CENTRE.y + v.z * dist)
    a.sun.target.position.set(CENTRE.x, 0, CENTRE.y)
    a.sun.target.updateMatrixWorld()
    const up = pos.altitude > 0
    a.sun.intensity = state.sun.mode === 'dusk' ? 1.4 : up ? 3.0 : 0.05
    a.sun.color.set(state.sun.mode === 'dusk' ? 0xffb37a : 0xfff3e0)
    a.sun.castShadow = state.sun.shadows && up
    a.hemi.intensity = state.sun.mode === 'dusk' ? 0.45 : up ? 0.68 : 0.4
    a.scene.background = new THREE.Color(state.sun.mode === 'dusk' ? 0x5f6b7e : up ? 0xb6c2c9 : 0x333b46)
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
                const c = presetCamera(p)
                a.camera.position.copy(c.pos)
                a.orbit.target.copy(c.look)
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

/**
 * Furniture as recognisable massing rather than one box per item. Still schematic — this
 * is a layout study, not a visualisation — but a bed reads as a bed and a sofa has a back,
 * which is what stops the interior looking like a warehouse of packing crates.
 */
function furnitureObject(f: FurnitureItem, clip: THREE.Plane[]): THREE.Object3D | null {
  const g = new THREE.Group()
  const box = (w: number, h: number, d: number, mat: THREE.MeshStandardMaterial, dx = 0, dy = 0, dz = 0): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), withClip(mat, clip))
    m.position.set(dx * S, dy * S, dz * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const cyl = (r: number, h: number, mat: THREE.MeshStandardMaterial, dx = 0, dy = 0, dz = 0, seg = 16): void => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, h * S, seg), withClip(mat, clip))
    m.position.set(dx * S, dy * S, dz * S)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }

  const { w, d } = f
  const back = 170
  switch (f.kind) {
    case 'rug':
      box(w, 10, d, MAT.rug, 0, 5, 0)
      break
    case 'plant':
      cyl(w * 0.3, 300, MAT.pot, 0, 150, 0, 12)
      cyl(w * 0.44, 60, MAT.green, 0, 330, 0, 12)
      g.add(sphere(w * 0.44, MAT.green, 0, 560, 0, clip))
      break
    case 'bed': {
      const headAlongX = f.face === 'E' || f.face === 'W'
      box(w, 380, d, MAT.soft, 0, 190, 0)
      box(w * 0.96, 90, d * 0.96, MAT.linen, 0, 425, 0)
      if (headAlongX) box(120, 900, d, MAT.furniture, (f.face === 'E' ? 1 : -1) * (w / 2 - 60), 450, 0)
      else box(w, 900, 120, MAT.furniture, 0, 450, (f.face === 'S' ? 1 : -1) * (d / 2 - 60))
      break
    }
    case 'daybed':
      box(w, 380, d, MAT.soft, 0, 190, 0)
      box(w, 700, 120, MAT.furniture, 0, 350, -(d / 2 - 60))
      break
    case 'sofa': {
      box(w, 380, d, MAT.soft, 0, 190, 0)
      const alongX = f.face === 'N' || f.face === 'S'
      if (alongX) box(w, 720, back, MAT.furniture, 0, 360, (f.face === 'N' ? 1 : -1) * (d / 2 - back / 2))
      else box(back, 720, d, MAT.furniture, (f.face === 'E' ? -1 : 1) * (w / 2 - back / 2), 360, 0)
      break
    }
    case 'armchair':
      box(w, 360, d, MAT.soft, 0, 180, 0)
      box(w, 700, back, MAT.furniture, 0, 350, d / 2 - back / 2)
      break
    case 'dining':
      box(w, 60, d, MAT.wood, 0, f.height - 30, 0)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          cyl(35, f.height - 60, MAT.furniture, sx * (w / 2 - 120), (f.height - 60) / 2, sz * (d / 2 - 120), 8)
        }
      }
      break
    case 'table':
    case 'console':
    case 'bench':
      box(w, 60, d, MAT.wood, 0, f.height - 30, 0)
      box(w * 0.86, f.height - 60, d * 0.86, MAT.furniture, 0, (f.height - 60) / 2, 0)
      break
    case 'stool':
      cyl(Math.min(w, d) / 2, 60, MAT.wood, 0, f.height - 30, 0, 12)
      cyl(50, f.height - 60, MAT.furniture, 0, (f.height - 60) / 2, 0, 8)
      break
    case 'lounger':
      box(w, 320, d, MAT.soft, 0, 160, 0)
      box(w, 420, d * 0.34, MAT.furniture, 0, 480, -(d / 2 - d * 0.17))
      break
    case 'shelves':
    case 'wardrobe':
      box(w, f.height, d, MAT.furniture, 0, f.height / 2, 0)
      break
    case 'drumkit':
      cyl(Math.min(w, d) * 0.28, 500, MAT.furniture, 0, 250, d * 0.1, 20)
      cyl(190, 300, MAT.furniture, -w * 0.26, 620, -d * 0.1, 16)
      cyl(190, 300, MAT.furniture, w * 0.02, 640, -d * 0.2, 16)
      cyl(240, 40, MAT.mullion, -w * 0.34, 980, d * 0.16, 16)
      cyl(260, 40, MAT.mullion, w * 0.32, 1020, -d * 0.26, 16)
      break
    case 'guitar':
      cyl(30, 950, MAT.furniture, 0, 475, 0, 8)
      g.add(sphere(190, MAT.wood, 0, 340, 0, clip))
      break
    case 'stair': {
      const n = 6
      for (let i = 0; i < n; i++) {
        box(w, 170, d / n, MAT.stone, 0, 85 + i * 170 * 0, (i + 0.5) * (d / n) - d / 2)
      }
      break
    }
    default:
      box(w, f.height, d, MAT.furniture, 0, f.height / 2, 0)
  }

  g.position.set((f.x + w / 2) * S, 0, (f.y + d / 2) * S)
  return g
}

function sphere(r: number, mat: THREE.MeshStandardMaterial, dx: number, dy: number, dz: number, clip: THREE.Plane[]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 14, 10), withClip(mat, clip))
  m.position.set(dx * S, dy * S, dz * S)
  m.castShadow = true
  return m
}

const clipCache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>()
function withClip(mat: THREE.MeshStandardMaterial, clip: THREE.Plane[]): THREE.MeshStandardMaterial {
  const hit = clipCache.get(mat)
  if (hit) return hit
  const c = mat.clone()
  c.clippingPlanes = clip
  clipCache.set(mat, c)
  return c
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
