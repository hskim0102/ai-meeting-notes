# Dify 지식기반 회의목록 연동 구현 정리

## 환경 변수 (.env)
| 변수명 | 용도 |
|---|---|
| `DIFY_KNOWLEDGE_API_KEY` | 지식 베이스 API 인증 키 |
| `DIFY_API_URL` | Dify API 베이스 URL (예: `https://api.dify.ai/v1`) |

---

## 1. 백엔드 API (`server/routes/chatBot.js`)

라우트 등록: `server/index.js` → `app.use('/api/chatBot', chatBotRouter)`

### 엔드포인트 목록
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/chatBot/datasets` | 지식 리스트 조회 |
| GET | `/api/chatBot/datasets/:dataset_id/documents` | 문서(회의록) 리스트 조회 |
| GET | `/api/chatBot/datasets/:dataset_id/documents/:document_id` | 문서 상세 조회 |

### 공통 패턴
- 인증: `Authorization: Bearer ${DIFY_KNOWLEDGE_API_KEY}`
- 환경 변수 미설정 시 500 반환
- Dify API 오류 시 원본 status code 그대로 전달
- 응답 형식: `{ success: true, data: <Dify 원본 응답> }`

---

## 2. 프론트엔드 API 함수 (`src/services/api.js`)

```js
fetchDifyDatasets(page = 1, limit = 20)           // 지식 리스트 조회
fetchDifyDocuments(datasetId, page = 1, limit = 20) // 문서 리스트 조회
fetchDifyDocument(datasetId, documentId)            // 문서 상세 조회
```

---

## 3. 화면 (`src/views/KnowledgeMeetingsView.vue`)

### 라우트 및 메뉴
- 경로: `/knowledge-meetings`
- 메뉴명: `회의목록 (지식기반)` (`src/components/SidebarNav.vue`, icon: `knowledge`)
- 라우트 등록: `src/main.js`

### 화면 구조
```
[헤더] 회의목록 (지식기반)
[카테고리 탭] 지식 리스트를 버튼으로 표시 → 클릭 시 해당 지식의 문서 목록 로드
[검색 바] 회의록 이름으로 실시간 검색 (건수 표시)
[문서 목록] 카드 형태 (이름, 생성일, 단어 수, 토큰, 인덱싱 상태 뱃지)
```

### 주요 동작
- 진입 시 첫 번째 지식 자동 선택 및 문서 목록 로드
- 카테고리 탭 전환 시 검색어 초기화
- 표현 불가 데이터는 `dummy` 표기

### 검색 구현 주의사항
```js
// NFC 정규화: Dify 응답의 한글이 NFD 형태일 경우 매칭 실패 방지
// Vue 3 v-model이 IME 조합을 자체 처리하므로 compositionstart/end 별도 처리 불필요
// (별도 처리 시 오히려 검색창 이탈 후에만 동작하는 버그 발생)
const query = searchQuery.value.normalize('NFC').toLowerCase()
doc.name?.normalize('NFC').toLowerCase().includes(query)
```

### 인덱싱 상태 뱃지
| `indexing_status` 값 | 표시 | 색상 |
|---|---|---|
| `completed` | 완료 | 초록 |
| `indexing` | 인덱싱 중 | 파랑 |
| `error` | 오류 | 빨강 |
| 기타 / 없음 | `dummy` | 회색 |

---

## 4. 미구현 / 향후 과제

### AI 챗봇 (현재 코드 제거된 상태)
- 회의목록(지식기반) 화면에 체크박스 및 전체선택 체크박스 추가
- 회의록 선택 후 우측 하단의 채팅 버튼 클릭 시 우측에서 dify 채팅에이전트 채팅 모달 나오게

---

## 5. 공통 정책
- 기존 프로젝트 구조 및 설치된 패키지 내에서만 개발 (추가 패키지 설치 금지)