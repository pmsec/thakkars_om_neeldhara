/**
 * The Style panel: AI-generated MATERIALS applied to real surfaces, and real
 * 3D OBJECTS standing in for drawn furniture — on the styled plan and the
 * walkthrough. The technical 3D stays schematic on purpose.
 *
 * Materials: describe a finish in words, generate a seamless tile through
 * OpenAI or Google, keep it forever in this browser's library, and apply it
 * to any room's floor, every floor, or the walls — no re-spend to reuse.
 *
 * Objects: describe a piece and generate a real mesh through Meshy or Tripo,
 * or import a professional model (GLB file or URL). Every object is FITTED
 * into its piece's drawn footprint — the plan stays the boss, and the live
 * fidelity gates keep applying to custom meshes.
 */

import React, { useEffect, useRef, useState } from 'react'
import { getModel } from '../geometry/model'
import { furniture } from '../data/furniture'
import { materialLib, objectLib, type SavedMaterial, type SavedObject } from './libStore'
import { getAssign, setAssign } from './styleOverrides'
import { shrinkDataUrl } from './imgUtil'
import { storageKey } from '../homes/registry'
import { LIGHT_PRESETS, type LightMood } from './lighting'

const KEYS_LS = 'om-ai-keys'
type ImgProvider = 'openai' | 'google'
type GenProvider = 'meshy' | 'tripo'

function keys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEYS_LS) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function setKey(name: string, v: string): void {
  localStorage.setItem(KEYS_LS, JSON.stringify({ ...keys(), [name]: v.trim() }))
}

// every room with a real floor — baths (wet), entry (circulation) and the
// store included, so materials can go anywhere; only voids are excluded
const rooms = getModel().rooms
  .filter((r) => r.def.category !== 'void')
  .map((r) => ({ id: r.id, name: r.name, finish: (r.def.finish ?? '').toLowerCase() }))

const row: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', margin: '6px 0' }

