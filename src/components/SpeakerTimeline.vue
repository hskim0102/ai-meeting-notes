<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()

const props = defineProps({
  transcript: { type: Array, default: () => [] },
  speakerMap: { type: Object, default: () => ({}) },
  audioSrc: { type: String, default: '' },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['edit-speaker', 'update:text'])

// ── 오디오 플레이어 상태 ──
const audioRef = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)
const activeEntryIdx = ref(-1)

// ── 인라인 편집 상태 ──
const editingIdx = ref(-1)
const editContent = ref('')
const editTextareaRef = ref(null)

// "MM:SS" 또는 "HH:MM:SS" → 초 변환
function timeToSeconds(time) {
  if (!time) return 0
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

// 초 → "MM:SS" 표시
function formatSeconds(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 현재 재생 시간에 맞는 타임라인 항목 인덱스 계산
function findActiveEntry(time) {
  for (let i = props.transcript.length - 1; i >= 0; i--) {
    if (timeToSeconds(props.transcript[i].time) <= time) return i
  }
  return -1
}

// 오디오 이벤트 핸들러
function onTimeUpdate() {
  if (!audioRef.value) return
  currentTime.value = audioRef.value.currentTime
  const idx = findActiveEntry(currentTime.value)
  if (idx !== activeEntryIdx.value) {
    activeEntryIdx.value = idx
    scrollToActive(idx)
  }
}

function onLoadedMetadata() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
  }
}

function onPlay() { isPlaying.value = true }
function onPause() { isPlaying.value = false }
function onEnded() { isPlaying.value = false; activeEntryIdx.value = -1 }

function pauseAudio() {
  if (audioRef.value && isPlaying.value) {
    audioRef.value.pause()
  }
}

function togglePlay() {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
}

// 타임라인 항목 클릭 → 해당 시간으로 이동
function seekToEntry(idx) {
  if (editingIdx.value === idx) return
  if (!audioRef.value || !props.audioSrc) return
  const seconds = timeToSeconds(props.transcript[idx].time)
  audioRef.value.currentTime = seconds
  activeEntryIdx.value = idx
  if (!isPlaying.value) {
    audioRef.value.play()
  }
}

