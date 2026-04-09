<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useSidebar } from '../composables/useSidebar.js'
import { useAuth } from '../composables/useAuth.js'
import { useNotifications } from '../composables/useNotifications.js'
import NotificationPanel from './NotificationPanel.vue'

const route = useRoute()
const router = useRouter()
const { isDark, toggle: toggleDark } = useDarkMode()
const { isCollapsed, isMobileOpen, toggle: toggleSidebar, closeMobile } = useSidebar()
const { currentUser, logout } = useAuth()
const { unreadCount } = useNotifications()

const showNotifications = ref(false)

const handleLogout = () => {
  logout()
  router.push('/login')
}

const navItems = [
  { name: '대시보드', path: '/', icon: 'dashboard', shortcut: '' },
  { name: '새 회의록', path: '/meetings/new', icon: 'mic', shortcut: '⌘N' },
  { name: '녹음 보관함', path: '/recordings', icon: 'recordings', shortcut: '' },
  { name: '회의 목록', path: '/meetings', icon: 'meetings', shortcut: '' },
  { name: '액션 아이템', path: '/action-items', icon: 'actions', shortcut: '' },
  { name: '회의 분석', path: '/analysis', icon: 'analysis', shortcut: '' },
  { name: '리포트', path: '/reports', icon: 'report', shortcut: '' },
  { name: '회의 검색', path: '/search', icon: 'search', shortcut: '⌘K' },
  { name: '회의실 예약', path: '/rooms', icon: 'rooms', shortcut: '' },
  { name: 'AI 챗봇', path: '/chat', icon: 'chat', shortcut: '' },
]

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  if (path === '/meetings/new') return route.path === '/meetings/new'
  if (path === '/recordings') return route.path.startsWith('/recordings')
  if (path === '/meetings') return route.path.startsWith('/meetings') && route.path !== '/meetings/new'
  if (path === '/rooms') return route.path.startsWith('/rooms')
  if (path === '/chat') return route.path === '/chat'
  return route.path.startsWith(path)
}
</script>

<template>
  <!-- 모바일 오버레이 -->
  <Teleport to="body">
    <transition name="sidebar-overlay">
      <div
        v-if="isMobileOpen"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        @click="closeMobile"
      />
    </transition>
  </Teleport>

  <!-- 모바일 햄버거 버튼 -->
  <button
    class="fixed top-4 left-4 z-30 md:hidden p-2 rounded-lg bg-slate-800 text-white shadow-lg"
    @click="isMobileOpen ? closeMobile() : (isMobileOpen = true)"
  >
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  </button>

  <aside
    class="bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-200 z-50"
    :class="[
      isCollapsed ? 'w-16' : 'w-64',
      isMobileOpen ? 'fixed inset-y-0 left-0 w-64' : 'hidden md:flex',
    ]"
  >
    <!-- Logo -->
    <div class="p-4 border-b border-slate-700" :class="isCollapsed && !isMobileOpen ? 'px-3' : 'px-6'">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div v-if="!isCollapsed || isMobileOpen">
          <h1 class="text-base font-bold leading-tight">NoteFlow</h1>
          <p class="text-xs text-slate-400">기록에서 흐름으로</p>
        </div>
      </div>
    </div>

    <!-- 접기/펼치기 토글 (데스크탑) -->
    <button
      class="hidden md:flex items-center justify-center py-2 text-slate-400 hover:text-white transition-colors border-b border-slate-800"
      @click="toggleSidebar"
    >
      <svg class="w-4 h-4 transition-transform" :class="isCollapsed ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>

    <!-- Navigation -->
    <nav class="flex-1 p-2 space-y-1 overflow-y-auto" :class="isCollapsed && !isMobileOpen ? 'px-1.5' : 'px-3'">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group"
        :class="[
          isCollapsed && !isMobileOpen ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive(item.path) ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
        ]"
        @click="closeMobile"
      >
        <!-- Dashboard -->
        <svg v-if="item.icon === 'dashboard'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        <!-- Mic -->
        <svg v-if="item.icon === 'mic'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        <!-- Recordings -->
        <svg v-if="item.icon === 'recordings'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
        <!-- Meetings -->
        <svg v-if="item.icon === 'meetings'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <!-- Actions -->
        <svg v-if="item.icon === 'actions'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- Analysis -->
        <svg v-if="item.icon === 'analysis'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
        <!-- Report -->
        <svg v-if="item.icon === 'report'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <!-- Search -->
        <svg v-if="item.icon === 'search'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <!-- Rooms -->
        <svg v-if="item.icon === 'rooms'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
        <!-- Chat -->
        <svg v-if="item.icon === 'chat'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>

        <!-- 이름 (접힘 모드 제외) -->
        <span v-if="!isCollapsed || isMobileOpen" class="flex-1">{{ item.name }}</span>

        <!-- 단축키 힌트 -->
        <span v-if="item.shortcut && (!isCollapsed || isMobileOpen)" class="text-[10px] text-slate-500 font-mono">{{ item.shortcut }}</span>

        <!-- 접힘 모드 툴팁 -->
        <div
          v-if="isCollapsed && !isMobileOpen"
          class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
        >
          {{ item.name }}
        </div>
      </router-link>
    </nav>

    <!-- 하단 영역 -->
    <div class="border-t border-slate-700 p-2 space-y-0.5" :class="isCollapsed && !isMobileOpen ? 'px-1.5' : 'px-3'">
      <!-- 알림 -->
      <div class="relative">
        <button
          @click="showNotifications = !showNotifications"
          class="flex items-center gap-3 w-full rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          :class="isCollapsed && !isMobileOpen ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'"
        >
          <div class="relative shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {{ unreadCount }}
            </span>
          </div>
          <span v-if="!isCollapsed || isMobileOpen">알림</span>
        </button>
        <NotificationPanel v-model="showNotifications" />
      </div>

      <!-- 설정 -->
      <router-link
        to="/settings"
        class="flex items-center gap-3 w-full rounded-lg text-sm transition-colors"
        :class="[
          isCollapsed && !isMobileOpen ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive('/settings') ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
        ]"
        @click="closeMobile"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span v-if="!isCollapsed || isMobileOpen">설정</span>
      </router-link>

      <!-- 다크 모드 토글 -->
      <button
        @click="toggleDark"
        class="flex items-center gap-3 w-full rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        :class="isCollapsed && !isMobileOpen ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'"
      >
        <svg v-if="isDark" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
        <svg v-else class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
        <span v-if="!isCollapsed || isMobileOpen">{{ isDark ? '라이트 모드' : '다크 모드' }}</span>
      </button>

      <!-- 사용자 프로필 + 로그아웃 -->
      <div
        class="flex items-center gap-3 mt-1 rounded-lg group cursor-pointer hover:bg-slate-800 transition-colors"
        :class="isCollapsed && !isMobileOpen ? 'px-0 py-2 justify-center' : 'px-3 py-2'"
      >
        <div class="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-sm font-bold shrink-0">
          {{ currentUser?.avatar || 'U' }}
        </div>
        <div v-if="!isCollapsed || isMobileOpen" class="flex-1 text-sm min-w-0">
          <p class="font-medium truncate">{{ currentUser?.name || '사용자' }}</p>
          <p class="text-xs text-slate-400 truncate">{{ currentUser?.department || '' }}</p>
        </div>
        <button
          v-if="!isCollapsed || isMobileOpen"
          @click="handleLogout"
          class="text-slate-500 hover:text-danger-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          title="로그아웃"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>
