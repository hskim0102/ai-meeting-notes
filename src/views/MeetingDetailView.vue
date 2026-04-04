<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import ActionItemRow from '../components/ActionItemRow.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import MeetingChatbot from '../components/MeetingChatbot.vue'
import SpeakerTimeline from '../components/SpeakerTimeline.vue'
import CollaborationIndicator from '../components/CollaborationIndicator.vue'
import { fetchMeeting, updateMeeting, sendMeetingEmail, updateSpeakerMap } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const { isDark } = useDarkMode()

const route = useRoute()
const router = useRouter()
const activeTab = ref('summary')
const meetingData = ref(null)
const loading = ref(true)

// ── 편집 모드 상태 ──
const isEditing = ref(false)
const saving = ref(false)
const toast = ref({ show: false, message: '', type: 'success' })

// 편집용 임시 데이터 (원본 보존)
const editData = reactive({
  aiSummary: '',
  keyDecisions: [],
  actionItems: [],
  tags: [],
})
const newTagInput = ref('')
const newDecisionInput = ref('')

// ── 메일 발송 모달 상태 ──
const showEmailModal = ref(false)
const sendingEmail = ref(false)
const emailForm = reactive({
  subject: '',
  recipients: [],       // { name, email, checked }
  additionalEmail: '',
  additionalList: [],    // 추가 입력한 이메일
})

onMounted(async () => {
  try {
    const res = await fetchMeeting(route.params.id)
    if (res.success) {
      meetingData.value = res.data
      if (res.data.speakerMap) {
        speakerMap.value = typeof res.data.speakerMap === 'string'
          ? JSON.parse(res.data.speakerMap)
          : res.data.speakerMap
      }
    }
  } catch (err) {
    console.warn('[회의 상세] DB 조회 실패, Mock 데이터 사용:', err.message)
    meetingData.value = fallbackMeetings.find(m => m.id === Number(route.params.id)) || null
  } finally {
    loading.value = false
  }
})

const meeting = computed(() => meetingData.value)

// 스피커별 색상 매핑
const speakerColors = computed(() => {
  if (!meeting.value?.transcript) return {}
  const colors = [
    { bg: 'bg-primary-100', text: 'text-primary-700', bubble: 'bg-primary-50 border-primary-200' },
    { bg: 'bg-accent-100', text: 'text-accent-700', bubble: 'bg-accent-50 border-accent-200' },
    { bg: 'bg-success-100', text: 'text-success-700', bubble: 'bg-success-50 border-success-200' },
    { bg: 'bg-warning-100', text: 'text-warning-700', bubble: 'bg-warning-50 border-warning-200' },
    { bg: 'bg-danger-100', text: 'text-danger-700', bubble: 'bg-danger-50 border-danger-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', bubble: 'bg-indigo-50 border-indigo-200' },
  ]
  const map = {}
  const speakers = [...new Set(meeting.value.transcript.map(e => e.speaker))]
  speakers.forEach((speaker, i) => {
    map[speaker] = colors[i % colors.length]
  })
  return map
})

const hasTranscript = computed(() => meeting.value?.transcript?.length > 0)

// ── 화자 이름 매핑 (SPEAKER_00 → 실제 이름) ──
const speakerMap = ref({})
const editingSpeaker = ref(null)
const editingName = ref('')

const getSpeakerName = (speakerId) => {
  if (!speakerId) return null
  return speakerMap.value[speakerId] || speakerId.replace('SPEAKER_', '화자')
}

const getSpeakerColor = (speakerId) => {
  if (!speakerId) return ''
  const colors = ['bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200']
  const speakers = [...new Set((meeting.value?.transcript || []).map(s => s.speaker).filter(Boolean))]
  const idx = speakers.indexOf(speakerId)
  return colors[idx % colors.length]
}

const saveSpeakerName = async (speakerId) => {
  speakerMap.value[speakerId] = editingName.value
  editingSpeaker.value = null
  try {
    await updateSpeakerMap(meeting.value.id, speakerMap.value)
  } catch (err) {
    console.error('화자 매핑 저장 실패:', err)
  }
}

function openSpeakerEdit(speakerId) {
  editingSpeaker.value = speakerId
  editingName.value = speakerMap.value[speakerId] || getSpeakerName(speakerId)
}

// ── 편집 진입/취소 ──
function startEditing() {
  const m = meeting.value
  editData.aiSummary = m.aiSummary || ''
  editData.keyDecisions = [...(m.keyDecisions || [])]
  editData.actionItems = (m.actionItems || []).map(item => ({ ...item }))
  editData.tags = [...(m.tags || [])]
  newTagInput.value = ''
  newDecisionInput.value = ''
  isEditing.value = true
}

