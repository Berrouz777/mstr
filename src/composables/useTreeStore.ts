import { computed, onScopeDispose, readonly, shallowRef } from 'vue'
import { TreeStore } from '../domain/tree-store/index.js'
import type { TreeStoreItem } from '../domain/tree-store/index.js'

export function useTreeStore<T extends TreeStoreItem>() {
  const store = new TreeStore<T>()
  const snapshot = shallowRef<T[]>(store.getAll())
  const revision = shallowRef(0)

  const unsubscribe = store.subscribe(() => {
    snapshot.value = store.getAll()
    revision.value += 1
  })

  onScopeDispose(() => {
    unsubscribe()
  })

  return {
    store,
    items: readonly(snapshot),
    revision: computed(() => revision.value),
  }
}
