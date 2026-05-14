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

const statusConfig = computed(() => {
  const configs = {
    completed: {
      badge: isDark.value ? 'bg-success-500/15 text-success-400' : 'bg-success-50 text-success-600',
      border: 'border-l-success-500',
      dot: 'bg-success-500',
    },
    'in-progress': {
      badge: isDark.value ? 'bg-primary-500/15 text-primary-400' : 'bg-primary-50 text-primary-600',
      border: 'border-l-primary-500',
      dot: 'bg-primary-500',
    },
    scheduled: {
      badge: isDark.value ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600',
      border: isDark.value ? 'border-l-slate-600' : 'border-l-slate-300',
      dot: isDark.value ? 'bg-slate-500' : 'bg-slate-300',
    },
  }
  return configs[props.meeting.status] || configs.scheduled
})

const sentimentConfig = computed(() => ({
  positive: { icon: 'positive', color: 'text-success-500', bg: isDark.value ? 'bg-success-500/10' : 'bg-success-50' },
  negative: { icon: 'negative', color: 'text-danger-500', bg: isDark.value ? 'bg-danger-500/10' : 'bg-red-50' },
  neutral:  { icon: 'neutral',  color: 'text-slate-400',  bg: isDark.value ? 'bg-slate-700/50' : 'bg-slate-50' },
}[props.meeting.sentiment] || { icon: 'neutral', color: 'text-slate-400', bg: isDark.value ? 'bg-slate-700/50' : 'bg-slate-50' }))

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
]

const participants = computed(() => props.meeting.participants || [])
const tags = computed(() => (props.meeting.tags || []).slice(0, 3))
const actionItems = computed(() => props.meeting.actionItems || [])
const pendingCount = computed(() => actionItems.value.filter(a => !a.done).length)

const formatDuration = (min) => {
  if (!min) return ''
  if (min >= 60) return `${Math.floor(min / 60)}시간 ${min % 60 ? ` ${min % 60}분` : ''}`
  return `${min}분`
}
</script>

<template>
  <router-link
    :to="`/meetings/${meeting.id}`"
    class="group relative flex overflow-hidden rounded-2xl border transition-all duration-200"
    :class="isDark
      ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-600 hover:shadow-xl hover:shadow-primary-500/5 hover:-translate-y-0.5'
      : 'bg-white border-slate-200 hover:border-primary-200 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5'"
  >
    <!-- 상태 컬러 왼쪽 바 -->
    <div
      class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
      :class="statusConfig.border.replace('border-l-', 'bg-')"
    ></div>

    <!-- 메인 컨텐츠 (왼쪽 바 고려해서 pl-5) -->
    <div class="flex-1 pl-5 pr-5 py-5 min-w-0">
      <!-- 상단: 상태 배지 + 감정 -->
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 상태 배지 -->
          <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold" :class="statusConfig.badge">
            <span class="w-1.5 h-1.5 rounded-full" :class="[statusConfig.dot, meeting.status === 'in-progress' ? 'animate-pulse' : '']"></span>
            {{ statusLabel }}
          </span>
          <!-- 태그 -->
          <span
            v-for="tag in tags"
            :key="tag"
            class="text-[10px] px-2 py-0.5 rounded-full font-medium"
            :class="isDark ? 'bg-white/5 text-slate-400 border border-white/8' : 'bg-slate-100 text-slate-500'"
          >
            {{ tag }}
          </span>
        </div>

        <!-- 감정 아이콘 -->
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-2"
          :class="sentimentConfig.bg"
        >
          <svg v-if="sentimentConfig.icon === 'positive'" class="w-4 h-4" :class="sentimentConfig.color" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
          <svg v-else-if="sentimentConfig.icon === 'negative'" class="w-4 h-4" :class="sentimentConfig.color" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
          <svg v-else class="w-4 h-4" :class="sentimentConfig.color" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15h6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <!-- 회의 제목 -->
      <h3
        class="text-sm font-semibold mb-2 transition-colors truncate"
        :class="isDark
          ? 'text-slate-100 group-hover:text-primary-300'
          : 'text-slate-900 group-hover:text-primary-600'"
      >
        {{ meeting.title }}
      </h3>

      <!-- AI 요약 (2줄 제한) -->
      <p
        v-if="meeting.aiSummary"
        class="text-xs mb-3 leading-relaxed line-clamp-2"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        {{ meeting.aiSummary }}
      </p>

      <!-- 하단: 날짜/시간 + 참석자 + 액션아이템 -->
      <div class="flex items-center justify-between">
        <!-- 날짜/시간 정보 -->
        <div class="flex items-center gap-3 text-xs" :class="isDark ? 'text-slate-600' : 'text-slate-400'">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {{ meeting.date }}
          </span>
          <span v-if="meeting.duration" class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ formatDuration(meeting.duration) }}
          </span>
        </div>

        <!-- 오른쪽: 참석자 + 액션아이템 카운트 -->
        <div class="flex items-center gap-2">
          <!-- 액션아이템 배지 -->
          <span
            v-if="pendingCount > 0"
            class="text-[10px] px-2 py-0.5 rounded-full font-medium"
            :class="isDark ? 'bg-warning-500/15 text-warning-500' : 'bg-amber-50 text-amber-600'"
          >
            ✓ {{ pendingCount }}
          </span>

          <!-- 참석자 아바타 -->
          <div class="flex -space-x-1.5">
            <div
              v-for="(p, i) in participants.slice(0, 4)"
              :key="i"
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-semibold text-white bg-gradient-to-br shrink-0"
              :class="[avatarColors[i % avatarColors.length], isDark ? 'border-zinc-900' : 'border-white']"
              :title="p"
            >
              {{ p[0] }}
            </div>
            <div
              v-if="participants.length > 4"
              class="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-semibold"
              :class="isDark ? 'bg-slate-700 border-zinc-900 text-slate-400' : 'bg-slate-200 border-white text-slate-500'"
            >
              +{{ participants.length - 4 }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </router-link>
</template>
