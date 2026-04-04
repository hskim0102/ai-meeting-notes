import { Router } from 'express'
import { chatWithMeeting, chatWithSearch } from '../services/chatService.js'
import { validate, chatQuestionSchema } from '../services/validators.js'

const router = Router()

// POST /api/chat/meeting/:id - 단일 회의 Q&A
router.post('/meeting/:id', validate(chatQuestionSchema), async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id, 10)
    if (isNaN(meetingId)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 회의 ID입니다.' })
    }
    const { question, history } = req.body
    const result = await chatWithMeeting(meetingId, question.trim(), history)
    res.json({ success: true, data: result })
  } catch (err) {
    console.error(`[챗봇 오류] 단일 회의 Q&A: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/chat/search - 전체 회의 검색 Q&A
router.post('/search', validate(chatQuestionSchema), async (req, res) => {
  try {
    const { question, history } = req.body
    const result = await chatWithSearch(question.trim(), history)
    res.json({ success: true, data: result })
  } catch (err) {
    console.error(`[챗봇 오류] 전체 검색 Q&A: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
