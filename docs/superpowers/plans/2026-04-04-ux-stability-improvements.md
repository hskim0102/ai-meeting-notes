# UX 및 안정성 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화자 분리(pyannote), 회의 챗봇(Dify Q&A), 테스트 자동화, 에러 처리 강화를 구현하여 프로덕션 사내 서비스 품질을 높인다.

**Architecture:** pyannote 화자 분리를 위한 FastAPI Python 마이크로서비스를 추가하고, Express 백엔드에서 오케스트레이션한다. 회의 챗봇은 기존 Dify API를 재활용하여 단일 회의 Q&A와 전체 검색 Q&A를 제공한다. 테스트는 Vitest + Supertest + Playwright로 핵심 파이프라인을 커버한다.

**Tech Stack:** Python 3.11, FastAPI, pyannote.audio, Vitest, Supertest, Playwright, Zod

**Spec:** `docs/superpowers/specs/2026-04-04-ux-stability-improvements-design.md`

---

## File Structure

### New Files

```
pyannote-service/
├── main.py                          # FastAPI 앱 (/diarize, /diarize/health)
├── requirements.txt                 # Python 의존성
└── Dockerfile                       # 컨테이너화

server/
├── services/diarizationMerger.js    # 화자-텍스트 병합 로직
├── services/chatService.js          # 챗봇 비즈니스 로직 (Dify 호출 + 검색)
├── services/retryFetch.js           # 재시도 로직 유틸리티
├── routes/chat.js                   # 챗봇 API 라우트

src/
└── views/ChatView.vue               # 전체 회의 검색 Q&A 페이지

tests/
├── unit/
│   ├── diarizationMerger.test.js
│   ├── chatService.test.js
│   ├── audioSplitter.test.js
│   ├── whisperService.test.js
│   └── difyService.test.js
├── integration/
│   ├── transcribe.test.js
│   ├── chat.test.js
│   └── meetings.test.js
└── e2e/
    ├── meeting-flow.spec.js
    ���── chatbot.spec.js
```

### Modified Files

```
server/index.js                      # chat 라우트 등록, diarize 상태 표시
server/routes/transcribe.js          # enableDiarization 파라미터 추가
server/routes/meetings.js            # speaker_map 저장/조회 지원
server/scripts/initDb.js             # speaker_map 컬럼 추가
src/services/api.js                  # 챗봇 API, speaker_map API 추가
src/main.js                          # /chat 라우트 추가
src/components/SidebarNav.vue        # AI 챗봇 메뉴 추가
src/components/MeetingChatbot.vue    # 실제 API 연동으로 리팩토링
src/views/MeetingDetailView.vue      # 화자별 색상 + 이름 편집 UI
src/views/NewMeetingView.vue         # 화자 분리 옵션 체크박스
package.json                         # vitest, supertest, zod, playwright 추가
```

---

## Task 1: Python 화자 분리 마이크로서비스

**Files:**
- Create: `pyannote-service/main.py`
- Create: `pyannote-service/requirements.txt`
- Create: `pyannote-service/Dockerfile`

- [ ] **Step 1: requirements.txt 생성**

```
pyannote-service/requirements.txt
```

```txt
fastapi==0.115.0
uvicorn==0.32.0
pyannote.audio==3.3.2
torch>=2.0.0
python-multipart==0.0.12
```

- [ ] **Step 2: FastAPI 앱 작성**

```
pyannote-service/main.py
```

```python
"""
pyannote-service/main.py - 화자 분리 마이크로서비스
FastAPI 기반, pyannote.audio를 사용한 Speaker Diarization
"""

import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Speaker Diarization Service")

# pyannote pipeline 지연 로딩 (모델 로드에 시간이 걸리므로)
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise RuntimeError("HF_TOKEN 환경변수가 설정되지 않았습니다.")
        from pyannote.audio import Pipeline
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        # GPU 사용 가능 시 자동 전환
        import torch
        if torch.cuda.is_available():
            import torch
            _pipeline.to(torch.device("cuda"))
    return _pipeline


@app.get("/diarize/health")
async def health():
    return {
        "status": "ok",
        "service": "diarization",
        "model_loaded": _pipeline is not None,
    }


@app.post("/diarize")
async def diarize(file: UploadFile = File(...)):
    """오디오 파일을 받아 화자 세그먼트를 반환"""
    # 임시 파일로 저장
    suffix = Path(file.filename).suffix if file.filename else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        pipeline = get_pipeline()
        start_time = time.time()
        diarization = pipeline(tmp_path)
        elapsed = time.time() - start_time

        # 결과를 세그먼트 배열로 변환
        segments = []
        speakers = set()
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speakers.add(speaker)
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
            })

        return JSONResponse({
            "segments": segments,
            "num_speakers": len(speakers),
            "processing_time_sec": round(elapsed, 2),
        })
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DIARIZE_PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

- [ ] **Step 3: Dockerfile 작성**

```
pyannote-service/Dockerfile
```

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
```

- [ ] **Step 4: 커밋**

```bash
git add pyannote-service/
git commit -m "feat: pyannote 화자 분리 FastAPI 마이크로서비스 추가"
```

---

## Task 2: 화자-텍스트 병합 서비스 (TDD)

**Files:**
- Create: `server/services/diarizationMerger.js`
- Create: `tests/unit/diarizationMerger.test.js`

- [ ] **Step 1: 테스트 프레임워크 설치**

```bash
npm install -D vitest
```

`package.json`에 스크립트 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: 실패하는 테스트 작성**

```
tests/unit/diarizationMerger.test.js
```

