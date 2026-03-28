<script setup>
import { ref, computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { meetings } from '../data/mockData.js'

const { isDark } = useDarkMode()

// ── 필터 상태 ──
const selectedTag = ref(null)

// ── 모든 태그 추출 ──
const allTags = computed(() => {
  const tagSet = new Set()
  meetings.forEach(m => (m.tags || []).forEach(t => tagSet.add(t)))
  return [...tagSet].sort()
})

// ── 필터된 회의 ──
const filteredMeetings = computed(() => {
  if (!selectedTag.value) return meetings
  return meetings.filter(m => (m.tags || []).includes(selectedTag.value))
})

// ── 통계 ──
const totalMeetings = computed(() => filteredMeetings.value.length)

const totalDecisions = computed(() =>
  filteredMeetings.value.reduce((sum, m) => sum + (m.keyDecisions || []).length, 0)
)

const totalActionItems = computed(() =>
  filteredMeetings.value.reduce((sum, m) => sum + (m.actionItems || []).length, 0)
)

const mostActiveParticipant = computed(() => {
  const counts = {}
  filteredMeetings.value.forEach(m =>
    (m.participants || []).forEach(p => {
      counts[p] = (counts[p] || 0) + 1
    })
  )
  let maxName = '-'
  let maxCount = 0
  for (const [name, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxName = name
    }
  }
  return maxName
})

// ── 태그별 그룹 (회의 간 연결 분석) ──
const projectGroups = computed(() => {
  const groupMap = {}
  filteredMeetings.value.forEach(m => {
    ;(m.tags || []).forEach(tag => {
      if (selectedTag.value && tag !== selectedTag.value) return
      if (!groupMap[tag]) groupMap[tag] = { tag, meetings: [], participantSet: new Set() }
      groupMap[tag].meetings.push(m)
      ;(m.participants || []).forEach(p => groupMap[tag].participantSet.add(p))
    })
  })
  return Object.values(groupMap)
    .filter(g => g.meetings.length > 0)
    .sort((a, b) => b.meetings.length - a.meetings.length)
})

// ── 의사결정 타임라인 (keyDecisions 있는 회의만) ──
const timelineMeetings = computed(() =>
  filteredMeetings.value
    .filter(m => (m.keyDecisions || []).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
)

// ── 감정 표시 색상 ──
const sentimentColor = (sentiment) => {
  if (sentiment === 'positive') return 'bg-emerald-500'
  if (sentiment === 'negative') return 'bg-red-500'
  return 'bg-slate-400'
}

const sentimentLabel = (sentiment) => {
  if (sentiment === 'positive') return '긍정'
  if (sentiment === 'negative') return '부정'
  return '중립'
}

// ── 필터 토글 ──
const toggleTag = (tag) => {
  selectedTag.value = selectedTag.value === tag ? null : tag
}
</script>

<template>
  <div class="p-8">
    <!-- 헤더 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의 분석</h1>
      <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        회의 간 연결 관계와 의사결정 흐름을 분석합니다
      </p>
    </div>

    <!-- 통계 요약 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div
        class="rounded-xl p-5 border"
        :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
      >
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">분석 대상 회의</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ totalMeetings }}건</p>
      </div>
      <div
        class="rounded-xl p-5 border"
        :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
      >
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">총 의사결정</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-emerald-400' : 'text-emerald-600'">{{ totalDecisions }}건</p>
      </div>
      <div
        class="rounded-xl p-5 border"
        :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
      >
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">총 액션아이템</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-blue-400' : 'text-blue-600'">{{ totalActionItems }}건</p>
      </div>
      <div
        class="rounded-xl p-5 border"
        :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
      >
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">최다 참여자</p>
        <p class="text-2xl font-bold" :class="isDark ? 'text-amber-400' : 'text-amber-600'">{{ mostActiveParticipant }}</p>
      </div>
    </div>

    <!-- 태그 필터 -->
    <div class="flex flex-wrap gap-2 mb-8">
      <button
        v-for="tag in allTags"
        :key="tag"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
        :class="selectedTag === tag
          ? (isDark ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white')
          : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </button>
      <button
        v-if="selectedTag"
        class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer"
        :class="isDark ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' : 'bg-red-50 text-red-500 hover:bg-red-100'"
        @click="selectedTag = null"
      >
        필터 초기화
      </button>
    </div>

    <!-- 회의 간 연결 분석 -->
    <section class="mb-10">
      <h2 class="text-lg font-bold mb-4" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
        회의 간 연결 분석
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="group in projectGroups"
          :key="group.tag"
          class="rounded-xl border p-5 transition-shadow hover:shadow-md"
          :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
        >
          <!-- 그룹 헤더 -->
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
              {{ group.tag }}
            </h3>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold"
              :class="isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-600'"
            >
              {{ group.meetings.length }}건
            </span>
          </div>

          <!-- 관련 회의 목록 -->
          <ul class="space-y-2 mb-3">
            <li
              v-for="m in group.meetings"
              :key="m.id"
              class="flex items-start gap-2 text-sm"
            >
              <span class="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full" :class="isDark ? 'bg-slate-500' : 'bg-slate-300'"></span>
              <div>
                <router-link
                  :to="`/meetings/${m.id}`"
                  class="font-medium hover:underline"
                  :class="isDark ? 'text-slate-200' : 'text-slate-800'"
                >
                  {{ m.title }}
                </router-link>
                <span class="ml-2 text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ m.date }}</span>
              </div>
            </li>
          </ul>

          <!-- 공통 참여자 -->
          <div class="pt-3 border-t" :class="isDark ? 'border-slate-700' : 'border-slate-100'">
            <p class="text-xs font-medium mb-1.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">공통 참여자</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="p in [...group.participantSet]"
                :key="p"
                class="px-2 py-0.5 rounded-md text-xs"
                :class="isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'"
              >
                {{ p }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="projectGroups.length === 0"
        class="text-center py-12 text-sm"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        선택한 필터에 해당하는 회의 그룹이 없습니다.
      </div>
    </section>

    <!-- 의사결정 타임라인 -->
    <section>
      <h2 class="text-lg font-bold mb-4" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
        의사결정 타임라인
      </h2>

      <div
        v-if="timelineMeetings.length === 0"
        class="text-center py-12 text-sm"
        :class="isDark ? 'text-slate-500' : 'text-slate-400'"
      >
        선택한 필터에 해당하는 의사결정이 없습니다.
      </div>

      <div v-else class="relative">
        <!-- 세로 타임라인 선 -->
        <div
          class="absolute left-[7.5rem] top-0 bottom-0 w-0.5"
          :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"
        ></div>

        <div class="space-y-6">
          <div
            v-for="(m, idx) in timelineMeetings"
            :key="m.id"
            class="relative flex gap-6"
          >
            <!-- 날짜 (좌측) -->
            <div class="w-24 shrink-0 text-right pt-1">
              <p class="text-sm font-semibold" :class="isDark ? 'text-slate-300' : 'text-slate-700'">
                {{ m.date }}
              </p>
            </div>

            <!-- 타임라인 노드 -->
            <div class="relative shrink-0 flex items-start justify-center w-7 pt-1.5">
              <div
                class="w-3.5 h-3.5 rounded-full border-2 z-10"
                :class="[
                  sentimentColor(m.sentiment),
                  isDark ? 'border-slate-800' : 'border-white'
                ]"
                :title="sentimentLabel(m.sentiment)"
              ></div>
            </div>

            <!-- 카드 콘텐츠 -->
            <div
              class="flex-1 rounded-xl border p-4 transition-shadow hover:shadow-md"
              :class="isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'"
            >
              <div class="flex items-center gap-2 mb-2">
                <router-link
                  :to="`/meetings/${m.id}`"
                  class="text-sm font-bold hover:underline"
                  :class="isDark ? 'text-slate-100' : 'text-slate-900'"
                >
                  {{ m.title }}
                </router-link>
                <span
                  class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                  :class="m.sentiment === 'positive'
                    ? (isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                    : m.sentiment === 'negative'
                      ? (isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-50 text-red-600')
                      : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="sentimentColor(m.sentiment)"></span>
                  {{ sentimentLabel(m.sentiment) }}
                </span>
              </div>
              <ul class="space-y-1">
                <li
                  v-for="(decision, dIdx) in m.keyDecisions"
                  :key="dIdx"
                  class="flex items-start gap-2 text-sm"
                >
                  <span class="shrink-0 mt-1.5 w-1 h-1 rounded-full" :class="isDark ? 'bg-slate-500' : 'bg-slate-300'"></span>
                  <span :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ decision }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
