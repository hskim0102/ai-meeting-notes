import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// DB 모듈 모킹 (실제 MySQL 연결 없이 테스트)
vi.mock('../../server/services/database.js', () => ({
  query: vi.fn(async (sql) => {
    // 주간 회의 빈도 쿼리
    if (sql.includes('YEARWEEK')) {
      return [{ yw: 202614, dow: 2, cnt: 3 }]
    }
    // 시간대별 분포 쿼리
    if (sql.includes('SUBSTRING(time')) {
      return [{ hour: 10, cnt: 5 }, { hour: 14, cnt: 3 }]
    }
    // 키워드 트렌드 쿼리
    if (sql.includes('tags IS NOT NULL')) {
      return [
        { date: new Date('2026-04-01'), tags: JSON.stringify(['AI', '기획']) },
        { date: new Date('2026-04-02'), tags: JSON.stringify(['AI', '개발']) },
      ]
    }
    // 화자 비율 쿼리
    if (sql.includes('transcript IS NOT NULL')) {
      return [
        {
          transcript: JSON.stringify([
            { speaker: '홍길동', start: 0, end: 30 },
            { speaker: '김철수', start: 30, end: 50 },
          ]),
        },
      ]
    }
    return []
  }),
  getPool: vi.fn(),
  testConnection: vi.fn(async () => true),
  closePool: vi.fn(async () => {}),
}))

const { app } = await import('../../server/index.js')

describe('GET /api/meetings/chart-data', () => {
  it('차트 데이터 구조를 반환한다', async () => {
    const res = await request(app).get('/api/meetings/chart-data')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('weeklyFrequency')
    expect(res.body.data).toHaveProperty('hourlyDistribution')
    expect(res.body.data).toHaveProperty('keywordTrend')
    expect(res.body.data).toHaveProperty('speakerRatio')
    expect(Array.isArray(res.body.data.weeklyFrequency)).toBe(true)
    expect(Array.isArray(res.body.data.hourlyDistribution)).toBe(true)
  })
})
