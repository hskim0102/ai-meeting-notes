/**
 * transcribe.js - 오디오 전사(STT) API 라우트
 * ─────────────────────────────────────────────────
 * POST /api/transcribe
 *
 * [전체 처리 흐름]
 * 1. 클라이언트에서 오디오 파일 업로드 수신 (multer)
 * 2. 파일 크기 판별 (25MB 기준)
 *    - 25MB 이하: 직접 Whisper API 전송
 *    - 25MB 초과: ffmpeg로 20MB 단위 분할 → 순차 전사 → 병합
 * 3. 트랜스크립트 결과 반환
 * 4. 임시 파일 정리 (업로드 원본 + 분할 청크)
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'

import { splitAudio, needsSplitting, getAudioMetadata } from '../services/audioSplitter.js'
import { transcribeSingleFile, transcribeChunks, mergeTranscripts } from '../services/whisperService.js'
import { mergeWithSpeakers } from '../services/diarizationMerger.js'

// ── ESM 환경에서 __dirname 대체 ──
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// ─────────────────────────────────────────────────
// Multer 설정: 파일 업로드 처리
// ─────────────────────────────────────────────────

// 업로드 파일 저장 경로 및 파일명 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 업로드 디렉토리가 없으면 생성
    const uploadDir = path.join(__dirname, '..', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // 파일명 충돌 방지를 위해 UUID + 원본 확장자 사용
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

// 허용 오디오 MIME 타입 목록
const ALLOWED_MIMETYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',    // .m4a 브라우저 실제 MIME
  'audio/aac',      // .aac, .m4a (AAC 인코딩)
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/3gpp',     // .3gp (Android 녹음)
  'audio/amr',      // .amr (Android 녹음)
  'audio/x-caf',    // .caf (macOS 녹음)
  'audio/x-ms-wma', // .wma
  'video/webm',     // 브라우저 녹음 시 video/webm으로 올 수 있음
  'video/mp4',      // .mp4 오디오 파일
  'video/3gpp',     // .3gp (비디오 MIME으로 올 수 있음)
]

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 최대 500MB (분할 처리하므로 넉넉하게)
  },
  fileFilter: (req, file, cb) => {
    // ── MIME 타입 검증: 오디오 파일만 허용 ──
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다: ${file.mimetype}`), false)
    }
  },
})

// ─────────────────────────────────────────────────
// 임시 파일 정리 유틸리티
// ─────────────────────────────────────────────────

/**
 * 파일 또는 디렉토리를 안전하게 삭제
 * - 오류 발생 시 로그만 남기고 계속 진행 (메인 응답에 영향 없음)
 *
 * @param {string[]} paths - 삭제할 파일/디렉토리 경로 배열
 */
async function cleanupFiles(paths) {
  for (const filePath of paths) {
    try {
      if (!fs.existsSync(filePath)) continue

      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        // 디렉토리: 내부 파일 먼저 삭제 후 디렉토리 제거
        fs.rmSync(filePath, { recursive: true, force: true })
        console.log(`[정리] 디렉토리 삭제: ${filePath}`)
      } else {
        // 파일: 직접 삭제
        fs.unlinkSync(filePath)
        console.log(`[정리] 파일 삭제: ${path.basename(filePath)}`)
      }
    } catch (err) {
      // 삭제 실패해도 서버 동작에는 영향 없음 (로그만 기록)
      console.warn(`[정리 경고] 삭제 실패 (${filePath}): ${err.message}`)
    }
  }
}

// ─────────────────────────────────────────────────
// POST /api/transcribe - 메인 전사 엔드포인트
// ─────────────────────────────────────────────────

