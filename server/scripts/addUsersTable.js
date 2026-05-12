/**
 * server/scripts/addUsersTable.js - users 테이블 마이그레이션
 * 실행: node server/scripts/addUsersTable.js
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '30306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'meetings',
}

async function run() {
  console.log('═══════════════════════════════════════════════')
  console.log('  NoteFlow - users 테이블 마이그레이션')
  console.log('═══════════════════════════════════════════════')

  const conn = await mysql.createConnection(DB_CONFIG)

  // users 테이블 생성
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL COMMENT '이름',
      email VARCHAR(255) NOT NULL UNIQUE COMMENT '이메일',
      password_hash VARCHAR(255) NOT NULL COMMENT '비밀번호 해시',
      role ENUM('admin', 'manager', 'member') DEFAULT 'member' COMMENT '권한',
      department VARCHAR(100) DEFAULT '' COMMENT '부서',
      status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '계정 상태',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 계정'
  `)
  console.log('✓ users 테이블 생성 완료')

  // 기본 관리자 계정 삽입 (없는 경우)
  const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', ['admin@company.com'])
  if (existing.length === 0) {
    const hash = await bcrypt.hash('admin1234', 10)
    await conn.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
      ['관리자', 'admin@company.com', hash, 'admin', '경영지원']
    )
    console.log('✓ 기본 관리자 계정 생성 (admin@company.com / admin1234)')
  } else {
    console.log('  관리자 계정 이미 존재')
  }

  await conn.end()

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  마이그레이션 완료!')
  console.log('═══════════════════════════════════════════════')
}

run().catch(err => {
  console.error('마이그레이션 실패:', err.message)
  process.exit(1)
})
