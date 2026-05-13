# 실시간 자막 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회의 녹음 중 Web Speech API로 즉각적인 자막을 표시하고, 15초마다 Whisper API로 정확한 텍스트로 교체한다.

**Architecture:** `useSubtitleEngine.js` composable이 SpeechRecognition과 청크 MediaRecorder를 관리한다. `SubtitleOverlay.vue`가 화면 하단에 고정 자막을 렌더링한다. `LiveRecorder.vue`에서 두 컴포넌트를 연결한다.

**Tech Stack:** Vue 3 Composition API, Web Speech API (SpeechRecognition), MediaRecorder API, OpenAI Whisper (`/api/transcribe`), Tailwind CSS, Vitest

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/composables/useSubtitleEngine.js` | 신규 | SpeechRecognition + 청크 스케줄러 + 세그먼트 상태 관리 |
| `src/components/SubtitleOverlay.vue` | 신규 | 하단 고정 오버레이 UI, 스크롤 히스토리 |
| `src/components/LiveRecorder.vue` | 수정 | composable + overlay 연결 |
| `tests/unit/subtitleEngine.test.js` | 신규 | 세그먼트 조작 로직 단위 테스트 |

---

## Task 1: useSubtitleEngine composable + 단위 테스트

**Files:**
- Create: `src/composables/useSubtitleEngine.js`
- Create: `tests/unit/subtitleEngine.test.js`

---

- [ ] **Step 1-1: 테스트 파일 생성 (실패 상태 확인용)**

`tests/unit/subtitleEngine.test.js` 파일을 생성한다.

```js
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

    vi.stubGlobal('SpeechRecognition', vi.fn(() => mockRecognition))
    vi.stubGlobal('MediaRecorder', Object.assign(
      vi.fn(() => mockRecorder),
      { isTypeSupported: vi.fn(() => true) }
    ))
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

    // interim 결과 시뮬레이션
    mockRecognition.onresult({
      resultIndex: 0,
      results: [
        Object.assign(['안녕하세요'], { isFinal: false })
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
      results: [Object.assign(['임시 텍스트'], { isFinal: false })]
    })
    expect(segments.value[0].status).toBe('interim')

    // final로 확정
    mockRecognition.onresult({
      resultIndex: 0,
      results: [Object.assign(['확정된 텍스트'], { isFinal: true })]
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
      results: [Object.assign(['텍스트'], { isFinal: true })]
    })
    expect(segments.value.length).toBeGreaterThan(0)

    clearSegments()
    expect(segments.value).toHaveLength(0)
  })

  it('SpeechRecognition 미지원 시 isSpeechSupported가 false이다', async () => {
    vi.unstubAllGlobals()
    // SpeechRecognition 없는 환경 시뮬레이션
    vi.stubGlobal('MediaRecorder', Object.assign(
      vi.fn(() => mockRecorder),
      { isTypeSupported: vi.fn(() => false) }
    ))

    const { useSubtitleEngine } = await import('../../src/composables/useSubtitleEngine.js')
    const { isSpeechSupported } = useSubtitleEngine()

    expect(isSpeechSupported.value).toBe(false)
  })
})
```

- [ ] **Step 1-2: 테스트 실행 → 실패 확인**

```bash
cd D:/Project/ai-meeting-notes
npx vitest run tests/unit/subtitleEngine.test.js
```

Expected: `Cannot find module '../../src/composables/useSubtitleEngine.js'` 오류

---

- [ ] **Step 1-3: `useSubtitleEngine.js` 구현**

`src/composables/useSubtitleEngine.js` 파일을 생성한다.

```js
import { ref } from 'vue'
import { transcribeAudio } from '../services/api.js'

const CHUNK_INTERVAL_MS = 15_000

