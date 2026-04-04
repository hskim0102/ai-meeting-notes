import { describe, it, expect } from 'vitest'
import { mergeTranscripts, formatTimecode } from '../../server/services/whisperService.js'

describe('mergeTranscripts', () => {
  it('여러 청크 결과를 시간순으로 병합한다', () => {
    const chunkResults = [
      {
        chunkIndex: 0,
        startTimeOffset: 0,
        duration: 60,
        text: '첫 번째 청크',
        segments: [
          { start: 0, end: 5, text: '안녕하세요' },
          { start: 5, end: 10, text: '반갑습니다' },
        ],
      },
      {
        chunkIndex: 1,
        startTimeOffset: 60,
        duration: 60,
        text: '두 번째 청크',
        segments: [
          { start: 0, end: 5, text: '다음 내용입니다' },
        ],
      },
    ]

    const result = mergeTranscripts(chunkResults)

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0].start).toBe(0)
    expect(result.segments[2].start).toBe(60) // 오프셋 적용
    expect(result.fullText).toContain('안녕하세요')
    expect(result.fullText).toContain('다음 내용입니다')
    expect(result.chunkCount).toBe(2)
    expect(result.errorCount).toBe(0)
  })

  it('에러가 있는 청크는 건너뛴다', () => {
    const chunkResults = [
      {
        chunkIndex: 0,
        startTimeOffset: 0,
        duration: 60,
        text: '성공',
        segments: [{ start: 0, end: 5, text: '성공 텍스트' }],
      },
      {
        chunkIndex: 1,
        startTimeOffset: 60,
        duration: 60,
        text: '',
        segments: [],
        error: 'API 오류',
      },
    ]

    const result = mergeTranscripts(chunkResults)

    expect(result.segments).toHaveLength(1)
    expect(result.errorCount).toBe(1)
  })
})

describe('formatTimecode', () => {
  it('초를 HH:MM:SS 형식으로 변환한다', () => {
    expect(formatTimecode(0)).toBe('00:00:00')
    expect(formatTimecode(65)).toBe('00:01:05')
    expect(formatTimecode(3661)).toBe('01:01:01')
  })
})
