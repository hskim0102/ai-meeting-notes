<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { rooms as fallbackRooms, reservations as fallbackReservations } from '../data/mockData.js'
import { useDarkMode } from '../composables/useDarkMode.js'
import { fetchRooms, fetchReservations, createReservation as apiCreateReservation, cancelReservation as apiCancelReservation } from '../services/api.js'

// 반응형 데이터
const rooms = ref([...fallbackRooms])
const allReservations = ref([...fallbackReservations])
const { isDark } = useDarkMode()

// DB에서 데이터 로드
onMounted(async () => {
  try {
    const roomsRes = await fetchRooms()
    if (roomsRes.success && Array.isArray(roomsRes.data)) rooms.value = roomsRes.data
  } catch { /* fallback */ }
  await loadReservations()
})

async function loadReservations() {
  try {
    const weekStart = weekDays.value[0]?.date
    if (!weekStart) return
    const res = await fetchReservations({ weekStart })
    if (res.success && Array.isArray(res.data)) allReservations.value = res.data
  } catch { /* fallback */ }
}

// 현재 선택된 주의 시작일 (월요일)
const getMonday = (d) => {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

const currentWeekStart = ref(getMonday(new Date()))

// 선택된 회의실 필터
const selectedRoom = ref('all')

// 예약 모달 상태
const showModal = ref(false)
const modalMode = ref('create') // 'create' | 'view'
const selectedReservation = ref(null)
const newReservation = ref({
  roomId: '',
  title: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  organizer: '관리자',
  participants: '',
})
const modalError = ref('')

// 주간 날짜 배열 (월~금)
const weekDays = computed(() => {
  const days = []
  const start = new Date(currentWeekStart.value)
  for (let i = 0; i < 5; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push({
      date: d.toISOString().slice(0, 10),
      dayName: ['월', '화', '수', '목', '금'][i],
      dayNum: d.getDate(),
      isToday: d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
    })
  }
  return days
})

const weekLabel = computed(() => {
  const start = weekDays.value[0]
  const end = weekDays.value[weekDays.value.length - 1]
  if (!start || !end) return ''
  return `${start.date.slice(5)} ~ ${end.date.slice(5)}`
})

// 시간 슬롯 (09:00 ~ 18:00)
const timeSlots = []
for (let h = 9; h <= 18; h++) {
  timeSlots.push(`${String(h).padStart(2, '0')}:00`)
}

// 특정 날짜+회의실의 예약 목록
function getReservationsFor(date, roomId) {
  return allReservations.value.filter(r =>
    r.date === date &&
    r.roomId === roomId &&
    r.status === 'confirmed'
  )
}

// 예약 블록 위치/크기 계산 (시간 → 픽셀)
function getBlockStyle(reservation) {
  const startHour = parseInt(reservation.startTime.split(':')[0])
  const startMin = parseInt(reservation.startTime.split(':')[1])
  const endHour = parseInt(reservation.endTime.split(':')[0])
  const endMin = parseInt(reservation.endTime.split(':')[1])

  const top = ((startHour - 9) * 60 + startMin) * (48 / 60) // 48px = 1시간 높이
  const height = ((endHour - startHour) * 60 + (endMin - startMin)) * (48 / 60)

  return {
    top: `${top}px`,
    height: `${Math.max(height, 20)}px`,
  }
}

// 회의실별 색상
const roomColors = {
  'room-01': 'bg-primary-100 border-primary-300 text-primary-800',
  'room-02': 'bg-accent-100 border-accent-300 text-accent-800',
  'room-03': 'bg-success-100 border-success-300 text-success-800',
  'room-04': 'bg-warning-100 border-warning-300 text-warning-800',
  'room-05': 'bg-danger-100 border-danger-300 text-danger-800',
}

function getRoomColor(roomId) {
  return roomColors[roomId] || 'bg-slate-100 border-slate-300 text-slate-800'
}

function getRoomName(roomId) {
  return rooms.value.find(r => r.id === roomId)?.name || roomId
}

// 표시할 회의실 목록
const displayRooms = computed(() => {
  if (selectedRoom.value === 'all') return rooms.value.filter(r => r.status !== 'maintenance')
  return rooms.value.filter(r => r.id === selectedRoom.value)
})

// 주 이동
// 주 변경 시 예약 재로드
watch(currentWeekStart, () => loadReservations())

function prevWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d
}

function nextWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d
}

function goToThisWeek() {
  currentWeekStart.value = getMonday(new Date())
}