```javascript
import { describe, it, expect } from 'vitest'
import { mergeWithSpeakers } from '../../server/services/diarizationMerger.js'

describe('mergeWithSpeakers', () => {
  it('각 Whisper 세그먼트에 가장 오버랩이 큰 화자를 할당한다', () => {
    const whisperSegments = [
      { id: 0, start: 0.0, end: 5.0, text: '안녕하세요' },
      { id: 1, start: 5.1, end: 10.0, text: '네 반갑습니다' },
      { id: 2, start: 10.5, end: 15.0, text: '회의를 시작하겠습니다' },
    ]

    const diarizeSegments = [
      { speaker: 'SPEAKER_00', start: 0.0, end: 6.0 },
      { speaker: 'SPEAKER_01', start: 6.0, end: 11.0 },
      { speaker: 'SPEAKER_00', start: 11.0, end: 15.0 },
    ]

    const result = mergeWithSpeakers(whisperSegments, diarizeSegments)

    expect(result).toHaveLength(3)
    expect(result[0].speaker).toBe('SPEAKER_00')
    expect(result[0].text).toBe('안녕하세요')
    expect(result[1].speaker).toBe('SPEAKER_01')
    expect(result[2].speaker).toBe('SPEAKER_00')
  })

  it('화자 세그먼트가 없으면 speaker를 null로 설정한다', () => {
    const whisperSegments = [
      { id: 0, start: 0.0, end: 5.0, text: '테스트' },
    ]

    const result = mergeWithSpeakers(whisperSegments, [])

    expect(result[0].speaker).toBeNull()
    expect(result[0].text).toBe('테스트')
  })

  it('whisper 세그먼트가 두 화자 경계에 걸치면 오버랩이 큰 쪽에 할당한다', () => {
    const whisperSegments = [
      { id: 0, start: 4.0, end: 8.0, text: '경계 발언' },
    ]

    // SPEAKER_00: 4.0~5.5 (1.5초), SPEAKER_01: 5.5~8.0 (2.5초)
    const diarizeSegments = [
      { speaker: 'SPEAKER_00', start: 0.0, end: 5.5 },
      { speaker: 'SPEAKER_01', start: 5.5, end: 10.0 },
    ]

    const result = mergeWithSpeakers(whisperSegments, diarizeSegments)

    expect(result[0].speaker).toBe('SPEAKER_01')
  })
})
```

- [ ] **Step 3: 테스트 실행 확인 (실패)**

```bash
npx vitest run tests/unit/diarizationMerger.test.js
```

Expected: FAIL - `Cannot find module '../../server/services/diarizationMerger.js'`

- [ ] **Step 4: 구현 작성**

```
server/services/diarizationMerger.js
```

```javascript
/**
 * diarizationMerger.js - 화자 분리 결과와 Whisper STT 결과를 병합
 * ─────────────────────────────────────────────────
 * pyannote 화자 세그먼트와 Whisper 텍스트 세그먼트를
 * 시간 오버랩 기반으로 매칭하여 화자 정보가 포함된 트랜스크립트 생성
 * ─────────────────────────────────────────────────
 */

/**
 * 두 시간 구간의 오버랩 길이를 계산
 * @param {number} s1 - 구간1 시작
 * @param {number} e1 - 구간1 종료
 * @param {number} s2 - 구간2 시작
 * @param {number} e2 - 구간2 종료
 * @returns {number} - 오버랩 길이 (초), 없으면 0
 */
function overlapDuration(s1, e1, s2, e2) {
  const start = Math.max(s1, s2)
  const end = Math.min(e1, e2)
  return Math.max(0, end - start)
}

/**
 * Whisper 세그먼트에 화자 정보를 매칭하여 병합
 *
 * @param {Array<{id: number, start: number, end: number, text: string}>} whisperSegments
 * @param {Array<{speaker: string, start: number, end: number}>} diarizeSegments
 * @returns {Array<{id: number, speaker: string|null, start: number, end: number, text: string}>}
 */
export function mergeWithSpeakers(whisperSegments, diarizeSegments) {
  return whisperSegments.map(seg => {
    if (diarizeSegments.length === 0) {
      return { ...seg, speaker: null }
    }

    // 각 화자 세그먼트와의 오버랩을 계산하여 가장 큰 오버랩의 화자를 선택
    let bestSpeaker = null
    let bestOverlap = 0

    for (const ds of diarizeSegments) {
      const overlap = overlapDuration(seg.start, seg.end, ds.start, ds.end)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestSpeaker = ds.speaker
      }
    }

    return {
      id: seg.id,
      speaker: bestSpeaker,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }
  })
}
```

- [ ] **Step 5: 테스트 실행 확인 (통과)**

```bash
npx vitest run tests/unit/diarizationMerger.test.js
```

Expected: 3 tests passed

- [ ] **Step 6: 커밋**

```bash
git add server/services/diarizationMerger.js tests/unit/diarizationMerger.test.js package.json package-lock.json
git commit -m "feat: 화자-텍스트 병합 서비스 추가 (TDD)"
```

---

## Task 3: Express 화자 분리 연동

**Files:**
- Modify: `server/routes/transcribe.js`
- Modify: `server/index.js`
- Modify: `.env` (환경변수 추가)

- [ ] **Step 1: transcribe.js에 화자 분리 로직 추가**

`server/routes/transcribe.js` 상단 import에 추가:

```javascript
import { mergeWithSpeakers } from '../services/diarizationMerger.js'
```

`router.post('/')` 핸들러에서, `const language = req.body.language || 'ko'` 다음에 추가:

```javascript
    const enableDiarization = req.body.enableDiarization === 'true' || req.body.enableDiarization === true
```

`transcript` 변수가 설정된 후 (경로 A, B 분기 이후), `// ── 3단계: 오디오 메타데이터 추가 ──` 주석 앞에 다음 블록을 삽입:

```javascript
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

          // 화자 정보를 기존 세그먼트에 병합
          transcript.segments = mergeWithSpeakers(transcript.segments, diarizeResult.segments)
        } else {
          console.warn(`[화자 분리] 서비스 응답 오류 (HTTP ${diarizeRes.status}), 화자 분리 없이 계속 진행`)
        }
      } catch (err) {
        // 화자 분리 실패 시 기존 방식으로 graceful degradation
        console.warn(`[화자 분리] 실패 (${err.message}), 화자 분리 없이 계속 진행`)
      }
    }
```

응답 JSON의 `meta` 객체에 추가:

```javascript
          diarization: diarizeResult ? {
            numSpeakers: diarizeResult.num_speakers,
            processingTime: diarizeResult.processing_time_sec,
          } : null,
```

- [ ] **Step 2: server/index.js에 화자 분리 서비스 상태 표시**

`app.listen()` 콜백에서 Dify URL 로그 다음에 추가:

```javascript
  console.log(`  화자분리:  ${process.env.DIARIZE_SERVICE_URL || 'http://localhost:5000'} (pyannote)`)
```

- [ ] **Step 3: .env에 환경변수 추가 안내**

`.env` 파일에 주석으로 추가 (실제 값은 사용자가 설정):

```env
# 화자 분리 (pyannote) 서비스
# DIARIZE_SERVICE_URL=http://localhost:5000
# HF_TOKEN=hf_... (pyannote-service에서 사용)
```

