<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import ActionItemRow from '../components/ActionItemRow.vue'
import EmptyState from '../components/EmptyState.vue'
import { fetchMeetings } from '../services/api.js'
import { meetings as fallbackMeetings } from '../data/mockData.js'

const { isDark } = useDarkMode()

// 필터 상태
const filterStatus = ref('all-active')
const filterPriority = ref('all')
const sortBy = ref('priority') // 'priority' | 'dueDate' | 'status'
const sortAsc = ref(true)

// 회의 데이터에서 액션 아이템 추출 헬퍼
function extractActionItems(meetingList) {
  return meetingList.flatMap(m =>
    (m.actionItems || []).map(a => ({
      ...a,
      meetingTitle: m.title,
      meetingId: m.id,
      status: a.status || (a.done ? 'done' : 'pending'),
      priority: a.priority || 'medium',
    }))
  )
}

// 모든 액션 아이템 (하위 호환성 처리)
const allActionItems = ref(extractActionItems(fallbackMeetings))

// DB 데이터로 교체
onMounted(async () => {
  try {
    const res = await fetchMeetings()
    if (res.success && Array.isArray(res.data)) {
      allActionItems.value = extractActionItems(res.data)
    }
  } catch (err) {
    console.warn('[액션 아이템] DB 조회 실패, Mock 데이터 사용:', err.message)
  }
})

// 상태별 카운트
const statusCounts = computed(() => {
  const counts = { pending: 0, 'in-progress': 0, review: 0, done: 0 }
  allActionItems.value.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })
  return counts
})

const totalCount = computed(() => allActionItems.value.length)
const overdueCount = computed(() =>
  allActionItems.value.filter(a => a.status !== 'done' && new Date(a.dueDate) < new Date()).length
)

// 우선순위 가중치 (정렬용)
const priorityWeight = { urgent: 0, high: 1, medium: 2, low: 3 }
const statusWeight = { pending: 0, 'in-progress': 1, review: 2, done: 3 }

// 필터링된 아이템
const filteredItems = computed(() => {
  let items = allActionItems.value

  // 상태 필터
  if (filterStatus.value === 'all-active') {
    items = items.filter(a => a.status !== 'done')
  } else if (filterStatus.value !== 'all') {
    items = items.filter(a => a.status === filterStatus.value)
  }

  // 우선순위 필터
  if (filterPriority.value !== 'all') {
    items = items.filter(a => a.priority === filterPriority.value)
  }

  // 정렬
  items = [...items].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'priority') {
      cmp = priorityWeight[a.priority] - priorityWeight[b.priority]
    } else if (sortBy.value === 'dueDate') {
      cmp = new Date(a.dueDate) - new Date(b.dueDate)
    } else if (sortBy.value === 'status') {
      cmp = statusWeight[a.status] - statusWeight[b.status]
    }
    return sortAsc.value ? cmp : -cmp
  })

  return items
})

// 상태 필터 옵션
const statusFilterOptions = [
  { value: 'all-active', label: '미완료' },
  { value: 'pending', label: '대기' },
  { value: 'in-progress', label: '진행중' },
  { value: 'review', label: '검토중' },
  { value: 'done', label: '완료' },
  { value: 'all', label: '전체' },
]

// 우선순위 필터 옵션
const priorityFilterOptions = [
  { value: 'all', label: '전체', dotClass: '' },
  { value: 'urgent', label: '긴급', dotClass: 'bg-danger-500' },
  { value: 'high', label: '높음', dotClass: 'bg-warning-500' },
  { value: 'medium', label: '보통', dotClass: 'bg-primary-500' },
  { value: 'low', label: '낮음', dotClass: 'bg-slate-400' },
]

// 정렬 옵션
const sortOptions = [
  { value: 'priority', label: '우선순위' },
  { value: 'dueDate', label: '마감일' },
  { value: 'status', label: '상태' },
]

// 정렬 토글
const toggleSort = (field) => {
  if (sortBy.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortBy.value = field
    sortAsc.value = true
  }
}

// 토글 (하위 호환)
const toggleItem = (item) => {
  const found = allActionItems.value.find(a => a.text === item.text && a.assignee === item.assignee)
  if (found) {
    found.done = !found.done
    found.status = found.done ? 'done' : 'pending'
  }
}

// 상태 변경
const changeItemStatus = ({ item, status }) => {
  const found = allActionItems.value.find(a => a.text === item.text && a.assignee === item.assignee)
  if (found) {
    found.status = status
    found.done = status === 'done'
  }
}

