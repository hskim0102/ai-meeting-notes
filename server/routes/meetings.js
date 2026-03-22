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
    createdAt: row.created_at,
  }
}

// ── 회의 목록 조회 ──
router.get('/', async (req, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query
    let sql = 'SELECT * FROM meetings'
    const params = []

    if (status) { sql += ' WHERE status = ?'; params.push(status) }
    sql += ' ORDER BY date DESC, time DESC'

    const rows = await query(sql, params)

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const startIdx = (pageNum - 1) * limitNum
    const paged = rows.slice(startIdx, startIdx + limitNum)

    res.json({
      success: true,
      data: paged.map(formatMeeting),
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
      sentiment, transcript, fullText,
    } = req.body

    if (!title) {
      return res.status(400).json({ success: false, error: '회의 제목은 필수입니다.' })
    }

    const meetingDate = date || new Date().toISOString().slice(0, 10)
    const meetingTime = time || new Date().toTimeString().slice(0, 5)

    const result = await query(
      `INSERT INTO meetings (title, date, time, duration, participants, status, tags, ai_summary, key_decisions, action_items, sentiment, transcript, full_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    )

    const [newMeeting] = await query('SELECT * FROM meetings WHERE id = ?', [result.insertId])
    console.log(`[회의 생성] ID: ${result.insertId} - ${title}`)

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
      sentiment, transcript, fullText,
    } = req.body

    await query(
      `UPDATE meetings SET
        title = ?, date = ?, time = ?, duration = ?,
        participants = ?, status = ?, tags = ?,
        ai_summary = ?, key_decisions = ?, action_items = ?,
        sentiment = ?, transcript = ?, full_text = ?
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
        req.params.id,
      ]
    )

    const [updated] = await query('SELECT * FROM meetings WHERE id = ?', [req.params.id])
    console.log(`[회의 수정] ID: ${req.params.id}`)
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

    await query('DELETE FROM meetings WHERE id = ?', [req.params.id])
    console.log(`[회의 삭제] ID: ${req.params.id} - ${rows[0].title}`)
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

          <p style="font-size:11px;color:#94a3b8;margin-top:24px;text-align:center;">AI 스마트 회의록 Agent에서 자동 생성된 메일입니다.</p>
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

export default router
