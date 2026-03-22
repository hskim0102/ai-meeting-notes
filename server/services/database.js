/**
 * server/services/database.js - MySQL 데이터베이스 연결 관리
 * ─────────────────────────────────────────────────
 * mysql2/promise 기반 커넥션 풀 관리
 * ─────────────────────────────────────────────────
 */

import mysql from 'mysql2/promise'

let pool = null

/**
 * 커넥션 풀 가져오기 (lazy init)
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '30306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'meetings',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    })
    console.log('[DB] 커넥션 풀 생성 완료')
  }
  return pool
}

/**
 * DB 쿼리 실행 헬퍼
 * @param {string} sql - SQL 쿼리
 * @param {Array} params - 바인딩 파라미터
 * @returns {Promise<Array>} rows
 */
export async function query(sql, params = []) {
  const p = getPool()
  const [rows] = await p.execute(sql, params)
  return rows
}

/**
 * DB 연결 테스트
 */
export async function testConnection() {
  try {
    const p = getPool()
    const conn = await p.getConnection()
    await conn.ping()
    conn.release()
    return true
  } catch (err) {
    console.error('[DB] 연결 실패:', err.message)
    return false
  }
}

/**
 * 커넥션 풀 종료
 */
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    console.log('[DB] 커넥션 풀 종료')
  }
}
