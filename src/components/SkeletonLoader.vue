<script setup>
import { useDarkMode } from '../composables/useDarkMode.js'
const { isDark } = useDarkMode()

defineProps({
  type: { type: String, default: 'card' }, // card, stat, list, text
  count: { type: Number, default: 1 },
})
</script>

<template>
  <!-- 스탯 카드 스켈레톤 -->
  <template v-if="type === 'stat'">
    <div
      v-for="i in count"
      :key="i"
      class="rounded-xl p-5 border"
      :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
    >
      <div class="flex items-start justify-between">
        <div class="space-y-2 flex-1">
          <div class="h-3 w-16 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
          <div class="h-7 w-20 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
          <div class="h-2.5 w-12 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
        </div>
        <div class="w-10 h-10 rounded-lg skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'" />
      </div>
    </div>
  </template>

  <!-- 미팅 카드 스켈레톤 -->
  <template v-if="type === 'card'">
    <div
      v-for="i in count"
      :key="i"
      class="rounded-xl p-5 border"
      :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
    >
      <div class="flex items-center gap-2 mb-3">
        <div class="h-5 w-12 rounded-full skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
        <div class="h-5 w-16 rounded-full skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'" />
      </div>
      <div class="h-4 w-3/4 rounded skeleton-pulse mb-3" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
      <div class="h-3 w-full rounded skeleton-pulse mb-1" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'" />
      <div class="h-3 w-2/3 rounded skeleton-pulse mb-4" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'" />
      <div class="flex items-center justify-between">
        <div class="flex gap-3">
          <div class="h-3 w-20 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
          <div class="h-3 w-24 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
        </div>
        <div class="flex -space-x-1">
          <div v-for="j in 3" :key="j" class="w-5 h-5 rounded-full skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
        </div>
      </div>
    </div>
  </template>

  <!-- 리스트 스켈레톤 -->
  <template v-if="type === 'list'">
    <div
      v-for="i in count"
      :key="i"
      class="flex items-center gap-3 py-3 px-4"
    >
      <div class="w-5 h-5 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3.5 w-3/4 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
        <div class="h-2.5 w-1/2 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'" />
      </div>
    </div>
  </template>

  <!-- 텍스트 블록 스켈레톤 -->
  <template v-if="type === 'text'">
    <div class="space-y-2">
      <div v-for="i in count" :key="i" class="h-3 rounded skeleton-pulse" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" :style="{ width: `${60 + Math.random() * 40}%` }" />
    </div>
  </template>
</template>
