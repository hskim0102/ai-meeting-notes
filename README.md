# NoteFlow (노트플로우)

회의 녹음/업로드부터 AI 음성인식, 화자 분리, AI 요약, 액션 아이템 추출, 챗봇 Q&A까지 — 회의의 모든 것을 자동화하는 풀스택 웹 애플리케이션입니다.

## 프로젝트 개요

NoteFlow는 기록(Note)이 단절되지 않고 실제 업무와 실행의 흐름(Flow)으로 매끄럽게 이어진다는 의미를 담고 있으며, '기록에서 흐름으로, 회의가 곧 실행이 되다'라는 슬로건 하에 개발된다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **음성 녹음 & 업로드** | 브라우저 마이크 녹음(WebM) 또는 오디오 파일 드래그앤드롭 업로드 |
| **AI 음성 인식 (STT)** | OpenAI Whisper API로 음성을 텍스트로 변환, 25MB 초과 시 자동 청크 분할 |
| **화자 분리** | Pyannote 기반 화자 분리(Diarization) + 화자 이름 매핑 |
| **AI 요약** | Dify Workflow API를 통한 회의 요약, 핵심 결정사항, 감정 분석 |
| **액션 아이템** | 회의에서 추출된 액션 아이템 관리 (담당자, 마감일, 완료 토글) |
| **AI 챗봇** | 회의 내용 기반 Q&A 챗봇 (단일 회의 / 전체 회의 검색) |
| **회의실 예약** | 회의실 목록, 가용성 조회, 캘린더 기반 예약 관리 |
| **통합 검색** | 제목, 요약, 전문 텍스트 FULLTEXT 검색 + 자동완성 |
| **대시보드 & 차트** | 회의 통계, 트렌드 차트 (Chart.js) |
| **회의록 메일 발송** | Nodemailer를 통한 회의록 이메일 전송 |
| **녹음 보관** | 녹음 파일 서버 저장, 목록 관리, 오디오 스트리밍 |
| **다크 모드** | 시스템 설정 연동 다크/라이트 모드 |
| **모바일 반응형** | 모바일 하단 네비게이션, 반응형 레이아웃 |
| **커맨드 팔레트** | 빠른 페이지 이동 & 검색 (Ctrl+K) |
| **로그인 & 권한** | localStorage 기반 인증, 관리자 전용 감사 로그 |
| **Dify RAG 자동 생성** | 회의록 저장/수정/삭제 시 Dify RAG 에이전트 호출 → 지식 도큐먼트 생성·수정·삭제 후 `meeting_rag_docs` 테이블에 document_id 매핑 저장 |
| **회의록 삭제** | 회의 상세 화면에서 삭제 버튼 클릭 → 확인 모달 → Dify RAG 도큐먼트 삭제 후 회의록 삭제 (Dify 실패 시 회의록 삭제 보호) |

---

## 기술 스택

### Frontend
- **Vue.js 3** — Composition API, `<script setup>`
- **Vite 8** — 빌드 도구, 프록시(`/api` → `:3001`)
- **Tailwind CSS v4** — 유틸리티 기반 스타일링
- **Vue Router 4** — SPA 라우팅 + 네비게이션 가드
- **Chart.js + vue-chartjs** — 대시보드 차트
- **@vueuse/motion** — 페이지 트랜지션 애니메이션

### Backend
- **Express.js 5** — ESM 모듈 기반 REST API 서버
- **MySQL 8** — mysql2/promise 커넥션 풀
- **Multer** — 파일 업로드 (최대 500MB)
- **fluent-ffmpeg** — 오디오 청크 분할 (20MB 단위)
- **Nodemailer** — 이메일 발송
- **Zod** — 요청 데이터 유효성 검증

### AI / 외부 서비스
- **OpenAI Whisper API** — 음성 → 텍스트 변환 (STT)
- **Dify Workflow API** — 회의 요약, 액션 아이템 추출, 감정 분석
- **Pyannote** — 화자 분리 (Diarization) 서비스

### 테스트
- **Vitest** — 단위 테스트
- **Playwright** — E2E 테스트
- **Supertest** — API 통합 테스트

---

## 프로젝트 구조

