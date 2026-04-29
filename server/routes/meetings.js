/**
 * server/routes/meetings.js - 회의 CRUD API
 * ─────────────────────────────────────────────────
 * MySQL DB 기반 회의 데이터 관리
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import nodemailer from 'nodemailer'
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
    speakerMap: (() => {
      if (!row.speaker_map) return null
      if (typeof row.speaker_map === 'string') { try { return JSON.parse(row.speaker_map) } catch { return null } }
      return row.speaker_map
    })(),
    createdAt: row.created_at,
  }
}

// ── 회의 목록 조회 ──
router.get('/', async (req, res) => {
  try {
    const { status, page, limit } = req.query
    let sql = 'SELECT * FROM meetings'
    const params = []

    if (status) { sql += ' WHERE status = ?'; params.push(status) }
    sql += ' ORDER BY date DESC, time DESC'

    const rows = await query(sql, params)

    // limit이 지정된 경우에만 페이지네이션 적용
    let data = rows
    const pageNum = parseInt(page || '1', 10)
    if (limit) {
      const limitNum = parseInt(limit, 10)
      const startIdx = (pageNum - 1) * limitNum
      data = rows.slice(startIdx, startIdx + limitNum)
    }

    res.json({
      success: true,
      data: data.map(formatMeeting),
      total: rows.length,
      page: pageNum,
    })
  } catch (err) {
    console.error('[회의 목록 에러]', err.message)
    res.status(500).json({ success: false, error: '회의 목록 조회 실패' })
  }
})

// ── 통계 조회 (대시보드용) ──
router.get('/stats', async (req, res) => {
  try {
    const [totalRow] = await query('SELECT COUNT(*) as cnt FROM meetings')
    const [completedRow] = await query("SELECT COUNT(*) as cnt FROM meetings WHERE status = 'completed'")
    const [thisWeekRow] = await query(
      'SELECT COUNT(*) as cnt FROM meetings WHERE date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND date <= DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)'
    )

    // 액션 아이템 통계 계산
    const allMeetings = await query('SELECT action_items FROM meetings WHERE action_items IS NOT NULL')
    let totalItems = 0, completedItems = 0, totalDuration = 0

    const durationRows = await query('SELECT COALESCE(SUM(duration), 0) as total FROM meetings')
    totalDuration = durationRows[0].total

    for (const row of allMeetings) {
      const items = typeof row.action_items === 'string' ? JSON.parse(row.action_items) : (row.action_items || [])
      totalItems += items.length
      completedItems += items.filter(i => i.done).length
    }

    res.json({
      success: true,
      data: {
        totalMeetings: totalRow.cnt,
        completedMeetings: completedRow.cnt,
        meetingsThisWeek: thisWeekRow.cnt,
        totalHours: Math.round(totalDuration / 60 * 10) / 10,
        actionItemsTotal: totalItems,
        actionItemsCompleted: completedItems,
        avgSentiment: 72,
      },
    })
  } catch (err) {
    console.error('[통계 에러]', err.message)
    res.status(500).json({ success: false, error: '통계 조회 실패' })
  }
})

// ── 차트 데이터 조회 (대시보드 차트용) ──
router.get('/chart-data', async (req, res) => {
  try {
    // 1. 주간 회의 빈도 (최근 4주, 요일별)
    const weeklyRows = await query(`
      SELECT
        YEARWEEK(date, 1) as yw,
        DAYOFWEEK(date) as dow,
        COUNT(*) as cnt
      FROM meetings
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
      GROUP BY yw, dow
      ORDER BY yw, dow
    `)
    const weeklyFrequency = weeklyRows.map(r => ({
      yearWeek: r.yw,
      dayOfWeek: r.dow,
      count: r.cnt,
    }))

    // 2. 시간대별 분포
    const hourlyRows = await query(`
      SELECT
        CAST(SUBSTRING(time, 1, 2) AS UNSIGNED) as hour,
        COUNT(*) as cnt
      FROM meetings
      WHERE time IS NOT NULL AND time != ''
      GROUP BY hour
      ORDER BY hour
    `)
    const hourlyDistribution = hourlyRows.map(r => ({
      hour: r.hour,
      count: r.cnt,
    }))

    // 3. 키워드 트렌드 (최근 2주, 상위 키워드)
    const keywordRows = await query(`
      SELECT date, tags FROM meetings
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
      AND tags IS NOT NULL
      ORDER BY date
    `)
    const keywordMap = {}
    for (const row of keywordRows) {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || [])
      const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date
      for (const tag of tags) {
        if (!keywordMap[tag]) keywordMap[tag] = {}
        keywordMap[tag][dateStr] = (keywordMap[tag][dateStr] || 0) + 1
      }
    }
    const topKeywords = Object.entries(keywordMap)
      .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
      .slice(0, 5)
    const keywordTrend = topKeywords.map(([keyword, dates]) => ({
      keyword,
      data: Object.entries(dates).map(([date, count]) => ({ date, count })),
    }))

    // 4. 화자 비율 (최근 5개 회의)
    const speakerRows = await query(`
      SELECT transcript FROM meetings
      WHERE transcript IS NOT NULL AND transcript != '[]'
      ORDER BY date DESC, time DESC
      LIMIT 5
    `)
    const speakerDuration = {}
    for (const row of speakerRows) {
      const segments = typeof row.transcript === 'string' ? JSON.parse(row.transcript) : (row.transcript || [])
      for (const seg of segments) {
        if (seg.speaker) {
          const dur = (seg.end || 0) - (seg.start || 0)
          speakerDuration[seg.speaker] = (speakerDuration[seg.speaker] || 0) + dur
        }
      }
    }
    const speakerRatio = Object.entries(speakerDuration).map(([speaker, duration]) => ({
      speaker,
      totalDuration: Math.round(duration * 10) / 10,
    }))

    res.json({
      success: true,
      data: { weeklyFrequency, hourlyDistribution, keywordTrend, speakerRatio },
    })
  } catch (err) {
    console.error('[차트 데이터 에러]', err.message)
    res.status(500).json({ success: false, error: '차트 데이터 조회 실패' })
  }
})

// ── 회의 상세 조회 ──
// ── 회의에 연결된 녹음 조회 ──
router.get('/:id/recording', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, file_name, file_size, mime_type, duration, status FROM recordings WHERE meeting_id = ? LIMIT 1',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.json({ success: true, data: null })
    }

    const row = rows[0]
    res.json({
      success: true,
      data: {
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        duration: row.duration,
        status: row.status,
      },
    })
  } catch (err) {
    console.error('[녹음 조회 에러]', err.message)
    res.status(500).json({ success: false, error: '녹음 조회 실패' })
  }
})

// ── 회의 상세 조회 ──
router.get('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }
    res.json({ success: true, data: formatMeeting(rows[0]) })
  } catch (err) {
    console.error('[회의 상세 에러]', err.message)
    res.status(500).json({ success: false, error: '회의 조회 실패' })
  }
})

// ── 회의 생성 ──
router.post('/', async (req, res) => {
  try {
    const {
      title, date, time, duration,
      participants, status, tags,
      aiSummary, keyDecisions, actionItems,
      sentiment, transcript, fullText, speakerMap,
    } = req.body

    if (!title) {
      return res.status(400).json({ success: false, error: '회의 제목은 필수입니다.' })
    }

    const meetingDate = date || new Date().toISOString().slice(0, 10)
    const meetingTime = time || new Date().toTimeString().slice(0, 5)

    const result = await query(
      `INSERT INTO meetings (title, date, time, duration, participants, status, tags, ai_summary, key_decisions, action_items, sentiment, transcript, full_text, speaker_map)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        meetingDate,
        meetingTime,
        duration || 0,
        JSON.stringify(participants || []),
        status || 'completed',
        JSON.stringify(tags || []),
        aiSummary || '',
        JSON.stringify(keyDecisions || []),
        JSON.stringify(actionItems || []),
        sentiment || 'neutral',
        JSON.stringify(transcript || []),
        fullText || '',
        speakerMap ? JSON.stringify(speakerMap) : null,
      ]
    )

    const [newMeeting] = await query('SELECT * FROM meetings WHERE id = ?', [result.insertId])
    console.log(`[회의 생성] ID: ${result.insertId} - ${title}`)

    // ── Dify RAG 에이전트 API 호출 (RAG 자동 생성) ──
    const ragApiKey = process.env.DIFY_RAG_AGENT_API_KEY
    const ragApiUrl = process.env.DIFY_API_URL
    if (ragApiKey && ragApiUrl) {
      const meetingId = result.insertId
      await query('INSERT INTO meeting_rag_docs (meeting_id) VALUES (?)', [meetingId])

      const meetingPayload = formatMeeting(newMeeting)
      fetch(`${ragApiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ragApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { id: String(meetingId), gubun: 'C', document_id: '', title: meetingPayload.title, test: JSON.stringify(meetingPayload) },
          response_mode: 'blocking',
          user: 'rag-agent',
        }),
      })
        .then(async r => {
          const body = await r.json().catch(() => ({}))
          const documentId = (() => { try { return JSON.parse(body?.data?.outputs?.body)?.document?.id || null } catch { return null } })()
          await query(
            'UPDATE meeting_rag_docs SET document_id = ?, status = ? WHERE meeting_id = ?',
            [documentId, documentId ? 'completed' : 'failed', meetingId]
          )
          console.log(`[Dify RAG] 성공 — meeting_id: ${meetingId}, document_id: ${documentId}`)
        })
        .catch(async err => {
          await query(
            "UPDATE meeting_rag_docs SET status = 'failed', error_msg = ? WHERE meeting_id = ?",
            [err.message, meetingId]
          )
          console.error(`[Dify RAG] 실패 — meeting_id: ${meetingId}:`, err.message)
        })
    }

    res.status(201).json({ success: true, data: formatMeeting(newMeeting) })
  } catch (err) {
    console.error('[회의 생성 에러]', err.message)
    res.status(500).json({ success: false, error: '회의 생성 실패' })
  }
})

// ── 회의 수정 ──
router.put('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }

    const existing = rows[0]
    const {
      title, date, time, duration,
      participants, status, tags,
      aiSummary, keyDecisions, actionItems,
      sentiment, transcript, fullText, speakerMap,
    } = req.body

    await query(
      `UPDATE meetings SET
        title = ?, date = ?, time = ?, duration = ?,
        participants = ?, status = ?, tags = ?,
        ai_summary = ?, key_decisions = ?, action_items = ?,
        sentiment = ?, transcript = ?, full_text = ?,
        speaker_map = ?
       WHERE id = ?`,
      [
        title || existing.title,
        date || (existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : existing.date),
        time || existing.time,
        duration !== undefined ? duration : existing.duration,
        participants ? JSON.stringify(participants) : existing.participants,
        status || existing.status,
        tags ? JSON.stringify(tags) : existing.tags,
        aiSummary !== undefined ? aiSummary : existing.ai_summary,
        keyDecisions ? JSON.stringify(keyDecisions) : existing.key_decisions,
        actionItems ? JSON.stringify(actionItems) : existing.action_items,
        sentiment || existing.sentiment,
        transcript ? JSON.stringify(transcript) : existing.transcript,
        fullText !== undefined ? fullText : existing.full_text,
        speakerMap !== undefined ? JSON.stringify(speakerMap) : existing.speaker_map,
        req.params.id,
      ]
    )

    const [updated] = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    console.log(`[회의 수정] ID: ${req.params.id}`)

    // ── Dify RAG 에이전트 API 호출 (RAG 자동 생성) ──
    const ragApiKey = process.env.DIFY_RAG_AGENT_API_KEY
    const ragApiUrl = process.env.DIFY_API_URL
    if (ragApiKey && ragApiUrl) {
      const meetingId = parseInt(req.params.id, 10)
      const [ragRow] = await query('SELECT document_id FROM meeting_rag_docs WHERE meeting_id = ?', [meetingId])
      const existingDocumentId = ragRow?.document_id || null

      await query(
        `INSERT INTO meeting_rag_docs (meeting_id, status) VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE status = 'pending', document_id = NULL, error_msg = NULL`,
        [meetingId]
      )

      const meetingPayload = formatMeeting(updated)
      fetch(`${ragApiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ragApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { id: String(meetingId), gubun: existingDocumentId ? 'U' : 'C', document_id: existingDocumentId || '', title: meetingPayload.title, test: JSON.stringify(meetingPayload) },
          response_mode: 'blocking',
          user: 'rag-agent',
        }),
      })
        .then(async r => {
          const body = await r.json().catch(() => ({}))
          console.log(`[Dify RAG 응답] meeting_id: ${meetingId}`, JSON.stringify(body?.data?.outputs))
          const documentId = (() => { try { return JSON.parse(body?.data?.outputs?.body)?.document?.id || null } catch { return null } })()
          await query(
            'UPDATE meeting_rag_docs SET document_id = ?, status = ? WHERE meeting_id = ?',
            [documentId, documentId ? 'completed' : 'failed', meetingId]
          )
          console.log(`[Dify RAG] 성공 — meeting_id: ${meetingId}, document_id: ${documentId}`)
        })
        .catch(async err => {
          await query(
            "UPDATE meeting_rag_docs SET status = 'failed', error_msg = ? WHERE meeting_id = ?",
            [err.message, meetingId]
          )
          console.error(`[Dify RAG] 실패 — meeting_id: ${meetingId}:`, err.message)
        })
    }

    res.json({ success: true, data: formatMeeting(updated) })
  } catch (err) {
    console.error('[회의 수정 에러]', err.message)
    res.status(500).json({ success: false, error: '회의 수정 실패' })
  }
})

// ── 회의 삭제 ──
router.delete('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }

    const meetingId = parseInt(req.params.id, 10)

    // document_id 있으면 Dify에 삭제 요청 (gubun=D)
    const [ragRow] = await query('SELECT document_id FROM meeting_rag_docs WHERE meeting_id = ?', [meetingId])
    if (ragRow?.document_id) {
      const ragApiKey = process.env.DIFY_RAG_AGENT_API_KEY
      const ragApiUrl = process.env.DIFY_API_URL
      if (!ragApiKey || !ragApiUrl) {
        return res.status(500).json({ success: false, error: 'Dify 환경변수가 설정되지 않았습니다.' })
      }

      const meeting = formatMeeting(rows[0])
      const difyRes = await fetch(`${ragApiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ragApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { id: String(meetingId), gubun: 'D', document_id: ragRow.document_id, title: meeting.title, test: JSON.stringify(meeting) },
          response_mode: 'blocking',
          user: 'rag-agent',
        }),
      })

      const body = await difyRes.json().catch(() => ({}))
      if (!difyRes.ok || body?.data?.status === 'failed') {
        const errMsg = body?.data?.error || body?.message || 'Dify 삭제 실패'
        console.error(`[Dify RAG 삭제] 실패 — meeting_id: ${meetingId}:`, errMsg)
        return res.status(500).json({ success: false, error: `RAG 삭제 실패: ${errMsg}` })
      }
      console.log(`[Dify RAG 삭제] 성공 — meeting_id: ${meetingId}, document_id: ${ragRow.document_id}`)
    }

    // meeting_rag_docs는 CASCADE로 자동 삭제됨
    await query('DELETE FROM meetings WHERE id = ?', [meetingId])
    console.log(`[회의 삭제] ID: ${meetingId} - ${rows[0].title}`)
    res.json({ success: true, data: formatMeeting(rows[0]) })
  } catch (err) {
    console.error('[회의 삭제 에러]', err.message)
    res.status(500).json({ success: false, error: '회의 삭제 실패' })
  }
})

// ── 액션 아이템 토글 ──
router.patch('/:id/action-items/:itemIndex', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }

    const items = typeof rows[0].action_items === 'string'
      ? JSON.parse(rows[0].action_items) : (rows[0].action_items || [])
    const idx = parseInt(req.params.itemIndex, 10)

    if (idx < 0 || idx >= items.length) {
      return res.status(404).json({ success: false, error: '액션 아이템을 찾을 수 없습니다.' })
    }

    items[idx].done = !items[idx].done

    await query('UPDATE meetings SET action_items = ? WHERE id = ?', [JSON.stringify(items), req.params.id])

    res.json({ success: true, data: items[idx] })
  } catch (err) {
    console.error('[액션아이템 토글 에러]', err.message)
    res.status(500).json({ success: false, error: '액션 아이템 수정 실패' })
  }
})

// ── 회의록 메일 발송 ──
router.post('/:id/send-email', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }

    const meeting = formatMeeting(rows[0])
    const { recipients = [], additionalRecipients = [], subject } = req.body

    // 수신자 목록 합치기
    const allRecipients = [...recipients, ...additionalRecipients].filter(Boolean)
    if (allRecipients.length === 0) {
      return res.status(400).json({ success: false, error: '수신자를 1명 이상 지정해주세요.' })
    }

    // 메일 제목
    const emailSubject = subject || `[회의록] ${meeting.title} - ${meeting.date}`

    // HTML 메일 본문 생성
    const actionItemsHtml = (meeting.actionItems || []).map(item =>
      `<li style="margin-bottom:6px;">
        <span style="${item.done ? 'text-decoration:line-through;color:#94a3b8;' : ''}">${item.text}</span>
        <br><span style="font-size:12px;color:#94a3b8;">${item.assignee || ''} · ${item.dueDate || ''}</span>
      </li>`
    ).join('')

    const decisionsHtml = (meeting.keyDecisions || []).map((d, i) =>
      `<li style="margin-bottom:4px;">${d}</li>`
    ).join('')

    const tagsHtml = (meeting.tags || []).map(t =>
      `<span style="display:inline-block;background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;">${t}</span>`
    ).join('')

    const htmlBody = `
      <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;color:#334155;">
        <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">${meeting.title}</h2>
          <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">${meeting.date} ${meeting.time || ''} · ${meeting.participants?.join(', ') || ''}</p>
        </div>
        <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <h3 style="font-size:15px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">AI 요약</h3>
          <p style="font-size:14px;line-height:1.7;color:#475569;">${meeting.aiSummary || '(요약 없음)'}</p>

          ${decisionsHtml ? `
          <h3 style="font-size:15px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-top:20px;">주요 결정사항</h3>
          <ol style="font-size:14px;line-height:1.7;color:#475569;padding-left:20px;">${decisionsHtml}</ol>
          ` : ''}

          ${actionItemsHtml ? `
          <h3 style="font-size:15px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-top:20px;">액션 아이템</h3>
          <ul style="font-size:14px;line-height:1.7;color:#475569;padding-left:20px;">${actionItemsHtml}</ul>
          ` : ''}

          ${tagsHtml ? `
          <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#94a3b8;margin-right:8px;">키워드:</span>${tagsHtml}
          </div>
          ` : ''}

          <p style="font-size:11px;color:#94a3b8;margin-top:24px;text-align:center;">NoteFlow에서 자동 생성된 메일입니다.</p>
        </div>
      </div>
    `

    // SMTP 전송 설정
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'meeting-notes@company.com'

    if (!smtpHost) {
      // SMTP 미설정 시 — 메일 본문만 반환 (프로토타입용)
      console.log(`[메일 발송] SMTP 미설정 — 프리뷰만 반환 (수신: ${allRecipients.join(', ')})`)
      return res.json({
        success: true,
        data: {
          sent: false,
          preview: true,
          subject: emailSubject,
          recipients: allRecipients,
          html: htmlBody,
          message: 'SMTP가 설정되지 않아 실제 발송되지 않았습니다. .env에 SMTP_HOST를 설정하세요.',
        },
      })
    }

    // nodemailer 전송
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    })

    await transporter.sendMail({
      from: smtpFrom,
      to: allRecipients.join(', '),
      subject: emailSubject,
      html: htmlBody,
    })

    console.log(`[메일 발송] 성공 — 수신: ${allRecipients.join(', ')}`)
    res.json({
      success: true,
      data: {
        sent: true,
        subject: emailSubject,
        recipients: allRecipients,
      },
    })
  } catch (err) {
    console.error('[메일 발송 에러]', err.message)
    res.status(500).json({ success: false, error: '메일 발송 실패: ' + err.message })
  }
})

// ── [임시] RAG 수동 생성 — 기존 회의록 document_id 채우기용, 작업 완료 후 삭제 예정 ──
router.post('/:id/generate-rag', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' })
    }

    const ragApiKey = process.env.DIFY_RAG_AGENT_API_KEY
    const ragApiUrl = process.env.DIFY_API_URL
    if (!ragApiKey || !ragApiUrl) {
      return res.status(500).json({ success: false, error: 'Dify 환경변수가 설정되지 않았습니다.' })
    }

    const meetingId = parseInt(req.params.id, 10)
    const meeting = formatMeeting(rows[0])

    const [ragRow] = await query('SELECT document_id FROM meeting_rag_docs WHERE meeting_id = ?', [meetingId])
    const existingDocumentId = ragRow?.document_id || null
    const gubun = ragRow ? 'U' : 'C'

    await query(
      `INSERT INTO meeting_rag_docs (meeting_id, status) VALUES (?, 'pending')
       ON DUPLICATE KEY UPDATE status = 'pending', document_id = NULL, error_msg = NULL`,
      [meetingId]
    )

    const difyRes = await fetch(`${ragApiUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ragApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { id: String(meetingId), gubun, document_id: existingDocumentId || '', title: meeting.title, test: JSON.stringify(meeting) },
        response_mode: 'blocking',
        user: 'rag-agent',
      }),
    })

    const body = await difyRes.json().catch(() => ({}))
    const documentId = (() => { try { return JSON.parse(body?.data?.outputs?.body)?.document?.id || null } catch { return null } })()

    if (documentId) {
      await query(
        "UPDATE meeting_rag_docs SET document_id = ?, status = 'completed', error_msg = NULL WHERE meeting_id = ?",
        [documentId, meetingId]
      )
      console.log(`[Dify RAG 수동] 성공 — meeting_id: ${meetingId}, document_id: ${documentId}`)
      res.json({ success: true, data: { documentId } })
    } else {
      const errMsg = body?.message || body?.data?.error || 'document_id 없음'
      await query(
        "UPDATE meeting_rag_docs SET status = 'failed', error_msg = ? WHERE meeting_id = ?",
        [errMsg, meetingId]
      )
      console.error(`[Dify RAG 수동] 실패 — meeting_id: ${meetingId}:`, errMsg)
      res.status(500).json({ success: false, error: `RAG 생성 실패: ${errMsg}` })
    }
  } catch (err) {
    console.error('[RAG 수동 생성 에러]', err.message)
    res.status(500).json({ success: false, error: 'RAG 생성 실패: ' + err.message })
  }
})

export default router
