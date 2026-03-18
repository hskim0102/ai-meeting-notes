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
export async function transcribeAudio(file, language = 'ko', onProgress = null) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('language', language)

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
