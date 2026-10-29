import { effectScope, isReadonly, nextTick, watch, watchEffect } from 'vue'
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

  it('revision стартует с 0 и растёт ровно на 1 на set/add/update/remove', () => {
    const scope = effectScope()
    const state = scope.run(() => useTreeStore<TestItem>())

    expect(state).toBeDefined()
    if (!state) {
      throw new Error('scope.run returned undefined')
    }

    expect(state.revision.value).toBe(0)

    state.store.setItems([{ id: 1, parent: null, label: 'Айтем 1' }])
    expect(state.revision.value).toBe(1)

    state.store.addItem({ id: 2, parent: 1, label: 'Айтем 2' })
    expect(state.revision.value).toBe(2)

    state.store.updateItem(2, { label: 'Айтем 2+' })
    expect(state.revision.value).toBe(3)

    state.store.removeItem(2)
    expect(state.revision.value).toBe(4)

    scope.stop()
  })

  it('watchEffect/watch срабатывают повторно на каждую мутацию', async () => {
    const scope = effectScope()
    const state = scope.run(() => useTreeStore<TestItem>())

    expect(state).toBeDefined()
    if (!state) {
      throw new Error('scope.run returned undefined')
    }

    let effectRuns = 0
    let watchRuns = 0

    const stopEffect = watchEffect(() => {
      void state.items.value.length
      effectRuns += 1
    })
    const stopWatch = watch(
      () => state.revision.value,
      () => {
        watchRuns += 1
      },
    )

    expect(effectRuns).toBe(1)
    expect(watchRuns).toBe(0)

    state.store.setItems([{ id: 1, parent: null, label: 'Айтем 1' }])
    await nextTick()
    expect(effectRuns).toBe(2)
    expect(watchRuns).toBe(1)

    state.store.addItem({ id: 2, parent: 1, label: 'Айтем 2' })
    await nextTick()
    expect(effectRuns).toBe(3)
    expect(watchRuns).toBe(2)

    state.store.updateItem(2, { label: 'Айтем 2+' })
    await nextTick()
    expect(effectRuns).toBe(4)
    expect(watchRuns).toBe(3)

    state.store.removeItem(2)
    await nextTick()
    expect(effectRuns).toBe(5)
    expect(watchRuns).toBe(4)

    stopEffect()
    stopWatch()
    scope.stop()
  })

  it('возвращает readonly refs для items и revision', () => {
    const scope = effectScope()
    const state = scope.run(() => useTreeStore<TestItem>())

    expect(state).toBeDefined()
    if (!state) {
      throw new Error('scope.run returned undefined')
    }

    expect(isReadonly(state.items)).toBe(true)
    expect(isReadonly(state.revision)).toBe(true)

    scope.stop()
  })

  it('после scope.stop не обновляются items, revision и эффекты; инстансы изолированы', async () => {
    const scopeA = effectScope()
    const scopeB = effectScope()
    const first = scopeA.run(() => useTreeStore<TestItem>())
    const second = scopeB.run(() => useTreeStore<TestItem>())

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) {
      throw new Error('scope.run returned undefined')
    }

    let firstEffectRuns = 0
    let secondEffectRuns = 0

    const stopFirstEffect = watchEffect(() => {
      void first.items.value.length
      void first.revision.value
      firstEffectRuns += 1
    })
    const stopSecondEffect = watchEffect(() => {
      void second.items.value.length
      void second.revision.value
      secondEffectRuns += 1
    })

    first.store.setItems([{ id: 1, parent: null, label: 'A1' }])
    await nextTick()
    expect(first.items.value.map((item) => item.id)).toEqual([1])
    expect(first.revision.value).toBe(1)
    expect(firstEffectRuns).toBe(2)
    expect(second.items.value).toEqual([])
    expect(second.revision.value).toBe(0)
    expect(secondEffectRuns).toBe(1)

    scopeA.stop()

    first.store.addItem({ id: 2, parent: null, label: 'A2' })
    await nextTick()
    expect(first.items.value.map((item) => item.id)).toEqual([1])
    expect(first.revision.value).toBe(1)
    expect(firstEffectRuns).toBe(2)

    second.store.setItems([{ id: 10, parent: null, label: 'B1' }])
    await nextTick()
    expect(second.items.value.map((item) => item.id)).toEqual([10])
    expect(second.revision.value).toBe(1)
    expect(secondEffectRuns).toBe(2)

    stopFirstEffect()
    stopSecondEffect()
    scopeB.stop()
  })
})
