<script setup>
import { computed } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { useNotifications } from '../composables/useNotifications.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'navigate'])

const { isDark } = useDarkMode()
const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function close() {
  isOpen.value = false
}

function handleClick(notification) {
  markAsRead(notification.id)
  emit('navigate', notification.link)
  close()
}

function handleRemove(e, id) {
  e.stopPropagation()
  removeNotification(id)
}

function typeIcon(type) {
  switch (type) {
    case 'action':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'meeting':
      return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    case 'comment':
      return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
    case 'system':
      return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }
}

function typeColor(type) {
  switch (type) {
    case 'action': return isDark.value ? 'text-orange-400' : 'text-orange-500'
    case 'meeting': return isDark.value ? 'text-blue-400' : 'text-blue-500'
    case 'comment': return isDark.value ? 'text-green-400' : 'text-green-500'
    case 'system': return isDark.value ? 'text-purple-400' : 'text-purple-500'
    default: return isDark.value ? 'text-gray-400' : 'text-gray-500'
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- 오버레이 배경 -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50"
      @click="close"
    >
      <!-- 패널 -->
      <div
        class="absolute top-14 right-4 w-96 max-h-[480px] flex flex-col rounded-xl shadow-2xl border overflow-hidden"
        :class="[
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
        ]"
        @click.stop
      >
        <!-- 헤더 -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b"
          :class="isDark ? 'border-gray-700' : 'border-gray-200'"
        >
          <div class="flex items-center gap-2">
            <span
              class="font-semibold text-base"
              :class="isDark ? 'text-white' : 'text-gray-900'"
            >알림</span>
            <span
              v-if="unreadCount > 0"
              class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full"
            >{{ unreadCount }}</span>
          </div>
          <button
            class="text-sm font-medium transition-colors"
            :class="isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'"
            @click="markAllAsRead"
          >모두 읽음</button>
        </div>

        <!-- 알림 목록 -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="notifications.length === 0" class="flex flex-col items-center justify-center py-12">
            <svg class="w-10 h-10 mb-2" :class="isDark ? 'text-gray-600' : 'text-gray-300'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span class="text-sm" :class="isDark ? 'text-gray-500' : 'text-gray-400'">새 알림이 없습니다</span>
          </div>

          <div
            v-for="n in notifications"
            :key="n.id"
            class="group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0"
            :class="[
              isDark
                ? (n.read ? 'border-gray-700 hover:bg-gray-750' : 'bg-gray-750 border-gray-700 hover:bg-gray-700')
                : (n.read ? 'border-gray-100 hover:bg-gray-50' : 'bg-blue-50/50 border-gray-100 hover:bg-blue-50'),
            ]"
            @click="handleClick(n)"
          >
            <!-- 타입 아이콘 -->
            <div class="flex-shrink-0 mt-0.5">
              <svg class="w-5 h-5" :class="typeColor(n.type)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="typeIcon(n.type)" />
              </svg>
            </div>

            <!-- 콘텐츠 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span
                  v-if="!n.read"
                  class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"
                ></span>
                <span
                  class="text-sm truncate"
                  :class="[
                    isDark ? 'text-white' : 'text-gray-900',
                    !n.read ? 'font-semibold' : 'font-medium',
                  ]"
                >{{ n.title }}</span>
              </div>
              <p
                class="text-sm mt-0.5 line-clamp-2"
                :class="isDark ? 'text-gray-400' : 'text-gray-500'"
              >{{ n.message }}</p>
              <span
                class="text-xs mt-1 block"
                :class="isDark ? 'text-gray-500' : 'text-gray-400'"
              >{{ n.time }}</span>
            </div>

            <!-- 삭제 버튼 (hover 시 표시) -->
            <button
              class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md"
              :class="isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-400'"
              @click="handleRemove($event, n.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bg-gray-750 {
  background-color: rgb(42, 48, 60);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
