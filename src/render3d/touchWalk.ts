/**
 * Walking on a touch screen.
 *
 * The desktop walkthrough is pointer lock + WASD, and neither exists on an iPad: there
 * is no mouse to lock and no keys to hold. This is the touch equivalent, shared by the
 * 3D model tab and the walkthrough so the two feel the same:
 *
 *   - a thumb stick, bottom-left, to walk — push forward to walk, sideways to strafe,
 *     and further to hurry;
 *   - a one-finger drag anywhere else on the view to look around;
 *   - a two-finger pinch to widen or narrow the lens (the desktop's scroll wheel);
 *   - two rails on the right edge: EYE sets how high you stand, from a child's
 *     height right up to a look down over the walls, and TILT sets how far the
 *     view is pitched up or down. Eye height is otherwise held, so walking never
 *     floats or sinks.
 *
 * It drives the camera directly, in the same yaw/pitch (YXZ) convention as
 * PointerLockControls, so the orbit rig can be handed back the camera untouched.
 */

import * as THREE from 'three'

export interface TouchWalk {
  /** Whether the stick is shown and the view listens for look-drags. */
  readonly enabled: boolean
  enable(): void
  disable(): void
  /** Read yaw/pitch back from wherever the camera is now pointing. */
  sync(): void
  /** Advance the camera by one frame. */
  update(dt: number): void
  dispose(): void
}

/** iPad and phones report a coarse pointer; a desktop with a touch screen still walks
 * with the keys, but the stick does no harm there either, so touch points count too. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return coarse || navigator.maxTouchPoints > 0
}

const STICK_R = 54
const KNOB_R = 24
const RAIL_H = 170
const RAIL_W = 34
/** Eye height range on the rail, metres: crouch to a look over the walls. */
const EYE_MIN = 0.4
const EYE_MAX = 6.0
const LOOK_RATE = 0.0045
const MAX_PITCH = Math.PI * 0.44
/** The lens, as a vertical field of view: 40° is a long lens, 100° a very wide one. */
export const LENS_MIN = 40
export const LENS_MAX = 100

/** Widen (factor > 1) or narrow the lens, within the sane range. */
export function zoomLens(camera: THREE.PerspectiveCamera, factor: number): void {
  camera.fov = THREE.MathUtils.clamp(camera.fov * factor, LENS_MIN, LENS_MAX)
  camera.updateProjectionMatrix()
}

/**
 * Stop the browser zooming the PAGE when two fingers land on the view. iPad Safari
 * treats a pinch as a page zoom unless the gesture itself is refused, and then the
 * whole app scales instead of the camera dollying. Returns the undo.
 */
export function preventPageZoom(el: HTMLElement): () => void {
  const refuse = (e: Event): void => e.preventDefault()
  const twoFingers = (e: TouchEvent): void => {
    if (e.touches.length > 1) e.preventDefault()
  }
  el.addEventListener('gesturestart', refuse)
  el.addEventListener('gesturechange', refuse)
  el.addEventListener('touchmove', twoFingers, { passive: false })
  return () => {
    el.removeEventListener('gesturestart', refuse)
    el.removeEventListener('gesturechange', refuse)
    el.removeEventListener('touchmove', twoFingers)
  }
}

