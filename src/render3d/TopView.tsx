/**
 * The styled plan: between 2D and 3D.
 *
 * The Walkthrough's materials scene — oak boards, stone, grass, furniture
 * with cushions and duvets, trees with crowns, warm light pools — seen
 * straight down through an orthographic camera, roofs off so every room is
 * open to view. Because it is generated from the same derived model as
 * everything else, it is ALWAYS the current plan, unlike an AI-styled image.
 *
 * Drag to pan, wheel or buttons to zoom. Deliberately no rotation: this is
 * a plan, just a dressed one.
 */

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getModel } from '../geometry/model'
import { furniture } from '../data/furniture'
import { S } from './prism'
import { buildFixtures, buildScene, furnitureMesh, makeMaterials } from './Realistic'
import { AiRenderPanel } from './AiRenderPanel'
import { StylePanel } from './StylePanel'
import { primeStyle } from './styleOverrides'

const model = getModel()

export function TopView({ compact = false }: { compact?: boolean }): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [hint] = useState(true)
  const captureRef = useRef<(() => string | null) | null>(null)

  const [styleTick, setStyleTick] = useState(0)
  useEffect(() => {
    const onStyle = (): void => {
      void primeStyle().then(() => setStyleTick((t) => t + 1))
    }
    onStyle()
    window.addEventListener('om-style-changed', onStyle)
    return () => window.removeEventListener('om-style-changed', onStyle)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd8d2c4)      // the mat around the plan

    const M = makeMaterials()
    scene.add(buildScene(M, { roofs: false }))
    scene.add(buildFixtures(M))
    const furn = new THREE.Group()
    for (const f of furniture) {
      if (f.label.toLowerCase().includes('fountain')) continue
      const o = furnitureMesh(f, M)
      if (o) furn.add(o)
    }
    scene.add(furn)

    scene.add(new THREE.HemisphereLight(0xeaf2f7, 0x9a9078, 1.0))
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.7)
    sun.position.set(4, 26, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    const ext = 18
    sun.shadow.camera.left = -ext
    sun.shadow.camera.right = ext
    sun.shadow.camera.top = ext
    sun.shadow.camera.bottom = -ext
    sun.shadow.camera.far = 80
    sun.target.position.set(12.24, 0, 5.5)
    scene.add(sun, sun.target)
    for (const r of model.rooms) {
      if (r.def.category !== 'habitable' && r.def.id !== 'R-ENTRY') continue
      const p = new THREE.PointLight(0xffe3b0, 0.45, Math.max(r.width, r.depth) * S * 1.4, 1.8)
      p.position.set(r.centroid.x * S, (r.ceiling - 400) * S, r.centroid.y * S)
      scene.add(p)
    }

    // ---- orthographic camera, straight down, north up on the screen
    const bb = model.envelopeBBox
    const cx = ((bb.minX + bb.maxX) / 2) * S
    const cz = ((bb.minY + bb.maxY) / 2) * S
    const spanX = (bb.maxX - bb.minX) * S + 3
    const spanZ = (bb.maxY - bb.minY) * S + 3
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    camera.position.set(cx, 40, cz)
    camera.up.set(0, 0, -1)                // model north (-y, so scene -z) is up
    camera.lookAt(cx, 0, cz)

    const view = { x: cx, z: cz, zoom: 1 }
    const applyCamera = (): void => {
      const r = mount.getBoundingClientRect()
      const aspect = r.width / Math.max(1, r.height)
      let w = spanX / 2
      let h = spanZ / 2
      if (w / h < aspect) w = h * aspect
      else h = w / aspect
      camera.left = -w / view.zoom
      camera.right = w / view.zoom
      camera.top = h / view.zoom
      camera.bottom = -h / view.zoom
      camera.position.set(view.x, 40, view.z)
      camera.updateProjectionMatrix()
    }

    const drag = { on: false, px: 0, py: 0, x: 0, z: 0 }
    const el = renderer.domElement
    const onDown = (e: PointerEvent): void => {
      drag.on = true
      drag.px = e.clientX
      drag.py = e.clientY
      drag.x = view.x
      drag.z = view.z
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent): void => {
      if (!drag.on) return
      const r = mount.getBoundingClientRect()
      const worldPerPx = (camera.right - camera.left) / r.width
      view.x = drag.x - (e.clientX - drag.px) * worldPerPx
      view.z = drag.z - (e.clientY - drag.py) * worldPerPx
      applyCamera()
    }
    const onUp = (): void => {
      drag.on = false
    }
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      view.zoom = Math.min(8, Math.max(0.7, view.zoom * Math.exp(-e.deltaY * 0.0015)))
      applyCamera()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    captureRef.current = () => {
      // render synchronously, then downscale to a provider-friendly JPEG
      renderer.render(scene, camera)
      const src = renderer.domElement
      const w = Math.min(1536, src.width)
      const h = Math.round((src.height / src.width) * w)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      if (!g) return null
      g.drawImage(src, 0, 0, w, h)
      return c.toDataURL('image/jpeg', 0.92)
    }

    let raf = 0
    const animate = (): void => {
      raf = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    const resize = (): void => {
      const r = mount.getBoundingClientRect()
      renderer.setSize(r.width, r.height)
      applyCamera()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    animate()

    return () => {
      captureRef.current = null
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onUp)
      el.removeEventListener('wheel', onWheel)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [styleTick])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
      {!compact && <AiRenderPanel capture={() => captureRef.current?.() ?? null} />}
      {!compact && <StylePanel />}
      {hint && !compact && (
        <div
          className="tiny"
          style={{
            position: 'absolute', bottom: 12, left: 12, padding: '5px 11px',
            background: 'rgba(30,28,24,0.72)', color: '#f3ecdd', borderRadius: 6,
            pointerEvents: 'none', letterSpacing: 0.3,
          }}
        >
          The styled plan — real materials, straight down, always the current design. Drag to pan · wheel to zoom.
        </div>
      )}
    </div>
  )
}
