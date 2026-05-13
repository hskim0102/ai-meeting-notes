<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  segments: { type: Array, required: true },
  isListening: { type: Boolean, default: false },
  visible: { type: Boolean, default: false },
  isSpeechAvailable: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])

const isMinimized = ref(false)
const scrollContainer = ref(null)
const isUserScrolling = ref(false)
let scrollTimeout = null

// 새 세그먼트 추가 시 자동 스크롤
// (사용자가 위로 스크롤 중이면 건너뜀)
watch(
  () => props.segments.length,
  async () => {
    if (isUserScrolling.value || isMinimized.value) return
    await nextTick()
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  }
)

function onScroll() {
  const el = scrollContainer.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
  if (!atBottom) {
    isUserScrolling.value = true
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isUserScrolling.value = false
    }, 3000)
  } else {
    isUserScrolling.value = false
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 shadow-2xl transition-all duration-300"
      :style="isMinimized ? 'height: 3rem' : 'height: 14rem'"
    >
      <!-- 헤더바 -->
      <div class="flex items-center justify-between px-4 h-12 border-b border-slate-700/50 shrink-0">
        <div class="flex items-center gap-2">
          <div
            v-if="isListening"
            class="w-2 h-2 rounded-full bg-red-400 animate-pulse"
          ></div>
          <svg
            v-else
            class="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
          <span class="text-sm font-medium text-slate-200">실시간 자막</span>
          <span
            v-if="!isSpeechAvailable"
            class="text-xs text-amber-400 ml-1"
          >(Whisper 전용 모드)</span>
        </div>
        <div class="flex items-center gap-1">
          <!-- 최소화 버튼 -->
          <button
            @click="isMinimized = !isMinimized"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            :title="isMinimized ? '펼치기' : '최소화'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                v-if="isMinimized"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
          <!-- 닫기 버튼 -->
          <button
            @click="emit('close')"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="닫기"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 자막 스크롤 영역 -->
      <div
        v-if="!isMinimized"
        ref="scrollContainer"
        @scroll="onScroll"
        class="overflow-y-auto px-4 py-2 space-y-1"
        style="height: calc(14rem - 3rem)"
      >
        <!-- 빈 상태 -->
        <div
          v-if="segments.length === 0 && isListening"
          class="flex items-center gap-2 text-slate-500 text-sm pt-2"
        >
          <div class="flex gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          <span>음성을 인식하고 있습니다...</span>
        </div>

        <!-- 세그먼트 목록 -->
        <div
          v-for="seg in segments"
          :key="seg.id"
          class="flex items-start gap-3 text-sm py-0.5"
          :class="{
            'opacity-60 border-l-2 border-dashed border-slate-600 pl-2':
              seg.status === 'interim',
            'text-slate-200':
              seg.status === 'confirmed',
            'text-white font-medium border-l-2 border-sky-500 pl-2':
              seg.status === 'whisper',
          }"
        >
          <!-- 타임스탬프 -->
          <span class="text-xs text-slate-500 shrink-0 mt-0.5 font-mono w-10">
            {{ formatTime(seg.startTime) }}
          </span>
          <!-- 텍스트 -->
          <span
            class="flex-1 text-slate-200"
            :class="{ 'text-slate-400': seg.status === 'interim' }"
          >
            {{ seg.text }}
            <!-- 깜빡이는 커서 (interim) -->
            <span
              v-if="seg.status === 'interim'"
              class="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle"
            ></span>
          </span>
          <!-- Whisper 인증 아이콘 -->
          <span v-if="seg.status === 'whisper'" class="text-sky-400 shrink-0 text-xs mt-0.5">✦</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
