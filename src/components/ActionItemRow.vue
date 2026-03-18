<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: Object,
  showMeeting: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle'])

const isOverdue = computed(() => {
  if (props.item.done) return false
  return new Date(props.item.dueDate) < new Date()
})
</script>

<template>
  <div class="flex items-start gap-3 py-3 px-4 hover:bg-slate-50 rounded-lg transition-colors">
    <button
      @click.prevent="emit('toggle', item)"
      class="mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
      :class="item.done ? 'bg-success-500 border-success-500' : 'border-slate-300 hover:border-primary-400'"
    >
      <svg v-if="item.done" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </button>
    <div class="flex-1 min-w-0">
      <p class="text-sm" :class="item.done ? 'text-slate-400 line-through' : 'text-slate-700'">
        {{ item.text }}
      </p>
      <div class="flex items-center gap-2 mt-1">
        <span class="text-xs text-slate-400">{{ item.assignee }}</span>
        <span class="text-slate-300">·</span>
        <span class="text-xs" :class="isOverdue ? 'text-danger-500 font-medium' : 'text-slate-400'">
          {{ item.dueDate }}
        </span>
        <template v-if="showMeeting && item.meetingTitle">
          <span class="text-slate-300">·</span>
          <span class="text-xs text-slate-400 truncate">{{ item.meetingTitle }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
