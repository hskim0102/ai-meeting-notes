import { ref, computed } from 'vue'

// Mock 사용자 데이터
const mockUsers = [
  { id: 1, name: '관리자', email: 'admin@company.com', role: 'admin', avatar: 'A', department: '경영지원' },
  { id: 2, name: '김민수', email: 'minsu@company.com', role: 'manager', avatar: '김', department: '개발팀' },
  { id: 3, name: '이서연', email: 'seoyeon@company.com', role: 'member', avatar: '이', department: '개발팀' },
]

// 전역 상태 (싱글톤) - localStorage에 없으면 기본 관리자로 자동 로그인
const defaultUser = mockUsers[0]
const stored = JSON.parse(localStorage.getItem('auth_user') || 'null')
if (!stored) {
  localStorage.setItem('auth_user', JSON.stringify({ ...defaultUser, provider: 'auto', loginAt: new Date().toISOString() }))
}
const currentUser = ref(JSON.parse(localStorage.getItem('auth_user')))
const isAuthenticated = computed(() => !!currentUser.value)

export function useAuth() {
  // login - simulate OAuth login, accepts email, returns user or throws
  async function login(email, provider = 'google') {
    // simulate network delay
    await new Promise(r => setTimeout(r, 800))
    const user = mockUsers.find(u => u.email === email)
    if (!user) throw new Error('등록되지 않은 사용자입니다')
    currentUser.value = { ...user, provider, loginAt: new Date().toISOString() }
    localStorage.setItem('auth_user', JSON.stringify(currentUser.value))
    return currentUser.value
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('auth_user')
  }

  // RBAC helpers
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const isManager = computed(() => ['admin', 'manager'].includes(currentUser.value?.role))

  function hasPermission(permission) {
    const rolePermissions = {
      admin: ['manage_settings', 'manage_rooms', 'view_all_meetings', 'manage_users', 'view_audit_log'],
      manager: ['view_all_meetings', 'assign_actions', 'view_reports'],
      member: ['view_own_meetings', 'manage_own_actions'],
    }
    return (rolePermissions[currentUser.value?.role] || []).includes(permission)
  }

  return { currentUser, isAuthenticated, login, logout, isAdmin, isManager, hasPermission, mockUsers }
}
