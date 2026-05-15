import { ref } from 'vue'
import { transcribeAudio } from '../services/api.js'

const CHUNK_INTERVAL_MS = 15_000

// ── VAD (Voice Activity Detection) 튜닝 파라미터 ──
// SILENCE_THRESHOLD: 무음 판정 기준 (dB)
//   -35dB = 기본값 (일반 회의실 환경에 적합)
//   -40dB = 조용한 환경 (약간 더 민감)
//   -30dB = 소음이 있는 환경 (배경 소음을 확실히 걸러냄)
//   값을 낮출수록 민감 (작은 소리도 음성으로 인식), 높일수록 둔감 (큰 소리만 음성으로 인식)
const SILENCE_THRESHOLD = -35

// ENERGY_CHECK_INTERVAL: 에너지 측정 주기 (ms)
//   100ms = 기본값 (초당 10회 측정, 정확도와 성능 균형)
//   50ms  = 더 빈번한 측정 (짧은 발화도 놓치지 않음, CPU 사용량 약간 증가)
//   200ms = 측정 빈도 감소 (성능 우선, 아주 짧은 발화를 놓칠 수 있음)
const ENERGY_CHECK_INTERVAL = 100

// VOICE_RATIO_THRESHOLD: 청크 내 음성 프레임 비율 최소 기준 (0.0 ~ 1.0)
//   한 청크(15초) 동안 측정된 프레임 중 이 비율 이상이 음성이어야 Whisper로 전송
//   0.05 = 기본값 (최소 5%, 약 0.75초 이상 음성이 있어야 전송)
//   0.02 = 더 민감 (약 0.3초 이상 음성이면 전송)
//   0.10 = 더 엄격 (약 1.5초 이상 음성이어야 전송)
const VOICE_RATIO_THRESHOLD = 0.05

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

  // ── VAD (Voice Activity Detection) ──
  let audioContext = null
  let analyserNode = null
  let vadInterval = null
  let voiceFrameCount = 0   // 음성이 감지된 프레임 수
  let totalFrameCount = 0   // 전체 측정 프레임 수

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
  // VAD: 오디오 에너지 측정
  // ─────────────────────────────────────────────────

  function setupVAD(stream) {
    audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)()
    const source = audioContext.createMediaStreamSource(stream)
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 2048
    source.connect(analyserNode)
    // analyserNode을 destination에 연결하지 않음 → 스피커 출력 없이 분석만 수행
  }

  function startVADMonitor() {
    voiceFrameCount = 0
    totalFrameCount = 0
    const dataArray = new Float32Array(analyserNode.fftSize)

    vadInterval = setInterval(() => {
      if (!analyserNode) return
      analyserNode.getFloatTimeDomainData(dataArray)

      // RMS(Root Mean Square)로 에너지를 dB로 변환
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      const dB = rms > 0 ? 20 * Math.log10(rms) : -100

      totalFrameCount++
      if (dB > SILENCE_THRESHOLD) {
        voiceFrameCount++
      }
    }, ENERGY_CHECK_INTERVAL)
  }

  function stopVADMonitor() {
    if (vadInterval) {
      clearInterval(vadInterval)
      vadInterval = null
    }
  }

  function cleanupVAD() {
    stopVADMonitor()
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
      analyserNode = null
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

      // VAD: 청크 내 음성 비율이 기준 이상일 때만 Whisper로 전송
      const voiceRatio = totalFrameCount > 0 ? voiceFrameCount / totalFrameCount : 0
      if (voiceRatio >= VOICE_RATIO_THRESHOLD) {
        sendChunk(blob, startSec, endSec)
      }
      // 다음 청크를 위해 VAD 카운터 리셋
      voiceFrameCount = 0
      totalFrameCount = 0
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
      setupVAD(stream)
      startVADMonitor()
      startChunkRecorder(stream)
      chunkInterval = setInterval(() => {
        if (!chunkRecorder || chunkRecorder.state === 'inactive') return
        chunkRecorder.stop() // onstop → sendChunk 호출 (VAD 통과 시에만)
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
    cleanupVAD()
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