// 모달 관련
function openCreateModal(date, startTime, roomId) {
  modalMode.value = 'create'
  modalError.value = ''
  newReservation.value = {
    roomId: roomId || (displayRooms.value[0]?.id ?? ''),
    title: '',
    date: date || weekDays.value[0].date,
    startTime: startTime || '09:00',
    endTime: startTime ? `${String(parseInt(startTime.split(':')[0]) + 1).padStart(2, '0')}:00` : '10:00',
    organizer: '관리자',
    participants: '',
  }
  showModal.value = true
}

function openViewModal(reservation) {
  modalMode.value = 'view'
  selectedReservation.value = reservation
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedReservation.value = null
  modalError.value = ''
}

async function submitReservation() {
  const r = newReservation.value
  if (!r.title.trim()) { modalError.value = '회의 주제를 입력하세요.'; return }
  if (!r.roomId) { modalError.value = '회의실을 선택하세요.'; return }
  if (r.startTime >= r.endTime) { modalError.value = '종료 시간이 시작 시간보다 뒤여야 합니다.'; return }

  // 충돌 검사
  const hasConflict = allReservations.value.some(existing =>
    existing.roomId === r.roomId &&
    existing.date === r.date &&
    existing.status === 'confirmed' &&
    r.startTime < existing.endTime &&
    r.endTime > existing.startTime
  )

  if (hasConflict) { modalError.value = '해당 시간에 이미 예약이 있습니다.'; return }

  const newRsv = {
    roomId: r.roomId,
    title: r.title.trim(),
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    organizer: r.organizer,
    participants: r.participants ? r.participants.split(',').map(p => p.trim()) : [],
  }

  try {
    const data = await apiCreateReservation(newRsv)
    if (data.success) {
      allReservations.value.push(data.data)
    } else {
      modalError.value = data.error || '예약 생성 실패'
      return
    }
  } catch {
    // DB 실패 시 로컬에만 추가
    allReservations.value.push({ id: `rsv-${Date.now()}`, ...newRsv, status: 'confirmed' })
  }

  closeModal()
}

async function cancelReservationHandler(id) {
  try {
    await apiCancelReservation(id)
  } catch { /* ignore */ }
  const idx = allReservations.value.findIndex(r => r.id === id)
  if (idx !== -1) allReservations.value.splice(idx, 1)
  closeModal()
}
</script>

