# NoteFlow - UX 및 안정성 개선 설계

**작성일:** 2026-04-04
**목적:** 프로덕션 사내 서비스를 위한 화자 분리, 회의 챗봇, 테스트/안정성 강화
**우선순위:** 사용자 경험 > 안정성/품질

---

## 1. 화자 분리 (Speaker Diarization)

### 1.1 아키텍처

```
Express Backend                    Python Microservice (FastAPI)
─────────────────                  ────────────────────────────
POST /api/transcribe               POST /diarize
  │                                  │
  ├─ 1. 오디오 파일 저장              ├─ pyannote/audio pipeline
  ├─ 2. Python 서비스에 전달  ──────→ ├─ 화자 세그먼트 분리
  ├─ 3. 결과 수신 ←──────────────── └─ [{speaker, start, end}, ...]
  ├─ 4. 세그먼트별 Whisper STT
  ├─ 5. 화자 + 텍스트 병합
  └─ 6. 응답 반환
```

처리 순서: 오디오 → pyannote(화자 분리) → 화자별 세그먼트 → Whisper(STT) → 화자+텍스트 병합

### 1.2 Python 마이크로서비스

- **프레임워크:** FastAPI
- **엔드포인트:** `POST /diarize`, `GET /diarize/health`
- **모델:** `pyannote/speaker-diarization-3.1` (HuggingFace)
- **요구사항:** HuggingFace 토큰 (모델 라이선스 동의 필요)
- **환경변수:** `HF_TOKEN`, `DIARIZE_PORT` (기본 5000)

#### 응답 형식

```json
{
  "segments": [
    {"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2},
    {"speaker": "SPEAKER_01", "start": 5.3, "end": 12.8}
  ],
  "num_speakers": 2
}
```

### 1.3 화자-텍스트 병합 로직

- Express 백엔드의 새 모듈: `server/services/diarizationMerger.js`
- 화자 세그먼트와 Whisper 세그먼트의 시간 범위를 **오버랩 비율**로 매칭
- 한 Whisper 세그먼트가 여러 화자에 걸치면 가장 오버랩이 큰 화자에 할당

#### 병합 결과 형식

```json
[
  {"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2, "text": "안녕하세요..."},
  {"speaker": "SPEAKER_01", "start": 5.3, "end": 12.8, "text": "네, 오늘 회의는..."}
]
```

Frontend에서 `speaker_map`을 적용하여 "SPEAKER_00" → "화자1" 또는 사용자 지정 이름으로 표시

### 1.4 수동 이름 매핑 (Frontend)

- MeetingDetailView transcript 탭에 **화자 이름 편집 기능** 추가
- "화자1" → "김부장" 식으로 매핑, 해당 회의 전체에 반영
- DB: meetings 테이블에 `speaker_map` JSON 컬럼 추가
  - 예: `{"SPEAKER_00": "김부장", "SPEAKER_01": "이대리"}`

### 1.5 GPU 없는 환경 대응

- CPU 동작 가능 (10분 오디오 → 약 2~5분 처리)
- 프론트엔드에서 "화자 분리 중..." 진행 상태 표시
- **선택 옵션:** 사용자가 원할 때만 실행 (체크박스)
- 화자 분리 없이도 기존 STT 파이프라인 정상 동작

### 1.6 기존 코드 변경

- `POST /api/transcribe` 라우트에 `enableDiarization` 파라미터 추가
- `whisperService.js`: 화자 세그먼트 기반 STT 모드 추가
- NewMeetingView.vue: 화자 분리 옵션 체크박스 추가
- MeetingDetailView.vue: 화자별 색상 표시 + 이름 편집 UI

---

## 2. 회의 챗봇

### 2.1 단일 회의 Q&A

- **위치:** MeetingDetailView 내 챗봇 패널 (기존 MeetingChatbot 컴포넌트 활용)
- **동작:** 해당 회의의 transcript + summary를 context로 Dify에 전달
- **Dify Workflow:** `meeting-qa` (단일 회의용, 새로 생성 필요)

```
사용자 질문 + 회의 transcript → POST /api/chat/meeting/:id → Dify API → 답변
```

- 대화 히스토리는 세션 내 메모리 (페이지 이탈 시 초기화)
- 질문 예시: "이 회의에서 결정된 예산은?", "김부장이 언급한 일정은?"

### 2.2 전체 회의 검색 Q&A

- **위치:** `/chat` 라우트, 별도 페이지
- **2단계 처리:**

```
1단계: 질문에서 키워드 추출 → MySQL FULLTEXT 검색 → 관련 회의 top 3~5개 선별
2단계: 선별된 회의들의 summary + transcript를 context로 Dify에 전달 → 답변 생성
```

- **Dify Workflow:** `meeting-search-qa` (다중 회의 컨텍스트, 새로 생성 필요)
- 답변에 **출처 회의 링크** 포함 (어떤 회의에서 나온 정보인지)

### 2.3 API 엔드포인트

```
POST /api/chat/meeting/:id    — 단일 회의 Q&A
  Body: { question: string, history: [{role, content}] }
  Response: { answer: string, sources: [{meetingId, title, relevantText}] }

POST /api/chat/search         — 전체 회의 검색 Q&A
  Body: { question: string, history: [{role, content}] }
  Response: { answer: string, sources: [{meetingId, title, relevantText}] }
```

### 2.4 토큰 한계 대응

- 긴 transcript는 **요약 + 관련 세그먼트만** 추출하여 context 축소
- 전체 검색 시 회의당 summary(전문) + transcript(관련 부분만) 전달
- Dify workflow 내에서 context window 관리

### 2.5 기존 코드 변경

