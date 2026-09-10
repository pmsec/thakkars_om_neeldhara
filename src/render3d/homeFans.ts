/**
 * THE WALL FANS.
 *
 * Karan does not want ceiling fans. Instead every place people sit or lie
 * gets a small, silent designer wall fan - a black or white ball-joint arm
 * off a round plate, a short motor can, three or four wooden blades - aimed
 * at that seat. Each fan is an interactive piece of its own (`fan:<id>`): off
 * it hangs still; switched on its blades spin and its airflow is drawn - a
 * faint haze cone, scrolling streamlines from the hub to the seat, and a
 * landing patch on the floor (or the mattress) showing the area it reaches.
 *
 * Nothing here has a drawn footprint, so nothing here goes through the
 * fidelity gate; these are fittings on wall faces, like the lamps.
 */

import * as THREE from 'three'
import { S } from './prism'

export interface FanSpot {
  /** the piece's id: `fan:...` */
  id: string
  /** where the plate sits: a point on a wall face in plan mm, and its height */
  x: number
  y: number
  h: number
  /** the face's outward normal in plan (into the room) */
  nx: number
  ny: number
  /** what the fan blows at: a point in the seating, at seat height */
  tx: number
  ty: number
  th: number
  /** the height the landing patch is drawn at: the floor unless it lands on a bed */
  patchH?: number
  /** the blades' sweep, tip to tip (default 480) */
  dia?: number
  blades?: 3 | 4
  /** what it serves, for the button */
  where: string
}

