import type { TreeStoreItem } from '../domain/tree-store/index.js'

const ITEMS_URL = '/data/items.json'
const MIN_DELAY_MS = 2000

export type Items<T extends TreeStoreItem = TreeStoreItem> = T[]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function loadItems<T extends TreeStoreItem = TreeStoreItem>(): Promise<Items<T>> {
  const [response] = await Promise.all([fetch(ITEMS_URL), delay(MIN_DELAY_MS)])

  if (!response.ok) {
    throw new Error(`Failed to load ${ITEMS_URL}: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as Items<T>
}
