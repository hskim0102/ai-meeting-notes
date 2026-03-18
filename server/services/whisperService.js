/**
 * whisperService.js
 * ─────────────────────────────────────────────────
 * OpenAI Whisper API를 사용한 음성-텍스트 변환(STT) 서비스
 * - 단일 파일 및 분할된 청크 배열 모두 처리 가능
 * - 타임스탬프 기반 트랜스크립트 병합 기능 포함
 * ─────────────────────────────────────────────────
 */

import fs from 'fs'
import OpenAI from 'openai'

// ── OpenAI 클라이언트 지연 초기화 ──
// API 키가 없어도 서버 시작은 가능하도록 실제 사용 시점에 초기화
let _openai = null
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인해주세요.')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

/**
 * 단일 오디오 파일을 Whisper API로 전사(Transcription)
 *
 * [Whisper API 옵션 설명]
 * - model: "whisper-1" (현재 유일한 Whisper 모델)
 * - language: "ko" (한국어 우선 인식 → 정확도 향상)
 * - response_format: "verbose_json" (단어별 타임스탬프 포함)
 * - timestamp_granularities: ["segment"] (세그먼트 단위 타임스탬프)
 *
 * @param {string} filePath - 전사할 오디오 파일 경로
 * @param {string} language - 언어 코드 (기본값: 'ko')
 * @returns {Promise<object>} - Whisper API 응답 (segments 포함)
 */
export async function transcribeSingleFile(filePath, language = 'ko') {
  console.log(`[Whisper] 전사 시작: ${filePath}`)

  const response = await getOpenAI().audio.transcriptions.create({
    file: fs.createReadStream(filePath),   // 파일 스트림으로 전송
    model: 'whisper-1',                     // Whisper 모델 지정
    language: language,                     // 한국어 우선 인식
    response_format: 'verbose_json',        // 상세 JSON (타임스탬프 포함)
    timestamp_granularities: ['segment'],   // 세그먼트 단위 시간 정보
  })

  console.log(`[Whisper] 전사 완료: ${response.segments?.length || 0}개 세그먼트`)
  return response
}

/**
 * 분할된 오디오 청크 배열을 순차적으로 Whisper API에 전송
 *
 * [순차 처리 이유]
 * - OpenAI API Rate Limit 방지
 * - 메모리 사용량 제어
 * - 오류 발생 시 부분 결과라도 반환 가능
 *
 * @param {Array<{path: string, startTime: number, duration: number, index: number}>} chunks
 * @param {string} language - 언어 코드
 * @returns {Promise<Array<object>>} - 각 청크의 전사 결과 + 시간 오프셋 정보
 */
export async function transcribeChunks(chunks, language = 'ko') {
  console.log(`[Whisper] ${chunks.length}개 청크 순차 전사 시작`)
  const results = []

  for (const chunk of chunks) {
    try {
      console.log(`[Whisper] 청크 ${chunk.index + 1}/${chunks.length} 처리 중 (${chunk.startTime.toFixed(1)}초~)`)

      const response = await transcribeSingleFile(chunk.path, language)

      results.push({
        chunkIndex: chunk.index,
        startTimeOffset: chunk.startTime,   // 원본 기준 시작 시간 (병합 시 사용)
        duration: chunk.duration,
        text: response.text,                 // 전체 텍스트
        segments: response.segments || [],   // 세그먼트별 상세 정보
      })

      console.log(`[Whisper] 청크 ${chunk.index + 1} 완료: "${response.text.substring(0, 50)}..."`)
    } catch (error) {
      // ── 개별 청크 실패 시 에러 기록 후 계속 진행 ──
      console.error(`[Whisper 오류] 청크 ${chunk.index} 실패: ${error.message}`)
      results.push({
        chunkIndex: chunk.index,
        startTimeOffset: chunk.startTime,
        duration: chunk.duration,
        text: '',
        segments: [],
        error: error.message,
      })
    }
  }

  console.log(`[Whisper] 전체 청크 전사 완료 (성공: ${results.filter(r => !r.error).length}/${chunks.length})`)
  return results
}

/**
 * 분할된 전사 결과들을 시간순으로 하나의 완벽한 트랜스크립트로 병합
 *
 * [병합 로직]
 * 1. 각 청크의 세그먼트 타임스탬프에 원본 기준 오프셋을 더함
 * 2. 모든 세그먼트를 시간순으로 정렬
 * 3. 연속된 텍스트를 자연스럽게 이어붙임
 *
 * @param {Array<object>} chunkResults - transcribeChunks()의 반환값
 * @returns {object} - { fullText, segments, totalDuration, chunkCount, errorCount }
 */
export function mergeTranscripts(chunkResults) {
  console.log(`[병합] ${chunkResults.length}개 청크 결과 병합 시작`)

  const allSegments = []

  for (const result of chunkResults) {
    if (result.error) continue // 실패한 청크는 건너뜀

    for (const segment of result.segments) {
      // ── 원본 기준 절대 시간으로 변환 ──
      // 각 청크 내부의 상대 시간(0초부터 시작)에 원본 오프셋을 더함
      allSegments.push({
        id: allSegments.length,
        start: segment.start + result.startTimeOffset,  // 절대 시작 시간
        end: segment.end + result.startTimeOffset,       // 절대 종료 시간
        text: segment.text.trim(),                        // 텍스트 (공백 제거)
      })
    }
  }

  // ── 시간순 정렬 (분할 경계에서 순서가 뒤바뀔 수 있으므로) ──
  allSegments.sort((a, b) => a.start - b.start)

  // ── 전체 텍스트 생성 ──
  const fullText = allSegments.map(s => s.text).join(' ')

  // ── 총 재생 시간 계산 ──
  const totalDuration = allSegments.length > 0
    ? allSegments[allSegments.length - 1].end
    : 0

  console.log(`[병합 완료] 총 ${allSegments.length}개 세그먼트, ${totalDuration.toFixed(1)}초, ${fullText.length}자`)

  return {
    fullText,                        // 전체 연결 텍스트
    segments: allSegments,           // 타임스탬프가 포함된 세그먼트 배열
    totalDuration,                   // 총 재생 시간 (초)
    chunkCount: chunkResults.length, // 처리된 청크 수
    errorCount: chunkResults.filter(r => r.error).length, // 실패한 청크 수
  }
}

/**
 * 초(seconds)를 "HH:MM:SS" 형식의 타임코드로 변환
 * @param {number} seconds - 변환할 초
 * @returns {string} - "HH:MM:SS" 형식 문자열
 */
export function formatTimecode(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}
