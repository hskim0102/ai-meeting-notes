/**
 * server/middleware/authMiddleware.js - JWT 인증 미들웨어
 */

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'noteflow-secret-key-change-in-production'

/**
 * 필수 인증 미들웨어 - 토큰이 없으면 401
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: '인증이 필요합니다' })
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다' })
  }
}

/**
 * 선택적 인증 미들웨어 - 토큰이 있으면 req.user에 설정, 없어도 통과
 */
export function optionalAuth(req, res, next) {
  const token = extractToken(req)
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET)
    } catch {
      // 토큰이 유효하지 않아도 통과
    }
  }
  next()
}

function extractToken(req) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