router.post('/', upload.single('audio'), async (req, res) => {
  // ── 정리 대상 경로 추적 (finally에서 일괄 삭제) ──
  const cleanupTargets = []

  try {
    // ── 1단계: 업로드 파일 검증 ──
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '오디오 파일이 전송되지 않았습니다. "audio" 필드로 파일을 업로드해주세요.',
      })
    }

    const uploadedFilePath = req.file.path
    cleanupTargets.push(uploadedFilePath) // 원본 파일도 처리 후 삭제 대상

    // ── multer는 originalname을 latin1로 인코딩하므로, UTF-8로 복원 ──
    // 한글 파일명이 깨지는 문제 방지
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const fileSizeMB = (req.file.size / 1024 / 1024).toFixed(2)
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`[업로드] 파일: ${originalName} (${fileSizeMB}MB)`)
    console.log(`[업로드] MIME: ${req.file.mimetype}`)
    console.log(`${'═'.repeat(60)}`)

    // ── 요청 바디에서 언어 옵션 추출 (기본값: 한국어) ──
    const language = req.body.language || 'ko'
    const enableDiarization = req.body.enableDiarization === 'true' || req.body.enableDiarization === true

    let transcript

    // ── 2단계: 파일 크기에 따른 처리 분기 ──
    if (!needsSplitting(uploadedFilePath)) {
      // ────────────────────────────────
      // [경로 A] 25MB 이하: 직접 전사
      // ────────────────────────────────
      console.log('[처리] 경로 A: 파일 크기가 25MB 이하 → 직접 Whisper API 전송')

      const response = await transcribeSingleFile(uploadedFilePath, language)

      transcript = {
        fullText: response.text,
        segments: (response.segments || []).map((seg, i) => ({
          id: i,
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        })),
        totalDuration: response.duration || 0,
        chunkCount: 1,
        errorCount: 0,
      }
    } else {
      // ────────────────────────────────
      // [경로 B] 25MB 초과: 분할 → 순차 전사 → 병합
      // ────────────────────────────────
      console.log('[처리] 경로 B: 파일 크기가 25MB 초과 → 분할 처리 시작')

      // 이 요청 전용 임시 디렉토리 생성 (UUID로 충돌 방지)
      const tempDir = path.join(__dirname, '..', 'temp', uuidv4())
      fs.mkdirSync(tempDir, { recursive: true })
      cleanupTargets.push(tempDir) // 임시 디렉토리도 삭제 대상

      // B-1: ffmpeg로 오디오 분할
      console.log('[분할] ffmpeg 오디오 분할 시작...')
      const chunks = await splitAudio(uploadedFilePath, tempDir)

      // B-2: 분할된 청크를 순차적으로 Whisper API에 전송
      console.log('[전사] 분할된 청크 순차 전사 시작...')
      const chunkResults = await transcribeChunks(chunks, language)

      // B-3: 전사 결과를 시간순으로 병합
      console.log('[병합] 전사 결과 병합 시작...')
      transcript = mergeTranscripts(chunkResults)
    }

    // ── 2.5단계: 화자 분리 (선택 사항) ──
    let diarizeResult = null
    if (enableDiarization) {
      const diarizeUrl = process.env.DIARIZE_SERVICE_URL || 'http://localhost:5000'
      try {
        console.log('[화자 분리] pyannote 서비스 호출 시작...')
        const formData = new FormData()
        const fileBuffer = fs.readFileSync(uploadedFilePath)
        formData.append('file', new Blob([fileBuffer]), originalName)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 300_000) // 5분 타임아웃

        const diarizeRes = await fetch(`${diarizeUrl}/diarize`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (diarizeRes.ok) {
          diarizeResult = await diarizeRes.json()
          console.log(`[화자 분리] 완료: ${diarizeResult.num_speakers}명 감지, ${diarizeResult.segments.length}개 세그먼트`)
          transcript.segments = mergeWithSpeakers(transcript.segments, diarizeResult.segments)
        } else {
          console.warn(`[화자 분리] 서비스 응답 오류 (HTTP ${diarizeRes.status}), 화자 분리 없이 계속 진행`)
        }
      } catch (err) {
        console.warn(`[화자 분리] 실패 (${err.message}), 화자 분리 없이 계속 진행`)
      }
    }

    // ── 3단계: 오디오 메타데이터 추가 ──
    let metadata = {}
    try {
      metadata = await getAudioMetadata(uploadedFilePath)
    } catch {
      // 메타데이터 실패해도 전사 결과에는 영향 없음
    }

    // ── 4단계: 성공 응답 반환 ──
    console.log(`\n[완료] 전사 성공! 총 ${transcript.segments.length}개 세그먼트, ${transcript.fullText.length}자`)
    console.log(`${'═'.repeat(60)}\n`)

    res.json({
      success: true,
      data: {
        // 전체 텍스트 (하나의 문자열)
        fullText: transcript.fullText,

        // 타임스탬프가 포함된 세그먼트 배열
        segments: transcript.segments,

        // 메타 정보
        meta: {
          originalFileName: originalName,
          fileSizeMB: parseFloat(fileSizeMB),
          totalDuration: transcript.totalDuration,
          segmentCount: transcript.segments.length,
          chunkCount: transcript.chunkCount,
          errorCount: transcript.errorCount,
          language,
          audioBitrate: metadata.bitrate || null,
          audioFormat: metadata.format || null,
          diarization: diarizeResult ? {
            numSpeakers: diarizeResult.num_speakers,
            processingTime: diarizeResult.processing_time_sec,
          } : null,
        },
      },
    })
  } catch (error) {
    // ── 에러 응답 ──
    console.error(`[오류] 전사 처리 실패: ${error.message}`)

    // Multer 파일 크기 초과 에러 별도 처리
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: '파일 크기가 500MB를 초과합니다.',
      })
    }

    // OpenAI API 에러 상세 처리
    if (error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'OpenAI API 인증 실패. OPENAI_API_KEY를 확인해주세요.',
      })
    }

    res.status(500).json({
      success: false,
      error: `전사 처리 중 오류가 발생했습니다: ${error.message}`,
    })
  } finally {
    // ── 5단계: 임시 파일 정리 (성공/실패 관계없이 항상 실행) ──
    console.log(`[정리] ${cleanupTargets.length}개 대상 정리 시작...`)
    await cleanupFiles(cleanupTargets)
    console.log('[정리] 임시 파일 정리 완료')
  }
})

// ─────────────────────────────────────────────────
// GET /api/transcribe/health - 헬스체크 엔드포인트
// ─────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY
  res.json({
    status: 'ok',
    service: 'transcribe',
    openaiConfigured: hasApiKey,
    timestamp: new Date().toISOString(),
  })
})

export default router
