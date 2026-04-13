<script setup>
import { ref, computed, watch } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'
import { applyTranscriptCorrections } from '../services/api.js'

const { isDark } = useDarkMode()

const props = defineProps({
  keywords: { type: Array, default: () => [] },
  fullText: { type: String, default: '' },
  segments: { type: Array, default: () => [] },
})

const emit = defineEmits(['applied'])

// ── 키워드 편집 상태 ──
// { original: string, current: string, editing: boolean }
const keywordItems = ref([])
const editingIdx = ref(-1)
const editInput = ref('')
const newKeywordInput = ref('')
const isApplying = ref(false)
const applyError = ref('')
const showPreview = ref(false)

// props.keywords 변경 시 초기화
watch(() => props.keywords, (val) => {
  keywordItems.value = val.map(k => ({ original: k, current: k }))
}, { immediate: true })

// 수정된 항목만 추출
const corrections = computed(() => {
  return keywordItems.value
    .filter(k => k.original !== k.current)
    .map(k => ({ original: k.original, corrected: k.current }))
})

const hasCorrections = computed(() => corrections.value.length > 0)

// ── 태그 편집 ──
function startEdit(idx) {
  editingIdx.value = idx
  editInput.value = keywordItems.value[idx].current
}

function confirmEdit(idx) {
  const val = editInput.value.trim()
  if (val && val.length >= 1) {
    keywordItems.value[idx].current = val
  }
  editingIdx.value = -1
}

function cancelEdit() {
  editingIdx.value = -1
}

function revertKeyword(idx) {
  keywordItems.value[idx].current = keywordItems.value[idx].original
}

function removeKeyword(idx) {
  keywordItems.value.splice(idx, 1)
}

function addKeyword() {
  const val = newKeywordInput.value.trim()
  if (val && val.length >= 2) {
    keywordItems.value.push({ original: val, current: val })
    newKeywordInput.value = ''
  }
}

// ── 전체 텍스트 미리보기 (하이라이트) ──
const highlightedPreview = computed(() => {
  if (!corrections.value.length) return escapeHtml(props.fullText)

  let text = escapeHtml(props.fullText)
  // 긴 키워드부터 처리
  const sorted = [...corrections.value].sort((a, b) => b.original.length - a.original.length)

  for (const { original, corrected } of sorted) {
    const escaped = escapeHtml(original)
    const parts = text.split(escaped)
    if (parts.length > 1) {
      text = parts.join(
        `<span class="bg-danger-100 text-danger-600 line-through dark:bg-danger-500/20 dark:text-danger-400">${escaped}</span>` +
        `<span class="bg-success-100 text-success-700 font-medium dark:bg-success-500/20 dark:text-success-400">${escapeHtml(corrected)}</span>`
      )
    }
  }
  return text
})

// 교정 대상 출현 횟수
const matchCounts = computed(() => {
  const counts = {}
  for (const { original } of corrections.value) {
    const parts = props.fullText.split(original)
    counts[original] = parts.length - 1
  }
  return counts
})

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── 일괄 교정 적용 ──
async function applyCorrections() {
  if (!hasCorrections.value) return
  isApplying.value = true
  applyError.value = ''

  try {
    const res = await applyTranscriptCorrections(
      props.fullText,
      props.segments,
      corrections.value,
    )

    if (res.success) {
      emit('applied', res.data)
    }
  } catch (err) {
    applyError.value = err.message
  } finally {
    isApplying.value = false
  }
}
</script>

