// Vite 프록시를 통해 /api → localhost:3001 로 전달
// 같은 origin 요청이므로 CORS 문제 없음
const API_BASE = '/api'

/**
 * 오디오 파일을 서버에 업로드하고 STT 결과를 받아옴
 * @param {File} file - 오디오 파일 객체
 * @param {string} language - 언어 코드 (기본값: 'ko')
 * @param {function} onProgress - 업로드 진행률 콜백 (0~100)
 * @returns {Promise<object>} - { success, data: { fullText, segments, meta } }
 */
export async function transcribeAudio(file, language = 'ko', onProgress = null, enableDiarization = false) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('language', language)
  if (enableDiarization) {
    formData.append('enableDiarization', 'true')
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/transcribe`)

    // 업로드 진행률 추적
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          reject(new Error(data.error || '전사 처리 실패'))
        }
      } catch {
        reject(new Error('서버 응답 파싱 실패'))
      }
    }

    xhr.onerror = () => reject(new Error('서버 연결 실패. 백엔드 서버가 실행 중인지 확인해주세요.'))
    xhr.send(formData)
  })
}

/**
 * 전사된 텍스트를 서버에 전송하여 Dify AI 요약을 받아옴
 * API 키는 서버 사이드에서만 사용되므로 브라우저에 노출되지 않음
 *
 * @param {string} transcript - 전사된 전체 텍스트
 * @returns {Promise<object>} - { success, data: { summary, actionItems, keywords, keyDecisions, sentiment } }
 */
export async function summarizeTranscript(transcript) {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'AI 요약 처리 실패')
  }

  return data
}

/**
 * 백엔드 서버 상태 확인
 */
export async function checkServerHealth() {
  const res = await fetch(`${API_BASE}/transcribe/health`)
  return res.json()
}

// ─────────────────────────────────────────────────
// 회의 CRUD API
// ─────────────────────────────────────────────────

/**
 * 회의 목록 조회 (DB)
 */
export async function fetchMeetings(params = {}, signal) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value)
  }
  const opts = signal ? { signal } : {}
  const res = await fetch(`${API_BASE}/meetings?${query}`, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '회의 목록 조회 실패')
  return data
}

/**
 * 회의 상세 조회 (DB)
 */
export async function fetchMeeting(id) {
  const res = await fetch(`${API_BASE}/meetings/${id}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '회의 조회 실패')
  return data
}

/**
 * 회의 생성 (DB 저장)
 */
export async function createMeeting(meeting) {
  const res = await fetch(`${API_BASE}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '회의 생성 실패')
  return data
}

/**
 * 대시보드 통계 조회 (DB)
 */
export async function fetchMeetingStats(signal) {
  const opts = signal ? { signal } : {}
  const res = await fetch(`${API_BASE}/meetings/stats`, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '통계 조회 실패')
  return data
}

/**
 * 액션 아이템 토글
 */
export async function toggleActionItem(meetingId, itemIndex) {
  const res = await fetch(`${API_BASE}/meetings/${meetingId}/action-items/${itemIndex}`, {
    method: 'PATCH',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '액션 아이템 수정 실패')
  return data
}

/**
 * 회의 수정 (DB 저장)
 */
export async function updateMeeting(id, meeting) {
  const res = await fetch(`${API_BASE}/meetings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '회의 수정 실패')
  return data
}

/**
 * 회의 화자 이름 매핑 업데이트
 */
export async function updateSpeakerMap(id, speakerMap) {
  const res = await fetch(`${API_BASE}/meetings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speakerMap }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '화자 매핑 수정 실패')
  return data
}

/**
 * 회의록 메일 발송
 * @param {number|string} id - 회의 ID
 * @param {object} payload - { recipients: [...], additionalRecipients: [...], subject: string }
 */
export async function sendMeetingEmail(id, payload) {
  const res = await fetch(`${API_BASE}/meetings/${id}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '메일 발송 실패')
  return data
}

// ─────────────────────────────────────────────────
// 회의 검색 API
// ─────────────────────────────────────────────────

/**
 * 회의 통합 검색
 * @param {object} params - { q, from, to, participants, tags, sort, page }
 * @returns {Promise<object>} - { success, data: { results, total, page, totalPages } }
 */