// 완료율
const completionRate = computed(() => {
  if (!totalCount.value) return 0
  return Math.round((statusCounts.value.done / totalCount.value) * 100)
})
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">액션 아이템</h1>
      <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">모든 회의에서 발생한 액션 아이템을 관리하세요</p>
    </div>

    <!-- 요약 바 -->
    <div class="rounded-xl border p-5 mb-6" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
      <!-- 상태별 카운트 -->
      <div class="flex items-center gap-6 mb-4 flex-wrap">
        <div>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">전체</p>
          <p class="text-xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ totalCount }}</p>
        </div>
        <div>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">대기</p>
          <p class="text-xl font-bold text-slate-500">{{ statusCounts.pending }}</p>
        </div>
        <div>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">진행중</p>
          <p class="text-xl font-bold text-primary-500">{{ statusCounts['in-progress'] }}</p>
        </div>
        <div>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">검토중</p>
          <p class="text-xl font-bold text-warning-500">{{ statusCounts.review }}</p>
        </div>
        <div>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">완료</p>
          <p class="text-xl font-bold text-success-500">{{ statusCounts.done }}</p>
        </div>
        <div v-if="overdueCount > 0">
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">지연</p>
          <p class="text-xl font-bold text-danger-500">{{ overdueCount }}</p>
        </div>
      </div>

      <!-- 진행률 바 -->
      <div class="h-1.5 rounded-full overflow-hidden flex" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
        <div
          class="h-full bg-success-500 transition-all duration-300"
          :style="{ width: `${completionRate}%` }"
        ></div>
        <div
          class="h-full bg-warning-500 transition-all duration-300"
          :style="{ width: `${totalCount ? (statusCounts.review / totalCount * 100) : 0}%` }"
        ></div>
        <div
          class="h-full bg-primary-500 transition-all duration-300"
          :style="{ width: `${totalCount ? (statusCounts['in-progress'] / totalCount * 100) : 0}%` }"
        ></div>
      </div>
      <p class="text-xs mt-1.5" :class="isDark ? 'text-slate-500' : 'text-slate-400'">완료율 {{ completionRate }}%</p>
    </div>

    <!-- 필터 & 정렬 -->
    <div class="flex flex-col gap-3 mb-4">
      <!-- 상태 필터 -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-xs font-medium shrink-0" :class="isDark ? 'text-slate-400' : 'text-slate-500'">상태</span>
        <div class="flex rounded-lg p-0.5" :class="isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'">
          <button
            v-for="opt in statusFilterOptions"
            :key="opt.value"
            @click="filterStatus = opt.value"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="filterStatus === opt.value
              ? (isDark ? 'bg-slate-600 text-slate-100 shadow-sm' : 'bg-white text-slate-900 shadow-sm')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- 우선순위 필터 -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-xs font-medium shrink-0" :class="isDark ? 'text-slate-400' : 'text-slate-500'">우선순위</span>
        <div class="flex rounded-lg p-0.5" :class="isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'">
          <button
            v-for="opt in priorityFilterOptions"
            :key="opt.value"
            @click="filterPriority = opt.value"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
            :class="filterPriority === opt.value
              ? (isDark ? 'bg-slate-600 text-slate-100 shadow-sm' : 'bg-white text-slate-900 shadow-sm')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')"
          >
            <span v-if="opt.dotClass" class="w-1.5 h-1.5 rounded-full" :class="opt.dotClass"></span>
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- 정렬 -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-xs font-medium shrink-0" :class="isDark ? 'text-slate-400' : 'text-slate-500'">정렬</span>
        <div class="flex gap-1">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            @click="toggleSort(opt.value)"
            class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 border"
            :class="sortBy === opt.value
              ? (isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900')
              : (isDark ? 'border-transparent text-slate-500 hover:text-slate-300' : 'border-transparent text-slate-400 hover:text-slate-600')"
          >
            {{ opt.label }}
            <svg
              v-if="sortBy === opt.value"
              class="w-3 h-3 transition-transform"
              :class="{ 'rotate-180': !sortAsc }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 아이템 리스트 -->
    <div class="rounded-xl border" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
      <!-- 결과 카운트 -->
      <div class="px-4 py-2.5 border-b text-xs" :class="isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'">
        {{ filteredItems.length }}개 항목
      </div>

      <div class="divide-y" :class="isDark ? 'divide-slate-700/50' : 'divide-slate-50'">
        <ActionItemRow
          v-for="(item, i) in filteredItems"
          :key="`${item.text}-${item.assignee}-${i}`"
          :item="item"
          show-meeting
          @toggle="toggleItem"
          @status-change="changeItemStatus"
        />
      </div>
      <EmptyState
        v-if="filteredItems.length === 0 && filterStatus === 'all-active' && filterPriority === 'all'"
        type="celebration"
        title="모든 작업을 완료했습니다!"
        description="할당된 미완료 작업이 없습니다. 잘하셨습니다!"
      />
      <EmptyState
        v-else-if="filteredItems.length === 0"
        type="actions"
        title="해당하는 액션 아이템이 없습니다"
        description="필터를 변경해보세요."
      />
    </div>
  </div>
</template>