export const FAN_SPOTS: Record<string, FanSpot[]> = {
  ekta: [
    // THE LIVING ROOM: four. One on the west wall north of the chaise, blowing
    // south-east along the wall over the chaise and the diwan; one on the
    // curved bedroom wall between its two doors, over the eating bar's chairs;
    // and one either side of the two swivels at the balcony - on the foyer
    // partition and on the east wall
    { id: 'fan:ekta-diwan', x: 2295, y: 5000, h: 2150, nx: 1, ny: 0, tx: 3000, ty: 7200, th: 600, where: 'the chaise and the diwan' },
    { id: 'fan:ekta-bar', x: 3163, y: 3087, h: 2150, nx: 0.597, ny: 0.802, tx: 5400, ty: 4200, th: 750, where: 'the eating bar' },
    { id: 'fan:ekta-swivel-w', x: 2283, y: 10300, h: 2150, nx: 1, ny: 0, tx: 4400, ty: 10400, th: 600, where: 'the west swivel chair' },
    { id: 'fan:ekta-swivel-e', x: 6800, y: 9300, h: 2150, nx: -1, ny: 0, tx: 5900, ty: 10300, th: 600, where: 'the east swivel chair' },
    // THE ROOM: one each side of the king bed's head on the party wall, clear
    // of the two pendants, blowing along each side of the bed; and one for
    // the daybed on the bath's east face across its alcove (the party wall
    // there is the wardrobe, full height)
    { id: 'fan:ekta-bed-n', x: 11470, y: 260, h: 2100, nx: -1, ny: 0, tx: 10300, ty: 1050, th: 700, patchH: 720, dia: 400, where: 'the bed, north side' },
    { id: 'fan:ekta-bed-s', x: 11470, y: 3170, h: 2100, nx: -1, ny: 0, tx: 10300, ty: 2380, th: 700, patchH: 720, dia: 400, where: 'the bed, south side' },
    { id: 'fan:ekta-daybed', x: 8445, y: 7150, h: 2150, nx: 1, ny: 0, tx: 10300, ty: 7900, th: 650, where: 'the daybed' },
    // THE BEDROOM: one on the east wall over the desk, across the room to the
    // sofa in front of the wall bed
    { id: 'fan:ekta-bedroom', x: 3050, y: 700, h: 2150, nx: -1, ny: 0, tx: 800, ty: 1800, th: 650, where: 'the sofa and the desk' },
  ],
  'om-neeldhara': [
    // THE FAMILY ROOM: one on the bath's east wall for the recliner and the
    // sofa, one on the south wall beside the canvas for the dining table
    { id: 'fan:h1-family', x: 4542, y: 5600, h: 2150, nx: 1, ny: 0, tx: 6300, ty: 4100, th: 650, where: 'the recliner and the sofa' },
    { id: 'fan:h1-dining', x: 6450, y: 8400, h: 2150, nx: 0, ny: -1, tx: 7150, ty: 6700, th: 720, where: 'the dining table' },
    // THE DEN: the duct's two faces - north for the two recliners, west for
    // the drum kit
    { id: 'fan:h1-den', x: 19400, y: 6100, h: 2150, nx: 0, ny: -1, tx: 18000, ty: 3900, th: 650, where: 'the two recliners' },
    { id: 'fan:h1-drums', x: 18775, y: 6900, h: 2150, nx: -1, ny: 0, tx: 17700, ty: 7300, th: 700, where: 'the drum kit' },
    // THE GREAT ROOM: on the kitchen's north wall, up the room to the sofa and
    // the recliner
    { id: 'fan:h1-great', x: 9600, y: 7800, h: 2200, nx: 0, ny: -1, tx: 10300, ty: 4500, th: 650, where: 'the sofa and the recliner' },
    // THE PARENTS' BED: one each side, on the west wall above the headboard's
    // two ends, clear of the window north of it
    { id: 'fan:h1-pbed-n', x: -450, y: 2015, h: 2150, nx: 1, ny: 0, tx: 900, ty: 2500, th: 700, patchH: 720, dia: 360, where: "the parents' bed, north side" },
    { id: 'fan:h1-pbed-s', x: -450, y: 4310, h: 2150, nx: 1, ny: 0, tx: 900, ty: 3850, th: 700, patchH: 720, dia: 360, where: "the parents' bed, south side" },
    // KARAN'S BED: the same on the east wall
    { id: 'fan:h1-kbed-n', x: 24930, y: 3364, h: 2150, nx: -1, ny: 0, tx: 23600, ty: 3850, th: 700, patchH: 720, dia: 360, where: "Karan's bed, north side" },
    { id: 'fan:h1-kbed-s', x: 24930, y: 5520, h: 2150, nx: -1, ny: 0, tx: 23600, ty: 5200, th: 700, patchH: 720, dia: 360, where: "Karan's bed, south side" },
    // THE GRANDMOTHER'S BED: on her bath's west wall, across the dressing to
    // the wall bed
    { id: 'fan:h1-gbed', x: 2731, y: 8330, h: 2150, nx: -1, ny: 0, tx: 800, ty: 8300, th: 650, where: "the grandmother's bed" },
    // (the help's room has no wall for one: racks on three walls, its door on
    // the fourth, and the loft over all of it)
    // THE DECK: one on each void store's deck face, along its recliner
    { id: 'fan:h1-deck-w', x: 9190, y: 2450, h: 2200, nx: 1, ny: 0, tx: 9700, ty: 1400, th: 600, where: 'the west recliner' },
    { id: 'fan:h1-deck-e', x: 15290, y: 2450, h: 2200, nx: -1, ny: 0, tx: 14900, ty: 1400, th: 600, where: 'the east recliner' },
  ],
}

export interface FanKit {
  M: Record<string, THREE.Material>
  /** black arm with walnut blades, or white arm with pale wood */
  style: 'black' | 'white'
}
export interface BuiltFan {
  id: string
  group: THREE.Group
  anchor: { x: number; y: number; h: number }
  where: string
}

/**
 * The dash the airflow lines scroll: one soft-ended bright dash per repeat.
 * The walkthrough slides its offset every frame; every fan's lines share it.
 */
