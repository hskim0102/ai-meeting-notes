<script setup>
import { ref, nextTick } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { chatWithMeeting } from '../services/api.js'

const { isDark } = useDarkMode()

const props = defineProps({
  meetingId: [Number, String],
  transcript: {
    type: Array,
    default: () => [],
  },
  aiSummary: {
    type: String,
    default: '',
  },
})

// 채팅 패널 열기/닫기
const isOpen = ref(false)

// 메시지 목록
const messages = ref([])

// 입력 필드
const inputText = ref('')

// 로딩 상태
const isLoading = ref(false)

// 채팅 히스토리 (API 전달용)
const chatHistory = ref([])

// 메시지 영역 스크롤 ref
const messagesContainer = ref(null)

// 빠른 질문 목록
const quickQuestions = [
  '핵심 결정사항은?',
  '액션 아이템 요약',
  '가장 많이 논의된 주제는?',
]

// 패널 토글
function togglePanel() {
  isOpen.value = !isOpen.value
}

// 메시지 영역 맨 아래로 스크롤
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 메시지 전송
async function sendMessage(text) {
  const question = text || inputText.value.trim()
  if (!question || isLoading.value) return

  // 사용자 메시지 추가
  messages.value.push({
    role: 'user',
    content: question,
    timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  })

  inputText.value = ''
  isLoading.value = true
  await scrollToBottom()

  try {
    const result = await chatWithMeeting(props.meetingId, question, chatHistory.value)
    const answer = result.data?.answer || result.answer || '응답을 받지 못했습니다.'

    messages.value.push({
      role: 'ai',
      content: answer,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    })

    chatHistory.value.push({ role: 'user', content: question })
    chatHistory.value.push({ role: 'assistant', content: answer })
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

// 빠른 질문 클릭
function askQuickQuestion(question) {
  sendMessage(question)
}

// Enter 키 전송
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <!-- 플로팅 채팅 버튼 -->
  <button
    v-if="!isOpen"
    class="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
    :class="isDark
      ? 'bg-primary-600 text-white hover:bg-primary-500 shadow-primary-900/30'
      : 'bg-primary-500 text-white hover:bg-primary-600 shadow-primary-500/30'"
    @click="togglePanel"
  >
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-12.375 0c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9a9.004 9.004 0 01-4.775-1.368l-4.35 1.243 1.243-4.35A8.963 8.963 0 013.375 12z" />
    </svg>
  </button>

  <!-- 채팅 패널 -->
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="opacity-0 translate-y-4 scale-95"
    leave-to-class="opacity-0 translate-y-4 scale-95"
  >
    <div
      v-if="isOpen"
      class="fixed bottom-6 right-6 w-[400px] max-h-[500px] rounded-2xl shadow-2xl border flex flex-col overflow-hidden z-50"
      :class="isDark
        ? 'bg-slate-800 border-slate-700 shadow-black/40'
        : 'bg-white border-slate-200 shadow-slate-300/40'"
    >
      <!-- 헤더 -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b shrink-0"
        :class="isDark ? 'border-slate-700' : 'border-slate-200'"
      >
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center"
            :class="isDark ? 'bg-primary-500/15 text-primary-400' : 'bg-primary-50 text-primary-600'"
          >
            <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zm8.446-7.189L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold" :class="isDark ? 'text-slate-100' : 'text-slate-900'">
            회의 Q&A
          </h3>
        </div>
        <button
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          :class="isDark
            ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'"
          @click="togglePanel"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 메시지 영역 -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style="min-height: 200px; max-height: 340px;"
      >
        <!-- 초기 안내 메시지 -->
        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full py-6">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            :class="isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p class="text-sm font-medium mb-1" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
            회의 내용에 대해 질문하세요
          </p>
          <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
            아래 빠른 질문을 클릭하거나 직접 입력하세요
          </p>
        </div>

        <!-- 메시지 목록 -->
        <template v-for="(msg, i) in messages" :key="i">
          <!-- 사용자 메시지 (오른쪽 정렬) -->
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[80%]">
              <div
                class="px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm"
                :class="isDark
                  ? 'bg-primary-600 text-white'
                  : 'bg-primary-500 text-white'"
              >
                {{ msg.content }}
              </div>
              <p class="text-[10px] mt-1 text-right" :class="isDark ? 'text-slate-600' : 'text-slate-300'">
                {{ msg.timestamp }}
              </p>
            </div>
          </div>

          <!-- AI 응답 (왼쪽 정렬) -->
          <div v-else class="flex justify-start">
            <div class="max-w-[85%]">
              <div
                class="px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm whitespace-pre-line"
                :class="msg.error
                  ? (isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700')
                  : (isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800')"
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
            :class="isDark ? 'bg-slate-700' : 'bg-slate-100'"
          >
            <span
              class="w-2 h-2 rounded-full animate-bounce"
              :class="isDark ? 'bg-slate-400' : 'bg-slate-400'"
              style="animation-delay: 0ms;"
            />
            <span
              class="w-2 h-2 rounded-full animate-bounce"
              :class="isDark ? 'bg-slate-400' : 'bg-slate-400'"
              style="animation-delay: 150ms;"
            />
            <span
              class="w-2 h-2 rounded-full animate-bounce"
              :class="isDark ? 'bg-slate-400' : 'bg-slate-400'"
              style="animation-delay: 300ms;"
            />
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
            ? 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'"
          @click="askQuickQuestion(q)"
        >
          {{ q }}
        </button>
      </div>

      <!-- 입력 영역 -->
      <div
        class="px-4 py-3 border-t shrink-0"
        :class="isDark ? 'border-slate-700' : 'border-slate-200'"
      >
        <div
          class="flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors"
          :class="isDark
            ? 'bg-slate-900 border-slate-600 focus-within:border-primary-500'
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
