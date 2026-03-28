<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'

const route = useRoute()
const router = useRouter()
const { isDark } = useDarkMode()

const showMore = ref(false)

const tabs = [
  { name: '대시보드', path: '/', icon: 'dashboard' },
  { name: '회의', path: '/meetings', icon: 'meetings' },
  { name: '액션', path: '/action-items', icon: 'actions' },
  { name: '더보기', path: null, icon: 'more' },
]

const moreItems = [
  { name: '검색', path: '/search', icon: 'search' },
  { name: '회의실', path: '/rooms', icon: 'rooms' },
  { name: '분석', path: '/analysis', icon: 'analysis' },
  { name: '리포트', path: '/reports', icon: 'report' },
  { name: '설정', path: '/settings', icon: 'settings' },
]

const isActive = (path) => {
  if (!path) return false
  if (path === '/') return route.path === '/'
  if (path === '/meetings') return route.path.startsWith('/meetings')
  return route.path.startsWith(path)
}

const isMoreActive = computed(() => {
  return moreItems.some(item => route.path.startsWith(item.path))
})

const handleTab = (tab) => {
  if (tab.path === null) {
    showMore.value = !showMore.value
  } else {
    showMore.value = false
    router.push(tab.path)
  }
}

const handleMoreItem = (item) => {
  showMore.value = false
  router.push(item.path)
}
</script>

<template>
  <!-- 모바일 전용 하단 네비게이션 (md 이상에서 숨김) -->
  <div class="md:hidden">
    <!-- 더보기 시트 오버레이 -->
    <transition name="overlay-fade">
      <div
        v-if="showMore"
        class="fixed inset-0 bg-black/40 z-40"
        @click="showMore = false"
      />
    </transition>

    <!-- 더보기 시트 -->
    <transition name="sheet-slide">
      <div
        v-if="showMore"
        class="fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl shadow-2xl border-t"
        :class="isDark
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-slate-200'"
      >
        <div class="p-4">
          <div class="w-10 h-1 rounded-full mx-auto mb-4" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'" />
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="item in moreItems"
              :key="item.path"
              @click="handleMoreItem(item)"
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors"
              :class="[
                isActive(item.path)
                  ? 'bg-primary-500/10 text-primary-500'
                  : isDark
                    ? 'text-slate-300 hover:bg-slate-700'
                    : 'text-slate-600 hover:bg-slate-50'
              ]"
            >
              <!-- 검색 -->
              <svg v-if="item.icon === 'search'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <!-- 회의실 -->
              <svg v-if="item.icon === 'rooms'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
              <!-- 분석 -->
              <svg v-if="item.icon === 'analysis'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              <!-- 리포트 -->
              <svg v-if="item.icon === 'report'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <!-- 설정 -->
              <svg v-if="item.icon === 'settings'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="text-xs font-medium">{{ item.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 하단 탭 바 -->
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t"
      :class="isDark
        ? 'bg-slate-900 border-slate-700'
        : 'bg-white border-slate-200'"
      style="padding-bottom: env(safe-area-inset-bottom, 0px);"
    >
      <button
        v-for="tab in tabs"
        :key="tab.name"
        @click="handleTab(tab)"
        class="flex flex-col items-center gap-0.5 py-2 px-4 transition-colors"
        :class="[
          (tab.path !== null && isActive(tab.path)) || (tab.path === null && (showMore || isMoreActive))
            ? 'text-primary-500'
            : isDark ? 'text-slate-500' : 'text-slate-400'
        ]"
      >
        <!-- 대시보드 -->
        <svg v-if="tab.icon === 'dashboard'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        <!-- 회의 -->
        <svg v-if="tab.icon === 'meetings'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <!-- 액션 -->
        <svg v-if="tab.icon === 'actions'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- 더보기 -->
        <svg v-if="tab.icon === 'more'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
        <span class="text-[10px] font-medium">{{ tab.name }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* 더보기 시트 트랜지션 */
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 오버레이 트랜지션 */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