```
ai-meeting-notes/
├── src/                            # Vue.js 프론트엔드
│   ├── main.js                     # 앱 진입점, 라우터 설정
│   ├── style.css                   # Tailwind + 커스텀 테마
│   ├── App.vue                     # 루트 레이아웃 (사이드바 + 라우터뷰)
│   ├── components/
│   │   ├── SidebarNav.vue          # 좌측 사이드바 네비게이션
│   │   ├── MobileBottomNav.vue     # 모바일 하단 네비게이션
│   │   ├── CommandPalette.vue      # 커맨드 팔레트 (Ctrl+K)
│   │   ├── ToastNotification.vue   # 전역 토스트 알림
│   │   ├── AudioUploader.vue       # 드래그앤드롭 오디오 업로드
│   │   ├── LiveRecorder.vue        # 브라우저 마이크 녹음 (MediaRecorder)
│   │   ├── MeetingCard.vue         # 회의 목록 카드
│   │   ├── MeetingChatbot.vue      # AI 챗봇 컴포넌트
│   │   ├── StatCard.vue            # 대시보드 통계 카드
│   │   ├── ActionItemRow.vue       # 액션 아이템 행 (체크박스)
│   │   ├── SpeakerTimeline.vue     # 화자 타임라인
│   │   ├── AutoAgenda.vue          # 자동 아젠다
│   │   ├── CollaborationIndicator.vue
│   │   ├── NotificationPanel.vue   # 알림 패널
│   │   ├── SkeletonLoader.vue      # 로딩 스켈레톤
│   │   ├── EmptyState.vue          # 빈 상태 표시
│   │   └── charts/                 # 차트 컴포넌트
│   │       ├── BarChart.vue
│   │       ├── DoughnutChart.vue
│   │       └── LineChart.vue
│   ├── views/
│   │   ├── LoginView.vue           # 로그인 페이지
│   │   ├── DashboardView.vue       # 대시보드 (통계, 차트)
│   │   ├── NewMeetingView.vue      # 새 회의 (녹음/업로드 → STT → AI 요약)
│   │   ├── MeetingsListView.vue    # 회의 목록 (필터, 정렬)
│   │   ├── MeetingDetailView.vue   # 회의 상세 (요약, 액션, 전사 탭)
│   │   ├── MeetingAnalysisView.vue # 회의 분석
│   │   ├── ActionItemsView.vue     # 전체 액션 아이템 관리
│   │   ├── SearchView.vue          # 통합 검색
│   │   ├── ChatView.vue            # AI 챗봇 페이지
│   │   ├── RecordingsListView.vue  # 녹음 보관 목록
│   │   ├── RoomListView.vue        # 회의실 목록
│   │   ├── RoomCalendarView.vue    # 회의실 캘린더 예약
│   │   ├── ReportView.vue          # 리포트
│   │   ├── SettingsView.vue        # 설정
│   │   └── AuditLogView.vue        # 감사 로그 (관리자)
│   ├── composables/
│   │   ├── useAuth.js              # 인증 상태 관리
│   │   ├── useDarkMode.js          # 다크 모드 토글
│   │   ├── useSidebar.js           # 사이드바 접기/펼치기
│   │   └── useNotifications.js     # 알림 상태 관리
│   ├── services/
│   │   └── api.js                  # API 클라이언트 (모든 백엔드 통신)
│   └── data/
│       └── mockData.js             # 목 데이터 (한국어)
│
├── server/                         # Express.js 백엔드
│   ├── index.js                    # 서버 진입점 (포트 3001)
│   ├── routes/
│   │   ├── transcribe.js           # POST /api/transcribe — STT
│   │   ├── summarize.js            # POST /api/summarize — AI 요약
│   │   ├── meetings.js             # /api/meetings — 회의 CRUD
│   │   ├── rooms.js                # /api/rooms — 회의실 & 예약
│   │   ├── search.js               # /api/search — 통합 검색
│   │   ├── recordings.js           # /api/recordings — 녹음 보관
│   │   └── chat.js                 # /api/chat — AI 챗봇
│   ├── services/
│   │   ├── database.js             # MySQL 커넥션 풀 (mysql2/promise)
│   │   ├── whisperService.js       # Whisper API STT + 트랜스크립트 병합
│   │   ├── difyService.js          # Dify Workflow API 호출
│   │   ├── chatService.js          # 챗봇 서비스 (Dify)
│   │   ├── audioSplitter.js        # ffmpeg 오디오 청크 분할
│   │   ├── diarizationMerger.js    # 화자 분리 결과 병합
│   │   ├── retryFetch.js           # HTTP 재시도 유틸
│   │   └── validators.js           # Zod 스키마 검증
│   ├── scripts/
│   │   ├── initDb.js               # DB 초기화 (테이블 + 시드 데이터)
│   │   └── addSpeakerMap.js        # DB 마이그레이션
│   ├── uploads/                    # 업로드 임시 저장 (자동 정리)
│   ├── temp/                       # 분할 청크 임시 저장 (자동 정리)
│   └── recordings/                 # 녹음 파일 영구 저장
│
├── tests/                          # 테스트
│   └── e2e/                        # Playwright E2E 테스트
├── docs/                           # 문서
│   └── dify-chatbot-workflow.yml   # Dify 챗봇 워크플로우 설정
├── vite.config.js                  # Vite 설정 (프록시, Tailwind)
└── package.json                    # 의존성 & 스크립트
```

