import type {
  TreeStoreContract,
  TreeStoreId,
  TreeStoreItem,
  TreeStoreItemPatch,
  TreeStoreListener,
  TreeStoreParentId,
} from './types.js'

export class TreeStore<T extends TreeStoreItem> implements TreeStoreContract<T> {
  private readonly itemsById = new Map<TreeStoreId, T>()
  private readonly childrenByParent = new Map<TreeStoreParentId, TreeStoreId[]>()
  private readonly listeners = new Set<TreeStoreListener>()

  constructor(items: readonly T[] = []) {
    this.replaceItems(items, false)
  }

  public getAll(): T[] {
    return Array.from(this.itemsById.values())
  }

  public getItem(id: TreeStoreId): T | undefined {
    return this.itemsById.get(id)
  }

  public getChildren(parentId: TreeStoreParentId): T[] {
    return this.idsToItems(this.childrenByParent.get(parentId))
  }

  public getAllChildren(id: TreeStoreId): T[] {
    if (!this.itemsById.has(id)) {
      return []
    }

    const result: T[] = []

    const visit = (parentId: TreeStoreParentId): void => {
      const children = this.childrenByParent.get(parentId)

      if (!children) {
        return
      }

      for (const childId of children) {
        const child = this.itemsById.get(childId)

        if (!child) {
          continue
        }

        result.push(child)
        visit(childId)
      }
    }

    visit(id)
    return result
  }

  public getAllParents(id: TreeStoreId): T[] {
    const first = this.itemsById.get(id)

    if (!first) {
      return []
    }

    const result: T[] = []
    const visited = new Set<TreeStoreId>()
    let current: T | undefined = first

    while (current && !visited.has(current.id)) {
      result.push(current)
      visited.add(current.id)

      if (current.parent === null) {
        break
      }

      current = this.itemsById.get(current.parent)
    }

    return result
  }

  public setItems(items: readonly T[]): void {
    this.replaceItems(items, true)
  }

  public addItem(item: T): void {
    if (this.itemsById.has(item.id)) {
      throw new TypeError(`Duplicate id "${String(item.id)}"`)
    }

    this.itemsById.set(item.id, item)
    this.appendChild(item.parent, item.id)
    this.emit()
  }

  public removeItem(id: TreeStoreId): void {
    const target = this.itemsById.get(id)

    if (!target) {
      return
    }

    const toRemove: TreeStoreId[] = []
    const stack: TreeStoreId[] = [id]

    while (stack.length > 0) {
      const currentId = stack.pop() as TreeStoreId
      toRemove.push(currentId)

      const children = this.childrenByParent.get(currentId)

      if (!children) {
        continue
      }

      for (let index = children.length - 1; index >= 0; index -= 1) {
        const childId = children[index]

        if (childId !== undefined) {
          stack.push(childId)
        }
      }
    }

    this.detachChild(target.parent, id)

    for (const currentId of toRemove) {
      this.itemsById.delete(currentId)
      this.childrenByParent.delete(currentId)
    }

    this.emit()
  }

  public updateItem(id: TreeStoreId, patch: TreeStoreItemPatch<T>): void {
    const current = this.itemsById.get(id)

    if (!current) {
      return
    }

    const patchRecord: Record<string, unknown> = { ...(patch as Record<string, unknown>) }
    delete patchRecord.id

    const hasParentInPatch = Object.prototype.hasOwnProperty.call(patchRecord, 'parent')
    const nextParent = hasParentInPatch ? (patchRecord.parent as TreeStoreParentId) : current.parent

    const nextItem = {
      ...current,
      ...(patchRecord as TreeStoreItemPatch<T>),
      id: current.id,
      parent: nextParent,
    } as T

    if (nextParent !== current.parent) {
      this.detachChild(current.parent, id)
      this.appendChild(nextParent, id)
    }

    this.itemsById.set(id, nextItem)
    this.emit()
  }

  public subscribe(listener: TreeStoreListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private replaceItems(items: readonly T[], emitChange: boolean): void {
    const nextItemsById = new Map<TreeStoreId, T>()
    const nextChildrenByParent = new Map<TreeStoreParentId, TreeStoreId[]>()

    for (const item of items) {
      if (nextItemsById.has(item.id)) {
        throw new TypeError(`Duplicate id "${String(item.id)}"`)
      }

      nextItemsById.set(item.id, item)

      const siblings = nextChildrenByParent.get(item.parent)

      if (siblings) {
        siblings.push(item.id)
      } else {
        nextChildrenByParent.set(item.parent, [item.id])
      }
    }

    this.itemsById.clear()
    this.childrenByParent.clear()

    for (const [key, value] of nextItemsById) {
      this.itemsById.set(key, value)
    }

    for (const [key, value] of nextChildrenByParent) {
      this.childrenByParent.set(key, [...value])
    }

    if (emitChange) {
      this.emit()
    }
  }

  private idsToItems(ids: readonly TreeStoreId[] | undefined): T[] {
    if (!ids || ids.length === 0) {
      return []
    }

    const result: T[] = []

    for (const id of ids) {
      const item = this.itemsById.get(id)

      if (item) {
        result.push(item)
      }
    }

    return result
  }

  private appendChild(parentId: TreeStoreParentId, id: TreeStoreId): void {
    const siblings = this.childrenByParent.get(parentId)

    if (siblings) {
      siblings.push(id)
      return
    }

    this.childrenByParent.set(parentId, [id])
  }

  private detachChild(parentId: TreeStoreParentId, id: TreeStoreId): void {
    const siblings = this.childrenByParent.get(parentId)

    if (!siblings) {
      return
    }

    const index = siblings.indexOf(id)

    if (index === -1) {
      return
    }

    siblings.splice(index, 1)

    if (siblings.length === 0) {
      this.childrenByParent.delete(parentId)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
