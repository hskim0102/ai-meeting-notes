/**
 * keywordService.js - AI 키워드 추출 서비스
 * ─────────────────────────────────────────────────
 * OpenAI GPT-4o-mini를 사용하여 STT 텍스트에서
 * 주요 명사, 인명, 전문 용어를 자동 추출
 * ─────────────────────────────────────────────────
 */

import OpenAI from 'openai'

// ── OpenAI 클라이언트 지연 초기화 (whisperService와 동일 패턴) ──
let _openai = null
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// 텍스트가 너무 길면 앞부분만 사용 (비용 절감)
const MAX_INPUT_CHARS = 8000

/**
 * STT 텍스트에서 주요 키워드를 AI로 추출
 * @param {string} text - STT 전사 텍스트
 * @returns {Promise<string[]>} - 추출된 키워드 배열
 */
export async function extractKeywords(text) {
  const openai = getOpenAI()

  const truncated = text.length > MAX_INPUT_CHARS
    ? text.slice(0, MAX_INPUT_CHARS) + '\n...(이하 생략)'
    : text

  console.log(`[키워드 추출] 텍스트 ${text.length}자 → ${truncated.length}자 전송`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 한국어 회의록 분석 전문가입니다.
주어진 회의록 텍스트에서 다음 유형의 핵심 키워드를 10~15개 추출하세요:
- 참석자 이름 (인명)
- 프로젝트명, 제품명
- 전문 용어, 기술 용어
- 고빈도 핵심 명사 (2글자 이상)

반드시 2글자 이상의 단어만 추출하세요. 조사, 접속사, 일반 동사는 제외합니다.
JSON 형식으로 반환: { "keywords": ["키워드1", "키워드2", ...] }`,
      },
      {
        role: 'user',
        content: truncated,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  })

  const content = response.choices[0]?.message?.content || '{}'

  try {
    const parsed = JSON.parse(content)
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : []
    console.log(`[키워드 추출] 완료: ${keywords.length}개 - ${keywords.join(', ')}`)
    return keywords.filter(k => typeof k === 'string' && k.length >= 2)
  } catch (e) {
    console.error('[키워드 추출] JSON 파싱 실패:', content)
    throw new Error('키워드 추출 결과 파싱에 실패했습니다.')
  }
}
