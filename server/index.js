/**
 * server/index.js - Express 백엔드 서버 진입점
 * ─────────────────────────────────────────────────
 * AI 스마트 회의록 백엔드 서버
 * - 오디오 파일 업로드 및 STT(음성→텍스트) 처리
 * - Vue.js 프론트엔드(포트 3000)와 CORS 연동
 * - localhost 전용 (배포 설정 없음)
 * ─────────────────────────────────────────────────
 */

// ── 환경 변수 로드 (.env 파일) ──
import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import transcribeRouter from './routes/transcribe.js'
import summarizeRouter from './routes/summarize.js'

// ── ESM 환경에서 __dirname 대체 ──
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// ─────────────────────────────────────────────────
// 미들웨어 설정
// ─────────────────────────────────────────────────

// CORS 설정: Vue.js 개발 서버(포트 3000)에서의 요청 허용
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}))

// JSON 요청 본문 파싱 (최대 10MB)
app.use(express.json({ limit: '10mb' }))

// URL-encoded 요청 본문 파싱
app.use(express.urlencoded({ extended: true }))

// ─────────────────────────────────────────────────
// 필수 디렉토리 생성
// ─────────────────────────────────────────────────

// 서버 시작 시 필요한 디렉토리가 없으면 자동 생성
const requiredDirs = [
  path.join(__dirname, 'uploads'), // 업로드된 원본 파일 임시 저장
  path.join(__dirname, 'temp'),    // 분할된 오디오 청크 임시 저장
]

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`[초기화] 디렉토리 생성: ${dir}`)
  }
}

// ─────────────────────────────────────────────────
// API 라우트 등록
// ─────────────────────────────────────────────────

// 오디오 전사(STT) 엔드포인트
app.use('/api/transcribe', transcribeRouter)

// 회의록 AI 요약 엔드포인트
app.use('/api/summarize', summarizeRouter)

// 기본 루트 - 서버 상태 확인
app.get('/api', (req, res) => {
  res.json({
    name: 'AI 스마트 회의록 API',
    version: '1.0.0',
    endpoints: {
      'POST /api/transcribe': '오디오 파일 업로드 및 STT 처리',
      'GET /api/transcribe/health': 'STT 서비스 상태 확인',
      'POST /api/summarize': '회의록 텍스트 AI 요약 (Dify)',
      'GET /api/summarize/health': '요약 서비스 상태 확인',
    },
  })
})

// ─────────────────────────────────────────────────
// 에러 핸들링 미들웨어
// ─────────────────────────────────────────────────

// Multer 에러 처리 (파일 업로드 관련)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: '파일 크기가 제한을 초과했습니다 (최대 500MB).',
    })
  }
  if (err.message && err.message.includes('허용되지 않는 파일 형식')) {
    return res.status(415).json({
      success: false,
      error: err.message,
    })
  }

  // 기타 예상치 못한 에러
  console.error('[서버 에러]', err)
  res.status(500).json({
    success: false,
    error: '서버 내부 오류가 발생했습니다.',
  })
})

// ─────────────────────────────────────────────────
// 서버 시작
// ─────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  AI 스마트 회의록 백엔드 서버')
  console.log('═══════════════════════════════════════════════')
  console.log(`  서버 주소:  http://localhost:${PORT}`)
  console.log(`  API 문서:   http://localhost:${PORT}/api`)
  console.log(`  헬스체크:   http://localhost:${PORT}/api/transcribe/health`)
  console.log(`  OpenAI 키:  ${process.env.OPENAI_API_KEY ? '설정됨 ✓' : '미설정 ✗ (.env 파일 확인)'}`)
  console.log(`  Dify 키:   ${process.env.DIFY_API_KEY ? '설정됨 ✓' : '미설정 ✗ (.env 파일 확인)'}`)
  console.log(`  Dify URL:  ${process.env.DIFY_API_URL || '미설정'}`)
  console.log('═══════════════════════════════════════════════')
  console.log('')
})
