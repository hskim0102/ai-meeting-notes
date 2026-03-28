<script setup>
import { computed, ref } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

const props = defineProps({
  meetings: { type: Array, default: () => [] },
})

// 복사 완료 상태
const copied = ref(false)

// 아젠다 항목 생성 로직
const agendaItems = computed(() => {
  const items = []

  // 1. 미완료 액션 아이템 수집
  for (const meeting of props.meetings) {
    if (!meeting.actionItems) continue
    for (const action of meeting.actionItems) {
      if (!action.done) {
        items.push({
          type: '미완료 액션',
          description: action.text,
          source: meeting.title,
        })
      }
    }
  }

  // 2. 반복 주제 (2회 이상 등장하는 태그)
  const tagCount = {}
  const tagSource = {}
  for (const meeting of props.meetings) {
    if (!meeting.tags) continue
    for (const tag of meeting.tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
      if (!tagSource[tag]) tagSource[tag] = meeting.title
    }
  }
  for (const [tag, count] of Object.entries(tagCount)) {
    if (count >= 2) {
      items.push({
        type: '반복 주제',
        description: `${tag} 관련 진행상황 공유`,
        source: tagSource[tag],
      })
    }
  }

  // 3. 후속 논의 (부정적 감정의 회의)
  for (const meeting of props.meetings) {
    if (meeting.sentiment === 'negative') {
      items.push({
        type: '후속 논의',
        description: `${meeting.title} 후속 논의`,
        source: meeting.title,
      })
    }
  }

  return items
})

// 타입별 뱃지 색상
const badgeClass = (type) => {
  if (type === '미완료 액션') {
    return isDark.value
      ? 'bg-warning-500/15 text-warning-400'
      : 'bg-warning-50 text-warning-600'
  }
  if (type === '반복 주제') {
    return isDark.value
      ? 'bg-primary-500/15 text-primary-400'
      : 'bg-primary-50 text-primary-600'
  }
  // 후속 논의
  return isDark.value
    ? 'bg-slate-700 text-slate-400'
    : 'bg-slate-100 text-slate-600'
}

// 아젠다 텍스트 클립보드 복사
const copyAgenda = async () => {
  const text = agendaItems.value
    .map((item, i) => `${i + 1}. [${item.type}] ${item.description} (출처: ${item.source})`)
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // 클립보드 접근 실패 시 무시
  }
}

// 새로고침 (반응형이므로 실질적으로 UI 피드백용)
const refreshing = ref(false)
const refresh = () => {
  refreshing.value = true
  setTimeout(() => { refreshing.value = false }, 600)
}
</script>

<template>
  <div
    class="rounded-xl border p-5 transition-all"
    :class="isDark
      ? 'bg-slate-800 border-slate-700'
      : 'bg-white border-slate-200'"
  >
    <!-- 헤더 -->
    <div class="flex items-center justify-between mb-4">
      <h3
        class="text-sm font-semibold"
        :class="isDark ? 'text-slate-100' : 'text-slate-900'"
      >
        다음 회의 아젠다 (자동 생성)
      </h3>
      <button
        @click="refresh"
        class="p-1.5 rounded-lg transition-colors"
        :class="isDark
          ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
          : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'"
      >
        <svg
          class="w-4 h-4 transition-transform"
          :class="{ 'animate-spin': refreshing }"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
      </button>
    </div>

    <!-- 빈 상태 -->
    <div
      v-if="agendaItems.length === 0"
      class="py-8 text-center"
    >
      <svg
        class="w-10 h-10 mx-auto mb-3"
        :class="isDark ? 'text-slate-600' : 'text-slate-300'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
      <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        아젠다를 생성할 회의 데이터가 없습니다
      </p>
    </div>

    <!-- 아젠다 항목 리스트 -->
    <TransitionGroup
      v-else
      name="agenda"
      tag="ul"
      class="space-y-2 mb-4"
    >
      <li
        v-for="(item, idx) in agendaItems"
        :key="`${item.type}-${idx}`"
        class="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
        :class="isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'"
      >
        <!-- 드래그 핸들 (시각적 전용) -->
        <div
          class="mt-0.5 shrink-0 cursor-grab"
          :class="isDark ? 'text-slate-600' : 'text-slate-300'"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
        </div>

        <!-- 콘텐츠 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              :class="badgeClass(item.type)"
            >
              {{ item.type }}
            </span>
          </div>
          <p
            class="text-sm"
            :class="isDark ? 'text-slate-200' : 'text-slate-700'"
          >
            {{ item.description }}
          </p>
          <p
            class="text-xs mt-0.5"
            :class="isDark ? 'text-slate-500' : 'text-slate-400'"
          >
            {{ item.source }}
          </p>
        </div>
      </li>
    </TransitionGroup>

    <!-- 아젠다 복사 버튼 -->
    <button
      v-if="agendaItems.length > 0"
      @click="copyAgenda"
      class="w-full py-2 px-4 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
      :class="copied
        ? 'bg-success-500 text-white'
        : (isDark
          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')"
    >
      <svg v-if="!copied" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
      </svg>
      <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {{ copied ? '복사 완료!' : '아젠다 복사' }}
    </button>
  </div>
</template>

<style scoped>
.agenda-enter-active {
  transition: all 0.3s ease-out;
}
.agenda-leave-active {
  transition: all 0.2s ease-in;
}
.agenda-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.agenda-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
