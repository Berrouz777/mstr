import type {
  TreeStoreContract,
  TreeStoreId,
  TreeStoreItem,
  TreeStoreItemPatch,
  TreeStoreListener,
  TreeStoreParentId,
} from './types.js'

type SiblingLink = TreeStoreId | null

type ParentBucket = {
  firstChild: SiblingLink
  lastChild: SiblingLink
}

type NodeRecord<T extends TreeStoreItem> = {
  item: T
  parent: TreeStoreParentId
  prevSibling: SiblingLink
  nextSibling: SiblingLink
}

export class TreeStore<T extends TreeStoreItem> implements TreeStoreContract<T> {
  private readonly recordsById = new Map<TreeStoreId, NodeRecord<T>>()
  private readonly bucketsByParent = new Map<TreeStoreParentId, ParentBucket>()
  private readonly listeners = new Set<TreeStoreListener>()

  constructor(items: readonly T[] = []) {
    this.replaceItems(items, false)
  }

  public getAll(): T[] {
    const result: T[] = []

    for (const record of this.recordsById.values()) {
      result.push(this.cloneItem(record.item))
    }

    return result
  }

  public getItem(id: TreeStoreId): T | undefined {
    const record = this.recordsById.get(id)

    return record ? this.cloneItem(record.item) : undefined
  }

  public getChildren(parentId: TreeStoreParentId): T[] {
    return this.collectChildren(parentId)
  }

  public getAllChildren(id: TreeStoreId): T[] {
    if (!this.recordsById.has(id)) {
      return []
    }

    const result: T[] = []
    const stack: TreeStoreId[] = []
    this.pushChildrenReverse(id, stack)

    while (stack.length > 0) {
      const currentId = stack.pop() as TreeStoreId
      const record = this.recordsById.get(currentId)

      if (!record) {
        continue
      }

      result.push(this.cloneItem(record.item))
      this.pushChildrenReverse(currentId, stack)
    }

    return result
  }

  public getAllParents(id: TreeStoreId): T[] {
    const first = this.recordsById.get(id)

    if (!first) {
      return []
    }

    const result: T[] = []
    const visited = new Set<TreeStoreId>()
    let current: NodeRecord<T> | undefined = first

    while (current && !visited.has(current.item.id)) {
      result.push(this.cloneItem(current.item))
      visited.add(current.item.id)

      if (current.parent === null) {
        break
      }

      current = this.recordsById.get(current.parent)
    }

    return result
  }

  public setItems(items: readonly T[]): void {
    this.replaceItems(items, true)
  }

  public addItem(item: T): void {
    this.assertValidItem(item)

    if (this.recordsById.has(item.id)) {
      throw new TypeError(`Duplicate id "${String(item.id)}"`)
    }

    const clonedItem = this.cloneItem(item)

    this.recordsById.set(clonedItem.id, {
      item: clonedItem,
      parent: clonedItem.parent,
      prevSibling: null,
      nextSibling: null,
    })
    this.attachToParent(clonedItem.id, clonedItem.parent)
    this.emit()
  }

  public removeItem(id: TreeStoreId): void {
    const target = this.recordsById.get(id)

    if (!target) {
      return
    }

    const toRemove: TreeStoreId[] = []
    const stack: TreeStoreId[] = [id]

    while (stack.length > 0) {
      const currentId = stack.pop() as TreeStoreId
      toRemove.push(currentId)
      this.pushChildrenReverse(currentId, stack)
    }

    this.detachFromParent(id, target.parent)

    for (const currentId of toRemove) {
      this.recordsById.delete(currentId)
      this.bucketsByParent.delete(currentId)
    }

    this.emit()
  }

