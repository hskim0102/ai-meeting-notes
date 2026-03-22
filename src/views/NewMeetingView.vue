<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AudioUploader from '../components/AudioUploader.vue'
import LiveRecorder from '../components/LiveRecorder.vue'
import { summarizeTranscript, createMeeting } from '../services/api.js'

const router = useRouter()

// 입력 모드: 'record' (실시간 녹음) | 'upload' (파일 업로드)
const inputMode = ref('record')

// 전사 결과 데이터
const transcriptResult = ref(null)

// AI 요약 결과 데이터
const summaryResult = ref(null)

// 요약 처리 상태
const isSummarizing = ref(false)
const summaryError = ref('')

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

    // STT segments → transcript 배열 변환
    const transcript = (transcriptResult.value?.segments || []).map(seg => ({
      speaker: '화자',
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

      <!-- ════════════════════════════════════════ -->
      <!-- DB 저장 폼                                -->
      <!-- ════════════════════════════════════════ -->
      <div class="bg-white rounded-xl border-2 border-primary-200 p-6">
        <h3 class="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          회의 정보 입력
        </h3>

        <div class="space-y-4">
          <!-- 회의 제목 -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">회의 제목 <span class="text-danger-500">*</span></label>
            <input
              v-model="saveForm.title"
              type="text"
              placeholder="예: Q1 사업 전략 회의"
              class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="saveError && !saveForm.title.trim() ? 'border-danger-300 ring-1 ring-danger-300' : ''"
            />
          </div>

          <!-- 참석자 -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">참석자 (쉼표로 구분)</label>
            <input
              v-model="saveForm.participants"
              type="text"
              placeholder="예: 홍길동, 김철수, 이영희"
              class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <!-- 날짜 / 시간 / 소요 시간 -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">날짜</label>
              <input
                v-model="saveForm.date"
                type="date"
                class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">시간</label>
              <input
                v-model="saveForm.time"
                type="time"
                class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">소요 시간 (분)</label>
              <input
                v-model.number="saveForm.duration"
                type="number"
                min="0"
                class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- 자동 포함 항목 요약 -->
          <div class="bg-slate-50 rounded-lg p-3 space-y-1">
            <p class="text-xs font-medium text-slate-500 mb-2">자동 포함 항목</p>
            <p class="text-xs text-slate-600 flex items-center gap-1.5">
              <span :class="summaryResult?.summary ? 'text-success-500' : 'text-slate-300'">{{ summaryResult?.summary ? '✅' : '◻️' }}</span>
              AI 요약 (TL;DR)
            </p>
            <p class="text-xs text-slate-600 flex items-center gap-1.5">
              <span :class="summaryResult?.keyDecisions?.length ? 'text-success-500' : 'text-slate-300'">{{ summaryResult?.keyDecisions?.length ? '✅' : '◻️' }}</span>
              주요 결정사항 {{ summaryResult?.keyDecisions?.length ? `${summaryResult.keyDecisions.length}건` : '' }}
            </p>
            <p class="text-xs text-slate-600 flex items-center gap-1.5">
              <span :class="summaryResult?.actionItems?.length ? 'text-success-500' : 'text-slate-300'">{{ summaryResult?.actionItems?.length ? '✅' : '◻️' }}</span>
              액션 아이템 {{ summaryResult?.actionItems?.length ? `${summaryResult.actionItems.length}건` : '' }}
            </p>
            <p class="text-xs text-slate-600 flex items-center gap-1.5">
              <span :class="summaryResult?.keywords?.length ? 'text-success-500' : 'text-slate-300'">{{ summaryResult?.keywords?.length ? '✅' : '◻️' }}</span>
              키워드 태그 {{ summaryResult?.keywords?.length ? `${summaryResult.keywords.length}개` : '' }}
            </p>
            <p class="text-xs text-slate-600 flex items-center gap-1.5">
              <span class="text-success-500">✅</span>
              전체 텍스트 (Transcript)
            </p>
          </div>

          <!-- 에러 메시지 -->
          <div v-if="saveError" class="text-sm text-danger-500 bg-danger-50 rounded-lg px-3 py-2">
            {{ saveError }}
          </div>

          <!-- 저장 버튼 -->
          <div class="flex justify-end gap-3 pt-2">
            <button
              @click="resetResult"
              class="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
            >
              취소
            </button>
            <button
              @click="saveToDb"
              :disabled="isSaving"
              class="px-6 py-2.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {{ isSaving ? '저장 중...' : 'DB에 저장하기' }}
            </button>
          </div>
        </div>
      </div>

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

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease-out; }
.toast-leave-active { animation: toast-out 0.3s ease-in; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
</style>
