<script setup>
import { useDarkMode } from '../composables/useDarkMode.js'
const { isDark } = useDarkMode()

defineProps({
  type: { type: String, default: 'default' }, // default, meetings, actions, search, celebration
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  actionTo: { type: String, default: '' },
})

defineEmits(['action'])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4">
    <!-- 일러스트 -->
    <div class="w-24 h-24 mb-6 rounded-2xl flex items-center justify-center"
      :class="isDark ? 'bg-slate-800' : 'bg-slate-100'"
    >
      <!-- 미팅 없음 -->
      <svg v-if="type === 'meetings'" class="w-12 h-12" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
      <!-- 액션 아이템 완료 / celebration -->
      <svg v-else-if="type === 'actions' || type === 'celebration'" class="w-12 h-12" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
      <!-- 검색 -->
      <svg v-else-if="type === 'search'" class="w-12 h-12" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <!-- 기본 -->
      <svg v-else class="w-12 h-12" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    </div>

    <!-- 텍스트 -->
    <h3 class="text-lg font-semibold mb-2" :class="isDark ? 'text-slate-200' : 'text-slate-700'">
      {{ title || '데이터가 없습니다' }}
    </h3>
    <p class="text-sm text-center max-w-sm mb-6" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
      {{ description }}
    </p>

    <!-- CTA 버튼 -->
    <router-link
      v-if="actionLabel && actionTo"
      :to="actionTo"
      class="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      {{ actionLabel }}
    </router-link>
    <button
      v-else-if="actionLabel"
      @click="$emit('action')"
      class="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
