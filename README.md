# AI 스마트 회의록 (AI Smart Meeting Notes)

브라우저에서 회의를 녹음하거나 오디오 파일을 업로드하면, OpenAI Whisper API를 통해 자동으로 텍스트로 변환하고 타임라인 기반 회의록을 생성하는 풀스택 웹 애플리케이션입니다.

## 주요 기능

- **실시간 녹음** — 브라우저 마이크(MediaRecorder API)로 회의를 직접 녹음 (audio/webm)
- **파일 업로드** — 기존 오디오 파일(webm, mp3, wav, m4a, ogg, flac) 드래그 앤 드롭 업로드
- **대용량 파일 자동 분할** — 25MB 초과 파일은 ffmpeg로 20MB 단위 분할 후 순차 처리
- **AI 음성 인식(STT)** — OpenAI Whisper API를 통한 한국어 음성-텍스트 변환
- **타임스탬프 병합** — 분할된 전사 결과를 시간 오프셋 기반으로 하나의 완벽한 트랜스크립트로 병합
- **대시보드** — 회의 통계, 최근 회의, 예정 회의, 액션 아이템 현황 한눈에 확인
- **회의 상세 뷰** — AI 요약, 주요 결정사항, 액션 아이템(체크박스), 회의록 탭
- **액션 아이템 관리** — 전체 회의의 액션 아이템 통합 관리, 진행률 추적

## 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | Vue.js 3 (Composition API), Vite 8, Tailwind CSS v4, Vue Router 4 |
| **백엔드** | Express.js 5, Multer (파일 업로드), fluent-ffmpeg (오디오 분할) |
| **AI** | OpenAI Whisper API (STT) |
| **오디오** | MediaRecorder API (브라우저 녹음), ffmpeg (서버 분할) |

## 프로젝트 구조

```
src/                              # Vue.js 프론트엔드
├── main.js                       # 앱 진입점, 라우터 설정
├── style.css                     # Tailwind CSS + 커스텀 테마 색상
├── App.vue                       # 루트 레이아웃 (사이드바 + router-view)
├── components/
│   ├── SidebarNav.vue            # 좌측 네비게이션 사이드바
│   ├── StatCard.vue              # 대시보드 통계 카드
│   ├── MeetingCard.vue           # 회의 목록 카드
│   ├── ActionItemRow.vue         # 액션 아이템 행 (체크박스)
│   ├── AudioUploader.vue         # 드래그 앤 드롭 오디오 업로드
│   └── LiveRecorder.vue          # 실시간 마이크 녹음 컴포넌트
├── views/
│   ├── DashboardView.vue         # 메인 대시보드
│   ├── MeetingsListView.vue      # 회의 목록 (검색/필터)
│   ├── MeetingDetailView.vue     # 회의 상세 (AI 요약, 액션, 회의록 탭)
│   ├── ActionItemsView.vue       # 전체 액션 아이템 관리
│   └── NewMeetingView.vue        # 실시간 녹음 / 파일 업로드 → STT 결과
├── services/
│   └── api.js                    # 백엔드 API 클라이언트 (XHR + 진행률)
└── data/
    └── mockData.js               # 목업 데이터 (한국어)

server/                           # Express.js 백엔드
├── index.js                      # 서버 진입점 (포트 3001, CORS)
├── routes/
│   └── transcribe.js             # POST /api/transcribe (업로드 → 분할 → STT → 응답 → 정리)
├── services/
│   ├── audioSplitter.js          # ffmpeg 기반 오디오 분할 (20MB 단위)
│   └── whisperService.js         # Whisper API 호출 + 타임스탬프 병합
├── uploads/                      # 업로드 임시 저장 (자동 삭제)
└── temp/                         # 분할 청크 임시 저장 (자동 삭제)
```

## 시작하기

### 사전 요구사항

- **Node.js** 18 이상
- **ffmpeg** 설치 (`brew install ffmpeg`)
- **OpenAI API 키**

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install --legacy-peer-deps

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 OPENAI_API_KEY 값을 입력

# 3. 프론트엔드 + 백엔드 동시 실행
npm run dev:all
```

| 서비스 | 주소 | 개별 실행 |
|--------|------|-----------|
| 프론트엔드 | http://localhost:3000 | `npm run dev` |
| 백엔드 API | http://localhost:3001 | `npm run dev:server` |

### 스크립트

```bash
npm run dev          # 프론트엔드 개발 서버 (포트 3000)
npm run dev:server   # 백엔드 서버 (포트 3001)
npm run dev:all      # 프론트엔드 + 백엔드 동시 실행
npm run build        # 프론트엔드 프로덕션 빌드
```

## 페이지 안내

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | 대시보드 | 통계 카드, 최근/예정 회의, 진행 중 회의 배너, 미완료 액션 아이템 |
| `/meetings/new` | 새 회의록 | 실시간 녹음 또는 파일 업로드 → AI STT → 타임라인 결과 |
| `/meetings` | 회의 목록 | 제목/태그 검색, 상태 필터링 |
| `/meetings/:id` | 회의 상세 | AI 요약, 주요 결정사항, 액션 아이템, 회의록 탭 |
| `/action-items` | 액션 아이템 | 전체 회의 액션 아이템 통합 관리, 진행률 바 |

## API 엔드포인트

### `POST /api/transcribe`

오디오 파일을 업로드하여 STT 처리합니다.

- **Content-Type**: `multipart/form-data`
- **필드**: `audio` (파일), `language` (선택, 기본값 `ko`)

```
25MB 이하 → 직접 Whisper API 전송
25MB 초과 → ffmpeg 20MB 분할 → 순차 전사 → 타임스탬프 병합
```

응답 예시:
```json
{
  "success": true,
  "data": {
    "fullText": "전사된 전체 텍스트...",
    "segments": [
      { "id": 0, "start": 0.0, "end": 5.2, "text": "안녕하세요..." }
    ],
    "meta": {
      "originalFileName": "회의녹음.webm",
      "fileSizeMB": 12.5,
      "totalDuration": 320.5,
      "segmentCount": 48,
      "chunkCount": 1,
      "language": "ko"
    }
  }
}
```

### `GET /api/transcribe/health`

서비스 상태 및 OpenAI API 키 설정 여부를 확인합니다.

## 환경 변수

| 변수 | 필수 | 설명 | 기본값 |
|------|------|------|--------|
| `OPENAI_API_KEY` | O | OpenAI API 키 | — |
| `SERVER_PORT` | X | 백엔드 서버 포트 | `3001` |