// 프로그레스 바 클릭 → 해당 시간으로 이동
function seekToPosition(e) {
  if (!audioRef.value || !duration.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  audioRef.value.currentTime = ratio * duration.value
}

// 재생 속도 변경
function cycleSpeed() {
  const speeds = [1, 1.25, 1.5, 2, 0.75]
  const idx = speeds.indexOf(playbackRate.value)
  playbackRate.value = speeds[(idx + 1) % speeds.length]
  if (audioRef.value) audioRef.value.playbackRate = playbackRate.value
}

// 활성 항목으로 자동 스크롤
const timelineRef = ref(null)
function scrollToActive(idx) {
  if (idx < 0 || !timelineRef.value || editingIdx.value >= 0) return
  nextTick(() => {
    const el = timelineRef.value.children[idx]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

// ── 인라인 편집 ──
function startEdit(idx) {
  if (!props.editable) return
  editingIdx.value = idx
  editContent.value = props.transcript[idx].text
  pauseAudio()
  nextTick(() => {
    if (editTextareaRef.value) {
      editTextareaRef.value.focus()
      editTextareaRef.value.style.height = 'auto'
      editTextareaRef.value.style.height = editTextareaRef.value.scrollHeight + 'px'
    }
  })
}

function saveEdit() {
  if (editingIdx.value < 0) return
  const trimmed = editContent.value.trim()
  if (trimmed && trimmed !== props.transcript[editingIdx.value].text) {
    emit('update:text', { index: editingIdx.value, text: trimmed })
  }
  editingIdx.value = -1
}

function cancelEdit() {
  editingIdx.value = -1
}

function onEditKeydown(e) {
  if (e.key === 'Escape') {
    cancelEdit()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit()
  }
}

function autoResize(e) {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}

// 프로그레스 퍼센트
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (currentTime.value / duration.value) * 100
})

// 화자 ID를 표시 이름으로 변환 (speakerMap 우선, 없으면 SPEAKER_XX → 화자XX)
const getSpeakerDisplayName = (speakerId) => {
  if (!speakerId) return speakerId
  if (props.speakerMap[speakerId]) return props.speakerMap[speakerId]
  return speakerId.replace(/^SPEAKER_0*(\d+)$/, (_, n) => `화자${parseInt(n) + 1}`)
}

// 화자 색상 팔레트 (등장 순서대로 할당)
const speakerColors = ['primary-500', 'success-500', 'warning-500', 'danger-500', 'purple-500']

// 화자별 색상 매핑 (등장 순서 기준)
const speakerColorMap = computed(() => {
  const map = {}
  let colorIdx = 0
  for (const entry of props.transcript) {
    if (!(entry.speaker in map)) {
      map[entry.speaker] = speakerColors[colorIdx % speakerColors.length]
      colorIdx++
    }
  }
  return map
})

// 고유 화자 목록 (등장 순서)
const speakers = computed(() => {
  return Object.keys(speakerColorMap.value)
})

// 화자 이니셜 (첫 글자)
const getInitials = (name) => {
  return name.charAt(0)
}

// 화자 통계
const speakerStats = computed(() => {
  const counts = {}
  for (const entry of props.transcript) {
    counts[entry.speaker] = (counts[entry.speaker] || 0) + 1
  }
  const total = props.transcript.length || 1
  return speakers.value.map((speaker) => ({
    speaker,
    count: counts[speaker] || 0,
    percentage: Math.round(((counts[speaker] || 0) / total) * 100),
    color: speakerColorMap.value[speaker],
  }))
})

// 아바타 배경색 클래스
const avatarBgClass = (color) => {
  const map = {
    'primary-500': 'bg-primary-500',
    'success-500': 'bg-success-500',
    'warning-500': 'bg-warning-500',
    'danger-500': 'bg-danger-500',
    'purple-500': 'bg-purple-500',
  }
  return map[color] || 'bg-slate-500'
}

// 통계 바 배경색 클래스
const barBgClass = (color) => {
  return avatarBgClass(color)
}

// 범례 도트 클래스
const legendDotClass = (color) => {
  return avatarBgClass(color)
}

// 말풍선 배경색 클래스
const bubbleClass = (color) => {
  if (isDark.value) {
    const map = {
      'primary-500': 'bg-primary-500/10 border-primary-500/20',
      'success-500': 'bg-success-500/10 border-success-500/20',
      'warning-500': 'bg-warning-500/10 border-warning-500/20',
      'danger-500': 'bg-danger-500/10 border-danger-500/20',
      'purple-500': 'bg-purple-500/10 border-purple-500/20',
    }
    return map[color] || 'bg-slate-700 border-slate-600'
  }
  const map = {
    'primary-500': 'bg-primary-50 border-primary-100',
    'success-500': 'bg-success-50 border-success-100',
    'warning-500': 'bg-warning-50 border-warning-100',
    'danger-500': 'bg-danger-50 border-danger-100',
    'purple-500': 'bg-purple-50 border-purple-100',
  }
  return map[color] || 'bg-slate-50 border-slate-200'
}

// 활성 말풍선 강조 클래스
const activeBubbleClass = (color) => {
  if (isDark.value) {
    const map = {
      'primary-500': 'bg-primary-500/25 border-primary-500/50 ring-1 ring-primary-500/30',
      'success-500': 'bg-success-500/25 border-success-500/50 ring-1 ring-success-500/30',
      'warning-500': 'bg-warning-500/25 border-warning-500/50 ring-1 ring-warning-500/30',
      'danger-500': 'bg-danger-500/25 border-danger-500/50 ring-1 ring-danger-500/30',
      'purple-500': 'bg-purple-500/25 border-purple-500/50 ring-1 ring-purple-500/30',
    }
    return map[color] || 'bg-slate-600 border-slate-500 ring-1 ring-slate-400/30'
  }
  const map = {
    'primary-500': 'bg-primary-100 border-primary-300 ring-1 ring-primary-200',
    'success-500': 'bg-success-100 border-success-300 ring-1 ring-success-200',
    'warning-500': 'bg-warning-100 border-warning-300 ring-1 ring-warning-200',
    'danger-500': 'bg-danger-100 border-danger-300 ring-1 ring-danger-200',
    'purple-500': 'bg-purple-100 border-purple-300 ring-1 ring-purple-200',
  }
  return map[color] || 'bg-slate-100 border-slate-300 ring-1 ring-slate-200'
}
</script>

<template>
  <div
    class="rounded-xl border p-5 transition-all"
    :class="isDark
      ? 'bg-slate-800 border-slate-700'
      : 'bg-white border-slate-200'"
  >
    <!-- 빈 상태 -->
    <div v-if="transcript.length === 0" class="py-8 text-center">
      <svg
        class="w-10 h-10 mx-auto mb-3"
        :class="isDark ? 'text-slate-600' : 'text-slate-300'"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
      <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        발화 기록이 없습니다
      </p>
    </div>

    <template v-else>
      <!-- ── 오디오 플레이어 ── -->
      <div
        v-if="audioSrc"
        class="mb-5 rounded-lg border p-3"
        :class="isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'"
      >
        <audio
          ref="audioRef"
          :src="audioSrc"
          preload="metadata"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        ></audio>

        <div class="flex items-center gap-3">
          <!-- 재생/일시정지 버튼 -->
          <button
            @click="togglePlay"
            class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
            :class="isDark
              ? 'bg-primary-500 hover:bg-primary-400 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white'"
          >
            <svg v-if="!isPlaying" class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>

          <!-- 시간 / 프로그레스 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-xs font-mono shrink-0"
                :class="isDark ? 'text-slate-400' : 'text-slate-500'"
              >
                {{ formatSeconds(currentTime) }}
              </span>

              <div
                class="flex-1 h-1.5 rounded-full cursor-pointer group"
                :class="isDark ? 'bg-slate-700' : 'bg-slate-200'"
                @click="seekToPosition"
              >
                <div
                  class="h-full rounded-full transition-all duration-100 relative"
                  :class="isDark ? 'bg-primary-400' : 'bg-primary-500'"
                  :style="{ width: progressPercent + '%' }"
                >
                  <div
                    class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    :class="isDark ? 'bg-primary-300' : 'bg-primary-600'"
                  ></div>
                </div>
              </div>

              <span
                class="text-xs font-mono shrink-0"
                :class="isDark ? 'text-slate-400' : 'text-slate-500'"
              >
                {{ formatSeconds(duration) }}
              </span>
            </div>
          </div>

          <!-- 재생 속도 -->
          <button
            @click="cycleSpeed"
            class="text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 transition-colors"
            :class="isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
            :title="'재생 속도 변경'"
          >
            {{ playbackRate }}x
          </button>
        </div>
      </div>

      <!-- 화자 범례 -->
      <div class="flex items-center gap-4 mb-5 flex-wrap">
        <span
          class="text-xs font-medium"
          :class="isDark ? 'text-slate-400' : 'text-slate-500'"
        >
          화자:
        </span>
        <div
          v-for="speaker in speakers"
          :key="speaker"
          class="flex items-center gap-1.5"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="legendDotClass(speakerColorMap[speaker])"
          ></span>
          <button
            class="text-xs font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70"
            :class="isDark ? 'text-slate-300' : 'text-slate-600'"
            :title="'클릭하여 이름 변경'"
            @click="emit('edit-speaker', speaker)"
          >
            {{ getSpeakerDisplayName(speaker) }}
          </button>
        </div>
      </div>

      <!-- 타임라인 -->
      <div ref="timelineRef" class="space-y-3 mb-6 max-h-[600px] overflow-y-auto scroll-smooth">
        <div
          v-for="(entry, idx) in transcript"
          :key="idx"
          class="flex items-start gap-3 transition-all duration-200"
          :class="{ 'pl-1': audioSrc && idx === activeEntryIdx && editingIdx !== idx }"
        >
          <!-- 타임스탬프 -->
          <button
            class="text-[11px] font-mono mt-1.5 shrink-0 w-12 text-right transition-colors"
            :class="[
              audioSrc ? 'cursor-pointer hover:text-primary-500' : 'cursor-default',
              idx === activeEntryIdx
                ? 'text-primary-500 font-semibold'
                : isDark ? 'text-slate-500' : 'text-slate-400'
            ]"
            @click="seekToEntry(idx)"
          >
            {{ entry.time }}
          </button>

          <!-- 화자 아바타 -->
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold transition-transform duration-200"
            :class="[
              avatarBgClass(speakerColorMap[entry.speaker]),
              idx === activeEntryIdx && editingIdx !== idx ? 'scale-110' : ''
            ]"
          >
            {{ getInitials(getSpeakerDisplayName(entry.speaker)) }}
          </div>

          <!-- 말풍선 -->
          <div class="flex-1 min-w-0 group/bubble">
            <span
              class="text-xs font-medium mb-0.5 block"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >
              {{ getSpeakerDisplayName(entry.speaker) }}
            </span>

            <!-- ── 편집 모드 ── -->
            <div
              v-if="editingIdx === idx"
              class="rounded-lg border-2 px-3 py-2 transition-all duration-200"
              :class="isDark
                ? 'bg-slate-700 border-amber-500/50 ring-2 ring-amber-500/20'
                : 'bg-white border-amber-400 ring-2 ring-amber-200'"
            >
              <textarea
                ref="editTextareaRef"
                v-model="editContent"
                @keydown="onEditKeydown"
                @input="autoResize"
                rows="2"
                class="w-full text-sm bg-transparent resize-none focus:outline-none leading-relaxed"
                :class="isDark ? 'text-slate-200' : 'text-slate-700'"
              ></textarea>
              <div class="flex items-center justify-between mt-2 pt-2 border-t"
                :class="isDark ? 'border-slate-600' : 'border-slate-200'"
              >
                <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
                  Enter 저장 · Esc 취소
                </span>
                <div class="flex gap-1.5">
                  <button
                    @click="cancelEdit"
                    class="px-2.5 py-1 text-xs rounded-md transition-colors"
                    :class="isDark
                      ? 'text-slate-400 hover:bg-slate-600'
                      : 'text-slate-500 hover:bg-slate-100'"
                  >
                    취소
                  </button>
                  <button
                    @click="saveEdit"
                    class="px-2.5 py-1 text-xs font-medium rounded-md text-white transition-colors bg-primary-500 hover:bg-primary-600"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>

            <!-- ── 표시 모드 ── -->
            <div
              v-else
              class="rounded-lg border px-3 py-2 text-sm transition-all duration-200 relative"
              :class="[
                idx === activeEntryIdx && audioSrc
                  ? activeBubbleClass(speakerColorMap[entry.speaker])
                  : bubbleClass(speakerColorMap[entry.speaker]),
                isDark ? 'text-slate-200' : 'text-slate-700',
                audioSrc ? 'cursor-pointer' : ''
              ]"
              @click="seekToEntry(idx)"
            >
              {{ entry.text }}

              <!-- 호버 시 수정 아이콘 -->
              <button
                v-if="editable"
                @click.stop="startEdit(idx)"
                class="absolute top-1 right-1 p-1 rounded opacity-0 group-hover/bubble:opacity-100 transition-opacity"
                :class="isDark
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'"
                title="수정"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 화자 통계 -->
      <div
        class="border-t pt-4"
        :class="isDark ? 'border-slate-700' : 'border-slate-200'"
      >
        <h4
          class="text-xs font-semibold mb-3"
          :class="isDark ? 'text-slate-300' : 'text-slate-600'"
        >
          발화 통계
        </h4>
        <div class="space-y-2.5">
          <div
            v-for="stat in speakerStats"
            :key="stat.speaker"
            class="flex items-center gap-3"
          >
            <span
              class="text-xs font-medium w-16 shrink-0 truncate"
              :class="isDark ? 'text-slate-400' : 'text-slate-600'"
            >
              {{ getSpeakerDisplayName(stat.speaker) }}
            </span>
            <div
              class="flex-1 h-4 rounded-full overflow-hidden"
              :class="isDark ? 'bg-slate-700' : 'bg-slate-100'"
            >
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="barBgClass(stat.color)"
                :style="{ width: stat.percentage + '%' }"
              ></div>
            </div>
            <span
              class="text-xs font-medium w-10 text-right shrink-0"
              :class="isDark ? 'text-slate-400' : 'text-slate-500'"
            >
              {{ stat.percentage }}%
            </span>
            <span
              class="text-[10px] w-8 text-right shrink-0"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
            >
              {{ stat.count }}회
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
