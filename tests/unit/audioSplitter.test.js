import { describe, it, expect, vi } from 'vitest'
import { needsSplitting, WHISPER_LIMIT_BYTES, MAX_CHUNK_SIZE_BYTES } from '../../server/services/audioSplitter.js'
import fs from 'fs'

vi.mock('fluent-ffmpeg', () => ({ default: {} }))
vi.mock('fs')

describe('needsSplitting', () => {
  it('25MB 이하 파일은 분할 불필요', () => {
    fs.statSync.mockReturnValue({ size: 20 * 1024 * 1024 })
    expect(needsSplitting('/tmp/small.mp3')).toBe(false)
  })

  it('25MB 초과 파일은 분할 필요', () => {
    fs.statSync.mockReturnValue({ size: 30 * 1024 * 1024 })
    expect(needsSplitting('/tmp/large.mp3')).toBe(true)
  })

  it('정확히 25MB는 분할 불필요', () => {
    fs.statSync.mockReturnValue({ size: WHISPER_LIMIT_BYTES })
    expect(needsSplitting('/tmp/exact.mp3')).toBe(false)
  })
})

describe('상수 값 검증', () => {
  it('WHISPER_LIMIT_BYTES는 25MB', () => {
    expect(WHISPER_LIMIT_BYTES).toBe(25 * 1024 * 1024)
  })

  it('MAX_CHUNK_SIZE_BYTES는 20MB', () => {
    expect(MAX_CHUNK_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })
})
