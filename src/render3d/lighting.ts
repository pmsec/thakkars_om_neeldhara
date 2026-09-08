/**
 * The lighting MOOD as scene state. An AI render's atmosphere is paint; this
 * is the transferable version — four parameters (warmth, brightness, sun
 * direction, sun height) read off a render by the vision model or picked as
 * a preset, mapped onto the walkthrough's real sun, sky, exposure and room
 * lighting. With no mood set, both views keep their original fixed rigs.
 */

import * as THREE from 'three'

export interface LightMood {
  name: string
  /** 0 = cool daylight, 1 = deep amber. */
  warmth: number
  /** 0 = dusk-dark, 1 = full day. */
  brightness: number
  /** Compass the light comes FROM. */
  sunDir: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  sunHeight: 'low' | 'mid' | 'high'
}

export const LIGHT_PRESETS: Record<string, LightMood> = {
  day: { name: 'Bright day', warmth: 0.15, brightness: 1.0, sunDir: 'SE', sunHeight: 'high' },
  evening: { name: 'Warm evening', warmth: 0.75, brightness: 0.55, sunDir: 'W', sunHeight: 'low' },
  dusk: { name: 'Dusk', warmth: 0.55, brightness: 0.3, sunDir: 'NW', sunHeight: 'low' },
}

export interface LightRig {
  sunColor: number
  sunIntensity: number
  /** Offset from the scene centre, metres. */
  sunOffset: [number, number, number]
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  pointColor: number
  pointIntensity: number
  exposure: number
  background: number
}

const lerpColor = (a: number, b: number, t: number): number =>
  new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHex()

const AZIMUTH: Record<LightMood['sunDir'], number> = {
  N: 180, NE: 225, E: 270, SE: 315, S: 0, SW: 45, W: 90, NW: 135,
}

/**
 * view 'walk' | 'top' — with mood null each returns exactly the values the
 * views shipped with, so setting no mood changes nothing.
 */
export function lightRig(mood: LightMood | null, view: 'walk' | 'top'): LightRig {
  if (!mood) {
    return view === 'walk'
      ? {
          // a palace afternoon: gilded sun, warm bounce off the stone, candle-warm
          // pools in the rooms
          sunColor: 0xffe9c8, sunIntensity: 1.8, sunOffset: [6, 22, 14],
          hemiSky: 0xe6eef5, hemiGround: 0xa08a68, hemiIntensity: 1.0,
          pointColor: 0xffd9a0, pointIntensity: 0.7, exposure: 1.1, background: 0xcfe0ea,
        }
      : {
          sunColor: 0xfff2dd, sunIntensity: 1.7, sunOffset: [-8, 26, 12],
          hemiSky: 0xeaf2f7, hemiGround: 0x9a9078, hemiIntensity: 1.0,
          pointColor: 0xffe3b0, pointIntensity: 0.45, exposure: 1.08, background: 0xd8d2c4,
        }
  }
  const w = mood.warmth
  const b = mood.brightness
  const elev = mood.sunHeight === 'high' ? 60 : mood.sunHeight === 'mid' ? 35 : 16
  const az = (AZIMUTH[mood.sunDir] * Math.PI) / 180
  const r = 26
  const sunOffset: [number, number, number] = [
    Math.sin(az) * Math.cos((elev * Math.PI) / 180) * r,
    Math.sin((elev * Math.PI) / 180) * r,
    Math.cos(az) * Math.cos((elev * Math.PI) / 180) * r,
  ]
  return {
    sunColor: lerpColor(0xffffff, 0xffb866, w),
    sunIntensity: 0.5 + 2.0 * b,
    sunOffset,
    hemiSky: lerpColor(0xeaf2f7, 0xffd9a8, w * 0.7),
    hemiGround: lerpColor(0x9a9078, 0x6e5a44, w * 0.6),
    hemiIntensity: 0.35 + 0.85 * b,
    pointColor: lerpColor(0xfff0d0, 0xffc070, w),
    // the interior pools take over as the day goes: dim at noon, warm at dusk
    pointIntensity: 0.15 + 0.85 * (1 - b),
    exposure: 0.85 + 0.35 * b,
    background: lerpColor(lerpColor(0x2e3644, 0xcfe0ea, b), 0xd9b98a, w * (1 - b) * 0.5),
  }
}
