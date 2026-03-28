<script>
import { ref } from 'vue'

// 전역 토스트 상태 (컴포넌트 외부에서 공유)
const toasts = ref([])

let toastIdCounter = 0

export function useToast() {
  function showToast({ type = 'info', message = '', undoAction = null, duration = 3000 } = {}) {
    const id = ++toastIdCounter
    const toast = { id, type, message, undoAction, visible: true }
    toasts.value.push(toast)

    // 자동 제거
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, duration)
    }

    return id
  }

  function dismissToast(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      toasts.value[idx].visible = false
      // 애니메이션 후 제거
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 300)
    }
  }

  return { toasts, showToast, dismissToast }
}
</script>

<script setup>
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()
const { toasts, dismissToast } = useToast()

function typeStyles(type) {
  const styles = {
    success: {
      bg: isDark.value ? 'bg-green-900/80 border-green-700' : 'bg-green-50 border-green-200',
      icon: isDark.value ? 'text-green-400' : 'text-green-500',
      text: isDark.value ? 'text-green-200' : 'text-green-800',
    },
    error: {
      bg: isDark.value ? 'bg-red-900/80 border-red-700' : 'bg-red-50 border-red-200',
      icon: isDark.value ? 'text-red-400' : 'text-red-500',
      text: isDark.value ? 'text-red-200' : 'text-red-800',
    },
    warning: {
      bg: isDark.value ? 'bg-yellow-900/80 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
      icon: isDark.value ? 'text-yellow-400' : 'text-yellow-500',
      text: isDark.value ? 'text-yellow-200' : 'text-yellow-800',
    },
    info: {
      bg: isDark.value ? 'bg-blue-900/80 border-blue-700' : 'bg-blue-50 border-blue-200',
      icon: isDark.value ? 'text-blue-400' : 'text-blue-500',
      text: isDark.value ? 'text-blue-200' : 'text-blue-800',
    },
  }
  return styles[type] || styles.info
}

function typeIconPath(type) {
  switch (type) {
    case 'success':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'error':
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'warning':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z'
    case 'info':
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }
}

function handleUndo(toast) {
  if (toast.undoAction) {
    toast.undoAction()
  }
  dismissToast(toast.id)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          v-show="toast.visible"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[320px] max-w-[420px]"
          :class="typeStyles(toast.type).bg"
        >
          <!-- 아이콘 -->
          <svg
            class="w-5 h-5 flex-shrink-0"
            :class="typeStyles(toast.type).icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="typeIconPath(toast.type)"
            />
          </svg>

          <!-- 메시지 -->
          <span
            class="flex-1 text-sm font-medium"
            :class="typeStyles(toast.type).text"
          >{{ toast.message }}</span>

          <!-- 실행취소 버튼 -->
          <button
            v-if="toast.undoAction"
            class="text-xs font-semibold px-2 py-1 rounded transition-colors flex-shrink-0"
            :class="[
              isDark
                ? 'text-blue-400 hover:bg-white/10'
                : 'text-blue-600 hover:bg-blue-100',
            ]"
            @click="handleUndo(toast)"
          >실행취소</button>

          <!-- 닫기 버튼 -->
          <button
            class="flex-shrink-0 p-0.5 rounded transition-colors"
            :class="[
              isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                : 'text-gray-400 hover:text-gray-600 hover:bg-black/5',
            ]"
            @click="dismissToast(toast.id)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
