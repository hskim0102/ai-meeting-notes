<script setup>
import { ref, computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const props = defineProps({
  meetingId: {
    type: [Number, String],
    required: true,
  },
})

const { isDark } = useDarkMode()

// 목(mock) 실시간 참여자 데이터
const viewers = ref([
  { id: 1, name: '김민수', color: '#3B82F6', status: 'active' },
  { id: 2, name: '이지은', color: '#10B981', status: 'active' },
  { id: 3, name: '박서준', color: '#F59E0B', status: 'idle' },
])

const activeCount = computed(() => viewers.value.length)

const hoveredViewer = ref(null)
</script>

<template>
  <div
    class="flex items-center gap-3 px-4 py-2 rounded-lg border"
    :class="[
      isDark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200',
    ]"
  >
    <!-- 실시간 뱃지 -->
    <div class="flex items-center gap-1.5">
      <span class="relative flex h-2.5 w-2.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
      <span
        class="text-xs font-semibold tracking-wide"
        :class="isDark ? 'text-green-400' : 'text-green-600'"
      >실시간</span>
    </div>

    <!-- 구분선 -->
    <div
      class="w-px h-4"
      :class="isDark ? 'bg-gray-600' : 'bg-gray-300'"
    ></div>

    <!-- 참여자 아바타 -->
    <div class="flex items-center -space-x-2">
      <div
        v-for="viewer in viewers"
        :key="viewer.id"
        class="relative"
        @mouseenter="hoveredViewer = viewer.id"
        @mouseleave="hoveredViewer = null"
      >
        <!-- 아바타 원 -->
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 cursor-default"
          :class="isDark ? 'border-gray-800' : 'border-white'"
          :style="{ backgroundColor: viewer.color }"
        >{{ viewer.name.charAt(0) }}</div>

        <!-- 상태 표시 점 -->
        <span
          class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          :class="[
            isDark ? 'border-gray-800' : 'border-white',
            viewer.status === 'active' ? 'bg-green-500' : 'bg-yellow-400',
          ]"
        ></span>

        <!-- 호버 툴팁 -->
        <div
          v-if="hoveredViewer === viewer.id"
          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap z-10"
          :class="isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-900 text-white'"
        >
          {{ viewer.name }}
          <span class="text-[10px] ml-1" :class="viewer.status === 'active' ? (isDark ? 'text-green-400' : 'text-green-300') : (isDark ? 'text-yellow-400' : 'text-yellow-300')">
            {{ viewer.status === 'active' ? '활성' : '대기' }}
          </span>
          <!-- 툴팁 화살표 -->
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4"
            :class="isDark ? 'border-t-gray-700' : 'border-t-gray-900'"
          ></div>
        </div>
      </div>
    </div>

    <!-- 참여자 수 텍스트 -->
    <span
      class="text-sm"
      :class="isDark ? 'text-gray-400' : 'text-gray-500'"
    >현재 <strong :class="isDark ? 'text-white' : 'text-gray-800'">{{ activeCount }}명</strong>이 보고 있습니다</span>
  </div>
</template>
