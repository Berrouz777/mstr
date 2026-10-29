<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TreeGrid from './components/TreeGrid.vue'
import { buildTreeGridRows } from './components/treeGridRows.js'
import { useTreeStore } from './composables/useTreeStore.js'
import { loadItems } from './services/loadItems.js'

type AppTreeItem = {
  id: string | number
  parent: string | number | null
  label: string
}

const { store, items } = useTreeStore<AppTreeItem>()
const loading = ref(true)
const rowData = computed(() => buildTreeGridRows(items.value))

onMounted(async () => {
  loading.value = true

  try {
    const loadedItems = await loadItems<AppTreeItem>()
    store.setItems(loadedItems)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="page">
    <h1 class="page__title">Пример отображения в полностью развернутом виде:</h1>
    <section class="page__grid-wrap">
      <TreeGrid :row-data="rowData" :loading="loading" />
    </section>
  </main>
</template>
