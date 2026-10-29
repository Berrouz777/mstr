import { describe, expect, it, vi } from 'vitest'
import { TreeStore } from './index.js'

type TestItem = {
  id: string | number
  parent: string | number | null
  title: string
  tags?: string[]
}

function createItems(): TestItem[] {
  return [
    { id: 1, parent: null, title: 'root-number' },
    { id: '1', parent: null, title: 'root-string' },
    { id: 2, parent: 1, title: 'child-2' },
    { id: '2', parent: 1, title: 'child-string-2' },
    { id: 3, parent: 2, title: 'leaf-3' },
    { id: 4, parent: '1', title: 'child-4' },
  ]
}

describe('TreeStore', () => {
  it('возвращает элементы и различает numeric/string ID', () => {
    const store = new TreeStore<TestItem>(createItems())

    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
    expect(store.getItem(1)?.title).toBe('root-number')
    expect(store.getItem('1')?.title).toBe('root-string')
    expect(store.getItem('missing')).toBeUndefined()
  })

  it('возвращает детей в стабильном порядке и [] для неизвестного родителя', () => {
    const store = new TreeStore<TestItem>(createItems())

    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2'])
    expect(store.getChildren('1').map((item) => item.id)).toEqual([4])
    expect(store.getChildren('unknown')).toEqual([])
  })

  it('обходит поддерево в preorder без исходного узла', () => {
    const store = new TreeStore<TestItem>(createItems())

    expect(store.getAllChildren(1).map((item) => item.id)).toEqual([2, 3, '2'])
    expect(store.getAllChildren('1').map((item) => item.id)).toEqual([4])
    expect(store.getAllChildren('unknown')).toEqual([])
  })

  it('возвращает цепочку родителей [self, parent, ..., root]', () => {
    const store = new TreeStore<TestItem>(createItems())

    expect(store.getAllParents(3).map((item) => item.id)).toEqual([3, 2, 1])
    expect(store.getAllParents(4).map((item) => item.id)).toEqual([4, '1'])
    expect(store.getAllParents('unknown')).toEqual([])
  })

  it('setItems валидирует duplicate id и не портит существующее состояние', () => {
    const store = new TreeStore<TestItem>(createItems())

    expect(() =>
      store.setItems([
        { id: 'x', parent: null, title: 'x' },
        { id: 'x', parent: null, title: 'x-dup' },
      ]),
    ).toThrow(TypeError)

    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
  })

  it('addItem добавляет в конец sibling-ов и бросает TypeError на duplicate id', () => {
    const store = new TreeStore<TestItem>(createItems())

    store.addItem({ id: 5, parent: 1, title: 'child-5' })
    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2', 5])

    store.addItem({ id: 'new-root', parent: null, title: 'new-root' })
    expect(store.getChildren(null).map((item) => item.id)).toEqual([1, '1', 'new-root'])

    expect(() => store.addItem({ id: 5, parent: null, title: 'duplicate' })).toThrow(TypeError)
  })

  it('updateItem делает merge, сохраняет id и поддерживает перенос parent в конец нового списка', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root-a', parent: null, title: 'root-a' },
      { id: 'root-b', parent: null, title: 'root-b' },
      { id: 'a-1', parent: 'root-a', title: 'a-1' },
      { id: 'a-2', parent: 'root-a', title: 'a-2' },
      { id: 'b-1', parent: 'root-b', title: 'b-1' },
    ])

    store.updateItem('a-1', { title: 'a-1-updated', parent: 'root-b' })

    expect(store.getItem('a-1')).toEqual({
      id: 'a-1',
      parent: 'root-b',
      title: 'a-1-updated',
    })
    expect(store.getChildren('root-a').map((item) => item.id)).toEqual(['a-2'])
    expect(store.getChildren('root-b').map((item) => item.id)).toEqual(['b-1', 'a-1'])
  })

  it('updateItem/removeItem для неизвестного id являются no-op', () => {
    const store = new TreeStore<TestItem>(createItems())

    store.updateItem('missing', { title: 'will-not-apply' })
    store.removeItem('missing')

    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
  })

  it('removeItem удаляет весь subtree', () => {
    const store = new TreeStore<TestItem>(createItems())

    store.removeItem(2)

    expect(store.getItem(2)).toBeUndefined()
    expect(store.getItem(3)).toBeUndefined()
    expect(store.getChildren(1).map((item) => item.id)).toEqual(['2'])
    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', '2', 4])
  })

  it('subscribe уведомляет один раз на успешную мутацию и поддерживает unsubscribe', () => {
    const store = new TreeStore<TestItem>()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.setItems(createItems())
    store.addItem({ id: 'new-child', parent: 1, title: 'new-child' })
    store.updateItem('new-child', { title: 'new-child-updated' })
    store.removeItem('new-child')
    store.updateItem('missing', { title: 'noop' })
    store.removeItem('missing')

    expect(listener).toHaveBeenCalledTimes(4)

    unsubscribe()
    store.addItem({ id: 'post-unsub', parent: null, title: 'post-unsub' })

    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('возвращаемые массивы из get* и входной массив setItems защищают индексы от внешней мутации', () => {
    const source = createItems()
    const store = new TreeStore<TestItem>()

    store.setItems(source)
    source.push({ id: 999, parent: null, title: 'external' })

    const all = store.getAll()
    const children = store.getChildren(1)
    const descendants = store.getAllChildren(1)
    const parents = store.getAllParents(3)

    all.pop()
    children.pop()
    descendants.pop()
    parents.pop()

    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2'])
    expect(store.getAllChildren(1).map((item) => item.id)).toEqual([2, 3, '2'])
    expect(store.getAllParents(3).map((item) => item.id)).toEqual([3, 2, 1])
  })
})
