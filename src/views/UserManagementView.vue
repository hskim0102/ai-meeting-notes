<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useAuth } from '../composables/useAuth.js'
import { fetchUsers, updateUserRole, updateUserStatus } from '../services/api.js'

const { isDark } = useDarkMode()
const { currentUser } = useAuth()

const users = ref([])
const loading = ref(true)
const searchQuery = ref('')
const filterRole = ref('all')
const filterStatus = ref('all')
const toast = ref({ show: false, message: '', type: 'success' })

const roleOptions = [
  { value: 'all', label: '전체' },
  { value: 'admin', label: '관리자' },
  { value: 'manager', label: '매니저' },
  { value: 'member', label: '멤버' },
]

const roleConfig = {
  admin:   { label: '관리자', badge: 'bg-danger-500/15 text-danger-400 border border-danger-500/25', dot: 'bg-danger-500' },
  manager: { label: '매니저', badge: 'bg-warning-500/15 text-warning-500 border border-warning-500/25', dot: 'bg-warning-500' },
  member:  { label: '멤버',   badge: 'bg-primary-500/15 text-primary-400 border border-primary-500/25', dot: 'bg-primary-500' },
}

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
]

onMounted(async () => {
  await loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const res = await fetchUsers()
    users.value = res.data
  } catch (err) {
    showToast('사용자 목록 조회 실패: ' + err.message, 'error')
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    const matchSearch = !searchQuery.value ||
      u.name.includes(searchQuery.value) ||
      u.email.includes(searchQuery.value) ||
      (u.department || '').includes(searchQuery.value)
    const matchRole = filterRole.value === 'all' || u.role === filterRole.value
    const matchStatus = filterStatus.value === 'all' || u.status === filterStatus.value
    return matchSearch && matchRole && matchStatus
  })
})

const stats = computed(() => ({
  total: users.value.length,
  admin: users.value.filter(u => u.role === 'admin').length,
  manager: users.value.filter(u => u.role === 'manager').length,
  member: users.value.filter(u => u.role === 'member').length,
  active: users.value.filter(u => u.status === 'active').length,
  inactive: users.value.filter(u => u.status === 'inactive').length,
}))

const pendingRole = ref({})
const pendingStatus = ref({})

async function changeRole(user, newRole) {
  if (user.role === newRole) return
  pendingRole.value[user.id] = true
  try {
    const res = await updateUserRole(user.id, newRole)
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1) users.value[idx] = res.data
    showToast(`${user.name}의 역할을 ${roleConfig[newRole].label}(으)로 변경했습니다`, 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    delete pendingRole.value[user.id]
  }
}

