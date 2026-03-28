<script setup>
import { useDarkMode } from '../composables/useDarkMode.js'
const { isDark } = useDarkMode()

defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  color: { type: String, default: 'primary' },
  icon: String,
})
</script>

<template>
  <div
    class="rounded-xl p-5 border hover:shadow-md transition-shadow"
    :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
  >
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ title }}</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ value }}</p>
        <p v-if="subtitle" class="text-xs mt-1" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ subtitle }}</p>
      </div>
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center"
        :class="{
          'bg-primary-50 text-primary-500': color === 'primary' && !isDark,
          'bg-primary-900/30 text-primary-400': color === 'primary' && isDark,
          'bg-accent-50 text-accent-500': color === 'accent' && !isDark,
          'bg-accent-600/20 text-accent-400': color === 'accent' && isDark,
          'bg-success-50 text-success-500': color === 'success' && !isDark,
          'bg-success-500/15 text-success-500': color === 'success' && isDark,
          'bg-warning-50 text-warning-500': color === 'warning' && !isDark,
          'bg-warning-500/15 text-warning-500': color === 'warning' && isDark,
        }"
      >
        <svg v-if="icon === 'calendar'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <svg v-if="icon === 'clock'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-if="icon === 'check'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-if="icon === 'smile'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
      </div>
    </div>
  </div>
</template>
