<script setup lang="ts">
import { computed } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import {
  ClientSideRowModelModule,
  ModuleRegistry,
  type ColDef,
  type GetDataPath,
  type GridOptions,
  type IHeaderComp,
  type IsGroupOpenByDefaultParams,
  type RowNumbersOptions,
} from 'ag-grid-community'
import { RowGroupingModule, RowNumbersModule, TreeDataModule } from 'ag-grid-enterprise'
import { toTypedTreeGridId, type TreeGridRow } from './treeGridRows.js'

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowGroupingModule,
  TreeDataModule,
  RowNumbersModule,
])

const props = defineProps<{
  rowData: TreeGridRow[]
  loading: boolean
}>()

const isPending = computed(() => props.loading || props.rowData.length === 0)
const firstRootKey = computed(
  () => props.rowData.find((row) => row.path.length === 1)?.path[0] ?? null,
)

class RowNumberHeaderComponent implements IHeaderComp {
  private readonly gui: HTMLSpanElement = document.createElement('span')

  public init(): void {
    this.gui.className = 'ag-header-cell-text'
    this.gui.textContent = '№ п/п'
  }

  public getGui(): HTMLElement {
    return this.gui
  }

  public refresh(): boolean {
    return false
  }
}

const rowNumbers: RowNumbersOptions = {
  minWidth: 92,
  width: 92,
  maxWidth: 92,
  resizable: false,
  headerComponent: RowNumberHeaderComponent,
}

const columnDefs: ColDef<TreeGridRow>[] = [
  {
    headerName: 'Наименование',
    field: 'label',
    minWidth: 220,
    flex: 2,
    sortable: false,
    filter: false,
    editable: false,
    suppressHeaderMenuButton: true,
  },
]

const autoGroupColumnDef: ColDef<TreeGridRow> = {
  headerName: 'Категория',
  minWidth: 180,
  flex: 1,
  sortable: false,
  filter: false,
  editable: false,
  suppressHeaderMenuButton: true,
  valueGetter: (params) => params.data?.category ?? '',
  cellRendererParams: {
    suppressCount: true,
  },
}

const getDataPath: GetDataPath<TreeGridRow> = (data) => data.path

const gridOptions: GridOptions<TreeGridRow> = {
  treeData: true,
  theme: 'legacy',
  domLayout: 'autoHeight',
  animateRows: false,
  rowNumbers,
  suppressCellFocus: true,
  suppressContextMenu: true,
  ensureDomOrder: true,
  getRowId: (params) => toTypedTreeGridId(params.data.id),
  defaultColDef: {
    sortable: false,
    filter: false,
    editable: false,
    resizable: false,
    suppressHeaderMenuButton: true,
  },
  isGroupOpenByDefault: (params: IsGroupOpenByDefaultParams<TreeGridRow>) => {
    const key = firstRootKey.value

    return params.rowNode.level === 0 && key !== null && params.rowNode.key === key
  },
}
</script>

<template>
  <div class="tree-grid" :class="{ 'tree-grid--pending': isPending }">
    <AgGridVue
      class="ag-theme-alpine tree-grid__table"
      :row-data="rowData"
      :column-defs="columnDefs"
      :auto-group-column-def="autoGroupColumnDef"
      :get-data-path="getDataPath"
      :grid-options="gridOptions"
      :loading="loading"
    />
  </div>
</template>