- `server/routes/chat.js`: 새 라우트 파일 추가
- `server/services/chatService.js`: Dify 챗봇 호출 + 회의 검색 로직
- `src/views/ChatView.vue`: 전체 회의 검색 Q&A 페이지
- `src/components/MeetingChatbot.vue`: 기존 컴포넌트 리팩토링 (실제 API 연동)
- SidebarNav.vue: 챗봇 메뉴 항목 추가
- router: `/chat` 라우트 추가

---

## 3. 테스트 및 안정성 강화

### 3.1 테스트 전략

핵심 원칙: 핵심 파이프라인(녹음→STT→요약→저장)을 우선 커버

#### Backend 테스트 (Vitest + Supertest)

| 대상 | 테스트 유형 | 내용 |
|------|------------|------|
| `whisperService.js` | 단위 | 청크 분할 판단, 트랜스크립트 병합, 화자-텍스트 매칭 |
| `difyService.js` | 단위 | 응답 파싱, 타임아웃 처리 |
| `audioSplitter.js` | 단위 | 파일 크기 판단, 청크 수 계산 |
| `diarizationMerger.js` | 단위 | 화자-텍스트 오버랩 매칭 |
| `chatService.js` | 단위 | 회의 검색 + context 구성 |
| API 라우트 | 통합 | `/api/transcribe`, `/api/summarize`, `/api/chat/*` |
| DB 연동 | 통합 | 회의 CRUD, 검색, 화자 매핑 저장/조회 |

- 외부 API(Whisper, Dify, pyannote)는 mock 처리
- DB 테스트는 테스트용 DB 사용 (실제 MySQL, 별도 database)

#### Frontend 테스트 (Vitest + Vue Test Utils)

| 대상 | 내용 |
|------|------|
| `api.js` | API 호출 로직, 에러 핸들링 |
| AudioUploader | 파일 검증, 업로드 진행률 |
| LiveRecorder | 녹음 시작/중지, blob 생성 |
| MeetingChatbot | 메시지 전송, 응답 표시 |
| useAuth | 로그인/로그아웃, 권한 확인 |

#### E2E 테스트 (Playwright)

- 시나리오 1: 파일 업로드 → STT → 요약 → 회의 저장 → 상세 확인
- 시나리오 2: 회의 챗봇 Q&A (단일 회의 + 전체 검색)

### 3.2 에러 처리 강화

| 개선 사항 | 구현 |
|-----------|------|
| **재시도 로직** | Whisper/Dify API 호출 시 최대 3회 재시도 (exponential backoff) |
| **Python 서비스 헬스체크** | `/diarize/health`, Express에서 주기적 확인 |
| **입력 검증** | Zod 스키마로 API 요청 body 검증 |
| **타임아웃** | 화자 분리 300s, STT 120s, 요약 120s, 챗봇 60s |
| **Graceful degradation** | 화자 분리 실패 시 → 기존 방식(화자 구분 없이)으로 fallback |

---

## 4. DB 스키마 변경

### meetings 테이블

```sql
ALTER TABLE meetings ADD COLUMN speaker_map JSON DEFAULT NULL;
```

기존 transcript 컬럼의 JSON 형식 변경 (하위 호환):

```json
-- 기존
[{"id": 0, "start": 0.0, "end": 5.2, "text": "..."}]

-- 화자 분리 시
[{"id": 0, "speaker": "SPEAKER_00", "start": 0.0, "end": 5.2, "text": "..."}]

-- 화자 분리 미사용 시 기존 형식 유지
```

---

## 5. 새로 추가되는 파일

### Python 서비스

```
pyannote-service/
├── main.py              # FastAPI 앱, /diarize, /diarize/health
├── requirements.txt     # pyannote.audio, fastapi, uvicorn, torch
└── Dockerfile           # Python 3.11 + 의존성
```

### Express 백엔드

```
server/
├── routes/chat.js                 # 챗봇 API 라우트
├── services/chatService.js        # 챗봇 비즈니스 로직
└── services/diarizationMerger.js  # 화자-텍스트 병합
```

### Frontend

```
src/
└── views/ChatView.vue             # 전체 회의 검색 Q&A 페이지
```

### 테스트

```
tests/
├── unit/
│   ├── whisperService.test.js
│   ├── difyService.test.js
│   ├── audioSplitter.test.js
│   ├── diarizationMerger.test.js
│   └── chatService.test.js
├── integration/
│   ├── transcribe.test.js
│   ├── summarize.test.js
│   ├── chat.test.js
│   └── meetings.test.js
├── frontend/
│   ├── api.test.js
│   ├── AudioUploader.test.js
│   ├── LiveRecorder.test.js
│   ├── MeetingChatbot.test.js
│   └── useAuth.test.js
└── e2e/
    ├── meeting-flow.spec.js
    └── chatbot.spec.js
```

---

## 6. 환경변수 추가

```env
# pyannote 서비스
HF_TOKEN=hf_...                           # HuggingFace 토큰
DIARIZE_SERVICE_URL=http://localhost:5000  # pyannote 서비스 주소

# 챗봇용 Dify Workflow
DIFY_CHAT_API_KEY=app-...                 # 챗봇용 Dify API 키 (기존과 별도 가능)
```

---

## 7. 구현 순서 (권장)

1. **화자 분리** — Python 서비스 → Express 연동 → 병합 로직 → Frontend UI
2. **회의 챗봇** — 단일 회의 Q&A → 전체 검색 Q&A → ChatView 페이지
3. **테스트** — 단위 테스트 (기존 코드 + 새 코드) → 통합 테스트 → E2E
4. **에러 처리** — 재시도 로직 → 입력 검증 → 헬스체크 → graceful degradation
