import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { useTreeStore } from './useTreeStore.js'

type TestItem = {
  id: string | number
  parent: string | number | null
  label: string
}

describe('useTreeStore', () => {
  it('создаёт отдельный пустой TreeStore на каждый вызов', () => {
    const scope = effectScope()
    const first = scope.run(() => useTreeStore<TestItem>())
    const second = scope.run(() => useTreeStore<TestItem>())

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first?.store).not.toBe(second?.store)
    expect(first?.items.value).toEqual([])
    expect(second?.items.value).toEqual([])

    scope.stop()
  })

  it('реактивно обновляет items на set/add/update/remove', () => {
    const scope = effectScope()
    const state = scope.run(() => useTreeStore<TestItem>())

    expect(state).toBeDefined()
    if (!state) {
      throw new Error('scope.run returned undefined')
    }

    state.store.setItems([{ id: 1, parent: null, label: 'Айтем 1' }])
    expect(state.items.value.map((item) => item.id)).toEqual([1])

    state.store.addItem({ id: 2, parent: 1, label: 'Айтем 2' })
    expect(state.items.value.map((item) => item.id)).toEqual([1, 2])

    state.store.updateItem(2, { label: 'Айтем 2+' })
    expect(state.items.value.find((item) => item.id === 2)?.label).toBe('Айтем 2+')

    state.store.removeItem(2)
    expect(state.items.value.map((item) => item.id)).toEqual([1])

    scope.stop()
  })

  it('отписывается через onScopeDispose', () => {
    const scope = effectScope()
    const state = scope.run(() => useTreeStore<TestItem>())

    expect(state).toBeDefined()
    if (!state) {
      throw new Error('scope.run returned undefined')
    }

    state.store.addItem({ id: 1, parent: null, label: 'Айтем 1' })
    expect(state.items.value.map((item) => item.id)).toEqual([1])

    scope.stop()

    state.store.addItem({ id: 2, parent: null, label: 'Айтем 2' })
    expect(state.items.value.map((item) => item.id)).toEqual([1])
  })
})
