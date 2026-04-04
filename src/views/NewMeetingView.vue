<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import AudioUploader from '../components/AudioUploader.vue'
import LiveRecorder from '../components/LiveRecorder.vue'
import { summarizeTranscript, createMeeting } from '../services/api.js'

const { isDark } = useDarkMode()

const router = useRouter()

// ── 스텝 위저드 ──
const currentStep = ref(1)

const steps = [
  { num: 1, label: '녹음/업로드' },
  { num: 2, label: 'STT 변환' },
  { num: 3, label: 'AI 분석' },
  { num: 4, label: '검토/저장' },
]

// 입력 모드: 'record' (실시간 녹음) | 'upload' (파일 업로드)
const inputMode = ref('record')

// 화자 분리 옵션
const enableDiarization = ref(false)

// 전사 결과 데이터
const transcriptResult = ref(null)

// AI 요약 결과 데이터
const summaryResult = ref(null)

// 요약 처리 상태
const isSummarizing = ref(false)
const summaryError = ref('')

// 전체 텍스트 접이식 상태
const showFullText = ref(false)

// ── DB 저장 관련 상태 ──
const saveForm = ref({
  title: '',
  participants: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  duration: 0,
})
const isSaving = ref(false)
const saveError = ref('')
const toast = ref({ show: false, message: '', type: 'success' })

function onTranscribed(data) {
  transcriptResult.value = data
  summaryResult.value = null
  summaryError.value = ''
  saveError.value = ''

  // STT 메타에서 소요 시간 자동 설정 (초 → 분)
  if (data?.meta?.totalDuration) {
    saveForm.value.duration = Math.round(data.meta.totalDuration / 60)
  }

  // 자동으로 Step 2로 이동
  currentStep.value = 2
}

async function requestSummary() {
  if (!transcriptResult.value?.fullText) return

  isSummarizing.value = true
  summaryError.value = ''
  currentStep.value = 3

  try {
    const result = await summarizeTranscript(transcriptResult.value.fullText)
    if (result.success) {
      summaryResult.value = result.data
    } else {
      summaryError.value = result.error || 'AI 요약에 실패했습니다.'
    }
  } catch (err) {
    summaryError.value = err.message
  } finally {
    isSummarizing.value = false
  }
}

// ── DB 저장 ──
async function saveToDb() {
  const title = saveForm.value.title.trim()
  if (!title) {
    saveError.value = '회의 제목을 입력해주세요.'
    return
  }

  isSaving.value = true
  saveError.value = ''

  try {
    // 참석자 문자열 → 배열
    const participants = saveForm.value.participants
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)

    // STT segments → transcript 배열 변환 (화자 분리 시 speaker 필드 보존)
    const transcript = (transcriptResult.value?.segments || []).map(seg => ({
      speaker: seg.speaker || '화자',
      time: formatTime(seg.start),
      text: seg.text,
    }))

    const meetingData = {
      title,
      date: saveForm.value.date,
      time: saveForm.value.time,
      duration: saveForm.value.duration || 0,
      participants,
      status: 'completed',
      tags: summaryResult.value?.keywords || [],
      aiSummary: summaryResult.value?.summary || '',
      keyDecisions: summaryResult.value?.keyDecisions || [],
      actionItems: (summaryResult.value?.actionItems || []).map(item => ({
        text: item.text || item.task || '',
        assignee: item.assignee || '',
        dueDate: item.dueDate || item.due_date || '',
        done: false,
      })),
      sentiment: summaryResult.value?.sentiment || 'neutral',
      transcript,
      fullText: transcriptResult.value?.fullText || '',
    }

    const res = await createMeeting(meetingData)

    if (res.success) {
      showToast('회의록이 저장되었습니다.')
      // 저장된 회의 상세 페이지로 이동
      setTimeout(() => {
        router.push(`/meetings/${res.data.id}`)
      }, 800)
    }
  } catch (err) {
    saveError.value = '저장 실패: ' + err.message
    showToast('저장에 실패했습니다.', 'error')
  } finally {
    isSaving.value = false
  }
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function resetResult() {
  transcriptResult.value = null
  summaryResult.value = null
  summaryError.value = ''
  saveError.value = ''
  saveForm.value = {
    title: '',
    participants: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    duration: 0,
  }
  currentStep.value = 1
}

function goToStep(step) {
  currentStep.value = step
}
</script>

