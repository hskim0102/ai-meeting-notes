/**
 * server/routes/search.js - 회의 통합 검색 API
 * ─────────────────────────────────────────────────
 * MySQL DB 기반 검색 (FULLTEXT + LIKE)
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { query } from '../services/database.js'

const router = Router()

// ── 헬퍼: DB 행 → API 응답 형식 변환 ──
function formatMeeting(row) {
  const parseJson = (val) => {
    if (!val) return []
    if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
    return val
  }

  return {
    id: row.id,
    title: row.title,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    time: row.time,
    duration: row.duration,
    participants: parseJson(row.participants),
    status: row.status,
    tags: parseJson(row.tags),
    aiSummary: row.ai_summary || '',
    keyDecisions: parseJson(row.key_decisions),
    actionItems: parseJson(row.action_items),
    sentiment: row.sentiment,
    transcript: parseJson(row.transcript),
  }
}

// ── 검색 가중치 ──
const WEIGHTS = {
  title: 3.0,
  tags: 2.5,
  aiSummary: 2.0,
  actionItems: 1.5,
  participants: 1.5,
  transcript: 1.0,
}

function countMatches(text, q) {
  if (!text || !q) return 0
  const lower = text.toLowerCase()
  const ql = q.toLowerCase()
  let count = 0, pos = 0
  while ((pos = lower.indexOf(ql, pos)) !== -1) { count++; pos += ql.length }
  return count
}

function extractSnippet(text, q, ctx = 40) {
  if (!text || !q) return null
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - ctx)
  const end = Math.min(text.length, idx + q.length + ctx)
  let s = ''
  if (start > 0) s += '...'
  s += text.slice(start, end)
  if (end < text.length) s += '...'
  return s
}

// ── 통합 검색 API ──
router.get('/', async (req, res) => {
  try {
    const { q, from, to, participants, tags, sort = 'relevance', page = '1', limit = '20' } = req.query

    if (!q && !from && !to && !participants && !tags) {
      return res.status(400).json({ success: false, error: '검색 조건이 필요합니다.' })
    }

    // DB에서 후보 회의 조회
    let sql = 'SELECT * FROM meetings WHERE 1=1'
    const params = []

    // 날짜 범위 필터
    if (from) { sql += ' AND date >= ?'; params.push(from) }
    if (to) { sql += ' AND date <= ?'; params.push(to) }

    // 키워드 검색 (DB LIKE 프리필터)
    if (q) {
      sql += ' AND (title LIKE ? OR ai_summary LIKE ? OR full_text LIKE ? OR action_items LIKE ? OR participants LIKE ? OR tags LIKE ? OR key_decisions LIKE ?)'
      const likeQ = `%${q}%`
      params.push(likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ)
    }

    sql += ' ORDER BY date DESC'
    const rows = await query(sql, params)

    // 포맷 변환 + 관련도 점수 계산
    let results = rows.map(row => {
      const meeting = formatMeeting(row)
      let score = 0
      const snippets = []

      if (q) {
        const tm = countMatches(meeting.title, q)
        if (tm > 0) { score += tm * WEIGHTS.title; snippets.push({ field: '제목', text: meeting.title }) }

        if (meeting.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))) score += WEIGHTS.tags

        const sm = countMatches(meeting.aiSummary, q)
        if (sm > 0) { score += sm * WEIGHTS.aiSummary; snippets.push({ field: '요약', text: extractSnippet(meeting.aiSummary, q) }) }

        for (const item of meeting.actionItems) {
          if (countMatches(item.text, q) > 0) {
            score += WEIGHTS.actionItems
            snippets.push({ field: '액션아이템', text: item.text })
          }
        }

        if (meeting.participants.some(p => p.toLowerCase().includes(q.toLowerCase()))) score += WEIGHTS.participants

        for (const seg of meeting.transcript) {
          if (countMatches(seg.text, q) > 0) {
            score += WEIGHTS.transcript
            snippets.push({ field: '발언', text: extractSnippet(seg.text, q), speaker: seg.speaker, time: seg.time })
          }
        }

        for (const dec of meeting.keyDecisions) {
          if (countMatches(dec, q) > 0) {
            score += WEIGHTS.aiSummary
            snippets.push({ field: '결정사항', text: dec })
          }
        }
      } else {
        score = 1 // 필터 검색 시 기본 점수
      }

      return { ...meeting, score, snippets }
    })

    // 키워드 검색 시 점수 0인 결과 제거
    if (q) results = results.filter(r => r.score > 0)

    // 참석자 필터 (앱 레벨)
    if (participants) {
      const pList = participants.split(',').map(p => p.trim().toLowerCase())
      results = results.filter(r =>
        pList.some(p => r.participants.some(rp => rp.toLowerCase().includes(p)))
      )
    }

    // 태그 필터
    if (tags) {
      const tList = tags.split(',').map(t => t.trim().toLowerCase())
      results = results.filter(r =>
        tList.some(t => r.tags.some(rt => rt.toLowerCase() === t))
      )
    }

    // 정렬
    if (sort === 'relevance') results.sort((a, b) => b.score - a.score)
    else if (sort === 'newest') results.sort((a, b) => b.date.localeCompare(a.date))
    else if (sort === 'oldest') results.sort((a, b) => a.date.localeCompare(b.date))

    // 페이지네이션
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const startIdx = (pageNum - 1) * limitNum
    const paged = results.slice(startIdx, startIdx + limitNum)

    res.json({
      success: true,
      data: { results: paged, total: results.length, page: pageNum, totalPages: Math.ceil(results.length / limitNum) },
    })
  } catch (err) {
    console.error('[검색 에러]', err.message)
    res.status(500).json({ success: false, error: '검색 처리 실패' })
  }
})

// ── 자동완성 제안 API ──
router.get('/suggest', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] })
    }

    const suggestions = []
    const likeQ = `%${q}%`

    // 제목에서 제안
    const titleRows = await query('SELECT id, title FROM meetings WHERE title LIKE ? LIMIT 5', [likeQ])
    for (const row of titleRows) {
      suggestions.push({ type: 'meeting', text: row.title, id: row.id })
    }

    // 태그에서 제안 — JSON 배열 내 검색
    const tagRows = await query('SELECT DISTINCT tags FROM meetings WHERE tags LIKE ?', [likeQ])
    const seenTags = new Set()
    for (const row of tagRows) {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || [])
      for (const tag of tags) {
        if (tag.toLowerCase().includes(q.toLowerCase()) && !seenTags.has(tag)) {
          seenTags.add(tag)
          suggestions.push({ type: 'tag', text: tag })
        }
      }
    }

    // 참석자에서 제안
    const partRows = await query('SELECT DISTINCT participants FROM meetings WHERE participants LIKE ?', [likeQ])
    const seenParts = new Set()
    for (const row of partRows) {
      const parts = typeof row.participants === 'string' ? JSON.parse(row.participants) : (row.participants || [])
      for (const p of parts) {
        if (p.toLowerCase().includes(q.toLowerCase()) && !seenParts.has(p)) {
          seenParts.add(p)
          suggestions.push({ type: 'participant', text: p })
        }
      }
    }

    res.json({ success: true, data: suggestions.slice(0, 10) })
  } catch (err) {
    console.error('[자동완성 에러]', err.message)
    res.status(500).json({ success: false, error: '자동완성 실패' })
  }
})

export default router
