<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchDifyDatasets, fetchDifyDocuments } from '../services/api.js'

const datasets = ref([])
const selectedDatasetId = ref(null)
const documents = ref([])
const searchQuery = ref('')
const loading = ref(false)
const error = ref(null)

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetchDifyDatasets()
    datasets.value = res.data?.data || []
    if (datasets.value.length > 0) {
      await selectDataset(datasets.value[0].id)
    }
  } catch (err) {
    error.value = err.message
    console.warn('[지식기반 회의목록] 지식 리스트 조회 실패:', err.message)
  } finally {
    loading.value = false
  }
})

async function selectDataset(datasetId) {
  selectedDatasetId.value = datasetId
  documents.value = []
  searchQuery.value = ''
  loading.value = true
  error.value = null
  try {
    const res = await fetchDifyDocuments(datasetId)
    documents.value = res.data?.data || []
  } catch (err) {
    error.value = err.message
    console.warn('[지식기반 회의목록] 문서 리스트 조회 실패:', err.message)
  } finally {
    loading.value = false
  }
}

const selectedDataset = computed(() =>
  datasets.value.find(d => d.id === selectedDatasetId.value) || null
)

const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value
  const query = searchQuery.value.normalize('NFC').toLowerCase()
  return documents.value.filter(doc =>
    doc.name?.normalize('NFC').toLowerCase().includes(query)
  )
})

function formatDate(timestamp) {
  if (!timestamp) return 'dummy'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function statusLabel(doc) {
  if (doc.indexing_status === 'completed') return '완료'
  if (doc.indexing_status === 'indexing') return '인덱싱 중'
  if (doc.indexing_status === 'error') return '오류'
  return doc.indexing_status || 'dummy'
}

function statusClass(doc) {
  if (doc.indexing_status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (doc.indexing_status === 'indexing') return 'bg-blue-100 text-blue-700'
  if (doc.indexing_status === 'error') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-500'
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">회의목록 (지식기반)</h1>
      <p class="text-sm text-slate-500 mt-1">Dify 지식 베이스 내 회의록 목록</p>
    </div>

    <!-- 지식 카테고리 버튼 탭 -->
    <div class="flex items-center gap-2 flex-wrap mb-5">
      <button
        v-for="dataset in datasets"
        :key="dataset.id"
        @click="selectDataset(dataset.id)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="selectedDatasetId === dataset.id
          ? 'bg-primary-500 text-white border-primary-500'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
      >
        {{ dataset.name }}
        <span
          class="ml-1.5 text-xs"
          :class="selectedDatasetId === dataset.id ? 'text-primary-100' : 'text-slate-400'"
        >
          {{ dataset.document_count ?? 'dummy' }}
        </span>
      </button>
      <div v-if="datasets.length === 0 && !loading" class="text-sm text-slate-400">
        지식이 없습니다
      </div>
    </div>

    <!-- 검색 바 -->
    <div class="flex items-center gap-4 mb-5">
      <div class="flex-1 relative">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="회의록 이름으로 검색..."
          class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
      <p class="text-sm text-slate-500 shrink-0">
        {{ selectedDataset?.name || '' }} · 총 {{ filteredDocuments.length }}건
      </p>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="flex justify-center items-center py-20">
      <svg class="animate-spin w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span class="ml-3 text-sm text-slate-500">불러오는 중...</span>
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">
      {{ error }}
    </div>

    <!-- 문서 목록 -->
    <div v-else class="space-y-3">
      <div
        v-for="doc in filteredDocuments"
        :key="doc.id"
        class="bg-white border border-slate-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h3 class="text-sm font-semibold text-slate-800 truncate">{{ doc.name || 'dummy' }}</h3>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400">
              <span>생성일: {{ formatDate(doc.created_at) }}</span>
              <span>단어 수: {{ doc.word_count?.toLocaleString() ?? 'dummy' }}</span>
              <span>토큰: {{ doc.tokens?.toLocaleString() ?? 'dummy' }}</span>
            </div>
          </div>
          <span
            class="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
            :class="statusClass(doc)"
          >
            {{ statusLabel(doc) }}
          </span>
        </div>
      </div>

      <!-- 빈 상태 -->
      <div v-if="filteredDocuments.length === 0" class="text-center py-16 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p class="text-sm">회의록이 없습니다</p>
      </div>
    </div>
  </div>
</template>