<template>
  <!-- 토스트 알림 -->
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast.show"
        class="fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2"
        :class="{
          'bg-success-500 text-white': toast.type === 'success',
          'bg-danger-500 text-white': toast.type === 'error',
        }"
      >
        <svg v-if="toast.type === 'success'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        {{ toast.message }}
      </div>
    </Transition>
  </Teleport>

  <div class="p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">새 회의록 생성</h1>
      <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">단계별로 진행하여 AI가 자동으로 회의록을 생성합니다</p>
    </div>

    <!-- ════════════════════════════════════════════════ -->
    <!-- 스텝 프로그레스 인디케이터                          -->
    <!-- ════════════════════════════════════════════════ -->
    <div class="max-w-3xl mx-auto mb-10">
      <div class="flex items-center justify-between">
        <template v-for="(step, idx) in steps" :key="step.num">
          <!-- 스텝 아이콘 + 라벨 -->
          <div class="flex flex-col items-center relative z-10">
            <!-- 스텝 아이콘 -->
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
              :class="currentStep > step.num
                ? 'bg-success-500 text-white cursor-pointer hover:bg-success-600'
                : currentStep === step.num
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white scale-110'
                  : isDark ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-400'"
              @click="currentStep > step.num ? goToStep(step.num) : null"
            >
              <!-- 완료 체크 -->
              <svg v-if="currentStep > step.num" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <!-- 마이크 (녹음) -->
              <svg v-else-if="idx === 0" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <!-- 텍스트 (STT) -->
              <svg v-else-if="idx === 1" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <!-- AI 분석 -->
              <svg v-else-if="idx === 2" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <!-- 저장 -->
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <!-- 라벨 -->
            <span
              class="text-xs font-medium mt-2 whitespace-nowrap"
              :class="{
                'text-primary-500': currentStep >= step.num,
                'text-slate-400': currentStep < step.num && !isDark,
                'text-slate-500': currentStep < step.num && isDark,
              }"
            >
              {{ step.label }}
            </span>
          </div>
          <!-- 연결 라인 (마지막 스텝 이후에는 없음) -->
          <div
            v-if="idx < steps.length - 1"
            class="flex-1 h-0.5 -mt-5 mx-2 transition-colors"
            :class="currentStep > step.num
              ? 'bg-primary-500'
              : (isDark ? 'bg-slate-700' : 'bg-slate-200')"
          ></div>
        </template>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════ -->
    <!-- Step 1: 녹음/업로드                               -->
    <!-- ════════════════════════════════════════════════ -->
    <div v-if="currentStep === 1" class="max-w-2xl mx-auto step-content">
      <!-- 입력 모드 선택 탭 -->
      <div class="mb-6">
        <div class="flex rounded-lg p-1" :class="isDark ? 'bg-slate-800' : 'bg-slate-100'">
          <button
            @click="inputMode = 'record'"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            :class="inputMode === 'record'
              ? (isDark ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-white text-slate-900 shadow-sm')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            실시간 녹음
          </button>
          <button
            @click="inputMode = 'upload'"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            :class="inputMode === 'upload'
              ? (isDark ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-white text-slate-900 shadow-sm')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            파일 업로드
          </button>
        </div>
      </div>

      <!-- 화자 분리 옵션 -->
      <div class="mb-4 px-1">
        <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" v-model="enableDiarization" class="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
          화자 분리 (누가 말했는지 자동 구분)
        </label>
      </div>

      <!-- 입력 컴포넌트 -->
      <LiveRecorder v-if="inputMode === 'record'" :enable-diarization="enableDiarization" @transcribed="onTranscribed" />
      <AudioUploader v-else :enable-diarization="enableDiarization" @transcribed="onTranscribed" />
    </div>

    <!-- ════════════════════════════════════════════════ -->
    <!-- Step 2: STT 변환 결과                             -->
    <!-- ════════════════════════════════════════════════ -->
    <div v-if="currentStep === 2 && transcriptResult" class="max-w-3xl mx-auto space-y-6 step-content">
      <!-- 메타 정보 카드 -->
      <div class="rounded-xl border p-6" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <h3 class="text-base font-semibold mb-4 flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          <svg class="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          전사 완료
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="rounded-lg p-3" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
            <p class="text-xs mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-400'">원본 파일</p>
            <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ transcriptResult.meta.originalFileName }}</p>
          </div>
          <div class="rounded-lg p-3" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
            <p class="text-xs mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-400'">파일 크기</p>
            <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ transcriptResult.meta.fileSizeMB }}MB</p>
          </div>
          <div class="rounded-lg p-3" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
            <p class="text-xs mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-400'">총 길이</p>
            <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ formatTime(transcriptResult.meta.totalDuration) }}</p>
          </div>
          <div class="rounded-lg p-3" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
            <p class="text-xs mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-400'">처리 청크</p>
            <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ transcriptResult.meta.chunkCount }}개</p>
          </div>
        </div>
      </div>

      <!-- 전체 텍스트 미리보기 (접이식) -->
      <div class="rounded-xl border" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <button
          @click="showFullText = !showFullText"
          class="w-full p-5 flex items-center justify-between text-left rounded-xl transition-colors"
          :class="isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'"
        >
          <span class="text-base font-semibold flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
            <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            전체 텍스트 미리보기
          </span>
          <svg
            class="w-5 h-5 transition-transform"
            :class="[showFullText ? 'rotate-180' : '', isDark ? 'text-slate-400' : 'text-slate-500']"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <div v-if="showFullText" class="px-5 pb-5">
          <div class="max-h-64 overflow-y-auto rounded-lg p-4" :class="isDark ? 'bg-slate-900/50' : 'bg-slate-50'">
            <p class="text-sm leading-relaxed whitespace-pre-wrap" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ transcriptResult.fullText }}</p>
          </div>
        </div>
      </div>

      <!-- 타임라인 세그먼트 (접이식) -->
      <details v-if="transcriptResult.segments?.length" class="rounded-xl border" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <summary class="p-5 cursor-pointer text-base font-semibold rounded-xl flex items-center gap-2"
          :class="isDark ? 'text-slate-100 hover:bg-slate-700/50' : 'text-slate-900 hover:bg-slate-50'">
          <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          타임라인 ({{ transcriptResult.segments.length }}개 세그먼트)
        </summary>
        <div class="px-5 pb-5">
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="seg in transcriptResult.segments"
              :key="seg.id"
              class="flex gap-3 py-2 px-3 rounded-lg"
              :class="isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'"
            >
              <span class="text-xs font-mono text-primary-500 shrink-0 pt-0.5 w-24">
                {{ formatTime(seg.start) }} ~ {{ formatTime(seg.end) }}
              </span>
              <p class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-700'">{{ seg.text }}</p>
            </div>
          </div>
        </div>
      </details>

      <!-- 하단 버튼 -->
      <div class="flex justify-between pt-2">
        <button
          @click="goToStep(1)"
          class="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2"
          :class="isDark
            ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          이전 단계
        </button>
        <button
          @click="requestSummary"
          class="px-6 py-2.5 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI 요약 생성
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════ -->
    <!-- Step 3: AI 분석                                   -->
    <!-- ════════════════════════════════════════════════ -->
    <div v-if="currentStep === 3" class="max-w-3xl mx-auto space-y-6 step-content">
      <!-- 요약 진행 중 스피너 -->
      <div v-if="isSummarizing" class="flex flex-col items-center justify-center py-20">
        <div class="relative mb-6">
          <div class="w-16 h-16 rounded-full border-4 border-accent-100 animate-spin"
            :class="isDark ? 'border-accent-500/20' : 'border-accent-100'"
            style="border-top-color: var(--color-accent-500);">
          </div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
        </div>
        <h3 class="text-lg font-semibold mb-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">AI가 회의 내용을 분석하고 있습니다</h3>
        <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">요약, 결정사항, 액션 아이템을 추출하는 중...</p>
        <div class="mt-6 flex gap-1">
          <span class="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style="animation-delay: 0ms;"></span>
          <span class="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style="animation-delay: 150ms;"></span>
          <span class="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style="animation-delay: 300ms;"></span>
        </div>
      </div>

      <!-- 요약 에러 -->
      <div v-if="summaryError" class="rounded-xl border p-6" :class="isDark ? 'bg-red-900/20 border-red-800' : 'bg-danger-50 border-red-200'">
        <div class="flex items-center gap-3 mb-3">
          <svg class="w-5 h-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 class="text-base font-semibold text-danger-500">AI 분석 실패</h3>
        </div>
        <p class="text-sm text-danger-500 mb-4">{{ summaryError }}</p>
        <div class="flex gap-3">
          <button
            @click="requestSummary"
            class="px-4 py-2 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
          >
            다시 시도
          </button>
          <button
            @click="goToStep(2)"
            class="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
            :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
          >
            이전 단계로
          </button>
        </div>
      </div>

      <!-- 요약 결과 -->
      <template v-if="summaryResult && !isSummarizing">
        <!-- TL;DR 요약 -->
        <div class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
          <h3 class="text-base font-semibold mb-3 flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
            <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI 요약
          </h3>
          <p class="text-sm leading-relaxed whitespace-pre-wrap" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ summaryResult.summary }}</p>
        </div>

        <!-- 주요 결정 사항 -->
        <div v-if="summaryResult.keyDecisions?.length" class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
          <h3 class="text-base font-semibold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">주요 결정 사항</h3>
          <ul class="space-y-2.5">
            <li v-for="(decision, i) in summaryResult.keyDecisions" :key="i" class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0"
                :class="isDark ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-50 text-primary-600'">
                {{ i + 1 }}
              </div>
              <p class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-700'">{{ decision }}</p>
            </li>
          </ul>
        </div>

        <!-- 액션 아이템 -->
        <div v-if="summaryResult.actionItems?.length" class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
          <h3 class="text-base font-semibold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">액션 아이템</h3>
          <div class="space-y-2">
            <div v-for="(item, i) in summaryResult.actionItems" :key="i" class="flex items-start gap-3 py-2">
              <div class="w-5 h-5 rounded border-2 shrink-0 mt-0.5" :class="isDark ? 'border-slate-500' : 'border-slate-300'"></div>
              <div>
                <p class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-700'">{{ item.text }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span v-if="item.assignee" class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ item.assignee }}</span>
                  <span v-if="item.assignee && item.dueDate" :class="isDark ? 'text-slate-600' : 'text-slate-300'">·</span>
                  <span v-if="item.dueDate" class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ item.dueDate }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 키워드 + 분위기 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-if="summaryResult.keywords?.length" class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <h3 class="text-sm font-semibold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">핵심 키워드</h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="kw in summaryResult.keywords"
                :key="kw"
                class="text-xs px-2.5 py-1 rounded-full font-medium"
                :class="isDark ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-50 text-primary-600'"
              >
                {{ kw }}
              </span>
            </div>
          </div>
          <div class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <h3 class="text-sm font-semibold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의 분위기</h3>
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-medium"
                :class="{
                  'text-success-500': summaryResult.sentiment === 'positive',
                  'text-danger-500': summaryResult.sentiment === 'negative',
                  'text-slate-500': summaryResult.sentiment === 'neutral',
                }"
              >
                {{ { positive: '긍정적', negative: '부정적', neutral: '중립적' }[summaryResult.sentiment] || summaryResult.sentiment }}
              </span>
            </div>
          </div>
        </div>

        <!-- 하단 버튼 -->
        <div class="flex justify-between pt-2">
          <button
            @click="goToStep(2)"
            class="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2"
            :class="isDark
              ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            이전 단계
          </button>
          <button
            @click="goToStep(4)"
            class="px-6 py-2.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 shadow-sm"
          >
            다음 단계
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- ════════════════════════════════════════════════ -->
    <!-- Step 4: 검토/저장                                 -->
    <!-- ════════════════════════════════════════════════ -->
    <div v-if="currentStep === 4" class="max-w-3xl mx-auto space-y-6 step-content">
      <!-- 회의 정보 입력 폼 -->
      <div class="rounded-xl border-2 p-6" :class="isDark ? 'bg-slate-800 border-primary-700' : 'bg-white border-primary-200'">
        <h3 class="text-base font-semibold mb-5 flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          회의 정보 입력
        </h3>

        <div class="space-y-4">
          <!-- 회의 제목 -->
          <div>
            <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">회의 제목 <span class="text-danger-500">*</span></label>
            <input
              v-model="saveForm.title"
              type="text"
              placeholder="예: Q1 사업 전략 회의"
              class="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="isDark
                ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              "
            />
          </div>

          <!-- 참석자 -->
          <div>
            <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">참석자 (쉼표로 구분)</label>
            <input
              v-model="saveForm.participants"
              type="text"
              placeholder="예: 홍길동, 김철수, 이영희"
              class="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="isDark
                ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              "
            />
          </div>

          <!-- 날짜 / 시간 / 소요 시간 -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">날짜</label>
              <input
                v-model="saveForm.date"
                type="date"
                class="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="isDark
                  ? 'bg-slate-700 border-slate-600 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
                "
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">시간</label>
              <input
                v-model="saveForm.time"
                type="time"
                class="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="isDark
                  ? 'bg-slate-700 border-slate-600 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
                "
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">소요 시간 (분)</label>
              <input
                v-model.number="saveForm.duration"
                type="number"
                min="0"
                class="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="isDark
                  ? 'bg-slate-700 border-slate-600 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
                "
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 자동 포함 항목 체크리스트 -->
      <div class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          <svg class="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          자동 포함 항목
        </h3>
        <div class="space-y-2">
          <div class="flex items-center gap-2.5 py-1">
            <div class="w-5 h-5 rounded flex items-center justify-center"
              :class="summaryResult?.summary
                ? (isDark ? 'bg-success-500/20' : 'bg-success-50')
                : (isDark ? 'bg-slate-700' : 'bg-slate-100')">
              <svg v-if="summaryResult?.summary" class="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span v-else class="w-2 h-2 rounded-sm" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></span>
            </div>
            <span class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">AI 요약 (TL;DR)</span>
          </div>
          <div class="flex items-center gap-2.5 py-1">
            <div class="w-5 h-5 rounded flex items-center justify-center"
              :class="summaryResult?.keyDecisions?.length
                ? (isDark ? 'bg-success-500/20' : 'bg-success-50')
                : (isDark ? 'bg-slate-700' : 'bg-slate-100')">
              <svg v-if="summaryResult?.keyDecisions?.length" class="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span v-else class="w-2 h-2 rounded-sm" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></span>
            </div>
            <span class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
              주요 결정사항 {{ summaryResult?.keyDecisions?.length ? `${summaryResult.keyDecisions.length}건` : '' }}
            </span>
          </div>
          <div class="flex items-center gap-2.5 py-1">
            <div class="w-5 h-5 rounded flex items-center justify-center"
              :class="summaryResult?.actionItems?.length
                ? (isDark ? 'bg-success-500/20' : 'bg-success-50')
                : (isDark ? 'bg-slate-700' : 'bg-slate-100')">
              <svg v-if="summaryResult?.actionItems?.length" class="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span v-else class="w-2 h-2 rounded-sm" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></span>
            </div>
            <span class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
              액션 아이템 {{ summaryResult?.actionItems?.length ? `${summaryResult.actionItems.length}건` : '' }}
            </span>
          </div>
          <div class="flex items-center gap-2.5 py-1">
            <div class="w-5 h-5 rounded flex items-center justify-center"
              :class="summaryResult?.keywords?.length
                ? (isDark ? 'bg-success-500/20' : 'bg-success-50')
                : (isDark ? 'bg-slate-700' : 'bg-slate-100')">
              <svg v-if="summaryResult?.keywords?.length" class="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span v-else class="w-2 h-2 rounded-sm" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'"></span>
            </div>
            <span class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
              키워드 태그 {{ summaryResult?.keywords?.length ? `${summaryResult.keywords.length}개` : '' }}
            </span>
          </div>
          <div class="flex items-center gap-2.5 py-1">
            <div class="w-5 h-5 rounded flex items-center justify-center" :class="isDark ? 'bg-success-500/20' : 'bg-success-50'">
              <svg class="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">전체 텍스트 (Transcript)</span>
          </div>
        </div>
      </div>

      <!-- 미리보기: AI 요약 (축약) -->
      <div v-if="summaryResult?.summary" class="rounded-xl border p-5" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <h3 class="text-sm font-semibold mb-2 flex items-center gap-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          <svg class="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          미리보기
        </h3>
        <p class="text-sm leading-relaxed whitespace-pre-wrap line-clamp-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ summaryResult.summary }}</p>
      </div>

      <!-- 에러 메시지 -->
      <div v-if="saveError" class="text-sm text-danger-500 rounded-lg px-4 py-3" :class="isDark ? 'bg-red-900/20' : 'bg-danger-50'">
        {{ saveError }}
      </div>

      <!-- 하단 버튼 -->
      <div class="flex justify-between pt-2">
        <button
          @click="goToStep(3)"
          class="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2"
          :class="isDark
            ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          이전 단계
        </button>
        <button
          @click="saveToDb"
          :disabled="isSaving"
          class="px-6 py-2.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {{ isSaving ? '저장 중...' : 'DB에 저장하기' }}
        </button>
      </div>
    </div>

    <!-- 처음으로 버튼 (Step 1이 아닐 때) -->
    <div v-if="currentStep > 1" class="max-w-3xl mx-auto mt-8 text-center">
      <button
        @click="resetResult"
        class="text-xs transition-colors"
        :class="isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'"
      >
        처음부터 다시 시작
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease-out; }
.toast-leave-active { animation: toast-out 0.3s ease-in; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }

.step-content {
  animation: step-fade-in 0.3s ease-out;
}
@keyframes step-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
