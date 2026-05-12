<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useAuth } from '../composables/useAuth.js'

const { isDark } = useDarkMode()
const router = useRouter()
const { register } = useAuth()

const form = ref({
  name: '',
  email: '',
  password: '',
  passwordConfirm: '',
  department: '',
})
const loading = ref(false)
const error = ref('')

async function handleRegister() {
  error.value = ''

  if (!form.value.name || !form.value.email || !form.value.password) {
    error.value = '이름, 이메일, 비밀번호는 필수입니다'
    return
  }
  if (form.value.password !== form.value.passwordConfirm) {
    error.value = '비밀번호가 일치하지 않습니다'
    return
  }
  if (form.value.password.length < 6) {
    error.value = '비밀번호는 6자 이상이어야 합니다'
    return
  }

  loading.value = true
  try {
    await register(form.value.name, form.value.email, form.value.password, form.value.department)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
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

    <!-- 회원가입 카드 -->
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
          NoteFlow 회원가입
        </h1>
        <p class="text-sm mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          계정을 만들어 회의록을 관리하세요
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
          <p class="text-sm font-medium" :class="isDark ? 'text-slate-300' : 'text-slate-600'">처리 중...</p>
        </div>
      </div>

      <!-- 폼 -->
      <form @submit.prevent="handleRegister" class="flex flex-col gap-4">
        <!-- 이름 -->
        <div>
          <label
            class="block text-xs font-semibold mb-1.5"
            :class="isDark ? 'text-slate-300' : 'text-slate-700'"
          >
            이름 <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="홍길동"
            autocomplete="name"
            class="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-primary-500/30"
            :class="isDark
              ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-primary-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500'"
          />
        </div>

        <!-- 이메일 -->
        <div>
          <label
            class="block text-xs font-semibold mb-1.5"
            :class="isDark ? 'text-slate-300' : 'text-slate-700'"
          >
            이메일 <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="form.email"
            type="email"
            placeholder="name@company.com"
            autocomplete="email"
            class="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-primary-500/30"
            :class="isDark
              ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-primary-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500'"
          />
        </div>

        <!-- 부서 -->
        <div>
          <label
            class="block text-xs font-semibold mb-1.5"
            :class="isDark ? 'text-slate-300' : 'text-slate-700'"
          >
            부서 <span class="text-xs font-normal" :class="isDark ? 'text-slate-500' : 'text-slate-400'">(선택)</span>
          </label>
          <input
            v-model="form.department"
            type="text"
            placeholder="개발팀, 기획팀, 마케팅팀..."
            class="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-primary-500/30"
            :class="isDark
              ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-primary-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500'"
          />
        </div>

        <!-- 비밀번호 -->
        <div>
          <label
            class="block text-xs font-semibold mb-1.5"
            :class="isDark ? 'text-slate-300' : 'text-slate-700'"
          >
            비밀번호 <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="form.password"
            type="password"
            placeholder="6자 이상"
            autocomplete="off"
            class="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-primary-500/30"
            :class="isDark
              ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-primary-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500'"
          />
        </div>

        <!-- 비밀번호 확인 -->
        <div>
          <label
            class="block text-xs font-semibold mb-1.5"
            :class="isDark ? 'text-slate-300' : 'text-slate-700'"
          >
            비밀번호 확인 <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="form.passwordConfirm"
            type="password"
            placeholder="비밀번호 재입력"
            autocomplete="off"
            class="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-primary-500/30"
            :class="[
              isDark
                ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-primary-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500',
              form.passwordConfirm && form.password !== form.passwordConfirm
                ? 'border-danger-500 focus:ring-danger-500/30'
                : ''
            ]"
          />
          <p
            v-if="form.passwordConfirm && form.password !== form.passwordConfirm"
            class="text-xs text-danger-500 mt-1"
          >
            비밀번호가 일치하지 않습니다
          </p>
        </div>

        <!-- 가입 버튼 -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2 disabled:opacity-50"
          :class="isDark
            ? 'bg-primary-600 hover:bg-primary-500 text-white'
            : 'bg-primary-500 hover:bg-primary-600 text-white'"
        >
          회원가입
        </button>
      </form>

      <!-- 로그인 링크 -->
      <p class="text-center text-sm mt-6" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        이미 계정이 있으신가요?
        <router-link
          to="/login"
          class="font-semibold ml-1 hover:underline"
          :class="isDark ? 'text-primary-400' : 'text-primary-600'"
        >
          로그인
        </router-link>
      </p>
    </div>
  </div>
</template>