export function useSubtitleEngine() {
  const segments = ref([])
  const isListening = ref(false)
  const isSpeechSupported = ref(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
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

  // ─────────────────────────────────────────────────
  // 세그먼트 조작 (내부 순수 함수)
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
    try {
      const file = new File([blob], `chunk_${Date.now()}.webm`, { type: 'audio/webm' })
      const result = await transcribeAudio(file, 'ko')
      if (result.success && result.data.segments?.length > 0) {
        replaceRangeWithWhisper(result.data.segments, startSec, endSec)
      }
    } catch {
      // 조용히 무시 — confirmed 세그먼트 유지
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

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'ko-KR'

    recognition.onresult = (event) => {
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
```

- [ ] **Step 1-4: 테스트 실행 → 통과 확인**

```bash
npx vitest run tests/unit/subtitleEngine.test.js
```

Expected: `5 tests passed`

- [ ] **Step 1-5: 커밋**

```bash
git add src/composables/useSubtitleEngine.js tests/unit/subtitleEngine.test.js
git commit -m "feat: useSubtitleEngine composable - 실시간 자막 엔진"
```

---

## Task 2: SubtitleOverlay.vue 컴포넌트

**Files:**
- Create: `src/components/SubtitleOverlay.vue`

---

- [ ] **Step 2-1: `SubtitleOverlay.vue` 생성**

`src/components/SubtitleOverlay.vue` 파일을 생성한다.

```vue
<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  segments: { type: Array, required: true },
  isListening: { type: Boolean, default: false },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const isMinimized = ref(false)
const scrollContainer = ref(null)
const isUserScrolling = ref(false)
let scrollTimeout = null

// 새 세그먼트 추가 시 자동 스크롤
// (사용자가 위로 스크롤 중이면 건너뜀)
watch(
  () => props.segments.length,
  async () => {
    if (isUserScrolling.value || isMinimized.value) return
    await nextTick()
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  }
)

function onScroll() {
  const el = scrollContainer.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
  if (!atBottom) {
    isUserScrolling.value = true
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isUserScrolling.value = false
    }, 3000)
  } else {
    isUserScrolling.value = false
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 shadow-2xl transition-all duration-300"
      :style="isMinimized ? 'height: 3rem' : 'height: 14rem'"
    >
      <!-- 헤더바 -->
      <div class="flex items-center justify-between px-4 h-12 border-b border-slate-700/50 shrink-0">
        <div class="flex items-center gap-2">
          <div
            v-if="isListening"
            class="w-2 h-2 rounded-full bg-red-400 animate-pulse"
          ></div>
          <svg
            v-else
            class="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
          <span class="text-sm font-medium text-slate-200">실시간 자막</span>
          <span
            v-if="!isSpeechAvailable"
            class="text-xs text-amber-400 ml-1"
          >(Whisper 전용 모드)</span>
        </div>
        <div class="flex items-center gap-1">
          <!-- 최소화 버튼 -->
          <button
            @click="isMinimized = !isMinimized"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            :title="isMinimized ? '펼치기' : '최소화'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                v-if="isMinimized"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
          <!-- 닫기 버튼 -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="닫기"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 자막 스크롤 영역 -->
      <div
        v-if="!isMinimized"
        ref="scrollContainer"
        @scroll="onScroll"
        class="overflow-y-auto px-4 py-2 space-y-1"
        style="height: calc(14rem - 3rem)"
      >
        <!-- 빈 상태 -->
        <div
          v-if="segments.length === 0 && isListening"
          class="flex items-center gap-2 text-slate-500 text-sm pt-2"
        >
          <div class="flex gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          <span>음성을 인식하고 있습니다...</span>
        </div>

        <!-- 세그먼트 목록 -->
        <div
          v-for="seg in segments"
          :key="seg.id"
          class="flex items-start gap-3 text-sm py-0.5"
          :class="{
            'opacity-60 border-l-2 border-dashed border-slate-600 pl-2':
              seg.status === 'interim',
            'text-slate-200':
              seg.status === 'confirmed',
            'text-white font-medium border-l-2 border-sky-500 pl-2':
              seg.status === 'whisper',
          }"
        >
          <!-- 타임스탬프 -->
          <span class="text-xs text-slate-500 shrink-0 mt-0.5 font-mono w-10">
            {{ formatTime(seg.startTime) }}
          </span>
          <!-- 텍스트 -->
          <span class="flex-1 text-slate-200" :class="{ 'text-slate-400': seg.status === 'interim' }">
            {{ seg.text }}
            <!-- 깜빡이는 커서 (interim) -->
            <span
              v-if="seg.status === 'interim'"
              class="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle"
            ></span>
          </span>
          <!-- Whisper 인증 아이콘 -->
          <span v-if="seg.status === 'whisper'" class="text-sky-400 shrink-0 text-xs mt-0.5">✦</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
```

> **주의:** template에서 `isSpeechAvailable` prop이 참조되어 있지만 props에 없다. 다음 Step에서 prop을 추가한다.

- [ ] **Step 2-2: `isSpeechAvailable` prop 추가**

Step 2-1의 `defineProps`를 다음으로 교체한다.

```js
const props = defineProps({
  segments: { type: Array, required: true },
  isListening: { type: Boolean, default: false },
  visible: { type: Boolean, default: false },
  isSpeechAvailable: { type: Boolean, default: true },
})
```

- [ ] **Step 2-3: 커밋**

```bash
git add src/components/SubtitleOverlay.vue
git commit -m "feat: SubtitleOverlay 컴포넌트 - 하단 고정 실시간 자막 UI"
```

---

## Task 3: LiveRecorder.vue 연결

**Files:**
- Modify: `src/components/LiveRecorder.vue`

---

- [ ] **Step 3-1: import 추가**

`LiveRecorder.vue`의 `<script setup>` 상단 import 블록에 다음을 추가한다.

기존:
```js
import { ref, computed, onBeforeUnmount } from 'vue'
import { transcribeAudio, saveRecording } from '../services/api.js'
```

교체:
```js
import { ref, computed, onBeforeUnmount } from 'vue'
import { transcribeAudio, saveRecording } from '../services/api.js'
import { useSubtitleEngine } from '../composables/useSubtitleEngine.js'
import SubtitleOverlay from './SubtitleOverlay.vue'
```

- [ ] **Step 3-2: composable 연결 + showSubtitle 상태 추가**

`// ── Props 및 이벤트 정의 ──` 블록 바로 다음, `// 상태 관리` 섹션 **앞**에 추가한다.

```js
// ── 자막 엔진 ──
const { segments, isListening, isSpeechSupported, startSubtitles, stopSubtitles, clearSegments } = useSubtitleEngine()
const showSubtitle = ref(false)
```

- [ ] **Step 3-3: `startRecording` 함수에 자막 시작 연결**

`startRecording()` 내부에서 `mediaRecorder.start(1000)` 다음 줄에 추가한다.

기존:
```js
    mediaRecorder.start(1000)
    status.value = 'recording'
    elapsedSeconds.value = 0
```

교체:
```js
    mediaRecorder.start(1000)
    status.value = 'recording'
    elapsedSeconds.value = 0

    // 자막 시작
    showSubtitle.value = true
    startSubtitles(mediaStream)
```

- [ ] **Step 3-4: `stopRecording` 함수에 자막 중지 연결**

`stopRecording()` 함수 내부, `if (timerInterval)` 블록 **다음**에 추가한다.

기존:
```js
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}
```

교체:
```js
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  stopSubtitles()
}
```

- [ ] **Step 3-5: `discardRecording` 함수에 자막 초기화 연결**

`discardRecording()` 함수 내 `status.value = 'idle'` 다음에 추가한다.

기존:
```js
function discardRecording() {
  recordedBlob.value = null
  audioChunks = []
  elapsedSeconds.value = 0
  savedRecordingId.value = null
  status.value = 'idle'
}
```

교체:
```js
function discardRecording() {
  recordedBlob.value = null
  audioChunks = []
  elapsedSeconds.value = 0
  savedRecordingId.value = null
  status.value = 'idle'
  clearSegments()
  showSubtitle.value = false
}
```

- [ ] **Step 3-6: `onBeforeUnmount`에 자막 정리 추가**

기존:
```js
onBeforeUnmount(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
```

교체:
```js
onBeforeUnmount(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  stopSubtitles()
```

- [ ] **Step 3-7: template에 `SubtitleOverlay` 추가 + 하단 여백 추가**

`LiveRecorder.vue` template의 최상위 `<div class="bg-white rounded-xl ...">` 닫는 태그 `</div>` **바로 다음**에 추가한다.

```vue
    <!-- 실시간 자막 오버레이 -->
    <SubtitleOverlay
      :segments="segments"
      :isListening="isListening"
      :visible="showSubtitle"
      :isSpeechAvailable="isSpeechSupported"
      @close="showSubtitle = false"
    />
```

그리고 `status === 'recording'` 상태 div에 하단 여백 클래스를 추가한다.

기존:
```vue
    <div v-else-if="status === 'recording'" class="text-center py-6">
```

교체:
```vue
    <div v-else-if="status === 'recording'" class="text-center py-6" :class="{ 'pb-60': showSubtitle }">
```

- [ ] **Step 3-8: 전체 테스트 실행**

```bash
npx vitest run
```

Expected: 모든 기존 테스트 + 신규 5개 테스트 PASS

- [ ] **Step 3-9: 최종 커밋**

```bash
git add src/components/LiveRecorder.vue
git commit -m "feat: LiveRecorder에 실시간 자막 기능 연결"
```

---

## 수동 검증 체크리스트

구현 완료 후 브라우저에서 확인:

- [ ] 녹음 시작 시 화면 하단에 자막 오버레이가 슬라이드업으로 등장
- [ ] 말을 하면 회색 임시 자막(interim)이 즉시 표시됨
- [ ] 문장이 끝나면 confirmed(기본 색상)로 승격
- [ ] 15초 후 Whisper 결과가 도착하면 해당 구간이 ✦ 아이콘과 함께 교체됨
- [ ] 최소화 버튼으로 접기/펼치기 작동
- [ ] X 버튼으로 닫기 작동
- [ ] 새 세그먼트 추가 시 자동 스크롤, 위로 스크롤 시 자동 스크롤 중단
- [ ] 녹음 중지 후에도 오버레이 유지
- [ ] 삭제 버튼 클릭 시 오버레이 닫힘
