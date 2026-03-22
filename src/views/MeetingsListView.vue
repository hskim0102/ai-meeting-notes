<script setup>
import { ref, computed, onMounted } from 'vue'
import MeetingCard from '../components/MeetingCard.vue'
import { fetchMeetings } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const meetings = ref([...fallbackMeetings])
const searchQuery = ref('')
const filterStatus = ref('all')

onMounted(async () => {
  try {
    const res = await fetchMeetings()
    if (res.success) meetings.value = res.data
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
</script>

<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">회의 목록</h1>
        <p class="text-sm text-slate-500 mt-1">전체 {{ meetings.length }}개의 회의</p> <!-- meetings is now a ref -->
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <div class="flex-1 relative">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="회의 제목 또는 태그로 검색..."
          class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
      <div class="flex bg-white border border-slate-200 rounded-lg p-0.5">
        <button
          v-for="opt in [{ value: 'all', label: '전체' }, { value: 'completed', label: '완료' }, { value: 'in-progress', label: '진행 중' }]"
          :key="opt.value"
          @click="filterStatus = opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          :class="filterStatus === opt.value ? 'bg-primary-500 text-white' : 'text-slate-600 hover:bg-slate-50'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Meeting list -->
    <div class="space-y-3">
      <MeetingCard v-for="meeting in filteredMeetings" :key="meeting.id" :meeting="meeting" />
      <div v-if="filteredMeetings.length === 0" class="text-center py-12 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <p class="text-sm">검색 결과가 없습니다</p>
      </div>
    </div>
  </div>
</template>
