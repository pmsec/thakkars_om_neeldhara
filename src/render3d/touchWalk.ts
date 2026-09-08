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
 *   - eye height is held, so you cannot float or sink.
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
  opts: { eye: number; speed: number },
): TouchWalk {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const right = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  let enabled = false
  let stick = { x: 0, y: 0 }

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
  let savedTouchAction = ''
  const pinchDist = (): number => Math.hypot(pinchLast.x - last.x, pinchLast.y - last.y)
  const onLookDown = (e: PointerEvent): void => {
    if (!enabled) return
    if (lookPointer === null) {
      lookPointer = e.pointerId
      last = { x: e.clientX, y: e.clientY }
    } else if (pinchPointer === null && e.pointerId !== stickPointer) {
      pinchPointer = e.pointerId
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
      camera.position.y = opts.eye
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
    },
    sync,
    update(dt) {
      if (!enabled) return
      const mag = Math.hypot(stick.x, stick.y)
      if (mag < 0.05) return
      // A gentle push creeps, a full push walks, and pushed to the rim is a hurry:
      // the pace follows how far the knob is from the centre, so a room can be
      // taken in a step at a time.
      const speed = opts.speed * mag * (mag > 0.92 ? 2 : 1) * dt
      right.setFromMatrixColumn(camera.matrix, 0)
      right.y = 0
      right.normalize()
      fwd.crossVectors(camera.up, right).normalize()
      camera.position.addScaledVector(fwd, -stick.y * speed)
      camera.position.addScaledVector(right, stick.x * speed)
      camera.position.y = opts.eye
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
    },
  }
}