<template>
  <div class="p-8">
    <!-- 헤더 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">예약 달력</h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">회의실별 주간 예약 현황</p>
      </div>
      <button
        @click="openCreateModal()"
        class="px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        새 예약
      </button>
    </div>

    <!-- 주 네비게이션 + 필터 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button @click="prevWeek" class="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span class="text-sm font-semibold min-w-[140px] text-center" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ weekLabel }}</span>
        <button @click="nextWeek" class="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <svg class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        <button @click="goToThisWeek" class="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
          이번 주
        </button>
      </div>
      <select
        v-model="selectedRoom"
        class="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="all">전체 회의실</option>
        <option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name }}</option>
      </select>
    </div>

    <!-- 달력 그리드 -->
    <div class="rounded-xl border overflow-hidden" :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'">
      <!-- 요일 헤더 -->
      <div class="grid border-b border-slate-200" :style="{ gridTemplateColumns: `80px repeat(${weekDays.length}, 1fr)` }">
        <div class="p-3 text-xs font-medium text-slate-400 border-r border-slate-100"></div>
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="p-3 text-center border-r border-slate-100 last:border-r-0"
          :class="day.isToday ? 'bg-primary-50' : ''"
        >
          <p class="text-xs text-slate-400">{{ day.dayName }}</p>
          <p class="text-lg font-bold" :class="day.isToday ? 'text-primary-600' : 'text-slate-900'">{{ day.dayNum }}</p>
        </div>
      </div>

      <!-- 회의실별 타임라인 -->
      <div v-for="room in displayRooms" :key="room.id" class="border-b border-slate-100 last:border-b-0">
        <!-- 회의실 이름 헤더 -->
        <div class="px-3 py-2 bg-slate-50 border-b border-slate-100">
          <span class="text-xs font-semibold text-slate-700">{{ room.name }}</span>
          <span class="text-xs text-slate-400 ml-2">{{ room.capacity }}명</span>
        </div>

        <!-- 시간 그리드 -->
        <div class="grid" :style="{ gridTemplateColumns: `80px repeat(${weekDays.length}, 1fr)` }">
          <!-- 시간 라벨 -->
          <div class="border-r border-slate-100">
            <div v-for="time in timeSlots" :key="time" class="h-12 px-3 flex items-start pt-1 border-b border-slate-50">
              <span class="text-[10px] text-slate-400">{{ time }}</span>
            </div>
          </div>

          <!-- 각 요일 열 -->
          <div
            v-for="day in weekDays"
            :key="day.date"
            class="relative border-r border-slate-100 last:border-r-0 cursor-pointer hover:bg-slate-50/50"
            :class="day.isToday ? 'bg-primary-50/30' : ''"
            @click="openCreateModal(day.date, '09:00', room.id)"
          >
            <!-- 시간 그리드 라인 -->
            <div v-for="time in timeSlots" :key="time" class="h-12 border-b border-slate-50"></div>

            <!-- 예약 블록 -->
            <div
              v-for="rsv in getReservationsFor(day.date, room.id)"
              :key="rsv.id"
              class="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-[10px] border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity z-10"
              :class="getRoomColor(room.id)"
              :style="getBlockStyle(rsv)"
              @click.stop="openViewModal(rsv)"
            >
              <p class="font-semibold truncate leading-tight">{{ rsv.title }}</p>
              <p class="opacity-70 leading-tight">{{ rsv.startTime }}~{{ rsv.endTime }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 모달 (생성 / 상세보기) -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="closeModal">
      <div class="rounded-2xl shadow-xl w-full max-w-md p-6" :class="isDark ? 'bg-slate-800' : 'bg-white'">
        <!-- 생성 모달 -->
        <template v-if="modalMode === 'create'">
          <h2 class="text-lg font-bold mb-5" :class="isDark ? 'text-slate-100' : 'text-slate-900'">회의실 예약</h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">회의 주제 *</label>
              <input v-model="newReservation.title" type="text" placeholder="예: 주간 스프린트 회의" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">회의실 *</label>
              <select v-model="newReservation.roomId" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option v-for="room in rooms.filter(r => r.status === 'available')" :key="room.id" :value="room.id">
                  {{ room.name }} ({{ room.capacity }}명)
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">날짜 *</label>
              <input v-model="newReservation.date" type="date" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">시작 시간 *</label>
                <select v-model="newReservation.startTime" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option v-for="h in 10" :key="h" :value="`${String(h + 8).padStart(2, '0')}:00`">{{ String(h + 8).padStart(2, '0') }}:00</option>
                  <option v-for="h in 10" :key="'30-'+h" :value="`${String(h + 8).padStart(2, '0')}:30`">{{ String(h + 8).padStart(2, '0') }}:30</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">종료 시간 *</label>
                <select v-model="newReservation.endTime" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option v-for="h in 10" :key="h" :value="`${String(h + 8).padStart(2, '0')}:00`">{{ String(h + 8).padStart(2, '0') }}:00</option>
                  <option v-for="h in 10" :key="'30-'+h" :value="`${String(h + 8).padStart(2, '0')}:30`">{{ String(h + 8).padStart(2, '0') }}:30</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">참석자 (쉼표 구분)</label>
              <input v-model="newReservation.participants" type="text" placeholder="예: 김철수, 이영희" class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <p v-if="modalError" class="mt-3 text-sm text-danger-600">{{ modalError }}</p>

          <div class="flex gap-3 mt-6">
            <button @click="closeModal" class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              취소
            </button>
            <button @click="submitReservation" class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
              예약하기
            </button>
          </div>
        </template>

        <!-- 상세 보기 모달 -->
        <template v-else-if="modalMode === 'view' && selectedReservation">
          <div class="flex items-start justify-between mb-4">
            <h2 class="text-lg font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ selectedReservation.title }}</h2>
            <button @click="closeModal" class="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="space-y-3 text-sm">
            <div class="flex items-center gap-2 text-slate-600">
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
              {{ getRoomName(selectedReservation.roomId) }}
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {{ selectedReservation.date }}
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ selectedReservation.startTime }} ~ {{ selectedReservation.endTime }}
            </div>
            <div class="flex items-center gap-2 text-slate-600">
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              주최: {{ selectedReservation.organizer }}
            </div>
            <div v-if="selectedReservation.participants.length > 0" class="flex items-start gap-2 text-slate-600">
              <svg class="w-4 h-4 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              참석자: {{ selectedReservation.participants.join(', ') }}
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="cancelReservationHandler(selectedReservation.id)" class="flex-1 px-4 py-2.5 text-sm font-medium text-danger-600 bg-danger-50 rounded-lg hover:bg-danger-100 transition-colors">
              예약 취소
            </button>
            <button @click="closeModal" class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              닫기
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
