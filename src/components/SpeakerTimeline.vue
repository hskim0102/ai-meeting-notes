<script setup>
import { computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

const props = defineProps({
  transcript: { type: Array, default: () => [] },
})

// 화자 색상 팔레트 (등장 순서대로 할당)
const speakerColors = ['primary-500', 'success-500', 'warning-500', 'danger-500', 'purple-500']

// 화자별 색상 매핑 (등장 순서 기준)
const speakerColorMap = computed(() => {
  const map = {}
  let colorIdx = 0
  for (const entry of props.transcript) {
    if (!(entry.speaker in map)) {
      map[entry.speaker] = speakerColors[colorIdx % speakerColors.length]
      colorIdx++
    }
  }
  return map
})

// 고유 화자 목록 (등장 순서)
const speakers = computed(() => {
  return Object.keys(speakerColorMap.value)
})

// 화자 이니셜 (첫 글자)
const getInitials = (name) => {
  return name.charAt(0)
}

// 화자 통계
const speakerStats = computed(() => {
  const counts = {}
  for (const entry of props.transcript) {
    counts[entry.speaker] = (counts[entry.speaker] || 0) + 1
  }
  const total = props.transcript.length || 1
  return speakers.value.map((speaker) => ({
    speaker,
    count: counts[speaker] || 0,
    percentage: Math.round(((counts[speaker] || 0) / total) * 100),
    color: speakerColorMap.value[speaker],
  }))
})

// 아바타 배경색 클래스
const avatarBgClass = (color) => {
  const map = {
    'primary-500': 'bg-primary-500',
    'success-500': 'bg-success-500',
    'warning-500': 'bg-warning-500',
    'danger-500': 'bg-danger-500',
    'purple-500': 'bg-purple-500',
  }
  return map[color] || 'bg-slate-500'
}

// 통계 바 배경색 클래스
const barBgClass = (color) => {
  return avatarBgClass(color)
}

// 범례 도트 클래스
const legendDotClass = (color) => {
  return avatarBgClass(color)
}

// 말풍선 배경색 클래스
const bubbleClass = (color) => {
  if (isDark.value) {
    const map = {
      'primary-500': 'bg-primary-500/10 border-primary-500/20',
      'success-500': 'bg-success-500/10 border-success-500/20',
      'warning-500': 'bg-warning-500/10 border-warning-500/20',
      'danger-500': 'bg-danger-500/10 border-danger-500/20',
      'purple-500': 'bg-purple-500/10 border-purple-500/20',
    }
    return map[color] || 'bg-slate-700 border-slate-600'
  }
  const map = {
    'primary-500': 'bg-primary-50 border-primary-100',
    'success-500': 'bg-success-50 border-success-100',
    'warning-500': 'bg-warning-50 border-warning-100',
    'danger-500': 'bg-danger-50 border-danger-100',
    'purple-500': 'bg-purple-50 border-purple-100',
  }
  return map[color] || 'bg-slate-50 border-slate-200'
}
</script>

<template>
  <div
    class="rounded-xl border p-5 transition-all"
    :class="isDark
      ? 'bg-slate-800 border-slate-700'
      : 'bg-white border-slate-200'"
  >
    <!-- 빈 상태 -->
    <div v-if="transcript.length === 0" class="py-8 text-center">
      <svg
        class="w-10 h-10 mx-auto mb-3"
        :class="isDark ? 'text-slate-600' : 'text-slate-300'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
      <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        발화 기록이 없습니다
      </p>
    </div>

    <template v-else>
      <!-- 화자 범례 -->
      <div class="flex items-center gap-4 mb-5 flex-wrap">
        <span
          class="text-xs font-medium"
          :class="isDark ? 'text-slate-400' : 'text-slate-500'"
        >
          화자:
        </span>
        <div
          v-for="speaker in speakers"
          :key="speaker"
          class="flex items-center gap-1.5"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="legendDotClass(speakerColorMap[speaker])"
          ></span>
          <span
            class="text-xs font-medium"
            :class="isDark ? 'text-slate-300' : 'text-slate-600'"
          >
            {{ speaker }}
          </span>
        </div>
      </div>

      <!-- 타임라인 -->
      <div class="space-y-3 mb-6">
        <div
          v-for="(entry, idx) in transcript"
          :key="idx"
          class="flex items-start gap-3"
        >
          <!-- 타임스탬프 -->
          <span
            class="text-[11px] font-mono mt-1.5 shrink-0 w-12 text-right"
            :class="isDark ? 'text-slate-500' : 'text-slate-400'"
          >
            {{ entry.time }}
          </span>

          <!-- 화자 아바타 -->
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold"
            :class="avatarBgClass(speakerColorMap[entry.speaker])"
          >
            {{ getInitials(entry.speaker) }}
          </div>

          <!-- 말풍선 -->
          <div class="flex-1 min-w-0">
            <span
              class="text-xs font-medium mb-0.5 block"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >
              {{ entry.speaker }}
            </span>
            <div
              class="rounded-lg border px-3 py-2 text-sm"
              :class="[
                bubbleClass(speakerColorMap[entry.speaker]),
                isDark ? 'text-slate-200' : 'text-slate-700'
              ]"
            >
              {{ entry.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 화자 통계 -->
      <div
        class="border-t pt-4"
        :class="isDark ? 'border-slate-700' : 'border-slate-200'"
      >
        <h4
          class="text-xs font-semibold mb-3"
          :class="isDark ? 'text-slate-300' : 'text-slate-600'"
        >
          발화 통계
        </h4>
        <div class="space-y-2.5">
          <div
            v-for="stat in speakerStats"
            :key="stat.speaker"
            class="flex items-center gap-3"
          >
            <!-- 화자 이름 -->
            <span
              class="text-xs font-medium w-16 shrink-0 truncate"
              :class="isDark ? 'text-slate-400' : 'text-slate-600'"
            >
              {{ stat.speaker }}
            </span>

            <!-- 바 차트 -->
            <div
              class="flex-1 h-4 rounded-full overflow-hidden"
              :class="isDark ? 'bg-slate-700' : 'bg-slate-100'"
            >
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="barBgClass(stat.color)"
                :style="{ width: stat.percentage + '%' }"
              ></div>
            </div>

            <!-- 퍼센트 -->
            <span
              class="text-xs font-medium w-10 text-right shrink-0"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >
              {{ stat.percentage }}%
            </span>

            <!-- 발화 횟수 -->
            <span
              class="text-[10px] w-8 text-right shrink-0"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
            >
              {{ stat.count }}회
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
