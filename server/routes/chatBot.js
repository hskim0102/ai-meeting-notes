/**
 * server/routes/chatBot.js - Dify 지식 베이스(Knowledge) API 라우트
 */

import express from 'express'

const router = express.Router()

// GET /api/chatBot/datasets - Dify 지식 리스트 조회
router.get('/datasets', async (req, res) => {
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_CHAT_API_KEY 환경 변수가 설정되지 않았습니다.',
    })
  }

  if (!apiUrl) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_API_URL 환경 변수가 설정되지 않았습니다.',
    })
  }

  const { page = 1, limit = 20 } = req.query

  try {
    const response = await fetch(`${apiUrl}/datasets?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.message || `Dify API 오류 (HTTP ${response.status})`,
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    console.error('[Dify] 지식 리스트 조회 실패:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/chatBot/datasets/:dataset_id/documents - Dify 지식 문서 리스트 조회
router.get('/datasets/:dataset_id/documents', async (req, res) => {
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_KNOWLEDGE_API_KEY 환경 변수가 설정되지 않았습니다.',
    })
  }

  if (!apiUrl) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_API_URL 환경 변수가 설정되지 않았습니다.',
    })
  }

  const { dataset_id } = req.params
  const { page = 1, limit = 20 } = req.query

  try {
    const response = await fetch(`${apiUrl}/datasets/${dataset_id}/documents?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.message || `Dify API 오류 (HTTP ${response.status})`,
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    console.error('[Dify] 문서 리스트 조회 실패:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/chatBot/datasets/:dataset_id/documents/:document_id - Dify 문서 상세 조회
router.get('/datasets/:dataset_id/documents/:document_id', async (req, res) => {
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_KNOWLEDGE_API_KEY 환경 변수가 설정되지 않았습니다.',
    })
  }

  if (!apiUrl) {
    return res.status(500).json({
      success: false,
      error: 'DIFY_API_URL 환경 변수가 설정되지 않았습니다.',
    })
  }

  const { dataset_id, document_id } = req.params

  try {
    const response = await fetch(`${apiUrl}/datasets/${dataset_id}/documents/${document_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.message || `Dify API 오류 (HTTP ${response.status})`,
      })
    }

    res.json({ success: true, data })
  } catch (err) {
    console.error('[Dify] 문서 상세 조회 실패:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
