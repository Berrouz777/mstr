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

  it('не resolve после 2000ms, если fetch всё ещё pending; fetch и таймер стартуют сразу параллельно', async () => {
    vi.useFakeTimers()
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn(() => deferred.promise)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    vi.stubGlobal('fetch', fetchMock)

    const promise = loadItems<TestItem>()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/data/items.json')
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000)

    let settled = false
    void promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()
    expect(settled).toBe(false)

    deferred.resolve(
      new Response(
        JSON.stringify([{ id: 1, parent: null, label: 'Айтем 1' }] satisfies TestItem[]),
        {
          status: 200,
          statusText: 'OK',
        },
      ),
    )
    await Promise.resolve()

    const result = await promise
    expect(result).toHaveLength(1)
  })

  it('reject при сетевой ошибке fetch', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(() => Promise.reject(new Error('Network down')))

    vi.stubGlobal('fetch', fetchMock)

    const promise = loadItems<TestItem>()
    const assertion = expect(promise).rejects.toThrow('Network down')
    await assertion
  })

  it('reject при невалидном JSON в успешном ответе', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(
      async () =>
        new Response('{broken-json', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const promise = loadItems<TestItem>()
    const assertion = expect(promise).rejects.toBeInstanceOf(SyntaxError)
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
  })
})
