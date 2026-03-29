/**
 * recordings.js - 녹음 보관 API 라우트
 * ─────────────────────────────────────────────────
 * 녹음 파일을 서버에 영구 저장하고 관리하는 엔드포인트
 *
 * POST   /api/recordings              - 녹음 파일 업로드 저장
 * GET    /api/recordings              - 녹음 목록 조회
 * GET    /api/recordings/:id          - 녹음 상세 정보
 * GET    /api/recordings/:id/file     - 오디오 파일 스트리밍
 * DELETE /api/recordings/:id          - 녹음 삭제
 * POST   /api/recordings/:id/transcribe - 저장된 녹음으로 STT 실행
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { query } from '../services/database.js'
import { transcribeSingleFile, transcribeChunks, mergeTranscripts } from '../services/whisperService.js'
import { splitAudio, needsSplitting, getAudioMetadata } from '../services/audioSplitter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// ─────────────────────────────────────────────────
// 녹음 파일 저장 디렉토리 (월별 하위 디렉토리)
// ─────────────────────────────────────────────────

/**
 * 현재 월 기준 저장 디렉토리 경로 반환 및 생성
 * @returns {string} 저장 디렉토리 경로 (예: server/recordings/2026-03)
 */
function getRecordingsDir() {
  const now = new Date()
  const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const dir = path.join(__dirname, '..', 'recordings', monthDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// ─────────────────────────────────────────────────
// Multer 설정: 녹음 파일 업로드
// ─────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getRecordingsDir())
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm'
    cb(null, `${uuidv4()}${ext}`)
  },
})

const ALLOWED_MIMETYPES = [
  'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/mp4',
  'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav',
  'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/3gpp',
  'audio/amr', 'audio/x-caf', 'audio/x-ms-wma',
  'video/webm', 'video/mp4', 'video/3gpp',
]

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다: ${file.mimetype}`), false)
    }
  },
})

// ─────────────────────────────────────────────────
// POST /api/recordings - 녹음 파일 업로드 저장
// ─────────────────────────────────────────────────

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '오디오 파일이 전송되지 않았습니다.',
      })
    }

    // multer originalname UTF-8 복원
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const duration = parseInt(req.body.duration || '0', 10)

    // DB에 녹음 정보 저장
    const result = await query(
      `INSERT INTO recordings (file_name, file_path, file_size, mime_type, duration, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [originalName, req.file.path, req.file.size, req.file.mimetype, duration]
    )

    const recordingId = result.insertId

    console.log(`[녹음 저장] ID: ${recordingId}, 파일: ${originalName} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`)

    res.status(201).json({
      success: true,
      data: {
        id: recordingId,
        fileName: originalName,
        fileSize: req.file.size,
        duration,
        status: 'pending',
      },
    })
  } catch (error) {
    console.error(`[녹음 저장 오류] ${error.message}`)
    res.status(500).json({
      success: false,
      error: `녹음 저장 실패: ${error.message}`,
    })
  }
})

// ─────────────────────────────────────────────────
// GET /api/recordings - 녹음 목록 조회
// ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status } = req.query

    let sql = 'SELECT id, file_name, file_size, mime_type, duration, status, meeting_id, created_at FROM recordings'
    const params = []

    if (status && ['pending', 'transcribed', 'completed'].includes(status)) {
      sql += ' WHERE status = ?'
      params.push(status)
    }

    sql += ' ORDER BY created_at DESC'

    const rows = await query(sql, params)

    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        duration: row.duration,
        status: row.status,
        meetingId: row.meeting_id,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    console.error(`[녹음 목록 오류] ${error.message}`)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─────────────────────────────────────────────────