export async function searchMeetings(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value)
  }
  const res = await fetch(`${API_BASE}/search?${query}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '검색 실패')
  return data
}

/**
 * 검색 자동완성 제안
 * @param {string} q - 검색어
 * @returns {Promise<object>} - { success, data: [{ type, text, id? }] }
 */
export async function searchSuggest(q) {
  const res = await fetch(`${API_BASE}/search/suggest?q=${encodeURIComponent(q)}`)
  return res.json()
}

// ─────────────────────────────────────────────────
// 회의실 및 예약 API
// ─────────────────────────────────────────────────

/**
 * 회의실 목록 조회
 */
export async function fetchRooms() {
  const res = await fetch(`${API_BASE}/rooms`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '회의실 조회 실패')
  return data
}

/**
 * 회의실 가용성 조회
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {string} [startTime] - 시작 시간 (HH:MM)
 * @param {string} [endTime] - 종료 시간 (HH:MM)
 */
export async function fetchRoomAvailability(date, startTime, endTime) {
  const query = new URLSearchParams({ date })
  if (startTime) query.set('startTime', startTime)
  if (endTime) query.set('endTime', endTime)
  const res = await fetch(`${API_BASE}/rooms/availability?${query}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '가용성 조회 실패')
  return data
}

/**
 * 예약 목록 조회
 * @param {object} params - { roomId, date, weekStart }
 */
export async function fetchReservations(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const res = await fetch(`${API_BASE}/rooms/reservations/list?${query}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '예약 조회 실패')
  return data
}

/**
 * 예약 생성
 * @param {object} reservation - { roomId, title, date, startTime, endTime, organizer, participants }
 */
export async function createReservation(reservation) {
  const res = await fetch(`${API_BASE}/rooms/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservation),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '예약 생성 실패')
  return data
}

/**
 * 예약 취소
 * @param {string} id - 예약 ID
 */
export async function cancelReservation(id) {
  const res = await fetch(`${API_BASE}/rooms/reservations/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '예약 취소 실패')
  return data
}

// ─────────────────────────────────────────────────
// 녹음 보관 API
// ─────────────────────────────────────────────────

/**
 * 녹음 파일을 서버에 업로드 저장
 * @param {File|Blob} file - 오디오 파일
 * @param {number} duration - 녹음 길이 (초)
 * @param {function} onProgress - 업로드 진행률 콜백 (0~100)
 * @returns {Promise<object>} - { success, data: { id, fileName, fileSize, duration, status } }
 */
export async function saveRecording(file, duration = 0, onProgress = null) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('duration', String(duration))

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/recordings`)

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          reject(new Error(data.error || '녹음 저장 실패'))
        }
      } catch {
        reject(new Error('서버 응답 파싱 실패'))
      }
    }

    xhr.onerror = () => reject(new Error('서버 연결 실패'))
    xhr.send(formData)
  })
}

/**
 * 녹음 목록 조회
 * @param {string} [status] - 필터: 'pending' | 'transcribed' | 'completed'
 */
export async function fetchRecordings(status) {
  const query = status ? `?status=${status}` : ''
  const res = await fetch(`${API_BASE}/recordings${query}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '녹음 목록 조회 실패')
  return data
}

/**
 * 녹음 상세 조회
 */
export async function fetchRecording(id) {
  const res = await fetch(`${API_BASE}/recordings/${id}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '녹음 조회 실패')
  return data
}

/**
 * 녹음 파일 스트리밍 URL 반환
 */
export function getRecordingFileUrl(id) {
  return `${API_BASE}/recordings/${id}/file`
}

/**
 * 녹음 삭제
 */
export async function deleteRecording(id) {
  const res = await fetch(`${API_BASE}/recordings/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '녹음 삭제 실패')
  return data
}

/**
 * 저장된 녹음으로 STT 실행
 * @param {number} id - 녹음 ID
 * @param {string} language - 언어 코드
 * @returns {Promise<object>} - { success, data: { fullText, segments, meta } }
 */
export async function transcribeRecording(id, language = 'ko') {
  const res = await fetch(`${API_BASE}/recordings/${id}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'STT 변환 실패')
  return data
}
