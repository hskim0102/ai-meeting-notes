<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchMeetings } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const route = useRoute()
const router = useRouter()

// 전체 회의 데이터 (DB 또는 fallback)
const meetings = ref([...fallbackMeetings])
const useServerSearch = ref(false)
const serverResults = ref([])

// 검색 상태
const searchQuery = ref(route.query.q || '')
const dateFrom = ref(route.query.from || '')
const dateTo = ref(route.query.to || '')
const selectedParticipant = ref(route.query.participant || '')
const selectedTag = ref(route.query.tag || '')
const sortBy = ref(route.query.sort || 'relevance')
const showAdvanced = ref(false)

// DB에서 회의 데이터 로드
onMounted(async () => {
  try {
    const res = await fetch('/api/meetings')
    const data = await res.json()
    if (data.success && data.data.length > 0) {
      meetings.value = data.data
      useServerSearch.value = true
    }
  } catch { /* fallback to mock */ }
})

// 전체 참석자 / 태그 목록 추출
const allParticipants = computed(() => [...new Set(meetings.value.flatMap(m => m.participants || []))].sort())
const allTags = computed(() => [...new Set(meetings.value.flatMap(m => m.tags || []))].sort())

// 가중치 상수
const WEIGHTS = { title: 3.0, tags: 2.5, aiSummary: 2.0, actionItems: 1.5, participants: 1.5, transcript: 1.0 }

function countMatches(text, query) {
  if (!text || !query) return 0
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let count = 0, pos = 0
  while ((pos = lower.indexOf(q, pos)) !== -1) { count++; pos += q.length }
  return count
}

function extractSnippet(text, query, ctx = 50) {
  if (!text || !query) return null
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - ctx)
  const end = Math.min(text.length, idx + query.length + ctx)
  let s = ''
  if (start > 0) s += '...'
  s += text.slice(start, end)
  if (end < text.length) s += '...'
  return s
}

// 검색 결과 계산
const searchResults = computed(() => {
  const q = searchQuery.value.trim()
  if (!q && !dateFrom.value && !dateTo.value && !selectedParticipant.value && !selectedTag.value) return []

  let results = meetings.value.map(meeting => {
    let score = 0
    const snippets = []

    if (q) {
      const tm = countMatches(meeting.title, q)
      if (tm > 0) { score += tm * WEIGHTS.title; snippets.push({ field: '제목', text: meeting.title }) }

      if (meeting.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))) score += WEIGHTS.tags

      const sm = countMatches(meeting.aiSummary, q)
      if (sm > 0) { score += sm * WEIGHTS.aiSummary; snippets.push({ field: '요약', text: extractSnippet(meeting.aiSummary, q) }) }

      for (const item of meeting.actionItems) {
        if (countMatches(item.text, q) > 0) {
          score += WEIGHTS.actionItems
          snippets.push({ field: '액션아이템', text: item.text })
        }
      }

      if (meeting.participants.some(p => p.toLowerCase().includes(q.toLowerCase()))) score += WEIGHTS.participants

      for (const seg of meeting.transcript) {
        if (countMatches(seg.text, q) > 0) {
          score += WEIGHTS.transcript
          snippets.push({ field: '발언', text: extractSnippet(seg.text, q), speaker: seg.speaker, time: seg.time })
        }
      }

      for (const dec of meeting.keyDecisions) {
        if (countMatches(dec, q) > 0) {
          score += WEIGHTS.aiSummary
          snippets.push({ field: '결정사항', text: dec })
        }
      }
    }

    return { ...meeting, score, snippets }
  })

  if (q) results = results.filter(r => r.score > 0)
  if (dateFrom.value) results = results.filter(r => r.date >= dateFrom.value)
  if (dateTo.value) results = results.filter(r => r.date <= dateTo.value)
  if (selectedParticipant.value) results = results.filter(r => r.participants.includes(selectedParticipant.value))
  if (selectedTag.value) results = results.filter(r => r.tags.includes(selectedTag.value))

  if (sortBy.value === 'relevance') results.sort((a, b) => b.score - a.score)
  else if (sortBy.value === 'newest') results.sort((a, b) => b.date.localeCompare(a.date))
  else if (sortBy.value === 'oldest') results.sort((a, b) => a.date.localeCompare(b.date))

  return results
})

const hasSearched = computed(() =>
  searchQuery.value.trim() || dateFrom.value || dateTo.value || selectedParticipant.value || selectedTag.value
)