  public updateItem(id: TreeStoreId, patch: TreeStoreItemPatch<T>): void {
    const current = this.recordsById.get(id)

    if (!current) {
      return
    }

    const patchRecord: Record<string, unknown> = { ...(patch as Record<string, unknown>) }
    delete patchRecord.id

    const hasParentInPatch = Object.prototype.hasOwnProperty.call(patchRecord, 'parent')
    const nextParent = hasParentInPatch ? (patchRecord.parent as TreeStoreParentId | undefined) : current.parent

    if (hasParentInPatch) {
      if (nextParent === undefined) {
        throw new TypeError('parent cannot be undefined')
      }

      if (nextParent === id) {
        throw new TypeError('Cannot set parent to self')
      }

      if (nextParent !== null && this.wouldCreateCycle(id, nextParent)) {
        throw new TypeError('Cannot set parent to descendant')
      }
    }

    const finalParent = nextParent as TreeStoreParentId

    const nextItem = this.cloneItem({
      ...current.item,
      ...(patchRecord as TreeStoreItemPatch<T>),
      id: current.item.id,
      parent: finalParent,
    } as T)

    if (finalParent !== current.parent) {
      this.detachFromParent(id, current.parent)
      this.attachToParent(id, finalParent)
      current.parent = finalParent
    }

    current.item = nextItem
    this.emit()
  }

