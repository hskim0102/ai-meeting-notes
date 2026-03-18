/**
 * audioSplitter.js
 * ─────────────────────────────────────────────────
 * 대용량 오디오 파일을 Whisper API 제한(25MB)에 맞게
 * 안전한 크기(20MB 단위)로 분할하는 서비스
 * ─────────────────────────────────────────────────
 */

import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

// ── 상수 정의 ──
// Whisper API 최대 파일 크기: 25MB → 안전 마진을 두고 20MB 단위로 분할
export const MAX_CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
export const WHISPER_LIMIT_BYTES = 25 * 1024 * 1024   // 25MB

/**
 * ffprobe를 사용하여 오디오 파일의 메타데이터(총 길이, 비트레이트 등)를 가져옴
 * @param {string} filePath - 분석할 오디오 파일 경로
 * @returns {Promise<object>} - { duration: 초, bitrate: bps, format: 포맷명 }
 */
export function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`오디오 메타데이터 분석 실패: ${err.message}`))

      const { duration, bit_rate, format_name } = metadata.format
      resolve({
        duration: parseFloat(duration),       // 전체 재생 시간 (초)
        bitrate: parseInt(bit_rate, 10),       // 비트레이트 (bps)
        format: format_name,                   // 오디오 포맷 (예: matroska,webm / mp3)
      })
    })
  })
}

/**
 * ffmpeg을 사용하여 오디오의 특정 구간을 추출
 * - 출력 포맷을 mp3로 통일하여 Whisper API 호환성 확보
 * - 오디오 품질: 128kbps (STT에 충분한 품질)
 *
 * @param {string} inputPath  - 원본 파일 경로
 * @param {string} outputPath - 추출된 파일 저장 경로
 * @param {number} start      - 시작 시간 (초)
 * @param {number} duration   - 추출 길이 (초)
 */
function extractSegment(inputPath, outputPath, start, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(start)       // 시작 지점 설정
      .setDuration(duration)     // 추출 길이 설정
      .audioCodec('libmp3lame')  // MP3 코덱 사용
      .audioBitrate('128k')      // 128kbps 품질 (STT에 적합)
      .audioChannels(1)          // 모노 채널 (파일 크기 절약 + STT 최적)
      .audioFrequency(16000)     // 16kHz 샘플레이트 (Whisper 권장)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`오디오 분할 실패 [${start}초~]: ${err.message}`)))
      .run()
  })
}

/**
 * 대용량 오디오 파일을 시간 기반으로 분할
 *
 * [분할 전략]
 * 1. 파일의 비트레이트를 기반으로 20MB에 해당하는 시간(초)을 계산
 * 2. 해당 시간 간격으로 ffmpeg을 사용해 순차적으로 잘라냄
 * 3. 각 청크의 시작 시간(offset)을 함께 반환하여 나중에 타임스탬프 병합에 활용
 *
 * @param {string} filePath - 원본 오디오 파일 경로
 * @param {string} tempDir  - 분할된 파일을 저장할 임시 디렉토리
 * @returns {Promise<Array<{path: string, startTime: number}>>} - 분할된 청크 정보 배열
 */
export async function splitAudio(filePath, tempDir) {
  // ── 1단계: 오디오 메타데이터 분석 ──
  const metadata = await getAudioMetadata(filePath)
  console.log(`[오디오 분석] 총 길이: ${metadata.duration.toFixed(1)}초, 비트레이트: ${(metadata.bitrate / 1000).toFixed(0)}kbps`)

  // ── 2단계: 청크 하나당 최대 시간(초) 계산 ──
  // 공식: 최대바이트 / (비트레이트(bps) / 8) = 최대 시간(초)
  const bytesPerSecond = metadata.bitrate / 8
  const maxSecondsPerChunk = Math.floor(MAX_CHUNK_SIZE_BYTES / bytesPerSecond)
  console.log(`[분할 계획] 청크당 최대 ${maxSecondsPerChunk}초, 예상 청크 수: ${Math.ceil(metadata.duration / maxSecondsPerChunk)}개`)

  // ── 3단계: 시간 구간별로 ffmpeg 분할 실행 ──
  const chunks = []
  let startTime = 0
  let chunkIndex = 0

  while (startTime < metadata.duration) {
    // 남은 시간 계산 (마지막 청크는 더 짧을 수 있음)
    const remainingDuration = metadata.duration - startTime
    const chunkDuration = Math.min(maxSecondsPerChunk, remainingDuration)

    // 분할된 파일 경로 생성 (예: chunk_000.mp3)
    const chunkFileName = `chunk_${String(chunkIndex).padStart(3, '0')}.mp3`
    const chunkPath = path.join(tempDir, chunkFileName)

    // ffmpeg으로 해당 구간을 잘라서 mp3로 변환 (Whisper 호환성 극대화)
    await extractSegment(filePath, chunkPath, startTime, chunkDuration)

    // 분할된 파일 크기 확인
    const chunkStats = fs.statSync(chunkPath)
    console.log(`[분할 완료] ${chunkFileName}: ${(chunkStats.size / 1024 / 1024).toFixed(2)}MB (${startTime.toFixed(1)}초~${(startTime + chunkDuration).toFixed(1)}초)`)

    chunks.push({
      path: chunkPath,
      startTime: startTime,   // 이 청크가 원본에서 시작하는 시간 (초)
      duration: chunkDuration, // 이 청크의 길이 (초)
      index: chunkIndex,
    })

    startTime += chunkDuration
    chunkIndex++
  }

  console.log(`[분할 결과] 총 ${chunks.length}개 청크 생성 완료`)
  return chunks
}

/**
 * 파일 크기가 Whisper API 제한을 초과하는지 확인
 * @param {string} filePath - 확인할 파일 경로
 * @returns {boolean} - true: 분할 필요, false: 직접 처리 가능
 */
export function needsSplitting(filePath) {
  const stats = fs.statSync(filePath)
  const needsSplit = stats.size > WHISPER_LIMIT_BYTES
  console.log(`[크기 확인] ${(stats.size / 1024 / 1024).toFixed(2)}MB → ${needsSplit ? '분할 필요' : '직접 처리 가능'}`)
  return needsSplit
}
