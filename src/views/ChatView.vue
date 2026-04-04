<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { chatWithSearch } from '../services/api.js'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()
const router = useRouter()

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const chatHistory = ref([])
const messagesContainer = ref(null)

const sendMessage = async () => {
  const question = inputText.value.trim()
  if (!question || isLoading.value) return

  messages.value.push({ role: 'user', content: question })
  inputText.value = ''
  isLoading.value = true

  await nextTick()
  scrollToBottom()

  try {
    const result = await chatWithSearch(question, chatHistory.value)
    const answer = result.data.answer
    const sources = result.data.sources || []

    messages.value.push({ role: 'assistant', content: answer, sources })
    chatHistory.value.push({ role: 'user', content: question })
    chatHistory.value.push({ role: 'assistant', content: answer })
  } catch (err) {
    messages.value.push({ role: 'assistant', content: `오류: ${err.message}`, error: true })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const goToMeeting = (id) => {
  router.push(`/meetings/${id}`)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">AI 회의 챗봇</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">모든 회의록을 대상으로 질문할 수 있습니다</p>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
      <div v-if="messages.length === 0" class="text-center text-slate-400 dark:text-slate-500 mt-20">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
        <p class="text-lg font-medium">무엇이든 물어보세요</p>
        <p class="text-sm mt-2">예: "지난달 마케팅 관련 결정사항은?", "보안 이슈 대응은 어떻게 했나요?"</p>
      </div>

      <div v-for="(msg, i) in messages" :key="i" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
        <div class="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
          :class="msg.role === 'user'
            ? 'bg-primary-600 text-white'
            : msg.error
              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'">
          <p class="whitespace-pre-wrap">{{ msg.content }}</p>
          <div v-if="msg.sources && msg.sources.length > 0" class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">출처:</p>
            <button v-for="src in msg.sources" :key="src.meetingId"
              @click="goToMeeting(src.meetingId)"
              class="text-xs text-primary-600 dark:text-primary-400 hover:underline block">
              {{ src.title }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-500">
          답변을 생성하고 있습니다...
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
      <div class="flex gap-3">
        <input v-model="inputText" @keyup.enter="sendMessage"
          class="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="회의에 대해 질문해보세요..." :disabled="isLoading" />
        <button @click="sendMessage" :disabled="isLoading || !inputText.trim()"
          class="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          전송
        </button>
      </div>
    </div>
  </div>
</template>