  public subscribe(listener: TreeStoreListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private replaceItems(items: readonly T[], emitChange: boolean): void {
    const nextRecordsById = new Map<TreeStoreId, NodeRecord<T>>()
    const nextBucketsByParent = new Map<TreeStoreParentId, ParentBucket>()
    const parentById = new Map<TreeStoreId, TreeStoreParentId>()

    for (const item of items) {
      this.assertValidItem(item)

      if (nextRecordsById.has(item.id)) {
        throw new TypeError(`Duplicate id "${String(item.id)}"`)
      }

      const clonedItem = this.cloneItem(item)

      nextRecordsById.set(clonedItem.id, {
        item: clonedItem,
        parent: clonedItem.parent,
        prevSibling: null,
        nextSibling: null,
      })
      parentById.set(clonedItem.id, clonedItem.parent)

      const bucket = this.getOrCreateBucket(nextBucketsByParent, clonedItem.parent)
      const lastChild = bucket.lastChild

      if (lastChild === null) {
        bucket.firstChild = clonedItem.id
      } else {
        const lastRecord = nextRecordsById.get(lastChild)

        if (lastRecord) {
          lastRecord.nextSibling = clonedItem.id
        }
      }

      const currentRecord = nextRecordsById.get(clonedItem.id)

      if (currentRecord) {
        currentRecord.prevSibling = lastChild
      }

      bucket.lastChild = clonedItem.id
    }

    this.assertAcyclic(parentById)

    this.recordsById.clear()
    this.bucketsByParent.clear()

    for (const [id, record] of nextRecordsById) {
      this.recordsById.set(id, record)
    }

    for (const [parentId, bucket] of nextBucketsByParent) {
      this.bucketsByParent.set(parentId, {
        firstChild: bucket.firstChild,
        lastChild: bucket.lastChild,
      })
    }

    if (emitChange) {
      this.emit()
    }
  }

  private collectChildren(parentId: TreeStoreParentId): T[] {
    const result: T[] = []
    const bucket = this.bucketsByParent.get(parentId)

    if (!bucket || bucket.firstChild === null) {
      return result
    }

    let currentId: SiblingLink = bucket.firstChild

    while (currentId !== null) {
      const record = this.recordsById.get(currentId)

      if (!record) {
        break
      }

      result.push(this.cloneItem(record.item))
      currentId = record.nextSibling
    }

    return result
  }

  private pushChildrenReverse(parentId: TreeStoreParentId, stack: TreeStoreId[]): void {
    const bucket = this.bucketsByParent.get(parentId)

    if (!bucket || bucket.lastChild === null) {
      return
    }

    let currentId: SiblingLink = bucket.lastChild

    while (currentId !== null) {
      stack.push(currentId)
      const currentRecord = this.recordsById.get(currentId)
      currentId = currentRecord?.prevSibling ?? null
    }
  }

  private attachToParent(id: TreeStoreId, parentId: TreeStoreParentId): void {
    const childRecord = this.recordsById.get(id)

    if (!childRecord) {
      return
    }

    const bucket = this.getOrCreateBucket(this.bucketsByParent, parentId)
    const previousLast = bucket.lastChild

    childRecord.parent = parentId
    childRecord.prevSibling = previousLast
    childRecord.nextSibling = null

    if (previousLast === null) {
      bucket.firstChild = id
    } else {
      const lastRecord = this.recordsById.get(previousLast)

      if (lastRecord) {
        lastRecord.nextSibling = id
      }
    }

    bucket.lastChild = id
  }

  private detachFromParent(id: TreeStoreId, parentId: TreeStoreParentId): void {
    const bucket = this.bucketsByParent.get(parentId)
    const childRecord = this.recordsById.get(id)

    if (!bucket || !childRecord) {
      return
    }

    const previousId = childRecord.prevSibling
    const nextId = childRecord.nextSibling

    if (previousId === null) {
      bucket.firstChild = nextId
    } else {
      const previousRecord = this.recordsById.get(previousId)

      if (previousRecord) {
        previousRecord.nextSibling = nextId
      }
    }

    if (nextId === null) {
      bucket.lastChild = previousId
    } else {
      const nextRecord = this.recordsById.get(nextId)

      if (nextRecord) {
        nextRecord.prevSibling = previousId
      }
    }

    childRecord.prevSibling = null
    childRecord.nextSibling = null

    if (bucket.firstChild === null) {
      this.bucketsByParent.delete(parentId)
    }
  }

  private wouldCreateCycle(id: TreeStoreId, nextParent: TreeStoreId): boolean {
    let cursor: TreeStoreId | null = nextParent

    while (cursor !== null) {
      if (cursor === id) {
        return true
      }

      const parent: TreeStoreParentId | undefined = this.recordsById.get(cursor)?.parent
      cursor = parent ?? null
    }

    return false
  }

  private assertAcyclic(parentById: ReadonlyMap<TreeStoreId, TreeStoreParentId>): void {
    const done = new Set<TreeStoreId>()

    for (const startId of parentById.keys()) {
      if (done.has(startId)) {
        continue
      }

      const localPath = new Set<TreeStoreId>()
      const visitedInChain: TreeStoreId[] = []
      let cursor: TreeStoreId | null = startId

      while (cursor !== null && parentById.has(cursor) && !done.has(cursor)) {
        if (localPath.has(cursor)) {
          throw new TypeError('Cycle detected in tree items')
        }

        const parent: TreeStoreParentId | undefined = parentById.get(cursor)

        if (parent === cursor) {
          throw new TypeError('Self-referenced parent is not allowed')
        }

        localPath.add(cursor)
        visitedInChain.push(cursor)

        if (parent === undefined || parent === null) {
          break
        }

        cursor = parent
      }

      for (const id of visitedInChain) {
        done.add(id)
      }
    }
  }

  private assertValidItem(item: T): void {
    if (typeof item.id !== 'string' && typeof item.id !== 'number') {
      throw new TypeError('id must be string or number')
    }

    if (item.parent === undefined) {
      throw new TypeError('parent cannot be undefined')
    }

    if (item.parent !== null && typeof item.parent !== 'string' && typeof item.parent !== 'number') {
      throw new TypeError('parent must be string, number or null')
    }
  }

  private getOrCreateBucket(
    buckets: Map<TreeStoreParentId, ParentBucket>,
    parentId: TreeStoreParentId,
  ): ParentBucket {
    const existing = buckets.get(parentId)

    if (existing) {
      return existing
    }

    const created: ParentBucket = {
      firstChild: null,
      lastChild: null,
    }

    buckets.set(parentId, created)
    return created
  }

  private cloneItem(item: T): T {
    return { ...item }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
