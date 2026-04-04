import { describe, it, expect } from 'vitest'
import { buildMeetingContext, extractKeywords } from '../../server/services/chatService.js'

describe('buildMeetingContext', () => {
  it('회의 summary와 transcript를 하나의 context 문자열로 구성한다', () => {
    const meeting = {
      title: '주간 회의',
      ai_summary: '프로젝트 진행 상황을 점검했습니다.',
      transcript: [
        { speaker: '김부장', time: '10:00', text: '이번 주 진행 상황을 공유해주세요.' },
        { speaker: '이대리', time: '10:05', text: '프론트엔드 작업이 80% 완료되었습니다.' },
      ],
    }
    const context = buildMeetingContext(meeting)
    expect(context).toContain('주간 회의')
    expect(context).toContain('프로젝트 진행 상황을 점검했습니다')
    expect(context).toContain('김부장')
    expect(context).toContain('프론트엔드 작업이 80% 완료되었습니다')
  })

  it('transcript가 비어있어도 summary로 context를 구성한다', () => {
    const meeting = { title: '테스트 회의', ai_summary: '요약 내용', transcript: [] }
    const context = buildMeetingContext(meeting)
    expect(context).toContain('요약 내용')
  })
})

describe('extractKeywords', () => {
  it('질문에서 한국어 키워드를 추출한다', () => {
    const keywords = extractKeywords('지난달 마케팅 예산 관련 결정사항은?')
    expect(keywords).toContain('마케팅')
    expect(keywords).toContain('예산')
    expect(keywords).toContain('결정사항')
  })

  it('불용어를 제거한다', () => {
    const keywords = extractKeywords('이것은 테스트 질문입니다')
    expect(keywords).not.toContain('이것은')
    expect(keywords).not.toContain('입니다')
  })
})
