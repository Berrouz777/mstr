<script setup lang="ts">
import { computed } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import {
  ClientSideRowModelModule,
  ModuleRegistry,
  type ColDef,
  type GetDataPath,
  type GridOptions,
  type IsGroupOpenByDefaultParams,
  type RowGroupOpenedEvent,
  type ValueGetterParams,
} from 'ag-grid-community'
import { RowGroupingModule } from 'ag-grid-enterprise'
import type { TreeGridRow } from './treeGridRows.js'

ModuleRegistry.registerModules([ClientSideRowModelModule, RowGroupingModule])

const props = defineProps<{
  rowData: TreeGridRow[]
  loading: boolean
}>()

const firstRootKey = computed(
  () => props.rowData.find((row) => row.path.length === 1)?.path[0] ?? null,
)

const columnDefs: ColDef<TreeGridRow>[] = [
  {
    headerName: '№ п/п',
    colId: 'rowNumber',
    width: 84,
    minWidth: 84,
    maxWidth: 84,
    sortable: false,
    filter: false,
    editable: false,
    suppressHeaderMenuButton: true,
    valueGetter: (params: ValueGetterParams<TreeGridRow>) => {
      const rowIndex = params.node?.rowIndex

      return typeof rowIndex === 'number' ? rowIndex + 1 : ''
    },
  },
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
  animateRows: false,
  suppressCellFocus: true,
  suppressContextMenu: true,
  ensureDomOrder: true,
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
  onRowGroupOpened: (event: RowGroupOpenedEvent<TreeGridRow>) => {
    event.api.refreshCells({
      columns: ['rowNumber'],
      force: true,
    })
  },
}
</script>

<template>
  <div class="tree-grid">
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
