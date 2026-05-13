import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// SpeechRecognition, MediaRecorder, crypto를 브라우저 환경 없이 모킹
function makeMockRecognition() {
  return {
    continuous: false,
    interimResults: false,
    lang: '',
    onresult: null,
    onerror: null,
    onend: null,
    start: vi.fn(),
    stop: vi.fn(),
  }
}

function makeMockMediaRecorder(state = 'inactive') {
  const recorder = {
    state,
    ondataavailable: null,
    onstop: null,
    start: vi.fn(),
    stop: vi.fn(function () {
      this.state = 'inactive'
      if (this.onstop) this.onstop()
    }),
  }
  return recorder
}

describe('useSubtitleEngine — 세그먼트 로직', () => {
  let mockRecognition
  let mockRecorder
  let mockStream

  beforeEach(() => {
    mockRecognition = makeMockRecognition()
    mockRecorder = makeMockMediaRecorder()
    mockStream = { active: true, getTracks: () => [] }

    // 일반 함수(function 키워드)로 생성자 모킹 — arrow function은 new 사용 불가
    function MockSpeechRecognition() { return mockRecognition }
    vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)

    function MockMediaRecorder() { return mockRecorder }
    MockMediaRecorder.isTypeSupported = vi.fn(() => true)
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random()}`)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('startSubtitles 호출 시 SpeechRecognition이 시작된다', async () => {
    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { startSubtitles, isListening } = useSubtitleEngine()

    startSubtitles(mockStream)

    expect(isListening.value).toBe(true)
    expect(mockRecognition.start).toHaveBeenCalledOnce()
  })

  it('onresult interim 이벤트가 세그먼트를 추가한다', async () => {
    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { startSubtitles, segments } = useSubtitleEngine()

    startSubtitles(mockStream)

    // interim 결과 시뮬레이션 (SpeechRecognitionResult 포맷: r[0].transcript)
    mockRecognition.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: '안녕하세요', confidence: 0.9 }], { isFinal: false })
      ]
    })

    expect(segments.value).toHaveLength(1)
    expect(segments.value[0].status).toBe('interim')
    expect(segments.value[0].text).toBe('안녕하세요')
  })

  it('onresult final 이벤트가 interim을 confirmed로 승격한다', async () => {
    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { startSubtitles, segments } = useSubtitleEngine()

    startSubtitles(mockStream)

    // interim 먼저
    mockRecognition.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '임시 텍스트', confidence: 0.5 }], { isFinal: false })]
    })
    expect(segments.value[0].status).toBe('interim')

    // final로 확정
    mockRecognition.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '확정된 텍스트', confidence: 0.9 }], { isFinal: true })]
    })

    expect(segments.value).toHaveLength(1)
    expect(segments.value[0].status).toBe('confirmed')
    expect(segments.value[0].text).toBe('확정된 텍스트')
  })

  it('stopSubtitles 호출 시 isListening이 false가 된다', async () => {
    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { startSubtitles, stopSubtitles, isListening } = useSubtitleEngine()

    startSubtitles(mockStream)
    expect(isListening.value).toBe(true)

    stopSubtitles()
    expect(isListening.value).toBe(false)
  })

  it('clearSegments 호출 시 세그먼트 배열이 비워진다', async () => {
    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { startSubtitles, clearSegments, segments } = useSubtitleEngine()

    startSubtitles(mockStream)
    mockRecognition.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: '텍스트', confidence: 0.9 }], { isFinal: true })]
    })
    expect(segments.value.length).toBeGreaterThan(0)

    clearSegments()
    expect(segments.value).toHaveLength(0)
  })

  it('SpeechRecognition 미지원 시 isSpeechSupported가 false이다', async () => {
    vi.unstubAllGlobals()
    // SpeechRecognition 없는 환경 시뮬레이션 (SpeechRecognition 전역 없음)
    function MockMediaRecorder() { return mockRecorder }
    MockMediaRecorder.isTypeSupported = vi.fn(() => false)
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    // SpeechRecognition은 스텁하지 않음 → window에 없음

    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { isSpeechSupported } = useSubtitleEngine()

    expect(isSpeechSupported.value).toBe(false)
  })
})
