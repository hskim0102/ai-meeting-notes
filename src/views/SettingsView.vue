<script setup>
import { ref, reactive } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useAuth } from '../composables/useAuth.js'

const { isDark } = useDarkMode()
const { currentUser, isAdmin, mockUsers } = useAuth()

const activeTab = ref('profile')

const tabs = [
  { key: 'profile', label: '프로필' },
  { key: 'notifications', label: '알림' },
  { key: 'integrations', label: '연동' },
  { key: 'admin', label: '관리', adminOnly: true },
]

// 알림 설정
const notifications = reactive({
  email: true,
  push: false,
  reminderD3: true,
  reminderD1: true,
  newMeeting: true,
})

// 연동 서비스
const integrations = reactive([
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: '회의 일정을 자동으로 동기화합니다',
    icon: 'calendar',
    connected: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '회의록 요약을 Slack 채널에 공유합니다',
    icon: 'chat',
    connected: false,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: '액션아이템을 Jira 이슈로 자동 생성합니다',
    icon: 'ticket',
    connected: false,
  },
  {
    id: 'ms-teams',
    name: 'Microsoft Teams',
    description: 'Teams 회의에서 자동 녹음 및 요약합니다',
    icon: 'video',
    connected: true,
  },
])

// 관리 설정
const dataRetention = ref('1year')

function toggleIntegration(integration) {
  integration.connected = !integration.connected
}

function toggleNotification(key) {
  notifications[key] = !notifications[key]
}

