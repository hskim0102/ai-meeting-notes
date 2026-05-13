<script setup>
import { ref, nextTick, watch } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { chatWithKnowledge } from '../services/api.js'

const { isDark } = useDarkMode()

const props = defineProps({
  selectedDocs: {
    type: Array,
    default: () => [],
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const conversationId = ref('')
const messagesContainer = ref(null)

const quickQuestions = [
  '선택한 회의의 핵심 결정사항은?',
  '주요 액션 아이템 요약',
  '가장 많이 논의된 주제는?',
]

// 패널 열릴 때마다 대화 초기화 (새 문서 선택 시)
watch(() => props.selectedDocs, () => {
  messages.value = []
  conversationId.value = ''
})

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage(text) {
  const question = text || inputText.value.trim()
  if (!question || isLoading.value) return

  // 선택된 문서명을 질문 앞에 컨텍스트로 추가 (첫 메시지만)
  let query = question
  if (messages.value.length === 0 && props.selectedDocs.length > 0) {
    const docNames = props.selectedDocs.map(d => d.name).join(', ')
    query = `[참고 문서: ${docNames}]\n${question}`
  }

  messages.value.push({
    role: 'user',
    content: question,
    timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  })

  inputText.value = ''
  isLoading.value = true
  await scrollToBottom()

  try {
    const result = await chatWithKnowledge(query, conversationId.value)
    const answer = result.data?.answer || '응답을 받지 못했습니다.'

    // 대화 세션 유지
    if (result.data?.conversation_id) {
      conversationId.value = result.data.conversation_id
    }

    messages.value.push({
      role: 'ai',
      content: answer,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    })
  } catch (err) {
    messages.value.push({
      role: 'ai',
      content: `오류: ${err.message}`,
      error: true,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <!-- 오버레이 -->
  <Transition name="sidebar-overlay">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/30 z-40"
      @click="emit('close')"
    />
  </Transition>

  <!-- 채팅 슬라이드 패널 -->
  <Transition name="chat-panel">
    <div
      v-if="isOpen"
      class="fixed top-0 right-0 h-full w-[380px] z-50 flex flex-col border-l shadow-2xl"
      :class="isDark
        ? 'bg-zinc-900 border-zinc-800 shadow-black/40'
        : 'bg-white border-slate-200 shadow-slate-300/40'"
    >
      <!-- 헤더 -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b shrink-0"
        :class="isDark ? 'border-zinc-800' : 'border-slate-200'"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-primary-500/15 text-primary-400' : 'bg-primary-50 text-primary-600'"
          >
            <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zm8.446-7.189L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
              AI 채팅 에이전트
            </h3>
            <p class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
              {{ selectedDocs.length }}개 문서 선택됨
            </p>
          </div>
        </div>
        <button
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          :class="isDark
            ? 'text-slate-400 hover:bg-zinc-800 hover:text-slate-200'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'"
          @click="emit('close')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 선택된 문서 목록 -->
      <div
        v-if="selectedDocs.length > 0"
        class="px-4 py-2 border-b flex flex-wrap gap-1 shrink-0"
        :class="isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-slate-100 bg-slate-50'"
      >
        <span
          v-for="doc in selectedDocs"
          :key="doc.id"
          class="text-[10px] px-2 py-0.5 rounded-full truncate max-w-[160px]"
          :class="isDark ? 'bg-zinc-800 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'"
          :title="doc.name"
        >
          {{ doc.name }}
        </span>
      </div>

      <!-- 메시지 영역 -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        <!-- 초기 안내 -->
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full py-6">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            :class="isDark ? 'bg-zinc-800 text-slate-400' : 'bg-slate-100 text-slate-400'"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p class="text-sm font-medium mb-1" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
            선택한 회의록에 대해 질문하세요
          </p>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
            아래 빠른 질문을 클릭하거나 직접 입력하세요
          </p>
        </div>

        <!-- 메시지 목록 -->
        <template v-for="(msg, i) in messages" :key="i">
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[80%]">
              <div
                class="px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm"
                :class="isDark ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white'"
              >
                {{ msg.content }}
              </div>
              <p class="text-[10px] mt-1 text-right" :class="isDark ? 'text-slate-600' : 'text-slate-300'">
                {{ msg.timestamp }}
              </p>
            </div>
          </div>
          <div v-else class="flex justify-start">
            <div class="max-w-[85%]">
              <div
                class="px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm whitespace-pre-line"
                :class="msg.error
                  ? (isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700')
                  : (isDark ? 'bg-zinc-800 text-slate-200' : 'bg-slate-100 text-slate-800')"
              >
                {{ msg.content }}
              </div>
              <p class="text-[10px] mt-1" :class="isDark ? 'text-slate-600' : 'text-slate-300'">
                {{ msg.timestamp }}
              </p>
            </div>
          </div>
        </template>

        <!-- 로딩 인디케이터 -->
        <div v-if="isLoading" class="flex justify-start">
          <div
            class="px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5"
            :class="isDark ? 'bg-zinc-800' : 'bg-slate-100'"
          >
            <span class="w-2 h-2 rounded-full animate-bounce bg-slate-400" style="animation-delay: 0ms;" />
            <span class="w-2 h-2 rounded-full animate-bounce bg-slate-400" style="animation-delay: 150ms;" />
            <span class="w-2 h-2 rounded-full animate-bounce bg-slate-400" style="animation-delay: 300ms;" />
          </div>
        </div>
      </div>

      <!-- 빠른 질문 칩 -->
      <div
        v-if="messages.length === 0"
        class="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0"
      >
        <button
          v-for="q in quickQuestions"
          :key="q"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="isDark
            ? 'border-zinc-700 text-slate-300 hover:bg-zinc-800 hover:border-zinc-600'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'"
          @click="sendMessage(q)"
        >
          {{ q }}
        </button>
      </div>

      <!-- 입력 영역 -->
      <div
        class="px-4 py-3 border-t shrink-0"
        :class="isDark ? 'border-zinc-800' : 'border-slate-200'"
      >
        <div
          class="flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors"
          :class="isDark
            ? 'bg-zinc-950 border-zinc-700 focus-within:border-primary-500'
            : 'bg-slate-50 border-slate-200 focus-within:border-primary-400'"
        >
          <input
            v-model="inputText"
            type="text"
            placeholder="회의 내용에 대해 질문하세요..."
            class="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            :class="isDark ? 'text-slate-100' : 'text-slate-900'"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
            :class="inputText.trim() && !isLoading
              ? (isDark ? 'bg-primary-600 text-white hover:bg-primary-500' : 'bg-primary-500 text-white hover:bg-primary-600')
              : (isDark ? 'text-slate-600' : 'text-slate-300')"
            :disabled="!inputText.trim() || isLoading"
            @click="sendMessage()"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition: transform 0.25s ease-out;
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  transform: translateX(100%);
}
.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
}
</style>
