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

  it('выполняет итеративный preorder для глубокой цепочки без переполнения стека', () => {
    const depth = 12_000
    const items: TestItem[] = []

    for (let index = 0; index < depth; index += 1) {
      items.push({
        id: index,
        parent: index === 0 ? null : index - 1,
        title: `node-${index}`,
      })
    }

    const store = new TreeStore<TestItem>(items)
    const allChildren = store.getAllChildren(0)

    expect(allChildren).toHaveLength(depth - 1)
    expect(allChildren[0]?.id).toBe(1)
    expect(allChildren[allChildren.length - 1]?.id).toBe(depth - 1)
  })

  it('getAllChildren имеет visited-defense и завершается даже при внутреннем цикле', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root', parent: null, title: 'root' },
      { id: 'a', parent: 'root', title: 'a' },
      { id: 'b', parent: 'a', title: 'b' },
    ])
    const hacked = store as unknown as {
      recordsById: Map<
        string | number,
        { prevSibling: string | number | null; nextSibling: string | number | null }
      >
      bucketsByParent: Map<
        string | number | null,
        { firstChild: string | number | null; lastChild: string | number | null }
      >
    }
    const a = hacked.recordsById.get('a')
    const b = hacked.recordsById.get('b')

    expect(a).toBeDefined()
    expect(b).toBeDefined()

    if (a && b) {
      a.prevSibling = 'b'
      b.prevSibling = 'a'
      hacked.bucketsByParent.set('root', { firstChild: 'a', lastChild: 'b' })
    }

    const result = store.getAllChildren('root')

    expect(result.map((item) => item.id)).toEqual(['a', 'b'])
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

  it('setItems отклоняет циклы и самоссылки атомарно', () => {
    const store = new TreeStore<TestItem>(createItems())
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() =>
      store.setItems([
        { id: 'a', parent: 'b', title: 'a' },
        { id: 'b', parent: 'a', title: 'b' },
      ]),
    ).toThrow(TypeError)

    expect(() => store.setItems([{ id: 'x', parent: 'x', title: 'x' }])).toThrow(TypeError)
    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
    expect(listener).not.toHaveBeenCalled()
  })

  it('addItem добавляет в конец sibling-ов и бросает TypeError на duplicate id', () => {
    const store = new TreeStore<TestItem>(createItems())

    store.addItem({ id: 5, parent: 1, title: 'child-5' })
    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2', 5])

    store.addItem({ id: 'new-root', parent: null, title: 'new-root' })
    expect(store.getChildren(null).map((item) => item.id)).toEqual([1, '1', 'new-root'])

    expect(() => store.addItem({ id: 5, parent: null, title: 'duplicate' })).toThrow(TypeError)
  })

  it('addItem отклоняет самоссылку атомарно и без уведомления', () => {
    const store = new TreeStore<TestItem>(createItems())
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() => store.addItem({ id: 'self', parent: 'self', title: 'self' })).toThrow(TypeError)
    expect(store.getItem('self')).toBeUndefined()
    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
    expect(listener).not.toHaveBeenCalled()
  })

  it('addItem отклоняет цикл с orphan child, указывающим на добавляемый id', () => {
    const store = new TreeStore<TestItem>([
      { id: 'child', parent: 'future', title: 'orphan-child' },
      { id: 'root', parent: null, title: 'root' },
    ])
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() => store.addItem({ id: 'future', parent: 'child', title: 'future' })).toThrow(
      TypeError,
    )
    expect(store.getItem('future')).toBeUndefined()
    expect(store.getAll().map((item) => item.id)).toEqual(['child', 'root'])
    expect(listener).not.toHaveBeenCalled()
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

  it('updateItem с parent null переносит узел в корни в конец', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root-a', parent: null, title: 'root-a' },
      { id: 'root-b', parent: null, title: 'root-b' },
      { id: 'a-1', parent: 'root-a', title: 'a-1' },
    ])

    store.updateItem('a-1', { parent: null })

    expect(store.getChildren('root-a')).toEqual([])
    expect(store.getChildren(null).map((item) => item.id)).toEqual(['root-a', 'root-b', 'a-1'])
  })

  it('updateItem при том же parent сохраняет позицию среди siblings', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root', parent: null, title: 'root' },
      { id: 'a', parent: 'root', title: 'a' },
      { id: 'b', parent: 'root', title: 'b' },
      { id: 'c', parent: 'root', title: 'c' },
    ])

    store.updateItem('b', { parent: 'root', title: 'b2' })

    expect(store.getChildren('root').map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(store.getItem('b')?.title).toBe('b2')
  })

  it('updateItem отклоняет parent undefined атомарно', () => {
    const store = new TreeStore<TestItem>(createItems())
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() => store.updateItem(2, { parent: undefined })).toThrow(TypeError)
    expect(store.getItem(2)?.parent).toBe(1)
    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2'])
    expect(listener).not.toHaveBeenCalled()
  })

  it('updateItem запрещает parent под самого себя и потомка', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root', parent: null, title: 'root' },
      { id: 'child', parent: 'root', title: 'child' },
      { id: 'leaf', parent: 'child', title: 'leaf' },
    ])
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() => store.updateItem('child', { parent: 'child' })).toThrow(TypeError)
    expect(() => store.updateItem('child', { parent: 'leaf' })).toThrow(TypeError)

    expect(store.getAllParents('leaf').map((item) => item.id)).toEqual(['leaf', 'child', 'root'])
    expect(listener).not.toHaveBeenCalled()
  })

  it('updateItem игнорирует id в patch и не меняет identity', () => {
    const store = new TreeStore<TestItem>([{ id: 'node', parent: null, title: 'before' }])
    store.updateItem('node', { id: 'other-id', title: 'after' } as Partial<TestItem>)

    expect(store.getItem('node')).toEqual({ id: 'node', parent: null, title: 'after' })
    expect(store.getItem('other-id')).toBeUndefined()
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

  it('removeItem уведомляет один раз при удалении subtree', () => {
    const store = new TreeStore<TestItem>([
      { id: 'root', parent: null, title: 'root' },
      { id: 'a', parent: 'root', title: 'a' },
      { id: 'b', parent: 'root', title: 'b' },
      { id: 'a1', parent: 'a', title: 'a1' },
      { id: 'a2', parent: 'a', title: 'a2' },
    ])
    const listener = vi.fn()
    store.subscribe(listener)

    store.removeItem('a')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getChildren('root').map((item) => item.id)).toEqual(['b'])
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

  it('subscribe не уведомляет при duplicate/errors и unsubscribe идемпотентен', () => {
    const store = new TreeStore<TestItem>(createItems())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    expect(() => store.addItem({ id: 1, parent: null, title: 'dup' })).toThrow(TypeError)
    expect(() => store.setItems([{ id: 'x', parent: 'x', title: 'cycle' }])).toThrow(TypeError)
    expect(() => store.updateItem(1, { parent: undefined })).toThrow(TypeError)

    expect(listener).not.toHaveBeenCalled()

    unsubscribe()
    unsubscribe()
    store.addItem({ id: 'after', parent: null, title: 'after' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('клонирует items на входе/выходе и защищает индексы от внешней мутации полей', () => {
    const source = createItems()
    const store = new TreeStore<TestItem>()

    store.setItems(source)
    expect(source[0]).toBeDefined()
    source[0]!.title = 'mutated-externally'
    source.push({ id: 999, parent: null, title: 'external' })

    const all = store.getAll()
    const children = store.getChildren(1)
    const descendants = store.getAllChildren(1)
    const parents = store.getAllParents(3)

    all.pop()
    children.pop()
    descendants.pop()
    parents.pop()
    expect(all[0]).toBeDefined()
    all[0]!.title = 'mutated-return'
    const root = store.getItem(1)

    if (root) {
      root.title = 'mutated-single-item'
    }

    expect(store.getAll().map((item) => item.id)).toEqual([1, '1', 2, '2', 3, 4])
    expect(store.getItem(1)?.title).toBe('root-number')
    expect(store.getChildren(1).map((item) => item.id)).toEqual([2, '2'])
    expect(store.getAllChildren(1).map((item) => item.id)).toEqual([2, 3, '2'])
    expect(store.getAllParents(3).map((item) => item.id)).toEqual([3, 2, 1])
  })

  it('компилируется с обычным interface без index signature', () => {
    interface PlainItem {
      id: string | number
      parent: string | number | null
      label: string
    }

    const store = new TreeStore<PlainItem>([{ id: 'p1', parent: null, label: 'plain' }])

    expect(store.getItem('p1')?.label).toBe('plain')
  })
})