export function flowTexture(): THREE.DataTexture {
  const N = 128
  const data = new Uint8Array(N * 4)
  for (let i = 0; i < N; i++) {
    const t = i / N
    // bright from 0.12 to 0.55, easing in over 0.12 and out over 0.15
    const a = t < 0.12 ? t / 0.12 : t < 0.55 ? 1 : t < 0.7 ? 1 - (t - 0.55) / 0.15 : 0
    const v = Math.round(255 * Math.max(0, Math.min(1, a)))
    data.set([v, v, v, v], i * 4)
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  tex.userData.flow = true
  return tex
}

/** one blade: a paddle from radius r0 to r1, radial along +y, in the xy plane */
function bladeShape(r0: number, r1: number): THREE.Shape {
  const s = new THREE.Shape()
  const w0 = 17, w1 = 40
  s.moveTo(-w0, r0)
  s.bezierCurveTo(-w0 - 20, r0 + 70, -w1 - 6, r1 - 200, -w1, r1 - 60)
  s.quadraticCurveTo(-w1 * 0.7, r1 + 6, 0, r1)
  s.quadraticCurveTo(w1 * 0.7, r1 + 6, w1, r1 - 60)
  s.bezierCurveTo(w1 + 6, r1 - 200, w0 + 20, r0 + 70, w0, r0)
  s.closePath()
  return s
}

/**
 * Every wall fan the home lists, in one state: `open` is ON - the blades on a
 * spinning rotor and the airflow drawn - and `shut` is OFF. Each comes back as
 * its own group for the caller to tag as a piece. Built in plan mm inside a
 * group scaled to scene units, so the sizes below read as millimetres.
 */
export function wallFans(homeId: string, kit: FanKit, mode: 'open' | 'shut', flow: THREE.Texture): BuiltFan[] {
  const spots = FAN_SPOTS[homeId] ?? []
  const { M } = kit
  const dark = kit.style === 'black'
  const body = dark ? M.graphite : new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.42, metalness: 0.06 })
  const wood = dark ? M.walnut : M.teak
  const cap = new THREE.MeshStandardMaterial({ color: dark ? 0x3a3d42 : 0xe6e2d8, roughness: 0.28, metalness: 0.55 })
  // the airflow: unlit, translucent, drawn over what is behind it
  const line = new THREE.MeshBasicMaterial({ color: 0xc4e9ff, transparent: true, opacity: 0.85, alphaMap: flow, depthWrite: false, side: THREE.DoubleSide })
  const haze = new THREE.MeshBasicMaterial({ color: 0xa9dcff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
  const patch = new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.17, depthWrite: false })
  const ring = new THREE.MeshBasicMaterial({ color: 0xc4e9ff, transparent: true, opacity: 0.55, depthWrite: false })
  const on = mode === 'open'
  const Z = new THREE.Vector3(0, 0, 1)
  const out: BuiltFan[] = []
  for (const sp of spots) {
    const item = new THREE.Group()
    const g = new THREE.Group()
    g.position.set(sp.x * S, sp.h * S, sp.y * S)
    // local +z is the face's outward normal; local +x runs along the wall
    g.rotation.y = Math.atan2(sp.nx, sp.ny)
    g.scale.setScalar(S)
    item.add(g)
    // the plate on the wall, the stem out of it, the ball joint
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(52, 58, 14, 28), body)
    plate.rotation.x = Math.PI / 2
    plate.position.z = 7
    g.add(plate)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 118, 14), body)
    stem.rotation.x = Math.PI / 2
    stem.position.z = 14 + 59
    g.add(stem)
    const BALL = 14 + 118 + 20
    const ball = new THREE.Mesh(new THREE.SphereGeometry(31, 20, 14), cap)
    ball.position.z = BALL
    g.add(ball)
    // the head aims at the seat: the target in the fan's own frame
    const dx = sp.tx - sp.x, dy = sp.th - sp.h, dz = sp.ty - sp.y
    const target = new THREE.Vector3(dx * sp.ny - dz * sp.nx, dy, dx * sp.nx + dz * sp.ny)
    const ballP = new THREE.Vector3(0, 0, BALL)
    const aim = target.clone().sub(ballP).normalize()
    const head = new THREE.Group()
    head.position.copy(ballP)
    head.quaternion.setFromUnitVectors(Z, aim)
    g.add(head)
    // the neck into the motor can, the can, its cap
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 50, 14), body)
    neck.rotation.x = Math.PI / 2
    neck.position.z = 40
    head.add(neck)
    const can = new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 104, 28), body)
    can.rotation.x = Math.PI / 2
    can.position.z = 65 + 52
    head.add(can)
    const ROTOR = 65 + 104 + 6
    const hub = new THREE.Mesh(new THREE.SphereGeometry(27, 20, 14), cap)
    hub.position.z = ROTOR + 8
    head.add(hub)
    // the blades on a rotor: three or four pitched paddles; when the fan is
    // on the rotor is its own unit (its meshes merge in its own frame) and
    // the walkthrough spins it
    const rotor = new THREE.Group()
    rotor.position.z = ROTOR
    const n = sp.blades ?? (dark ? 4 : 3)
    const r1 = (sp.dia ?? 480) / 2
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape(30, r1), { depth: 6, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 10 })
    bladeGeo.translate(0, 0, -3)
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bladeGeo, wood)
      b.castShadow = true
      const arm = new THREE.Group()
      // the pitch, about the blade's own radial axis
      b.rotation.y = 0.34
      arm.add(b)
      arm.rotation.z = (i / n) * Math.PI * 2
      rotor.add(arm)
    }
    if (on) { rotor.name = 'rotor'; rotor.userData.item = `${sp.id}:rotor`; rotor.userData.spin = 1 }
    head.add(rotor)
    if (on) {
      // THE AIRFLOW. Its reach runs past the seat; it widens to farR there
      const reach = target.distanceTo(ballP) + 900
      const farR = reach * Math.tan(0.34) + 90
      const START = ROTOR + 40
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(farR, 120, reach, 30, 1, true), haze)
      cone.geometry.rotateX(Math.PI / 2)
      cone.position.z = START + reach / 2
      head.add(cone)
      // streamlines: seven lines from just off the hub, spreading and gently
      // swirling as they go, each carrying scrolling dashes
      const N = 7
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2 + 0.4
        const ph = i * 1.3
        const pts: THREE.Vector3[] = []
        for (let k = 0; k <= 12; k++) {
          const t = k / 12
          const r = 70 + (farR * 0.82 - 70) * Math.pow(t, 0.9)
          const ang = a0 + 0.38 * Math.sin(Math.PI * 2 * t * 1.15 + ph) * t
          pts.push(new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang), START + t * reach))
        }
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 7, 6, false)
        // the dashes: one every ~260 along the line
        const uv = tube.attributes.uv as THREE.BufferAttribute
        const rep = reach / 260
        for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * rep)
        head.add(new THREE.Mesh(tube, line))
      }
      // the landing patch: an oval on the floor (or the mattress) round the
      // seat, stretched along the flow, its centre a little past the seat
      const ax = sp.tx - sp.x, ay = sp.ty - sp.y
      const al = Math.hypot(ax, ay) || 1
      const ux = ax / al, uy = ay / al
      const cx = sp.tx + ux * farR * 0.25, cy = sp.ty + uy * farR * 0.25
      const long = farR * 1.45, across = farR * 1.12
      const ph = sp.patchH ?? 10
      const yaw = -Math.atan2(uy, ux)
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), patch)
      disc.geometry.scale(long * S, across * S, 1)
      disc.geometry.rotateX(-Math.PI / 2)
      disc.geometry.rotateY(yaw)
      disc.position.set(cx * S, ph * S, cy * S)
      item.add(disc)
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), ring)
      rim.geometry.scale(long * 1.06 * S, across * 1.06 * S, 1)
      rim.geometry.rotateX(-Math.PI / 2)
      rim.geometry.rotateY(yaw)
      rim.position.set(cx * S, (ph + 2) * S, cy * S)
      item.add(rim)
    }
    out.push({ id: sp.id, group: item, anchor: { x: sp.x + sp.nx * 420, y: sp.y + sp.ny * 420, h: sp.h - 120 }, where: sp.where })
  }
  return out
}
