import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TreeGrid from './TreeGrid.vue'
import type { TreeGridRow } from './treeGridRows.js'

const AgGridVueStub = defineComponent({
  name: 'AgGridVue',
  props: {
    rowData: { type: Array, required: true },
    loading: { type: Boolean, required: true },
    columnDefs: { type: Array, required: true },
    autoGroupColumnDef: { type: Object, required: true },
    gridOptions: { type: Object, required: true },
  },
  template: '<div data-testid="ag-grid-stub" />',
})

function mountGrid(props?: Partial<{ rowData: TreeGridRow[]; loading: boolean }>) {
  return mount(TreeGrid, {
    props: {
      rowData: [],
      loading: false,
      ...props,
    },
    global: {
      stubs: {
        AgGridVue: AgGridVueStub,
      },
    },
  })
}

describe('TreeGrid', () => {
  it('прокидывает rowData и loading в AgGridVue', () => {
    const rowData: TreeGridRow[] = [{ id: 1, label: 'Айтем 1', category: 'Элемент', path: ['n:1'] }]
    const wrapper = mountGrid({ rowData, loading: true })
    const grid = wrapper.findComponent(AgGridVueStub)

    expect(grid.props('rowData')).toEqual(rowData)
    expect(grid.props('loading')).toBe(true)
  })

  it('конфигурирует колонки строго по требованиям', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const columnDefs = grid.props('columnDefs') as Array<{
      headerName: string
      colId?: string
      valueGetter?: (params: { node: { rowIndex: number } }) => number
    }>
    const autoGroupColumnDef = grid.props('autoGroupColumnDef') as { headerName: string }

    expect(columnDefs.map((column) => column.headerName)).toEqual(['№ п/п', 'Наименование'])
    expect(autoGroupColumnDef.headerName).toBe('Категория')
    expect(typeof columnDefs[0]?.valueGetter).toBe('function')
  })

  it('нумерация видимых строк = node.rowIndex + 1', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const columnDefs = grid.props('columnDefs') as Array<{
      colId?: string
      valueGetter?: (params: { node: { rowIndex: number } }) => number
    }>
    const indexColumn = columnDefs.find((column) => column.colId === 'rowNumber')

    expect(indexColumn?.valueGetter?.({ node: { rowIndex: 0 } })).toBe(1)
    expect(indexColumn?.valueGetter?.({ node: { rowIndex: 6 } })).toBe(7)
  })

  it('refresh номера строк при expand/collapse', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const gridOptions = grid.props('gridOptions') as {
      onRowGroupOpened?: (params: { api: { refreshCells: (args: unknown) => void } }) => void
    }
    const refreshCells = vi.fn()

    gridOptions.onRowGroupOpened?.({ api: { refreshCells } })

    expect(refreshCells).toHaveBeenCalledWith({
      columns: ['rowNumber'],
      force: true,
    })
  })

  it('по умолчанию раскрывает только первый root item', () => {
    const rowData: TreeGridRow[] = [
      { id: 1, label: 'Root 1', category: 'Группа', path: ['n:1'] },
      { id: 2, label: 'Root 2', category: 'Группа', path: ['n:2'] },
      { id: 10, label: 'Child', category: 'Элемент', path: ['n:1', 'n:10'] },
    ]
    const wrapper = mountGrid({ rowData })
    const grid = wrapper.findComponent(AgGridVueStub)
    const gridOptions = grid.props('gridOptions') as {
      isGroupOpenByDefault?: (params: { rowNode: { level: number; key: string } }) => boolean
    }

    expect(
      gridOptions.isGroupOpenByDefault?.({
        rowNode: { level: 0, key: 'n:1' },
      }),
    ).toBe(true)
    expect(
      gridOptions.isGroupOpenByDefault?.({
        rowNode: { level: 0, key: 'n:2' },
      }),
    ).toBe(false)
    expect(
      gridOptions.isGroupOpenByDefault?.({
        rowNode: { level: 1, key: 'n:10' },
      }),
    ).toBe(false)
  })
})
