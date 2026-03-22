/**
 * server/routes/search.js - 회의 통합 검색 API
 * ─────────────────────────────────────────────────
 * 프로토타입 단계: 인메모리 회의 데이터 기반 검색
 * 향후 Elasticsearch/DB 전문검색으로 교체 예정
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'

const router = Router()

// ── 인메모리 회의 데이터 (프로토타입용 - mockData와 동일) ──
const meetings = [
  {
    id: 1,
    title: '2026년 1분기 제품 로드맵 리뷰',
    date: '2026-03-13',
    time: '10:00',
    duration: 65,
    participants: ['김민수', '이서연', '박준혁', '정하은'],
    status: 'completed',
    tags: ['제품', '전략'],
    aiSummary: '1분기 목표 달성률 78%로 확인. 모바일 앱 출시를 4월로 조정하기로 결정. AI 추천 기능 우선순위 상향 합의.',
    keyDecisions: ['모바일 앱 베타 출시일을 4월 15일로 확정', 'AI 추천 엔진 개발 우선순위를 P1으로 상향', '사용자 피드백 반영 주기를 2주에서 1주로 단축'],
    actionItems: [
      { text: '모바일 앱 QA 테스트 계획 수립', assignee: '박준혁', dueDate: '2026-03-20', done: false },
      { text: 'AI 추천 엔진 기술 스펙 문서 작성', assignee: '이서연', dueDate: '2026-03-18', done: true },
      { text: '1분기 실적 보고서 최종 정리', assignee: '김민수', dueDate: '2026-03-15', done: false },
    ],
    sentiment: 'positive',
    transcript: [
      { speaker: '김민수', time: '10:00', text: '안녕하세요, 오늘은 1분기 제품 로드맵 리뷰를 진행하겠습니다.' },
      { speaker: '이서연', time: '10:03', text: '현재 1분기 목표 대비 달성률은 78%입니다. 주요 미달 항목은 모바일 앱 출시 지연입니다.' },
      { speaker: '박준혁', time: '10:08', text: '모바일 앱은 현재 QA 단계에 있으며, 4월 중순 출시가 현실적입니다.' },
      { speaker: '정하은', time: '10:15', text: 'AI 추천 기능에 대한 사용자 수요가 크게 증가하고 있어 우선순위 조정이 필요합니다.' },
      { speaker: '김민수', time: '10:22', text: '그렇다면 AI 추천 엔진 개발을 P1으로 올리고, 리소스를 재배치하겠습니다.' },
    ],
  },
  {
    id: 2,
    title: '디자인 시스템 v2 킥오프',
    date: '2026-03-12',
    time: '14:00',
    duration: 45,
    participants: ['최유진', '한도윤', '이서연'],
    status: 'completed',
    tags: ['디자인', 'UI/UX'],
    aiSummary: '디자인 시스템 v2 마이그레이션 계획 논의. Figma 토큰 기반 자동화 도입 합의. 4월 말까지 핵심 컴포넌트 20개 전환 목표.',
    keyDecisions: ['Figma Design Tokens 기반 자동화 파이프라인 구축', '핵심 컴포넌트 20개를 4월 말까지 v2로 전환', '접근성 WCAG 2.1 AA 기준 준수'],
    actionItems: [
      { text: 'Figma 토큰 구조 설계', assignee: '최유진', dueDate: '2026-03-22', done: false },
      { text: '컴포넌트 우선순위 목록 정리', assignee: '한도윤', dueDate: '2026-03-17', done: true },
      { text: '접근성 감사 도구 선정', assignee: '이서연', dueDate: '2026-03-19', done: false },
    ],
    sentiment: 'positive',
    transcript: [],
  },
  {
    id: 3,
    title: '보안 취약점 대응 긴급 회의',
    date: '2026-03-11',
    time: '09:00',
    duration: 30,
    participants: ['강태호', '김민수', '박준혁'],
    status: 'completed',
    tags: ['보안', '긴급'],
    aiSummary: 'API 인증 모듈에서 발견된 토큰 갱신 취약점에 대한 긴급 대응. 24시간 내 핫픽스 배포 결정. 전체 보안 감사 일정 앞당기기로 합의.',
    keyDecisions: ['토큰 갱신 로직 핫픽스 24시간 내 배포', '전체 보안 감사를 3월 말로 앞당김', '보안 이슈 대응 프로세스 재정비'],
    actionItems: [
      { text: '토큰 갱신 핫픽스 개발 및 배포', assignee: '박준혁', dueDate: '2026-03-12', done: true },
      { text: '보안 감사 업체 컨택', assignee: '강태호', dueDate: '2026-03-14', done: false },
      { text: '인시던트 보고서 작성', assignee: '김민수', dueDate: '2026-03-13', done: false },
    ],
    sentiment: 'negative',
    transcript: [],
  },
  {
    id: 4,
    title: '신규 입사자 온보딩 프로세스 개선',
    date: '2026-03-10',
    time: '15:30',
    duration: 50,
    participants: ['정하은', '최유진', '한도윤', '이서연', '강태호'],
    status: 'completed',
    tags: ['HR', '프로세스'],
    aiSummary: '온보딩 기간을 4주에서 3주로 단축하는 개선안 논의. 멘토링 프로그램 도입과 자동화된 환경 설정 도구 개발 합의.',
    keyDecisions: ['온보딩 기간 4주 → 3주 단축', '버디 멘토링 프로그램 도입', '개발 환경 자동 설정 스크립트 개발'],
    actionItems: [
      { text: '개선된 온보딩 체크리스트 작성', assignee: '정하은', dueDate: '2026-03-20', done: false },
      { text: '멘토링 가이드라인 문서 작성', assignee: '최유진', dueDate: '2026-03-25', done: false },
      { text: '환경 설정 자동화 스크립트 개발', assignee: '한도윤', dueDate: '2026-03-28', done: false },
    ],
    sentiment: 'neutral',
    transcript: [],
  },
  {
    id: 5,
    title: '주간 스프린트 회고',
    date: '2026-03-13',
    time: '16:00',
    duration: 40,
    participants: ['김민수', '박준혁', '이서연', '한도윤'],
    status: 'in-progress',
    tags: ['스프린트', '애자일'],
    aiSummary: '',
    keyDecisions: [],
    actionItems: [],
    sentiment: 'neutral',
    transcript: [],
  },
]

// ── 검색 가중치 상수 ──
const WEIGHTS = {
  title: 3.0,
  tags: 2.5,
  aiSummary: 2.0,
  actionItems: 1.5,
  participants: 1.5,
  transcript: 1.0,
}

/**
 * 텍스트 내 검색어 매칭 횟수 반환
 */
