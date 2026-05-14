<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { transcribeAudio, saveRecording } from '../services/api.js'
import { useSubtitleEngine } from '../composables/useSubtitleEngine.js'
import SubtitleOverlay from './SubtitleOverlay.vue'

const { segments, isListening, isSpeechSupported, startSubtitles, stopSubtitles, clearSegments } = useSubtitleEngine()
const showSubtitle = ref(false)

const props = defineProps({
  enableDiarization: { type: Boolean, default: false },
  speakerCount: { type: Number, default: 0 },
})
const emit = defineEmits(['transcribed'])

const status = ref('idle')
let mediaRecorder = null
let mediaStream = null
let audioChunks = []
const recordedBlob = ref(null)
const elapsedSeconds = ref(0)
let timerInterval = null
const uploadProgress = ref(0)
const errorMessage = ref('')
let errorTimeout = null
const isSaving = ref(false)
const savedRecordingId = ref(null)
const saveProgress = ref(0)

const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const fileSizeText = computed(() => {
  if (!recordedBlob.value) return ''
  const bytes = recordedBlob.value.size
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`
})

function showError(message) {
  errorMessage.value = message
  if (errorTimeout) clearTimeout(errorTimeout)
  errorTimeout = setTimeout(() => { errorMessage.value = '' }, 5000)
}

async function autoSaveToServer() {
  if (!recordedBlob.value) return
  isSaving.value = true
  saveProgress.value = 0
  try {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}시${String(now.getMinutes()).padStart(2, '0')}분`
    const fileName = `회의녹음_${dateStr}_${timeStr}.webm`
    const file = new File([recordedBlob.value], fileName, { type: 'audio/webm' })
    const result = await saveRecording(file, elapsedSeconds.value, (progress) => {
      saveProgress.value = progress
    })
    if (result.success) {
      savedRecordingId.value = result.data.id
    }
  } catch (error) {
    console.warn(`[자동 저장 실패] ${error.message}`)
  } finally {
    isSaving.value = false
  }
}

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('이 브라우저는 마이크 녹음을 지원하지 않습니다. Chrome, Firefox, Edge를 사용해주세요.')
    return
  }
  if (typeof MediaRecorder === 'undefined') {
    showError('이 브라우저는 MediaRecorder API를 지원하지 않습니다.')
    return
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
    })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType })
    audioChunks = []
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
        if (audioChunks.length >= 60) {
          const merged = new Blob(audioChunks, { type: mimeType })
          audioChunks = [merged]
        }
      }
    }
    mediaRecorder.onstop = () => {
      recordedBlob.value = new Blob(audioChunks, { type: 'audio/webm' })
      status.value = 'recorded'
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
        mediaStream = null
      }
      autoSaveToServer()
    }
    mediaRecorder.onerror = (event) => {
      showError(`녹음 중 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`)
      stopRecording()
    }
    mediaRecorder.start(1000)
    status.value = 'recording'
    elapsedSeconds.value = 0
    showSubtitle.value = true
    startSubtitles(mediaStream)
    timerInterval = setInterval(() => { elapsedSeconds.value++ }, 1000)
  } catch (error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      showError('마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
    } else if (error.name === 'NotFoundError') {
      showError('마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.')
    } else {
      showError(`마이크 접근 오류: ${error.message}`)
    }
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  stopSubtitles()
}

function discardRecording() {
  recordedBlob.value = null
  audioChunks = []
  elapsedSeconds.value = 0
  savedRecordingId.value = null
  status.value = 'idle'
  clearSegments()
  showSubtitle.value = false
}

function downloadRecording() {
  if (!recordedBlob.value) return
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}시${String(now.getMinutes()).padStart(2, '0')}분`
  const fileName = `회의녹음_${dateStr}_${timeStr}.webm`
  const url = URL.createObjectURL(recordedBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function sendToServer() {
  if (!recordedBlob.value) return
  status.value = 'uploading'
  uploadProgress.value = 0
  try {
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}시${String(now.getMinutes()).padStart(2, '0')}분`
    const fileName = `회의녹음_${dateStr}_${timeStr}.webm`
    const file = new File([recordedBlob.value], fileName, { type: 'audio/webm' })
    const result = await transcribeAudio(file, 'ko', (progress) => {
      uploadProgress.value = progress
    }, props.enableDiarization, props.speakerCount)
    if (result.success) {
      result.data.audioBlobUrl = URL.createObjectURL(file)
      emit('transcribed', result.data)
      recordedBlob.value = null
      audioChunks = []
      elapsedSeconds.value = 0
      savedRecordingId.value = null
      status.value = 'idle'
    } else {
      showError(result.error || '전사 처리에 실패했습니다.')
      status.value = 'recorded'
    }
  } catch (error) {
    showError(error.message)
    status.value = 'recorded'
  }
}

