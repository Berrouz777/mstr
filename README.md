# MStroy Frontend Test Task

Vue 3 + TypeScript приложение с производительным `TreeStore` и древовидной таблицей на AG Grid Enterprise Tree Data.

## Требования

- Node.js `>=20.19.0` (рекомендуется Node.js 22 LTS / `>=22.12`)
- npm 10+

## Быстрый старт

```bash
npm ci
npm run dev
```

Приложение доступно на `http://localhost:5173`.

Первые ~2 секунды таблица показывает loading overlay (runtime `fetch` + искусственная задержка), затем данные появляются без перезагрузки страницы.

## Скрипты

| Команда                    | Назначение                           |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | Локальный dev-сервер                 |
| `npm run build`            | Typecheck + production-сборка        |
| `npm run typecheck`        | Строгая проверка типов app/node/test |
| `npm run lint`             | ESLint                               |
| `npm run format:check`     | Prettier check                       |
| `npm test`                 | Unit/component тесты                 |
| `npm run test:performance` | Performance/correctness suite        |
| `npm run test:e2e`         | Playwright smoke на реальном AG Grid |

Для e2e один раз установите браузер Playwright:

```bash
npx playwright install chromium
```

## Архитектура

```text
src/
  domain/tree-store/   # независимый TreeStore (экспорт для автотестов)
  services/            # runtime fetch JSON
  composables/         # Vue-адаптер подписки на TreeStore
  components/          # AG Grid Tree Data UI
public/data/items.json # данные ТЗ, не импортируются в бандл
```

### TreeStore

Публичный экспорт: `src/domain/tree-store`.

Контракт:

- ID строго различаются: `1 !== '1'`
- порядок корней/соседей = порядок входного массива
- `getAllChildren` — итеративный preorder DFS без исходного элемента
- `getAllParents` — `[self, parent, ..., root]`
- `updateItem` — merge без смены `id`; `parent` можно менять
- `removeItem` — каскадное удаление поддерева
- `subscribe` — уведомление после успешной мутации

Сложность (целевая):

- `getItem` — O(1)
- `getChildren` — O(k)
- `setItems` — O(n)
- `addItem` / `updateItem` (reparent) / `removeItem` — O(размер затрагиваемого поддерева) за счёт linked-sibling индексов

### Загрузка данных

`loadItems()`:

1. параллельно запускает `fetch('/data/items.json')` и таймер 2000 мс;
2. ждёт оба Promise;
3. возвращает typed items;
4. `App` вызывает `store.setItems(...)`, таблица обновляется реактивно.

### UI

- официальный `<AgGridVue />`
- AG Grid Enterprise Tree Data в evaluation-режиме (license warning допустим)
- колонки: `№ п\п` → `Категория` → `Наименование`
- после загрузки раскрыт только первый корневой item
- номер строки = позиция среди текущих видимых строк
- сортировка / фильтры / редактирование / меню отключены

## Допущения

- входные данные валидны для happy-path ТЗ; store дополнительно защищён от циклов/дубликатов и выдаёт `TypeError`
- UI-мутации (CRUD-кнопки) не требуются: мутации покрыты API и тестами
- обработка UI-ошибок загрузки не требуется по ТЗ

## AG Grid License

Используется AG Grid Enterprise evaluation. В консоли может появляться баннер отсутствия license key — это ожидаемо для тестового задания.
