# NoteFlow 업데이트 공지 (2026-04-29)

안녕하세요. NoteFlow 업데이트 내용을 안내드립니다.

---

## 주요 변경사항

### 1. 신규 회의 저장 시 RAG 에이전트 호출 실패 버그 수정

회의록을 새로 저장할 때 Dify RAG 에이전트가 호출되지 않던 문제를 수정했습니다.

- **원인:** Dify 에이전트 필수 입력값인 `document_id` 필드가 요청에 포함되지 않아 워크플로우 실패
- **수정:** 신규 생성 시 `document_id: ''`(빈 문자열)을 명시적으로 포함하도록 변경

### 2. 회의 수정 시 기존 document_id 미전달 버그 수정

회의록을 편집·저장할 때 Dify에 기존 도큐먼트 ID가 전달되지 않던 문제를 수정했습니다.

- **원인:** DB에서 기존 `document_id`를 조회하기 전에 UPSERT로 해당 값을 NULL로 초기화하여 항상 빈 값이 전달됨
- **수정:** `document_id` 조회를 UPSERT 앞으로 순서 변경

### 3. document_id 없는 회의 수정 시 Dify 404 오류 수정

RAG가 한 번도 생성되지 않은 회의를 수정할 때 Dify 에이전트가 404를 반환하던 문제를 수정했습니다.

- **원인:** `document_id`가 없는 상태에서 `gubun: 'U'`(수정)으로 요청 → Dify에서 존재하지 않는 도큐먼트 수정 시도
- **수정:** `document_id`가 없으면 자동으로 `gubun: 'C'`(신규 생성)으로 전환

최종 수정 후 `gubun` 결정 로직:

```
신규 생성: gubun = 'C', document_id = ''
수정:
  └─ 기존 document_id 있음 → gubun = 'U', document_id = <기존값>
  └─ 기존 document_id 없음 → gubun = 'C', document_id = ''
삭제: gubun = 'D', document_id = <기존값>
```

### 4. 서버 환경 변수 배포 완료

서버의 `.env` 파일에 `DIFY_RAG_AGENT_API_KEY`가 누락되어 있던 문제를 해결했습니다.

- 로컬 `.env` 파일을 서버에 업로드 후 Docker 컨테이너 재시작 완료

---

## 배포 전 체크리스트

- [ ] Dify 워크플로우에 `gubun = 'C'` / `'U'` / `'D'` 분기 처리 추가
- [ ] Dify 워크플로우 LLM 모델을 컨텍스트가 큰 모델로 교체 (현재 8192 토큰 한계)
- [ ] 기존 회의록 `[임시] RAG 생성` 버튼으로 document_id 채우기 완료
- [ ] 수동 생성 완료 후 `[임시] RAG 생성` 버튼 및 `generate-rag` 엔드포인트 코드 제거
- [ ] 수정된 `server/routes/meetings.js` 서버 배포 (sftp → `docker compose restart`)

---

## 참고

- 기존에 저장된 회의록은 `meeting_rag_docs` 테이블에 `document_id`가 없는 상태일 수 있습니다. 수정 저장 시 자동으로 `gubun: 'C'`로 전환되어 신규 생성 처리됩니다.
- 녹음 파일은 회의록 삭제 시 함께 삭제되지 않으며 별도로 관리됩니다.
