import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// DB 모듈 모킹 (실제 MySQL 연결 없이 테스트)
vi.mock('../../server/services/database.js', () => ({
  query: vi.fn(async (sql) => {
    // 회의 목록 조회
    if (sql.includes('SELECT * FROM meetings')) {
      return [
        {
          id: 1,
          title: '테스트 회의',
          date: new Date('2026-04-01'),
          time: '10:00',
          duration: 60,
          participants: JSON.stringify(['홍길동', '김철수']),
          status: 'completed',
          tags: JSON.stringify(['테스트']),
          ai_summary: '테스트 요약',
          key_decisions: JSON.stringify(['결정 1']),
          action_items: JSON.stringify([{ text: '액션 1', done: false }]),
          sentiment: 'positive',
          transcript: JSON.stringify([]),
          speaker_map: null,
          created_at: new Date(),
        },
      ]
    }
    // COUNT 쿼리 (통계)
    if (sql.includes('COUNT(*)')) {
      return [{ cnt: 1 }]
    }
    // SUM 쿼리 (총 시간)
    if (sql.includes('SUM(duration)')) {
      return [{ total: 120 }]
    }
    // action_items 쿼리
    if (sql.includes('action_items')) {
      return [{ action_items: JSON.stringify([{ text: '액션 1', done: true }]) }]
    }
    return []
  }),
  getPool: vi.fn(),
  testConnection: vi.fn(async () => true),
  closePool: vi.fn(async () => {}),
}))

const { app } = await import('../../server/index.js')

describe('GET /api/meetings', () => {
  it('회의 목록을 배열로 반환한다', async () => {
    const res = await request(app).get('/api/meetings')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('GET /api/meetings/stats', () => {
  it('통계 데이터를 반환한다', async () => {
    const res = await request(app).get('/api/meetings/stats')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