export function StylePanel(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'materials' | 'objects'>('materials')

  // ---- materials
  const [imgProvider, setImgProvider] = useState<ImgProvider>('openai')
  const [imgModels, setImgModels] = useState<string[]>([])
  const [imgModel, setImgModel] = useState('')
  const [matPrompt, setMatPrompt] = useState('dark walnut plank flooring, natural oil finish')
  const [mats, setMats] = useState<SavedMaterial[]>([])
  const [busy, setBusy] = useState('')
  const [applyTarget, setApplyTarget] = useState('*')
  const [palette, setPalette] = useState<Array<{ surface: string; prompt: string }>>([])
  const [paletteRef, setPaletteRef] = useState<string | null>(null)
  const [paletteLight, setPaletteLight] = useState<LightMood | null>(null)

  useEffect(() => {
    const readPalette = (): void => {
      try {
        const p = JSON.parse(localStorage.getItem(storageKey('om-material-palette')) || '{}') as {
          materials?: Array<{ surface: string; prompt: string }>
          ref?: string
          lighting?: LightMood | null
        }
        setPalette(p.materials ?? [])
        setPaletteRef(p.ref ?? null)
        setPaletteLight(p.lighting ?? null)
      } catch {
        setPalette([])
        setPaletteRef(null)
        setPaletteLight(null)
      }
    }
    readPalette()
    window.addEventListener('om-palette-changed', readPalette)
    return () => window.removeEventListener('om-palette-changed', readPalette)
  }, [])

  /** Extract ONE palette entry as a tile, image-to-image from the reference
   * render — the model reproduces the material AS SHOWN, not from words. */
  const extractTile = async (entry: { surface: string; prompt: string }): Promise<number | null> => {
    if (!paletteRef || !imgModel) return null
    const k = keys()[imgProvider]
    const [head, b64] = paletteRef.split(',', 2)
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
    const ask =
      `From this interior render, extract the ${entry.surface} material (${entry.prompt}) as a ` +
      'texture tile. Reproduce EXACTLY the material as it appears in the image — same colour, ' +
      'pattern, grain and finish, no restyling — as a perfectly flat, seamless, tileable ' +
      'texture filling the whole frame. Even diffuse lighting, no shadows, no perspective, no objects.'
    const r = await fetch('/api/ai-render', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(k ? { 'x-provider-key': k } : {}) },
      body: JSON.stringify({ provider: imgProvider, model: imgModel, prompt: ask, image: b64, mime }),
    })
    const j = (await r.json()) as { image?: string; mime?: string; error?: string }
    if (!r.ok || !j.image) throw new Error(j.error ?? `HTTP ${r.status}`)
    const id = await materialLib.save({
      at: Date.now(), note: `${entry.surface} — from render`, provider: imgProvider,
      model: imgModel, prompt: entry.prompt,
      image: `data:${j.mime ?? 'image/png'};base64,${j.image}`,
    })
    return id
  }

  /**
   * ONE BUTTON, first iteration: read the approved render's look onto the
   * real model. The main floor material covers every wood-finish room, a
   * stone material (when the render has one) covers the stone-finish rooms,
   * the wall material covers the walls. Every tile lands in the library, so
   * the manual per-room controls below take over from there.
   */
  const autoApplyLook = async (): Promise<void> => {
    const floorEntries = palette.filter((e) => /floor/i.test(e.surface))
    const wood = floorEntries.find((e) => /wood|walnut|oak|plank|timber|teak/i.test(e.prompt)) ?? floorEntries[0]
    const stone = floorEntries.find((e) => e !== wood && /stone|marble|tile|terrazzo|concrete/i.test(e.prompt))
      ?? palette.find((e) => !/floor/i.test(e.surface) && /^stone|stone$/i.test(e.surface))
    const wall = palette.find((e) => /wall|plaster|paint/i.test(e.surface))
    if (!wood && !wall) {
      setBusy('Nothing to auto-apply: the palette has no floor or wall entry.')
      return
    }
    try {
      const a = getAssign()
      let step = 0
      const total = [wood, stone, wall].filter(Boolean).length
      if (wood) {
        setBusy(`Auto-applying… ${++step}/${total}: main floor`)
        const id = await extractTile(wood)
        if (id) a.floors['*'] = id
      }
      if (stone) {
        setBusy(`Auto-applying… ${++step}/${total}: stone floors`)
        const id = await extractTile(stone)
        if (id) {
          for (const r of rooms) {
            if (r.finish.includes('stone') || r.finish.includes('vinyl')) a.floors[r.id] = id
          }
        }
      }
      if (wall) {
        setBusy(`Auto-applying… ${++step}/${total}: walls`)
        const id = await extractTile(wall)
        if (id) a.walls = id
      }
      if (paletteLight) a.lighting = paletteLight
      setAssign(a)
      await refresh()
      bump()
      setBusy('')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const setLighting = (m: LightMood | null): void => {
    const a = getAssign()
    a.lighting = m
    setAssign(a)
    bump()
  }

  const extractOne = async (entry: { surface: string; prompt: string }): Promise<void> => {
    setBusy(`Extracting ${entry.surface} tile…`)
    try {
      await extractTile(entry)
      await refresh()
      setBusy('')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const extractAllTiles = async (): Promise<void> => {
    let done = 0
    try {
      for (const entry of palette) {
        setBusy(`Extracting tiles… ${done + 1} / ${palette.length} (${entry.surface})`)
        await extractTile(entry)
        done++
        await refresh()
      }
      setBusy('')
    } catch (err) {
      setBusy(`Failed after ${done} tile${done === 1 ? '' : 's'}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ---- objects
  const [genProvider, setGenProvider] = useState<GenProvider>('meshy')
  const [objPrompt, setObjPrompt] = useState('modern 3-seat sofa, oatmeal linen upholstery, walnut plinth')
  const [objs, setObjs] = useState<SavedObject[]>([])
  const [piece, setPiece] = useState(furniture.find((f) => f.kind === 'sofa')?.id ?? furniture[0]?.id ?? '')
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [, force] = useState(0)
  const bump = (): void => force((n) => n + 1)

  const refresh = async (): Promise<void> => {
    setMats(await materialLib.list())
    setObjs(await objectLib.list())
  }
  useEffect(() => {
    if (open) void refresh()
  }, [open])

  const loadImgModels = async (p: ImgProvider): Promise<void> => {
    setImgModels([])
    try {
      const k = keys()[p]
      const r = await fetch(`/api/ai-models?provider=${p}`, { headers: k ? { 'x-provider-key': k } : {} })
      const j = (await r.json()) as { models?: string[]; error?: string }
      if (!r.ok || !j.models) throw new Error(j.error ?? `HTTP ${r.status}`)
      setImgModels(j.models)
      setImgModel(j.models.find((m) => /gpt-image-2|flash-image/i.test(m)) ?? j.models[0] ?? '')
    } catch (err) {
      setBusy(String(err instanceof Error ? err.message : err))
    }
  }
  useEffect(() => {
    if (open && tab === 'materials') void loadImgModels(imgProvider)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, imgProvider])

  const generateMaterial = async (): Promise<void> => {
    if (!imgModel) return
    setBusy('Generating texture…')
    try {
      const k = keys()[imgProvider]
      const fullPrompt =
        `Seamless tileable material texture, photographed straight on: ${matPrompt}. ` +
        'Perfectly flat, even diffuse lighting, no shadows, no perspective, no objects, ' +
        'edges must tile seamlessly. Fill the whole frame with the material.'
      const r = await fetch('/api/ai-render', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(k ? { 'x-provider-key': k } : {}) },
        body: JSON.stringify({ provider: imgProvider, model: imgModel, prompt: fullPrompt }),
      })
      const j = (await r.json()) as { image?: string; mime?: string; error?: string }
      if (!r.ok || !j.image) throw new Error(j.error ?? `HTTP ${r.status}`)
      await materialLib.save({
        at: Date.now(), note: matPrompt, provider: imgProvider, model: imgModel,
        prompt: matPrompt, image: `data:${j.mime ?? 'image/png'};base64,${j.image}`,
      })
      await refresh()
      setBusy('')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const applyMaterial = (matId: number): void => {
    const a = getAssign()
    if (applyTarget === 'walls') a.walls = matId
    else a.floors[applyTarget] = matId
    setAssign(a)
    bump()
  }

  // ---- per-tile editing: tile + instruction -> a NEW named tile; the
  // original stays in the library untouched
  const [edit, setEdit] = useState<{ id: number; prompt: string; name: string } | null>(null)

  const generateEdit = async (): Promise<void> => {
    if (!edit || !imgModel) return
    const src = mats.find((m) => m.id === edit.id)
    if (!src || !edit.prompt.trim()) return
    setBusy('Editing tile…')
    try {
      const k = keys()[imgProvider]
      const bounded = await shrinkDataUrl(src.image, 1024, 0.9)
      const [head, b64] = bounded.split(',', 2)
      const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
      const fullPrompt =
        `Edit this seamless material texture tile: ${edit.prompt.trim()}. ` +
        'Keep it a perfectly flat, seamless, tileable material texture filling the whole ' +
        'frame — even diffuse lighting, no shadows, no perspective, no objects.'
      const r = await fetch('/api/ai-render', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(k ? { 'x-provider-key': k } : {}) },
        body: JSON.stringify({ provider: imgProvider, model: imgModel, prompt: fullPrompt, image: b64, mime }),
      })
      const j = (await r.json()) as { image?: string; mime?: string; error?: string }
      if (!r.ok || !j.image) throw new Error(j.error ?? `HTTP ${r.status}`)
      await materialLib.save({
        at: Date.now(),
        note: edit.name.trim() || `${src.note} (edited)`,
        provider: imgProvider,
        model: imgModel,
        prompt: `${src.prompt} → ${edit.prompt.trim()}`,
        image: `data:${j.mime ?? 'image/png'};base64,${j.image}`,
      })
      await refresh()
      setEdit(null)
      setBusy('')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const saveGlb = async (buf: ArrayBuffer, source: string, note: string): Promise<void> => {
    const id = await objectLib.save({ at: Date.now(), note, source, prompt: note, glb: buf })
    if (piece) {
      const a = getAssign()
      a.objects[piece] = { objId: id, rot: 0 }
      setAssign(a)
    }
    await refresh()
    setBusy('')
  }

  const generateObject = async (): Promise<void> => {
    const k = keys()[genProvider]
    setBusy('Creating 3D task…')
    try {
      const hdr = { 'content-type': 'application/json', ...(k ? { 'x-provider-key': k } : {}) }
      const r = await fetch('/api/gen3d', {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ provider: genProvider, action: 'create', prompt: objPrompt }),
      })
      const j = (await r.json()) as { taskId?: string; error?: string }
      if (!r.ok || !j.taskId) throw new Error(j.error ?? `HTTP ${r.status}`)
      for (let i = 0; i < 120; i++) {
        await new Promise((ok) => setTimeout(ok, 5000))
        const sr = await fetch('/api/gen3d', {
          method: 'POST', headers: hdr,
          body: JSON.stringify({ provider: genProvider, action: 'status', taskId: j.taskId }),
        })
        const s = (await sr.json()) as { status?: string; progress?: number; url?: string; error?: string; detail?: string }
        if (!sr.ok) throw new Error(s.error ?? `HTTP ${sr.status}`)
        if (s.status === 'failed') throw new Error(s.detail ?? 'generation failed at the provider')
        setBusy(`Generating mesh… ${s.progress != null ? `${s.progress} %` : `(${(i + 1) * 5} s)`}`)
        if (s.status === 'done' && s.url) {
          setBusy('Downloading mesh…')
          const mr = await fetch(`/api/model-fetch?url=${encodeURIComponent(s.url)}`)
          if (!mr.ok) {
            const e = (await mr.json().catch(() => ({}))) as { error?: string }
            throw new Error(e.error ?? `download failed (${mr.status})`)
          }
          await saveGlb(await mr.arrayBuffer(), genProvider, objPrompt)
          return
        }
      }
      throw new Error('timed out after 10 minutes')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const importUrl = async (): Promise<void> => {
    setBusy('Fetching model…')
    try {
      const r = await fetch(`/api/model-fetch?url=${encodeURIComponent(url.trim())}`)
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(e.error ?? `HTTP ${r.status}`)
      }
      await saveGlb(await r.arrayBuffer(), 'import', url.split('/').pop() ?? 'imported model')
    } catch (err) {
      setBusy(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const importFile = async (f: File): Promise<void> => {
    setBusy('Reading file…')
    await saveGlb(await f.arrayBuffer(), 'import', f.name)
  }

  const assign = getAssign()

  const card: React.CSSProperties = {
    position: 'absolute', top: 10, right: 108, width: 360, maxHeight: 'calc(100% - 20px)',
    overflowY: 'auto', background: 'rgba(250,248,244,0.97)', border: '1px solid #d5cdbb',
    borderRadius: 8, padding: 12, boxShadow: '0 4px 16px rgba(40,34,24,0.18)', fontSize: 13,
  }

  return (
    <>
      {!open && (
        <button
          style={{ position: 'absolute', top: 10, right: 108 }}
          onClick={() => setOpen(true)}
          title="AI materials and real 3D objects, applied to the true model"
        >
          🎨 Style
        </button>
      )}
      {open && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <button aria-pressed={tab === 'materials'} onClick={() => setTab('materials')}>Materials</button>{' '}
              <button aria-pressed={tab === 'objects'} onClick={() => setTab('objects')}>Objects</button>
            </span>
            <button onClick={() => setOpen(false)}>×</button>
          </div>

          {tab === 'materials' && (
            <>
              <p style={{ color: '#6d6558', margin: '8px 0 4px' }}>
                Describe a finish, generate once, keep forever. Apply anywhere below — reusing
                a saved tile costs nothing.
              </p>
              <div style={row}>
                {(['openai', 'google'] as const).map((p) => (
                  <button key={p} aria-pressed={imgProvider === p} onClick={() => setImgProvider(p)}>
                    {p === 'openai' ? 'OpenAI' : 'Google'}
                  </button>
                ))}
                <select value={imgModel} onChange={(e) => setImgModel(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                  {imgModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={row}>
                <input
                  value={matPrompt} onChange={(e) => setMatPrompt(e.target.value)}
                  placeholder="e.g. honed Kota stone, tight grey grain" style={{ flex: 1, minWidth: 0 }}
                />
                <button disabled={!!busy && busy.startsWith('Generating')} onClick={() => void generateMaterial()}>
                  Generate
                </button>
              </div>
              {palette.length > 0 && (
                <div style={{ border: '1px dashed #cbbfa4', borderRadius: 6, padding: 6, margin: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <b>Palette from your render</b>
                    <span>
                      {paletteRef && (
                        <button
                          title="First pass in one click: floor material to every wood room, stone to the stone rooms, wall material to the walls — then fine-tune per room below"
                          disabled={busy.startsWith('Auto') || busy.startsWith('Extracting')}
                          onClick={() => void autoApplyLook()}
                        >
                          Auto-apply this look
                        </button>
                      )}{' '}
                      {paletteRef && (
                        <button
                          title="Extract every material as a tile, image-to-image from the render itself"
                          disabled={busy.startsWith('Extracting') || busy.startsWith('Auto')}
                          onClick={() => void extractAllTiles()}
                        >
                          Extract all as tiles
                        </button>
                      )}{' '}
                      <button onClick={() => { localStorage.removeItem(storageKey('om-material-palette')); setPalette([]); setPaletteRef(null) }}>
                        dismiss
                      </button>
                    </span>
                  </div>
                  <div style={{ color: '#6d6558', fontSize: 11, margin: '2px 0 4px' }}>
                    {paletteRef
                      ? 'Tile buttons extract the ACTUAL material from the render (image-to-image). Clicking the text loads the prompt to generate a fresh interpretation instead.'
                      : 'Click one to load its prompt, tweak, then Generate its tile.'}
                  </div>
                  {palette.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'stretch', margin: '3px 0' }}>
                      <button
                        style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 11 }}
                        onClick={() => setMatPrompt(p.prompt)}
                      >
                        <b>{p.surface}</b> — {p.prompt}
                      </button>
                      {paletteRef && (
                        <button
                          title="Extract this material from the render as a saved tile"
                          disabled={busy.startsWith('Extracting')}
                          onClick={() => void extractOne(p)}
                        >
                          Tile
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ border: '1px solid #e2dac8', borderRadius: 6, padding: 6, margin: '6px 0', fontSize: 12 }}>
                <b>Lighting</b>
                <span style={{ color: '#6d6558' }}>
                  {' '}— {getAssign().lighting?.name ?? 'default rig'}
                </span>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {paletteLight && (
                    <button
                      title="Match the walkthrough and styled plan to the render's light"
                      onClick={() => setLighting(paletteLight)}
                    >
                      From render: {paletteLight.name}
                    </button>
                  )}
                  {Object.entries(LIGHT_PRESETS).map(([k, m]) => (
                    <button key={k} onClick={() => setLighting(m)}>{m.name}</button>
                  ))}
                  <button onClick={() => setLighting(null)}>Reset</button>
                </div>
              </div>
              <div style={row}>
                <span style={{ width: 60 }}>Apply to</span>
                <select value={applyTarget} onChange={(e) => setApplyTarget(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                  <option value="*">Every floor</option>
                  <option value="walls">Walls</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} floor</option>)}
                </select>
              </div>
              {edit && (
                <div style={{ border: '1px solid #b9a877', background: '#faf6ea', borderRadius: 6, padding: 8, margin: '6px 0', fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <img src={mats.find((m) => m.id === edit.id)?.image} style={{ width: 64, height: 64, borderRadius: 4, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>Edit this tile</b> — the original stays; the edit is saved as a new material.
                      <input
                        value={edit.prompt}
                        onChange={(e) => setEdit({ ...edit, prompt: e.target.value })}
                        placeholder="what to change (e.g. make it lighter, wider planks)"
                        style={{ width: '100%', boxSizing: 'border-box', margin: '4px 0' }}
                      />
                      <input
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                        placeholder="name for the new material"
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 4 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={!edit.prompt.trim() || busy === 'Editing tile…'} onClick={() => void generateEdit()}>
                          {busy === 'Editing tile…' ? 'Editing…' : 'Generate edited tile'}
                        </button>
                        <button onClick={() => setEdit(null)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                {mats.map((m) => (
                  <div key={m.id} style={{ border: '1px solid #e2dac8', borderRadius: 6, padding: 5, fontSize: 11 }}>
                    <img src={m.image} style={{ width: '100%', borderRadius: 4, display: 'block' }} />
                    <div style={{ margin: '4px 0', minHeight: 24 }}>{m.note}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => applyMaterial(m.id)}>Apply</button>
                      <button onClick={() => setEdit({ id: m.id, prompt: '', name: `${m.note} (edited)` })}>
                        Edit
                      </button>
                      <button onClick={() => { void materialLib.remove(m.id).then(refresh) }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {(Object.keys(assign.floors).length > 0 || assign.walls) && (
                <div style={{ marginTop: 8, borderTop: '1px solid #e2dac8', paddingTop: 6 }}>
                  <b>Applied</b>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                    {Object.entries(assign.floors).map(([rid, mid]) => (
                      <li key={rid}>
                        {rid === '*' ? 'Every floor' : rooms.find((r) => r.id === rid)?.name ?? rid}: #{mid}{' '}
                        <button onClick={() => { const a = getAssign(); delete a.floors[rid]; setAssign(a); bump() }}>×</button>
                      </li>
                    ))}
                    {assign.walls && (
                      <li>
                        Walls: #{assign.walls}{' '}
                        <button onClick={() => { const a = getAssign(); a.walls = null; setAssign(a); bump() }}>×</button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === 'objects' && (
            <>
              <div style={row}>
                <span style={{ width: 60 }}>Piece</span>
                <select value={piece} onChange={(e) => setPiece(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                  {furniture.map((f) => (
                    <option key={f.id} value={f.id}>{f.label} — {f.room}</option>
                  ))}
                </select>
              </div>
              <p style={{ color: '#6d6558', margin: '6px 0' }}>
                Whatever the source, the object is FITTED into this piece&rsquo;s drawn footprint —
                position, size and rotation stay the plan&rsquo;s.
              </p>
              <div style={row}>
                {(['meshy', 'tripo'] as const).map((p) => (
                  <button key={p} aria-pressed={genProvider === p} onClick={() => setGenProvider(p)}>
                    {p === 'meshy' ? 'Meshy' : 'Tripo'}
                  </button>
                ))}
                <input
                  type="password" placeholder={`${genProvider} API key (or Vercel env)`}
                  defaultValue={keys()[genProvider] ?? ''}
                  onChange={(e) => setKey(genProvider, e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={row}>
                <input
                  value={objPrompt} onChange={(e) => setObjPrompt(e.target.value)}
                  placeholder="describe the piece" style={{ flex: 1, minWidth: 0 }}
                />
                <button disabled={busy.startsWith('Generating') || busy.startsWith('Creating')} onClick={() => void generateObject()}>
                  Generate
                </button>
              </div>
              <div style={row}>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or a direct .glb URL" style={{ flex: 1, minWidth: 0 }} />
                <button onClick={() => void importUrl()}>Fetch</button>
                <button onClick={() => fileRef.current?.click()}>Upload</button>
                <input
                  ref={fileRef} type="file" accept=".glb" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f) }}
                />
              </div>
              <div style={{ marginTop: 6 }}>
                {objs.map((o) => (
                  <div key={o.id} style={{ border: '1px solid #e2dac8', borderRadius: 6, padding: 6, marginBottom: 6, fontSize: 12 }}>
                    <b>{o.note}</b>
                    <div style={{ color: '#6d6558' }}>
                      {new Date(o.at).toLocaleDateString()} · {o.source} · {(o.glb.byteLength / 1e6).toFixed(1)} MB
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button
                        onClick={() => {
                          const a = getAssign()
                          a.objects[piece] = { objId: o.id, rot: a.objects[piece]?.objId === o.id ? a.objects[piece].rot : 0 }
                          setAssign(a)
                          bump()
                        }}
                      >
                        Use for selected piece
                      </button>
                      <button onClick={() => { void objectLib.remove(o.id).then(refresh) }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {Object.keys(assign.objects).length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid #e2dac8', paddingTop: 6 }}>
                  <b>Placed objects</b>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                    {Object.entries(assign.objects).map(([fid, o]) => (
                      <li key={fid}>
                        {furniture.find((f) => f.id === fid)?.label ?? fid} → #{o.objId}{' '}
                        <button
                          title="Turn a quarter"
                          onClick={() => { const a = getAssign(); a.objects[fid].rot = (a.objects[fid].rot + 1) % 4; setAssign(a); bump() }}
                        >
                          ⟳ 90°
                        </button>{' '}
                        <button onClick={() => { const a = getAssign(); delete a.objects[fid]; setAssign(a); bump() }}>×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {busy && <div style={{ marginTop: 8, color: busy.startsWith('Failed') ? '#a33' : '#6d6558' }}>{busy}</div>}
        </div>
      )}
    </>
  )
}
