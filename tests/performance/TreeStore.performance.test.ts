import { describe, expect, it } from 'vitest'
import { TreeStore } from '../../src/domain/tree-store/index.js'

type PerfItem = {
  id: number
  parent: number | null
  value: string
}

describe('TreeStore performance correctness', () => {
  it('обходит большое дерево и корректно удаляет поддерево', () => {
    const levels = 5
    const width = 6
    const items: PerfItem[] = []
    let nextId = 1
    let layer: number[] = []

    for (let index = 0; index < width; index += 1) {
      const id = nextId
      nextId += 1
      items.push({ id, parent: null, value: `root-${id}` })
      layer.push(id)
    }

    for (let level = 1; level < levels; level += 1) {
      const nextLayer: number[] = []

      for (const parentId of layer) {
        for (let branch = 0; branch < width; branch += 1) {
          const id = nextId
          nextId += 1
          items.push({ id, parent: parentId, value: `n-${id}` })
          nextLayer.push(id)
        }
      }

      layer = nextLayer
    }

    const store = new TreeStore<PerfItem>(items)
    const roots = store.getChildren(null)
    const firstRootId = roots[0]?.id

    expect(firstRootId).toBeDefined()

    const firstRootDescendants = store.getAllChildren(firstRootId!)
    expect(firstRootDescendants.length).toBeGreaterThan(0)
    expect(firstRootDescendants.length).toBeLessThan(items.length)

    store.removeItem(firstRootId!)

    expect(store.getItem(firstRootId!)).toBeUndefined()
    expect(store.getAll().length).toBe(items.length - (firstRootDescendants.length + 1))
  })
})
