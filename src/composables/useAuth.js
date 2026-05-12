import { ref, computed } from 'vue'

// 전역 상태 (싱글톤)
// 기존에 토큰 없이 저장된 mock 세션이면 무효화
const stored = JSON.parse(localStorage.getItem('auth_user') || 'null')
const hasToken = !!localStorage.getItem('auth_token')
if (stored && !hasToken) {
  // 이전 mock 데이터 정리
  localStorage.removeItem('auth_user')
}
const currentUser = ref((stored && hasToken) ? stored : null)
const isAuthenticated = computed(() => !!currentUser.value)

// 서버 응답을 안전하게 JSON 파싱
async function safeJson(res) {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
  }
  return res.json()
}

export function useAuth() {
  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await safeJson(res)
    if (!json.success) throw new Error(json.error || '로그인 실패')

    localStorage.setItem('auth_token', json.data.token)
    currentUser.value = { ...json.data.user, loginAt: new Date().toISOString() }
    localStorage.setItem('auth_user', JSON.stringify(currentUser.value))
    return currentUser.value
  }

  async function register(name, email, password, department = '') {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, department }),
    })
    const json = await safeJson(res)
    if (!json.success) throw new Error(json.error || '회원가입 실패')

    localStorage.setItem('auth_token', json.data.token)
    currentUser.value = { ...json.data.user, loginAt: new Date().toISOString() }
    localStorage.setItem('auth_user', JSON.stringify(currentUser.value))
    return currentUser.value
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
  }

  function getToken() {
    return localStorage.getItem('auth_token')
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

  return { currentUser, isAuthenticated, login, register, logout, getToken, isAdmin, isManager, hasPermission }
}
