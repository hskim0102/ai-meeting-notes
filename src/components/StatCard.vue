<script setup>
import { ref, watch, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
const { isDark } = useDarkMode()

const props = defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  color: { type: String, default: 'primary' },
  icon: String,
  change: { type: Number, default: null },
})

// 카운트업 애니메이션
const displayValue = ref(props.value)
const animateCount = (target) => {
  const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''))
  if (isNaN(numTarget)) { displayValue.value = target; return }

  const prefix = String(target).match(/^[^0-9]*/)?.[0] || ''
  const suffix = String(target).match(/[^0-9.]*$/)?.[0] || ''
  const duration = 800
  const start = performance.now()

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(numTarget * eased)
    displayValue.value = `${prefix}${current}${suffix}`
    if (progress < 1) requestAnimationFrame(step)
    else displayValue.value = target
  }
  requestAnimationFrame(step)
}

onMounted(() => animateCount(props.value))
watch(() => props.value, (v) => animateCount(v))
</script>

<template>
  <div
    class="rounded-2xl p-5 border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
  >
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ title }}</p>
        <p class="text-2xl font-bold tracking-tight tabular-nums" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          {{ displayValue }}
        </p>
        <div class="flex items-center gap-2 mt-1">
          <p v-if="subtitle" class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ subtitle }}</p>
          <span
            v-if="change !== null"
            class="text-xs font-semibold flex items-center gap-0.5"
            :class="change >= 0 ? 'text-success-500' : 'text-danger-500'"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path v-if="change >= 0" stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
            </svg>
            {{ change >= 0 ? '+' : '' }}{{ change }}%
          </span>
        </div>
      </div>
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center"
        :class="{
          'bg-gradient-to-br from-primary-500 to-accent-500 text-white': color === 'primary',
          'bg-gradient-to-br from-accent-500 to-primary-500 text-white': color === 'accent',
          'bg-gradient-to-br from-success-500 to-success-600 text-white': color === 'success',
          'bg-gradient-to-br from-warning-500 to-warning-600 text-white': color === 'warning',
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
