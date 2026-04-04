<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDarkMode } from './composables/useDarkMode.js'
import { useSidebar } from './composables/useSidebar.js'
import SidebarNav from './components/SidebarNav.vue'
import CommandPalette from './components/CommandPalette.vue'
import ToastNotification from './components/ToastNotification.vue'
import MobileBottomNav from './components/MobileBottomNav.vue'

const { isDark } = useDarkMode()
const { isCollapsed } = useSidebar()
const route = useRoute()

const isLoginPage = computed(() => route.path === '/login')
</script>

<template>
  <!-- 로그인 페이지: 사이드바 없는 풀스크린 -->
  <div v-if="isLoginPage" :class="isDark ? 'dark bg-slate-900' : 'bg-slate-50'">
    <router-view />
  </div>

  <!-- 메인 앱 레이아웃 -->
  <div v-else class="flex h-screen overflow-hidden" :class="isDark ? 'dark bg-slate-900' : 'bg-slate-50'">
    <SidebarNav />
    <main class="flex-1 overflow-y-auto pb-16 md:pb-0">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </Transition>
      </router-view>
    </main>
    <CommandPalette />
    <MobileBottomNav />
  </div>

  <!-- 전역 토스트 알림 -->
  <ToastNotification />
</template>