// GET /api/recordings/:id - 녹음 상세 정보
// ─────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM recordings WHERE id = ?',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '녹음을 찾을 수 없습니다.' })
    }

    const row = rows[0]
    res.json({
      success: true,
      data: {
        id: row.id,
        fileName: row.file_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        duration: row.duration,
        status: row.status,
        meetingId: row.meeting_id,
        createdAt: row.created_at,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─────────────────────────────────────────────────
// GET /api/recordings/:id/file - 오디오 파일 스트리밍
// ─────────────────────────────────────────────────

router.get('/:id/file', async (req, res) => {
  try {
    const rows = await query(
      'SELECT file_path, mime_type, file_name FROM recordings WHERE id = ?',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '녹음을 찾을 수 없습니다.' })
    }

    const { file_path: filePath, mime_type: mimeType, file_name: fileName } = rows[0]

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '파일이 존재하지 않습니다.' })
    }

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range

    // Range 요청 지원 (오디오 시크 기능)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      })

      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      })

      fs.createReadStream(filePath).pipe(res)
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─────────────────────────────────────────────────
// DELETE /api/recordings/:id - 녹음 삭제
// ─────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const rows = await query(
      'SELECT file_path FROM recordings WHERE id = ?',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '녹음을 찾을 수 없습니다.' })
    }

    // 파일 삭제
    const filePath = rows[0].file_path
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`[녹음 삭제] 파일 삭제: ${filePath}`)
    }

    // DB 레코드 삭제
    await query('DELETE FROM recordings WHERE id = ?', [req.params.id])

    res.json({ success: true, message: '녹음이 삭제되었습니다.' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─────────────────────────────────────────────────
// POST /api/recordings/:id/transcribe - 저장된 녹음으로 STT 실행
// ─────────────────────────────────────────────────

router.post('/:id/transcribe', async (req, res) => {
  const cleanupTargets = []

  try {
    const rows = await query(
      'SELECT * FROM recordings WHERE id = ?',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '녹음을 찾을 수 없습니다.' })
    }

    const recording = rows[0]
    const filePath = recording.file_path

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '녹음 파일이 존재하지 않습니다.' })
    }

    const language = req.body.language || 'ko'
    const fileSizeMB = (recording.file_size / 1024 / 1024).toFixed(2)

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`[녹음 STT] ID: ${recording.id}, 파일: ${recording.file_name} (${fileSizeMB}MB)`)
    console.log(`${'═'.repeat(60)}`)

    let transcript

    if (!needsSplitting(filePath)) {
      console.log('[처리] 직접 Whisper API 전송')
      const response = await transcribeSingleFile(filePath, language)

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
      console.log('[처리] 분할 처리 시작')
      const tempDir = path.join(__dirname, '..', 'temp', uuidv4())
      fs.mkdirSync(tempDir, { recursive: true })
      cleanupTargets.push(tempDir)

      const chunks = await splitAudio(filePath, tempDir)
      const chunkResults = await transcribeChunks(chunks, language)
      transcript = mergeTranscripts(chunkResults)
    }

    // 오디오 메타데이터
    let metadata = {}
    try {
      metadata = await getAudioMetadata(filePath)
    } catch { /* 무시 */ }

    // DB 상태 업데이트
    await query(
      'UPDATE recordings SET status = ?, duration = ? WHERE id = ?',
      ['transcribed', Math.round(transcript.totalDuration), recording.id]
    )

    console.log(`[완료] 녹음 STT 성공! ${transcript.segments.length}개 세그먼트`)

    res.json({
      success: true,
      data: {
        fullText: transcript.fullText,
        segments: transcript.segments,
        meta: {
          originalFileName: recording.file_name,
          fileSizeMB: parseFloat(fileSizeMB),
          totalDuration: transcript.totalDuration,
          segmentCount: transcript.segments.length,
          chunkCount: transcript.chunkCount,
          errorCount: transcript.errorCount,
          language,
          audioBitrate: metadata.bitrate || null,
          audioFormat: metadata.format || null,
          recordingId: recording.id,
        },
      },
    })
  } catch (error) {
    console.error(`[녹음 STT 오류] ${error.message}`)
    res.status(500).json({
      success: false,
      error: `STT 처리 실패: ${error.message}`,
    })
  } finally {
    // 임시 분할 파일 정리 (원본 녹음 파일은 유지!)
    for (const target of cleanupTargets) {
      try {
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true })
        }
      } catch { /* 무시 */ }
    }
  }
})

export default router
