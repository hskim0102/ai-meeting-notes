<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { fetchMeetings, fetchMeetingStats } from '../services/api.js'
import { meetings as fallbackMeetings, stats as fallbackStats } from '../data/mockData.js'

const { isDark } = useDarkMode()

const meetings = ref([...fallbackMeetings])
const statsData = ref({ ...fallbackStats })

// DB 데이터 로드
onMounted(async () => {
  try {
    const [meetingsRes, statsRes] = await Promise.all([
      fetchMeetings(),
      fetchMeetingStats(),
    ])
    if (meetingsRes.success && Array.isArray(meetingsRes.data)) {
      meetings.value = meetingsRes.data
    }
    if (statsRes.success && statsRes.data) {
      statsData.value = statsRes.data
    }
  } catch (err) {
    console.warn('[리포트] DB 조회 실패, Mock 데이터 사용:', err.message)
  }
})

// 기간 선택
const selectedPeriod = ref('all')
const periods = [
  { key: 'week', label: '이번 주' },
  { key: 'month', label: '이번 달' },
  { key: 'all', label: '전체' },
]

// PDF 내보내기
const exportPDF = () => {
  window.print()
}

// ── 요약 카드 데이터 ──
const totalMeetings = computed(() => statsData.value.totalMeetings)
const totalHours = computed(() => statsData.value.totalHours)
const completionRate = computed(() => {
  const total = statsData.value.actionItemsTotal
  if (!total) return 0
  return Math.round((statsData.value.actionItemsCompleted / total) * 100)
})
const avgSentiment = computed(() => statsData.value.avgSentiment)

// ── 주간 회의 트렌드 (Mock) ──
const weeklyData = [
  { day: '월', count: 2 },
  { day: '화', count: 3 },
  { day: '수', count: 4 },
  { day: '목', count: 2 },
  { day: '금', count: 1 },
]
const maxWeekly = Math.max(...weeklyData.map(d => d.count))

// ── 액션아이템 완료 도넛 차트 ──
const donutCompleted = computed(() => statsData.value.actionItemsCompleted)
const donutTotal = computed(() => statsData.value.actionItemsTotal)
const donutPercent = computed(() => completionRate.value)
// SVG 원형 차트 계산 (둘레 = 2 * PI * r, r=70)
const circumference = 2 * Math.PI * 70
const completedStroke = computed(() => (donutPercent.value / 100) * circumference)
const pendingStroke = computed(() => circumference - completedStroke.value)

// ── 감정 분포 ──
const sentimentCounts = computed(() => {
  const counts = { positive: 0, neutral: 0, negative: 0 }
  meetings.value.forEach(m => {
    if (m.sentiment && counts[m.sentiment] !== undefined) {
      counts[m.sentiment]++
    }
  })
  return counts
})
const sentimentTotal = computed(() =>
  sentimentCounts.value.positive + sentimentCounts.value.neutral + sentimentCounts.value.negative
)
const sentimentPercent = (key) => {
  if (sentimentTotal.value === 0) return 0
  return Math.round((sentimentCounts.value[key] / sentimentTotal.value) * 100)
}

// ── 참가자 활동 테이블 ──
const participantActivity = computed(() => {
  const map = {}
  meetings.value.forEach(m => {
    (m.participants || []).forEach(p => {
      if (!map[p]) map[p] = { name: p, meetingCount: 0, actionCount: 0 }
      map[p].meetingCount++
    })
    ;(m.actionItems || []).forEach(a => {
      if (!map[a.assignee]) map[a.assignee] = { name: a.assignee, meetingCount: 0, actionCount: 0 }
      map[a.assignee].actionCount++
    })
  })
  return Object.values(map).sort((a, b) => b.meetingCount - a.meetingCount)
})