function countMatches(text, query) {
  if (!text || !query) return 0
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let count = 0
  let pos = 0
  while ((pos = lower.indexOf(q, pos)) !== -1) {
    count++
    pos += q.length
  }
  return count
}

/**
 * 검색어 주변 스니펫 추출 (전후 40자)
 */
function extractSnippet(text, query, contextLen = 40) {
  if (!text || !query) return null
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null

  const start = Math.max(0, idx - contextLen)
  const end = Math.min(text.length, idx + query.length + contextLen)
  let snippet = ''
  if (start > 0) snippet += '...'
  snippet += text.slice(start, end)
  if (end < text.length) snippet += '...'
  return snippet
}

// ── 통합 검색 API ──
router.get('/', (req, res) => {
  const { q, from, to, participants, tags, sort = 'relevance', page = '1', limit = '20' } = req.query

  if (!q && !from && !to && !participants && !tags) {
    return res.status(400).json({ success: false, error: '검색 조건이 필요합니다. (q, from, to, participants, tags 중 하나 이상)' })
  }

  let results = meetings.map(meeting => {
    let score = 0
    const snippets = []

    // 키워드 검색 (q 파라미터)
    if (q) {
      // 제목 매칭
      const titleMatches = countMatches(meeting.title, q)
      if (titleMatches > 0) {
        score += titleMatches * WEIGHTS.title
        snippets.push({ field: 'title', text: meeting.title })
      }

      // 태그 매칭
      const tagMatch = meeting.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))
      if (tagMatch) {
        score += WEIGHTS.tags
      }

      // AI 요약 매칭
      const summaryMatches = countMatches(meeting.aiSummary, q)
      if (summaryMatches > 0) {
        score += summaryMatches * WEIGHTS.aiSummary
        snippets.push({ field: 'summary', text: extractSnippet(meeting.aiSummary, q) })
      }

      // 액션 아이템 매칭
      for (const item of meeting.actionItems) {
        const itemMatches = countMatches(item.text, q)
        if (itemMatches > 0) {
          score += itemMatches * WEIGHTS.actionItems
          snippets.push({ field: 'actionItem', text: item.text })
        }
      }

      // 참석자 매칭
      const participantMatch = meeting.participants.some(p => p.toLowerCase().includes(q.toLowerCase()))
      if (participantMatch) {
        score += WEIGHTS.participants
      }

      // Transcript 매칭
      for (const seg of meeting.transcript) {
        const segMatches = countMatches(seg.text, q)
        if (segMatches > 0) {
          score += segMatches * WEIGHTS.transcript
          snippets.push({ field: 'transcript', text: extractSnippet(seg.text, q), speaker: seg.speaker, time: seg.time })
        }
      }

      // 핵심 결정사항 매칭
      for (const dec of meeting.keyDecisions) {
        if (countMatches(dec, q) > 0) {
          score += WEIGHTS.aiSummary
          snippets.push({ field: 'keyDecision', text: dec })
        }
      }
    }

    return { ...meeting, score, snippets }
  })

  // 키워드 검색 시 점수 0인 결과 제거
  if (q) {
    results = results.filter(r => r.score > 0)
  }

  // 날짜 범위 필터
  if (from) results = results.filter(r => r.date >= from)
  if (to) results = results.filter(r => r.date <= to)

  // 참석자 필터
  if (participants) {
    const pList = participants.split(',').map(p => p.trim().toLowerCase())
    results = results.filter(r =>
      pList.some(p => r.participants.some(rp => rp.toLowerCase().includes(p)))
    )
  }

  // 태그 필터
  if (tags) {
    const tList = tags.split(',').map(t => t.trim().toLowerCase())
    results = results.filter(r =>
      tList.some(t => r.tags.some(rt => rt.toLowerCase() === t))
    )
  }

  // 정렬
  if (sort === 'relevance') {
    results.sort((a, b) => b.score - a.score)
  } else if (sort === 'newest') {
    results.sort((a, b) => b.date.localeCompare(a.date))
  } else if (sort === 'oldest') {
    results.sort((a, b) => a.date.localeCompare(b.date))
  }

  // 페이지네이션
  const pageNum = parseInt(page, 10)
  const limitNum = parseInt(limit, 10)
  const startIdx = (pageNum - 1) * limitNum
  const paged = results.slice(startIdx, startIdx + limitNum)

  res.json({
    success: true,
    data: {
      results: paged,
      total: results.length,
      page: pageNum,
      totalPages: Math.ceil(results.length / limitNum),
    },
  })
})

// ── 자동완성 제안 API ──
router.get('/suggest', (req, res) => {
  const { q } = req.query
  if (!q || q.length < 1) {
    return res.json({ success: true, data: [] })
  }

  const lower = q.toLowerCase()
  const suggestions = []

  // 회의 제목에서 제안
  for (const m of meetings) {
    if (m.title.toLowerCase().includes(lower)) {
      suggestions.push({ type: 'meeting', text: m.title, id: m.id })
    }
  }

  // 태그에서 제안
  const allTags = [...new Set(meetings.flatMap(m => m.tags))]
  for (const tag of allTags) {
    if (tag.toLowerCase().includes(lower)) {
      suggestions.push({ type: 'tag', text: tag })
    }
  }

  // 참석자에서 제안
  const allParticipants = [...new Set(meetings.flatMap(m => m.participants))]
  for (const p of allParticipants) {
    if (p.toLowerCase().includes(lower)) {
      suggestions.push({ type: 'participant', text: p })
    }
  }

  // 최대 10개
  res.json({ success: true, data: suggestions.slice(0, 10) })
})

export default router
