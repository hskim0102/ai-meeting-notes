import { describe, it, expect } from 'vitest'
import { mergeWithSpeakers } from '../../server/services/diarizationMerger.js'

describe('mergeWithSpeakers', () => {
  it('각 Whisper 세그먼트에 가장 오버랩이 큰 화자를 할당한다', () => {
    const whisperSegments = [
      { id: 0, start: 0.0, end: 5.0, text: '안녕하세요' },
      { id: 1, start: 5.1, end: 10.0, text: '네 반갑습니다' },
      { id: 2, start: 10.5, end: 15.0, text: '회의를 시작하겠습니다' },
    ]
    const diarizeSegments = [
      { speaker: 'SPEAKER_00', start: 0.0, end: 6.0 },
      { speaker: 'SPEAKER_01', start: 6.0, end: 11.0 },
      { speaker: 'SPEAKER_00', start: 11.0, end: 15.0 },
    ]
    const result = mergeWithSpeakers(whisperSegments, diarizeSegments)
    expect(result).toHaveLength(3)
    expect(result[0].speaker).toBe('SPEAKER_00')
    expect(result[0].text).toBe('안녕하세요')
    expect(result[1].speaker).toBe('SPEAKER_01')
    expect(result[2].speaker).toBe('SPEAKER_00')
  })

  it('화자 세그먼트가 없으면 speaker를 null로 설정한다', () => {
    const whisperSegments = [{ id: 0, start: 0.0, end: 5.0, text: '테스트' }]
    const result = mergeWithSpeakers(whisperSegments, [])
    expect(result[0].speaker).toBeNull()
    expect(result[0].text).toBe('테스트')
  })

  it('whisper 세그먼트가 두 화자 경계에 걸치면 오버랩이 큰 쪽에 할당한다', () => {
    const whisperSegments = [{ id: 0, start: 4.0, end: 8.0, text: '경계 발언' }]
    const diarizeSegments = [
      { speaker: 'SPEAKER_00', start: 0.0, end: 5.5 },
      { speaker: 'SPEAKER_01', start: 5.5, end: 10.0 },
    ]
    const result = mergeWithSpeakers(whisperSegments, diarizeSegments)
    expect(result[0].speaker).toBe('SPEAKER_01')
  })
})
