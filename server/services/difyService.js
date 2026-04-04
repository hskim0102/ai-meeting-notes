/**
 * difyService.js - Dify 워크플로우 API 연동 서비스
 * ─────────────────────────────────────────────────
 * STT로 병합된 전체 회의 스크립트(Transcript)를 Dify 워크플로우에
 * 전송하여 AI 요약(TL;DR, 액션 아이템, 키워드 등)을 생성하는 서비스
 *
 * [보안]
 * - DIFY_API_KEY는 서버 사이드 환경 변수로만 관리
 * - 클라이언트(브라우저)에 절대 노출되지 않음
 * ─────────────────────────────────────────────────
 */

import { retryFetch } from './retryFetch.js'

// ── Dify API 타임아웃 설정 ──
// LLM 응답은 긴 텍스트 처리 시 수십 초가 걸릴 수 있으므로 넉넉하게 설정
const DIFY_TIMEOUT_MS = 120_000 // 120초 (2분)

/**
 * Dify 워크플로우 API를 호출하여 회의록 텍스트를 AI로 요약
 *
 * [Dify Workflow API 규격]
 * - 엔드포인트: POST {DIFY_API_URL}/workflows/run
 * - 인증: Bearer 토큰 (DIFY_API_KEY)
 * - 페이로드: { inputs, response_mode, user }
 * - 응답 모드: "blocking" (결과가 올 때까지 대기)
 *
 * @param {string} transcript - STT에서 병합된 전체 회의 스크립트 텍스트
 * @returns {Promise<object>} - 구조화된 요약 결과
 *   {
 *     summary: string,          // TL;DR 요약
 *     actionItems: Array,       // 액션 아이템 목록
 *     keywords: Array,          // 핵심 키워드
 *     keyDecisions: Array,      // 주요 결정 사항
 *     sentiment: string,        // 회의 분위기
 *     raw: object               // Dify 원본 응답 (디버깅용)
 *   }
 * @throws {Error} - API 키 미설정, 타임아웃, 서버 오류 시 에러
 */
