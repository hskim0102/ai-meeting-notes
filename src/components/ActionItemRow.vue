<script setup>
import { computed, ref } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

const props = defineProps({
  item: Object,
  showMeeting: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle', 'statusChange'])

// 상태 드롭다운 열림 여부
const showStatusDropdown = ref(false)

// 하위 호환성: done 필드만 있는 경우 status로 매핑
const effectiveStatus = computed(() => {
  if (props.item.status) return props.item.status
  return props.item.done ? 'done' : 'pending'
})

// 하위 호환성: priority 필드가 없으면 medium
const effectivePriority = computed(() => {
  return props.item.priority || 'medium'
})

const isDone = computed(() => effectiveStatus.value === 'done')

const isOverdue = computed(() => {
  if (isDone.value) return false
  return new Date(props.item.dueDate) < new Date()
})

// 상태 설정
const statusConfig = {
  pending:       { label: '대기',   color: 'slate' },
  'in-progress': { label: '진행중', color: 'primary' },
  review:        { label: '검토중', color: 'warning' },
  done:          { label: '완료',   color: 'success' },
}

const statusOptions = ['pending', 'in-progress', 'review', 'done']

// 우선순위 설정
const priorityConfig = {
  urgent: { label: '긴급', dotClass: 'bg-danger-500' },
  high:   { label: '높음', dotClass: 'bg-warning-500' },
  medium: { label: '보통', dotClass: 'bg-primary-500' },
  low:    { label: '낮음', dotClass: 'bg-slate-400' },
}

// 상태 변경 핸들러
const changeStatus = (newStatus) => {
  showStatusDropdown.value = false
  // 하위 호환: toggle 이벤트도 함께 emit (done 토글로 변환)
  if (newStatus === 'done' && !isDone.value) {
    emit('toggle', props.item)
  } else if (newStatus !== 'done' && isDone.value) {
    emit('toggle', props.item)
  }
  emit('statusChange', { item: props.item, status: newStatus })
}

// 상태 버튼의 색상 클래스
const statusButtonClasses = computed(() => {
  const s = effectiveStatus.value
  if (s === 'done') return 'bg-success-500 border-success-500'
  if (s === 'in-progress') return 'bg-primary-500 border-primary-500'
  if (s === 'review') return 'bg-warning-500 border-warning-500'
  return isDark.value ? 'border-slate-600 hover:border-primary-400' : 'border-slate-300 hover:border-primary-400'
})

// 드롭다운 바깥 클릭 시 닫기
const closeDropdown = () => {
  showStatusDropdown.value = false
}
</script>

<template>
  <div
    class="flex items-start gap-3 py-3 px-4 rounded-lg transition-colors"
    :class="[
      isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50',
      isOverdue ? (isDark ? 'bg-danger-500/5 border-l-2 border-l-danger-500' : 'bg-danger-50/50 border-l-2 border-l-danger-500') : ''
    ]"
  >
    <!-- 상태 버튼 (드롭다운 트리거) -->
    <div class="relative mt-0.5 shrink-0">
      <button
        @click.prevent="showStatusDropdown = !showStatusDropdown"
        class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        :class="statusButtonClasses"
      >
        <!-- 완료 체크마크 -->
        <svg v-if="effectiveStatus === 'done'" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <!-- 진행중 점 -->
        <span v-else-if="effectiveStatus === 'in-progress'" class="w-2 h-2 rounded-full bg-white"></span>
        <!-- 검토중 점 -->
        <span v-else-if="effectiveStatus === 'review'" class="w-2 h-2 rounded-full bg-white"></span>
      </button>

      <!-- 상태 드롭다운 -->
      <Teleport to="body">
        <div v-if="showStatusDropdown" class="fixed inset-0 z-40" @click="closeDropdown"></div>
      </Teleport>
      <div
        v-if="showStatusDropdown"
        class="absolute left-0 top-7 z-50 w-32 rounded-lg border shadow-lg py-1"
        :class="isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'"
      >
        <button
          v-for="opt in statusOptions"
          :key="opt"
          @click="changeStatus(opt)"
          class="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors"
          :class="[
            effectiveStatus === opt
              ? (isDark ? 'bg-slate-600 text-slate-100' : 'bg-slate-100 text-slate-900')
              : (isDark ? 'text-slate-300 hover:bg-slate-600' : 'text-slate-600 hover:bg-slate-50')
          ]"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="{
              'bg-slate-400': opt === 'pending',
              'bg-primary-500': opt === 'in-progress',
              'bg-warning-500': opt === 'review',
              'bg-success-500': opt === 'done',
            }"
          ></span>
          {{ statusConfig[opt].label }}
        </button>
      </div>
    </div>

    <!-- 우선순위 뱃지 -->
    <span
      class="mt-0.5 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      :class="isDark ? 'bg-slate-700/60' : 'bg-slate-100'"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="priorityConfig[effectivePriority].dotClass"></span>
      <span :class="isDark ? 'text-slate-400' : 'text-slate-500'">{{ priorityConfig[effectivePriority].label }}</span>
    </span>

    <!-- 콘텐츠 -->
    <div class="flex-1 min-w-0">
      <p class="text-sm" :class="isDone
        ? (isDark ? 'text-slate-500 line-through' : 'text-slate-400 line-through')
        : (isDark ? 'text-slate-200' : 'text-slate-700')">
        {{ item.text }}
      </p>
      <div class="flex items-center gap-2 mt-1 flex-wrap">
        <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ item.assignee }}</span>
        <span :class="isDark ? 'text-slate-600' : 'text-slate-300'">&middot;</span>
        <span class="text-xs" :class="isOverdue ? 'text-danger-500 font-medium' : (isDark ? 'text-slate-500' : 'text-slate-400')">
          {{ item.dueDate }}
          <span v-if="isOverdue" class="ml-0.5">(지연)</span>
        </span>
        <span :class="isDark ? 'text-slate-600' : 'text-slate-300'">&middot;</span>
        <!-- 상태 라벨 -->
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          :class="{
            'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400': effectiveStatus === 'pending',
            'bg-primary-50 text-primary-600': effectiveStatus === 'in-progress',
            'bg-warning-50 text-warning-500': effectiveStatus === 'review',
            'bg-success-50 text-success-600': effectiveStatus === 'done',
          }"
        >
          {{ statusConfig[effectiveStatus].label }}
        </span>
        <template v-if="showMeeting && item.meetingTitle">
          <span :class="isDark ? 'text-slate-600' : 'text-slate-300'">&middot;</span>
          <span class="text-xs truncate" :class="isDark ? 'text-slate-500' : 'text-slate-400'">{{ item.meetingTitle }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
