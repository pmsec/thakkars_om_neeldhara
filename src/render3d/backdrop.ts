/**
 * What lies beyond the glass: a physically based sky with a few clouds, and the
 * city the home stands in - fourteen floors up, so most of it is below, dull,
 * concrete and hazy. It is there to be hidden: from inside the home the hedge on
 * the parapet cuts the sightline just above it, and only bushes and sky remain.
 * Walk up to the parapet and look down and it is all still there.
 */

import * as THREE from 'three'

/** Floor 14: the street is this far below the flat's finished floor, metres. */
export const STREET_DROP = 42

/** Radius of the sky dome. It follows the camera, so it only has to clear the far plane. */
const DOME_R = 370

/**
 * The sky: a dome painted with a blue gradient, a sun glow and soft cumulus,
 * unaffected by tone mapping so it never washes out. It is centred on the camera
 * every frame (see followCamera), which is why it can be smaller than the city.
 */
export type SkyMode = 'day' | 'evening' | 'night'

export function skyDome(sunDir: THREE.Vector3, mode: SkyMode = 'day'): THREE.Group {
  const g = new THREE.Group()
  const sun = sunDir.clone().normalize()
  const tex = new THREE.CanvasTexture(skyCanvas(sun, mode))
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 48, 32), mat)
  // the texture's u runs around, so turn it to put the sun where the light comes from
  dome.rotation.y = -Math.atan2(sun.z, sun.x)
  dome.renderOrder = -10
  g.add(dome)
  return g
}

/** Keep the dome on the viewer, a little below the eye so the horizon sits where it should. */
export function followCamera(sky: THREE.Object3D, camera: THREE.Camera): void {
  sky.position.set(camera.position.x, camera.position.y - 6, camera.position.z)
}

/** Blue overhead to pale haze at the horizon, a sun glow, and two bands of cumulus. */
function skyCanvas(sun: THREE.Vector3, mode: SkyMode = 'day'): HTMLCanvasElement {
  const W = 2048
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  // v = 0 is the top of the dome (zenith), v = 1 the bottom
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  const stops: Array<[number, string]> =
    mode === 'night'
      ? [[0, '#050814'], [0.25, '#0a1226'], [0.42, '#13203a'], [0.5, '#1d2a44'], [0.62, '#141a26'], [1, '#0c0f16']]
      : mode === 'evening'
        ? [[0, '#2a4a86'], [0.2, '#4f6fa8'], [0.36, '#b28aa0'], [0.45, '#e9a878'], [0.5, '#f3c48e'], [0.62, '#b9a08e'], [1, '#8f8a86']]
        : [[0, '#2f66b8'], [0.2, '#4a86cf'], [0.38, '#8db7e2'], [0.48, '#cfdfec'], [0.5, '#dfe6ea'], [0.62, '#c9cfd2'], [1, '#b3b8ba']]
  for (const [v, col] of stops) grad.addColorStop(v, col)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  if (mode === 'night') {
    // stars, thicker toward the zenith, and a small moon where the sun would be
    let st = 91
    const rs = () => { st = (st * 9301 + 49297) % 233280; return st / 233280 }
    for (let i = 0; i < 900; i++) {
      const x = rs() * W, y = rs() * rs() * H * 0.48
      const r = 0.6 + rs() * 1.6
      ctx.fillStyle = `rgba(255,255,${230 + Math.floor(rs() * 25)},${0.35 + rs() * 0.65})`
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    const mx = W * 0.5, my = H * 0.22
    const moon = ctx.createRadialGradient(mx, my, 0, mx, my, 120)
    moon.addColorStop(0, 'rgba(255,250,235,1)')
    moon.addColorStop(0.18, 'rgba(255,250,235,1)')
    moon.addColorStop(0.22, 'rgba(230,236,255,0.35)')
    moon.addColorStop(1, 'rgba(200,214,255,0)')
    ctx.fillStyle = moon
    ctx.fillRect(mx - 120, my - 120, 240, 240)
    return c
  }

  // the sun: a soft glow where the light comes from. u = 0 faces +x after the
  // dome's rotation, so the sun sits at u = 0.5 of the wrap.
  const elev = Math.asin(Math.max(0, Math.min(1, sun.y)))
  const sunV = 0.5 - (elev / (Math.PI / 2)) * 0.5
  const sx = W * 0.5
  const sy = H * sunV
  const evening = mode === 'evening'
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, evening ? 420 : 260)
  glow.addColorStop(0, evening ? 'rgba(255,225,170,0.98)' : 'rgba(255,250,235,0.95)')
  glow.addColorStop(0.12, evening ? 'rgba(255,190,120,0.75)' : 'rgba(255,245,220,0.7)')
  glow.addColorStop(0.5, evening ? 'rgba(255,170,110,0.22)' : 'rgba(255,240,215,0.18)')
  glow.addColorStop(1, 'rgba(255,240,215,0)')
  ctx.fillStyle = glow
  ctx.fillRect(sx - 420, sy - 420, 840, 840)

  // cumulus: flat-bottomed clusters of soft puffs, larger low, smaller high
  let s = 17
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const cloud = (cx: number, cy: number, scale: number, alpha: number) => {
    const puffs = 7 + Math.floor(rnd() * 8)
    for (let p = 0; p < puffs; p++) {
      const r = (26 + rnd() * 48) * scale
      const x = cx + (rnd() - 0.5) * 220 * scale
      const y = cy - rnd() * 60 * scale
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, evening ? `rgba(255,214,190,${alpha})` : `rgba(255,255,255,${alpha})`)
      gr.addColorStop(0.55, evening ? `rgba(240,190,170,${alpha * 0.75})` : `rgba(250,252,255,${alpha * 0.75})`)
      gr.addColorStop(0.85, evening ? `rgba(180,140,140,${alpha * 0.35})` : `rgba(228,234,240,${alpha * 0.35})`)
      gr.addColorStop(1, 'rgba(220,228,236,0)')
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // the shaded underside
    const under = ctx.createLinearGradient(0, cy, 0, cy + 22 * scale)
    under.addColorStop(0, `rgba(190,200,212,${alpha * 0.5})`)
    under.addColorStop(1, 'rgba(190,200,212,0)')
    ctx.fillStyle = under
    ctx.fillRect(cx - 120 * scale, cy, 240 * scale, 22 * scale)
  }
  for (let i = 0; i < 22; i++) cloud(rnd() * W, H * (0.28 + rnd() * 0.16), 1.3 + rnd() * 0.8, 0.9)
  for (let i = 0; i < 30; i++) cloud(rnd() * W, H * (0.12 + rnd() * 0.18), 0.6 + rnd() * 0.6, 0.75)
  // the haze band just above the horizon, in front of everything
  const haze = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.5)
  haze.addColorStop(0, 'rgba(220,230,238,0)')
  haze.addColorStop(1, 'rgba(220,230,238,0.85)')
  ctx.fillStyle = haze
  ctx.fillRect(0, H * 0.4, W, H * 0.1)
  return c
}

