<script setup>
import { ref, computed } from 'vue'
import ActionItemRow from '../components/ActionItemRow.vue'
import { meetings } from '../data/mockData.js'

const filterStatus = ref('pending')

const allActionItems = ref(
  meetings.flatMap(m =>
    m.actionItems.map(a => ({ ...a, meetingTitle: m.title, meetingId: m.id }))
  )
)

const filteredItems = computed(() => {
  if (filterStatus.value === 'all') return allActionItems.value
  if (filterStatus.value === 'pending') return allActionItems.value.filter(a => !a.done)
  return allActionItems.value.filter(a => a.done)
})

const completedCount = computed(() => allActionItems.value.filter(a => a.done).length)
const totalCount = computed(() => allActionItems.value.length)

const toggleItem = (item) => {
  const found = allActionItems.value.find(a => a.text === item.text && a.assignee === item.assignee)
  if (found) found.done = !found.done
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-slate-900">액션 아이템</h1>
      <p class="text-sm text-slate-500 mt-1">모든 회의에서 발생한 액션 아이템을 관리하세요</p>
    </div>

    <!-- Summary bar -->
    <div class="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-6">
          <div>
            <p class="text-xs text-slate-400">전체</p>
            <p class="text-xl font-bold text-slate-900">{{ totalCount }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">완료</p>
            <p class="text-xl font-bold text-success-500">{{ completedCount }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400">미완료</p>
            <p class="text-xl font-bold text-warning-500">{{ totalCount - completedCount }}</p>
          </div>
        </div>
        <div class="flex bg-slate-100 rounded-lg p-0.5">
          <button
            v-for="opt in [{ value: 'pending', label: '미완료' }, { value: 'completed', label: '완료' }, { value: 'all', label: '전체' }]"
            :key="opt.value"
            @click="filterStatus = opt.value"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="filterStatus === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-success-500 rounded-full transition-all duration-300"
          :style="{ width: `${totalCount ? (completedCount / totalCount * 100) : 0}%` }"
        ></div>
      </div>
    </div>

    <!-- Items list -->
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="divide-y divide-slate-50">
        <ActionItemRow
          v-for="(item, i) in filteredItems"
          :key="i"
          :item="item"
          show-meeting
          @toggle="toggleItem"
        />
      </div>
      <div v-if="filteredItems.length === 0" class="text-center py-12 text-slate-400">
        <p class="text-sm">해당하는 액션 아이템이 없습니다</p>
      </div>
    </div>
  </div>
</template>
