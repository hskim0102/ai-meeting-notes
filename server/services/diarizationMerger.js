/**
 * diarizationMerger.js - 화자 분리 결과와 Whisper STT 결과를 병합
 */

// 두 구간의 겹치는 시간 길이를 계산
function overlapDuration(s1, e1, s2, e2) {
  const start = Math.max(s1, s2)
  const end = Math.min(e1, e2)
  return Math.max(0, end - start)
}

// Whisper 세그먼트 배열과 화자 분리 세그먼트 배열을 병합
// 각 Whisper 세그먼트에 가장 오버랩이 큰 화자를 할당
export function mergeWithSpeakers(whisperSegments, diarizeSegments) {
  return whisperSegments.map(seg => {
    // 화자 세그먼트가 없으면 speaker를 null로 설정
    if (diarizeSegments.length === 0) {
      return { ...seg, speaker: null }
    }

    let bestSpeaker = null
    let bestOverlap = 0

    // 모든 화자 세그먼트와 오버랩 계산 후 가장 큰 쪽 선택
    for (const ds of diarizeSegments) {
      const overlap = overlapDuration(seg.start, seg.end, ds.start, ds.end)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestSpeaker = ds.speaker
      }
    }

    return { id: seg.id, speaker: bestSpeaker, start: seg.start, end: seg.end, text: seg.text }
  })
}
