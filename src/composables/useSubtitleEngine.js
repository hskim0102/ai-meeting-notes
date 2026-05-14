import { ref } from 'vue'
import { transcribeAudio } from '../services/api.js'

const CHUNK_INTERVAL_MS = 15_000

export function useSubtitleEngine() {
  const segments = ref([])
  const isListening = ref(false)
  const isSpeechSupported = ref(
    'SpeechRecognition' in globalThis || 'webkitSpeechRecognition' in globalThis
  )

  let recognition = null
  let chunkRecorder = null
  let chunkInterval = null
  let chunkBlobs = []
  let chunkStartSec = 0
  let recordingStartTs = 0
  let restartCount = 0
  const MAX_RESTARTS = 3
  let currentMimeType = 'audio/webm'
  let isSendingChunk = false

  // ─────────────────────────────────────────────────
  // 세그먼트 조작
  // ─────────────────────────────────────────────────

  function nowSec() {
    return Math.floor((Date.now() - recordingStartTs) / 1000)
  }

  function addOrUpdateInterim(text) {
    const idx = segments.value.findIndex(s => s.status === 'interim')
    const seg = {
      id: 'interim',
      text,
      startTime: nowSec(),
      endTime: nowSec(),
      status: 'interim',
    }
    if (idx >= 0) segments.value[idx] = seg
    else segments.value.push(seg)
  }

  function confirmInterim(text) {
    const idx = segments.value.findIndex(s => s.status === 'interim')
    if (!text.trim()) {
      if (idx >= 0) segments.value.splice(idx, 1)
      return
    }
    const confirmed = {
      id: crypto.randomUUID(),
      text: text.trim(),
      startTime: idx >= 0 ? segments.value[idx].startTime : nowSec(),
      endTime: nowSec(),
      status: 'confirmed',
    }
    if (idx >= 0) segments.value[idx] = confirmed
    else segments.value.push(confirmed)
  }

  function replaceRangeWithWhisper(whisperSegs, startSec, endSec) {
    // 해당 시간 범위의 비-interim 세그먼트 제거
    segments.value = segments.value.filter(s =>
      s.status === 'interim' || s.startTime < startSec || s.startTime >= endSec
    )
    if (!whisperSegs.length) return

    const converted = whisperSegs
      .map(s => ({
        id: crypto.randomUUID(),
        text: s.text.trim(),
        startTime: startSec + (s.start || 0),
        endTime: startSec + (s.end || 0),
        status: 'whisper',
      }))
      .filter(s => s.text)

    // interim 앞에 삽입, 없으면 끝에 추가
    const interimIdx = segments.value.findIndex(s => s.status === 'interim')
    if (interimIdx >= 0) {
      segments.value.splice(interimIdx, 0, ...converted)
    } else {
      segments.value.push(...converted)
    }
  }

  // ─────────────────────────────────────────────────
  // Whisper 청크 전송
  // ─────────────────────────────────────────────────

  async function sendChunk(blob, startSec, endSec) {
    if (!blob || blob.size < 1000) return
    if (isSendingChunk) return // 이전 요청 진행 중이면 스킵 (폭주 방지)
    isSendingChunk = true
    try {
      const file = new File([blob], `chunk_${Date.now()}.webm`, { type: 'audio/webm' })
      const result = await transcribeAudio(file, 'ko')
      if (result.success && result.data.segments?.length > 0) {
        replaceRangeWithWhisper(result.data.segments, startSec, endSec)
      }
    } catch {
      // 조용히 무시 — confirmed 세그먼트 유지
    } finally {
      isSendingChunk = false
    }
  }

  // ─────────────────────────────────────────────────
  // 청크 MediaRecorder
  // ─────────────────────────────────────────────────

  function startChunkRecorder(stream) {
    chunkBlobs = []
    chunkRecorder = new MediaRecorder(stream, { mimeType: currentMimeType })

    chunkRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunkBlobs.push(e.data)
    }

    chunkRecorder.onstop = () => {
      if (chunkBlobs.length === 0) return
      const blob = new Blob(chunkBlobs, { type: 'audio/webm' })
      const startSec = chunkStartSec
      const endSec = nowSec()
      chunkStartSec = endSec
      chunkBlobs = []
      sendChunk(blob, startSec, endSec)
    }

    chunkRecorder.start()
  }

  // ─────────────────────────────────────────────────
  // SpeechRecognition
  // ─────────────────────────────────────────────────

  function startRecognition() {
    if (!isSpeechSupported.value) return

    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition
    recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'

    recognition.onresult = (event) => {
      restartCount = 0 // 인식 성공 시 카운트 리셋 (일시적 에러로 영구 중단 방지)
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          confirmInterim(r[0].transcript)
        } else {
          interimText += r[0].transcript
        }
      }
      if (interimText) addOrUpdateInterim(interimText)
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      if (restartCount < MAX_RESTARTS) {
        restartCount++
        setTimeout(() => {
          if (isListening.value) {
            try { recognition?.start() } catch { /* ignore */ }
          }
        }, 1000)
      } else {
        // Web Speech 포기 → Whisper 청크 전용 모드
        isSpeechSupported.value = false
      }
    }

    recognition.onend = () => {
      if (isListening.value && isSpeechSupported.value) {
        try { recognition.start() } catch { /* ignore */ }
      }
    }

    recognition.start()
  }

  // ─────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────

  function startSubtitles(stream) {
    recordingStartTs = Date.now()
    chunkStartSec = 0
    restartCount = 0
    isListening.value = true
    segments.value = []

    currentMimeType = (typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    startRecognition()

    if (stream) {
      startChunkRecorder(stream)
      chunkInterval = setInterval(() => {
        if (!chunkRecorder || chunkRecorder.state === 'inactive') return
        chunkRecorder.stop() // onstop → sendChunk 호출
        setTimeout(() => {
          if (isListening.value && stream.active) {
            startChunkRecorder(stream)
          }
        }, 100)
      }, CHUNK_INTERVAL_MS)
    }
  }

  function stopSubtitles() {
    isListening.value = false

    if (recognition) {
      recognition.stop()
      recognition = null
    }
    if (chunkInterval) {
      clearInterval(chunkInterval)
      chunkInterval = null
    }
    // 마지막 청크 전송
    if (chunkRecorder && chunkRecorder.state !== 'inactive') {
      chunkRecorder.stop()
    }
  }

  function clearSegments() {
    segments.value = []
    restartCount = 0
    // 새 녹음을 위해 Web Speech API 재활성화
    isSpeechSupported.value = (
      'SpeechRecognition' in globalThis || 'webkitSpeechRecognition' in globalThis
    )
  }

  return {
    segments,
    isListening,
    isSpeechSupported,
    startSubtitles,
    stopSubtitles,
    clearSegments,
  }
}