const roleLabel = (role) => {
  const map = { admin: '관리자', manager: '매니저', member: '멤버' }
  return map[role] || role
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <!-- 헤더 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">설정</h1>
      <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">계정 및 시스템 설정을 관리합니다</p>
    </div>

    <!-- 탭 네비게이션 -->
    <div
      class="flex gap-1 p-1 rounded-xl mb-8"
      :class="isDark ? 'bg-slate-800' : 'bg-slate-100'"
    >
      <template v-for="tab in tabs" :key="tab.key">
        <button
          v-if="!tab.adminOnly || isAdmin"
          @click="activeTab = tab.key"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="activeTab === tab.key
            ? (isDark ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-white text-slate-900 shadow-sm')
            : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')"
        >
          {{ tab.label }}
        </button>
      </template>
    </div>

    <!-- 프로필 탭 -->
    <div v-if="activeTab === 'profile'">
      <div
        class="rounded-xl border p-6"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <h2 class="text-lg font-semibold mb-6" :class="isDark ? 'text-slate-100' : 'text-slate-900'">프로필 정보</h2>

        <div class="flex items-start gap-6">
          <!-- 아바타 -->
          <div
            class="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
            :class="isDark
              ? 'bg-primary-500/20 text-primary-400'
              : 'bg-primary-100 text-primary-600'"
          >
            {{ currentUser?.avatar || '?' }}
          </div>

          <!-- 정보 -->
          <div class="flex-1 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">이름</label>
                <div
                  class="px-3 py-2 rounded-lg text-sm"
                  :class="isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-800'"
                >
                  {{ currentUser?.name || '-' }}
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">이메일</label>
                <div
                  class="px-3 py-2 rounded-lg text-sm"
                  :class="isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-800'"
                >
                  {{ currentUser?.email || '-' }}
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">역할</label>
                <div
                  class="px-3 py-2 rounded-lg text-sm"
                  :class="isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-800'"
                >
                  {{ roleLabel(currentUser?.role) }}
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">부서</label>
                <div
                  class="px-3 py-2 rounded-lg text-sm"
                  :class="isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-800'"
                >
                  {{ currentUser?.department || '-' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 알림 탭 -->
    <div v-if="activeTab === 'notifications'">
      <div
        class="rounded-xl border p-6"
        :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
      >
        <h2 class="text-lg font-semibold mb-6" :class="isDark ? 'text-slate-100' : 'text-slate-900'">알림 설정</h2>

        <div class="space-y-4">
          <!-- 이메일 알림 -->
          <div
            class="flex items-center justify-between p-4 rounded-lg"
            :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
          >
            <div>
              <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">이메일 알림</p>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">회의록 요약 및 액션아이템 알림을 이메일로 받습니다</p>
            </div>
            <button
              @click="toggleNotification('email')"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="notifications.email
                ? 'bg-primary-500'
                : (isDark ? 'bg-slate-600' : 'bg-slate-300')"
            >
              <span
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="notifications.email ? 'translate-x-5.5' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>

          <!-- 브라우저 푸시 알림 -->
          <div
            class="flex items-center justify-between p-4 rounded-lg"
            :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
          >
            <div>
              <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">브라우저 푸시 알림</p>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">브라우저에서 실시간 푸시 알림을 받습니다</p>
            </div>
            <button
              @click="toggleNotification('push')"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="notifications.push
                ? 'bg-primary-500'
                : (isDark ? 'bg-slate-600' : 'bg-slate-300')"
            >
              <span
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="notifications.push ? 'translate-x-5.5' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>

          <!-- 액션아이템 리마인더 D-3 -->
          <div
            class="flex items-center justify-between p-4 rounded-lg"
            :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
          >
            <div>
              <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">액션아이템 리마인더 (D-3)</p>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">마감 3일 전에 리마인더 알림을 보냅니다</p>
            </div>
            <button
              @click="toggleNotification('reminderD3')"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="notifications.reminderD3
                ? 'bg-primary-500'
                : (isDark ? 'bg-slate-600' : 'bg-slate-300')"
            >
              <span
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="notifications.reminderD3 ? 'translate-x-5.5' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>

          <!-- 액션아이템 리마인더 D-1 -->
          <div
            class="flex items-center justify-between p-4 rounded-lg"
            :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
          >
            <div>
              <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">액션아이템 리마인더 (D-1)</p>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">마감 1일 전에 리마인더 알림을 보냅니다</p>
            </div>
            <button
              @click="toggleNotification('reminderD1')"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="notifications.reminderD1
                ? 'bg-primary-500'
                : (isDark ? 'bg-slate-600' : 'bg-slate-300')"
            >
              <span
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="notifications.reminderD1 ? 'translate-x-5.5' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>

          <!-- 새 회의록 알림 -->
          <div
            class="flex items-center justify-between p-4 rounded-lg"
            :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'"
          >
            <div>
              <p class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">새 회의록 알림</p>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-slate-500'">새로운 회의록이 생성되면 알림을 받습니다</p>
            </div>
            <button
              @click="toggleNotification('newMeeting')"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="notifications.newMeeting
                ? 'bg-primary-500'
                : (isDark ? 'bg-slate-600' : 'bg-slate-300')"
            >
              <span
                class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                :class="notifications.newMeeting ? 'translate-x-5.5' : 'translate-x-0.5'"
              ></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 연동 탭 -->
    <div v-if="activeTab === 'integrations'">
      <div class="grid grid-cols-2 gap-4">
        <div
          v-for="item in integrations"
          :key="item.id"
          class="rounded-xl border p-5"
          :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
        >
          <!-- 아이콘 영역 -->
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
            :class="item.connected
              ? (isDark ? 'bg-primary-500/20' : 'bg-primary-100')
              : (isDark ? 'bg-slate-700' : 'bg-slate-100')"
          >
            <!-- Calendar -->
            <svg v-if="item.icon === 'calendar'" class="w-5 h-5" :class="item.connected ? 'text-primary-500' : (isDark ? 'text-slate-400' : 'text-slate-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <!-- Chat (Slack) -->
            <svg v-else-if="item.icon === 'chat'" class="w-5 h-5" :class="item.connected ? 'text-primary-500' : (isDark ? 'text-slate-400' : 'text-slate-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <!-- Ticket (Jira) -->
            <svg v-else-if="item.icon === 'ticket'" class="w-5 h-5" :class="item.connected ? 'text-primary-500' : (isDark ? 'text-slate-400' : 'text-slate-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
            <!-- Video (Teams) -->
            <svg v-else-if="item.icon === 'video'" class="w-5 h-5" :class="item.connected ? 'text-primary-500' : (isDark ? 'text-slate-400' : 'text-slate-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <!-- 텍스트 -->
          <h3 class="text-sm font-semibold mb-1" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
            {{ item.name }}
          </h3>
          <p class="text-xs mb-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
            {{ item.description }}
          </p>

          <!-- 버튼 -->
          <button
            @click="toggleIntegration(item)"
            class="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            :class="item.connected
              ? (isDark
                ? 'bg-success-500/15 text-success-500 hover:bg-success-500/25'
                : 'bg-success-50 text-success-600 hover:bg-success-500/20')
              : (isDark
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200')"
          >
            {{ item.connected ? '연결됨' : '연결' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 관리 탭 (admin only) -->
    <div v-if="activeTab === 'admin' && isAdmin">
      <div class="space-y-6">
        <!-- 사용자 관리 -->
        <div
          class="rounded-xl border p-6"
          :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
        >
          <h2 class="text-lg font-semibold mb-4" :class="isDark ? 'text-slate-100' : 'text-slate-900'">사용자 관리</h2>

          <div class="overflow-hidden rounded-lg border" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
            <table class="w-full">
              <thead>
                <tr :class="isDark ? 'bg-slate-700/50' : 'bg-slate-50'">
                  <th class="text-left text-xs font-semibold px-4 py-3" :class="isDark ? 'text-slate-300' : 'text-slate-600'">이름</th>
                  <th class="text-left text-xs font-semibold px-4 py-3" :class="isDark ? 'text-slate-300' : 'text-slate-600'">이메일</th>
                  <th class="text-left text-xs font-semibold px-4 py-3" :class="isDark ? 'text-slate-300' : 'text-slate-600'">역할</th>
                  <th class="text-right text-xs font-semibold px-4 py-3" :class="isDark ? 'text-slate-300' : 'text-slate-600'">작업</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="user in mockUsers"
                  :key="user.id"
                  class="border-t"
                  :class="isDark ? 'border-slate-700' : 'border-slate-200'"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <div
                        class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        :class="isDark ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-100 text-primary-600'"
                      >
                        {{ user.avatar }}
                      </div>
                      <span class="text-sm font-medium" :class="isDark ? 'text-slate-200' : 'text-slate-800'">{{ user.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-600'">{{ user.email }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="user.role === 'admin'
                        ? (isDark ? 'bg-danger-500/20 text-danger-500' : 'bg-danger-500/15 text-danger-500')
                        : user.role === 'manager'
                          ? (isDark ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-500/15 text-primary-600')
                          : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')"
                    >
                      {{ roleLabel(user.role) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      class="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      :class="isDark
                        ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
                    >
                      편집
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 데이터 보존 설정 -->
        <div
          class="rounded-xl border p-6"
          :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
        >
          <h2 class="text-lg font-semibold mb-4" :class="isDark ? 'text-slate-100' : 'text-slate-900'">데이터 보존</h2>
          <p class="text-sm mb-4" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
            회의록 및 관련 데이터의 보존 기간을 설정합니다. 보존 기간이 지나면 데이터가 자동으로 삭제됩니다.
          </p>
          <select
            v-model="dataRetention"
            class="px-4 py-2.5 rounded-lg text-sm font-medium border outline-none transition-colors"
            :class="isDark
              ? 'bg-slate-700 border-slate-600 text-slate-200 focus:border-primary-500'
              : 'bg-white border-slate-300 text-slate-800 focus:border-primary-500'"
          >
            <option value="6months">6개월</option>
            <option value="1year">1년</option>
            <option value="2years">2년</option>
            <option value="unlimited">무제한</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
