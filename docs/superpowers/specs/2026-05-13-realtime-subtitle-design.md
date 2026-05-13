# 실시간 자막 기능 설계 스펙

**날짜:** 2026-05-13  
**상태:** 승인됨  
**관련 파일:** `src/components/LiveRecorder.vue`, `src/views/NewMeetingView.vue`

---

## 개요

회의 녹음 중 음성 내용을 실시간 자막으로 화면 하단에 표시한다. 브라우저 내장 Web Speech API로 즉각적인 자막을 먼저 보여주고, 15초 주기로 오디오 청크를 기존 Whisper API(`/api/transcribe`)로 전송하여 정확한 텍스트로 교체한다.

---

## 아키텍처

### 데이터 흐름

```
[마이크 스트림]
    │
    ├──▶ SpeechRecognition (브라우저 내장, ko-KR)
    │         └──▶ interim/confirmed 세그먼트 → SubtitleOverlay 표시
    │
    └──▶ MediaRecorder (기존 — 전체 Blob 유지)
              └──▶ 15초 청크 큐
                        └──▶ POST /api/transcribe
                                  └──▶ whisper 세그먼트로 교체
```

### 세그먼트 데이터 구조

```js
{
  id: string,        // 고유 ID (crypto.randomUUID())
  text: string,      // 표시 텍스트
  startTime: number, // 녹음 시작 기준 경과 초
  endTime: number,   // 세그먼트 종료 시각 (초)
  status: 'interim' | 'confirmed' | 'whisper'
}
```

---

## 컴포넌트 설계

### 신규 파일

#### `src/composables/useSubtitleEngine.js`

SpeechRecognition과 Whisper 청크 스케줄러를 관리하는 composable.

**공개 인터페이스:**
```js
const {
  segments,        // Ref<Segment[]> — 전체 세그먼트 배열
  isListening,     // Ref<boolean>
  startSubtitles,  // (mediaRecorder) => void
  stopSubtitles,   // () => void
  clearSegments,   // () => void
} = useSubtitleEngine()
```

**내부 동작:**
- `SpeechRecognition` 인스턴스 생성 (`continuous: true`, `interimResults: true`, `lang: 'ko-KR'`)
- `onresult`: interim 세그먼트를 실시간 업데이트, final 결과는 confirmed로 승격
- 15초 interval: `mediaRecorder.requestData()` 후 수집된 청크를 `/api/transcribe`로 전송
- 청크 전송 응답 시 해당 `startTime~endTime` 범위의 세그먼트를 Whisper 결과로 교체
- Web Speech API 미지원 시 Whisper 전용 모드로 폴백 (플래그 노출)
- SpeechRecognition 오류 발생 시 자동 재시작 (최대 3회)

#### `src/components/SubtitleOverlay.vue`

화면 하단 고정 오버레이 컴포넌트.

**Props:**
```js
props: {
  segments: Array,    // Segment[]
  isListening: Boolean,
  visible: Boolean,
}
```

**Emits:** `close`

**레이아웃:**
```
┌─────────────────────────────────────────────────────┐
│ 🎙 실시간 자막                          [최소화] [✕] │
├─────────────────────────────────────────────────────┤
│  00:12  안녕하세요 오늘 회의를 시작하겠습니다   ✦   │
│  00:28  먼저 진행 상황을 공유해 드리겠습니다    ✦   │
│  ▌현재 인식 중인 텍스트...                          │
└─────────────────────────────────────────────────────┘
```

**세그먼트 시각적 구분:**

| 상태 | 스타일 |
|------|--------|
| `interim` | 회색 텍스트 + 점선 왼쪽 테두리 + 깜빡이는 커서 |
| `confirmed` | 기본 텍스트 색상 |
| `whisper` | 진한 색상 + 왼쪽 `✦` 아이콘 |

**동작:**
- 녹음 시작 시 슬라이드업 애니메이션으로 등장
- 새 세그먼트 추가 시 자동 스크롤 다운 (사용자가 위로 스크롤 중이면 중단)
- 최소화 버튼으로 접기/펼치기
- 오버레이 열릴 때 페이지 하단 `padding-bottom` 자동 추가 (콘텐츠 가림 방지)
- 녹음 중지 후에도 유지, X 버튼으로 닫기

### 수정 파일

#### `src/components/LiveRecorder.vue`

- `useSubtitleEngine` composable 연결
- `startRecording()`: `startSubtitles(mediaRecorder)` 호출
- `stopRecording()`: `stopSubtitles()` 호출
- `discardRecording()`: `clearSegments()` 호출
- template에 `SubtitleOverlay` 컴포넌트 추가

---

## 엣지케이스 처리

| 상황 | 처리 방법 |
|------|-----------|
| Web Speech API 미지원 | Whisper 청크 전용 모드 폴백, 안내 문구 표시 |
| SpeechRecognition 오류 | 자동 재시작 (최대 3회), 이후 폴백 |
| Whisper 응답 지연 | confirmed 세그먼트 유지, 응답 오면 교체 |
| Whisper 청크 전송 실패 | 조용히 무시, 다음 청크에서 재시도 |
| 오버레이가 콘텐츠 가림 | 오버레이 높이만큼 하단 padding 자동 추가/제거 |
| 녹음 중지 후 Whisper 응답 도착 | 세그먼트 교체 계속 허용 (최종 결과 개선) |

---

## 서버 변경사항

**없음.** 기존 `POST /api/transcribe` 엔드포인트를 그대로 사용한다.  
청크 전송 시 `language: 'ko'` 파라미터는 기존과 동일.

---

## 변경 파일 요약

| 파일 | 변경 유형 |
|------|----------|
| `src/composables/useSubtitleEngine.js` | 신규 |
| `src/components/SubtitleOverlay.vue` | 신규 |
| `src/components/LiveRecorder.vue` | 수정 |

---

## 미구현 범위 (Out of Scope)

- 화자 분리와 자막 연동
- 자막 텍스트 내보내기
- 자막 폰트 크기/색상 설정
