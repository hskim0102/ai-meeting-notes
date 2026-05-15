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
    scrollTimeout = setTimeout(() => { isUserScrolling.value = false }, 3000)
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
      class="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300"
      :style="isMinimized ? 'height: 3rem' : 'height: 16rem'"
    >
      <!-- 글라스모피즘 패널 -->
      <div class="h-full bg-slate-900/96 backdrop-blur-md border-t border-white/10 shadow-2xl flex flex-col relative">

        <!-- 헤더 -->
        <div class="flex items-center justify-between px-5 h-12 border-b border-white/8 shrink-0">
          <div class="flex items-center gap-3">
            <!-- 상태 인디케이터 -->
            <div class="relative flex items-center">
              <div v-if="isListening" class="absolute inset-0 rounded-full bg-red-400/30 animate-ping"></div>
              <div
                class="w-2 h-2 rounded-full relative z-10"
                :class="isListening ? 'bg-red-400' : 'bg-slate-500'"
              ></div>
            </div>

            <!-- 아이콘 + 제목 -->
            <div class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <span class="text-sm font-semibold text-slate-200">실시간 자막</span>
            </div>

            <!-- 모드 배지 -->
            <span
              v-if="!isSpeechAvailable"
              class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30"
            >Whisper 전용</span>
            <span
              v-else-if="isListening"
              class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30"
            >인식 중</span>
          </div>

          <!-- 컨트롤 버튼 -->
          <div class="flex items-center gap-0.5">
            <button
              @click="isMinimized = !isMinimized"
              class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all duration-150"
              :title="isMinimized ? '펼치기' : '최소화'"
            >
              <svg class="w-4 h-4 transition-transform duration-200" :class="isMinimized ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all duration-150"
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
          class="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 scrollbar-thin"
        >
          <!-- 빈 상태 - 인식 중 -->
          <div
            v-if="segments.length === 0 && isListening"
            class="flex flex-col items-center justify-center h-full py-6 text-center"
          >
            <div class="flex items-end gap-1 mb-3 h-6">
              <div class="w-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 0ms; height: 12px;"></div>
              <div class="w-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 150ms; height: 20px;"></div>
              <div class="w-1.5 rounded-full bg-slate-500 animate-bounce" style="animation-delay: 300ms; height: 12px;"></div>
            </div>
            <p class="text-sm text-slate-500">음성을 인식하고 있습니다...</p>
          </div>

          <!-- 빈 상태 - 대기 -->
          <div
            v-else-if="segments.length === 0 && !isListening"
            class="flex items-center justify-center h-full py-6"
          >
            <p class="text-sm text-slate-600">자막이 여기에 표시됩니다</p>
          </div>

          <!-- 세그먼트 목록 -->
          <div
            v-for="seg in segments"
            :key="seg.id"
            class="flex items-start gap-3 rounded-lg px-3 py-2 transition-all duration-200"
            :class="{
              'opacity-50': seg.status === 'interim',
              'bg-white/5': seg.status === 'whisper',
              'hover:bg-white/3': seg.status === 'confirmed',
            }"
          >
            <!-- 타임스탬프 -->
            <span class="text-[11px] text-slate-600 shrink-0 mt-0.5 font-mono w-10 tabular-nums">
              {{ formatTime(seg.startTime) }}
            </span>

            <!-- 상태 도트 -->
            <div class="shrink-0 mt-1.5">
              <div
                class="w-1.5 h-1.5 rounded-full"
                :class="{
                  'bg-slate-600 animate-pulse': seg.status === 'interim',
                  'bg-slate-500': seg.status === 'confirmed',
                  'bg-sky-400': seg.status === 'whisper',
                }"
              ></div>
            </div>

            <!-- 텍스트 -->
            <div class="flex-1 min-w-0">
              <!-- 화자 라벨 (화자 분리 결과가 있을 때만 표시) -->
              <span
                v-if="seg.speaker"
                class="text-[10px] font-semibold mr-1.5 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400"
              >{{ seg.speaker }}</span>
              <span
                class="text-sm leading-relaxed"
                :class="{
                  'text-slate-500 italic': seg.status === 'interim',
                  'text-slate-300': seg.status === 'confirmed',
                  'text-white font-medium': seg.status === 'whisper',
                }"
              >
                {{ seg.text }}
                <!-- 깜빡이는 커서 (interim) -->
                <span
                  v-if="seg.status === 'interim'"
                  class="inline-block w-0.5 h-3.5 bg-slate-500 animate-pulse ml-0.5 align-middle"
                ></span>
              </span>
            </div>

            <!-- Whisper 아이콘 -->
            <div v-if="seg.status === 'whisper'" class="shrink-0 mt-0.5" title="Whisper AI 결과">
              <svg class="w-3 h-3 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 스크롤 최하단 아님 표시 -->
        <Transition name="scroll-hint">
          <div
            v-if="isUserScrolling && !isMinimized"
            class="absolute bottom-2 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/90 backdrop-blur rounded-full cursor-pointer shadow-lg border border-white/10"
            @click="isUserScrolling = false; scrollContainer && (scrollContainer.scrollTop = scrollContainer.scrollHeight)"
          >
            <svg class="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            <span class="text-[11px] text-slate-300 font-medium">최신으로</span>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.scroll-hint-enter-active,
.scroll-hint-leave-active {
  transition: opacity 0.2s ease;
}
.scroll-hint-enter-from,
.scroll-hint-leave-to {
  opacity: 0;
}

/* 얇은 스크롤바 */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(100, 116, 139, 0.3);
  border-radius: 9999px;
}
</style>