---

## 시작하기

### 사전 요구사항

- **Node.js** 18+
- **MySQL 8** (포트 30306 기본)
- **ffmpeg** 설치 (`brew install ffmpeg`)
- **OpenAI API Key** (Whisper STT)
- **Dify API Key & URL** (AI 요약)

### 1. 프로젝트 클론 & 의존성 설치

```bash
git clone <repository-url>
cd ai-meeting-notes
npm install --legacy-peer-deps
```

> `--legacy-peer-deps`는 Vite 8과 Tailwind의 peer dependency 충돌 해결에 필요합니다.

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다:

```env
# OpenAI (Whisper STT)
OPENAI_API_KEY=sk-xxxxx

# Dify (AI 요약 & 챗봇)
DIFY_API_KEY=app-xxxxx
DIFY_API_URL=https://your-dify-instance/v1
DIFY_CHATBOT_API_KEY=app-xxxxx    # 챗봇 전용 (선택)

# MySQL
DB_HOST=127.0.0.1
DB_PORT=30306
DB_USER=root
DB_PASSWORD=root
DB_NAME=meetings

# 화자 분리 서비스 (선택)
DIARIZE_SERVICE_URL=http://localhost:5000

# 이메일 발송 (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 서버
SERVER_PORT=3001

#RAG 자동생성 에이전트 웹훅 트리거 요청
#DIFY_WEBHOOK_URL=자신의 에이전트 웹훅 URL
```

### 3. 데이터베이스 초기화

```bash
npm run db:init
```

`meetings`, `rooms`, `reservations`, `recordings`, `meeting_rag_docs` 테이블이 생성되고 샘플 데이터가 삽입됩니다.

### 4. 서버 실행

```bash
# 프론트엔드 + 백엔드 동시 실행
npm run dev:all
```

| 서비스 | 주소 | 개별 실행 |
|--------|------|-----------|
| 프론트엔드 | http://localhost:3000 | `npm run dev` |
| 백엔드 API | http://localhost:3001 | `npm run dev:server` |

---

## API 엔드포인트

### 음성 인식 (STT)
| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/transcribe` | 오디오 파일 업로드 → STT 변환 |
| `GET` | `/api/transcribe/health` | STT 서비스 상태 확인 |

### AI 요약
| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/summarize` | 전사 텍스트 → AI 요약 |
| `GET` | `/api/summarize/health` | 요약 서비스 상태 확인 |

### 회의 관리
| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/meetings` | 회의 목록 조회 |
| `GET` | `/api/meetings/stats` | 대시보드 통계 |
| `GET` | `/api/meetings/chart-data` | 차트 데이터 |
| `GET` | `/api/meetings/:id` | 회의 상세 조회 |
| `POST` | `/api/meetings` | 회의 생성 |
| `PUT` | `/api/meetings/:id` | 회의 수정 |
| `DELETE` | `/api/meetings/:id` | 회의 삭제 |
| `PATCH` | `/api/meetings/:id/action-items/:idx` | 액션 아이템 토글 |
| `POST` | `/api/meetings/:id/send-email` | 회의록 메일 발송 |
| `POST` | `/api/meetings/:id/generate-rag` | **[임시]** RAG 수동 생성 (기존 회의록 document_id 채우기용) |

### 회의실 & 예약
| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/rooms` | 회의실 목록 |
| `GET` | `/api/rooms/availability` | 회의실 가용성 조회 |
| `POST` | `/api/rooms/reservations` | 예약 생성 |
| `GET` | `/api/rooms/reservations/list` | 예약 목록 |
| `DELETE` | `/api/rooms/reservations/:id` | 예약 취소 |