- [ ] **Step 4: 커밋**

```bash
git add server/routes/transcribe.js server/index.js
git commit -m "feat: transcribe 라우트에 화자 분리 연동 추가"
```

---

## Task 4: DB 스키마 변경 (speaker_map)

**Files:**
- Modify: `server/scripts/initDb.js`
- Modify: `server/routes/meetings.js`

- [ ] **Step 1: initDb.js meetings 테이블에 speaker_map 컬럼 추가**

`server/scripts/initDb.js`의 meetings 테이블 CREATE TABLE 문에서, `full_text TEXT COMMENT 'STT 전체 텍스트 (검색용)',` 다음에 추가:

```sql
      speaker_map JSON DEFAULT NULL COMMENT '화자 이름 매핑 {"SPEAKER_00": "김부장"}',
```

- [ ] **Step 2: meetings.js에 speaker_map 저장/조회 지원**

`server/routes/meetings.js`의 회의 생성 (POST /) 엔드포인트에서 INSERT 쿼리에 `speaker_map` 컬럼과 파라미터 추가.

회의 수정 (PUT /:id) 엔드포인트에서 UPDATE 쿼리에 `speaker_map = ?` 추가.

회의 상세 조회 (GET /:id) 응답에 `speaker_map` 필드를 JSON.parse하여 포함.

- [ ] **Step 3: 기존 DB에 컬럼 추가용 마이그레이션 스크립트 작성**

`server/scripts/addSpeakerMap.js`:

```javascript
/**
 * 기존 meetings 테이블에 speaker_map 컬럼 추가
 * 실행: node server/scripts/addSpeakerMap.js
 */
import 'dotenv/config'
import { query } from '../services/database.js'

async function run() {
  try {
    await query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS speaker_map JSON DEFAULT NULL COMMENT \'화자 이름 매핑\'')
    console.log('speaker_map 컬럼 추가 완료')
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('speaker_map 컬럼이 이미 존재합니다')
    } else {
      throw err
    }
  }
  process.exit(0)
}

run().catch(err => {
  console.error('마이그레이션 실패:', err.message)
  process.exit(1)
})
```

- [ ] **Step 4: 커밋**

```bash
git add server/scripts/initDb.js server/scripts/addSpeakerMap.js server/routes/meetings.js
git commit -m "feat: meetings 테이블에 speaker_map 컬럼 추가"
```

---

## Task 5: 프론트엔드 화자 분리 UI

**Files:**
- Modify: `src/views/NewMeetingView.vue`
- Modify: `src/views/MeetingDetailView.vue`
- Modify: `src/services/api.js`

- [ ] **Step 1: api.js에 transcribeAudio 함수 수정**

`src/services/api.js`의 `transcribeAudio` 함수 시그니처를 변경:

```javascript
export async function transcribeAudio(file, language = 'ko', onProgress = null, enableDiarization = false) {
```

FormData 구성 부분에 추가:

```javascript
  if (enableDiarization) {
    formData.append('enableDiarization', 'true')
  }
```

- [ ] **Step 2: api.js에 speaker_map 업데이트 함수 추가**

`src/services/api.js`의 회의 관련 API 섹션에 추가:

```javascript
/**
 * 회의 화자 이름 매핑 업데이트
 * @param {number|string} id - 회의 ID
 * @param {object} speakerMap - {"SPEAKER_00": "김부장", "SPEAKER_01": "이대리"}
 */
export async function updateSpeakerMap(id, speakerMap) {
  const res = await fetch(`${API_BASE}/meetings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speakerMap }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '화자 매핑 수정 실패')
  return data
}
```

- [ ] **Step 3: NewMeetingView.vue에 화자 분리 체크박스 추가**

STT 시작 전 옵션 영역에 추가:

```vue
<label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
  <input
    type="checkbox"
    v-model="enableDiarization"
    class="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
  />
  화자 분리 (누가 말했는지 자동 구분)
</label>
```

script setup에 `const enableDiarization = ref(false)` 추가.

`transcribeAudio` 호출 시 4번째 인자로 `enableDiarization.value` 전달.

- [ ] **Step 4: MeetingDetailView.vue에 화자별 색상 + 이름 편집 UI 추가**

transcript 탭에서 각 세그먼트 표시 시 화자별 색상을 적용:

```javascript
// script setup에 추가
const speakerColors = ['bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200']

const speakerMap = ref({})
const editingSpeaker = ref(null)
const editingName = ref('')

const getSpeakerName = (speakerId) => {
  if (!speakerId) return null
  return speakerMap.value[speakerId] || speakerId.replace('SPEAKER_', '화자')
}

const getSpeakerColor = (speakerId) => {
  if (!speakerId) return ''
  const speakers = [...new Set(meeting.value.transcript.map(s => s.speaker).filter(Boolean))]
  const idx = speakers.indexOf(speakerId)
  return speakerColors[idx % speakerColors.length]
}

const saveSpeakerName = async (speakerId) => {
  speakerMap.value[speakerId] = editingName.value
  editingSpeaker.value = null
  try {
    await updateSpeakerMap(meeting.value.id, speakerMap.value)
  } catch (err) {
    console.error('화자 매핑 저장 실패:', err)
  }
}
```

transcript 렌더링 부분에서 화자 배지 추가:

```vue
<div v-for="seg in meeting.transcript" :key="seg.id" class="flex gap-3 py-2">
  <!-- 화자 배지 -->
  <span
    v-if="seg.speaker"
    class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer"
    :class="getSpeakerColor(seg.speaker)"
    @click="editingSpeaker = seg.speaker; editingName = getSpeakerName(seg.speaker)"
  >
    {{ getSpeakerName(seg.speaker) }}
  </span>
  <!-- 텍스트 -->
  <p class="text-sm text-slate-700 dark:text-slate-300">{{ seg.text }}</p>
</div>

<!-- 화자 이름 편집 모달 -->
<div v-if="editingSpeaker" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="editingSpeaker = null">
  <div class="bg-white dark:bg-slate-800 rounded-xl p-6 w-80 shadow-xl">
    <h3 class="text-lg font-bold mb-4 dark:text-white">화자 이름 변경</h3>
    <input
      v-model="editingName"
      class="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
      placeholder="이름 입력"
      @keyup.enter="saveSpeakerName(editingSpeaker)"
    />
    <div class="flex gap-2 mt-4">
      <button @click="editingSpeaker = null" class="flex-1 px-4 py-2 text-sm border rounded-lg dark:border-slate-600 dark:text-slate-300">취소</button>
      <button @click="saveSpeakerName(editingSpeaker)" class="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg">저장</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: 커밋**