// 하이라이팅 유틸
function highlightText(text, query) {
  if (!text || !query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-warning-200 text-warning-900 rounded px-0.5">$1</mark>')
}

function goToMeeting(id) {
  router.push(`/meetings/${id}`)
}

function clearFilters() {
  searchQuery.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  selectedParticipant.value = ''
  selectedTag.value = ''
}

const sentimentLabel = (s) => ({ positive: '긍정', negative: '부정', neutral: '중립' }[s] || s)
const sentimentColor = (s) => ({
  positive: 'bg-success-100 text-success-700',
  negative: 'bg-danger-100 text-danger-700',
  neutral: 'bg-slate-100 text-slate-600',
}[s] || 'bg-slate-100 text-slate-600')
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto">
    <!-- 페이지 헤더 -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900">회의 검색</h1>
      <p class="text-sm text-slate-500 mt-1">키워드, 참석자, 태그, 날짜로 과거 회의를 검색합니다</p>
    </div>

    <!-- 검색 바 -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
      <div class="flex gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="회의 제목, 내용, 참석자, 키워드 검색..."
            class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keyup.enter="() => {}"
          />
        </div>
        <button
          @click="showAdvanced = !showAdvanced"
          class="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          :class="showAdvanced ? 'bg-primary-50 border-primary-200 text-primary-700' : 'text-slate-600'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          고급 필터
        </button>
      </div>

      <!-- 고급 필터 -->
      <div v-if="showAdvanced" class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">시작일</label>
          <input v-model="dateFrom" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">종료일</label>
          <input v-model="dateTo" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">참석자</label>
          <select v-model="selectedParticipant" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">전체</option>
            <option v-for="p in allParticipants" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">키워드 태그</label>
          <select v-model="selectedTag" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">전체</option>
            <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="col-span-2 flex justify-end">
          <button @click="clearFilters" class="text-sm text-slate-500 hover:text-slate-700 transition-colors">필터 초기화</button>
        </div>
      </div>
    </div>

    <!-- 검색 결과 헤더 -->
    <div v-if="hasSearched" class="flex items-center justify-between mb-4">
      <p class="text-sm text-slate-600">
        검색 결과 <span class="font-semibold text-slate-900">{{ searchResults.length }}</span>건
      </p>
      <select v-model="sortBy" class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="relevance">관련도순</option>
        <option value="newest">최신순</option>
        <option value="oldest">오래된순</option>
      </select>
    </div>

    <!-- 검색 결과 목록 -->
    <div v-if="hasSearched && searchResults.length > 0" class="space-y-3">
      <div
        v-for="result in searchResults"
        :key="result.id"
        @click="goToMeeting(result.id)"
        class="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
      >
        <!-- 상단: 제목 + 날짜 -->
        <div class="flex items-start justify-between mb-2">
          <h3 class="text-base font-semibold text-slate-900" v-html="highlightText(result.title, searchQuery.trim())"></h3>
          <span class="text-xs text-slate-400 whitespace-nowrap ml-4">{{ result.date }}</span>
        </div>

        <!-- 참석자 -->
        <div class="flex items-center gap-2 mb-3">
          <div class="flex -space-x-1.5">
            <div
              v-for="(p, idx) in result.participants.slice(0, 4)"
              :key="idx"
              class="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold border-2 border-white"
            >{{ p.charAt(0) }}</div>
          </div>
          <span class="text-xs text-slate-500">{{ result.participants.join(', ') }}</span>
        </div>

        <!-- 스니펫 -->
        <div v-if="result.snippets.length > 0" class="space-y-1.5">
          <div
            v-for="(snippet, idx) in result.snippets.slice(0, 3)"
            :key="idx"
            class="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2"
          >
            <span class="text-xs font-medium text-primary-600 mr-2">{{ snippet.field }}</span>
            <span v-if="snippet.speaker" class="text-xs text-slate-400 mr-1">[{{ snippet.speaker }}]</span>
            <span v-html="highlightText(snippet.text, searchQuery.trim())"></span>
          </div>
        </div>

        <!-- 하단: 태그 + 감정 -->
        <div class="flex items-center gap-2 mt-3">
          <span
            v-for="tag in result.tags"
            :key="tag"
            class="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-600"
          >{{ tag }}</span>
          <span :class="['px-2 py-0.5 text-xs font-medium rounded-full ml-auto', sentimentColor(result.sentiment)]">
            {{ sentimentLabel(result.sentiment) }}
          </span>
          <span v-if="sortBy === 'relevance'" class="text-xs text-slate-400">관련도 {{ result.score.toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <!-- 결과 없음 -->
    <div v-else-if="hasSearched && searchResults.length === 0" class="text-center py-16">
      <svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <p class="text-slate-500 text-sm">검색 결과가 없습니다</p>
      <p class="text-slate-400 text-xs mt-1">다른 키워드로 검색해 보세요</p>
    </div>

    <!-- 초기 상태 -->
    <div v-else class="text-center py-20">
      <svg class="w-20 h-20 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <p class="text-slate-400 text-sm">검색어를 입력하거나 필터를 설정하세요</p>
      <div class="flex justify-center gap-2 mt-4">
        <button
          v-for="tag in allTags.slice(0, 5)"
          :key="tag"
          @click="selectedTag = tag"
          class="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-colors"
        >{{ tag }}</button>
      </div>
    </div>
  </div>
</template>