### 검색
| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/search` | 회의 통합 검색 |
| `GET` | `/api/search/suggest` | 검색 자동완성 |

### 녹음 보관
| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/recordings` | 녹음 파일 업로드 저장 |
| `GET` | `/api/recordings` | 녹음 목록 조회 |
| `GET` | `/api/recordings/:id` | 녹음 상세 조회 |
| `GET` | `/api/recordings/:id/file` | 오디오 스트리밍 |
| `DELETE` | `/api/recordings/:id` | 녹음 삭제 |
| `POST` | `/api/recordings/:id/transcribe` | 저장된 녹음 STT 변환 |

### AI 챗봇
| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/chat/meeting/:id` | 단일 회의 Q&A |
| `POST` | `/api/chat/search` | 전체 회의 검색 Q&A |

### Dify Knowledge (지식기반)
| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/chatBot/datasets` | Dify 지식 베이스 목록 조회 |
| `GET` | `/api/chatBot/datasets/:id/documents` | Dify 지식 문서 목록 조회 |

---

## 프론트엔드 라우트

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/login` | 로그인 | 사용자 인증 (퍼블릭) |
| `/` | 대시보드 | 통계, 최근 회의, 차트 |
| `/meetings/new` | 새 회의 | 녹음/업로드 → STT → AI 요약 |
| `/meetings` | 회의 목록 | 필터, 정렬, 검색 |
| `/meetings/:id` | 회의 상세 | AI 요약, 액션 아이템, 전사 탭 |
| `/recordings` | 녹음 보관 | 녹음 파일 관리 |
| `/action-items` | 액션 아이템 | 전체 액션 아이템 관리 |
| `/search` | 통합 검색 | 회의 검색 |
| `/chat` | AI 챗봇 | 회의 기반 Q&A |
| `/rooms` | 회의실 | 회의실 목록 & 상태 |
| `/rooms/calendar` | 회의실 캘린더 | 주간 예약 캘린더 |
| `/analysis` | 회의 분석 | 회의 트렌드 분석 |
| `/reports` | 리포트 | 리포트 생성 |
| `/settings` | 설정 | 사용자 설정 |
| `/audit-log` | 감사 로그 | 관리자 전용 |

---

## 데이터베이스 스키마

### meetings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 회의 ID |
| `title` | VARCHAR(255) | 회의 제목 |
| `date` | DATE | 회의 날짜 |
| `time` | VARCHAR(10) | 시작 시간 (HH:MM) |
| `duration` | INT | 회의 시간 (분) |
| `participants` | JSON | 참석자 목록 |
| `status` | ENUM | in-progress / completed / archived |
| `tags` | JSON | 키워드 태그 |
| `ai_summary` | TEXT | AI 생성 요약 |
| `key_decisions` | JSON | 핵심 결정사항 |
| `action_items` | JSON | 액션 아이템 |
| `sentiment` | ENUM | positive / negative / neutral |
| `transcript` | JSON | 발언 기록 [{speaker, time, text}] |
| `full_text` | TEXT | STT 전체 텍스트 (FULLTEXT 인덱스) |
| `speaker_map` | JSON | 화자 이름 매핑 |

### rooms
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(20) (PK) | 회의실 ID |
| `name` | VARCHAR(100) | 회의실 이름 |
| `building` | VARCHAR(50) | 건물 |
| `floor` | VARCHAR(20) | 층 |
| `capacity` | INT | 수용 인원 |
| `equipment` | JSON | 보유 장비 |
| `status` | ENUM | available / maintenance |

### reservations
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(50) (PK) | 예약 ID |
| `room_id` | VARCHAR(20) (FK) | 회의실 ID |
| `title` | VARCHAR(255) | 회의 주제 |
| `date` | DATE | 예약 날짜 |
| `start_time` / `end_time` | VARCHAR(10) | 시작/종료 시간 |
| `organizer` | VARCHAR(50) | 주최자 |
| `participants` | JSON | 참석자 |
| `status` | ENUM | confirmed / cancelled |

### recordings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 녹음 ID |
| `file_name` | VARCHAR(255) | 파일명 |
| `file_path` | VARCHAR(500) | 서버 저장 경로 |
| `file_size` | BIGINT | 파일 크기 (바이트) |
| `duration` | INT | 녹음 길이 (초) |
| `status` | ENUM | pending / transcribed / completed |
| `meeting_id` | INT (FK) | 연결된 회의 ID |

### meeting_rag_docs
`meetings` 테이블과 Dify 지식 도큐먼트 간 매핑 테이블. `meetings`에 컬럼을 추가하지 않고 별도 테이블로 분리하여 기존 코드에 영향 없이 RAG 연동 상태를 관리한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK, AUTO_INCREMENT) | 매핑 ID |
| `meeting_id` | INT (UNIQUE, FK) | 회의 ID (`meetings.id`) |
| `document_id` | VARCHAR(255) | Dify 지식 도큐먼트 ID (에이전트 응답 후 업데이트) |
| `status` | ENUM | pending / completed / failed |
| `error_msg` | TEXT | 실패 시 에러 메시지 |
| `created_at` | TIMESTAMP | 생성 시각 |
| `updated_at` | TIMESTAMP | 최종 수정 시각 |

---

## NPM 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 프론트엔드 개발 서버 (포트 3000) |
| `npm run dev:server` | 백엔드 서버 (포트 3001) |
| `npm run dev:all` | 프론트엔드 + 백엔드 동시 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run db:init` | DB 초기화 (테이블 + 시드 데이터) |
| `npm run db:migrate` | DB 마이그레이션 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:watch` | 테스트 워치 모드 |
| `npm run test:e2e` | E2E 테스트 (Playwright) |

---

## Dify RAG 자동 생성 연동

회의록이 DB에 저장되는 시점에 Dify RAG 에이전트(Workflow 앱)를 자동 호출하여 해당 회의록을 Dify 지식 도큐먼트로 등록하고, 발급된 document_id를 `meeting_rag_docs` 테이블에 저장하는 기능입니다.

### 플로우

```
POST /api/meetings (신규 생성)
        │
        ▼
  MySQL meetings 저장 → meeting_id 채번
        │
        ▼
  meeting_rag_docs INSERT { meeting_id, status: 'pending' }
        │
        ▼
  Dify Workflow API 비동기 호출
  POST {DIFY_API_URL}/workflows/run
  inputs: { id, gubun: 'C', document_id: '', title, test }
        │
        ├─ 성공 → outputs.body 파싱 → document.id 추출
        │         meeting_rag_docs UPDATE { document_id, status: 'completed' }
        │
        └─ 실패 → meeting_rag_docs UPDATE { error_msg, status: 'failed' }

