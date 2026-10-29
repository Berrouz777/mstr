import type { TreeStoreItem } from '../domain/tree-store/index.js'

export type TreeGridCategory = 'Группа' | 'Элемент'

export type TreeGridRow = {
  id: TreeStoreItem['id']
  label: string
  category: TreeGridCategory
  path: string[]
}

type IdPart = string

export function toTypedTreeGridId(id: TreeStoreItem['id']): IdPart {
  return typeof id === 'number' ? `n:${id}` : `s:${id}`
}

export function buildTreeGridRows<T extends TreeStoreItem & { label: string }>(
  items: readonly T[],
): TreeGridRow[] {
  const childrenByParent = new Map<TreeStoreItem['parent'], T[]>()
  const itemById = new Map<TreeStoreItem['id'], T>()

  for (const item of items) {
    itemById.set(item.id, item)
    const siblings = childrenByParent.get(item.parent)

    if (siblings) {
      siblings.push(item)
    } else {
      childrenByParent.set(item.parent, [item])
    }
  }

  const rows: TreeGridRow[] = []

  for (const item of items) {
    const path: string[] = []
    let current: T | undefined = item

    while (current) {
      path.push(toTypedTreeGridId(current.id))

      if (current.parent === null) {
        break
      }

      current = itemById.get(current.parent)
    }

    path.reverse()

    const hasChildren = (childrenByParent.get(item.id)?.length ?? 0) > 0

    rows.push({
      id: item.id,
      label: item.label,
      category: hasChildren ? 'Группа' : 'Элемент',
      path,
    })
  }

  return rows
}
