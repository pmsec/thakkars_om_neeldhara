/**
 * Saved AI renders — kept in THIS BROWSER's IndexedDB, like the API keys are
 * kept in localStorage: nothing ever goes to a server. IndexedDB rather than
 * localStorage because renders are megabytes and localStorage caps at ~5 MB;
 * IndexedDB comfortably holds hundreds of renders.
 */

export interface SavedRender {
  id: number
  /** Unix ms at save time. */
  at: number
  note: string
  provider: string
  model: string
  /** The prompt that produced this image (the edit prompt, for refinements). */
  prompt: string
  /** The generated image, as a data URL. */
  out: string
  /** What it was generated FROM (true render, or the previous AI iteration). */
  input: string
}

const DB_NAME = 'om-ai-renders'
const STORE = 'renders'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
        t.oncomplete = () => db.close()
      }),
  )
}

export function saveRender(r: Omit<SavedRender, 'id'>): Promise<number> {
  return tx('readwrite', (s) => s.add(r) as IDBRequest<number>)
}

export function listRenders(): Promise<SavedRender[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<SavedRender[]>).then((all) =>
    all.sort((a, b) => b.at - a.at),
  )
}

export function deleteRender(id: number): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}