<template>
  <div
    class="rounded-xl border p-5 transition-all"
    :class="isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'"
  >
    <!-- 헤더 -->
    <h3
      class="text-base font-semibold mb-4 flex items-center gap-2"
      :class="isDark ? 'text-slate-100' : 'text-slate-900'"
    >
      <svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
      AI 추출 키워드
      <span
        class="text-xs font-normal px-2 py-0.5 rounded-full"
        :class="isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'"
      >
        {{ keywordItems.length }}개
      </span>
    </h3>

    <!-- 키워드 태그들 -->
    <div class="flex flex-wrap gap-2 mb-4">
      <div
        v-for="(item, idx) in keywordItems"
        :key="idx"
        class="group relative"
      >
        <!-- 편집 모드 -->
        <div v-if="editingIdx === idx" class="flex items-center">
          <input
            v-model="editInput"
            @keyup.enter="confirmEdit(idx)"
            @keyup.escape="cancelEdit"
            @blur="confirmEdit(idx)"
            ref="editInputRef"
            class="text-sm px-3 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 w-28"
            :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300'"
            autofocus
          />
        </div>

        <!-- 표시 모드 -->
        <button
          v-else
          @click="startEdit(idx)"
          class="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-lg border transition-all cursor-pointer"
          :class="item.original !== item.current
            ? isDark
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
              : 'bg-amber-50 border-amber-200 text-amber-700'
            : isDark
              ? 'bg-primary-500/15 border-primary-500/25 text-primary-300 hover:bg-primary-500/25'
              : 'bg-primary-50 border-primary-100 text-primary-700 hover:bg-primary-100'"
        >
          <span>{{ item.current }}</span>
          <!-- 수정됨 표시 -->
          <span
            v-if="item.original !== item.current"
            class="text-[10px] opacity-60 line-through ml-1"
          >{{ item.original }}</span>
        </button>

        <!-- 호�� 시 버튼들 -->
        <div
          class="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5"
          v-if="editingIdx !== idx"
        >
          <button
            v-if="item.original !== item.current"
            @click.stop="revertKeyword(idx)"
            class="w-4 h-4 rounded-full bg-slate-400 text-white flex items-center justify-center text-[10px] hover:bg-slate-500"
            title="되돌리기"
          >
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button
            @click.stop="removeKeyword(idx)"
            class="w-4 h-4 rounded-full bg-danger-400 text-white flex items-center justify-center text-[10px] hover:bg-danger-500"
            title="삭제"
          >
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 키워드 추가 -->
      <div class="flex items-center gap-1">
        <input
          v-model="newKeywordInput"
          @keyup.enter="addKeyword"
          placeholder="추가..."
          class="text-sm px-2 py-1 rounded-lg border w-20 focus:outline-none focus:ring-1 focus:ring-primary-500"
          :class="isDark ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'border-slate-200 placeholder:text-slate-400'"
        />
        <button
          @click="addKeyword"
          class="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
          :class="isDark
            ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>

    <p class="text-xs mb-4" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
      태그를 클릭하여 잘못 인식된 단어를 교정하세요. 수정된 키워드는 ��체 텍스트에 일괄 반영됩니다.
    </p>

    <!-- 교정 목록 -->
    <div v-if="hasCorrections" class="space-y-3 mb-4">
      <div
        class="rounded-lg border p-3"
        :class="isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-amber-50/50 border-amber-100'"
      >
        <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-slate-300' : 'text-slate-600'">
          교정 항목 ({{ corrections.length }}개)
        </p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="c in corrections"
            :key="c.original"
            class="flex items-center gap-1 text-xs"
          >
            <span
              class="px-2 py-0.5 rounded line-through"
              :class="isDark ? 'bg-danger-500/20 text-danger-400' : 'bg-danger-50 text-danger-600'"
            >{{ c.original }}</span>
            <svg class="w-3 h-3 shrink-0" :class="isDark ? 'text-slate-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span
              class="px-2 py-0.5 rounded font-medium"
              :class="isDark ? 'bg-success-500/20 text-success-400' : 'bg-success-50 text-success-700'"
            >{{ c.corrected }}</span>
            <span
              class="text-[10px] px-1 rounded"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
            >{{ matchCounts[c.original] || 0 }}건</span>
          </div>
        </div>
      </div>

      <!-- 미리보기 토글 -->
      <button
        @click="showPreview = !showPreview"
        class="flex items-center gap-1 text-xs font-medium transition-colors"
        :class="isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'"
      >
        <svg
          class="w-3.5 h-3.5 transition-transform"
          :class="showPreview ? 'rotate-90' : ''"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        변경 미리보기
      </button>

      <!-- 전체 텍스트 미리보기 -->
      <div
        v-if="showPreview"
        class="max-h-48 overflow-y-auto rounded-lg p-3 text-sm leading-relaxed"
        :class="isDark ? 'bg-slate-900/50' : 'bg-slate-50'"
        v-html="highlightedPreview"
      ></div>
    </div>

    <!-- 에러 -->
    <div v-if="applyError" class="mb-3 p-2 rounded-lg bg-danger-50 border border-danger-200">
      <p class="text-xs text-danger-600">{{ applyError }}</p>
    </div>

    <!-- 적용 버튼 -->
    <button
      v-if="hasCorrections"
      @click="applyCorrections"
      :disabled="isApplying"
      class="w-full py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      :class="isApplying
        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
        : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'"
    >
      <div v-if="isApplying" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {{ isApplying ? '교정 적용 중...' : '전체 반영' }}
    </button>
  </div>
</template>
