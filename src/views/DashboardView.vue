<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import StatCard from '../components/StatCard.vue'
import MeetingCard from '../components/MeetingCard.vue'
import ActionItemRow from '../components/ActionItemRow.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import EmptyState from '../components/EmptyState.vue'
import AutoAgenda from '../components/AutoAgenda.vue'
import BarChart from '../components/charts/BarChart.vue'
import LineChart from '../components/charts/LineChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import { chartColors } from '../components/charts/chartConfig.js'
import { fetchMeetings, fetchMeetingStats, fetchChartData } from '../services/api.js'
import { meetings as fallbackMeetings, stats as fallbackStats, upcomingMeetings as fallbackUpcoming, recentActionItems as fallbackActions } from '../data/mockData.js'

const { isDark } = useDarkMode()
const loading = ref(true)
const chartData = ref(null)
const stats = ref({ ...fallbackStats })
const allMeetings = ref([...fallbackMeetings])
const actionItems = ref([...fallbackActions])

// 오늘 날짜 (YYYY-MM-DD)
const today = new Date().toISOString().slice(0, 10)

onMounted(async () => {
  // 3초 타임아웃: 백엔드 미응답 시 mock 데이터로 즉시 전환
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const [meetingsRes, statsRes] = await Promise.all([
      fetchMeetings({}, controller.signal),
      fetchMeetingStats(controller.signal),
    ])
    if (meetingsRes.success && Array.isArray(meetingsRes.data) && meetingsRes.data.length > 0) {
      allMeetings.value = meetingsRes.data
      const items = meetingsRes.data.flatMap(m =>
        (m.actionItems || []).map(a => ({ ...a, meetingTitle: m.title, meetingId: m.id }))
      )
      actionItems.value = items.filter(a => !a.done)
    }
    if (statsRes.success && statsRes.data) {
      stats.value = statsRes.data
    }
    // 차트 데이터 로딩
    try {
      const chartRes = await fetchChartData(controller.signal)
      if (chartRes.success && chartRes.data) {
        chartData.value = chartRes.data
      }
    } catch { /* 차트 실패해도 대시보드는 표시 */ }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[대시보드] DB 조회 실패, Mock 데이터 사용:', err.message)
    }
  } finally {
    clearTimeout(timeout)
    loading.value = false
  }
})

// 진행 중인 회의
const liveMeeting = computed(() =>
  allMeetings.value.find(m => m.status === 'in-progress')
)

// 오늘의 회의 (예정 + 진행 중 + 완료)
const todayMeetings = computed(() =>
  allMeetings.value
    .filter(m => m.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
)

// 미완료 액션 아이템
const pendingActions = computed(() =>
  actionItems.value.filter(a => !a.done)
)

// 긴급 액션 아이템 (기한 임박순 정렬, 기한 지난 것 우선)
const urgentActions = computed(() => {
  const now = new Date()
  return [...pendingActions.value]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5)
})

// 기한 임박 (3일 이내 또는 기한 지남)
const imminentCount = computed(() => {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + 3)
  return pendingActions.value.filter(a => new Date(a.dueDate) <= threshold).length
})

// 오늘의 요약 텍스트
const todaySummaryText = computed(() =>
  `오늘 ${todayMeetings.value.length}개 회의 예정 · 미완료 액션아이템 ${pendingActions.value.length}개 · 기한 임박 ${imminentCount.value}개`
)

// 최근 완료된 회의
const recentCompleted = computed(() =>
  allMeetings.value
    .filter(m => m.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
)

// 기한 지남 여부 체크
const isOverdue = (dateStr) => new Date(dateStr) < new Date()

// 기한 임박 여부 체크 (3일 이내)
const isImminent = (dateStr) => {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + 3)
  return new Date(dateStr) <= threshold
}

const toggleItem = (item) => {
  item.done = !item.done
}

// 인사 텍스트
const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침입니다'
  if (hour < 18) return '좋은 오후입니다'
  return '좋은 저녁입니다'
})

// 주간 빈도 Bar chart
const weeklyChartData = computed(() => {
  if (!chartData.value?.weeklyFrequency?.length) return null
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const counts = new Array(7).fill(0)
  for (const r of chartData.value.weeklyFrequency) {
    counts[r.dayOfWeek - 1] += r.count
  }
  return {
    labels: days,
    datasets: [{
      label: '회의 수',
      data: counts,
      backgroundColor: chartColors.primary,
      borderRadius: 6,
      barPercentage: 0.6,
    }],
  }
})

