import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
    theme: { type: [String, Object], required: false, default: undefined },
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

  it('конфигурирует колонки в порядке Категория → Наименование через auto group', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const columnDefs = grid.props('columnDefs') as Array<{ headerName: string; field?: string }>
    const autoGroupColumnDef = grid.props('autoGroupColumnDef') as { headerName: string }

    expect(columnDefs.map((column) => column.headerName)).toEqual(['Наименование'])
    expect(columnDefs[0]?.field).toBe('label')
    expect(autoGroupColumnDef.headerName).toBe('Категория')
  })

  it('включает встроенную нумерацию через rowNumbers module api', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const gridOptions = grid.props('gridOptions') as {
      rowNumbers?: {
        minWidth?: number
        width?: number
        headerComponent?: new () => {
          init?: () => void
          getGui: () => { textContent?: string | null }
        }
      }
    }

    expect(gridOptions.rowNumbers).toBeTruthy()
    expect(gridOptions.rowNumbers?.minWidth).toBeGreaterThanOrEqual(80)
    expect(gridOptions.rowNumbers?.width).toBeGreaterThanOrEqual(84)

    const HeaderComponent = gridOptions.rowNumbers?.headerComponent
    const instance = HeaderComponent ? new HeaderComponent() : null
    instance?.init?.()
    const headerElement = instance?.getGui()
    expect(headerElement?.textContent?.trim()).toBe('№ п\\п')
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

  it('задаёт row id с type-prefixed id для сохранения состояния раскрытия', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const gridOptions = grid.props('gridOptions') as {
      getRowId?: (params: { data: TreeGridRow }) => string
    }

    expect(
      gridOptions.getRowId?.({ data: { id: 1, label: 'A', category: 'Элемент', path: ['n:1'] } }),
    ).toBe('n:1')
    expect(
      gridOptions.getRowId?.({
        data: { id: '1', label: 'B', category: 'Элемент', path: ['s:1'] },
      }),
    ).toBe('s:1')
  })

  it('использует legacy theme и domLayout autoHeight', () => {
    const wrapper = mountGrid()
    const grid = wrapper.findComponent(AgGridVueStub)
    const gridOptions = grid.props('gridOptions') as {
      theme?: string
      domLayout?: string
    }

    expect(gridOptions.theme).toBe('legacy')
    expect(gridOptions.domLayout).toBe('autoHeight')
  })

  it('добавляет min-height только в loading/empty состоянии', async () => {
    const wrapper = mountGrid({ loading: true, rowData: [] })
    expect(wrapper.find('.tree-grid').classes()).toContain('tree-grid--pending')

    await wrapper.setProps({
      loading: false,
      rowData: [{ id: 1, label: 'x', category: 'Элемент', path: ['n:1'] }],
    })
    expect(wrapper.find('.tree-grid').classes()).not.toContain('tree-grid--pending')
  })
})