function cancelEditing() {
  isEditing.value = false
}

// ── DB 저장 ──
async function saveChanges() {
  saving.value = true
  try {
    const res = await updateMeeting(meeting.value.id, {
      aiSummary: editData.aiSummary,
      keyDecisions: editData.keyDecisions,
      actionItems: editData.actionItems,
      tags: editData.tags,
    })
    if (res.success) {
      meetingData.value = res.data
      isEditing.value = false
      showToast('저장 완료', 'success')
    }
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

// ── 태그 편집 ──
function addTag() {
  const tag = newTagInput.value.trim()
  if (tag && !editData.tags.includes(tag)) {
    editData.tags.push(tag)
  }
  newTagInput.value = ''
}
function removeTag(idx) {
  editData.tags.splice(idx, 1)
}

// ── 결정사항 편집 ──
function addDecision() {
  const text = newDecisionInput.value.trim()
  if (text) {
    editData.keyDecisions.push(text)
    newDecisionInput.value = ''
  }
}
function removeDecision(idx) {
  editData.keyDecisions.splice(idx, 1)
}

// ── 액션 아이템 편집 ──
function addActionItem() {
  editData.actionItems.push({ text: '', assignee: '', dueDate: '', done: false })
}
function removeActionItem(idx) {
  editData.actionItems.splice(idx, 1)
}

// ── 토글 (뷰 모드) ──
const toggleItem = (item) => { item.done = !item.done }

// ── 메일 발송 모달 열기 ──
function openEmailModal() {
  const m = meeting.value
  emailForm.subject = `[회의록] ${m.title} - ${m.date}`
  emailForm.recipients = (m.participants || []).map(name => ({
    name,
    email: '',
    checked: true,
  }))
  emailForm.additionalEmail = ''
  emailForm.additionalList = []
  showEmailModal.value = true
}

function addAdditionalEmail() {
  const email = emailForm.additionalEmail.trim()
  if (email && !emailForm.additionalList.includes(email)) {
    emailForm.additionalList.push(email)
  }
  emailForm.additionalEmail = ''
}
function removeAdditionalEmail(idx) {
  emailForm.additionalList.splice(idx, 1)
}

async function submitEmail() {
  sendingEmail.value = true
  try {
    const recipients = emailForm.recipients
      .filter(r => r.checked)
      .map(r => r.email || `${r.name}@company.com`)
    const additionalRecipients = emailForm.additionalList

    const res = await sendMeetingEmail(meeting.value.id, {
      recipients,
      additionalRecipients,
      subject: emailForm.subject,
    })

    showEmailModal.value = false
    if (res.data?.preview) {
      showToast('SMTP 미설정 — 프리뷰만 생성됨 (.env에 SMTP_HOST 설정 필요)', 'warning')
    } else {
      showToast('메일 발송 완료', 'success')
    }
  } catch (err) {
    showToast('메일 발송 실패: ' + err.message, 'error')
  } finally {
    sendingEmail.value = false
  }
}

// ── 유틸 ──
function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const formatDuration = (min) => {
  if (!min) return ''
  if (min >= 60) return `${Math.floor(min / 60)}시간 ${min % 60}분`
  return `${min}분`
}

const sentimentLabel = computed(() => {
  const map = { positive: '긍정적', negative: '부정적', neutral: '중립적' }
  return map[meeting.value?.sentiment] || '중립적'
})

const sentimentColor = computed(() => {
  const map = { positive: 'text-success-500', negative: 'text-danger-500', neutral: 'text-slate-500' }
  return map[meeting.value?.sentiment] || 'text-slate-500'
})
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
          'bg-warning-500 text-white': toast.type === 'warning',
        }"
      >
        <svg v-if="toast.type === 'success'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        {{ toast.message }}
      </div>
    </Transition>
  </Teleport>

  <!-- 로딩 중 스켈레톤 -->
  <div v-if="loading" class="p-8">
    <div class="mb-8">
      <SkeletonLoader type="card" :count="1" />
    </div>
    <div class="space-y-4">
      <SkeletonLoader type="list" :count="5" />
    </div>
  </div>

  <div class="p-8" v-else-if="meeting">
    <!-- 실시간 협업 인디케이터 -->
    <CollaborationIndicator :meeting-id="meeting.id" />

    <!-- Back button -->
    <button @click="router.back()" class="flex items-center gap-1.5 text-sm mb-6 transition-colors" :class="isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      뒤로 가기
    </button>

    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-2">
        <!-- 뷰 모드 태그 -->
        <template v-if="!isEditing">
          <span v-for="tag in meeting.tags" :key="tag" class="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 font-medium">
            {{ tag }}
          </span>
        </template>
        <!-- 편집 모드 태그 -->
        <template v-else>
          <span v-for="(tag, idx) in editData.tags" :key="idx" class="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 font-medium flex items-center gap-1">
            {{ tag }}
            <button @click="removeTag(idx)" class="hover:text-danger-500 transition-colors">&times;</button>
          </span>
          <div class="flex items-center gap-1">
            <input
              v-model="newTagInput"
              @keyup.enter="addTag"
              type="text"
              placeholder="태그 추가..."
              class="text-xs px-2 py-1 border border-slate-200 rounded-full w-24 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </template>
        <span
          class="text-xs px-2.5 py-1 rounded-full font-medium"
          :class="meeting.status === 'completed' ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600'"
        >
          {{ meeting.status === 'completed' ? '완료' : '진행 중' }}
        </span>
      </div>
      <h1 class="text-2xl font-bold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ meeting.title }}</h1>
      <div class="flex items-center gap-4 text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {{ meeting.date }}
        </span>
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ meeting.time }} · {{ formatDuration(meeting.duration) }}
        </span>
        <span class="flex items-center gap-1.5" :class="sentimentColor">
          분위기: {{ sentimentLabel }}
        </span>
      </div>
      <!-- Participants -->
      <div class="flex items-center gap-2 mt-4">
        <div
          v-for="p in meeting.participants"
          :key="p"
          class="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1"
        >
          <div class="w-5 h-5 rounded-full bg-primary-200 flex items-center justify-center text-[10px] font-bold text-primary-700">
            {{ p[0] }}
          </div>
          <span class="text-xs text-slate-600">{{ p }}</span>
        </div>
      </div>
    </div>

    <!-- 액션 버튼 바 -->
    <div class="flex items-center gap-2 mb-6">
      <template v-if="!isEditing">
        <button
          @click="startEditing"
          class="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-600"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
          편집
        </button>
      </template>
      <template v-else>
        <button
          @click="saveChanges"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          {{ saving ? '저장 중...' : '저장' }}
        </button>
        <button
          @click="cancelEditing"
          class="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
        >
          취소
        </button>
      </template>
      <button
        @click="openEmailModal"
        class="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-600 ml-auto"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
        메일 발송
      </button>
    </div>

    <!-- 2-Column Layout -->
    <div class="flex flex-col lg:flex-row gap-6">

      <!-- ===== Left Column: Transcript (60%) ===== -->
      <div v-if="hasTranscript" class="w-full lg:w-[60%] space-y-6">
        <!-- 화자 분리 타임라인 -->
        <SpeakerTimeline
          :transcript="meeting.transcript"
          :speaker-map="speakerMap"
          @edit-speaker="openSpeakerEdit"
        />
      </div>

      <!-- ===== Right Column: AI Summary Panel (40%, or full width if no transcript) ===== -->
      <div :class="hasTranscript ? 'w-full lg:w-[40%]' : 'w-full'">
        <div class="lg:sticky lg:top-6 space-y-6">

          <!-- AI 요약 -->
          <div class="rounded-xl border p-6" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <h3 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">AI 요약</h3>
            </div>
            <!-- 뷰 모드 -->
            <p v-if="!isEditing" class="text-sm leading-relaxed" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ meeting.aiSummary }}</p>
            <!-- 편집 모드 -->
            <textarea
              v-else
              v-model="editData.aiSummary"
              rows="5"
              class="w-full text-sm leading-relaxed border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
              :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-200 text-slate-600'"
            ></textarea>
          </div>

          <!-- 주요 결정 사항 -->
          <div class="rounded-xl border p-6" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <h3 class="text-base font-semibold mb-4" :class="isDark ? 'text-slate-100' : 'text-slate-900'">주요 결정 사항</h3>
            <!-- 뷰 모드 -->
            <ul v-if="!isEditing" class="space-y-3">
              <li v-for="(decision, i) in meeting.keyDecisions" :key="i" class="flex items-start gap-3">
                <div class="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {{ i + 1 }}
                </div>
                <p class="text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-700'">{{ decision }}</p>
              </li>
            </ul>
            <!-- 편집 모드 -->
            <div v-else class="space-y-2">
              <div v-for="(decision, i) in editData.keyDecisions" :key="i" class="flex items-start gap-2">
                <div class="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                  {{ i + 1 }}
                </div>
                <input
                  v-model="editData.keyDecisions[i]"
                  type="text"
                  class="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-200'"
                />
                <button @click="removeDecision(i)" class="text-slate-400 hover:text-danger-500 transition-colors p-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <input
                  v-model="newDecisionInput"
                  @keyup.enter="addDecision"
                  type="text"
                  placeholder="새 결정사항 추가..."
                  class="flex-1 text-sm border border-dashed rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :class="isDark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-slate-300'"
                />
                <button @click="addDecision" class="text-primary-500 hover:text-primary-700 text-sm font-medium">추가</button>
              </div>
            </div>
          </div>

          <!-- 액션 아이템 -->
          <div class="rounded-xl border" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <div class="p-5 border-b" :class="isDark ? 'border-slate-700' : 'border-slate-100'">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">액션 아이템</h3>
                <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
                  {{ (isEditing ? editData.actionItems : (meeting.actionItems || [])).filter(a => a.done).length }}/{{ (isEditing ? editData.actionItems : (meeting.actionItems || [])).length }} 완료
                </span>
              </div>
              <!-- Progress bar -->
              <div class="mt-3 h-1.5 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
                <div
                  class="h-full bg-success-500 rounded-full transition-all duration-300"
                  :style="{ width: (() => { const items = isEditing ? editData.actionItems : (meeting.actionItems || []); return items.length ? `${(items.filter(a => a.done).length / items.length * 100)}%` : '0%' })() }"
                ></div>
              </div>
            </div>
            <!-- 뷰 모드 -->
            <div v-if="!isEditing" class="divide-y" :class="isDark ? 'divide-slate-700' : 'divide-slate-50'">
              <ActionItemRow
                v-for="(item, i) in (meeting.actionItems || [])"
                :key="i"
                :item="item"
                @toggle="toggleItem"
              />
            </div>
            <!-- 편집 모드 -->
            <div v-else class="p-4 space-y-3">
              <div v-for="(item, i) in editData.actionItems" :key="i" class="rounded-lg p-3" :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
                <div class="flex items-start gap-2">
                  <button
                    @click="item.done = !item.done"
                    class="mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                    :class="item.done ? 'bg-success-500 border-success-500' : isDark ? 'border-slate-500 hover:border-primary-400' : 'border-slate-300 hover:border-primary-400'"
                  >
                    <svg v-if="item.done" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </button>
                  <input
                    v-model="item.text"
                    type="text"
                    placeholder="액션 아이템 내용"
                    class="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-200'"
                  />
                  <button @click="removeActionItem(i)" class="text-slate-400 hover:text-danger-500 transition-colors p-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div class="flex gap-2 mt-2 ml-7">
                  <input
                    v-model="item.assignee"
                    type="text"
                    placeholder="담당자"
                    class="text-xs border rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-200'"
                  />
                  <input
                    v-model="item.dueDate"
                    type="date"
                    class="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'border-slate-200'"
                  />
                </div>
              </div>
              <button
                @click="addActionItem"
                class="w-full py-2 text-sm text-primary-500 hover:text-primary-700 border border-dashed rounded-lg hover:border-primary-300 transition-colors"
                :class="isDark ? 'border-slate-600' : 'border-slate-300'"
              >
                + 액션 아이템 추가
              </button>
            </div>
          </div>

          <!-- 태그 (편집 모드에서는 헤더에 표시되므로 뷰 모드에서만 하단에 표시) -->
          <div v-if="!isEditing && meeting.tags?.length" class="rounded-xl border p-6" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
            <h3 class="text-base font-semibold mb-3" :class="isDark ? 'text-slate-100' : 'text-slate-900'">태그</h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in meeting.tags"
                :key="tag"
                class="text-xs px-3 py-1.5 rounded-full font-medium"
                :class="isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-50 text-primary-600'"
              >
                {{ tag }}
              </span>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>

  <!-- Not found -->
  <div v-else-if="!loading" class="p-8 text-center py-20">
    <p class="text-slate-400">회의를 찾을 수 없습니다</p>
    <router-link to="/meetings" class="text-sm text-primary-500 hover:text-primary-600 mt-2 inline-block">
      목록으로 돌아가기
    </router-link>
  </div>

  <!-- Q&A 챗봇 -->
  <MeetingChatbot
    v-if="meeting"
    :meeting-id="meeting.id"
    :transcript="meeting.transcript || []"
    :ai-summary="meeting.aiSummary || ''"
  />

  <!-- 화자 이름 편집 모달 -->
  <Teleport to="body">
    <div v-if="editingSpeaker" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="editingSpeaker = null"></div>
      <div class="relative rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6" :class="isDark ? 'bg-slate-800' : 'bg-white'">
        <h2 class="text-base font-semibold mb-1" :class="isDark ? 'text-slate-100' : 'text-slate-900'">화자 이름 변경</h2>
        <p class="text-xs mb-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ editingSpeaker }} 화자의 이름을 입력하세요</p>
        <input
          v-model="editingName"
          type="text"
          placeholder="예: 김부장"
          class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
          :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'"
          @keyup.enter="saveSpeakerName(editingSpeaker)"
          @keyup.esc="editingSpeaker = null"
        />
        <div class="flex justify-end gap-2">
          <button
            @click="editingSpeaker = null"
            class="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
            :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
          >
            취소
          </button>
          <button
            @click="saveSpeakerName(editingSpeaker)"
            class="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 메일 발송 모달 -->
  <Teleport to="body">
    <div v-if="showEmailModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="showEmailModal = false"></div>
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center gap-2 mb-6">
            <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            <h2 class="text-lg font-semibold text-slate-900">회의록 메일 발송</h2>
          </div>

          <!-- 메일 제목 -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-slate-500 mb-1">메일 제목</label>
            <input
              v-model="emailForm.subject"
              type="text"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <!-- 수신자 (참석자) -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-slate-500 mb-2">수신자</label>
            <div class="space-y-2">
              <label
                v-for="(r, i) in emailForm.recipients"
                :key="i"
                class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
              >
                <input type="checkbox" v-model="r.checked" class="rounded border-slate-300 text-primary-500 focus:ring-primary-500" />
                <span>{{ r.name }}</span>
                <input
                  v-model="r.email"
                  type="email"
                  :placeholder="`${r.name}@company.com`"
                  class="ml-auto text-xs border border-slate-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>
            </div>
          </div>

          <!-- 추가 수신자 -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-slate-500 mb-1">추가 수신자</label>
            <div class="flex gap-2">
              <input
                v-model="emailForm.additionalEmail"
                @keyup.enter="addAdditionalEmail"
                type="email"
                placeholder="email@example.com"
                class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button @click="addAdditionalEmail" class="px-3 py-2 text-sm font-medium text-primary-500 border border-slate-200 rounded-lg hover:bg-slate-50">추가</button>
            </div>
            <div v-if="emailForm.additionalList.length" class="flex flex-wrap gap-1.5 mt-2">
              <span
                v-for="(email, idx) in emailForm.additionalList"
                :key="idx"
                class="flex items-center gap-1 text-xs bg-slate-100 rounded-full px-2.5 py-1"
              >
                {{ email }}
                <button @click="removeAdditionalEmail(idx)" class="text-slate-400 hover:text-danger-500">&times;</button>
              </span>
            </div>
          </div>

          <!-- 미리보기 -->
          <div class="mb-6">
            <label class="block text-xs font-medium text-slate-500 mb-2">미리보기</label>
            <div class="border border-slate-200 rounded-lg p-4 bg-slate-50 max-h-48 overflow-y-auto text-sm text-slate-600 space-y-2">
              <p class="font-medium text-slate-800">{{ meeting.title }}</p>
              <p class="text-xs text-slate-400">{{ meeting.date }} {{ meeting.time }} · {{ meeting.participants?.join(', ') }}</p>
              <hr class="border-slate-200">
              <div>
                <p class="text-xs font-semibold text-slate-500 mb-1">요약</p>
                <p class="text-xs">{{ meeting.aiSummary || '(요약 없음)' }}</p>
              </div>
              <div v-if="meeting.keyDecisions?.length">
                <p class="text-xs font-semibold text-slate-500 mb-1">결정사항</p>
                <ol class="text-xs list-decimal list-inside">
                  <li v-for="(d, i) in meeting.keyDecisions" :key="i">{{ d }}</li>
                </ol>
              </div>
              <div v-if="meeting.actionItems?.length">
                <p class="text-xs font-semibold text-slate-500 mb-1">액션 아이템</p>
                <ul class="text-xs space-y-0.5">
                  <li v-for="(item, i) in meeting.actionItems" :key="i">
                    {{ item.done ? '✅' : '◻️' }} {{ item.text }} ({{ item.assignee }}, ~{{ item.dueDate }})
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 버튼 -->
          <div class="flex justify-end gap-2">
            <button @click="showEmailModal = false" class="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">취소</button>
            <button
              @click="submitEmail"
              :disabled="sendingEmail"
              class="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              {{ sendingEmail ? '발송 중...' : '발송하기' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease-out; }
.toast-leave-active { animation: toast-out 0.3s ease-in; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
</style>
