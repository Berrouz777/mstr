export type TreeStoreId = string | number

export type TreeStoreParentId = TreeStoreId | null

export interface TreeStoreItem {
  id: TreeStoreId
  parent: TreeStoreParentId
}

export type TreeStoreItemPatch<T extends TreeStoreItem> = Partial<Omit<T, 'id'>>

export type TreeStoreListener = () => void

export interface TreeStoreContract<T extends TreeStoreItem> {
  getAll(): T[]
  getItem(id: TreeStoreId): T | undefined
  getChildren(parentId: TreeStoreParentId): T[]
  getAllChildren(id: TreeStoreId): T[]
  getAllParents(id: TreeStoreId): T[]
  setItems(items: readonly T[]): void
  addItem(item: T): void
  removeItem(id: TreeStoreId): void
  updateItem(id: TreeStoreId, patch: TreeStoreItemPatch<T>): void
  subscribe(listener: TreeStoreListener): () => void
}
