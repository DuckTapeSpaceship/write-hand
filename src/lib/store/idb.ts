import { createStore, del, get, set } from 'idb-keyval'

// One IndexedDB database for the app; strokes with pressure and time outgrow
// localStorage quickly.
const store = typeof indexedDB !== 'undefined' ? createStore('write-hand', 'kv') : undefined

export const idbGet = <T>(key: string) => get<T>(key, store)
export const idbSet = (key: string, value: unknown) => set(key, value, store)
export const idbDel = (key: string) => del(key, store)
