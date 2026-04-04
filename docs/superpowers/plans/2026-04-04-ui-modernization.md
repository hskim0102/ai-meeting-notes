# UI/UX 모던화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 중심 데이터 시각화 + 모션/인터랙션 강화를 통한 전반적 디자인 시스템 레벨 개선

**Architecture:** 점진적 리팩토링 방식으로 디자인 토큰 정비 → 차트/모션 라이브러리 추가 → 페이지별 업그레이드. Chart.js로 데이터 시각화, @vueuse/motion으로 모션 시스템 구축.

**Tech Stack:** Chart.js 4.x, vue-chartjs 5.x, @vueuse/motion 2.x, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-04-ui-modernization-design.md`

---

## File Structure

### New Files

```
src/
├── components/
│   └── charts/
│       ├── BarChart.vue           # Bar chart Vue 래퍼
│       ├── LineChart.vue          # Line/Area chart Vue 래퍼
│       ├── DoughnutChart.vue      # Doughnut chart Vue 래퍼
│       └── chartConfig.js         # Chart.js 공통 설정 (색상, 다크모드, 툴팁)
```

### Modified Files

```
src/style.css                      # 디자인 토큰 업데이트, 모션 유틸리티
src/App.vue                        # 라우터 전환 애니메이션 개선
src/views/DashboardView.vue        # 차트 그리드, 인사 배너, 통계 개선
src/views/MeetingsListView.vue     # 뷰 토글, 필터, 검색 개선
src/views/MeetingDetailView.vue    # 탭 애니메이션, 챗봇 슬라이드 패널
src/views/ActionItemsView.vue      # 완료 애니메이션, 마감일 강조
src/views/NewMeetingView.vue       # 스텝 위저드 아이콘화
src/components/StatCard.vue        # 증감 표시, 카운트업, 그라데이션 아이콘
src/components/MeetingCard.vue     # hover 애니메이션, 새 토큰 적용
src/components/ActionItemRow.vue   # 완료 애니메이션, 마감일 glow
src/components/SpeakerTimeline.vue # 화자 발화 비율 mini chart
src/components/MeetingChatbot.vue  # 슬라이드 패널 형태로 변경
server/routes/meetings.js          # GET /api/meetings/chart-data 추가
package.json                       # chart.js, vue-chartjs, @vueuse/motion 추가
```

---

## Task 1: 디자인 토큰 & 스타일 시스템 업데이트

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: @theme 블록 업데이트**

`src/style.css`에서 기존 `@theme` 블록을 아래로 교체. zinc 색상 팔레트를 추가하고, 기존 slate를 유지한다.

```css
@import "tailwindcss";

@theme {
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  --color-accent-50: #f5f3ff;
  --color-accent-100: #ede9fe;
  --color-accent-200: #ddd6fe;
  --color-accent-400: #a78bfa;
  --color-accent-500: #8b5cf6;
  --color-accent-600: #7c3aed;

  --color-success-50: #f0fdf4;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;

  --color-warning-50: #fffbeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;

  --color-danger-50: #fef2f2;
  --color-danger-500: #ef4444;

  --color-slate-50: #f8fafc;
  --color-slate-100: #f1f5f9;
  --color-slate-200: #e2e8f0;
  --color-slate-300: #cbd5e1;
  --color-slate-400: #94a3b8;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1e293b;
  --color-slate-900: #0f172a;

  --color-zinc-800: #27272a;
  --color-zinc-900: #18181b;
  --color-zinc-950: #09090b;
}
```

- [ ] **Step 2: body 및 다크모드 배경 업데이트**

기존 body와 다크모드 스타일을 교체:

```css
body {
  margin: 0;
  font-family: 'Pretendard', system-ui, -apple-system, sans-serif;
  background-color: #fafaf9;
}