onBeforeUnmount(() => {
  stopSubtitles()
  if (timerInterval) clearInterval(timerInterval)
  if (errorTimeout) clearTimeout(errorTimeout)
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop()
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop())
})
</script>

<template>
  <!-- 메인 카드 -->
  <div class="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
    <!-- 배경 그라디언트 장식 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-red-50/60 blur-2xl"></div>
      <div class="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-primary-50/40 blur-2xl"></div>
    </div>

    <!-- 헤더 -->
    <div class="relative flex items-center justify-between px-6 py-4 border-b border-slate-100">
      <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-sm">
          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </div>
        실시간 회의 녹음
      </h3>

      <!-- LIVE 배지 -->
      <Transition name="badge-fade">
        <span
          v-if="status === 'recording'"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-red-500 text-white rounded-full text-[11px] font-bold tracking-wider shadow-sm shadow-red-200"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          LIVE
        </span>
      </Transition>
    </div>

    <!-- 컨텐츠 영역 -->
    <div class="relative px-6 py-6">

      <!-- ════════════════════════ -->
      <!-- 상태 1: 대기 (idle)      -->
      <!-- ════════════════════════ -->
      <Transition name="state-fade" mode="out-in">
        <div v-if="status === 'idle'" key="idle" class="flex flex-col items-center py-6">
          <!-- 마이크 버튼 + 애니메이션 링 -->
          <div class="relative mb-7">
            <!-- 외곽 회전 점선 링 -->
            <div class="absolute -inset-8 rounded-full border-2 border-dashed border-red-200/70 animate-slow-spin"></div>
            <!-- 중간 글로우 링 -->
            <div class="absolute -inset-4 rounded-full bg-gradient-to-br from-red-50 to-rose-50 opacity-80"></div>
            <!-- 버튼 -->
            <button
              @click="startRecording"
              class="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200/60 hover:shadow-red-300/70 hover:scale-105 active:scale-95 transition-all duration-200 group"
            >
              <svg class="w-9 h-9 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          <h4 class="text-base font-semibold text-slate-800 mb-1.5">녹음 시작</h4>
          <p class="text-sm text-slate-500 text-center">버튼을 눌러 회의 녹음을 시작하세요</p>
          <p class="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            브라우저 마이크 권한이 필요합니다
          </p>
        </div>

        <!-- ════════════════════════ -->
        <!-- 상태 2: 녹음 중 (recording) -->
        <!-- ════════════════════════ -->
        <div v-else-if="status === 'recording'" key="recording" class="flex flex-col items-center py-5">
          <!-- 오디오 파형 애니메이션 -->
          <div class="flex items-center justify-center gap-1 h-14 mb-5">
            <div v-for="i in 4" :key="`l${i}`"
              class="w-1.5 rounded-full bg-red-300 wave-bar"
              :style="{ '--delay': `${i * 80}ms` }"
            ></div>
            <!-- 중앙 정지 버튼 -->
            <button
              @click="stopRecording"
              class="mx-3 w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all duration-150 shrink-0"
              title="녹음 중지"
            >
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <div v-for="i in 4" :key="`r${i}`"
              class="w-1.5 rounded-full bg-red-300 wave-bar"
              :style="{ '--delay': `${(i + 4) * 80}ms` }"
            ></div>
          </div>

          <!-- 타이머 -->
          <div class="text-center mb-4">
            <p class="text-4xl font-mono font-bold text-slate-900 tracking-widest tabular-nums">
              {{ formattedTime }}
            </p>
            <div class="flex items-center justify-center gap-1.5 mt-2">
              <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <p class="text-xs text-red-500 font-semibold tracking-wide uppercase">녹음 중</p>
            </div>
          </div>

          <!-- 중지 버튼 텍스트 -->
          <button
            @click="stopRecording"
            class="px-7 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            녹음 중지
          </button>
        </div>

        <!-- ════════════════════════ -->
        <!-- 상태 3: 녹음 완료 (recorded) -->
        <!-- ════════════════════════ -->
        <div v-else-if="status === 'recorded'" key="recorded" class="py-2">
          <!-- 완료 정보 카드 -->
          <div class="bg-gradient-to-br from-slate-50 to-green-50/50 border border-slate-200 rounded-xl p-4 mb-5">
            <div class="flex items-center gap-3">
              <!-- 체크 아이콘 -->
              <div class="w-10 h-10 rounded-xl bg-success-500/10 border border-success-500/20 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-800">녹음 완료</p>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span class="text-xs text-slate-500 font-mono font-medium">{{ formattedTime }}</span>
                  <span class="text-slate-300 text-xs">·</span>
                  <span class="text-xs text-slate-500">{{ fileSizeText }}</span>
                  <span class="text-slate-300 text-xs">·</span>
                  <!-- 서버 저장 상태 -->
                  <span v-if="isSaving" class="text-xs text-amber-500 flex items-center gap-1">
                    <div class="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full"></div>
                    서버 저장 중...
                  </span>
                  <span v-else-if="savedRecordingId" class="text-xs text-success-500 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    서버에 보관됨
                  </span>
                  <span v-else class="text-xs text-slate-400">WebM</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 액션 버튼 -->
          <div class="space-y-3">
            <!-- 메인: AI 텍스트 변환 -->
            <button
              @click="sendToServer"
              class="w-full px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl text-sm font-semibold hover:from-primary-600 hover:to-accent-600 transition-all duration-200 inline-flex items-center justify-center gap-2.5 shadow-md shadow-primary-200/40"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI 텍스트 변환 시작
            </button>

            <!-- 서브 액션 -->
            <div class="flex items-center gap-2">
              <button
                @click="downloadRecording"
                class="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 inline-flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                저장
              </button>
              <button
                @click="discardRecording"
                class="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all duration-150 inline-flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                삭제
              </button>
            </div>
          </div>
        </div>

        <!-- ════════════════════════ -->
        <!-- 상태 4: 업로드 중 (uploading) -->
        <!-- ════════════════════════ -->
        <div v-else-if="status === 'uploading'" key="uploading" class="py-6">
          <!-- 단계 표시 -->
          <div class="flex items-center justify-center gap-3 mb-6">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                :class="uploadProgress < 100 ? 'bg-primary-500 text-white' : 'bg-success-500 text-white'"
              >
                <svg v-if="uploadProgress >= 100" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span v-else>1</span>
              </div>
              <span class="text-xs font-medium" :class="uploadProgress < 100 ? 'text-primary-500' : 'text-success-500'">업로드</span>
            </div>
            <div class="w-8 h-px" :class="uploadProgress >= 100 ? 'bg-success-500' : 'bg-slate-200'"></div>
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                :class="uploadProgress >= 100 ? 'bg-accent-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'"
              >
                <svg v-if="uploadProgress >= 100" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span v-else>2</span>
              </div>
              <span class="text-xs font-medium" :class="uploadProgress >= 100 ? 'text-accent-500' : 'text-slate-400'">AI 분석</span>
            </div>
          </div>

          <!-- 진행률 바 -->
          <div class="mb-3">
            <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                :class="uploadProgress >= 100
                  ? 'bg-gradient-to-r from-accent-400 to-accent-600 animate-pulse w-full'
                  : 'bg-gradient-to-r from-primary-400 to-primary-600'"
                :style="uploadProgress < 100 ? { width: `${uploadProgress}%` } : {}"
              ></div>
            </div>
          </div>

          <!-- 상태 텍스트 -->
          <div class="text-center">
            <div class="flex items-center justify-center gap-2 mb-1">
              <div class="animate-spin w-4 h-4 border-2 rounded-full"
                :class="uploadProgress >= 100
                  ? 'border-accent-500 border-t-transparent'
                  : 'border-primary-500 border-t-transparent'"
              ></div>
              <p class="text-sm font-medium text-slate-700">
                {{ uploadProgress < 100 ? '오디오 파일 업로드 중...' : 'AI가 음성을 분석하고 있습니다...' }}
              </p>
            </div>
            <p class="text-xs text-slate-400">
              {{ uploadProgress < 100
                ? `${uploadProgress}% 완료`
                : '녹음 길이에 따라 1~3분 정도 소요될 수 있습니다'
              }}
            </p>
          </div>
        </div>
      </Transition>

      <!-- 에러 메시지 -->
      <Transition name="error-slide">
        <div
          v-if="errorMessage"
          class="mt-4 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl"
        >
          <svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p class="text-sm text-red-600 flex-1">{{ errorMessage }}</p>
          <button @click="errorMessage = ''" class="text-red-400 hover:text-red-600 shrink-0 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Transition>
    </div>
  </div>

  <!-- 실시간 자막 오버레이 -->
  <SubtitleOverlay
    :segments="segments"
    :isListening="isListening"
    :visible="showSubtitle"
    :isSpeechAvailable="isSpeechSupported"
    @close="showSubtitle = false"
  />
</template>

<style scoped>
/* 파형 바 애니메이션 */
.wave-bar {
  animation: wave 1s ease-in-out infinite alternate;
  animation-delay: var(--delay, 0ms);
  height: 24px;
}

@keyframes wave {
  0%   { height: 8px; opacity: 0.5; }
  100% { height: 40px; opacity: 1; }
}

/* 느린 회전 (점선 링) */
.animate-slow-spin {
  animation: slow-spin 12s linear infinite;
}
@keyframes slow-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* 상태 전환 페이드 */
.state-fade-enter-active,
.state-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.state-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.state-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* LIVE 배지 */
.badge-fade-enter-active,
.badge-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.badge-fade-enter-from,
.badge-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 에러 슬라이드 */
.error-slide-enter-active,
.error-slide-leave-active {
  transition: all 0.25s ease;
}
.error-slide-enter-from,
.error-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