/** A concrete facade with rows of dark windows, tiled by the building's size. */
function facadeTexture(tone: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = tone
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(40,44,50,0.75)'
  for (let y = 18; y < 256; y += 42) {
    for (let x = 12; x < 256; x += 34) {
      ctx.fillRect(x, y, 20, 24)
    }
  }
  // stains and grime
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % 256, 0, 3, 256)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export interface CityOpts {
  /** Plan bounding box of the home, mm. */
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}

/**
 * The neighbourhood: a ring of blocks from 55 m to 320 m out, roofs between
 * 36 m below the flat's floor and 10 m above it, and the home's own tower
 * carried down to the street so the flat does not float.
 */
export function cityscape(o: CityOpts): THREE.Group {
  const g = new THREE.Group()
  const S = 0.001
  const cx = ((o.bbox.minX + o.bbox.maxX) / 2) * S
  const cz = ((o.bbox.minY + o.bbox.maxY) / 2) * S
  const halfW = ((o.bbox.maxX - o.bbox.minX) / 2) * S
  const halfD = ((o.bbox.maxY - o.bbox.minY) / 2) * S
  const tones = ['#8e8b84', '#9a948a', '#807d79', '#a39c8e', '#8a8580', '#b0a89a']
  const textures = tones.map(facadeTexture)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6f6d68, roughness: 1 })

  let s = 7
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const block = (x: number, z: number, w: number, d: number, h: number, ti: number) => {
    const tex = textures[ti].clone()
    tex.needsUpdate = true
    tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 9)))
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat])
    m.position.set(x, -STREET_DROP + h / 2, z)
    m.receiveShadow = true
    g.add(m)
  }

  // the home's own tower, down to the street
  block(cx, cz, halfW * 2 + 1.2, halfD * 2 + 1.2, STREET_DROP - 0.3, 1)

  // the ring
  for (let i = 0; i < 150; i++) {
    const ang = rnd() * Math.PI * 2
    const dist = 55 + rnd() * rnd() * 265
    const x = cx + Math.cos(ang) * dist
    const z = cz + Math.sin(ang) * dist
    const w = 12 + rnd() * 28
    const d = 12 + rnd() * 28
    // the nearer, the lower: nothing close pokes above the hedge line from inside
    const maxTop = dist < 120 ? -4 : dist < 220 ? 4 : 10
    const top = -36 + rnd() * (maxTop + 36)
    const h = STREET_DROP + top
    if (Math.abs(x - cx) < halfW + w / 2 + 12 && Math.abs(z - cz) < halfD + d / 2 + 12) continue
    block(x, z, w, d, h, Math.floor(rnd() * textures.length))
  }
  return g
}
