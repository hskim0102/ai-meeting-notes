<script setup>
/**
 * LiveRecorder.vue - 실시간 회의 녹음 컴포넌트
 * ─────────────────────────────────────────────────
 * 브라우저 MediaRecorder API를 활용하여 마이크로 직접 녹음하고,
 * 녹음된 오디오를 백엔드 서버로 전송하여 STT 처리하는 컴포넌트
 *
 * [상태 흐름]
 * idle → recording → recorded → uploading → idle (결과 emit)
 * ─────────────────────────────────────────────────
 */

import { ref, computed, onBeforeUnmount } from 'vue'
import { transcribeAudio, saveRecording } from '../services/api.js'

// ── 이벤트 정의: 전사 완료 시 부모 컴포넌트에 결과 전달 ──
const emit = defineEmits(['transcribed'])

// ─────────────────────────────────────────────────
// 상태 관리
// ─────────────────────────────────────────────────

// 녹음기 상태: 'idle' | 'recording' | 'recorded' | 'uploading'
const status = ref('idle')

// MediaRecorder 인스턴스 참조
let mediaRecorder = null

// 마이크 스트림 참조 (정리 시 트랙 중지용)
let mediaStream = null

// 녹음된 오디오 데이터 청크 배열
let audioChunks = []

// 녹음 완료 후 생성된 Blob 객체
const recordedBlob = ref(null)

// 녹음 시간 (초 단위)
const elapsedSeconds = ref(0)

// setInterval 참조 (정리용)
let timerInterval = null

// 업로드 진행률 (0~100)
const uploadProgress = ref(0)

// 에러 메시지 (Toast 대용)
const errorMessage = ref('')

// 에러 자동 숨김 타이머
let errorTimeout = null

// 서버 자동 저장 상태
const isSaving = ref(false)
const savedRecordingId = ref(null)
const saveProgress = ref(0)

// ─────────────────────────────────────────────────
// 계산된 속성
// ─────────────────────────────────────────────────

// 녹음 시간을 MM:SS 형식으로 포맷팅
const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