async function toggleStatus(user) {
  const newStatus = user.status === 'active' ? 'inactive' : 'active'
  pendingStatus.value[user.id] = true
  try {
    const res = await updateUserStatus(user.id, newStatus)
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1) users.value[idx] = res.data
    showToast(`${user.name} 계정을 ${newStatus === 'active' ? '활성화' : '비활성화'}했습니다`, 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    delete pendingStatus.value[user.id]
  }
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getAvatarColor(idx) {
  return avatarColors[idx % avatarColors.length]
}

function isCurrentUser(user) {
  return user.id === currentUser.value?.id
}
</script>

<template>
  <!-- 토스트 -->
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast.show"
        class="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2"
        :class="{
          'bg-success-500 text-white': toast.type === 'success',
          'bg-danger-500 text-white': toast.type === 'error',
        }"
      >
        <svg v-if="toast.type === 'success'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        {{ toast.message }}
      </div>
    </Transition>
  </Teleport>

  <div class="p-8">
    <!-- 헤더 -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">사용자 관리</h1>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-danger-500/15 text-danger-400 border border-danger-500/25">관리자 전용</span>
        </div>
        <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          전체 <span class="font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-700'">{{ stats.total }}명</span>의 사용자 계정 및 권한을 관리합니다
        </p>
      </div>
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-danger-400 to-danger-600 text-white shadow-lg shadow-danger-500/20">
        <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </div>
    </div>

    <!-- 통계 카드 -->
    <div class="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div
        v-for="(stat, key) in [
          { label: '전체', value: stats.total, color: 'text-slate-400' },
          { label: '관리자', value: stats.admin, color: 'text-danger-400' },
          { label: '매니저', value: stats.manager, color: 'text-warning-500' },
          { label: '멤버', value: stats.member, color: 'text-primary-400' },
          { label: '활성', value: stats.active, color: 'text-success-400' },
          { label: '비활성', value: stats.inactive, color: 'text-slate-400' },
        ]"
        :key="key"
        class="rounded-xl border p-3 text-center"
        :class="isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'"
      >
        <p class="text-xs font-medium mb-1" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ stat.label }}</p>
        <p class="text-xl font-bold tabular-nums" :class="stat.color">{{ stat.value }}</p>
      </div>
    </div>

    <!-- 필터 & 검색 -->
    <div class="flex items-center gap-3 mb-5 flex-wrap">
      <!-- 검색 -->
      <div class="flex-1 min-w-48 relative">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="이름, 이메일, 부서로 검색..."
          class="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          :class="isDark
            ? 'bg-zinc-900/80 border-zinc-800 text-slate-100 placeholder:text-slate-500'
            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'"
        />
      </div>

      <!-- 역할 필터 -->
      <div class="flex rounded-xl p-0.5 border" :class="isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'">
        <button
          v-for="opt in roleOptions"
          :key="opt.value"
          @click="filterRole = opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          :class="filterRole === opt.value
            ? 'bg-primary-500 text-white'
            : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-600 hover:bg-slate-50'"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 상태 필터 -->
      <div class="flex rounded-xl p-0.5 border" :class="isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'">
        <button
          v-for="opt in [{ value: 'all', label: '전체' }, { value: 'active', label: '활성' }, { value: 'inactive', label: '비활성' }]"
          :key="opt.value"
          @click="filterStatus = opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          :class="filterStatus === opt.value
            ? 'bg-primary-500 text-white'
            : isDark ? 'text-slate-400 hover:bg-zinc-800' : 'text-slate-600 hover:bg-slate-50'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 사용자 테이블 -->
    <div class="rounded-2xl border overflow-hidden" :class="isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'">
      <!-- 테이블 헤더 -->
      <div
        class="grid items-center px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b"
        style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr"
        :class="isDark ? 'text-slate-500 border-zinc-800 bg-zinc-950/50' : 'text-slate-400 border-slate-100 bg-slate-50'"
      >
        <span>사용자</span>
        <span>부서</span>
        <span>역할</span>
        <span>가입일</span>
        <span class="text-right">상태 / 액션</span>
      </div>

      <!-- 로딩 -->
      <div v-if="loading" class="py-12 flex justify-center">
        <svg class="w-6 h-6 animate-spin" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>

      <!-- 빈 상태 -->
      <div v-else-if="filteredUsers.length === 0" class="py-16 text-center">
        <svg class="w-12 h-12 mx-auto mb-3" :class="isDark ? 'text-slate-700' : 'text-slate-300'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p class="text-sm font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">검색 결과가 없습니다</p>
        <p class="text-xs mt-1" :class="isDark ? 'text-slate-600' : 'text-slate-400'">필터나 검색어를 변경해보세요</p>
      </div>

      <!-- 사용자 행 -->
      <div v-else class="divide-y" :class="isDark ? 'divide-zinc-800/60' : 'divide-slate-100'">
        <div
          v-for="(user, idx) in filteredUsers"
          :key="user.id"
          class="grid items-center px-5 py-3.5 transition-colors"
          style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr"
          :class="[
            isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50',
            user.status === 'inactive' ? 'opacity-60' : '',
          ]"
        >
          <!-- 사용자 정보 -->
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0"
              :class="getAvatarColor(idx)"
            >
              {{ user.name[0] }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ user.name }}</span>
                <span v-if="isCurrentUser(user)" class="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-500/15 text-primary-400 font-medium shrink-0">나</span>
              </div>
              <span class="text-xs truncate block" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ user.email }}</span>
            </div>
          </div>

          <!-- 부서 -->
          <div>
            <span class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ user.department || '-' }}</span>
          </div>

          <!-- 역할 변경 -->
          <div>
            <div class="relative inline-block">
              <select
                :value="user.role"
                :disabled="isCurrentUser(user) || !!pendingRole[user.id]"
                @change="e => changeRole(user, e.target.value)"
                class="appearance-none text-xs font-semibold pl-6 pr-5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="[
                  roleConfig[user.role]?.badge,
                  isDark ? 'bg-transparent' : 'bg-transparent',
                ]"
              >
                <option value="admin">관리자</option>
                <option value="manager">매니저</option>
                <option value="member">멤버</option>
              </select>
              <!-- 상태 점 -->
              <span
                class="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                :class="roleConfig[user.role]?.dot"
              ></span>
              <!-- 드롭다운 아이콘 -->
              <svg v-if="!pendingRole[user.id]" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
              <svg v-else class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin pointer-events-none" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            </div>
          </div>

          <!-- 가입일 -->
          <div>
            <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ formatDate(user.created_at) }}</span>
          </div>

          <!-- 상태 토글 + 액션 -->
          <div class="flex items-center justify-end gap-2">
            <!-- 활성/비활성 토글 -->
            <button
              v-if="!isCurrentUser(user)"
              @click="toggleStatus(user)"
              :disabled="!!pendingStatus[user.id]"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="user.status === 'active'
                ? 'bg-success-500'
                : (isDark ? 'bg-zinc-700' : 'bg-slate-200')"
              :title="user.status === 'active' ? '비활성화' : '활성화'"
            >
              <span
                class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
              :style="user.status === 'active' ? 'transform: translateX(1.125rem)' : 'transform: translateX(0.125rem)'"
              ></span>
            </button>
            <span v-else class="text-xs px-2 py-0.5 rounded-full" :class="isDark ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-400'">현재 계정</span>

            <!-- 상태 배지 -->
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              :class="user.status === 'active'
                ? (isDark ? 'bg-success-500/15 text-success-400' : 'bg-success-50 text-success-600')
                : (isDark ? 'bg-zinc-800 text-slate-500' : 'bg-slate-100 text-slate-400')"
            >
              {{ user.status === 'active' ? '활성' : '비활성' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 하단 카운트 -->
      <div
        v-if="!loading && filteredUsers.length > 0"
        class="px-5 py-2.5 border-t text-xs"
        :class="isDark ? 'border-zinc-800 text-slate-600' : 'border-slate-100 text-slate-400'"
      >
        {{ filteredUsers.length }}명 표시 중 (전체 {{ users.length }}명)
      </div>
    </div>

    <!-- 안내 -->
    <div class="mt-4 flex items-start gap-2 p-3 rounded-xl" :class="isDark ? 'bg-zinc-900/60 border border-zinc-800' : 'bg-amber-50 border border-amber-200'">
      <svg class="w-4 h-4 mt-0.5 shrink-0" :class="isDark ? 'text-slate-500' : 'text-amber-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      <div class="text-xs" :class="isDark ? 'text-slate-500' : 'text-amber-700'">
        <span class="font-semibold">역할 안내:</span>
        <span class="ml-1">관리자는 모든 회의 열람 및 사용자 관리 권한을 가집니다. 매니저는 모든 회의 열람 및 리포트 조회가 가능합니다. 멤버는 자신이 참석한 회의만 열람할 수 있습니다.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active { animation: toast-in 0.3s ease-out; }
.toast-leave-active { animation: toast-out 0.3s ease-in; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
</style>