// ── 회의 효율성 ──
const completedMeetings = computed(() =>
  meetings.value.filter(m => m.status === 'completed' && m.duration > 0)
)
const efficiencyScore = (meeting) => {
  const decisions = (meeting.keyDecisions || []).length
  const duration = meeting.duration || 1
  return (decisions / duration * 60).toFixed(1) // 시간당 결정 수
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">리포트</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">회의 활동 분석 및 보고서</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- 기간 선택 -->
        <div class="flex rounded-lg overflow-hidden border"
          :class="isDark ? 'border-slate-700' : 'border-slate-200'"
        >
          <button
            v-for="p in periods"
            :key="p.key"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="selectedPeriod === p.key
              ? 'bg-primary-500 text-white'
              : isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-white text-slate-600 hover:bg-slate-50'"
            @click="selectedPeriod = p.key"
          >
            {{ p.label }}
          </button>
        </div>
        <!-- PDF 내보내기 -->
        <button
          class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          :class="isDark
            ? 'bg-primary-600 text-white hover:bg-primary-500'
            : 'bg-primary-500 text-white hover:bg-primary-600'"
          @click="exportPDF"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          PDF 내보내기
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <!-- 총 회의 수 -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-primary-500/15' : 'bg-primary-50'"
          >
            <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <p class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">총 회의 수</p>
            <p class="text-xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ totalMeetings }}회</p>
          </div>
        </div>
      </div>

      <!-- 총 회의 시간 -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-accent-500/15' : 'bg-accent-50'"
          >
            <svg class="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">총 회의 시간</p>
            <p class="text-xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ totalHours }}시간</p>
          </div>
        </div>
      </div>

      <!-- 액션아이템 완료율 -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-success-500/15' : 'bg-success-50'"
          >
            <svg class="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">액션아이템 완료율</p>
            <p class="text-xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ completionRate }}%</p>
          </div>
        </div>
      </div>

      <!-- 평균 감정 점수 -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-warning-500/15' : 'bg-warning-50'"
          >
            <svg class="w-5 h-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </div>
          <div>
            <p class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">평균 감정 점수</p>
            <p class="text-xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ avgSentiment }}점</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row: 주간 트렌드 + 완료율 도넛 -->
    <div class="grid grid-cols-2 gap-6 mb-8">
      <!-- 주간 회의 트렌드 (SVG Bar Chart) -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <h2 class="text-base font-semibold mb-5" :class="isDark ? 'text-slate-100' : 'text-slate-900'">주간 회의 트렌드</h2>
        <svg viewBox="0 0 300 180" class="w-full">
          <!-- Y축 가이드라인 -->
          <line
            v-for="i in 5"
            :key="'yline-' + i"
            x1="40" :y1="20 + (i - 1) * 35" x2="290" :y2="20 + (i - 1) * 35"
            :stroke="isDark ? '#334155' : '#e2e8f0'" stroke-width="1"
          />
          <!-- Y축 라벨 -->
          <text
            v-for="i in 5"
            :key="'ylabel-' + i"
            x="30" :y="24 + (i - 1) * 35"
            text-anchor="end"
            :fill="isDark ? '#94a3b8' : '#64748b'"
            font-size="11"
          >
            {{ 5 - i + 1 }}
          </text>
          <!-- 바 -->
          <rect
            v-for="(d, idx) in weeklyData"
            :key="'bar-' + idx"
            :x="55 + idx * 50"
            :y="160 - (d.count / maxWeekly) * 140"
            width="30"
            :height="(d.count / maxWeekly) * 140"
            rx="4"
            fill="#3b82f6"
            opacity="0.85"
          />
          <!-- X축 라벨 -->
          <text
            v-for="(d, idx) in weeklyData"
            :key="'xlabel-' + idx"
            :x="70 + idx * 50"
            y="176"
            text-anchor="middle"
            :fill="isDark ? '#94a3b8' : '#64748b'"
            font-size="12"
          >
            {{ d.day }}
          </text>
          <!-- 바 위 숫자 -->
          <text
            v-for="(d, idx) in weeklyData"
            :key="'val-' + idx"
            :x="70 + idx * 50"
            :y="155 - (d.count / maxWeekly) * 140"
            text-anchor="middle"
            :fill="isDark ? '#e2e8f0' : '#1e293b'"
            font-size="11"
            font-weight="600"
          >
            {{ d.count }}
          </text>
        </svg>
      </div>

      <!-- 액션아이템 완료율 (SVG Donut Chart) -->
      <div class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <h2 class="text-base font-semibold mb-5" :class="isDark ? 'text-slate-100' : 'text-slate-900'">액션아이템 완료율</h2>
        <div class="flex items-center justify-center">
          <svg viewBox="0 0 200 200" class="w-48 h-48">
            <!-- 배경 링 -->
            <circle
              cx="100" cy="100" r="70"
              fill="none"
              :stroke="isDark ? '#334155' : '#cbd5e1'"
              stroke-width="20"
            />
            <!-- 완료 링 -->
            <circle
              cx="100" cy="100" r="70"
              fill="none"
              stroke="#22c55e"
              stroke-width="20"
              :stroke-dasharray="`${completedStroke} ${pendingStroke}`"
              stroke-dashoffset="0"
              stroke-linecap="round"
              transform="rotate(-90 100 100)"
            />
            <!-- 중앙 텍스트 -->
            <text
              x="100" y="95"
              text-anchor="middle"
              :fill="isDark ? '#f1f5f9' : '#0f172a'"
              font-size="32"
              font-weight="700"
            >
              {{ donutPercent }}%
            </text>
            <text
              x="100" y="118"
              text-anchor="middle"
              :fill="isDark ? '#94a3b8' : '#64748b'"
              font-size="12"
            >
              {{ donutCompleted }}/{{ donutTotal }} 완료
            </text>
          </svg>
        </div>
      </div>
    </div>

    <!-- 감정 분포 (Horizontal Bar Chart) -->
    <div class="rounded-xl border p-5 mb-8"
      :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
    >
      <h2 class="text-base font-semibold mb-5" :class="isDark ? 'text-slate-100' : 'text-slate-900'">감정 분포</h2>
      <div class="space-y-4">
        <!-- 긍정적 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-700'">긍정적</span>
            <span class="text-xs font-semibold" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              {{ sentimentCounts.positive }}건 ({{ sentimentPercent('positive') }}%)
            </span>
          </div>
          <div class="w-full h-3 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
            <div
              class="h-full rounded-full bg-success-500 transition-all duration-500"
              :style="{ width: sentimentPercent('positive') + '%' }"
            ></div>
          </div>
        </div>
        <!-- 중립 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-700'">중립</span>
            <span class="text-xs font-semibold" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              {{ sentimentCounts.neutral }}건 ({{ sentimentPercent('neutral') }}%)
            </span>
          </div>
          <div class="w-full h-3 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
            <div
              class="h-full rounded-full bg-slate-400 transition-all duration-500"
              :style="{ width: sentimentPercent('neutral') + '%' }"
            ></div>
          </div>
        </div>
        <!-- 부정적 -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-700'">부정적</span>
            <span class="text-xs font-semibold" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              {{ sentimentCounts.negative }}건 ({{ sentimentPercent('negative') }}%)
            </span>
          </div>
          <div class="w-full h-3 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">
            <div
              class="h-full rounded-full bg-danger-500 transition-all duration-500"
              :style="{ width: sentimentPercent('negative') + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 참가자 활동 테이블 -->
    <div class="rounded-xl border overflow-hidden mb-8"
      :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
    >
      <div class="p-5 pb-3">
        <h2 class="text-base font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">참가자 활동</h2>
      </div>
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'border-slate-700' : 'border-slate-200'" class="border-b">
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >이름</th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >참여 회의 수</th>
            <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >담당 액션아이템</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(p, idx) in participantActivity"
            :key="p.name"
            class="border-b last:border-b-0 transition-colors"
            :class="[
              isDark ? 'border-slate-700' : 'border-slate-100',
              idx % 2 === 0
                ? (isDark ? 'bg-slate-800' : 'bg-white')
                : (isDark ? 'bg-slate-800/60' : 'bg-slate-50')
            ]"
          >
            <td class="px-5 py-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  :class="isDark ? 'bg-primary-500/15 text-primary-400' : 'bg-primary-50 text-primary-600'"
                >
                  {{ p.name[0] }}
                </div>
                <span class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">{{ p.name }}</span>
              </div>
            </td>
            <td class="px-5 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ p.meetingCount }}회</td>
            <td class="px-5 py-3 text-sm" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ p.actionCount }}건</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 회의 효율성 -->
    <div class="rounded-xl border p-5"
      :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
    >
      <h2 class="text-base font-semibold mb-5" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의 효율성</h2>
      <div class="space-y-3">
        <div
          v-for="m in completedMeetings"
          :key="m.id"
          class="flex items-center justify-between rounded-lg p-4 transition-colors"
          :class="isDark ? 'bg-slate-700/40 hover:bg-slate-700/60' : 'bg-slate-50 hover:bg-slate-100'"
        >
          <div class="flex-1 min-w-0 mr-4">
            <p class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-200' : 'text-slate-800'">{{ m.title }}</p>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
                {{ m.duration }}분
              </span>
              <span class="text-xs" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
                결정사항 {{ (m.keyDecisions || []).length }}건
              </span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">효율성 스코어</p>
            <p class="text-lg font-bold"
              :class="parseFloat(efficiencyScore(m)) >= 3
                ? 'text-success-500'
                : parseFloat(efficiencyScore(m)) >= 1.5
                  ? 'text-warning-500'
                  : (isDark ? 'text-slate-300' : 'text-slate-600')"
            >
              {{ efficiencyScore(m) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
