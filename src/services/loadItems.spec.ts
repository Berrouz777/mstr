import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadItems } from './loadItems.js'

type TestItem = {
  id: string | number
  parent: string | number | null
  label: string
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

describe('loadItems', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('загружает /data/items.json и ждёт минимум 2000ms', async () => {
    vi.useFakeTimers()
    const expected: TestItem[] = [{ id: 1, parent: null, label: 'Айтем 1' }]
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn(() => deferred.promise)

    vi.stubGlobal('fetch', fetchMock)

    const promise = loadItems<TestItem>()
    expect(fetchMock).toHaveBeenCalledWith('/data/items.json')

    deferred.resolve(
      new Response(JSON.stringify(expected), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await Promise.resolve()

    let settled = false
    void promise.then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(1999)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const result = await promise
    const typedResult: TestItem[] = result

    expect(typedResult).toEqual(expected)
  })

  it('reject при response.ok=false с понятной ошибкой', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500, statusText: 'Error' }))

    vi.stubGlobal('fetch', fetchMock)

    const promise = loadItems<TestItem>()
    const assertion = expect(promise).rejects.toThrow('Failed to load /data/items.json: 500 Error')
    await vi.advanceTimersByTimeAsync(2000)

    await assertion
  })
})
