<script setup>
import { ref } from 'vue'
import { transcribeAudio } from '../services/api.js'

const props = defineProps({
  enableDiarization: { type: Boolean, default: false },
})
const emit = defineEmits(['transcribed'])

const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const status = ref('') // 'uploading' | 'processing' | ''

const ACCEPT = '.webm,.mp3,.mp4,.m4a,.wav,.ogg,.flac,.aac,.3gp,.amr,.caf,.wma'

async function handleFile(file) {
  if (!file) return

  error.value = ''
  isUploading.value = true
  status.value = 'uploading'
  uploadProgress.value = 0

  try {
    const result = await transcribeAudio(file, 'ko', (progress) => {
      uploadProgress.value = progress
      if (progress >= 100) {
        status.value = 'processing'
      }
    }, props.enableDiarization)

    if (result.success) {
      emit('transcribed', result.data)
    } else {
      error.value = result.error || '전사 처리에 실패했습니다.'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    isUploading.value = false
    status.value = ''
    uploadProgress.value = 0
  }
}

function onFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) handleFile(file)
  e.target.value = '' // 같은 파일 재선택 허용
}

function onDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) handleFile(file)
}
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 p-6">
    <h3 class="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
      오디오 파일 업로드
    </h3>

    <!-- 업로드 중이 아닐 때: 드래그 앤 드롭 영역 -->
    <div
      v-if="!isUploading"
      class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
      :class="isDragging ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
      @click="$refs.fileInput.click()"
    >
      <svg class="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p class="text-sm text-slate-600 mb-1">
        오디오 파일을 드래그하거나 <span class="text-primary-500 font-medium">클릭하여 선택</span>
      </p>
      <p class="text-xs text-slate-400">webm, mp3, wav, m4a, ogg, flac (최대 500MB)</p>
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPT"
        class="hidden"
        @change="onFileSelect"
      />
    </div>

    <!-- 업로드 중: 진행률 표시 -->
    <div v-else class="border border-slate-200 rounded-lg p-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        <span class="text-sm text-slate-700 font-medium">
          {{ status === 'uploading' ? '파일 업로드 중...' : 'AI가 음성을 분석하고 있습니다...' }}
        </span>
      </div>
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="status === 'processing' ? 'bg-accent-500 animate-pulse w-full' : 'bg-primary-500'"
          :style="status === 'uploading' ? { width: `${uploadProgress}%` } : {}"
        ></div>
      </div>
      <p class="text-xs text-slate-400 mt-2">
        {{ status === 'uploading' ? `${uploadProgress}% 업로드됨` : '대용량 파일은 분할 처리되며 시간이 걸릴 수 있습니다' }}
      </p>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="error" class="mt-3 p-3 bg-danger-50 border border-red-200 rounded-lg">
      <p class="text-sm text-danger-500">{{ error }}</p>
    </div>
  </div>
</template>