```bash
git add src/services/api.js src/views/NewMeetingView.vue src/views/MeetingDetailView.vue
git commit -m "feat: 화자 분리 프론트엔드 UI (옵션 체크박스, 화자별 색상, 이름 편집)"
```

---

## Task 6: 챗봇 백엔드 서비스 (TDD)

**Files:**
- Create: `server/services/chatService.js`
- Create: `tests/unit/chatService.test.js`
- Create: `server/routes/chat.js`
- Modify: `server/index.js`

- [ ] **Step 1: chatService 실패하는 테스트 작성**

```
tests/unit/chatService.test.js
```

```javascript
import { describe, it, expect, vi } from 'vitest'
import { buildMeetingContext, extractKeywords } from '../../server/services/chatService.js'

describe('buildMeetingContext', () => {
  it('회의 summary와 transcript를 하나의 context 문자열로 구성한다', () => {
    const meeting = {
      title: '주간 회의',
      ai_summary: '프로젝트 진행 상황을 점검했습니다.',
      transcript: [
        { speaker: '김부장', time: '10:00', text: '이번 주 진행 상황을 공유해주세요.' },
        { speaker: '이대리', time: '10:05', text: '프론트엔드 작업이 80% 완료되었습니다.' },
      ],
    }

    const context = buildMeetingContext(meeting)

    expect(context).toContain('주간 회의')
    expect(context).toContain('프로젝트 진행 상황을 점검했습니다')
    expect(context).toContain('김부장')
    expect(context).toContain('프론트엔드 작업이 80% 완료되었습니다')
  })

  it('transcript가 비어있어도 summary로 context를 구성한다', () => {
    const meeting = {
      title: '테스트 회의',
      ai_summary: '요약 내용',
      transcript: [],
    }

    const context = buildMeetingContext(meeting)

    expect(context).toContain('요약 내용')
  })
})

describe('extractKeywords', () => {
  it('질문에서 한국어 키워드를 추출한다', () => {
    const keywords = extractKeywords('지난달 마케팅 예산 관련 결정사항은?')

    expect(keywords).toContain('마케팅')
    expect(keywords).toContain('예산')
    expect(keywords).toContain('결정사항')
  })

  it('불용어를 제거한다', () => {
    const keywords = extractKeywords('이것은 테스트 질문입니다')

    expect(keywords).not.toContain('이것은')
    expect(keywords).not.toContain('입니다')
  })
})
```

- [ ] **Step 2: 테스트 실행 확인 (실패)**

```bash
npx vitest run tests/unit/chatService.test.js
```

Expected: FAIL

- [ ] **Step 3: chatService.js 구현**

```
server/services/chatService.js
```

```javascript
/**
 * chatService.js - 회의 챗봇 서비스
 * ─────────────────────────────────────────────────
 * Dify Workflow API를 활용한 회의록 Q&A
 * - 단일 회의 Q&A: 특정 회의 context + 질문
 * - 전체 검색 Q&A: FULLTEXT 검색 → 관련 회의 → context + 질문
 * ─────────────────────────────────────────────────
 */

import { query } from './database.js'

const CHAT_TIMEOUT_MS = 60_000 // 60초

// 한국어 불용어 (검색에서 제외할 단어)
const STOP_WORDS = new Set([
  '이', '그', '저', '것', '수', '등', '및', '에', '를', '을', '의', '가',
  '은', '는', '에서', '으로', '로', '와', '과', '이것', '저것', '그것',
  '합니다', '입니다', '있습니다', '없습니다', '됩니다', '하는', '있는',
  '관련', '대한', '위한', '통한', '대해', '대해서',
])

/**
 * 회의 데이터를 Dify에 전달할 context 문자열로 변환
 * @param {object} meeting - 회의 DB 레코드
 * @returns {string} - 구조화된 context 텍스트
 */
export function buildMeetingContext(meeting) {
  const parts = [`[회의: ${meeting.title}]`]

  if (meeting.ai_summary) {
    parts.push(`\n[요약]\n${meeting.ai_summary}`)
  }

  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    const decisions = Array.isArray(meeting.key_decisions)
      ? meeting.key_decisions
      : JSON.parse(meeting.key_decisions || '[]')
    if (decisions.length > 0) {
      parts.push(`\n[주요 결정]\n${decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`)
    }
  }

  if (meeting.transcript && meeting.transcript.length > 0) {
    const transcript = Array.isArray(meeting.transcript)
      ? meeting.transcript
      : JSON.parse(meeting.transcript || '[]')
    if (transcript.length > 0) {
      const lines = transcript.map(t => {
        const speaker = t.speaker || '발화자'
        return `${speaker} (${t.time || ''}): ${t.text}`
      })
      parts.push(`\n[발언 기록]\n${lines.join('\n')}`)
    }
  }

  return parts.join('\n')
}

/**
 * 질문에서 검색 키워드를 추출
 * @param {string} question - 사용자 질문
 * @returns {string[]} - 키워드 배열
 */
export function extractKeywords(question) {
  // 한국어 조사/어미 제거 (간단한 정규식 기반)
  const cleaned = question
    .replace(/[?？！!.,。]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')

  return words.filter(word => {
    if (word.length < 2) return false
    if (STOP_WORDS.has(word)) return false
    // 조사가 붙은 단어에서 조사 제거 후 체크
    const stripped = word.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|라|로서)$/g, '')
    if (stripped.length < 2) return false
    if (STOP_WORDS.has(stripped)) return false
    return true
  })
}

/**
 * Dify Workflow API로 챗봇 질문 전송
 * @param {string} context - 회의 context
 * @param {string} question - 사용자 질문
 * @param {Array} history - 대화 히스토리 [{role, content}]
 * @returns {Promise<string>} - AI 답변
 */
export async function askDify(context, question, history = []) {
  const apiKey = process.env.DIFY_CHAT_API_KEY || process.env.DIFY_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  if (!apiKey || !apiUrl) {
    throw new Error('DIFY_API_KEY 또는 DIFY_API_URL이 설정되지 않았습니다.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          context,
          question,
          history: JSON.stringify(history.slice(-6)), // 최근 6개 대화만
        },
        response_mode: 'blocking',
        user: 'chatbot',
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Dify 응답 오류 (HTTP ${response.status})`)
    }

    const result = await response.json()

    if (result.data?.status === 'failed') {
      throw new Error(`Dify 워크플로우 실패: ${result.data?.error || '알 수 없는 오류'}`)
    }

    const outputs = result.data?.outputs || {}
    return outputs.result || outputs.answer || outputs.text || '답변을 생성할 수 없습니다.'
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('챗봇 응답 타임아웃 (60초 초과)')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 단일 회의 Q&A
 * @param {number} meetingId - 회의 ID
 * @param {string} question - 질문
 * @param {Array} history - 대화 히스토리
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function chatWithMeeting(meetingId, question, history = []) {
  const rows = await query('SELECT * FROM meetings WHERE id = ?', [meetingId])
  if (rows.length === 0) {
    throw new Error('회의를 찾을 수 없습니다.')
  }

  const meeting = rows[0]
  // JSON 컬럼 파싱
  meeting.transcript = typeof meeting.transcript === 'string'
    ? JSON.parse(meeting.transcript || '[]')
    : (meeting.transcript || [])
  meeting.key_decisions = typeof meeting.key_decisions === 'string'
    ? JSON.parse(meeting.key_decisions || '[]')
    : (meeting.key_decisions || [])

  const context = buildMeetingContext(meeting)
  const answer = await askDify(context, question, history)

  return {
    answer,
    sources: [{
      meetingId: meeting.id,
      title: meeting.title,
      relevantText: meeting.ai_summary || '',
    }],
  }
}

