<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActionItemRow from '../components/ActionItemRow.vue'
import { meetings } from '../data/mockData.js'

const route = useRoute()
const router = useRouter()
const activeTab = ref('summary')

const meeting = computed(() => {
  return meetings.find(m => m.id === Number(route.params.id))
})

const toggleItem = (item) => {
  item.done = !item.done
}

const formatDuration = (min) => {
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
  <div class="p-8" v-if="meeting">
    <!-- Back button -->
    <button @click="router.back()" class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      뒤로 가기
    </button>

    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-2">
        <span v-for="tag in meeting.tags" :key="tag" class="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 font-medium">
          {{ tag }}
        </span>
        <span
          class="text-xs px-2.5 py-1 rounded-full font-medium"
          :class="meeting.status === 'completed' ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600'"
        >
          {{ meeting.status === 'completed' ? '완료' : '진행 중' }}
        </span>
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-3">{{ meeting.title }}</h1>
      <div class="flex items-center gap-4 text-sm text-slate-500">
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

    <!-- Tabs -->
    <div class="border-b border-slate-200 mb-6">
      <div class="flex gap-6">
        <button
          v-for="tab in [
            { id: 'summary', label: 'AI 요약' },
            { id: 'actions', label: '액션 아이템' },
            { id: 'transcript', label: '회의록' },
          ]"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Tab Content: AI Summary -->
    <div v-if="activeTab === 'summary'" class="space-y-6">
      <div class="bg-white rounded-xl border border-slate-200 p-6">
        <div class="flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <h3 class="text-base font-semibold text-slate-900">AI 요약</h3>
        </div>
        <p class="text-sm text-slate-600 leading-relaxed">{{ meeting.aiSummary }}</p>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6">
        <h3 class="text-base font-semibold text-slate-900 mb-4">주요 결정 사항</h3>
        <ul class="space-y-3">
          <li v-for="(decision, i) in meeting.keyDecisions" :key="i" class="flex items-start gap-3">
            <div class="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {{ i + 1 }}
            </div>
            <p class="text-sm text-slate-700">{{ decision }}</p>
          </li>
        </ul>
      </div>
    </div>

    <!-- Tab Content: Action Items -->
    <div v-if="activeTab === 'actions'">
      <div class="bg-white rounded-xl border border-slate-200">
        <div class="p-5 border-b border-slate-100">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-900">액션 아이템</h3>
            <span class="text-xs text-slate-400">
              {{ meeting.actionItems.filter(a => a.done).length }}/{{ meeting.actionItems.length }} 완료
            </span>
          </div>
          <!-- Progress bar -->
          <div class="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-success-500 rounded-full transition-all duration-300"
              :style="{ width: meeting.actionItems.length ? `${(meeting.actionItems.filter(a => a.done).length / meeting.actionItems.length * 100)}%` : '0%' }"
            ></div>
          </div>
        </div>
        <div class="divide-y divide-slate-50">
          <ActionItemRow
            v-for="(item, i) in meeting.actionItems"
            :key="i"
            :item="item"
            @toggle="toggleItem"
          />
        </div>
      </div>
    </div>

    <!-- Tab Content: Transcript -->
    <div v-if="activeTab === 'transcript'">
      <div v-if="meeting.transcript.length" class="bg-white rounded-xl border border-slate-200 p-6">
        <div class="space-y-4">
          <div v-for="(entry, i) in meeting.transcript" :key="i" class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
              {{ entry.speaker[0] }}
            </div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-slate-900">{{ entry.speaker }}</span>
                <span class="text-xs text-slate-400">{{ entry.time }}</span>
              </div>
              <p class="text-sm text-slate-600 leading-relaxed">{{ entry.text }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-16 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p class="text-sm">회의록이 아직 없습니다</p>
      </div>
    </div>
  </div>

  <!-- Not found -->
  <div v-else class="p-8 text-center py-20">
    <p class="text-slate-400">회의를 찾을 수 없습니다</p>
    <router-link to="/meetings" class="text-sm text-primary-500 hover:text-primary-600 mt-2 inline-block">
      목록으로 돌아가기
    </router-link>
  </div>
</template>
