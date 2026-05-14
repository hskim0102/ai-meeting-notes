/**
 * server/routes/users.js - 사용자 관리 API (관리자 전용)
 */

import { Router } from 'express'
import { query } from '../services/database.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다' })
  }
  next()
}

// GET /api/users - 전체 사용자 목록 (관리자 전용)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await query(
      'SELECT id, name, email, role, department, status, created_at FROM users ORDER BY role ASC, name ASC'
    )
    res.json({ success: true, data: users, total: users.length })
  } catch (err) {
    console.error('[사용자 목록 조회 에러]', err.message)
    res.status(500).json({ success: false, error: '사용자 목록 조회 실패' })
  }
})

// PUT /api/users/:id/role - 사용자 역할 변경 (관리자 전용)
router.put('/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!['admin', 'manager', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: '올바르지 않은 역할입니다' })
    }
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, error: '자신의 역할은 변경할 수 없습니다' })
    }

    const existing = await query('SELECT id FROM users WHERE id = ?', [id])
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다' })
    }

    await query('UPDATE users SET role = ? WHERE id = ?', [role, id])
    const updated = await query(
      'SELECT id, name, email, role, department, status, created_at FROM users WHERE id = ?',
      [id]
    )
    res.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error('[역할 변경 에러]', err.message)
    res.status(500).json({ success: false, error: '역할 변경 실패' })
  }
})

// PUT /api/users/:id/status - 사용자 상태 변경 (활성/비활성, 관리자 전용)
router.put('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: '올바르지 않은 상태입니다' })
    }
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, error: '자신의 계정 상태는 변경할 수 없습니다' })
    }

    const existing = await query('SELECT id FROM users WHERE id = ?', [id])
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다' })
    }

    await query('UPDATE users SET status = ? WHERE id = ?', [status, id])
    const updated = await query(
      'SELECT id, name, email, role, department, status, created_at FROM users WHERE id = ?',
      [id]
    )
    res.json({ success: true, data: updated[0] })
  } catch (err) {
    console.error('[상태 변경 에러]', err.message)
    res.status(500).json({ success: false, error: '상태 변경 실패' })
  }
})

export default router
