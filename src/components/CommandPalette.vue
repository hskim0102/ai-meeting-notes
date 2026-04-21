<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()
const router = useRouter()

const isOpen = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)

// 네비게이션 + 액션 아이템 통합 목록
const commands = [
  { id: 'nav-dashboard', type: 'nav', label: '대시보드', description: '메인 대시보드로 이동', path: '/', icon: 'dashboard' },
  { id: 'nav-new', type: 'nav', label: '새 회의록 작성', description: '녹음 또는 업로드로 새 회의록 생성', path: '/meetings/new', icon: 'mic' },
  { id: 'nav-meetings', type: 'nav', label: '회의 목록', description: '전체 회의 목록 보기', path: '/meetings', icon: 'meetings' },
  { id: 'nav-actions', type: 'nav', label: '액션 아이템', description: '모든 액션 아이템 관리', path: '/action-items', icon: 'actions' },
  { id: 'nav-search', type: 'nav', label: '회의 검색', description: '키워드로 회의 통합 검색', path: '/search', icon: 'search' },
  { id: 'nav-rooms', type: 'nav', label: '회의실 예약', description: '회의실 목록 및 예약', path: '/rooms', icon: 'rooms' },
  { id: 'nav-calendar', type: 'nav', label: '회의실 캘린더', description: '주간 캘린더로 예약 현황 보기', path: '/rooms/calendar', icon: 'calendar' },
  { id: 'nav-knowledge', type: 'nav', label: '회의목록 (지식기반)', description: 'Dify 지식 베이스 기반 회의목록 조회', path: '/knowledge-meetings', icon: 'knowledge' },
]

const filteredCommands = computed(() => {
  if (!query.value.trim()) return commands
  const q = query.value.toLowerCase()
  return commands.filter(c =>
    c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  )
})

watch(filteredCommands, () => {
  selectedIndex.value = 0
})

function open() {
  isOpen.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
}

function execute(cmd) {
  if (cmd.path) {
    router.push(cmd.path)
  }
  close()
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    isOpen.value ? close() : open()
  }
  if (!isOpen.value) return

  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = filteredCommands.value[selectedIndex.value]
    if (cmd) execute(cmd)
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <!-- 오버레이 -->
    <transition name="cmd-overlay">
      <div v-if="isOpen" class="fixed inset-0 bg-black/50 z-[100]" @click="close" />
    </transition>

    <!-- 팔레트 패널 -->
    <transition name="cmd-panel">
      <div v-if="isOpen" class="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh]" @click.self="close">
        <div
          class="w-full max-w-lg rounded-xl shadow-2xl border overflow-hidden"
          :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
        >
          <!-- 검색 입력 -->
          <div class="flex items-center gap-3 px-4 border-b" :class="isDark ? 'border-slate-700' : 'border-slate-200'">
            <svg class="w-5 h-5 shrink-0" :class="isDark ? 'text-slate-400' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="페이지 이동, 기능 검색..."
              class="flex-1 py-3.5 text-sm bg-transparent outline-none"
              :class="isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'"
            />
            <kbd class="text-[10px] px-1.5 py-0.5 rounded font-mono" :class="isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'">ESC</kbd>
          </div>

          <!-- 결과 목록 -->
          <div class="max-h-72 overflow-y-auto py-2">
            <div v-if="filteredCommands.length === 0" class="px-4 py-8 text-center text-sm" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
              검색 결과가 없습니다
            </div>
            <button
              v-for="(cmd, i) in filteredCommands"
              :key="cmd.id"
              @click="execute(cmd)"
              @mouseenter="selectedIndex = i"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
              :class="[
                i === selectedIndex
                  ? (isDark ? 'bg-slate-700' : 'bg-primary-50')
                  : '',
              ]"
            >
              <!-- 아이콘 -->
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="isDark ? 'bg-slate-600' : 'bg-slate-100'">
                <svg v-if="cmd.icon === 'dashboard'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <svg v-else-if="cmd.icon === 'mic'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                <svg v-else-if="cmd.icon === 'meetings' || cmd.icon === 'calendar'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <svg v-else-if="cmd.icon === 'actions'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg v-else-if="cmd.icon === 'search'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <svg v-else-if="cmd.icon === 'rooms'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                </svg>
                <svg v-else-if="cmd.icon === 'knowledge'" class="w-4 h-4" :class="isDark ? 'text-slate-300' : 'text-slate-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <!-- 텍스트 -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium" :class="isDark ? 'text-slate-100' : 'text-slate-900'">{{ cmd.label }}</p>
                <p class="text-xs truncate" :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ cmd.description }}</p>
              </div>
              <!-- 엔터 힌트 -->
              <kbd v-if="i === selectedIndex" class="text-[10px] px-1.5 py-0.5 rounded font-mono" :class="isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-400'">Enter</kbd>
            </button>
          </div>

          <!-- 하단 힌트 -->
          <div class="px-4 py-2 border-t flex items-center gap-4 text-[10px]" :class="isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'">
            <span><kbd class="font-mono px-1 py-0.5 rounded" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">↑↓</kbd> 이동</span>
            <span><kbd class="font-mono px-1 py-0.5 rounded" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">Enter</kbd> 선택</span>
            <span><kbd class="font-mono px-1 py-0.5 rounded" :class="isDark ? 'bg-slate-700' : 'bg-slate-100'">Esc</kbd> 닫기</span>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
