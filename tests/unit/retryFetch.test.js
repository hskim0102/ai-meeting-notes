import { describe, it, expect, vi } from 'vitest'
import { retryFetch } from '../../server/services/retryFetch.js'

describe('retryFetch', () => {
  it('성공 시 즉시 결과를 반환한다', async () => {
    const mockFn = vi.fn().mockResolvedValue({ ok: true, json: () => ({ data: 'test' }) })

    const result = await retryFetch(mockFn)

    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('실패 후 재시도하여 성공한다', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true })

    const result = await retryFetch(mockFn, { maxRetries: 3, baseDelayMs: 10 })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it('최대 재시도 횟수 초과 시 에러를 던진다', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('persistent error'))

    await expect(
      retryFetch(mockFn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow('persistent error')

    expect(mockFn).toHaveBeenCalledTimes(3) // 초기 1회 + 재시도 2회
  })

  it('429 응답 시 재시도한다', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true })

    const result = await retryFetch(mockFn, { maxRetries: 2, baseDelayMs: 10 })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })
})
