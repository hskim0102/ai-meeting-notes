import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useAuth는 모듈 레벨 싱글톤이므로, 각 시나리오마다 모듈을 리임포트해야 함
// vi.resetModules()로 매 테스트마다 초기화

describe('useAuth - 세션 초기화', () => {
  let localStorageMock
  let sessionStorageMock

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()

    // localStorage 모킹
    localStorageMock = (() => {
      let store = {}
      return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
        clear: () => { store = {} },
      }
    })()
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

    // sessionStorage 모킹
    sessionStorageMock = (() => {
      let store = {}
      return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
        clear: () => { store = {} },
      }
    })()
    Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('localStorage도 sessionStorage도 없으면 미인증', async () => {
    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')
    vi.runAllTimers()
    await sessionReady
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(false)
  })

  it('sessionStorage.session_active 있으면 localStorage 사용자 정보로 인증', async () => {
    sessionStorageMock.setItem('session_active', '1')
    localStorageMock.setItem('auth_token', 'token-abc')
    localStorageMock.setItem('auth_user', JSON.stringify({ id: 1, name: '김철수', role: 'member' }))

    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')
    vi.runAllTimers()
    await sessionReady
    const { isAuthenticated, currentUser } = useAuth()
    expect(isAuthenticated.value).toBe(true)
    expect(currentUser.value.name).toBe('김철수')
  })

  it('localStorage 토큰 있지만 session_active 없고 응답 없으면 auth 초기화', async () => {
    localStorageMock.setItem('auth_token', 'token-abc')
    localStorageMock.setItem('auth_user', JSON.stringify({ id: 1, name: '김철수', role: 'member' }))

    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')
    vi.runAllTimers() // 150ms 타임아웃 실행
    await sessionReady

    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(false)
    expect(localStorageMock.getItem('auth_token')).toBeNull()
    expect(localStorageMock.getItem('auth_user')).toBeNull()
  })

  it('localStorage 토큰 있고 다른 탭이 응답하면 session_active 설정 후 인증', async () => {
    localStorageMock.setItem('auth_token', 'token-abc')
    localStorageMock.setItem('auth_user', JSON.stringify({ id: 1, name: '김철수', role: 'member' }))

    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')

    // 다른 탭의 StorageEvent 응답 시뮬레이션
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'auth_sync_response',
      newValue: '1',
      oldValue: null,
    }))

    await sessionReady
    const { isAuthenticated } = useAuth()
    expect(isAuthenticated.value).toBe(true)
    expect(sessionStorageMock.getItem('session_active')).toBe('1')
  })

  it('login() 후 session_active가 sessionStorage에 설정됨', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: {
          token: 'new-token',
          user: { id: 2, name: '이영희', role: 'member' },
        },
      }),
    })

    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')
    await sessionReady
    const { login } = useAuth()
    await login('test@example.com', 'password')

    expect(sessionStorageMock.getItem('session_active')).toBe('1')
    expect(localStorageMock.getItem('auth_token')).toBe('new-token')
  })

  it('logout() 후 session_active가 sessionStorage에서 삭제됨', async () => {
    sessionStorageMock.setItem('session_active', '1')
    localStorageMock.setItem('auth_token', 'token-abc')
    localStorageMock.setItem('auth_user', JSON.stringify({ id: 1, name: '김철수', role: 'member' }))

    const { useAuth, sessionReady } = await import('../../src/composables/useAuth.js')
    vi.runAllTimers()
    await sessionReady
    const { logout } = useAuth()
    logout()

    expect(sessionStorageMock.getItem('session_active')).toBeNull()
    expect(localStorageMock.getItem('auth_token')).toBeNull()
    expect(localStorageMock.getItem('auth_user')).toBeNull()
  })
})
