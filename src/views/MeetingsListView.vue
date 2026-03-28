<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import MeetingCard from '../components/MeetingCard.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import EmptyState from '../components/EmptyState.vue'
import { fetchMeetings } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const { isDark } = useDarkMode()
const loading = ref(true)
const meetings = ref([...fallbackMeetings])
const searchQuery = ref('')
const filterStatus = ref('all')

onMounted(async () => {
  // 3초 타임아웃: 백엔드 미응답 시 mock 데이터로 즉시 전환
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetchMeetings({}, controller.signal)
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      meetings.value = res.data
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[회의 ��록] DB 조회 실패, Mock 데이터 사용:', err.message)
    }
  } finally {
    clearTimeout(timeout)
    loading.value = false
  }
})

const filteredMeetings = computed(() => {
  return meetings.value.filter(m => {
    const matchSearch = !searchQuery.value || m.title.includes(searchQuery.value) || (m.tags || []).some(t => t.includes(searchQuery.value))
    const matchStatus = filterStatus.value === 'all' || m.status === filterStatus.value
    return matchSearch && matchStatus
  })
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의 목록</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">전체 {{ meetings.length }}개의 회의</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <div class="flex-1 relative">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="회의 제목 또는 태그로 검색..."
          class="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          :class="isDark
            ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500'
            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'"
        />
      </div>
      <div class="flex rounded-lg p-0.5 border" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
        <button
          v-for="opt in [{ value: 'all', label: '전체' }, { value: 'completed', label: '완료' }, { value: 'in-progress', label: '진행 중' }]"
          :key="opt.value"
          @click="filterStatus = opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="filterStatus === opt.value
            ? 'bg-primary-500 text-white'
            : isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Meeting list -->
    <template v-if="loading">
      <div class="space-y-3">
        <SkeletonLoader type="card" :count="4" />
      </div>
    </template>
    <template v-else>
      <div class="space-y-3">
        <MeetingCard v-for="meeting in filteredMeetings" :key="meeting.id" :meeting="meeting" />
      </div>
      <EmptyState
        v-if="filteredMeetings.length === 0 && meetings.length > 0"
        type="search"
        title="검색 결과가 없습니다"
        description="다른 키워드로 검색하거나 필터를 변경해보세요."
      />
      <EmptyState
        v-if="meetings.length === 0"
        type="meetings"
        title="아직 회의록이 없습니다"
        description="첫 번째 회의를 시작하고 AI가 자동으로 요약해드립니다."
        action-label="첫 회의 시작하기"
        action-to="/meetings/new"
      />
    </template>
  </div>
</template>