PUT /api/meetings/:id (수정)
        │
        ▼
  MySQL meetings 업데이트
        │
        ▼
  기존 document_id 조회 (meeting_rag_docs) ← UPSERT 전에 먼저 조회
        │
        ▼
  meeting_rag_docs UPSERT { status: 'pending', document_id: NULL }
        │
        ▼
  Dify Workflow API 비동기 호출
  POST {DIFY_API_URL}/workflows/run
  inputs: { id, gubun: existingDocumentId ? 'U' : 'C', document_id: <기존값 or ''>, title, test }
        │
        ├─ 성공 → document_id 수신
        │         meeting_rag_docs UPDATE { document_id, status: 'completed' }
        │
        └─ 실패 → meeting_rag_docs UPDATE { error_msg, status: 'failed' }

DELETE /api/meetings/:id (삭제)
        │
        ▼
  document_id 있음?
        │
        ├─ 있음 → Dify Workflow API 동기 호출
        │         inputs: { id, gubun: 'D', document_id, meetings_note }
        │         ├─ 성공 → meetings DELETE (meeting_rag_docs CASCADE)
        │         └─ 실패 → 에러 반환, meetings 삭제 안 함
        │
        └─ 없음 → meetings DELETE (Dify 호출 없음)
```

### 구현 현황

| 단계 | 상태 | 설명 |
|------|------|------|
| meeting_rag_docs 매핑 테이블 생성 | **완료** | NAS MySQL에 테이블 생성 완료 |
| meeting_rag_docs 매핑 테이블 생성 | **완료** | NAS MySQL에 테이블 생성 완료 (ON DELETE CASCADE) |
| 신규 회의 저장 시 RAG 에이전트 호출 | **완료** | Dify Workflow API 비동기 호출 (gubun: 'C', document_id: '' 필수 포함) |
| 회의 수정 시 RAG 에이전트 재호출 | **완료** | SELECT → UPSERT 순서 보장, existingDocumentId 없으면 gubun: 'C' 자동 전환 |
| 회의 삭제 시 RAG 에이전트 삭제 호출 | **완료** | Dify 동기 호출 성공 후 meetings 삭제 (gubun: 'D') |
| Dify 응답 파싱 | **완료** | `outputs.body` JSON 파싱 → `document.id` 추출 |
| 회의 상세 삭제 버튼 | **완료** | 확인 모달 포함, Dify 실패 시 삭제 차단 |
| 기존 회의록 RAG 수동 생성 (임시) | **완료** | `POST /api/meetings/:id/generate-rag` — 작업 완료 후 삭제 예정 |
| Dify inputs title 필드 분리 | **완료** | meetings.title 컬럼값을 `test` JSON과 별도로 `title` 필드로 전송 |
| 서버 배포 | **완료** | .env 포함 서버 업로드, docker compose restart 완료 |
| Dify 워크플로우 C/U/D 분기 처리 | **미완료** | Dify 에이전트 쪽 gubun 분기 구현 필요 |
| Dify 모델 컨텍스트 확장 | **미완료** | 현재 모델 8192 토큰 한계 — 더 큰 컨텍스트 모델로 교체 필요 |

### 에이전트 inputs 구조

```json
{
  "id": "123",
  "gubun": "C",
  "document_id": "",
  "title": "회의 제목",
  "test": "{\"id\":123,\"title\":\"...\",\"date\":\"...\", ... }"
}
```

- `gubun`: `'C'` = 생성(Create), `'U'` = 수정(Update), `'D'` = 삭제(Delete)
- `document_id`: 수정/삭제 시 기존 Dify 도큐먼트 ID (신규 생성 시 빈 문자열)
- `title`: meetings 테이블의 `title` 컬럼값 (별도 필드로 분리)
- `test`: `formatMeeting()` 결과를 JSON 직렬화한 문자열 (Dify 워크플로우 입력 폼 변수명)

### 환경 변수

```env
# Dify RAG 자동생성 에이전트 API 키 (Workflow 앱 — 키 자체가 특정 앱을 식별)
DIFY_RAG_AGENT_API_KEY=app-xxxxxxxxxxxx
```

---

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Vue.js SPA    │────▶│  Express API    │────▶│   MySQL DB   │
│  (포트 3000)     │     │  (포트 3001)     │     │  (포트 30306) │
└─────────────────┘     └────────┬────────┘     └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │  OpenAI   │ │   Dify   │ │ Pyannote │
             │  Whisper  │ │ Workflow │ │ Speaker  │
             │  (STT)    │ │ (요약)    │ │ (화자분리) │
             └──────────┘ └──────────┘ └──────────┘
```

