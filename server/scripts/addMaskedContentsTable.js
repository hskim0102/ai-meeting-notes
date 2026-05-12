/**
 * server/scripts/addMaskedContentsTable.js
 * ─────────────────────────────────────────────────
 * meeting_masked_contents 테이블 생성 + 기존 회의 마이그레이션
 * 실행: node server/scripts/addMaskedContentsTable.js
 * ─────────────────────────────────────────────────
 */

import 'dotenv/config'
import { query } from '../services/database.js'
import { maskPersonalInfo } from '../services/difyService.js'

async function run() {
  console.log('═══════════════════════════════════════════════')
  console.log('  NoteFlow - meeting_masked_contents 마이그레이션')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  // ── 1. 테이블 생성 ──
  await query(`
    CREATE TABLE IF NOT EXISTS meeting_masked_contents (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id    INT NOT NULL,
      ai_summary    TEXT DEFAULT NULL         COMMENT '마스킹된 AI 요약',
      key_decisions JSON DEFAULT NULL         COMMENT '마스킹된 결정사항',
      action_items  JSON DEFAULT NULL         COMMENT '마스킹된 액션 아이템',
      transcript    JSON DEFAULT NULL         COMMENT '마스킹된 발언 기록',
      mask_status   ENUM('pending','completed','failed') DEFAULT 'pending',
      error_msg     TEXT DEFAULT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_meeting_id (meeting_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='meetings ↔ Dify 개인정보 마스킹 컨텐츠'
  `)
  console.log('[1/3] meeting_masked_contents 테이블 생성 완료 (이미 있으면 스킵)')

  // ── 2. 마이그레이션 대상 조회 ──
  //  - meeting_masked_contents 레코드가 없고
  //  - ai_summary 가 있는 회의만 대상
  const targets = await query(`
    SELECT m.id,
           m.ai_summary,
           m.key_decisions,
           m.action_items,
           m.transcript
    FROM   meetings m
    LEFT JOIN meeting_masked_contents mc ON mc.meeting_id = m.id
    WHERE  mc.id IS NULL
      AND  m.ai_summary IS NOT NULL
      AND  m.ai_summary != ''
  `)

  console.log(`[2/3] 마이그레이션 대상: ${targets.length}건`)

  if (targets.length === 0) {
    console.log('      → 대상 없음. 마이그레이션 완료.')
    console.log('')
    console.log('═══════════════════════════════════════════════')
    console.log('  완료!')
    console.log('═══════════════════════════════════════════════')
    process.exit(0)
  }

  // ── 3. pending 등록 후 Dify 마스킹 실행 ──
  console.log('[3/3] 마스킹 처리 중...')

  const parseJsonField = (val) => {
    if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
    return val || []
  }

  const results = await Promise.allSettled(
    targets.map(async (m) => {
      // pending 레코드 삽입
      await query(
        `INSERT INTO meeting_masked_contents (meeting_id, mask_status)
         VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE mask_status = 'pending', error_msg = NULL`,
        [m.id]
      )

      // Dify 마스킹 호출
      const masked = await maskPersonalInfo({
        aiSummary:    m.ai_summary || '',
        keyDecisions: parseJsonField(m.key_decisions),
        actionItems:  parseJsonField(m.action_items),
        transcript:   parseJsonField(m.transcript),
      })

      await query(
        `UPDATE meeting_masked_contents
         SET ai_summary = ?, key_decisions = ?, action_items = ?, transcript = ?,
             mask_status = 'completed', error_msg = NULL
         WHERE meeting_id = ?`,
        [
          masked.aiSummary || '',
          JSON.stringify(masked.keyDecisions || []),
          JSON.stringify(masked.actionItems  || []),
          JSON.stringify(masked.transcript   || []),
          m.id,
        ]
      )

      console.log(`  ✓ meeting_id ${m.id}: 마스킹 완료`)
    })
  )

  let successCount = 0
  let failCount = 0
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      failCount++
      const meetingId = targets[i].id
      const errMsg = result.reason?.message || String(result.reason)
      await query(
        `UPDATE meeting_masked_contents SET mask_status = 'failed', error_msg = ? WHERE meeting_id = ?`,
        [errMsg, meetingId]
      )
      console.error(`  ✗ meeting_id ${meetingId}: 실패 — ${errMsg}`)
    } else {
      successCount++
    }
  }

  console.log('')
  console.log(`  성공: ${successCount}건 / 실패: ${failCount}건`)
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  마이그레이션 완료!')
  console.log('═══════════════════════════════════════════════')
  process.exit(0)
}

run().catch(err => {
  console.error('마이그레이션 실패:', err.message)
  process.exit(1)
})