export function createTouchWalk(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLElement,
  host: HTMLElement,
  opts: { eye: number; speed: number; onTap?: (x: number, y: number) => void },
): TouchWalk {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const right = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  let enabled = false
  let stick = { x: 0, y: 0 }
  let eye = opts.eye

  // ---- the two rails on the right edge: eye height and tilt
  const rail = (label: string, bottom: number): { el: HTMLDivElement; knob: HTMLDivElement; set: (t: number) => void } => {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'absolute', right: '14px', bottom: `${bottom}px`,
      width: `${RAIL_W}px`, height: `${RAIL_H}px`, borderRadius: `${RAIL_W / 2}px`,
      background: 'rgba(30,28,24,0.28)', border: '2px solid rgba(255,255,255,0.55)',
      touchAction: 'none', display: 'none', zIndex: '5', boxSizing: 'border-box',
    } as Partial<CSSStyleDeclaration>)
    const knob = document.createElement('div')
    Object.assign(knob.style, {
      position: 'absolute', left: '3px', width: `${RAIL_W - 10}px`, height: `${RAIL_W - 10}px`, borderRadius: '50%',
      background: 'rgba(250,248,244,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>)
    const cap = document.createElement('div')
    cap.textContent = label
    Object.assign(cap.style, {
      position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 4px)',
      font: '600 10px/1 system-ui, sans-serif', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.9)',
      textShadow: '0 1px 2px rgba(0,0,0,0.6)', pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>)
    el.appendChild(knob)
    el.appendChild(cap)
    host.appendChild(el)
    // t runs 0 at the bottom of the rail to 1 at the top
    const set = (t: number): void => {
      const travel = RAIL_H - 4 - (RAIL_W - 10)
      knob.style.top = `${(1 - THREE.MathUtils.clamp(t, 0, 1)) * travel}px`
    }
    return { el, knob, set }
  }
  const eyeRail = rail('EYE', 54 + RAIL_H + 34)
  const tiltRail = rail('TILT', 54)
  const eyeT = (): number => (eye - EYE_MIN) / (EYE_MAX - EYE_MIN)
  const tiltT = (): number => (euler.x + MAX_PITCH) / (2 * MAX_PITCH)
  const railDrag = (r: { el: HTMLDivElement }, apply: (t: number) => void): void => {
    let id: number | null = null
    const at = (e: PointerEvent): void => {
      const b = r.el.getBoundingClientRect()
      apply(THREE.MathUtils.clamp(1 - (e.clientY - b.top - RAIL_W / 2) / (b.height - RAIL_W), 0, 1))
    }
    r.el.addEventListener('pointerdown', (e) => { id = e.pointerId; r.el.setPointerCapture(e.pointerId); at(e); e.preventDefault(); e.stopPropagation() })
    r.el.addEventListener('pointermove', (e) => { if (e.pointerId === id) { at(e); e.preventDefault() } })
    const up = (e: PointerEvent): void => { if (e.pointerId === id) id = null }
    r.el.addEventListener('pointerup', up)
    r.el.addEventListener('pointercancel', up)
  }
  railDrag(eyeRail, (t) => {
    eye = EYE_MIN + t * (EYE_MAX - EYE_MIN)
    camera.position.y = eye
    eyeRail.set(t)
  })
  railDrag(tiltRail, (t) => {
    euler.x = -MAX_PITCH + t * 2 * MAX_PITCH
    camera.quaternion.setFromEuler(euler)
    tiltRail.set(t)
  })

  // ---- the stick
  const base = document.createElement('div')
  Object.assign(base.style, {
    position: 'absolute', left: '22px', bottom: '54px',
    width: `${STICK_R * 2}px`, height: `${STICK_R * 2}px`, borderRadius: '50%',
    background: 'rgba(30,28,24,0.28)', border: '2px solid rgba(255,255,255,0.55)',
    touchAction: 'none', display: 'none', zIndex: '5', boxSizing: 'border-box',
  } as Partial<CSSStyleDeclaration>)
  const knob = document.createElement('div')
  Object.assign(knob.style, {
    position: 'absolute', left: `${STICK_R - KNOB_R}px`, top: `${STICK_R - KNOB_R}px`,
    width: `${KNOB_R * 2}px`, height: `${KNOB_R * 2}px`, borderRadius: '50%',
    background: 'rgba(250,248,244,0.92)', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>)
  base.appendChild(knob)
  host.appendChild(base)

  let stickPointer: number | null = null
  const setKnob = (): void => {
    knob.style.transform = `translate(${stick.x * (STICK_R - KNOB_R)}px, ${stick.y * (STICK_R - KNOB_R)}px)`
  }
  const onStickDown = (e: PointerEvent): void => {
    stickPointer = e.pointerId
    base.setPointerCapture(e.pointerId)
    onStickMove(e)
    e.preventDefault()
  }
  const onStickMove = (e: PointerEvent): void => {
    if (e.pointerId !== stickPointer) return
    const r = base.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / (STICK_R - KNOB_R)
    const dy = (e.clientY - (r.top + r.height / 2)) / (STICK_R - KNOB_R)
    const len = Math.hypot(dx, dy)
    const k = len > 1 ? 1 / len : 1
    stick = { x: dx * k, y: dy * k }
    setKnob()
    e.preventDefault()
  }
  const onStickUp = (e: PointerEvent): void => {
    if (e.pointerId !== stickPointer) return
    stickPointer = null
    stick = { x: 0, y: 0 }
    setKnob()
  }
  base.addEventListener('pointerdown', onStickDown)
  base.addEventListener('pointermove', onStickMove)
  base.addEventListener('pointerup', onStickUp)
  base.addEventListener('pointercancel', onStickUp)

  // ---- the look-drag on the view itself, and the two-finger pinch for the lens
  let lookPointer: number | null = null
  let pinchPointer: number | null = null
  let last = { x: 0, y: 0 }
  let pinchLast = { x: 0, y: 0 }
  let pinchStartDist = 0
  let pinchStartFov = 0
  let lookDownAt = { x: 0, y: 0 }
  let lookPinched = false
  let savedTouchAction = ''
  const pinchDist = (): number => Math.hypot(pinchLast.x - last.x, pinchLast.y - last.y)
  const onLookDown = (e: PointerEvent): void => {
    if (!enabled) return
    if (lookPointer === null) {
      lookPointer = e.pointerId
      last = { x: e.clientX, y: e.clientY }
      lookDownAt = { x: e.clientX, y: e.clientY }
      lookPinched = false
    } else if (pinchPointer === null && e.pointerId !== stickPointer) {
      pinchPointer = e.pointerId
      lookPinched = true
      pinchLast = { x: e.clientX, y: e.clientY }
      pinchStartDist = Math.max(1, pinchDist())
      pinchStartFov = camera.fov
    } else return
    canvas.setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopImmediatePropagation()
  }
  const onLookMove = (e: PointerEvent): void => {
    if (e.pointerId === pinchPointer) {
      pinchLast = { x: e.clientX, y: e.clientY }
    } else if (e.pointerId === lookPointer) {
      if (pinchPointer === null) {
        euler.y -= (e.clientX - last.x) * LOOK_RATE
        euler.x -= (e.clientY - last.y) * LOOK_RATE
        euler.x = THREE.MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH)
        camera.quaternion.setFromEuler(euler)
        tiltRail.set(tiltT())
      }
      last = { x: e.clientX, y: e.clientY }
    } else return
    if (pinchPointer !== null) {
      // Fingers apart = zoom in = a longer lens (smaller field of view).
      camera.fov = THREE.MathUtils.clamp(pinchStartFov * (pinchStartDist / Math.max(1, pinchDist())), LENS_MIN, LENS_MAX)
      camera.updateProjectionMatrix()
    }
    e.preventDefault()
    e.stopImmediatePropagation()
  }
  const onLookUp = (e: PointerEvent): void => {
    if (e.pointerId === pinchPointer) pinchPointer = null
    else if (e.pointerId === lookPointer) {
      lookPointer = null
      // a tap - no drag, no pinch - is a touch on whatever it landed on
      if (!lookPinched && Math.hypot(e.clientX - lookDownAt.x, e.clientY - lookDownAt.y) < 8) opts.onTap?.(e.clientX, e.clientY)
      // the remaining finger, if any, carries on as the look-drag
      if (pinchPointer !== null) { lookPointer = pinchPointer; last = pinchLast; pinchPointer = null }
    } else return
    e.stopImmediatePropagation()
  }
  // Capture phase, so the orbit rig (which listens on the same element) never sees the
  // drag while walking: one finger means look, not orbit.
  canvas.addEventListener('pointerdown', onLookDown, true)
  canvas.addEventListener('pointermove', onLookMove, true)
  canvas.addEventListener('pointerup', onLookUp, true)
  canvas.addEventListener('pointercancel', onLookUp, true)

  const sync = (): void => {
    euler.setFromQuaternion(camera.quaternion, 'YXZ')
    euler.z = 0
    camera.quaternion.setFromEuler(euler)
    tiltRail.set(tiltT())
    eyeRail.set(eyeT())
  }

  return {
    get enabled() {
      return enabled
    },
    enable() {
      enabled = true
      savedTouchAction = canvas.style.touchAction
      canvas.style.touchAction = 'none'
      base.style.display = 'block'
      eyeRail.el.style.display = 'block'
      tiltRail.el.style.display = 'block'
      camera.position.y = eye
      sync()
    },
    disable() {
      enabled = false
      stick = { x: 0, y: 0 }
      setKnob()
      lookPointer = null
      pinchPointer = null
      stickPointer = null
      canvas.style.touchAction = savedTouchAction
      base.style.display = 'none'
      eyeRail.el.style.display = 'none'
      tiltRail.el.style.display = 'none'
    },
    sync,
    update(dt) {
      if (!enabled) return
      const mag = Math.hypot(stick.x, stick.y)
      if (mag < 0.05) return
      // Two paces. A small push is the stroll; the stick pushed all the way to
      // its rim is exactly twice that, and nothing in between - so a room is
      // still taken slowly, and a hall can be crossed without waiting.
      const gait = mag >= 0.85 ? 2 : 1
      const speed = opts.speed * gait * dt
      right.setFromMatrixColumn(camera.matrix, 0)
      right.y = 0
      right.normalize()
      fwd.crossVectors(camera.up, right).normalize()
      // the stick's direction at unit length: the push sets the gait, not a ramp
      camera.position.addScaledVector(fwd, (-stick.y / mag) * speed)
      camera.position.addScaledVector(right, (stick.x / mag) * speed)
      camera.position.y = eye
    },
    dispose() {
      base.removeEventListener('pointerdown', onStickDown)
      base.removeEventListener('pointermove', onStickMove)
      base.removeEventListener('pointerup', onStickUp)
      base.removeEventListener('pointercancel', onStickUp)
      canvas.removeEventListener('pointerdown', onLookDown, true)
      canvas.removeEventListener('pointermove', onLookMove, true)
      canvas.removeEventListener('pointerup', onLookUp, true)
      canvas.removeEventListener('pointercancel', onLookUp, true)
      base.remove()
      eyeRail.el.remove()
      tiltRail.el.remove()
    },
  }
}