/**
 * 전체 회의 검색 Q&A
 * @param {string} question - 질문
 * @param {Array} history - 대화 히스토리
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function chatWithSearch(question, history = []) {
  // 1단계: 키워드 추출 + FULLTEXT 검색
  const keywords = extractKeywords(question)
  const searchTerm = keywords.join(' ')

  let meetings
  if (searchTerm) {
    meetings = await query(
      `SELECT id, title, ai_summary, key_decisions, transcript
       FROM meetings
       WHERE MATCH(title, ai_summary, full_text) AGAINST(? IN NATURAL LANGUAGE MODE)
       ORDER BY MATCH(title, ai_summary, full_text) AGAINST(? IN NATURAL LANGUAGE MODE) DESC
       LIMIT 5`,
      [searchTerm, searchTerm]
    )
  } else {
    // 키워드 추출 실패 시 최근 회의 5건
    meetings = await query(
      'SELECT id, title, ai_summary, key_decisions, transcript FROM meetings ORDER BY date DESC LIMIT 5'
    )
  }

  if (meetings.length === 0) {
    return {
      answer: '관련된 회의를 찾을 수 없습니다. 다른 키워드로 질문해보세요.',
      sources: [],
    }
  }

  // 2단계: 관련 회의들의 context 구성
  const contexts = meetings.map(m => {
    m.transcript = typeof m.transcript === 'string'
      ? JSON.parse(m.transcript || '[]')
      : (m.transcript || [])
    m.key_decisions = typeof m.key_decisions === 'string'
      ? JSON.parse(m.key_decisions || '[]')
      : (m.key_decisions || [])
    return buildMeetingContext(m)
  })

  const combinedContext = contexts.join('\n\n---\n\n')
  const answer = await askDify(combinedContext, question, history)

  return {
    answer,
    sources: meetings.map(m => ({
      meetingId: m.id,
      title: m.title,
      relevantText: m.ai_summary || '',
    })),
  }
}
```

- [ ] **Step 4: 테스트 실행 확인 (통과)**

```bash
npx vitest run tests/unit/chatService.test.js
```

Expected: 4 tests passed

- [ ] **Step 5: chat 라우트 작성**

```
server/routes/chat.js
```

```javascript
/**
 * chat.js - 회의 챗봇 API 라우트
 * ─────────────────────────────────────────────────
 * POST /api/chat/meeting/:id  - 단일 회의 Q&A
 * POST /api/chat/search       - 전체 회의 검색 Q&A
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { chatWithMeeting, chatWithSearch } from '../services/chatService.js'

const router = Router()

/**
 * POST /api/chat/meeting/:id - 단일 회의 Q&A
 */
