import { ref, computed } from 'vue'

const isCollapsed = ref(false)
const isMobileOpen = ref(false)

function toggle() {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('sidebar-collapsed', isCollapsed.value ? '1' : '0')
}

function openMobile() {
  isMobileOpen.value = true
}

function closeMobile() {
  isMobileOpen.value = false
}

// 초기값 복원
if (typeof window !== 'undefined') {
  isCollapsed.value = localStorage.getItem('sidebar-collapsed') === '1'
}

export function useSidebar() {
  return { isCollapsed, isMobileOpen, toggle, openMobile, closeMobile }
}
