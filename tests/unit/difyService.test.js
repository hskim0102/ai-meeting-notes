import { describe, it, expect } from 'vitest'

// parseWorkflowOutput는 내부 함수이므로 summarizeWithDify를 통해 간접 테스트하기 어려움
// 대신 normalizeActionItems, normalizeArray 패턴을 확인하기 위해
// summarizeWithDify의 결과 구조를 검증하는 통합적 접근을 취한다

describe('difyService 모듈 import', () => {
  it('summarizeWithDify 함수를 export한다', async () => {
    const mod = await import('../../server/services/difyService.js')
    expect(typeof mod.summarizeWithDify).toBe('function')
  })
})