.dark body,
body.dark {
  background-color: var(--color-zinc-950);
}
```

- [ ] **Step 3: 페이지 전환 애니메이션 개선**

기존 `.page-*` 클래스를 교체:

```css
/* 페이지 전환 애니메이션 - 방향성 슬라이드 */
.page-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.page-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}
.page-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.page-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-15px);
}
```

- [ ] **Step 4: 모션 유틸리티 및 접근성 추가**

파일 맨 끝(기존 sidebar 전환 클래스 뒤)에 추가:

```css
/* prefers-reduced-motion 접근성 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 카운트업 숫자 정렬 */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* 리스트 stagger 애니메이션 */
.list-enter-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}
.list-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.list-move {
  transition: transform 0.3s ease;
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/style.css
git commit -m "style: 디자인 토큰 업데이트 (zinc 팔레트, 모션 유틸리티, 접근성)"
```

---

## Task 2: 라이브러리 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Chart.js + vue-chartjs + @vueuse/motion 설치**

```bash
npm install chart.js vue-chartjs @vueuse/motion --legacy-peer-deps
```

- [ ] **Step 2: 설치 확인**

```bash
node -e "import('chart.js').then(() => console.log('chart.js OK')); import('vue-chartjs').then(() => console.log('vue-chartjs OK')); import('@vueuse/motion').then(() => console.log('@vueuse/motion OK'))"
```

Expected: 3개 모듈 모두 OK

- [ ] **Step 3: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: chart.js, vue-chartjs, @vueuse/motion 설치"
```

---

## Task 3: 차트 공통 설정 및 래퍼 컴포넌트

**Files:**
- Create: `src/components/charts/chartConfig.js`
- Create: `src/components/charts/BarChart.vue`
- Create: `src/components/charts/LineChart.vue`
- Create: `src/components/charts/DoughnutChart.vue`

- [ ] **Step 1: chartConfig.js 생성**

```
src/components/charts/chartConfig.js
```

```javascript
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

/** 다크모드 여부에 따른 Chart.js 공통 옵션 */
export function getChartOptions(isDark, overrides = {}) {
  const textColor = isDark ? '#a1a1aa' : '#64748b'
  const gridColor = isDark ? '#27272a' : '#e2e8f0'

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 750, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        display: overrides.showLegend ?? false,
        position: 'bottom',
        labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: {
        backgroundColor: isDark ? '#27272a' : '#ffffff',
        titleColor: isDark ? '#fafafa' : '#0f172a',
        bodyColor: isDark ? '#a1a1aa' : '#475569',
        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
      ...overrides.scales,
    },
    ...overrides,
  }
}

/** 그라데이션 색상 팔레트 */
export const chartColors = {
  primary: 'rgb(59, 130, 246)',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  accent: 'rgb(139, 92, 246)',
  accentLight: 'rgba(139, 92, 246, 0.15)',
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(245, 158, 11)',
  danger: 'rgb(239, 68, 68)',
  palette: [
    'rgb(59, 130, 246)',
    'rgb(139, 92, 246)',
    'rgb(34, 197, 94)',
    'rgb(245, 158, 11)',
    'rgb(239, 68, 68)',
    'rgb(6, 182, 212)',
  ],
}

/** ctx에서 그라데이션 생성 헬퍼 */
export function createGradient(ctx, colorTop, colorBottom) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight)
  gradient.addColorStop(0, colorTop)
  gradient.addColorStop(1, colorBottom)
  return gradient
}
```

- [ ] **Step 2: BarChart.vue 생성**

```
src/components/charts/BarChart.vue
```

```vue
<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => getChartOptions(props.isDark, {
  ...props.options,
  scales: { ...props.options.scales, y: { ...props.options.scales?.y, beginAtZero: true } },
}))
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Bar :data="chartData" :options="mergedOptions" />
  </div>
</template>
```

- [ ] **Step 3: LineChart.vue 생성**

```
src/components/charts/LineChart.vue
```

```vue
<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => getChartOptions(props.isDark, props.options))
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Line :data="chartData" :options="mergedOptions" />
  </div>
</template>
```

- [ ] **Step 4: DoughnutChart.vue 생성**

```
src/components/charts/DoughnutChart.vue
```

```vue
<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { getChartOptions } from './chartConfig.js'

const props = defineProps({
  chartData: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 250 },
})

const mergedOptions = computed(() => {
  const base = getChartOptions(props.isDark, { showLegend: true, ...props.options })
  delete base.scales
  return base
})
</script>

<template>
  <div :style="{ height: height + 'px' }">
    <Doughnut :data="chartData" :options="mergedOptions" />
  </div>
</template>
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/charts/
git commit -m "feat: Chart.js 래퍼 컴포넌트 및 공통 설정 추가"
```

---

## Task 4: 차트 데이터 API 엔드포인트

**Files:**
- Modify: `server/routes/meetings.js`
- Create: `tests/unit/chartData.test.js`

- [ ] **Step 1: 테스트 작성**

```
tests/unit/chartData.test.js
```

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.js'

describe('GET /api/meetings/chart-data', () => {
  it('차트 데이터 구조를 반환한다', async () => {
    const res = await request(app).get('/api/meetings/chart-data')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('weeklyFrequency')
    expect(res.body.data).toHaveProperty('hourlyDistribution')
    expect(res.body.data).toHaveProperty('keywordTrend')
    expect(res.body.data).toHaveProperty('speakerRatio')
    expect(Array.isArray(res.body.data.weeklyFrequency)).toBe(true)
    expect(Array.isArray(res.body.data.hourlyDistribution)).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run tests/unit/chartData.test.js
```

Expected: FAIL (404 - 라우트 없음)

- [ ] **Step 3: chart-data 엔드포인트 구현**

`server/routes/meetings.js`에서 `router.get('/stats', ...)` 블록 바로 아래에 추가 (`:id` 라우트보다 위에 배치해야 함):

```javascript
// ── 차트 데이터 조회 (대시보드 차트용) ──
router.get('/chart-data', async (req, res) => {
  try {
    // 1. 주간 회의 빈도 (최근 4주, 요일별)
    const weeklyRows = await query(`
      SELECT
        YEARWEEK(date, 1) as yw,
        DAYOFWEEK(date) as dow,
        COUNT(*) as cnt
      FROM meetings
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
      GROUP BY yw, dow
      ORDER BY yw, dow
    `)
    const weeklyFrequency = weeklyRows.map(r => ({
      yearWeek: r.yw,
      dayOfWeek: r.dow,
      count: r.cnt,
    }))

    // 2. 시간대별 분포
    const hourlyRows = await query(`
      SELECT
        CAST(SUBSTRING(time, 1, 2) AS UNSIGNED) as hour,
        COUNT(*) as cnt
      FROM meetings
      WHERE time IS NOT NULL AND time != ''
      GROUP BY hour
      ORDER BY hour
    `)
    const hourlyDistribution = hourlyRows.map(r => ({
      hour: r.hour,
      count: r.cnt,
    }))

    // 3. 키워드 트렌드 (최근 2주, 상위 키워드)
    const keywordRows = await query(`
      SELECT date, tags FROM meetings
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
      AND tags IS NOT NULL
      ORDER BY date
    `)
    const keywordMap = {}
    for (const row of keywordRows) {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || [])
      const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date
      for (const tag of tags) {
        if (!keywordMap[tag]) keywordMap[tag] = {}
        keywordMap[tag][dateStr] = (keywordMap[tag][dateStr] || 0) + 1
      }
    }
    // 상위 5개 키워드만
    const topKeywords = Object.entries(keywordMap)
      .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
      .slice(0, 5)
    const keywordTrend = topKeywords.map(([keyword, dates]) => ({
      keyword,
      data: Object.entries(dates).map(([date, count]) => ({ date, count })),
    }))

    // 4. 화자 비율 (최근 5개 회의)
    const speakerRows = await query(`
      SELECT transcript FROM meetings
      WHERE transcript IS NOT NULL AND transcript != '[]'
      ORDER BY date DESC, time DESC
      LIMIT 5
    `)
    const speakerDuration = {}
    for (const row of speakerRows) {
      const segments = typeof row.transcript === 'string' ? JSON.parse(row.transcript) : (row.transcript || [])
      for (const seg of segments) {
        if (seg.speaker) {
          const dur = (seg.end || 0) - (seg.start || 0)
          speakerDuration[seg.speaker] = (speakerDuration[seg.speaker] || 0) + dur
        }
      }
    }
    const speakerRatio = Object.entries(speakerDuration).map(([speaker, duration]) => ({
      speaker,
      totalDuration: Math.round(duration * 10) / 10,
    }))

    res.json({
      success: true,
      data: { weeklyFrequency, hourlyDistribution, keywordTrend, speakerRatio },
    })
  } catch (err) {
    console.error('[차트 데이터 에러]', err.message)
    res.status(500).json({ success: false, error: '차트 데이터 조회 실패' })
  }
})
```

- [ ] **Step 4: 테스트 실행 (통과)**

```bash
npx vitest run tests/unit/chartData.test.js
```

Expected: PASS

- [ ] **Step 5: API 클라이언트에 fetchChartData 추가**

`src/services/api.js` 파일에 함수 추가:

```javascript
export async function fetchChartData(signal) {
  const res = await fetch('/api/meetings/chart-data', { signal })
  return res.json()
}
```

- [ ] **Step 6: 커밋**

```bash
git add server/routes/meetings.js src/services/api.js tests/unit/chartData.test.js
git commit -m "feat: 대시보드 차트 데이터 API 엔드포인트 추가"
```

---

## Task 5: StatCard 개선 (카운트업 + 증감 표시 + 그라데이션)

**Files:**
- Modify: `src/components/StatCard.vue`

- [ ] **Step 1: StatCard 전체 교체**

`src/components/StatCard.vue` 전체를 아래로 교체:

```vue
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/StatCard.vue
git commit -m "feat: StatCard 개선 (카운트업 애니메이션, 증감 표시, 그라데이션 아이콘)"
```

---

## Task 6: 대시보드 리뉴얼

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: import 업데이트**

`DashboardView.vue` 상단의 `<script setup>` 내 import에 추가:

```javascript
import BarChart from '../components/charts/BarChart.vue'
import LineChart from '../components/charts/LineChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import { chartColors } from '../components/charts/chartConfig.js'
import { fetchChartData } from '../services/api.js'
```

- [ ] **Step 2: 차트 데이터 state 및 로딩 로직 추가**

`<script setup>` 안에 `onMounted` 위에 추가:

```javascript
const chartData = ref(null)
```

`onMounted` 안의 try 블록에서 기존 `Promise.all` 뒤에 차트 데이터 로딩 추가:

```javascript
    // 차트 데이터 로딩
    try {
      const chartRes = await fetchChartData(controller.signal)
      if (chartRes.success && chartRes.data) {
        chartData.value = chartRes.data
      }
    } catch { /* 차트 실패해도 대시보드는 표시 */ }
```

- [ ] **Step 3: 차트용 computed 속성 추가**

`<script setup>` 안, `formatDuration` 함수 위에 추가:

```javascript
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
```

- [ ] **Step 4: 인사 배너 업데이트**

기존 오늘의 요약 배너에서 텍스트만 변경. 기존:

```html
          <p v-if="!loading" class="text-lg font-bold" :class="isDark ? 'text-slate-100' : 'text-white'">
            {{ todaySummaryText }}
          </p>
```

교체:

```html
          <p v-if="!loading" class="text-lg font-bold" :class="isDark ? 'text-slate-100' : 'text-white'">
            {{ greetingText }}. {{ todaySummaryText }}
          </p>
```

- [ ] **Step 5: 차트 그리드 섹션 추가**

Stats Grid와 진행 중인 회의 배너 사이에 (기존 `<!-- 진행 중인 회의 배너 -->` 바로 위에) 차트 그리드 추가:

```html
    <!-- 차트 그리드 -->
    <div v-if="!loading && chartData" class="grid grid-cols-2 gap-6 mb-8">
      <!-- 주간 회의 빈도 -->
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">주간 회의 빈도</h3>
        <BarChart v-if="weeklyChartData" :chart-data="weeklyChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>

      <!-- 시간대별 분포 -->
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">시간대별 분포</h3>
        <LineChart v-if="hourlyChartData" :chart-data="hourlyChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>

      <!-- 키워드 트렌드 -->
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">키워드 트렌드 (2주)</h3>
        <LineChart v-if="keywordChartData" :chart-data="keywordChartData" :is-dark="isDark" :height="200" :options="{ showLegend: true }" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">데이터 없음</p>
      </div>

      <!-- 화자 비율 -->
      <div
        class="rounded-2xl border p-5"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
      >
        <h3 class="text-sm font-semibold mb-4" :class="isDark ? 'text-slate-300' : 'text-slate-700'">화자 비율 (최근 5개 회의)</h3>
        <DoughnutChart v-if="speakerChartData" :chart-data="speakerChartData" :is-dark="isDark" :height="200" />
        <p v-else class="text-xs text-center py-10" :class="isDark ? 'text-slate-500' : 'text-slate-400'">화자 분리 데이터 없음</p>
      </div>
    </div>
```

- [ ] **Step 6: 카드 스타일 업데이트**

기존 2-column 카드 (오늘의 일정, 긴급 액션아이템) 의 `rounded-xl` → `rounded-2xl`, 다크모드 배경 업데이트:

기존:
```html
        class="rounded-xl border p-5"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
```

교체 (두 곳 모두):
```html
        class="rounded-2xl border p-5 transition-all duration-200"
        :class="isDark ? 'bg-zinc-900/80 backdrop-blur-xl border-zinc-800' : 'bg-white border-slate-200'"
```

- [ ] **Step 7: 커밋**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: 대시보드 차트 그리드 추가 (주간 빈도, 시간 분포, 키워드, 화자)"
```

---

## Task 7: 모션 시스템 (라우터 전환 + @vueuse/motion 설정)

**Files:**
- Modify: `src/App.vue`
- Modify: `src/main.js`

- [ ] **Step 1: main.js에 @vueuse/motion 등록**

`src/main.js`에서 기존 import 뒤에 추가:

```javascript
import { MotionPlugin } from '@vueuse/motion'
```

`app.use(router)` 뒤에 추가:

```javascript
app.use(MotionPlugin)
```

- [ ] **Step 2: App.vue에 Transition 컴포넌트 적용**

`src/App.vue`에서 기존 메인 레이아웃의 `<router-view />`를:

```html
    <main class="flex-1 overflow-y-auto pb-16 md:pb-0">
      <router-view />
    </main>
```

아래로 교체:

```html
    <main class="flex-1 overflow-y-auto pb-16 md:pb-0">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </Transition>
      </router-view>
    </main>
```

- [ ] **Step 3: 커밋**

```bash
git add src/main.js src/App.vue
git commit -m "feat: @vueuse/motion 등록 및 라우터 전환 애니메이션 개선"
```

---

## Task 8: MeetingCard hover 애니메이션 + 새 토큰

**Files:**
- Modify: `src/components/MeetingCard.vue`

- [ ] **Step 1: MeetingCard 카드 컨테이너 스타일 업데이트**

`MeetingCard.vue`에서 최상위 `<router-link>`의 클래스를 업데이트. 기존 `rounded-xl`을 찾아 `rounded-2xl`로, 그리고 hover 효과 추가.

기존 (첫 번째 줄의 class 부분):
```html
    class="block rounded-xl border p-4 transition-all hover:shadow-md"
```

교체:
```html
    class="block rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
```

그리고 다크모드 배경도:
```html
    :class="isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'"
```

교체:
```html
    :class="isDark ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'"
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/MeetingCard.vue
git commit -m "style: MeetingCard hover 애니메이션 및 새 토큰 적용"
```

---

## Task 9: 회의 목록 개선 (뷰 토글 + 필터 + 검색)

**Files:**
- Modify: `src/views/MeetingsListView.vue`

- [ ] **Step 1: MeetingsListView 전체 개선**

현재 파일은 약 98줄로 간단한 구조다. `<script setup>` 안에 뷰 모드 토글, 디바운스 검색을 추가한다.

기존 `<script setup>` 안에 state 추가 (기존 ref들 근처에):

```javascript
const viewMode = ref('card') // 'card' | 'list'
const dateFilter = ref('all') // 'all' | 'week' | 'month'
let searchTimeout = null
```

기존 검색 로직이 있다면 디바운스 적용. `watch`가 있으면 디바운스 wrapping:

```javascript
const onSearch = (e) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = e.target.value
  }, 300)
}
```

`filteredMeetings` computed에 날짜 필터 추가:

```javascript
const filteredByDate = computed(() => {
  if (dateFilter.value === 'all') return filteredMeetings.value
  const now = new Date()
  const cutoff = new Date()
  if (dateFilter.value === 'week') cutoff.setDate(now.getDate() - 7)
  if (dateFilter.value === 'month') cutoff.setMonth(now.getMonth() - 1)
  return filteredMeetings.value.filter(m => new Date(m.date) >= cutoff)
})
```

- [ ] **Step 2: 템플릿에 뷰 모드 토글 + 날짜 필터 추가**

검색 바 영역에 뷰 토글 버튼과 날짜 필터를 추가. 기존 검색/필터 영역에 아래를 추가:

```html
      <!-- 뷰 모드 + 날짜 필터 -->
      <div class="flex items-center gap-2">
        <!-- 날짜 필터 -->
        <div class="flex rounded-lg border overflow-hidden" :class="isDark ? 'border-zinc-700' : 'border-slate-200'">
          <button
            v-for="opt in [{ key: 'all', label: '전체' }, { key: 'week', label: '이번 주' }, { key: 'month', label: '이번 달' }]"
            :key="opt.key"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="dateFilter === opt.key
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="dateFilter = opt.key"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- 뷰 모드 토글 -->
        <div class="flex rounded-lg border overflow-hidden" :class="isDark ? 'border-zinc-700' : 'border-slate-200'">
          <button
            class="p-1.5 transition-colors"
            :class="viewMode === 'card'
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="viewMode = 'card'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
            </svg>
          </button>
          <button
            class="p-1.5 transition-colors"
            :class="viewMode === 'list'
              ? 'bg-primary-500 text-white'
              : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-50'"
            @click="viewMode = 'list'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </button>
        </div>
      </div>
```

- [ ] **Step 3: 카드/리스트 뷰 분기**

기존 MeetingCard 반복 렌더링 부분을 뷰 모드에 따라 분기:

```html
      <!-- 카드 뷰 -->
      <div v-if="viewMode === 'card'" class="space-y-3">
        <MeetingCard v-for="m in filteredByDate" :key="m.id" :meeting="m" />
      </div>

      <!-- 리스트 뷰 (컴팩트) -->
      <div v-else class="space-y-1">
        <router-link
          v-for="m in filteredByDate"
          :key="m.id"
          :to="`/meetings/${m.id}`"
          class="flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          :class="isDark ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'"
        >
          <span class="text-xs font-mono tabular-nums w-20 shrink-0" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ m.date }}</span>
          <span class="text-sm font-medium truncate flex-1" :class="isDark ? 'text-slate-200' : 'text-slate-800'">{{ m.title }}</span>
          <span
            class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
            :class="m.status === 'completed'
              ? 'bg-success-50 text-success-600'
              : m.status === 'in-progress'
                ? 'bg-primary-50 text-primary-600'
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'"
          >
            {{ m.status === 'completed' ? '완료' : m.status === 'in-progress' ? '진행중' : '대기' }}
          </span>
          <span class="text-xs shrink-0" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ m.duration ? m.duration + '분' : '' }}</span>
        </router-link>
      </div>
```

- [ ] **Step 4: 커밋**

```bash
git add src/views/MeetingsListView.vue
git commit -m "feat: 회의 목록 뷰 토글, 날짜 필터, 디바운스 검색 추가"
```

---

## Task 10: 회의 상세 개선 (탭 애니메이션 + 챗봇 패널)

**Files:**
- Modify: `src/views/MeetingDetailView.vue`
- Modify: `src/components/MeetingChatbot.vue`

- [ ] **Step 1: MeetingDetailView 탭 인디케이터 슬라이딩**

`MeetingDetailView.vue`에서 탭 버튼 영역을 찾아, 활성 탭 아래에 슬라이딩 인디케이터를 추가.

`<script setup>` 안에 추가:

```javascript
import { ref, computed, watch, nextTick } from 'vue'

const tabRefs = ref({})
const indicatorStyle = ref({})

const updateIndicator = async () => {
  await nextTick()
  const el = tabRefs.value[activeTab.value]
  if (el) {
    indicatorStyle.value = {
      left: el.offsetLeft + 'px',
      width: el.offsetWidth + 'px',
    }
  }
}

watch(() => activeTab.value, updateIndicator)
onMounted(() => setTimeout(updateIndicator, 100))
```

탭 버튼의 template에서 각 버튼에 ref 추가:

```html
<button
  v-for="tab in tabs"
  :key="tab.key"
  :ref="el => { if (el) tabRefs[tab.key] = el }"
  ...
>
```

탭 컨테이너 안에 인디케이터 div 추가 (탭 버튼들 바로 아래):

```html
        <div
          class="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-200 ease-out rounded-full"
          :style="indicatorStyle"
        ></div>
```

- [ ] **Step 2: MeetingChatbot을 슬라이드 패널로 변경**

`src/components/MeetingChatbot.vue`에서 기존 floating 패널을 오른쪽 슬라이드 패널로 변경.

기존 최상위 `<div>` 구조를:

```html
<template>
  <div class="fixed bottom-6 right-6 z-50">
```

아래로 교체:

```html
<template>
  <!-- 오버레이 -->
  <Transition name="sidebar-overlay">
    <div v-if="isOpen" class="fixed inset-0 bg-black/30 z-40" @click="isOpen = false"></div>
  </Transition>

  <!-- 패널 -->
  <Transition name="chat-panel">
    <div v-if="isOpen" class="fixed top-0 right-0 h-full w-[380px] z-50 flex flex-col border-l"
      :class="isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'"
    >
```

그리고 `<style scoped>`에 추가:

```css
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition: transform 0.25s ease-out;
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  transform: translateX(100%);
}
```

토글 버튼은 기존 위치를 유지하되 패널 외부(오버레이 위)에 배치.

- [ ] **Step 3: 커밋**

```bash
git add src/views/MeetingDetailView.vue src/components/MeetingChatbot.vue
git commit -m "feat: 탭 슬라이딩 인디케이터 + 챗봇 슬라이드 패널"
```

---

## Task 11: ActionItemRow 완료 애니메이션 + 마감일 강조

**Files:**
- Modify: `src/components/ActionItemRow.vue`
- Modify: `src/views/ActionItemsView.vue`

- [ ] **Step 1: ActionItemRow 완료 시 스타일 추가**

`ActionItemRow.vue`에서 최상위 요소에 완료 시 클래스를 추가. 기존 `class` 속성에 동적 바인딩:

```html
    :class="[
      isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200',
      (item.done || item.status === 'done') ? 'opacity-50' : '',
    ]"
```

텍스트 요소에 strikethrough 추가:

```html
    <span
      class="transition-all duration-300"
      :class="(item.done || item.status === 'done') ? 'line-through text-slate-400' : ''"
    >
```

마감일 임박 (3일 이내) 시 왼쪽 border glow:

```html
    :style="isImminentDate(item.dueDate) && !item.done ? 'border-left: 3px solid #ef4444; box-shadow: -2px 0 8px rgba(239,68,68,0.15)' : ''"
```

`<script setup>` 안에 helper 추가:

```javascript
const isImminentDate = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + 3)
  return d <= threshold
}
```

- [ ] **Step 2: ActionItemsView 리스트 TransitionGroup 적용**

`ActionItemsView.vue`에서 기존 ActionItemRow 반복 영역을 `<TransitionGroup>`으로 감싸기:

```html
        <TransitionGroup name="list" tag="div" class="space-y-1">
          <ActionItemRow
            v-for="item in filteredItems"
            :key="item.id || item.text"
            :item="item"
            ...
          />
        </TransitionGroup>
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/ActionItemRow.vue src/views/ActionItemsView.vue
git commit -m "feat: 액션 아이템 완료 애니메이션 + 마감일 임박 강조"
```

---

## Task 12: NewMeetingView 스텝 위저드 아이콘화

**Files:**
- Modify: `src/views/NewMeetingView.vue`

- [ ] **Step 1: 스텝 인디케이터를 아이콘 + 체크마크로 교체**

`NewMeetingView.vue`에서 기존 스텝 인디케이터 영역을 찾아 (숫자 1,2,3,4 표시 부분) 아이콘으로 교체.

스텝 인디케이터에서 숫자 대신 아이콘 + 완료 시 체크마크:

```html
            <!-- 스텝 아이콘 -->
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
              :class="stepIdx < currentStep
                ? 'bg-success-500 text-white'
                : stepIdx === currentStep
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white scale-110'
                  : isDark ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-400'"
            >
              <!-- 완료 체크 -->
              <svg v-if="stepIdx < currentStep" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <!-- 마이크 (녹음) -->
              <svg v-else-if="stepIdx === 0" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <!-- 텍스트 (STT) -->
              <svg v-else-if="stepIdx === 1" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <!-- AI 분석 -->
              <svg v-else-if="stepIdx === 2" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <!-- 저장 -->
              <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
```

- [ ] **Step 2: 커밋**

```bash
git add src/views/NewMeetingView.vue
git commit -m "style: 스텝 위저드 숫자를 아이콘 + 체크마크로 교체"
```

---

## Task 13: 최종 점검 및 전체 테스트

**Files:**
- None (검증만)

- [ ] **Step 1: 전체 단위 테스트 실행**

```bash
npx vitest run
```

Expected: All tests passed

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 빌드 성공 (경고 있어도 에러 없음)

- [ ] **Step 3: 커밋 (필요시)**

문제 수정이 필요했다면:

```bash
git add -A
git commit -m "fix: UI 모던화 최종 점검 수정"
```
