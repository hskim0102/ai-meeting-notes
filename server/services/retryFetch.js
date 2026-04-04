/**
 * retryFetch.js - 재시도 로직 유틸리티
 * ─────────────────────────────────────────────────
 * 외부 API 호출 실패 시 exponential backoff로 재시도
 * ─────────────────────────────────────────────────
 */

/**
 * 함수를 재시도 로직과 함께 실행
 * @param {Function} fn - 실행할 async 함수 (Response 반환)
 * @param {object} options
 * @param {number} options.maxRetries - 최대 재시도 횟수 (기본 3)
 * @param {number} options.baseDelayMs - 기본 대기 시간 (기본 1000ms)
 * @returns {Promise<Response>}
 */
export async function retryFetch(fn, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn()

      // 429 (Rate Limit) 또는 5xx 서버 에러 시 재시도
      if (response && !response.ok && (response.status === 429 || response.status >= 500)) {
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          console.log(`[재시도] HTTP ${response.status} - ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      return response
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.log(`[재시도] ${err.message} - ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
