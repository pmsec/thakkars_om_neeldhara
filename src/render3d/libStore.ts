/**
 * The style libraries — AI-generated MATERIALS (seamless texture tiles) and
 * 3D OBJECTS (GLB meshes, AI-generated or from free professional catalogues).
 * Everything lives in THIS BROWSER's IndexedDB: generate once, pay once,
 * reuse anywhere, forever. Nothing is stored on any server.
 */

export interface SavedMaterial {
  id: number
  at: number
  note: string
  provider: string
  model: string
  prompt: string
  /** The tile, as a data URL. */
  image: string
}

export interface SavedObject {
  id: number
  at: number
  note: string
  /** 'meshy' | 'tripo' | 'polyhaven' */
  source: string
  /** The text prompt (AI) or asset name (catalogue). */
  prompt: string
  /** The mesh, GLB binary. */
  glb: ArrayBuffer
}

function makeStore<T extends { id: number; at: number }>(dbName: string, store: string): {
  save: (r: Omit<T, 'id'>) => Promise<number>
  list: () => Promise<T[]>
  get: (id: number) => Promise<T | undefined>
  remove: (id: number) => Promise<void>
} {
  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(store)) {
          req.result.createObjectStore(store, { keyPath: 'id', autoIncrement: true })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
    })
  const tx = <R>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> =>
    openDb().then(
      (db) =>
        new Promise<R>((resolve, reject) => {
          const t = db.transaction(store, mode)
          const req = run(t.objectStore(store))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
          t.oncomplete = () => db.close()
        }),
    )
  return {
    save: (r) => tx('readwrite', (s) => s.add(r) as IDBRequest<number>),
    list: () => tx('readonly', (s) => s.getAll() as IDBRequest<T[]>).then((a) => a.sort((x, y) => y.at - x.at)),
    get: (id) => tx('readonly', (s) => s.get(id) as IDBRequest<T | undefined>),
    remove: (id) => tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined),
  }
}

export const materialLib = makeStore<SavedMaterial>('om-ai-materials', 'materials')
export const objectLib = makeStore<SavedObject>('om-ai-objects', 'objects')
