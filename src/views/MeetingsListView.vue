<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import MeetingCard from '../components/MeetingCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { fetchMeetings } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const { isDark } = useDarkMode()
const meetings = ref([...fallbackMeetings])
const totalCount = ref(fallbackMeetings.length)
const searchQuery = ref('')
const filterStatus = ref('all')
const dataSource = ref('mock')

// mock 데이터를 즉시 표시하고, API 데이터가 오면 교체
onMounted(async () => {
  try {
    const res = await fetchMeetings()
    if (res.success && Array.isArray(res.data)) {
      meetings.value = res.data
      totalCount.value = res.total || res.data.length
      dataSource.value = 'db'
    }
  } catch (err) {
    console.warn('[회의 목록] DB 조회 실패, Mock 데이터 사용:', err.message)
  }
})

const filteredMeetings = computed(() => {
  return meetings.value.filter(m => {
    const matchSearch = !searchQuery.value || m.title.includes(searchQuery.value) || (m.tags || []).some(t => t.includes(searchQuery.value))
    const matchStatus = filterStatus.value === 'all' || m.status === filterStatus.value
    return matchSearch && matchStatus
  })
})

const viewMode = ref('card') // 'card' | 'list'
const dateFilter = ref('all') // 'all' | 'week' | 'month'

const filteredByDate = computed(() => {
  if (dateFilter.value === 'all') return filteredMeetings.value
  const now = new Date()
  const cutoff = new Date()
  if (dateFilter.value === 'week') cutoff.setDate(now.getDate() - 7)
  if (dateFilter.value === 'month') cutoff.setMonth(now.getMonth() - 1)
  return filteredMeetings.value.filter(m => new Date(m.date) >= cutoff)
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의 목록</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">전체 {{ totalCount }}개의 회의 <span v-if="dataSource === 'mock'" class="text-xs">(오프라인)</span></p>
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

      <!-- 뷰 모드 + 날짜 필터 -->
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border overflow-hidden" :class="isDark ? 'border-zinc-700' : 'border-slate-200'">
          <button
            v-for="opt in [{ key: 'all', label: '전체' }, { key: 'week', label: '이번 주' }, { key: 'month', label: '이번 달' }]"
            :key="opt.key"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="dateFilter === opt.key
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="dateFilter = opt.key"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="flex rounded-lg border overflow-hidden" :class="isDark ? 'border-zinc-700' : 'border-slate-200'">
          <button
            class="p-1.5 transition-colors"
            :class="viewMode === 'card'
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="viewMode = 'card'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
            </svg>
          </button>
          <button
            class="p-1.5 transition-colors"
            :class="viewMode === 'list'
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="viewMode = 'list'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 카드 뷰 -->
    <div v-if="viewMode === 'card'" class="space-y-3">
      <MeetingCard v-for="m in filteredByDate" :key="m.id" :meeting="m" />
    </div>

    <!-- 리스트 뷰 (컴팩트) -->
    <div v-else class="space-y-1">
      <router-link
        v-for="m in filteredByDate"
        :key="m.id"
        :to="`/meetings/${m.id}`"
        class="flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        :class="isDark ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'"
      >
        <span class="text-xs font-mono tabular-nums w-20 shrink-0" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ m.date }}</span>
        <span class="text-sm font-medium truncate flex-1" :class="isDark ? 'text-slate-200' : 'text-slate-800'">{{ m.title }}</span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
          :class="m.status === 'completed'
            ? 'bg-success-50 text-success-600'
            : m.status === 'in-progress'
              ? 'bg-primary-50 text-primary-600'
              : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'"
        >
          {{ m.status === 'completed' ? '완료' : m.status === 'in-progress' ? '진행중' : '대기' }}
        </span>
        <span class="text-xs shrink-0" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ m.duration ? m.duration + '분' : '' }}</span>
      </router-link>
    </div>

    <EmptyState
      v-if="filteredByDate.length === 0 && meetings.length > 0"
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
  </div>
</template>
