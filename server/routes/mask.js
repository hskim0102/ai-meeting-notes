/**
 * server/routes/mask.js - 마스킹 서비스 상태 확인 라우트
 * ─────────────────────────────────────────────────
 * 실제 마스킹은 회의 저장/수정 시 서버에서 비동기로 자동 처리됩니다.
 * (server/routes/meetings.js 의 triggerMaskingAsync 참조)
 *
 * 이 라우터는 Dify 마스킹 서비스 환경변수 설정 여부를 확인하는
 * 헬스체크 엔드포인트만 제공합니다.
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'

const router = Router()

/**
 * GET /api/mask/health
 * Dify 마스킹 서비스 환경변수 설정 상태 확인
 */
router.get('/health', (_req, res) => {
  const configured = !!(process.env.DIFY_MASK_API_KEY && process.env.DIFY_API_URL)
  res.json({
    success: true,
    configured,
    message: configured
      ? '마스킹 서비스 설정됨'
      : 'DIFY_MASK_API_KEY 또는 DIFY_API_URL 미설정',
  })
})

export default router
