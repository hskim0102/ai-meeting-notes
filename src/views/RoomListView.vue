<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { rooms as fallbackRooms, reservations as fallbackReservations } from '../data/mockData.js'
import { useDarkMode } from '../composables/useDarkMode.js'
import { fetchRooms, fetchReservations } from '../services/api.js'

const router = useRouter()
const filterCapacity = ref('all')
const rooms = ref([...fallbackRooms])
const reservations = ref([...fallbackReservations])
const { isDark } = useDarkMode()

// 오늘 날짜
const today = new Date().toISOString().slice(0, 10)

onMounted(async () => {
  try {
    const [roomsRes, rsvRes] = await Promise.all([
      fetchRooms(),
      fetchReservations({ date: today }),
    ])
    if (roomsRes.success && Array.isArray(roomsRes.data)) rooms.value = roomsRes.data
    if (rsvRes.success && Array.isArray(rsvRes.data)) reservations.value = rsvRes.data
  } catch { /* fallback to mock */ }
})

// 각 회의실의 현재 예약 건수 계산
function getTodayReservations(roomId) {
  return reservations.value.filter(r => r.roomId === roomId && r.date === today)
}

function getNextReservation(roomId) {
  const now = new Date()
  const currentTime = now.toTimeString().slice(0, 5)
  const todayRsvs = getTodayReservations(roomId)
    .filter(r => r.startTime > currentTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  return todayRsvs[0] || null
}

function isCurrentlyInUse(roomId) {
  const now = new Date()
  const currentTime = now.toTimeString().slice(0, 5)
  return getTodayReservations(roomId).some(r => r.startTime <= currentTime && r.endTime > currentTime)
}

const filteredRooms = computed(() => {
  if (filterCapacity.value === 'all') return rooms.value
  if (filterCapacity.value === 'small') return rooms.value.filter(r => r.capacity <= 6)
  if (filterCapacity.value === 'medium') return rooms.value.filter(r => r.capacity > 6 && r.capacity <= 15)
  if (filterCapacity.value === 'large') return rooms.value.filter(r => r.capacity > 15)
  return rooms.value
})

const statusLabel = (room) => {
  if (room.status === 'maintenance') return '점검 중'
  if (isCurrentlyInUse(room.id)) return '사용 중'
  return '사용 가능'
}

const statusColor = (room) => {
  if (room.status === 'maintenance') return 'bg-warning-100 text-warning-700'
  if (isCurrentlyInUse(room.id)) return 'bg-danger-100 text-danger-700'
  return 'bg-success-100 text-success-700'
}

const statusDot = (room) => {
  if (room.status === 'maintenance') return 'bg-warning-500'
  if (isCurrentlyInUse(room.id)) return 'bg-danger-500'
  return 'bg-success-500'
}

const equipmentIcon = (eq) => {
  const icons = { '프로젝터': '📽️', '화이트보드': '📋', '화상회의': '📹', '마이크': '🎙️', '모니터': '🖥️', '스피커': '🔊' }
  return icons[eq] || '📦'
}

function goToCalendar() {
  router.push('/rooms/calendar')
}
</script>

<template>
  <div class="p-8">
    <!-- 헤더 -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 :class="['text-2xl font-bold', isDark ? 'text-white' : 'text-slate-900']">회의실 관리</h1>
        <p :class="['text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500']">사내 회의실 현황 조회 및 예약</p>
      </div>
      <button
        @click="goToCalendar"
        class="px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        예약 달력 보기
      </button>
    </div>

    <!-- 필터 -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="f in [
          { value: 'all', label: '전체' },
          { value: 'small', label: '소 (1~6인)' },
          { value: 'medium', label: '중 (7~15인)' },
          { value: 'large', label: '대 (16인+)' },
        ]"
        :key="f.value"
        @click="filterCapacity = f.value"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="filterCapacity === f.value ? 'bg-primary-500 text-white' : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'"
      >{{ f.label }}</button>
    </div>

    <!-- 회의실 카드 그리드 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="room in filteredRooms"
        :key="room.id"
        :class="['rounded-xl p-5 hover:shadow-md transition-shadow', isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200']"
      >
        <!-- 상태 뱃지 + 이름 -->
        <div class="flex items-start justify-between mb-3">
          <h3 :class="['text-lg font-semibold', isDark ? 'text-white' : 'text-slate-900']">{{ room.name }}</h3>
          <span :class="['flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full', statusColor(room)]">
            <span :class="['w-1.5 h-1.5 rounded-full', statusDot(room)]"></span>
            {{ statusLabel(room) }}
          </span>
        </div>

        <!-- 위치 + 수용인원 -->
        <div class="flex items-center gap-4 text-sm text-slate-500 mb-4">
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {{ room.location?.building }} {{ room.location?.floor }}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {{ room.capacity }}명
          </span>
        </div>

        <!-- 장비 -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          <span
            v-for="eq in room.equipment"
            :key="eq"
            :class="['px-2 py-1 text-xs rounded-md', isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600']"
          >{{ equipmentIcon(eq) }} {{ eq }}</span>
        </div>

        <!-- 다음 예약 -->
        <div class="pt-3 border-t border-slate-100">
          <template v-if="getNextReservation(room.id)">
            <p class="text-xs text-slate-400 mb-1">다음 예약</p>
            <p class="text-sm text-slate-700 font-medium">
              {{ getNextReservation(room.id).title }}
              <span class="text-slate-400 font-normal">
                {{ getNextReservation(room.id).startTime }} ~ {{ getNextReservation(room.id).endTime }}
              </span>
            </p>
          </template>
          <template v-else>
            <p class="text-xs text-slate-400">오늘 예정된 회의 없음</p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