// 녹음된 파일 크기를 읽기 쉬운 형식으로 변환
const fileSizeText = computed(() => {
  if (!recordedBlob.value) return ''
  const bytes = recordedBlob.value.size
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`
})

// ─────────────────────────────────────────────────
// 에러 표시 유틸리티
// ─────────────────────────────────────────────────

/**
 * 에러 메시지를 표시하고 5초 후 자동으로 숨김
 * @param {string} message - 표시할 에러 메시지
 */
function showError(message) {
  errorMessage.value = message
  // 기존 타이머가 있으면 제거
  if (errorTimeout) clearTimeout(errorTimeout)
  errorTimeout = setTimeout(() => {
    errorMessage.value = ''
  }, 5000)
}

// ─────────────────────────────────────────────────
// 서버 자동 저장 (녹음 완료 시 백그라운드 실행)
// ─────────────────────────────────────────────────

/**
 * 녹음된 Blob을 서버 recordings API에 자동 저장
 * - 페이지를 떠나도 녹음 파일이 서버에 보존됨
 * - 저장 실패해도 로컬 Blob은 유지 (STT 전송 가능)
 */
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
      console.log(`[자동 저장] 녹음 ID: ${result.data.id}`)
    }
  } catch (error) {
    console.warn(`[자동 저장 실패] ${error.message}`)
    // 저장 실패해도 로컬 Blob은 유지되므로 에러 표시하지 않음
  } finally {
    isSaving.value = false
  }
}

// ─────────────────────────────────────────────────
// 녹음 시작
// ─────────────────────────────────────────────────

/**
 * 마이크 권한을 획득하고 MediaRecorder로 녹음을 시작
 *
 * [처리 순서]
 * 1. 브라우저 MediaRecorder 지원 여부 확인
 * 2. getUserMedia()로 마이크 권한 요청
 * 3. audio/webm 포맷으로 MediaRecorder 생성
 * 4. 녹음 시작 + 타이머 시작
 */
async function startRecording() {
  // ── 1단계: 브라우저 지원 여부 확인 ──
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('이 브라우저는 마이크 녹음을 지원하지 않습니다. Chrome, Firefox, Edge를 사용해주세요.')
    return
  }

  if (typeof MediaRecorder === 'undefined') {
    showError('이 브라우저는 MediaRecorder API를 지원하지 않습니다.')
    return
  }

  try {
    // ── 2단계: 마이크 권한 요청 ──
    // 사용자가 "허용"을 클릭해야 스트림을 받을 수 있음
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,  // 에코 캔슬링 활성화 (회의 환경 최적화)
        noiseSuppression: true,  // 노이즈 제거 활성화
        sampleRate: 44100,        // 표준 샘플레이트
      },
    })

    // ── 3단계: MediaRecorder 설정 ──
    // audio/webm 포맷으로 설정 (용량 최적화 + 브라우저 호환성)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'   // Opus 코덱 (최고 압축률)
      : 'audio/webm'                // 기본 webm

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType })

    // 녹음 데이터 청크 초기화
    audioChunks = []

    // ── MediaRecorder 이벤트 핸들러 설정 ──

    // ondataavailable: 녹음 데이터가 생성될 때마다 청크 배열에 추가
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    // onstop: 녹음이 중지되면 모든 청크를 하나의 Blob으로 병합하고 서버에 자동 저장
    mediaRecorder.onstop = () => {
      // 모든 오디오 청크를 하나의 webm Blob으로 합침
      recordedBlob.value = new Blob(audioChunks, { type: 'audio/webm' })
      status.value = 'recorded'

      // 마이크 스트림의 모든 트랙 중지 (브라우저 마이크 아이콘 제거)
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
        mediaStream = null
      }

      // 서버에 자동 저장 (백그라운드)
      autoSaveToServer()
    }

    // onerror: 녹음 중 에러 발생 시 처리
    mediaRecorder.onerror = (event) => {
      showError(`녹음 중 오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`)
      stopRecording()
    }

    // ── 4단계: 녹음 시작 ──
    // timeslice: 1000ms마다 데이터 청크 생성 (안정성 향상)
    mediaRecorder.start(1000)
    status.value = 'recording'
    elapsedSeconds.value = 0

    // 타이머 시작: 1초마다 경과 시간 업데이트
    timerInterval = setInterval(() => {
      elapsedSeconds.value++
    }, 1000)

  } catch (error) {
    // ── 마이크 권한 거부 또는 기타 에러 처리 ──
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      showError('마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
    } else if (error.name === 'NotFoundError') {
      showError('마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.')
    } else {
      showError(`마이크 접근 오류: ${error.message}`)
    }
  }
}

// ─────────────────────────────────────────────────
// 녹음 중지
// ─────────────────────────────────────────────────

/**
 * 진행 중인 녹음을 중지
 * - MediaRecorder.stop() 호출 → onstop 핸들러에서 Blob 생성
 * - 타이머 중지
 */
function stopRecording() {
  // MediaRecorder가 녹음 중인 경우에만 중지
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }

  // 타이머 정리
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// ─────────────────────────────────────────────────
// 녹음 취소 (처음 상태로 되돌리기)
// ─────────────────────────────────────────────────

/**
 * 녹음된 데이터를 버리고 초기 상태로 복귀
 */
function discardRecording() {
  recordedBlob.value = null
  audioChunks = []
  elapsedSeconds.value = 0
  savedRecordingId.value = null
  status.value = 'idle'
}

// ─────────────────────────────────────────────────
// 녹음 파일 로컬 저장 (다운로드)
// ─────────────────────────────────────────────────

/**
 * 녹음된 오디오 Blob을 로컬 파일로 다운로드
 * - 브라우저의 다운로드 기능을 활용하여 사용자 로컬에 저장
 * - 파일명: 회의녹음_YYYY-MM-DDTHH-MM-SS.webm
 */
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

// ─────────────────────────────────────────────────
// 서버로 전송 (STT 처리 요청)
// ─────────────────────────────────────────────────

/**
 * 녹음된 오디오 Blob을 백엔드 `/api/transcribe` 엔드포인트로 전송
 *
 * [전송 과정]
 * 1. Blob을 File 객체로 변환 (api.js의 transcribeAudio가 File을 기대)
 * 2. XHR을 통해 FormData로 전송 (업로드 진행률 추적)
 * 3. 전사 결과를 부모 컴포넌트에 emit
 */
async function sendToServer() {
  if (!recordedBlob.value) return

  status.value = 'uploading'
  uploadProgress.value = 0

  try {
    // ── Blob을 File 객체로 변환 ──
    // 파일명을 읽기 쉬운 날짜 형식으로 생성 (YYYY-MM-DD_HH시MM분)
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}시${String(now.getMinutes()).padStart(2, '0')}분`
    const fileName = `회의녹음_${dateStr}_${timeStr}.webm`
    const file = new File(
      [recordedBlob.value],
      fileName,
      { type: 'audio/webm' }
    )

    // ── 기존 transcribeAudio API 함수로 서버 전송 ──
    const result = await transcribeAudio(file, 'ko', (progress) => {
      uploadProgress.value = progress
    })

    if (result.success) {
      // 전사 성공 → 부모 컴포넌트에 결과 전달
      emit('transcribed', result.data)
      // 상태 초기화
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
    status.value = 'recorded' // 재전송 가능하도록 recorded 상태로 복귀
  }
}

// ─────────────────────────────────────────────────
// 컴포넌트 정리 (언마운트 시)
// ─────────────────────────────────────────────────

onBeforeUnmount(() => {
  // 타이머 정리
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  // 에러 타이머 정리
  if (errorTimeout) {
    clearTimeout(errorTimeout)
  }
  // 녹음 중이면 중지
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  // 마이크 스트림 해제
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
  }
})
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 p-6">
    <!-- ── 헤더 ── -->
    <h3 class="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
      <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
      실시간 회의 녹음
    </h3>

    <!-- ════════════════════════════════════════════ -->
    <!-- 상태 1: 대기 (idle) - 녹음 시작 버튼 표시    -->
    <!-- ════════════════════════════════════════════ -->
    <div v-if="status === 'idle'" class="text-center py-8">
      <!-- 녹음 시작 버튼: 큰 원형 마이크 아이콘 -->
      <button
        @click="startRecording"
        class="w-20 h-20 rounded-full bg-danger-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-300 flex items-center justify-center mx-auto transition-all hover:scale-105 active:scale-95"
      >
        <svg class="w-8 h-8 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
      <p class="text-sm text-slate-500 mt-4">마이크 버튼을 눌러 녹음을 시작하세요</p>
      <p class="text-xs text-slate-400 mt-1">브라우저에서 마이크 권한 허용이 필요합니다</p>
    </div>

    <!-- ════════════════════════════════════════════ -->
    <!-- 상태 2: 녹음 중 (recording) - 타이머 + 중지  -->
    <!-- ════════════════════════════════════════════ -->
    <div v-else-if="status === 'recording'" class="text-center py-6">
      <!-- 녹음 중 시각적 피드백: 펄스 애니메이션 원 -->
      <div class="relative w-24 h-24 mx-auto mb-4">
        <!-- 외곽 펄스 링 (애니메이션) -->
        <div class="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-30"></div>
        <div class="absolute inset-2 rounded-full bg-red-100 animate-pulse opacity-50"></div>
        <!-- 중앙 녹음 인디케이터 -->
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 rounded-full bg-danger-500 flex items-center justify-center shadow-lg">
            <div class="w-5 h-5 rounded-sm bg-white"></div>
          </div>
        </div>
      </div>

      <!-- 녹음 경과 시간 (MM:SS 형식, 실시간 업데이트) -->
      <div class="mb-4">
        <p class="text-3xl font-mono font-bold text-slate-900 tracking-wider">
          {{ formattedTime }}
        </p>
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <div class="w-2 h-2 rounded-full bg-danger-500 animate-pulse"></div>
          <p class="text-sm text-danger-500 font-medium">녹음 중</p>
        </div>
      </div>

      <!-- 녹음 중지 버튼 -->
      <button
        @click="stopRecording"
        class="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        녹음 중지
      </button>
    </div>

    <!-- ════════════════════════════════════════════ -->
    <!-- 상태 3: 녹음 완료 (recorded) - 미리보기+전송  -->
    <!-- ════════════════════════════════════════════ -->
    <div v-else-if="status === 'recorded'" class="py-4">
      <!-- 녹음 완료 정보 표시 -->
      <div class="flex items-center gap-4 bg-slate-50 rounded-lg p-4 mb-5">
        <!-- 오디오 파일 아이콘 -->
        <div class="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        </div>
        <!-- 파일 메타 정보 -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-900">녹음 완료</p>
          <div class="flex items-center gap-3 mt-0.5">
            <span class="text-xs text-slate-500">
              <span class="font-mono">{{ formattedTime }}</span> 녹음됨
            </span>
            <span class="text-slate-300">|</span>
            <span class="text-xs text-slate-500">{{ fileSizeText }}</span>
            <span class="text-slate-300">|</span>
            <!-- 서버 저장 상태 표시 -->
            <span v-if="isSaving" class="text-xs text-amber-500 flex items-center gap-1">
              <div class="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full"></div>
              서버 저장 중...
            </span>
            <span v-else-if="savedRecordingId" class="text-xs text-success-500 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              서버에 보관됨
            </span>
            <span v-else class="text-xs text-slate-500">WebM 형식</span>
          </div>
        </div>
      </div>

      <!-- 액션 버튼 그룹 -->
      <div class="flex items-center gap-3">
        <!-- 서버로 전송 (STT 처리) 버튼 -->
        <button
          @click="sendToServer"
          class="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI 텍스트 변환
        </button>

        <!-- 로컬 저장 (다운로드) 버튼 -->
        <button
          @click="downloadRecording"
          class="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          저장
        </button>

        <!-- 녹음 취소 (다시 녹음) 버튼 -->
        <button
          @click="discardRecording"
          class="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          삭제
        </button>
      </div>
    </div>

    <!-- ════════════════════════════════════════════ -->
    <!-- 상태 4: 서버 전송 중 (uploading) - 진행률    -->
    <!-- ════════════════════════════════════════════ -->
    <div v-else-if="status === 'uploading'" class="py-6">
      <div class="text-center">
        <!-- 스피너 + 상태 메시지 -->
        <div class="flex items-center justify-center gap-3 mb-4">
          <div class="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
          <span class="text-sm text-slate-700 font-medium">
            {{ uploadProgress < 100 ? '오디오 파일 업로드 중...' : 'AI가 음성을 분석하고 있습니다...' }}
          </span>
        </div>

        <!-- 진행률 바 -->
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden max-w-md mx-auto">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="uploadProgress >= 100 ? 'bg-accent-500 animate-pulse w-full' : 'bg-primary-500'"
            :style="uploadProgress < 100 ? { width: `${uploadProgress}%` } : {}"
          ></div>
        </div>

        <!-- 진행률 텍스트 -->
        <p class="text-xs text-slate-400 mt-2">
          {{ uploadProgress < 100
            ? `${uploadProgress}% 업로드됨`
            : '서버에서 STT 처리 중입니다. 녹음 길이에 따라 시간이 걸릴 수 있습니다.'
          }}
        </p>
      </div>
    </div>

    <!-- ════════════════════════════════════════════ -->
    <!-- 에러 토스트 (하단에 표시)                     -->
    <!-- ════════════════════════════════════════════ -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="errorMessage"
        class="mt-4 flex items-start gap-3 p-3 bg-danger-50 border border-red-200 rounded-lg"
      >
        <!-- 경고 아이콘 -->
        <svg class="w-5 h-5 text-danger-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-danger-500">{{ errorMessage }}</p>
        </div>
        <!-- 닫기 버튼 -->
        <button
          @click="errorMessage = ''"
          class="text-red-400 hover:text-red-600 shrink-0"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition>
  </div>
</template>