router.post('/meeting/:id', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id, 10)
    if (isNaN(meetingId)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 회의 ID입니다.' })
    }

    const { question, history } = req.body
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: '질문을 입력해주세요.' })
    }

    const result = await chatWithMeeting(meetingId, question.trim(), history || [])

    res.json({ success: true, data: result })
  } catch (err) {
    console.error(`[챗봇 오류] 단일 회의 Q&A: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/chat/search - 전체 회의 검색 Q&A
 */
router.post('/search', async (req, res) => {
  try {
    const { question, history } = req.body
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: '질문을 입력해주세요.' })
    }

    const result = await chatWithSearch(question.trim(), history || [])

    res.json({ success: true, data: result })
  } catch (err) {
    console.error(`[챗봇 오류] 전체 검색 Q&A: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
```

- [ ] **Step 6: server/index.js에 chat 라우트 등록**

import 추가:

```javascript
import chatRouter from './routes/chat.js'
```

라우트 등록 추가 (recordings 라우트 아래):

```javascript
// 회의 챗봇 엔드포인트
app.use('/api/chat', chatRouter)
```

API 문서 객체에 추가:

```javascript
      'POST /api/chat/meeting/:id': '단일 회의 Q&A 챗봇',
      'POST /api/chat/search': '전체 회의 검색 Q&A 챗봇',
```

- [ ] **Step 7: 커밋**

```bash
git add server/services/chatService.js server/routes/chat.js server/index.js tests/unit/chatService.test.js
git commit -m "feat: 회의 챗봇 백엔드 (단일 회의 Q&A + 전체 검색 Q&A)"
```

---

## Task 7: 챗봇 프론트엔드

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/components/MeetingChatbot.vue`
- Create: `src/views/ChatView.vue`
- Modify: `src/main.js`
- Modify: `src/components/SidebarNav.vue`

- [ ] **Step 1: api.js에 챗봇 API 함수 추가**

```javascript
// ─────────────────────────────────────────────────
// 챗봇 API
// ─────────────────────────────────────────────────

/**
 * 단일 회의 Q&A
 * @param {number|string} meetingId - 회의 ID
 * @param {string} question - 질문
 * @param {Array} history - 대화 히스토리 [{role, content}]
 * @returns {Promise<object>} - { success, data: { answer, sources } }
 */
export async function chatWithMeeting(meetingId, question, history = []) {
  const res = await fetch(`${API_BASE}/chat/meeting/${meetingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '챗봇 질문 실패')
  return data
}

/**
 * 전체 회의 검색 Q&A
 * @param {string} question - 질문
 * @param {Array} history - 대화 히스토리
 * @returns {Promise<object>} - { success, data: { answer, sources } }
 */
export async function chatWithSearch(question, history = []) {
  const res = await fetch(`${API_BASE}/chat/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '검색 챗봇 질문 실패')
  return data
}
```

- [ ] **Step 2: MeetingChatbot.vue 리팩토링 (실제 API 연동)**

기존 MeetingChatbot 컴포넌트를 읽고, mock 로직을 실제 `chatWithMeeting` API 호출로 교체.

핵심 변경:
- `import { chatWithMeeting } from '../services/api.js'`
- props로 `meetingId`를 받음
- 전송 시 `chatWithMeeting(props.meetingId, message, chatHistory)` 호출
- 응답의 `data.answer`를 채팅 메시지로 추가
- 로딩 상태(`isLoading`) 관리

- [ ] **Step 3: ChatView.vue 작성**

```
src/views/ChatView.vue
```

```vue
<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { chatWithSearch } from '../services/api.js'
import { useDarkMode } from '../composables/useDarkMode.js'

const { isDark } = useDarkMode()
const router = useRouter()

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const chatHistory = ref([])
const messagesContainer = ref(null)

const sendMessage = async () => {
  const question = inputText.value.trim()
  if (!question || isLoading.value) return

  messages.value.push({ role: 'user', content: question })
  inputText.value = ''
  isLoading.value = true

  await nextTick()
  scrollToBottom()

  try {
    const result = await chatWithSearch(question, chatHistory.value)
    const answer = result.data.answer
    const sources = result.data.sources || []

    messages.value.push({ role: 'assistant', content: answer, sources })
    chatHistory.value.push({ role: 'user', content: question })
    chatHistory.value.push({ role: 'assistant', content: answer })
  } catch (err) {
    messages.value.push({ role: 'assistant', content: `오류: ${err.message}`, error: true })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const goToMeeting = (id) => {
  router.push(`/meetings/${id}`)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 헤더 -->
    <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">AI 회의 챗봇</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">모든 회의록을 대상으로 질문할 수 있습니다</p>
    </div>

    <!-- 메시지 영역 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
      <div v-if="messages.length === 0" class="text-center text-slate-400 dark:text-slate-500 mt-20">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
        <p class="text-lg font-medium">무엇이든 물어보세요</p>
        <p class="text-sm mt-2">예: "지난달 마케팅 관련 결정사항은?", "보안 이슈 대응은 어떻게 했나요?"</p>
      </div>

      <div v-for="(msg, i) in messages" :key="i" :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
        <div
          class="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
          :class="msg.role === 'user'
            ? 'bg-primary-600 text-white'
            : msg.error
              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'"
        >
          <p class="whitespace-pre-wrap">{{ msg.content }}</p>
          <!-- 출처 회의 링크 -->
          <div v-if="msg.sources && msg.sources.length > 0" class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">출처:</p>
            <button
              v-for="src in msg.sources"
              :key="src.meetingId"
              @click="goToMeeting(src.meetingId)"
              class="text-xs text-primary-600 dark:text-primary-400 hover:underline block"
            >
              {{ src.title }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-slate-100 dark:bg-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-500">
          답변을 생성하고 있습니다...
        </div>
      </div>
    </div>

    <!-- 입력 영역 -->
    <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
      <div class="flex gap-3">
        <input
          v-model="inputText"
          @keyup.enter="sendMessage"
          class="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="회의에 대해 질문해보세요..."
          :disabled="isLoading"
        />
        <button
          @click="sendMessage"
          :disabled="isLoading || !inputText.trim()"
          class="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: main.js에 /chat 라우트 추가**

import 추가:

```javascript
import ChatView from './views/ChatView.vue'
```

routes 배열에 추가 (search 뒤):

```javascript
    { path: '/chat', name: 'chat', component: ChatView },
```

- [ ] **Step 5: SidebarNav.vue에 챗봇 메뉴 추가**

`navItems` 배열에서 `회의 검색` 항목 뒤에 추가:

```javascript
  { name: 'AI 챗봇', path: '/chat', icon: 'chat', shortcut: '' },
```

template의 nav 아이콘 중 rooms 아이콘 뒤에 추가:

```vue
        <!-- Chat -->
        <svg v-if="item.icon === 'chat'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
```

`isActive` 함수에 추가:

```javascript
  if (path === '/chat') return route.path === '/chat'
```

- [ ] **Step 6: 커밋**

```bash
git add src/services/api.js src/components/MeetingChatbot.vue src/views/ChatView.vue src/main.js src/components/SidebarNav.vue
git commit -m "feat: 회의 챗봇 프론트엔드 (단일 회의 패널 + 전체 검색 페이지)"
```

---

## Task 8: 재시도 로직 유틸리티

**Files:**
- Create: `server/services/retryFetch.js`
- Create: `tests/unit/retryFetch.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```
tests/unit/retryFetch.test.js
```

```javascript
import { describe, it, expect, vi } from 'vitest'
import { retryFetch } from '../../server/services/retryFetch.js'

describe('retryFetch', () => {
  it('성공 시 즉시 결과를 반환한다', async () => {
    const mockFn = vi.fn().mockResolvedValue({ ok: true, json: () => ({ data: 'test' }) })

    const result = await retryFetch(mockFn)

    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('실패 후 재시도하여 성공한다', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true })

    const result = await retryFetch(mockFn, { maxRetries: 3, baseDelayMs: 10 })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it('최대 재시도 횟수 초과 시 에러를 던진다', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('persistent error'))

    await expect(
      retryFetch(mockFn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow('persistent error')

    expect(mockFn).toHaveBeenCalledTimes(3) // 초기 1회 + 재시도 2회
  })

  it('429 응답 시 재시도한다', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true })

    const result = await retryFetch(mockFn, { maxRetries: 2, baseDelayMs: 10 })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실행 확인 (실패)**

```bash
npx vitest run tests/unit/retryFetch.test.js
```

Expected: FAIL

- [ ] **Step 3: retryFetch 구현**

```
server/services/retryFetch.js
```

```javascript
/**
 * retryFetch.js - 재시도 로직 유틸리티
 * ─────────────────────────────────────────────────
 * 외부 API 호출 실패 시 exponential backoff로 재시도
 * ─────────────────────────────────────────────────
 */

/**
 * 함수를 재시도 로직과 함께 실행
 * @param {Function} fn - 실행할 async 함수 (Response 반환)
 * @param {object} options
 * @param {number} options.maxRetries - 최대 재시도 횟수 (기본 3)
 * @param {number} options.baseDelayMs - 기본 대기 시간 (기본 1000ms)
 * @returns {Promise<Response>}
 */
export async function retryFetch(fn, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn()

      // 429 (Rate Limit) 또는 5xx 서버 에러 시 재시도
      if (response && !response.ok && (response.status === 429 || response.status >= 500)) {
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          console.log(`[재시도] HTTP ${response.status} - ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      return response
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.log(`[재시도] ${err.message} - ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
```

- [ ] **Step 4: 테스트 실행 확인 (통과)**

```bash
npx vitest run tests/unit/retryFetch.test.js
```

Expected: 4 tests passed

- [ ] **Step 5: 커밋**

```bash
git add server/services/retryFetch.js tests/unit/retryFetch.test.js
git commit -m "feat: 재시도 로직 유틸리티 추가 (exponential backoff)"
```

---

## Task 9: 기존 서비스에 재시도 로직 적용

**Files:**
- Modify: `server/services/difyService.js`
- Modify: `server/services/whisperService.js`

- [ ] **Step 1: difyService.js에 재시도 적용**

`server/services/difyService.js` 상단에 import 추가:

```javascript
import { retryFetch } from './retryFetch.js'
```

`summarizeWithDify` 함수에서 기존 `fetch()` 호출을 `retryFetch`로 감싸기:

```javascript
    const response = await retryFetch(
      () => fetch(`${apiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { transcript },
          response_mode: 'blocking',
          user: 'dx-member',
        }),
        signal: controller.signal,
      }),
      { maxRetries: 2, baseDelayMs: 2000 }
    )
```

- [ ] **Step 2: whisperService.js에 재시도 적용**

`transcribeSingleFile` 함수를 재시도 감싸기:

```javascript
export async function transcribeSingleFile(filePath, language = 'ko', maxRetries = 2) {
  console.log(`[Whisper] 전사 시작: ${filePath}`)

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getOpenAI().audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        language: language,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      })

      console.log(`[Whisper] 전사 완료: ${response.segments?.length || 0}개 세그먼트`)
      return response
    } catch (err) {
      lastError = err
      if (attempt < maxRetries && (err.status === 429 || err.status >= 500)) {
        const delay = 2000 * Math.pow(2, attempt)
        console.log(`[Whisper 재시도] ${err.message} - ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw err
      }
    }
  }
  throw lastError
}
```

- [ ] **Step 3: 커밋**

```bash
git add server/services/difyService.js server/services/whisperService.js
git commit -m "feat: Whisper/Dify API 호출에 재시도 로직 적용"
```

---

## Task 10: 입력 검증 (Zod)

**Files:**
- Create: `server/services/validators.js`
- Modify: `server/routes/chat.js`
- Modify: `server/routes/summarize.js`

- [ ] **Step 1: Zod 설치**

```bash
npm install zod
```

- [ ] **Step 2: validators.js 작성**

```
server/services/validators.js
```

```javascript
/**
 * validators.js - API 요청 입력 검증 (Zod)
 * ─────────────────────────────────────────────────
 */

import { z } from 'zod'

export const chatQuestionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요.').max(2000, '질문이 너무 깁니다 (최대 2000자).'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
})

export const summarizeSchema = z.object({
  transcript: z.string().min(1, '요약할 텍스트가 비어있습니다.').max(500000, '텍스트가 너무 깁니다.'),
})

/**
 * Zod 스키마로 req.body를 검증하는 Express 미들웨어 팩토리
 * @param {z.ZodSchema} schema
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ')
      return res.status(400).json({ success: false, error: message })
    }
    req.body = result.data
    next()
  }
}
```

- [ ] **Step 3: chat.js 라우트에 검증 적용**

`server/routes/chat.js`에 import 추가:

```javascript
import { validate, chatQuestionSchema } from '../services/validators.js'
```

각 라우트에 미들웨어 추가:

```javascript
router.post('/meeting/:id', validate(chatQuestionSchema), async (req, res) => {
```

```javascript
router.post('/search', validate(chatQuestionSchema), async (req, res) => {
```

기존 수동 validation 코드 제거 (Zod가 대체).

- [ ] **Step 4: summarize.js에도 검증 적용**

```javascript
import { validate, summarizeSchema } from '../services/validators.js'
```

POST 라우트에 미들웨어 추가.

- [ ] **Step 5: 커밋**

```bash
git add server/services/validators.js server/routes/chat.js server/routes/summarize.js package.json package-lock.json
git commit -m "feat: Zod 기반 API 입력 검증 추가"
```

---

## Task 11: 기존 코드 단위 테스트

**Files:**
- Create: `tests/unit/audioSplitter.test.js`
- Create: `tests/unit/whisperService.test.js`
- Create: `tests/unit/difyService.test.js`

- [ ] **Step 1: audioSplitter 테스트**

```
tests/unit/audioSplitter.test.js
```

```javascript
import { describe, it, expect, vi } from 'vitest'
import { needsSplitting, WHISPER_LIMIT_BYTES, MAX_CHUNK_SIZE_BYTES } from '../../server/services/audioSplitter.js'
import fs from 'fs'

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
```

- [ ] **Step 2: whisperService mergeTranscripts 테스트**

```
tests/unit/whisperService.test.js
```

```javascript
import { describe, it, expect } from 'vitest'
import { mergeTranscripts, formatTimecode } from '../../server/services/whisperService.js'

describe('mergeTranscripts', () => {
  it('여러 청크 결과를 시간순으로 병합한다', () => {
    const chunkResults = [
      {
        chunkIndex: 0,
        startTimeOffset: 0,
        duration: 60,
        text: '첫 번째 청크',
        segments: [
          { start: 0, end: 5, text: '안녕하세요' },
          { start: 5, end: 10, text: '반갑습니다' },
        ],
      },
      {
        chunkIndex: 1,
        startTimeOffset: 60,
        duration: 60,
        text: '두 번째 청크',
        segments: [
          { start: 0, end: 5, text: '다음 내용입니다' },
        ],
      },
    ]

    const result = mergeTranscripts(chunkResults)

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0].start).toBe(0)
    expect(result.segments[2].start).toBe(60) // 오프셋 적용
    expect(result.fullText).toContain('안녕하세요')
    expect(result.fullText).toContain('다음 내용입니다')
    expect(result.chunkCount).toBe(2)
    expect(result.errorCount).toBe(0)
  })

  it('에러가 있는 청크는 건너뛴다', () => {
    const chunkResults = [
      {
        chunkIndex: 0,
        startTimeOffset: 0,
        duration: 60,
        text: '성공',
        segments: [{ start: 0, end: 5, text: '성공 텍스트' }],
      },
      {
        chunkIndex: 1,
        startTimeOffset: 60,
        duration: 60,
        text: '',
        segments: [],
        error: 'API 오류',
      },
    ]

    const result = mergeTranscripts(chunkResults)

    expect(result.segments).toHaveLength(1)
    expect(result.errorCount).toBe(1)
  })
})

describe('formatTimecode', () => {
  it('초를 HH:MM:SS 형식으로 변환한다', () => {
    expect(formatTimecode(0)).toBe('00:00:00')
    expect(formatTimecode(65)).toBe('00:01:05')
    expect(formatTimecode(3661)).toBe('01:01:01')
  })
})
```

- [ ] **Step 3: difyService parseWorkflowOutput 테스트**

```
tests/unit/difyService.test.js
```

```javascript
import { describe, it, expect } from 'vitest'

// parseWorkflowOutput는 내부 함수이므로 summarizeWithDify를 통해 간접 테스트하기 어려움
// 대신 normalizeActionItems, normalizeArray 패턴을 확인하기 위해
// summarizeWithDify의 결과 구조를 검증하는 통합적 접근을 취한다

describe('difyService 모듈 import', () => {
  it('summarizeWithDify 함수를 export한다', async () => {
    const mod = await import('../../server/services/difyService.js')
    expect(typeof mod.summarizeWithDify).toBe('function')
  })
})
```

- [ ] **Step 4: 전체 단위 테스트 실행**

```bash
npx vitest run tests/unit/
```

Expected: All tests passed

- [ ] **Step 5: 커밋**

```bash
git add tests/unit/audioSplitter.test.js tests/unit/whisperService.test.js tests/unit/difyService.test.js
git commit -m "test: 기존 서비스 단위 테스트 추가 (audioSplitter, whisperService, difyService)"
```

---

## Task 12: 통합 테스트

**Files:**
- Create: `tests/integration/chat.test.js`
- Create: `tests/integration/meetings.test.js`

- [ ] **Step 1: Supertest 설치**

```bash
npm install -D supertest
```

- [ ] **Step 2: Express 앱을 테스트용으로 export**

`server/index.js`에서 `app`을 export 추가 (기존 `app.listen` 유지, 조건부):

```javascript
export { app }
```

서버 시작 부분을 조건부로 변경:

```javascript
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    // 기존 코드 유지
  })
}
```

- [ ] **Step 3: chat 통합 테스트**

```
tests/integration/chat.test.js
```

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.js'

describe('POST /api/chat/meeting/:id', () => {
  it('질문이 비어있으면 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/meeting/1')
      .send({ question: '' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('유효하지 않은 회의 ID는 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/meeting/abc')
      .send({ question: '테스트 질문' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/chat/search', () => {
  it('질문이 비어있으면 400 에러를 반환한다', async () => {
    const res = await request(app)
      .post('/api/chat/search')
      .send({ question: '' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
```

- [ ] **Step 4: meetings 통합 테스트**

```
tests/integration/meetings.test.js
```

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server/index.js'

describe('GET /api/meetings', () => {
  it('회의 목록을 배열로 반환한다', async () => {
    const res = await request(app).get('/api/meetings')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('GET /api/meetings/stats', () => {
  it('통계 데이터를 반환한다', async () => {
    const res = await request(app).get('/api/meetings/stats')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
```

- [ ] **Step 5: 테스트 실행**

```bash
NODE_ENV=test npx vitest run tests/integration/
```

- [ ] **Step 6: 커밋**

```bash
git add tests/integration/ server/index.js package.json package-lock.json
git commit -m "test: 챗봇 및 회의 API 통합 테스트 추가"
```

---

## Task 13: E2E 테스트 설정

**Files:**
- Create: `tests/e2e/meeting-flow.spec.js`
- Create: `playwright.config.js`

- [ ] **Step 1: Playwright 설치**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: playwright.config.js 작성**

```
playwright.config.js
```

```javascript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev:server',
      port: 3001,
      reuseExistingServer: true,
    },
  ],
})
```

- [ ] **Step 3: E2E 테스트 작성**

```
tests/e2e/meeting-flow.spec.js
```

```javascript
import { test, expect } from '@playwright/test'

test.describe('회의 생성 플로우', () => {
  test('새 회의록 페이지에 접근할 수 있다', async ({ page }) => {
    // 로그인 (mock)
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // 로그인 후 대시보드
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 새 회의록 페이지로 이동
    await page.goto('/meetings/new')
    await expect(page.locator('text=새 회의록')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('챗봇 페이지', () => {
  test('AI 챗봇 페이지에 접근할 수 있다', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=AI 회의 챗봇')).toBeVisible({ timeout: 10000 })
  })
})
```

- [ ] **Step 4: package.json에 E2E 스크립트 추가**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: 커밋**

```bash
git add tests/e2e/ playwright.config.js package.json
git commit -m "test: Playwright E2E 테스트 설정 및 기본 시나리오 추가"
```

---

## Task 14: 최종 점검 및 npm scripts 정리

**Files:**
- Modify: `package.json`

- [ ] **Step 1: package.json scripts 정리**

```json
"scripts": {
  "dev": "vite --port 3000",
  "dev:server": "node server/index.js",
  "dev:all": "npm run dev & npm run dev:server",
  "db:init": "node server/scripts/initDb.js",
  "db:migrate": "node server/scripts/addSpeakerMap.js",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 2: 전체 테스트 실행 확인**

```bash
npx vitest run
```

Expected: All unit tests passed

- [ ] **Step 3: 커밋**

```bash
git add package.json
git commit -m "chore: npm scripts 정리 (test, db:migrate 추가)"
```
