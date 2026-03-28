<script setup>
import { ref, computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

// 필터 상태
const dateFrom = ref('')
const dateTo = ref('')
const selectedUser = ref('전체')
const selectedAction = ref('전체')
const currentPage = ref(1)
const pageSize = 10

const users = ['전체', '김민수', '이수진', '박지훈', '최영희', '정대영', '한소연']
const actionTypes = ['전체', '회의록 열람', '회의록 편집', '회의록 생성', '액션아이템 변경', '메일 발송', '로그인', '설정 변경']

// 액션 타입별 뱃지 색상
const actionColors = {
  '회의록 열람': { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900/50 text-blue-300' },
  '회의록 편집': { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/50 text-amber-300' },
  '회의록 생성': { light: 'bg-green-100 text-green-700', dark: 'bg-green-900/50 text-green-300' },
  '액션아이템 변경': { light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-900/50 text-purple-300' },
  '메일 발송': { light: 'bg-pink-100 text-pink-700', dark: 'bg-pink-900/50 text-pink-300' },
  '로그인': { light: 'bg-slate-100 text-slate-700', dark: 'bg-slate-700/50 text-slate-300' },
  '설정 변경': { light: 'bg-red-100 text-red-700', dark: 'bg-red-900/50 text-red-300' },
}

// Mock 감사 로그 데이터
const auditLogs = ref([
  { id: 1, timestamp: '2026-03-28 09:15:23', user: '김민수', action: '로그인', description: '시스템 로그인 (웹 브라우저)', ip: '192.168.1.101' },
  { id: 2, timestamp: '2026-03-28 09:20:45', user: '김민수', action: '회의록 생성', description: '주간 프로젝트 회의 회의록 생성', ip: '192.168.1.101' },
  { id: 3, timestamp: '2026-03-28 09:35:12', user: '이수진', action: '로그인', description: '시스템 로그인 (모바일)', ip: '10.0.0.52' },
  { id: 4, timestamp: '2026-03-28 09:42:30', user: '이수진', action: '회의록 열람', description: '2026년 3월 마케팅 전략 회의 열람', ip: '10.0.0.52' },
  { id: 5, timestamp: '2026-03-28 10:05:18', user: '박지훈', action: '회의록 편집', description: '기술 검토 회의 내용 수정', ip: '192.168.1.203' },
  { id: 6, timestamp: '2026-03-28 10:12:55', user: '최영희', action: '액션아이템 변경', description: 'UI 리디자인 작업 상태를 "진행 중"으로 변경', ip: '192.168.1.87' },
  { id: 7, timestamp: '2026-03-28 10:30:00', user: '정대영', action: '메일 발송', description: '주간 회의록 요약 메일 발송 (수신: 5명)', ip: '192.168.1.150' },
  { id: 8, timestamp: '2026-03-28 11:00:33', user: '김민수', action: '설정 변경', description: '알림 설정 변경: 이메일 알림 활성화', ip: '192.168.1.101' },
  { id: 9, timestamp: '2026-03-28 11:15:20', user: '한소연', action: '로그인', description: '시스템 로그인 (웹 브라우저)', ip: '172.16.0.45' },
  { id: 10, timestamp: '2026-03-28 11:22:48', user: '한소연', action: '회의록 열람', description: 'Q1 실적 리뷰 회의록 열람', ip: '172.16.0.45' },
  { id: 11, timestamp: '2026-03-28 13:05:10', user: '박지훈', action: '회의록 생성', description: '긴급 장애 대응 회의 회의록 생성', ip: '192.168.1.203' },
  { id: 12, timestamp: '2026-03-28 13:45:22', user: '이수진', action: '액션아이템 변경', description: '마케팅 자료 준비 완료로 상태 변경', ip: '10.0.0.52' },
  { id: 13, timestamp: '2026-03-28 14:10:05', user: '최영희', action: '메일 발송', description: '디자인 리뷰 결과 공유 메일 발송 (수신: 3명)', ip: '192.168.1.87' },
  { id: 14, timestamp: '2026-03-28 14:30:40', user: '정대영', action: '회의록 편집', description: '인프라 점검 회의 참석자 목록 수정', ip: '192.168.1.150' },
  { id: 15, timestamp: '2026-03-28 15:00:15', user: '김민수', action: '회의록 열람', description: '신규 프로젝트 킥오프 회의록 열람', ip: '192.168.1.101' },
  { id: 16, timestamp: '2026-03-28 15:25:33', user: '한소연', action: '설정 변경', description: '프로필 정보 업데이트: 부서 변경', ip: '172.16.0.45' },
  { id: 17, timestamp: '2026-03-28 16:00:00', user: '박지훈', action: '액션아이템 변경', description: 'API 문서 작성 마감일 연장 (3/30 → 4/5)', ip: '192.168.1.203' },
])

// 필터링된 로그
const filteredLogs = computed(() => {
  return auditLogs.value.filter(log => {
    const matchUser = selectedUser.value === '전체' || log.user === selectedUser.value
    const matchAction = selectedAction.value === '전체' || log.action === selectedAction.value
    const matchDateFrom = !dateFrom.value || log.timestamp >= dateFrom.value
    const matchDateTo = !dateTo.value || log.timestamp <= dateTo.value + ' 23:59:59'
    return matchUser && matchAction && matchDateFrom && matchDateTo
  })
})

// 페이지네이션
const totalPages = computed(() => Math.ceil(filteredLogs.value.length / pageSize))
const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredLogs.value.slice(start, start + pageSize)
})

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}
const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

// 뱃지 클래스
const getBadgeClass = (action) => {
  const colors = actionColors[action]
  if (!colors) return isDark.value ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
  return isDark.value ? colors.dark : colors.light
}

// CSV 내보내기
const exportCSV = () => {
  const header = '시간,사용자,활동,상세,IP'
  const rows = filteredLogs.value.map(log =>
    `"${log.timestamp}","${log.user}","${log.action}","${log.description}","${log.ip}"`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="p-8">
    <!-- 헤더 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">감사 로그</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">시스템 활동 기록</p>
      </div>
      <button
        @click="exportCSV"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="isDark
          ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        CSV 내보내기
      </button>
    </div>

    <!-- 필터 바 -->
    <div
      class="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl border"
      :class="isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'"
    >
      <!-- 날짜 범위 -->
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">기간</label>
        <input
          v-model="dateFrom"
          type="date"
          class="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          :class="isDark
            ? 'bg-slate-700 border-slate-600 text-slate-200'
            : 'bg-white border-slate-200 text-slate-900'"
        />
        <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">~</span>
        <input
          v-model="dateTo"
          type="date"
          class="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          :class="isDark
            ? 'bg-slate-700 border-slate-600 text-slate-200'
            : 'bg-white border-slate-200 text-slate-900'"
        />
      </div>

      <!-- 사용자 필터 -->
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">사용자</label>
        <select
          v-model="selectedUser"
          class="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          :class="isDark
            ? 'bg-slate-700 border-slate-600 text-slate-200'
            : 'bg-white border-slate-200 text-slate-900'"
        >
          <option v-for="u in users" :key="u" :value="u">{{ u }}</option>
        </select>
      </div>

      <!-- 활동 유형 필터 -->
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">활동</label>
        <select
          v-model="selectedAction"
          class="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          :class="isDark
            ? 'bg-slate-700 border-slate-600 text-slate-200'
            : 'bg-white border-slate-200 text-slate-900'"
        >
          <option v-for="a in actionTypes" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
    </div>

    <!-- 테이블 -->
    <div
      class="rounded-xl border overflow-hidden"
      :class="isDark ? 'border-slate-700' : 'border-slate-200'"
    >
      <table class="w-full text-sm">
        <thead>
          <tr :class="isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'">
            <th class="text-left px-4 py-3 font-medium">시간</th>
            <th class="text-left px-4 py-3 font-medium">사용자</th>
            <th class="text-left px-4 py-3 font-medium">활동</th>
            <th class="text-left px-4 py-3 font-medium">상세</th>
            <th class="text-left px-4 py-3 font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(log, idx) in paginatedLogs"
            :key="log.id"
            :class="[
              idx % 2 === 0
                ? (isDark ? 'bg-slate-800/30' : 'bg-white')
                : (isDark ? 'bg-slate-800/60' : 'bg-slate-50/50'),
              isDark ? 'border-slate-700/50' : 'border-slate-100',
            ]"
            class="border-b last:border-b-0 transition-colors"
          >
            <td class="px-4 py-3 whitespace-nowrap font-mono text-xs" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              {{ log.timestamp }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
              {{ log.user }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span
                class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="getBadgeClass(log.action)"
              >
                {{ log.action }}
              </span>
            </td>
            <td class="px-4 py-3" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
              {{ log.description }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap font-mono text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
              {{ log.ip }}
            </td>
          </tr>
          <tr v-if="paginatedLogs.length === 0">
            <td colspan="5" class="px-4 py-12 text-center" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
              검색 결과가 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 페이지네이션 -->
    <div class="flex items-center justify-between mt-4">
      <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        총 {{ filteredLogs.length }}건 중 {{ (currentPage - 1) * pageSize + 1 }}~{{ Math.min(currentPage * pageSize, filteredLogs.length) }}건
      </p>
      <div class="flex items-center gap-2">
        <button
          @click="prevPage"
          :disabled="currentPage <= 1"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="isDark
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
        >
          이전
        </button>
        <span class="text-sm px-2" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          @click="nextPage"
          :disabled="currentPage >= totalPages"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="isDark
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
        >
          다음
        </button>
      </div>
    </div>
  </div>
</template>
