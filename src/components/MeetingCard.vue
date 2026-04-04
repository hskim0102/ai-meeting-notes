<script setup>
import { computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

const props = defineProps({
  meeting: Object,
})

const statusLabel = computed(() => {
  const map = { completed: '완료', 'in-progress': '진행 중', scheduled: '예정' }
  return map[props.meeting.status] || props.meeting.status
})

const statusClass = computed(() => {
  if (isDark.value) {
    const map = {
      completed: 'bg-success-500/15 text-success-500',
      'in-progress': 'bg-primary-500/15 text-primary-400',
      scheduled: 'bg-slate-700 text-slate-400',
    }
    return map[props.meeting.status] || 'bg-slate-700 text-slate-400'
  }
  const map = {
    completed: 'bg-success-50 text-success-600',
    'in-progress': 'bg-primary-50 text-primary-600',
    scheduled: 'bg-slate-100 text-slate-600',
  }
  return map[props.meeting.status] || 'bg-slate-100 text-slate-600'
})

const sentimentIcon = computed(() => {
  const map = { positive: 'positive', negative: 'negative', neutral: 'neutral' }
  return map[props.meeting.sentiment] || 'neutral'
})

const sentimentColor = computed(() => {
  const map = { positive: 'text-success-500', negative: 'text-danger-500', neutral: 'text-slate-400' }
  return map[props.meeting.sentiment] || 'text-slate-400'
})

const formatDuration = (min) => {
  if (!min) return ''
  if (min >= 60) return `${Math.floor(min / 60)}시간 ${min % 60}분`
  return `${min}분`
}

const participants = computed(() => props.meeting.participants || [])
const tags = computed(() => props.meeting.tags || [])
</script>

<template>
  <router-link
    :to="`/meetings/${meeting.id}`"
    class="block rounded-2xl border p-5 transition-all group"
    :class="isDark
      ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5'
      : 'bg-white border-slate-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-200'"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass">
            {{ statusLabel }}
          </span>
          <span
            v-for="tag in tags"
            :key="tag"
            class="text-xs px-2 py-0.5 rounded-full"
            :class="isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'"
          >
            {{ tag }}
          </span>
        </div>
        <h3
          class="text-sm font-semibold transition-colors truncate"
          :class="isDark ? 'text-slate-100 group-hover:text-primary-400' : 'text-slate-900 group-hover:text-primary-600'"
        >
          {{ meeting.title }}
        </h3>
      </div>
      <div class="ml-3" :class="sentimentColor">
        <svg v-if="sentimentIcon === 'positive'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
        <svg v-else-if="sentimentIcon === 'negative'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 15h6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>

    <p v-if="meeting.aiSummary" class="text-xs mb-3 line-clamp-2" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
      {{ meeting.aiSummary }}
    </p>

    <div class="flex items-center justify-between text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {{ meeting.date }}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ meeting.time }} ({{ formatDuration(meeting.duration) }})
        </span>
      </div>
      <div class="flex -space-x-1.5">
        <div
          v-for="(p, i) in participants.slice(0, 3)"
          :key="i"
          class="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-medium"
          :class="isDark ? 'bg-slate-700 border-slate-800 text-slate-300' : 'bg-slate-200 border-white text-slate-600'"
        >
          {{ p[0] }}
        </div>
        <div
          v-if="participants.length > 3"
          class="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-medium"
          :class="isDark ? 'bg-slate-600 border-slate-800 text-slate-300' : 'bg-slate-300 border-white text-slate-600'"
        >
          +{{ participants.length - 3 }}
        </div>
      </div>
    </div>
  </router-link>
</template>
