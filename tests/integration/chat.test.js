import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.js'

describe('POST /api/chat/meeting/:id', () => {
  it('질문이 비어있으면 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/meeting/1')
      .send({ question: '' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('유효하지 않은 회의 ID는 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/meeting/abc')
      .send({ question: '테스트 질문' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/chat/search', () => {
  it('질문이 비어있으면 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/search')
      .send({ question: '' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
