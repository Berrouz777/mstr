import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

vi.mock('./components/TreeGrid.vue', () => {
  return {
    default: defineComponent({
      name: 'TreeGrid',
      props: {
        rowData: { type: Array, required: true },
        loading: { type: Boolean, required: true },
      },
      template: '<div data-testid="tree-grid-stub"></div>',
    }),
  }
})

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('показывает loading, затем передаёт загруженные строки в TreeGrid реактивно', async () => {
    vi.useFakeTimers()
    const items = [
      { id: 1, parent: null, label: 'Айтем 1' },
      { id: '2', parent: 1, label: 'Айтем 2' },
    ]
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(items), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App)
    const treeGrid = wrapper.findComponent({ name: 'TreeGrid' })

    expect(treeGrid.exists()).toBe(true)
    expect(treeGrid.props('loading')).toBe(true)
    expect(treeGrid.props('rowData')).toEqual([])

    await vi.advanceTimersByTimeAsync(1999)
    await flushPromises()
    expect(treeGrid.props('loading')).toBe(true)
    expect(treeGrid.props('rowData')).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/data/items.json')
    expect(treeGrid.props('loading')).toBe(false)
    expect(treeGrid.props('rowData')).toEqual([
      { id: 1, label: 'Айтем 1', category: 'Группа', path: ['n:1'] },
      { id: '2', label: 'Айтем 2', category: 'Элемент', path: ['n:1', 's:2'] },
    ])
  })
})