export async function summarizeWithDify(transcript) {
  // ── 1단계: 환경 변수 검증 ──
  // API 키와 URL이 서버 환경 변수에 설정되어 있는지 확인
  const apiKey = process.env.DIFY_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey) {
    throw new Error(
      'DIFY_API_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env 파일에 DIFY_API_KEY=app-xxxx 형식으로 추가해주세요.'
    )
  }

  if (!apiUrl) {
    throw new Error(
      'DIFY_API_URL 환경 변수가 설정되지 않았습니다. ' +
      '.env 파일에 DIFY_API_URL=https://api.dify.ai/v1 형식으로 추가해주세요.'
    )
  }

  // ── 2단계: 입력 텍스트 검증 ──
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    throw new Error('요약할 회의 스크립트가 비어있습니다.')
  }

  console.log(`[Dify] 워크플로우 요약 요청 시작 (텍스트 길이: ${transcript.length}자)`)

  // ── 3단계: Dify Workflow API 요청 구성 ──
  // AbortController를 사용하여 타임아웃 제어
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DIFY_TIMEOUT_MS)

  try {
    // ── 4단계: Dify 워크플로우 API 호출 ──
    const response = await retryFetch(
      () => fetch(`${apiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          // Bearer 토큰 인증 (서버 사이드에서만 사용)
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Dify 워크플로우 입력 변수 (워크플로우에서 정의한 입력 필드와 매칭)
          inputs: {
            transcript: transcript,
          },
          // "blocking": 워크플로우 완료까지 동기적으로 대기 후 결과 반환
          response_mode: 'blocking',
          // 사용자 식별자 (Dify 대시보드에서 로그 추적용)
          user: 'dx-member',
        }),
        signal: controller.signal,
      }),
      { maxRetries: 2, baseDelayMs: 2000 }
    )

    // ── 타임아웃 타이머 해제 (정상 응답 수신 시) ──
    clearTimeout(timeoutId)

    // ── 5단계: HTTP 응답 상태 확인 및 에러 처리 ──
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '응답 본문 없음')

      // HTTP 상태 코드별 명확한 에러 메시지
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Dify API 인증 실패. DIFY_API_KEY가 올바른지 확인해주세요. ' +
          `(HTTP ${response.status})`
        )
      }
      if (response.status === 404) {
        throw new Error(
          'Dify 워크플로우를 찾을 수 없습니다. DIFY_API_URL과 워크플로우 설정을 확인해주세요. ' +
          `(HTTP 404)`
        )
      }
      if (response.status === 429) {
        throw new Error(
          'Dify API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요. ' +
          `(HTTP 429)`
        )
      }
      if (response.status >= 500) {
        throw new Error(
          `Dify 서버에서 오류가 발생했습니다. (HTTP ${response.status}): ${errorBody.substring(0, 200)}`
        )
      }

      throw new Error(
        `Dify API 요청 실패 (HTTP ${response.status}): ${errorBody.substring(0, 200)}`
      )
    }

    // ── 6단계: 응답 JSON 파싱 ──
    const result = await response.json()
    console.log(`[Dify] 워크플로우 응답 수신 (status: ${result.data?.status || 'unknown'})`)

    // ── 워크플로우 실행 실패 확인 ──
    if (result.data?.status === 'failed') {
      throw new Error(
        `Dify 워크플로우 실행 실패: ${result.data?.error || '알 수 없는 오류'}`
      )
    }

    // ── 7단계: Dify 응답을 프론트엔드 렌더링에 적합한 구조로 변환 ──
    const structured = parseWorkflowOutput(result)

    const summaryPreview = typeof structured.summary === 'string'
      ? structured.summary.substring(0, 50)
      : JSON.stringify(structured.summary).substring(0, 50)
    console.log(`[Dify] 요약 완료 - 요약: ${summaryPreview}...`)
    return structured

  } catch (error) {
    // ── 타임아웃 에러 처리 ──
    if (error.name === 'AbortError') {
      throw new Error(
        `Dify 워크플로우 응답 타임아웃 (${DIFY_TIMEOUT_MS / 1000}초 초과). ` +
        '회의록이 너무 길거나 Dify 서버가 응답하지 않습니다.'
      )
    }

    // ── 네트워크 연결 에러 처리 ──
    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
      throw new Error(
        `Dify 서버에 연결할 수 없습니다 (${apiUrl}). ` +
        'DIFY_API_URL이 올바른지, Dify 서버가 실행 중인지 확인해주세요.'
      )
    }

    // 이미 가공된 에러 메시지는 그대로 전달
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Dify 워크플로우 원본 응답을 프론트엔드 렌더링용 구조로 변환
 *
 * [Dify Workflow 응답 구조]
 * {
 *   "data": {
 *     "outputs": {
 *       "result": "{ ... JSON 또는 텍스트 ... }"
 *     },
 *     "status": "succeeded"
 *   }
 * }
 *
 * Dify 워크플로우의 출력 형태에 따라 두 가지 파싱 전략을 적용:
 * 1. outputs.result가 JSON 문자열인 경우 → 파싱하여 필드 추출
 * 2. outputs에 개별 필드(summary, action_items 등)가 있는 경우 → 직접 매핑
 *
 * @param {object} difyResponse - Dify API 원본 응답
 * @returns {object} - 구조화된 요약 결과
 */
function parseWorkflowOutput(difyResponse) {
  const outputs = difyResponse?.data?.outputs || {}

  // ── 전략 1: outputs.result가 JSON 문자열인 경우 ──
  // Dify 워크플로우에서 LLM 출력을 하나의 "result" 필드로 내보내는 경우
  if (outputs.result && typeof outputs.result === 'string') {
    try {
      const parsed = JSON.parse(outputs.result)
      return {
        summary: ensureString(parsed.summary || parsed.tldr || parsed.tl_dr || ''),
        actionItems: normalizeActionItems(parsed.action_items || parsed.actionItems || parsed.actions || []),
        keywords: normalizeArray(parsed.keywords || parsed.tags || []),
        keyDecisions: normalizeArray(parsed.key_decisions || parsed.keyDecisions || parsed.decisions || []),
        sentiment: parsed.sentiment || parsed.mood || 'neutral',
        raw: difyResponse,
      }
    } catch {
      // JSON 파싱 실패 → result를 요약 텍스트로 간주
      return {
        summary: outputs.result,
        actionItems: [],
        keywords: [],
        keyDecisions: [],
        sentiment: 'neutral',
        raw: difyResponse,
      }
    }
  }

  // ── 전략 2: outputs에 개별 필드가 있는 경우 ──
  // Dify 워크플로우에서 각 출력을 별도 변수로 내보내는 경우
  return {
    summary: ensureString(outputs.summary || outputs.tldr || outputs.tl_dr || outputs.text || ''),
    actionItems: normalizeActionItems(
      tryParseJSON(outputs.action_items) ||
      tryParseJSON(outputs.actionItems) ||
      []
    ),
    keywords: normalizeArray(
      tryParseJSON(outputs.keywords) ||
      tryParseJSON(outputs.tags) ||
      []
    ),
    keyDecisions: normalizeArray(
      tryParseJSON(outputs.key_decisions) ||
      tryParseJSON(outputs.keyDecisions) ||
      tryParseJSON(outputs.decisions) ||
      []
    ),
    sentiment: outputs.sentiment || outputs.mood || 'neutral',
    raw: difyResponse,
  }
}

/**
 * 액션 아이템 배열을 프론트엔드 렌더링 형식으로 정규화
 * Dify에서 다양한 형태(문자열 배열, 객체 배열)로 올 수 있으므로 통일
 *
 * @param {Array} items - 원본 액션 아이템 배열
 * @returns {Array<{text: string, assignee: string, dueDate: string, done: boolean}>}
 */
function normalizeActionItems(items) {
  if (!Array.isArray(items)) return []

  return items.map((item, index) => {
    // 문자열인 경우: 텍스트만 있는 액션 아이템
    if (typeof item === 'string') {
      return {
        text: item,
        assignee: '',
        dueDate: '',
        done: false,
      }
    }

    // 객체인 경우: 필드를 매핑
    return {
      text: item.text || item.task || item.content || item.description || `액션 아이템 ${index + 1}`,
      assignee: item.assignee || item.owner || item.person || '',
      dueDate: item.dueDate || item.due_date || item.deadline || '',
      done: false,
    }
  })
}

/**
 * 다양한 형태의 배열을 문자열 배열로 정규화
 * @param {*} input - 문자열 배열, 콤마 구분 문자열, 또는 기타
 * @returns {string[]}
 */
function normalizeArray(input) {
  if (Array.isArray(input)) return input.map(String)
  if (typeof input === 'string') {
    // 콤마 구분 문자열을 배열로 변환
    return input.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * 값이 문자열이 아닌 경우 JSON 문자열로 변환
 * Dify에서 summary가 객체로 반환되는 경우를 처리
 * @param {*} value - 변환 대상
 * @returns {string}
 */
function ensureString(value) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return JSON.stringify(value)
}

/**
 * 문자열이 JSON인 경우 파싱, 아니면 원본 반환
 * @param {*} value - 파싱 대상
 * @returns {*} - 파싱된 값 또는 원본
 */
function tryParseJSON(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
