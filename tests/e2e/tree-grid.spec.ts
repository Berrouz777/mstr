import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

const LICENSE_BANNER_RE = /(license key|evaluation|AG Grid Enterprise)/i
const AG_GRID_BLOCKER_RE = /AG Grid: error #(200|239)/i

async function getVisibleRowNumbers(pinnedRows: Locator): Promise<number[]> {
  const numbersText = await pinnedRows.locator('.ag-cell-value').allTextContents()

  return numbersText.map((text) => Number(text.trim()))
}

test('tree grid smoke: загрузка, порядок колонок, нумерация и console clean', async ({ page }) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (text.length > 0) {
      consoleMessages.push(text)
    }
  })

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Пример отображения в полностью развернутом виде:' }),
  ).toBeVisible()
  await expect(page.locator('.ag-overlay-loading-center')).toBeVisible()

  await expect(page.locator('.ag-overlay-loading-center')).toBeHidden({ timeout: 5000 })
  const rowLocators = page.locator('.ag-center-cols-container .ag-row')
  const pinnedRowLocators = page.locator('.ag-pinned-left-cols-container .ag-row')
  await expect(rowLocators).toHaveCount(3)

  const headerTexts = await page.locator('.ag-header-cell-text').allTextContents()
  expect(headerTexts.map((text) => text.trim()).filter(Boolean)).toEqual([
    '№ п\\п',
    'Категория',
    'Наименование',
  ])

  const initialRows: Array<{ cells: string[] }> = []
  const initialCount = await rowLocators.count()
  for (let index = 0; index < initialCount; index += 1) {
    const cells = await rowLocators.nth(index).locator('.ag-cell-value').allTextContents()
    initialRows.push({ cells: cells.map((text) => text.trim()) })
  }

  expect(await getVisibleRowNumbers(pinnedRowLocators)).toEqual([1, 2, 3])
  expect(initialRows.map((row) => row.cells[1])).toEqual(['Айтем 1', 'Айтем 2', 'Айтем 3'])

  await rowLocators.filter({ hasText: 'Айтем 2' }).locator('.ag-group-contracted').click()
  await rowLocators.filter({ hasText: 'Айтем 4' }).locator('.ag-group-contracted').click()

  await expect(rowLocators).toHaveCount(8)

  const expandedRows: Array<{ cells: string[] }> = []
  const expandedCount = await rowLocators.count()
  for (let index = 0; index < expandedCount; index += 1) {
    const cells = await rowLocators.nth(index).locator('.ag-cell-value').allTextContents()
    expandedRows.push({ cells: cells.map((text) => text.trim()) })
  }

  expect(await getVisibleRowNumbers(pinnedRowLocators)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  expect(expandedRows.map((row) => row.cells[1])).toEqual([
    'Айтем 1',
    'Айтем 2',
    'Айтем 4',
    'Айтем 7',
    'Айтем 8',
    'Айтем 5',
    'Айтем 6',
    'Айтем 3',
  ])

  await rowLocators.filter({ hasText: 'Айтем 2' }).locator('.ag-group-expanded').click()
  await expect(rowLocators).toHaveCount(3)

  const collapsedRows: Array<{ cells: string[] }> = []
  const collapsedCount = await rowLocators.count()
  for (let index = 0; index < collapsedCount; index += 1) {
    const cells = await rowLocators.nth(index).locator('.ag-cell-value').allTextContents()
    collapsedRows.push({ cells: cells.map((text) => text.trim()) })
  }
  expect(await getVisibleRowNumbers(pinnedRowLocators)).toEqual([1, 2, 3])

  const blockingMessages = consoleMessages.filter(
    (text) =>
      AG_GRID_BLOCKER_RE.test(text) || (/AG Grid/i.test(text) && !LICENSE_BANNER_RE.test(text)),
  )
  expect(blockingMessages).toEqual([])
})