- Vite 개발 서버가 `/api` 요청을 Express 서버로 프록시
- API 키는 모두 서버 사이드에서만 사용 (브라우저에 노출되지 않음)
- 25MB 초과 오디오는 ffmpeg로 20MB 청크로 분할 후 순차 STT
- Dify Workflow API 호출에 120초 타임아웃 적용

---

## 환경 변수 요약

| 변수 | 필수 | 설명 | 기본값 |
|------|:----:|------|--------|
| `OPENAI_API_KEY` | O | OpenAI API 키 (Whisper) | — |
| `DIFY_API_KEY` | O | Dify Workflow API 키 (회의 요약용) | — |
| `DIFY_API_URL` | O | Dify API URL | — |
| `DIFY_CHAT_API_KEY` | X | 챗봇 전용 Dify 키 | — |
| `DIFY_RAG_AGENT_API_KEY` | X | RAG 자동생성 에이전트 API 키 (Workflow 앱) | — |
| `DIFY_KNOWLEDGE_API_KEY` | X | Dify 지식 API 키 (지식기반 조회용) | — |
| `DB_HOST` | X | MySQL 호스트 | `127.0.0.1` |
| `DB_PORT` | X | MySQL 포트 | `30306` |
| `DB_USER` | X | MySQL 사용자 | `root` |
| `DB_PASSWORD` | X | MySQL 비밀번호 | `root` |
| `DB_NAME` | X | MySQL 데이터베이스명 | `meetings` |
| `DIARIZE_SERVICE_URL` | X | Pyannote 화자분리 URL | `http://localhost:5000` |
| `SMTP_HOST` | X | SMTP 서버 호스트 | — |
| `SMTP_PORT` | X | SMTP 포트 | — |
| `SMTP_USER` | X | SMTP 사용자 | — |
| `SMTP_PASS` | X | SMTP 비밀번호 | — |
| `SERVER_PORT` | X | 백엔드 서버 포트 | `3001` |
