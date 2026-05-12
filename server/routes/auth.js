/**
 * server/routes/auth.js - 인증 API (회원가입 / 로그인 / 내 정보)
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../services/database.js'
import { requireAuth, signToken } from '../middleware/authMiddleware.js'

const router = Router()

// ── 회원가입 ──
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department = '', role = 'member' } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: '이름, 이메일, 비밀번호는 필수입니다' })
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: '올바른 이메일 형식이 아닙니다' })
    }

    // 이메일 중복 확인
    const existing = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: '이미 사용 중인 이메일입니다' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // role은 admin만 지정 가능 (일반 회원가입은 member 고정)
    const safeRole = 'member'

    const result = await query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), passwordHash, safeRole, department.trim()]
    )

    const userId = result.insertId
    const token = signToken({ id: userId, email: email.toLowerCase().trim(), role: safeRole, name: name.trim() })

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: safeRole, department: department.trim() },
      },
    })
  } catch (err) {
    console.error('[회원가입 에러]', err.message)
    res.status(500).json({ success: false, error: '회원가입 처리 중 오류가 발생했습니다' })
  }
})

// ── 로그인 ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요' })
    }

    const users = await query('SELECT * FROM users WHERE email = ? AND status = "active"', [email.toLowerCase().trim()])
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' })
    }

    const user = users[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' })
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name })

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          avatar: user.name.charAt(0),
        },
      },
    })
  } catch (err) {
    console.error('[로그인 에러]', err.message)
    res.status(500).json({ success: false, error: '로그인 처리 중 오류가 발생했습니다' })
  }
})

// ── 내 정보 조회 ──
router.get('/me', requireAuth, async (req, res) => {
  try {
    const users = await query('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?', [req.user.id])
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다' })
    }
    const user = users[0]
    res.json({
      success: true,
      data: { ...user, avatar: user.name.charAt(0) },
    })
  } catch (err) {
    console.error('[내 정보 조회 에러]', err.message)
    res.status(500).json({ success: false, error: '사용자 정보 조회 실패' })
  }
})

export default router
