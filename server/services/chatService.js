/**
 * chatService.js - 회의 챗봇 서비스
 * ─────────────────────────────────────────────────
 * 단일 회의 Q&A와 전체 회의 검색 Q&A 기능을 제공하는 챗봇 서비스
 * - buildMeetingContext: 회의 데이터를 LLM context 문자열로 변환
 * - extractKeywords: 한국어 질문에서 키워드 추출
 * - askDify: Dify Workflow API를 통한 Q&A 처리
 * - chatWithMeeting: 단일 회의 기반 Q&A
 * - chatWithSearch: 전체 회의 검색 기반 Q&A
 * ─────────────────────────────────────────────────
 */

import { query } from './database.js'

// ── 챗봇 타임아웃 설정 ──
const CHAT_TIMEOUT_MS = 60_000 // 60초

// ── 한국어 불용어 목록 ──
// 자주 쓰이는 조사, 어미, 접속사 등 의미 없는 단어들
const STOP_WORDS = new Set([
  '이것은', '이것이', '이것을', '이것에', '이것으로',
  '그것은', '그것이', '그것을', '그것에',
  '저것은', '저것이', '저것을',
  '입니다', '이다', '있다', '없다', '합니다', '했습니다', '할까요',
  '무엇', '어떤', '어디', '언제', '누가', '왜', '어떻게',
  '관련', '관해', '대해', '대한', '위한', '위해',
  '그리고', '하지만', '그러나', '또한', '또는', '그래서', '따라서',
  '지난달', '지난주', '이번달', '이번주', '다음달', '다음주',
  '있나요', '있는지', '없나요', '없는지', '인가요', '인지',
  '해주세요', '알려주세요', '설명해', '말해줘',
  '어떤가요', '어떻습니까', '어땠나요',
  '무엇인가요', '무엇입니까',
])

// ── 제거할 한국어 어미/조사 접미사 패턴 ──
// 단어 끝에 붙는 조사나 어미를 제거하여 어근만 추출
const KOREAN_SUFFIXES = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로', '과', '와', '도', '만', '은?', '는?']

/**
 * 회의 데이터를 LLM 컨텍스트 문자열로 변환
 *
 * @param {object} meeting - 회의 데이터 객체
 * @param {string} meeting.title - 회의 제목
 * @param {string} meeting.ai_summary - AI 요약
 * @param {Array} meeting.transcript - 대화 기록 배열
 * @param {Array} [meeting.key_decisions] - 주요 결정사항
 * @returns {string} - LLM에 전달할 컨텍스트 문자열
 */
