<script setup>
import { ref } from 'vue'
import AudioUploader from '../components/AudioUploader.vue'
import LiveRecorder from '../components/LiveRecorder.vue'
import { summarizeTranscript } from '../services/api.js'

// 입력 모드: 'record' (실시간 녹음) | 'upload' (파일 업로드)
const inputMode = ref('record')

// 전사 결과 데이터
const transcriptResult = ref(null)

// AI 요약 결과 데이터
const summaryResult = ref(null)

// 요약 처리 상태
const isSummarizing = ref(false)
const summaryError = ref('')

function onTranscribed(data) {
  transcriptResult.value = data
  summaryResult.value = null
  summaryError.value = ''
}

async function requestSummary() {
  if (!transcriptResult.value?.fullText) return

  isSummarizing.value = true
  summaryError.value = ''

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

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function resetResult() {
  transcriptResult.value = null
  summaryResult.value = null
  summaryError.value = ''
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900">새 회의록 생성</h1>
      <p class="text-sm text-slate-500 mt-1">실시간 녹음 또는 파일 업로드로 AI가 자동으로 텍스트를 변환합니다</p>
    </div>

    <!-- 입력 모드 선택 탭 -->
    <div class="max-w-2xl mb-6">
      <div class="flex bg-slate-100 rounded-lg p-1">
        <button
          @click="inputMode = 'record'"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
          :class="inputMode === 'record' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          실시간 녹음
        </button>
        <button
          @click="inputMode = 'upload'"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
          :class="inputMode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          파일 업로드
        </button>
      </div>
    </div>

    <!-- 입력 컴포넌트 -->
    <div class="max-w-2xl">
      <LiveRecorder v-if="inputMode === 'record'" @transcribed="onTranscribed" />
      <AudioUploader v-else @transcribed="onTranscribed" />
    </div>

    <!-- 전사 결과 -->
    <div v-if="transcriptResult" class="mt-8 space-y-6">
      <!-- 결과 헤더 -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900">전사 결과</h2>
        <button
          @click="resetResult"
          class="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          결과 닫기
        </button>
      </div>

      <!-- 메타 정보 + AI 요약 버튼 -->
      <div class="bg-white rounded-xl border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-slate-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            전사 완료
          </h3>
          <!-- AI 요약 요청 버튼 -->
          <button
            v-if="!summaryResult && !isSummarizing"
            @click="requestSummary"
            class="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600 transition-colors inline-flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI 요약 생성
          </button>
          <!-- 요약 중 스피너 -->
          <div v-if="isSummarizing" class="flex items-center gap-2 text-sm text-accent-500">
            <div class="animate-spin w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full"></div>
            AI가 요약하고 있습니다...
          </div>
          <!-- 요약 완료 표시 -->
          <span v-if="summaryResult" class="text-xs text-success-500 font-medium flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            요약 완료
          </span>
        </div>
        <div class="grid grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-slate-400">원본 파일</p>
            <p class="text-sm font-medium text-slate-700">{{ transcriptResult.meta.originalFileName }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">파일 크기</p>
            <p class="text-sm font-medium text-slate-700">{{ transcriptResult.meta.fileSizeMB }}MB</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">총 길이</p>
            <p class="text-sm font-medium text-slate-700">{{ formatTime(transcriptResult.meta.totalDuration) }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">처리 청크</p>
            <p class="text-sm font-medium text-slate-700">{{ transcriptResult.meta.chunkCount }}개</p>
          </div>
        </div>
      </div>

      <!-- 요약 에러 -->
      <div v-if="summaryError" class="bg-danger-50 border border-red-200 rounded-xl p-4">
        <p class="text-sm text-danger-500">{{ summaryError }}</p>
      </div>

      <!-- ════════════════════════════════════════ -->
      <!-- AI 요약 결과 카드들                       -->
      <!-- ════════════════════════════════════════ -->
      <template v-if="summaryResult">
        <!-- TL;DR 요약 -->
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h3 class="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI 요약
          </h3>
          <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{{ summaryResult.summary }}</p>
        </div>

        <!-- 주요 결정 사항 -->
        <div v-if="summaryResult.keyDecisions?.length" class="bg-white rounded-xl border border-slate-200 p-5">
          <h3 class="text-base font-semibold text-slate-900 mb-3">주요 결정 사항</h3>
          <ul class="space-y-2.5">
            <li v-for="(decision, i) in summaryResult.keyDecisions" :key="i" class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                {{ i + 1 }}
              </div>
              <p class="text-sm text-slate-700">{{ decision }}</p>
            </li>
          </ul>
        </div>

        <!-- 액션 아이템 -->
        <div v-if="summaryResult.actionItems?.length" class="bg-white rounded-xl border border-slate-200 p-5">
          <h3 class="text-base font-semibold text-slate-900 mb-3">액션 아이템</h3>
          <div class="space-y-2">
            <div v-for="(item, i) in summaryResult.actionItems" :key="i" class="flex items-start gap-3 py-2">
              <div class="w-5 h-5 rounded border-2 border-slate-300 shrink-0 mt-0.5"></div>
              <div>
                <p class="text-sm text-slate-700">{{ item.text }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span v-if="item.assignee" class="text-xs text-slate-400">{{ item.assignee }}</span>
                  <span v-if="item.assignee && item.dueDate" class="text-slate-300">·</span>
                  <span v-if="item.dueDate" class="text-xs text-slate-400">{{ item.dueDate }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 키워드 + 분위기 -->
        <div class="grid grid-cols-2 gap-4">
          <div v-if="summaryResult.keywords?.length" class="bg-white rounded-xl border border-slate-200 p-5">
            <h3 class="text-sm font-semibold text-slate-900 mb-3">핵심 키워드</h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="kw in summaryResult.keywords"
                :key="kw"
                class="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 font-medium"
              >
                {{ kw }}
              </span>
            </div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-5">
            <h3 class="text-sm font-semibold text-slate-900 mb-3">회의 분위기</h3>
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
      </template>

      <!-- 전체 텍스트 (접이식) -->
      <details class="bg-white rounded-xl border border-slate-200">
        <summary class="p-5 cursor-pointer text-base font-semibold text-slate-900 hover:bg-slate-50 rounded-xl">
          전체 텍스트
        </summary>
        <div class="px-5 pb-5">
          <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{{ transcriptResult.fullText }}</p>
        </div>
      </details>

      <!-- 타임스탬프 세그먼트 (접이식) -->
      <details v-if="transcriptResult.segments.length" class="bg-white rounded-xl border border-slate-200">
        <summary class="p-5 cursor-pointer text-base font-semibold text-slate-900 hover:bg-slate-50 rounded-xl">
          타임라인 ({{ transcriptResult.segments.length }}개 세그먼트)
        </summary>
        <div class="px-5 pb-5">
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="seg in transcriptResult.segments"
              :key="seg.id"
              class="flex gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg"
            >
              <span class="text-xs font-mono text-primary-500 shrink-0 pt-0.5 w-24">
                {{ formatTime(seg.start) }} ~ {{ formatTime(seg.end) }}
              </span>
              <p class="text-sm text-slate-700">{{ seg.text }}</p>
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
