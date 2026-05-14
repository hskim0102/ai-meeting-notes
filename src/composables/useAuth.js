import { ref, computed } from 'vue'

// ── 모듈 레벨 싱글톤 초기화 ──
const stored = JSON.parse(localStorage.getItem('auth_user') || 'null')
const hasToken = !!localStorage.getItem('auth_token')
if (stored && !hasToken) localStorage.removeItem('auth_user')

const currentUser = ref(null) // 세션 확인 전까지 null

// sessionReady: 세션 유효성 확인이 끝나면 resolve되는 Promise
// 라우터 가드에서 await해 인증 상태가 확정된 후 네비게이션 결정
let _resolveSessionReady
let _sessionResolved = false
const sessionReady = new Promise((resolve) => { _resolveSessionReady = resolve })

function _resolveOnce() {
  if (_sessionResolved) return
  _sessionResolved = true
  _resolveSessionReady()
}

function _initSession() {
  // 1) 이미 이 탭에서 세션 마커가 있으면 → 바로 인증
  if (sessionStorage.getItem('session_active')) {
    currentUser.value = (stored && hasToken) ? stored : null
    _resolveOnce()
    return
  }

  // 2) localStorage 자격증명 없으면 → 미인증
  if (!hasToken || !stored) {
    _resolveOnce()
    return
  }

  // 3) localStorage는 있지만 세션 마커 없음 → 새 탭 또는 새 브라우저 세션
  //    다른 탭에 150ms 동안 응답을 기다림
  const onSync = (e) => {
    if (e.key === 'auth_sync_response' && e.newValue === '1') {
      window.removeEventListener('storage', onSync)
      sessionStorage.setItem('session_active', '1')
      currentUser.value = stored
      _resolveOnce()
    }
  }
  window.addEventListener('storage', onSync)
  localStorage.setItem('auth_sync_request', Date.now().toString())

  setTimeout(() => {
    window.removeEventListener('storage', onSync)
    localStorage.removeItem('auth_sync_request')
    if (!sessionStorage.getItem('session_active')) {
      // 응답 없음 → 새 브라우저 세션 → 인증 초기화
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      currentUser.value = null
    }
    _resolveOnce()
  }, 150)
}

_initSession()

// 다른 탭의 동기화 요청에 응답 (이 탭이 활성 세션일 때만)
const _onSyncRequest = (e) => {
  if (e.key === 'auth_sync_request' && e.newValue && sessionStorage.getItem('session_active')) {
    localStorage.setItem('auth_sync_response', '1')
    setTimeout(() => localStorage.removeItem('auth_sync_response'), 100)
  }
}
window.addEventListener('storage', _onSyncRequest)

// ── 서버 응답 안전 파싱 ──
async function safeJson(res) {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
  }
  return res.json()
}

const isAuthenticated = computed(() => !!currentUser.value)

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
    sessionStorage.setItem('session_active', '1')
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
    sessionStorage.setItem('session_active', '1')
    return currentUser.value
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
    sessionStorage.removeItem('session_active')
  }

  function getToken() {
    return localStorage.getItem('auth_token')
  }

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

export { sessionReady }