export function buildMeetingContext(meeting) {
  const lines = []

  // ── 회의 제목 ──
  if (meeting.title) {
    lines.push(`[회의 제목]`)
    lines.push(meeting.title)
    lines.push('')
  }

  // ── AI 요약 ──
  if (meeting.ai_summary) {
    lines.push(`[회의 요약]`)
    lines.push(meeting.ai_summary)
    lines.push('')
  }

  // ── 주요 결정사항 ──
  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    lines.push('[주요 결정사항]')
    const decisions = Array.isArray(meeting.key_decisions) ? meeting.key_decisions : []
    decisions.forEach((d, i) => {
      lines.push(`${i + 1}. ${typeof d === 'string' ? d : d.text || JSON.stringify(d)}`)
    })
    lines.push('')
  }

  // ── 대화 기록 ──
  if (meeting.transcript && meeting.transcript.length > 0) {
    lines.push('[대화 기록]')
    meeting.transcript.forEach(seg => {
      const time = seg.time || seg.timestamp || ''
      const speaker = seg.speaker || '발화자'
      const text = seg.text || ''
      lines.push(`[${time}] ${speaker}: ${text}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 한국어 질문에서 의미 있는 키워드를 추출
 *
 * @param {string} question - 사용자 질문 문자열
 * @returns {string[]} - 추출된 키워드 배열
 */
export function extractKeywords(question) {
  if (!question || typeof question !== 'string') return []

  // 특수문자 제거 후 공백으로 분리
  const words = question
    .replace(/[?!.,;:'"()\[\]{}]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const keywords = []

  for (let word of words) {
    // 2자 미만 단어 제거 (조사, 1글자 단어 등)
    if (word.length < 2) continue

    // 불용어 제거
    if (STOP_WORDS.has(word)) continue

    // 한국어 어미/조사 접미사 제거하여 어근 추출
    let root = word
    for (const suffix of KOREAN_SUFFIXES) {
      if (root.endsWith(suffix) && root.length > suffix.length + 1) {
        root = root.slice(0, -suffix.length)
        break
      }
    }

    // 접미사 제거 후 불용어 재확인
    if (STOP_WORDS.has(root)) continue

    // 최소 2자 이상인 어근만 추가
    if (root.length >= 2) {
      keywords.push(root)
    }
  }

  return keywords
}

/**
 * Dify Workflow API를 호출하여 챗봇 Q&A 처리
 *
 * @param {string} context - 회의 컨텍스트 문자열
 * @param {string} question - 사용자 질문
 * @param {Array} history - 이전 대화 기록
 * @returns {Promise<string>} - AI 응답 텍스트
 * @throws {Error} - API 오류, 타임아웃 시 에러
 */
export async function askDify(context, question, history = []) {
  // ── 환경 변수 검증 ──
  // 챗봇 전용 API 키를 우선 사용, 없으면 공통 API 키 사용
  const apiKey = process.env.DIFY_CHAT_API_KEY || process.env.DIFY_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey) {
    throw new Error(
      'DIFY_CHAT_API_KEY 또는 DIFY_API_KEY 환경 변수가 설정되지 않았습니다.'
    )
  }

  if (!apiUrl) {
    throw new Error(
      'DIFY_API_URL 환경 변수가 설정되지 않았습니다.'
    )
  }

  // ── AbortController로 타임아웃 제어 ──
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

  try {
    console.log(`[챗봇] Dify 챗봇 Q&A 요청 (질문: ${question.substring(0, 50)}...)`)

    const response = await fetch(`${apiUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          context,
          question,
          history: JSON.stringify(history),
        },
        response_mode: 'blocking',
        user: 'chatbot-user',
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // ── HTTP 에러 처리 ──
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '응답 본문 없음')
      throw new Error(`Dify API 오류 (HTTP ${response.status}): ${errorBody.substring(0, 200)}`)
    }

    const result = await response.json()

    // ── 워크플로우 실행 실패 확인 ──
    if (result.data?.status === 'failed') {
      throw new Error(`Dify 챗봇 워크플로우 실행 실패: ${result.data?.error || '알 수 없는 오류'}`)
    }

    // ── 응답 텍스트 추출 ──
    const outputs = result.data?.outputs || {}
    const answer = outputs.answer || outputs.result || outputs.text || outputs.output || ''

    console.log(`[챗봇] Dify 응답 수신 완료`)
    return typeof answer === 'string' ? answer : JSON.stringify(answer)

  } catch (error) {
    // ── 타임아웃 에러 ──
    if (error.name === 'AbortError') {
      throw new Error(`챗봇 응답 타임아웃 (${CHAT_TIMEOUT_MS / 1000}초 초과)`)
    }

    // ── 네트워크 연결 에러 ──
    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
      throw new Error(`Dify 서버에 연결할 수 없습니다 (${apiUrl})`)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 단일 회의 기반 Q&A
 * DB에서 회의를 조회하여 컨텍스트를 구성하고 Dify로 질문에 답변
 *
 * @param {number} meetingId - 회의 ID
 * @param {string} question - 사용자 질문
 * @param {Array} history - 이전 대화 기록
 * @returns {Promise<{answer: string, sources: Array}>}
 * @throws {Error} - 회의 미존재, API 오류 시 에러
 */
export async function chatWithMeeting(meetingId, question, history = []) {
  // ── DB에서 회의 조회 ──
  const rows = await query(
    `SELECT id, title, date, participants, ai_summary, key_decisions, full_text, transcript
     FROM meetings WHERE id = ?`,
    [meetingId]
  )

  if (!rows || rows.length === 0) {
    throw new Error(`회의 ID ${meetingId}를 찾을 수 없습니다.`)
  }

  const meeting = rows[0]

  // ── JSON 컬럼 파싱 ──
  const parseJsonColumn = (value) => {
    if (!value) return []
    if (typeof value === 'object') return value
    try { return JSON.parse(value) } catch { return [] }
  }

  meeting.transcript = parseJsonColumn(meeting.transcript)
  meeting.key_decisions = parseJsonColumn(meeting.key_decisions)
  meeting.participants = parseJsonColumn(meeting.participants)

  // ── full_text가 있고 transcript가 없는 경우 처리 ──
  if (meeting.transcript.length === 0 && meeting.full_text) {
    meeting.transcript = [{ speaker: '전체', time: '', text: meeting.full_text }]
  }

  // ── 컨텍스트 구성 ──
  const context = buildMeetingContext(meeting)

  // ── Dify에 질문 ──
  const answer = await askDify(context, question, history)

  return {
    answer,
    sources: [{
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
    }],
  }
}

/**
 * 전체 회의 검색 기반 Q&A
 * 질문에서 키워드를 추출하여 FULLTEXT 검색 후 관련 회의들의 컨텍스트로 답변
 *
 * @param {string} question - 사용자 질문
 * @param {Array} history - 이전 대화 기록
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function chatWithSearch(question, history = []) {
  // ── 키워드 추출 ──
  const keywords = extractKeywords(question)

  let meetings = []

  // ── FULLTEXT 검색 (키워드가 있을 때) ──
  if (keywords.length > 0) {
    const searchQuery = keywords.join(' ')
    try {
      meetings = await query(
        `SELECT id, title, date, ai_summary, key_decisions, transcript, full_text
         FROM meetings
         WHERE MATCH(title, ai_summary, full_text) AGAINST(? IN BOOLEAN MODE)
         LIMIT 5`,
        [searchQuery]
      )
    } catch (err) {
      // FULLTEXT 인덱스 없거나 실패 시 로그만 남김
      console.warn(`[챗봇] FULLTEXT 검색 실패, LIKE 검색으로 폴백: ${err.message}`)
    }

    // FULLTEXT 결과가 없으면 LIKE 검색으로 폴백
    if (!meetings || meetings.length === 0) {
      const likeConditions = keywords.map(() => '(title LIKE ? OR ai_summary LIKE ? OR full_text LIKE ?)').join(' OR ')
      const likeParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`])
      meetings = await query(
        `SELECT id, title, date, ai_summary, key_decisions, transcript, full_text
         FROM meetings
         WHERE ${likeConditions}
         LIMIT 5`,
        likeParams
      )
    }
  } else {
    // ── 키워드 없으면 최근 5개 회의 사용 ──
    meetings = await query(
      `SELECT id, title, date, ai_summary, key_decisions, transcript, full_text
       FROM meetings ORDER BY date DESC LIMIT 5`
    )
  }

  // ── 검색 결과 없으면 안내 메시지 반환 ──
  if (!meetings || meetings.length === 0) {
    return {
      answer: '관련 회의 기록을 찾을 수 없습니다. 다른 키워드로 검색해보세요.',
      sources: [],
    }
  }

  // ── 각 회의 JSON 파싱 및 컨텍스트 합산 ──
  const parseJsonColumn = (value) => {
    if (!value) return []
    if (typeof value === 'object') return value
    try { return JSON.parse(value) } catch { return [] }
  }

  const contextParts = []
  const sources = []

  for (const meeting of meetings) {
    meeting.transcript = parseJsonColumn(meeting.transcript)
    meeting.key_decisions = parseJsonColumn(meeting.key_decisions)

    if (meeting.transcript.length === 0 && meeting.full_text) {
      meeting.transcript = [{ speaker: '전체', time: '', text: meeting.full_text }]
    }

    contextParts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    contextParts.push(buildMeetingContext(meeting))

    sources.push({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
    })
  }

  const combinedContext = contextParts.join('\n')

  // ── Dify에 질문 ──
  const answer = await askDify(combinedContext, question, history)

  return { answer, sources }
}
