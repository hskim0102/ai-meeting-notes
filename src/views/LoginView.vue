<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useAuth } from '../composables/useAuth.js'

const { isDark } = useDarkMode()
const router = useRouter()
const { login, mockUsers } = useAuth()

const loading = ref(false)
const error = ref('')

// 소셜 로그인 (데모에서는 첫 번째 사용자로 로그인)
async function socialLogin(provider) {
  loading.value = true
  error.value = ''
  try {
    await login('admin@company.com', provider)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 데모 계정 로그인
async function demoLogin(user) {
  loading.value = true
  error.value = ''
  try {
    await login(user.email, 'demo')
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const roleBadge = (role) => {
  const map = {
    admin: { label: '관리자', light: 'bg-danger-500/15 text-danger-500', dark: 'bg-danger-500/20 text-danger-500' },
    manager: { label: '매니저', light: 'bg-primary-500/15 text-primary-600', dark: 'bg-primary-500/20 text-primary-400' },
    member: { label: '멤버', light: 'bg-slate-200 text-slate-600', dark: 'bg-slate-700 text-slate-300' },
  }
  return map[role] || map.member
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4"
    :class="isDark
      ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900/30'
      : 'bg-gradient-to-br from-primary-50 via-white to-accent-50'"
  >
    <!-- 배경 장식 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl"
        :class="isDark ? 'bg-primary-900/20' : 'bg-primary-200/40'"
      ></div>
      <div
        class="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl"
        :class="isDark ? 'bg-accent-900/20' : 'bg-accent-200/30'"
      ></div>
    </div>

    <!-- 로그인 카드 -->
    <div
      class="relative w-full max-w-md rounded-2xl border p-8 shadow-xl"
      :class="isDark
        ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
        : 'bg-white/90 border-slate-200 backdrop-blur-sm'"
    >
      <!-- 로고 + 타이틀 -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          :class="isDark
            ? 'bg-primary-500/20'
            : 'bg-gradient-to-br from-primary-500 to-accent-500'"
        >
          <svg class="w-7 h-7 text-white" :class="isDark ? 'text-primary-400' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
          NoteFlow
        </h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          기록에서 흐름으로, 회의가 곧 실행이 되다
        </p>
      </div>

      <!-- 에러 메시지 -->
      <div
        v-if="error"
        class="mb-4 p-3 rounded-lg text-sm font-medium bg-danger-500/10 text-danger-500 border border-danger-500/20"
      >
        {{ error }}
      </div>

      <!-- 로딩 오버레이 -->
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
        :class="isDark ? 'bg-slate-800/80' : 'bg-white/80'"
      >
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-600'">로그인 중...</p>
        </div>
      </div>

      <!-- 소셜 로그인 -->
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          소셜 로그인
        </p>
        <div class="flex flex-col gap-3">
          <button
            @click="socialLogin('google')"
            :disabled="loading"
            class="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            :class="isDark
              ? 'bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50'
              : 'bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50'"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" opacity=".8"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity=".7"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity=".6"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity=".9"/>
            </svg>
            Google로 로그인
          </button>
          <button
            @click="socialLogin('microsoft')"
            :disabled="loading"
            class="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            :class="isDark
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50'
              : 'bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50'"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="1" y="1" width="10" height="10" fill="#f25022" opacity=".9"/>
              <rect x="13" y="1" width="10" height="10" fill="#7fba00" opacity=".9"/>
              <rect x="1" y="13" width="10" height="10" fill="#00a4ef" opacity=".9"/>
              <rect x="13" y="13" width="10" height="10" fill="#ffb900" opacity=".9"/>
            </svg>
            Microsoft로 로그인
          </button>
        </div>
      </div>

      <!-- OR 구분선 -->
      <div class="flex items-center gap-4 mb-6">
        <div class="flex-1 h-px" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"></div>
        <span class="text-xs font-medium" :class="isDark ? 'text-slate-500' : 'text-slate-400'">OR</span>
        <div class="flex-1 h-px" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"></div>
      </div>

      <!-- 데모 계정 -->
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          데모 계정으로 로그인
        </p>
        <div class="flex flex-col gap-2">
          <button
            v-for="user in mockUsers"
            :key="user.id"
            @click="demoLogin(user)"
            :disabled="loading"
            class="flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all border"
            :class="isDark
              ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50'"
          >
            <!-- 아바타 -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              :class="isDark
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-primary-100 text-primary-600'"
            >
              {{ user.avatar }}
            </div>
            <!-- 정보 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
                  {{ user.name }}
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  :class="isDark ? roleBadge(user.role).dark : roleBadge(user.role).light"
                >
                  {{ roleBadge(user.role).label }}
                </span>
              </div>
              <p class="text-xs truncate" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
                {{ user.email }}
              </p>
            </div>
            <!-- 화살표 -->
            <svg
              class="w-4 h-4 shrink-0"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
