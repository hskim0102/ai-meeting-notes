import { ref, watch } from 'vue'

const isDark = ref(false)

// 초기화: localStorage → 시스템 설정 순서로 확인
function init() {
  const saved = localStorage.getItem('theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  apply()
}

function apply() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

function toggle() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  apply()
}

// 시스템 테마 변경 감지 (사용자가 수동 설정하지 않은 경우)
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      isDark.value = e.matches
      apply()
    }
  })
  init()
}

export function useDarkMode() {
  return { isDark, toggle }
}
