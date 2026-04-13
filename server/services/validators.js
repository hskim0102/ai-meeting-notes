/**
 * validators.js - API 요청 입력 검증 (Zod)
 * ─────────────────────────────────────────────────
 */

import { z } from 'zod'

export const chatQuestionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요.').max(2000, '질문이 너무 깁니다 (최대 2000자).'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
})

export const summarizeSchema = z.object({
  transcript: z.string().min(1, '요약할 텍스트가 비어있습니다.').max(500000, '텍스트가 너무 깁니다.'),
})

export const keywordExtractSchema = z.object({
  text: z.string().min(1, '텍스트가 비어있습니다.').max(500000, '텍스트가 너무 깁니다.'),
})

export const transcriptCorrectionSchema = z.object({
  fullText: z.string().min(1),
  segments: z.array(z.object({
    id: z.number().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    text: z.string(),
    speaker: z.string().optional(),
  })),
  corrections: z.array(z.object({
    original: z.string().min(1, '원본 키워드가 비어있습니다.'),
    corrected: z.string().min(1, '수정 키워드가 비어있습니다.'),
  })).min(1, '교정 항목이 필요합니다.'),
})

/**
 * Zod 스키마로 req.body를 검증하는 Express 미들웨어 팩토리
 * @param {z.ZodSchema} schema
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ')
      return res.status(400).json({ success: false, error: message })
    }
    req.body = result.data
    next()
  }
}
