/**
 * summarize.js - 회의록 AI 요약 API 라우트
 * ─────────────────────────────────────────────────
 * POST /api/summarize
 *
 * [처리 흐름]
 * 1. 클라이언트에서 전사된 회의 스크립트(fullText) 수신
 * 2. Dify 워크플로우 API 호출 (서버 사이드 - API 키 비노출)
 * 3. 구조화된 요약 결과 반환 (TL;DR, 액션 아이템, 키워드)
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { summarizeWithDify } from '../services/difyService.js'

const router = Router()

// ─────────────────────────────────────────────────
// POST /api/summarize - 회의록 요약 엔드포인트
// ─────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    // ── 1단계: 요청 본문에서 전사 텍스트 추출 ──
    const { transcript } = req.body

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '요약할 회의 스크립트(transcript)가 전송되지 않았습니다.',
      })
    }

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`[요약] 요청 수신: ${transcript.length}자`)
    console.log(`${'─'.repeat(50)}`)

    // ── 2단계: Dify 워크플로우 API 호출 (서버 사이드) ──
    // API 키는 process.env에서만 접근 → 브라우저에 절대 노출 안 됨
    const summary = await summarizeWithDify(transcript)

    // ── 3단계: 성공 응답 반환 ──
    console.log(`[요약] 완료 - 요약 ${summary.summary.length}자, 액션 ${summary.actionItems.length}개, 키워드 ${summary.keywords.length}개`)

    res.json({
      success: true,
      data: {
        summary: summary.summary,
        actionItems: summary.actionItems,
        keywords: summary.keywords,
        keyDecisions: summary.keyDecisions,
        sentiment: summary.sentiment,
      },
    })
  } catch (error) {
    console.error(`[요약 오류] ${error.message}`)

    // ── Dify 관련 에러에 맞는 HTTP 상태 코드 반환 ──
    let statusCode = 500
    if (error.message.includes('환경 변수가 설정되지 않았습니다')) statusCode = 503
    if (error.message.includes('인증 실패')) statusCode = 401
    if (error.message.includes('요청 한도를 초과')) statusCode = 429
    if (error.message.includes('타임아웃')) statusCode = 504

    res.status(statusCode).json({
      success: false,
      error: error.message,
    })
  }
})

// ─────────────────────────────────────────────────
// GET /api/summarize/health - 요약 서비스 헬스체크
// ─────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'summarize',
    difyConfigured: !!(process.env.DIFY_API_KEY && process.env.DIFY_API_URL),
    timestamp: new Date().toISOString(),
  })
})

export default router
