/**
 * keywords.js - AI 키워드 추출 API 라우트
 * ─────────────────────────────────────────────────
 * POST /api/keywords/extract - STT 텍스트에서 키워드 추출
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { extractKeywords } from '../services/keywordService.js'
import { validate, keywordExtractSchema } from '../services/validators.js'

const router = Router()

router.post('/extract', validate(keywordExtractSchema), async (req, res) => {
  try {
    const { text } = req.body
    const keywords = await extractKeywords(text)

    res.json({
      success: true,
      data: { keywords },
    })
  } catch (error) {
    console.error(`[키워드 추출 오류] ${error.message}`)

    let statusCode = 500
    if (error.message.includes('환경 변수')) statusCode = 503
    if (error.message.includes('파싱')) statusCode = 502

    res.status(statusCode).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
