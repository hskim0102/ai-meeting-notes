<script setup>
/**
 * RecordingsListView.vue - 녹음 보관함
 * ─────────────────────────────────────────────────
 * 서버에 저장된 녹음 파일 목록 조회, 재생, STT 변환, 삭제
 * ─────────────────────────────────────────────────
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import {
  fetchRecordings,
  deleteRecording,
  transcribeRecording,
  getRecordingFileUrl,
  summarizeTranscript,
  createMeeting,
} from '../services/api.js'

const { isDark } = useDarkMode()
const router = useRouter()

// ── 상태 ──
const recordings = ref([])
const isLoading = ref(true)
const error = ref('')
const filter = ref('all') // 'all' | 'pending' | 'transcribed' | 'completed'

// 처리 중인 녹음 ID 추적
const processingId = ref(null)
const processingStep = ref('') // 'transcribing' | 'summarizing' | 'saving'

// STT 결과 임시 저장 (모달용)
const transcriptResult = ref(null)
const summaryResult = ref(null)
const activeRecordingId = ref(null)

// 삭제 확인 모달
const deleteTargetId = ref(null)

// 재생 중인 녹음 ID
const playingId = ref(null)

// 토스트
const toast = ref({ show: false, message: '', type: 'success' })

// ── 필터링된 목록 ──
const filteredRecordings = computed(() => {
  if (filter.value === 'all') return recordings.value
  return recordings.value.filter(r => r.status === filter.value)
})

// ── 통계 ──
const stats = computed(() => ({
  total: recordings.value.length,
  pending: recordings.value.filter(r => r.status === 'pending').length,
  transcribed: recordings.value.filter(r => r.status === 'transcribed').length,
  completed: recordings.value.filter(r => r.status === 'completed').length,
}))

// ── 데이터 로드 ──
async function loadRecordings() {
  isLoading.value = true
  error.value = ''
  try {
    const res = await fetchRecordings()
    recordings.value = res.data || []
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadRecordings)

// ── STT 변환 ──
async function handleTranscribe(id) {
  processingId.value = id
  processingStep.value = 'transcribing'

  try {
    const res = await transcribeRecording(id)
    if (res.success) {
      transcriptResult.value = res.data
      activeRecordingId.value = id
      showToast('STT 변환이 완료되었습니다.')
      await loadRecordings() // 상태 갱신
    }
  } catch (err) {
    showToast(`STT 변환 실패: ${err.message}`, 'error')
  } finally {
    processingId.value = null
    processingStep.value = ''
  }
}

// ── STT 결과로 회의록 생성 ──
async function handleCreateMeeting(recordingId) {
  if (!transcriptResult.value) return

  processingId.value = recordingId
  processingStep.value = 'summarizing'

  try {
    // AI 요약
    const summaryRes = await summarizeTranscript(transcriptResult.value.fullText)
    if (!summaryRes.success) {
      showToast('AI 요약 실패', 'error')
      return
    }

    processingStep.value = 'saving'

    const meta = transcriptResult.value.meta
    const summary = summaryRes.data

    // 회의록 생성
    const now = new Date()
    const meetingData = {
      title: `회의녹음_${meta.originalFileName?.replace(/\.[^.]+$/, '') || now.toLocaleDateString('ko')}`,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      duration: Math.round((meta.totalDuration || 0) / 60),
      participants: [],
      status: 'completed',
      tags: summary.keywords || [],
      aiSummary: summary.summary || '',
      keyDecisions: summary.keyDecisions || [],
      actionItems: (summary.actionItems || []).map(item => ({
        text: item.text || item.task || '',
        assignee: item.assignee || '',
        dueDate: item.dueDate || item.due_date || '',
        done: false,
      })),
      sentiment: summary.sentiment || 'neutral',
      transcript: (transcriptResult.value.segments || []).map(seg => ({
        speaker: '화자',
        time: formatTime(seg.start),
        text: seg.text,
      })),
      fullText: transcriptResult.value.fullText || '',
    }

    const createRes = await createMeeting(meetingData)

    if (createRes.success) {
      showToast('회의록이 생성되었습니다.')
      transcriptResult.value = null
      activeRecordingId.value = null
      await loadRecordings()

      setTimeout(() => {
        router.push(`/meetings/${createRes.data.id}`)
      }, 800)
    }
  } catch (err) {
    showToast(`회의록 생성 실패: ${err.message}`, 'error')
  } finally {
    processingId.value = null
    processingStep.value = ''
  }
}

// ── 삭제 ──
async function confirmDelete() {
  if (!deleteTargetId.value) return
  try {
    await deleteRecording(deleteTargetId.value)
    showToast('녹음이 삭제되었습니다.')
    deleteTargetId.value = null
    await loadRecordings()
  } catch (err) {
    showToast(`삭제 실패: ${err.message}`, 'error')
  }
}

// ── 유틸리티 ──
function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds) {
  if (!seconds) return '0초'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}초`
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

function statusLabel(status) {
  return { pending: '대기', transcribed: '변환 완료', completed: '회의록 생성됨' }[status] || status
}

function statusColor(status) {
  if (isDark.value) {
    return {
      pending: 'bg-amber-500/20 text-amber-400',
      transcribed: 'bg-primary-500/20 text-primary-400',
      completed: 'bg-success-500/20 text-success-400',
    }[status] || ''
  }
  return {
    pending: 'bg-amber-50 text-amber-600',
    transcribed: 'bg-primary-50 text-primary-600',
    completed: 'bg-success-50 text-success-600',
  }[status] || ''
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function togglePlay(id) {
  if (playingId.value === id) {
    playingId.value = null
  } else {
    playingId.value = id
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
        {{ toast.message }}
      </div>
    </Transition>
  </Teleport>

  <!-- 삭제 확인 모달 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteTargetId" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="deleteTargetId = null">
        <div class="rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" :class="isDark ? 'bg-slate-800' : 'bg-white'">
          <h3 class="text-lg font-semibold mb-2" :class="isDark ? 'text-slate-100' : 'text-slate-900'">녹음 삭제</h3>
          <p class="text-sm mb-5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
            이 녹음을 삭제하시겠습니까? 서버의 오디오 파일도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <div class="flex justify-end gap-3">
            <button
              @click="deleteTargetId = null"
              class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            >
              취소
            </button>
            <button
              @click="confirmDelete"
              class="px-4 py-2 text-sm font-medium bg-danger-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div class="p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">녹음 보관함</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">서버에 저장된 녹음 파일을 관리하고 언제든 STT 변환할 수 있습니다</p>
      </div>
      <router-link
        to="/meetings/new"
        class="px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        새 녹음
      </router-link>
    </div>

    <!-- 통계 카드 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="rounded-xl border p-4" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">전체</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ stats.total }}</p>
      </div>
      <div class="rounded-xl border p-4" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <p class="text-xs font-medium mb-1 text-amber-500">변환 대기</p>
        <p class="text-2xl font-bold text-amber-500">{{ stats.pending }}</p>
      </div>
      <div class="rounded-xl border p-4" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <p class="text-xs font-medium mb-1 text-primary-500">변환 완료</p>
        <p class="text-2xl font-bold text-primary-500">{{ stats.transcribed }}</p>
      </div>
      <div class="rounded-xl border p-4" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <p class="text-xs font-medium mb-1 text-success-500">회의록 생성됨</p>
        <p class="text-2xl font-bold text-success-500">{{ stats.completed }}</p>
      </div>
    </div>

    <!-- 필터 탭 -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="f in [
          { key: 'all', label: '전체' },
          { key: 'pending', label: '대기' },
          { key: 'transcribed', label: '변환 완료' },
          { key: 'completed', label: '회의록 생성됨' },
        ]"
        :key="f.key"
        @click="filter = f.key"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="filter === f.key
          ? 'bg-primary-500 text-white'
          : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="flex justify-center py-20">
      <div class="animate-spin w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="rounded-xl border p-6 text-center" :class="isDark ? 'bg-red-900/20 border-red-800' : 'bg-danger-50 border-red-200'">
      <p class="text-danger-500 mb-3">{{ error }}</p>
      <button @click="loadRecordings" class="text-sm text-primary-500 hover:underline">다시 시도</button>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="filteredRecordings.length === 0" class="text-center py-20">
      <svg class="w-16 h-16 mx-auto mb-4" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
      <p class="text-lg font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        {{ filter === 'all' ? '저장된 녹음이 없습니다' : '해당 상태의 녹음이 없습니다' }}
      </p>
      <p class="text-sm mb-6" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        새 회의록 페이지에서 녹음하면 자동으로 서버에 저장됩니다
      </p>
      <router-link
        to="/meetings/new"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        녹음 시작하기
      </router-link>
    </div>

    <!-- 녹음 목록 -->
    <div v-else class="space-y-3">
      <div
        v-for="rec in filteredRecordings"
        :key="rec.id"
        class="rounded-xl border p-5 transition-colors"
        :class="isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'"
      >
        <div class="flex items-start gap-4">
          <!-- 아이콘 -->
          <div class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            :class="isDark ? 'bg-primary-500/20' : 'bg-primary-50'">
            <svg class="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          </div>

          <!-- 정보 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
                {{ rec.fileName }}
              </p>
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" :class="statusColor(rec.status)">
                {{ statusLabel(rec.status) }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              <span>{{ formatFileSize(rec.fileSize) }}</span>
              <span :class="isDark ? 'text-slate-600' : 'text-slate-300'">|</span>
              <span>{{ formatDuration(rec.duration) }}</span>
              <span :class="isDark ? 'text-slate-600' : 'text-slate-300'">|</span>
              <span>{{ formatDate(rec.createdAt) }}</span>
            </div>

            <!-- 오디오 플레이어 (재생 중일 때) -->
            <div v-if="playingId === rec.id" class="mt-3">
              <audio
                :src="getRecordingFileUrl(rec.id)"
                controls
                autoplay
                class="w-full h-10"
                @ended="playingId = null"
              />
            </div>

            <!-- 처리 중 표시 -->
            <div v-if="processingId === rec.id" class="mt-3 flex items-center gap-2">
              <div class="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span class="text-xs text-primary-500 font-medium">
                {{ processingStep === 'transcribing' ? 'STT 변환 중...' : processingStep === 'summarizing' ? 'AI 요약 중...' : '회의록 저장 중...' }}
              </span>
            </div>

            <!-- STT 결과 미리보기 (해당 녹음의 결과가 있을 때) -->
            <div v-if="activeRecordingId === rec.id && transcriptResult" class="mt-3">
              <div class="rounded-lg p-3 text-sm" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
                <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-300' : 'text-slate-600'">STT 결과 미리보기</p>
                <p class="text-xs leading-relaxed line-clamp-3" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
                  {{ transcriptResult.fullText.substring(0, 200) }}{{ transcriptResult.fullText.length > 200 ? '...' : '' }}
                </p>
              </div>
              <button
                @click="handleCreateMeeting(rec.id)"
                :disabled="processingId === rec.id"
                class="mt-2 px-4 py-2 text-xs font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                AI 요약 + 회의록 생성
              </button>
            </div>
          </div>

          <!-- 액션 버튼 -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- 재생 -->
            <button
              @click="togglePlay(rec.id)"
              class="p-2 rounded-lg transition-colors"
              :class="playingId === rec.id
                ? 'bg-primary-500 text-white'
                : (isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')"
              :title="playingId === rec.id ? '정지' : '재생'"
            >
              <svg v-if="playingId !== rec.id" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
              </svg>
            </button>

            <!-- STT 변환 (pending 상태일 때) -->
            <button
              v-if="rec.status === 'pending'"
              @click="handleTranscribe(rec.id)"
              :disabled="processingId === rec.id"
              class="p-2 rounded-lg transition-colors disabled:opacity-50"
              :class="isDark ? 'text-accent-400 hover:bg-slate-700' : 'text-accent-500 hover:bg-slate-100'"
              title="STT 변환"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </button>

            <!-- 회의록 보기 (completed 상태일 때) -->
            <router-link
              v-if="rec.status === 'completed' && rec.meetingId"
              :to="`/meetings/${rec.meetingId}`"
              class="p-2 rounded-lg transition-colors"
              :class="isDark ? 'text-primary-400 hover:bg-slate-700' : 'text-primary-500 hover:bg-slate-100'"
              title="회의록 보기"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </router-link>

            <!-- 삭제 -->
            <button
              @click="deleteTargetId = rec.id"
              class="p-2 rounded-lg transition-colors"
              :class="isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-danger-400' : 'text-slate-400 hover:bg-slate-100 hover:text-danger-500'"
              title="삭제"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease-out; }
.toast-leave-active { animation: toast-out 0.3s ease-in; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }

.modal-enter-active { animation: modal-in 0.2s ease-out; }
.modal-leave-active { animation: modal-out 0.15s ease-in; }
@keyframes modal-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes modal-out { from { opacity: 1; } to { opacity: 0; } }

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
