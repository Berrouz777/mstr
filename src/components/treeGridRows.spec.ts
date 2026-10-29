import { describe, expect, it } from 'vitest'
import { buildTreeGridRows } from './treeGridRows.js'

describe('buildTreeGridRows', () => {
  it('строит типобезопасные path для number и string id без конфликтов', () => {
    const rows = buildTreeGridRows([
      { id: 1, parent: null, label: 'n-root' },
      { id: '1', parent: null, label: 's-root' },
      { id: 2, parent: 1, label: 'n-child' },
      { id: '2', parent: '1', label: 's-child' },
    ])

    expect(rows.map((row) => row.path)).toEqual([['n:1'], ['s:1'], ['n:1', 'n:2'], ['s:1', 's:2']])
  })

  it('сохраняет sibling order и поддерживает произвольную глубину', () => {
    const rows = buildTreeGridRows([
      { id: 10, parent: null, label: 'root-1' },
      { id: 20, parent: null, label: 'root-2' },
      { id: 11, parent: 10, label: 'child-a' },
      { id: 12, parent: 10, label: 'child-b' },
      { id: 13, parent: 12, label: 'deep-1' },
      { id: 14, parent: 13, label: 'deep-2' },
      { id: 21, parent: 20, label: 'child-c' },
    ])

    expect(rows.map((row) => row.label)).toEqual([
      'root-1',
      'root-2',
      'child-a',
      'child-b',
      'deep-1',
      'deep-2',
      'child-c',
    ])
    expect(rows.find((row) => row.label === 'deep-2')?.path).toEqual([
      'n:10',
      'n:12',
      'n:13',
      'n:14',
    ])
  })

  it('категория "Группа" только для item с прямыми детьми', () => {
    const rows = buildTreeGridRows([
      { id: 1, parent: null, label: 'root' },
      { id: 2, parent: 1, label: 'child' },
      { id: 3, parent: 2, label: 'leaf' },
    ])

    expect(rows.map((row) => [row.label, row.category])).toEqual([
      ['root', 'Группа'],
      ['child', 'Группа'],
      ['leaf', 'Элемент'],
    ])
  })
})
