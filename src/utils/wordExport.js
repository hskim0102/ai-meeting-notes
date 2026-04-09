/**
 * wordExport.js - 회의록 MS Word(.doc) 다운로드 유틸리티
 * ─────────────────────────────────────────────────
 * 회의 메타데이터와 AI 요약(마크다운 → HTML) 을 조합하여
 * MS Word 호환 HTML 문서(.doc) 를 생성하고 브라우저에서 다운로드합니다.
 *
 * [기술 메모]
 * - 별도 라이브러리 없이 'application/msword' MIME 으로 Blob 저장
 * - Word 전용 XML 네임스페이스(xmlns:o / xmlns:w) 와 ProgId 메타태그를 포함하여
 *   MS Word 가 HTML 기반 문서로 올바르게 인식하도록 함
 * - 이후 Word 에서 "다른 이름으로 저장" 하면 .docx 로 변환 가능
 * ─────────────────────────────────────────────────
 */

import { marked } from 'marked'

/**
 * 회의록을 Word(.doc) 파일로 다운로드
 *
 * @param {object} meeting - 회의 상세 객체 (aiSummary, keyDecisions, actionItems 등 포함)
 */
export function exportMeetingToWord(meeting) {
  if (!meeting) {
    throw new Error('회의 데이터가 없습니다.')
  }

  // ── 1단계: AI 요약 마크다운 → HTML 변환 ──
  // Dify 워크플로우가 생성한 대기업 스타일 회의록 본문(마크다운)
  marked.setOptions({ gfm: true, breaks: true })
  let aiSummaryHtml = ''
  try {
    aiSummaryHtml = meeting.aiSummary ? marked.parse(meeting.aiSummary) : ''
  } catch (e) {
    console.warn('[wordExport] 마크다운 파싱 실패:', e)
    aiSummaryHtml = `<p>${escapeHtml(meeting.aiSummary || '')}</p>`
  }

  // ── 2단계: 메타데이터 섹션 생성 ──
  const title = escapeHtml(meeting.title || '회의록')
  const date = escapeHtml(meeting.date || '')
  const time = escapeHtml(meeting.time || '')
  const duration = typeof meeting.duration === 'number'
    ? `${meeting.duration}분`
    : (meeting.duration || '')
  const participants = Array.isArray(meeting.participants)
    ? meeting.participants.join(', ')
    : (meeting.participants || '')
  const tags = Array.isArray(meeting.tags) ? meeting.tags.join(', ') : ''

  // ── 3단계: 주요 결정 사항 HTML ──
  const decisionsHtml = Array.isArray(meeting.keyDecisions) && meeting.keyDecisions.length
    ? `
      <h2 class="section-h2">주요 결정 사항</h2>
      <ol class="decisions">
        ${meeting.keyDecisions.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
      </ol>
    `
    : ''

  // ── 4단계: 액션 아이템 표 HTML ──
  const actionItemsHtml = Array.isArray(meeting.actionItems) && meeting.actionItems.length
    ? `
      <h2 class="section-h2">액션 아이템</h2>
      <table class="action-table" border="1" cellspacing="0" cellpadding="6">
        <thead>
          <tr>
            <th style="width:6%">No.</th>
            <th style="width:54%">수행 과제</th>
            <th style="width:18%">담당자</th>
            <th style="width:14%">마감일</th>
            <th style="width:8%">상태</th>
          </tr>
        </thead>
        <tbody>
          ${meeting.actionItems.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(item.text || '')}</td>
              <td>${escapeHtml(item.assignee || '-')}</td>
              <td>${escapeHtml(item.dueDate || '-')}</td>
              <td>${item.done ? '완료' : '진행'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : ''

  // ── 5단계: Word 호환 HTML 문서 생성 ──
  // MS Word 는 아래와 같은 xmlns + ProgId 메타태그가 있는 HTML 을
  // 네이티브 Word 문서처럼 인식합니다.
  const wordDocument = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word 15">
  <meta name="Originator" content="Microsoft Word 15">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 {
      size: 595.3pt 841.9pt;  /* A4 */
      margin: 72pt 72pt 72pt 72pt;  /* 1인치 여백 */
      mso-header-margin: 35.4pt;
      mso-footer-margin: 35.4pt;
      mso-paper-source: 0;
    }
    div.WordSection1 { page: WordSection1; }

    /* ── 기본 타이포그래피 (Word 친화 - 맑은 고딕) ── */
    body {
      font-family: "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #1a1a1a;
    }

    /* ── 문서 헤더 ── */
    h1.doc-title {
      font-size: 22pt;
      font-weight: 700;
      text-align: center;
      margin: 0 0 8pt 0;
      padding-bottom: 8pt;
      border-bottom: 2pt solid #0f172a;
      color: #0f172a;
    }
    p.doc-subtitle {
      font-size: 10pt;
      text-align: center;
      color: #64748b;
      margin: 0 0 18pt 0;
    }

    /* ── 메타데이터 표 ── */
    table.meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 18pt 0;
      font-size: 10.5pt;
    }
    table.meta-table td {
      padding: 6pt 10pt;
      border: 1pt solid #cbd5e1;
    }
    table.meta-table td.label {
      width: 18%;
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }

    /* ── 섹션 헤딩 ── */
    h2.section-h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      margin: 18pt 0 8pt 0;
      padding: 4pt 0 4pt 10pt;
      border-left: 4pt solid #f59e0b;
      background: #fef3c7;
    }

    /* ── AI 요약(마크다운 렌더링) 스타일 ── */
    .ai-summary h1 {
      font-size: 16pt;
      font-weight: 700;
      margin: 12pt 0 6pt 0;
      padding-bottom: 4pt;
      border-bottom: 1pt solid #cbd5e1;
      color: #0f172a;
    }
    .ai-summary h2 {
      font-size: 13pt;
      font-weight: 700;
      margin: 12pt 0 6pt 0;
      padding-left: 8pt;
      border-left: 3pt solid #f59e0b;
      color: #1e293b;
    }
    .ai-summary h3 {
      font-size: 11.5pt;
      font-weight: 700;
      margin: 10pt 0 4pt 0;
      color: #334155;
    }
    .ai-summary h4, .ai-summary h5, .ai-summary h6 {
      font-size: 11pt;
      font-weight: 700;
      margin: 8pt 0 4pt 0;
      color: #475569;
    }
    .ai-summary p {
      margin: 4pt 0;
      color: #334155;
    }
    .ai-summary strong { color: #0f172a; font-weight: 700; }
    .ai-summary ul, .ai-summary ol {
      margin: 4pt 0 8pt 0;
      padding-left: 24pt;
    }
    .ai-summary li { margin: 2pt 0; color: #334155; }

    /* AI 요약 내부 표 */
    .ai-summary table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0;
      font-size: 10pt;
    }
    .ai-summary th, .ai-summary td {
      border: 1pt solid #cbd5e1;
      padding: 4pt 8pt;
      text-align: left;
    }
    .ai-summary th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
    }

    .ai-summary hr {
      border: none;
      border-top: 1pt solid #cbd5e1;
      margin: 12pt 0;
    }
    .ai-summary blockquote {
      margin: 8pt 0;
      padding: 6pt 12pt;
      border-left: 3pt solid #f59e0b;
      background: #fffbeb;
      color: #78350f;
      font-style: italic;
    }
    .ai-summary code {
      font-family: Consolas, "Courier New", monospace;
      background: #f1f5f9;
      padding: 1pt 4pt;
      font-size: 10pt;
      color: #db2777;
    }

    /* ── 결정 사항 리스트 ── */
    ol.decisions {
      margin: 6pt 0 12pt 0;
      padding-left: 24pt;
    }
    ol.decisions li {
      margin: 4pt 0;
      color: #334155;
    }

    /* ── 액션 아이템 표 ── */
    table.action-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6pt 0 12pt 0;
      font-size: 10.5pt;
    }
    table.action-table th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 700;
      padding: 6pt 8pt;
      border: 1pt solid #1e293b;
      text-align: left;
    }
    table.action-table td {
      border: 1pt solid #cbd5e1;
      padding: 6pt 8pt;
      color: #334155;
      vertical-align: top;
    }
    table.action-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* ── 푸터 ── */
    .doc-footer {
      margin-top: 24pt;
      padding-top: 10pt;
      border-top: 1pt solid #cbd5e1;
      font-size: 9pt;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="WordSection1">

    <!-- 문서 헤더 -->
    <h1 class="doc-title">${title}</h1>
    <p class="doc-subtitle">AI 자동 생성 회의록 · ${escapeHtml(new Date().toLocaleDateString('ko-KR'))}</p>

    <!-- 메타데이터 -->
    <table class="meta-table">
      <tr>
        <td class="label">일자</td>
        <td>${date || '-'}</td>
        <td class="label">시간</td>
        <td>${time || '-'}${duration ? ` (${escapeHtml(String(duration))})` : ''}</td>
      </tr>
      <tr>
        <td class="label">참석자</td>
        <td colspan="3">${escapeHtml(participants) || '-'}</td>
      </tr>
      ${tags ? `
      <tr>
        <td class="label">태그</td>
        <td colspan="3">${escapeHtml(tags)}</td>
      </tr>
      ` : ''}
    </table>

    ${aiSummaryHtml ? `
    <h2 class="section-h2">회의록 본문</h2>
    <div class="ai-summary">
      ${aiSummaryHtml}
    </div>
    ` : ''}

    ${decisionsHtml}

    ${actionItemsHtml}

    <div class="doc-footer">
      본 회의록은 AI 가 자동 생성한 문서입니다. 사실 확인 후 사용하시기 바랍니다.
    </div>

  </div>
</body>
</html>
  `.trim()

  // ── 6단계: Blob 생성 및 다운로드 트리거 ──
  // UTF-8 BOM 을 앞에 붙여 Word 가 한글 인코딩을 올바르게 인식하도록 함
  const bom = '\ufeff'
  const blob = new Blob([bom + wordDocument], {
    type: 'application/msword;charset=utf-8',
  })

  const filename = buildFilename(meeting)
  triggerDownload(blob, filename)
}

// ─────────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────────

/**
 * 파일명 생성: "회의록_YYYY-MM-DD_제목.doc"
 * 파일시스템 금지 문자(/ \ : * ? " < > |) 를 언더스코어로 치환
 */
function buildFilename(meeting) {
  const safeTitle = (meeting.title || '회의록').replace(/[\\/:*?"<>|]/g, '_').trim()
  const date = meeting.date || new Date().toISOString().slice(0, 10)
  return `회의록_${date}_${safeTitle}.doc`
}

/**
 * Blob 을 다운로드 트리거
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // 메모리 정리
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * HTML 이스케이프 (사용자 입력 값을 Word HTML 에 안전하게 삽입)
 */
function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