// 시간대 Area chart
const hourlyChartData = computed(() => {
  if (!chartData.value?.hourlyDistribution?.length) return null
  const hours = Array.from({ length: 24 }, (_, i) => `${i}시`)
  const counts = new Array(24).fill(0)
  for (const r of chartData.value.hourlyDistribution) {
    counts[r.hour] = r.count
  }
  return {
    labels: hours,
    datasets: [{
      label: '회의 수',
      data: counts,
      borderColor: chartColors.accent,
      backgroundColor: chartColors.accentLight,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
    }],
  }
})

// 키워드 트렌드 Line chart
const keywordChartData = computed(() => {
  if (!chartData.value?.keywordTrend?.length) return null
  const allDates = [...new Set(
    chartData.value.keywordTrend.flatMap(k => k.data.map(d => d.date))
  )].sort()
  return {
    labels: allDates.map(d => d.slice(5)),
    datasets: chartData.value.keywordTrend.map((kw, i) => ({
      label: kw.keyword,
      data: allDates.map(d => kw.data.find(dd => dd.date === d)?.count || 0),
      borderColor: chartColors.palette[i % chartColors.palette.length],
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  }
})

// 화자 비율 Doughnut chart
const speakerChartData = computed(() => {
  if (!chartData.value?.speakerRatio?.length) return null
  return {
    labels: chartData.value.speakerRatio.map(s => s.speaker),
    datasets: [{
      data: chartData.value.speakerRatio.map(s => s.totalDuration),
      backgroundColor: chartColors.palette.slice(0, chartData.value.speakerRatio.length),
      borderWidth: 0,
    }],
  }
})

const formatDuration = (min) => {
  if (!min) return ''
  if (min >= 60) return `${Math.floor(min / 60)}시간 ${min % 60}분`
  return `${min}분`
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">대시보드</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          {{ new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <router-link
          to="/search"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all"
          :class="isDark ? 'border-zinc-700 text-slate-400 hover:bg-zinc-800 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          검색
        </router-link>
        <router-link
          to="/meetings/new"
          class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl text-sm font-semibold hover:from-primary-600 hover:to-accent-600 transition-all shadow-md shadow-primary-200/40 hover:shadow-lg hover:-translate-y-0.5"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 회의록
        </router-link>
      </div>
    </div>

    <!-- 오늘의 요약 배너 -->
    <div
      class="relative overflow-hidden rounded-2xl p-5 mb-8"
      :class="isDark
        ? 'bg-gradient-to-br from-primary-900/60 via-slate-900 to-accent-900/30 border border-primary-700/20'
        : 'bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600'"
    >
      <!-- 배경 장식 -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -right-8 -top-8 w-36 h-36 rounded-full" :class="isDark ? 'bg-primary-500/10' : 'bg-white/15'"></div>
        <div class="absolute right-20 bottom-0 w-20 h-20 rounded-full" :class="isDark ? 'bg-accent-500/10' : 'bg-white/10'"></div>
        <div class="absolute -left-4 top-4 w-16 h-16 rounded-full" :class="isDark ? 'bg-primary-400/5' : 'bg-white/8'"></div>
      </div>
      <div class="relative">
        <p v-if="!loading" class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-white'">
          {{ greetingText }} 👋
        </p>
        <p v-if="!loading" class="text-sm mt-1 font-medium" :class="isDark ? 'text-primary-300/80' : 'text-white/80'">
          {{ todaySummaryText }}
        </p>
        <div v-if="loading" class="space-y-2">
          <div class="h-5 w-48 rounded-lg bg-white/20 animate-pulse"></div>
          <div class="h-4 w-80 rounded-lg bg-white/15 animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <template v-if="loading">
        <SkeletonLoader type="stat" :count="4" />
      </template>
      <template v-else>
        <StatCard title="전체 회의" :value="stats.totalMeetings" subtitle="이번 달" color="primary" icon="calendar" />
        <StatCard title="총 회의 시간" :value="`${stats.totalHours}h`" subtitle="이번 달" color="accent" icon="clock" />
        <StatCard title="액션 아이템 완료" :value="`${stats.actionItemsCompleted}/${stats.actionItemsTotal}`" :subtitle="`${stats.actionItemsTotal ? Math.round(stats.actionItemsCompleted / stats.actionItemsTotal * 100) : 0}% 달성률`" color="success" icon="check" />
        <StatCard title="회의 분위기" :value="`${stats.avgSentiment}%`" subtitle="긍정 지수" color="warning" icon="smile" />
      </template>
    </div>

    <!-- 차트 그리드 -->
    <div v-if="!loading && chartData" class="grid grid-cols-2 gap-6 mb-8">
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">주간 회의 빈도</h3>
        <BarChart v-if="weeklyChartData" :chart-data="weeklyChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">시간대별 분포</h3>
        <LineChart v-if="hourlyChartData" :chart-data="hourlyChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">키워드 트렌드 (2주)</h3>
        <LineChart v-if="keywordChartData" :chart-data="keywordChartData" :is-dark="isDark" :height="200" :options="{ showLegend: true }" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">화자 비율 (최근 5개 회의)</h3>
        <DoughnutChart v-if="speakerChartData" :chart-data="speakerChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">화자 분리 데이터 없음</p>
      </div>
    </div>

    <!-- 진행 중인 회의 배너 (미사용 기능으로 임시 숨김) -->
    <!--
    <div
      v-if="!loading && liveMeeting"
      class="mb-8 rounded-xl p-4 border"
      :class="isDark ? 'bg-primary-900/20 border-primary-500/30' : 'bg-primary-50 border-primary-200'"
    >
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="w-3 h-3 bg-primary-500 rounded-full"></div>
          <div class="w-3 h-3 bg-primary-500 rounded-full absolute inset-0 animate-ping"></div>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold" :class="isDark ? 'text-primary-300' : 'text-primary-900'">진행 중인 회의</p>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-500/15 text-primary-500">LIVE</span>
          </div>
          <p class="text-xs mt-0.5" :class="isDark ? 'text-primary-400' : 'text-primary-600'">
            {{ liveMeeting.title }}
            <span v-if="liveMeeting.time"> · {{ liveMeeting.time }}부터</span>
            <span v-if="liveMeeting.participants"> · {{ liveMeeting.participants.join(', ') }}</span>
          </p>
        </div>
        <router-link
          :to="`/meetings/${liveMeeting.id}`"
          class="text-xs px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
        >
          실시간 보기
        </router-link>
      </div>
    </div>
    -->

    <!-- 2-Column Layout: 오늘의 일정 + 긴급 액션아이템 -->
    <div class="grid grid-cols-2 gap-6 mb-8">
      <!-- Left: 오늘의 일정 (타임라인) -->
      <div
        class="rounded-2xl border p-5 transition-all duration-200"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">오늘의 일정</h2>
          <router-link to="/meetings" class="text-xs text-primary-500 hover:text-primary-600 font-medium">
            전체 보기 &rarr;
          </router-link>
        </div>

        <template v-if="loading">
          <SkeletonLoader type="list" :count="3" />
        </template>
        <template v-else-if="todayMeetings.length === 0">
          <div class="flex flex-col items-center justify-center py-10">
            <svg class="w-10 h-10 mb-3" :class="isDark ? 'text-slate-600' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">오늘 예정된 회의가 없습니다</p>
          </div>
        </template>
        <template v-else>
          <!-- 타임라인 -->
          <div class="relative">
            <!-- 세로 라인 -->
            <div
              class="absolute left-[19px] top-2 bottom-2 w-0.5"
              :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"
            ></div>

            <div
              v-for="(meeting, idx) in todayMeetings"
              :key="meeting.id"
              class="relative flex gap-4 pb-5 last:pb-0"
            >
              <!-- 타임라인 도트 -->
              <div class="relative z-10 shrink-0 mt-1">
                <div
                  class="w-[10px] h-[10px] rounded-full border-2"
                  :class="meeting.status === 'in-progress'
                    ? 'bg-primary-500 border-primary-500 shadow-sm shadow-primary-500/50'
                    : meeting.status === 'completed'
                      ? (isDark ? 'bg-success-500 border-success-500' : 'bg-success-500 border-success-500')
                      : (isDark ? 'bg-slate-600 border-slate-500' : 'bg-slate-300 border-slate-300')"
                ></div>
              </div>

              <!-- 시간 + 내용 -->
              <router-link
                :to="`/meetings/${meeting.id}`"
                class="flex-1 -mt-0.5 rounded-lg p-3 transition-all group"
                :class="meeting.status === 'in-progress'
                  ? (isDark ? 'bg-primary-900/20 hover:bg-primary-900/30' : 'bg-primary-50 hover:bg-primary-100')
                  : (isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50')"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-mono font-semibold" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
                    {{ meeting.time }}
                  </span>
                  <span
                    v-if="meeting.status === 'in-progress'"
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-primary-500/15 text-primary-500"
                  >
                    LIVE
                  </span>
                  <span
                    v-else-if="meeting.status === 'completed'"
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="isDark ? 'bg-success-500/15 text-success-500' : 'bg-success-50 text-success-600'"
                  >
                    완료
                  </span>
                  <span v-if="meeting.duration" class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
                    {{ formatDuration(meeting.duration) }}
                  </span>
                </div>
                <p
                  class="text-sm font-medium truncate transition-colors"
                  :class="isDark
                    ? 'text-slate-200 group-hover:text-primary-400'
                    : 'text-slate-800 group-hover:text-primary-600'"
                >
                  {{ meeting.title }}
                </p>
                <div v-if="meeting.participants" class="flex items-center gap-1 mt-1.5">
                  <div class="flex -space-x-1">
                    <div
                      v-for="(p, i) in meeting.participants.slice(0, 3)"
                      :key="i"
                      class="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-medium"
                      :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-200 border-white text-slate-600'"
                    >
                      {{ p[0] }}
                    </div>
                  </div>
                  <span class="text-[10px] ml-1" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
                    {{ meeting.participants.length }}명
                  </span>
                </div>
              </router-link>
            </div>
          </div>
        </template>
      </div>

      <!-- Right: 긴급 액션아이템 -->
      <div
        class="rounded-2xl border p-5 transition-all duration-200"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">긴급 액션아이템</h2>
            <span
              v-if="!loading && imminentCount > 0"
              class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-danger-500/15 text-danger-500"
            >
              {{ imminentCount }}
            </span>
          </div>
          <router-link to="/action-items" class="text-xs text-primary-500 hover:text-primary-600 font-medium">
            전체 보기 &rarr;
          </router-link>
        </div>

        <template v-if="loading">
          <SkeletonLoader type="list" :count="4" />
        </template>
        <template v-else-if="urgentActions.length === 0">
          <EmptyState
            type="celebration"
            title="모든 작업을 완료했습니다!"
            description="미완료 액션아이템이 없습니다. 훌륭합니다!"
          />
        </template>
        <template v-else>
          <div class="space-y-1">
            <div
              v-for="(item, i) in urgentActions"
              :key="i"
              class="relative"
            >
              <!-- 기한 지남 / 임박 표시 배지 -->
              <div
                v-if="isOverdue(item.dueDate)"
                class="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full font-bold bg-danger-500/15 text-danger-500"
              >
                기한 초과
              </div>
              <div
                v-else-if="isImminent(item.dueDate)"
                class="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full font-bold bg-warning-500/15 text-warning-600"
              >
                임박
              </div>
              <ActionItemRow
                :item="item"
                show-meeting
                @toggle="toggleItem"
              />
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 자동 아젠다 생성 -->
    <div v-if="!loading" class="mb-8">
      <AutoAgenda :meetings="allMeetings" />
    </div>

    <!-- 최근 완료된 회의 (가로 스크롤 카드 슬라이더) -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">최근 완료된 회의</h2>
        <router-link to="/meetings" class="text-xs text-primary-500 hover:text-primary-600 font-medium">
          전체 보기 &rarr;
        </router-link>
      </div>

      <template v-if="loading">
        <div class="grid grid-cols-3 gap-4">
          <SkeletonLoader type="card" :count="3" />
        </div>
      </template>
      <template v-else-if="recentCompleted.length === 0">
        <EmptyState
          type="meetings"
          title="아직 완료된 회의가 없습니다"
          description="첫 번째 회의를 시작하고 AI가 자동으로 요약해드립니다."
          action-label="첫 회의 시작하기"
          action-to="/meetings/new"
        />
      </template>
      <template v-else>
        <div class="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          <div
            v-for="meeting in recentCompleted"
            :key="meeting.id"
            class="shrink-0 w-[340px]"
          >
            <MeetingCard :meeting="meeting" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 가로 스크롤바 스타일 */
.scrollbar-thin::-webkit-scrollbar {
  height: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.5);
}
</style>
