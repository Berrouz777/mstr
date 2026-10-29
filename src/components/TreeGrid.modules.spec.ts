import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const registerModulesSpy = vi.fn()

vi.mock('ag-grid-community', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ag-grid-community')>()

  return {
    ...actual,
    ModuleRegistry: {
      ...actual.ModuleRegistry,
      registerModules: registerModulesSpy,
    },
  }
})

describe('TreeGrid module registration', () => {
  it('регистрирует TreeDataModule и RowNumbersModule для enterprise tree data', async () => {
    const enterprise = await import('ag-grid-enterprise')
    const component = await import('./TreeGrid.vue')
    mount(component.default, {
      props: {
        rowData: [],
        loading: false,
      },
      global: {
        stubs: {
          AgGridVue: {
            template: '<div />',
          },
        },
      },
    })

    expect(registerModulesSpy).toHaveBeenCalled()
    const args = registerModulesSpy.mock.calls[0]?.[0] as unknown[]

    expect(args).toContain(enterprise.TreeDataModule)
    expect(args).toContain(enterprise.RowNumbersModule)
  })
})
