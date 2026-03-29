---
name: recordings-preservation-design
description: 녹음 보존 시스템 설계 - 녹음 파일 영구 저장, 나중에 STT 변환, 녹음 보관함 기능
type: project
---

## 녹음 보존 시스템 설계 (2026-03-29)

**Why:** 현재 녹음 후 STT를 바로 진행하지 않으면 페이지 이탈 시 녹음 데이터가 소멸됨. STT 완료 후에도 원본 오디오가 삭제되어 다시 들을 수 없음.

**How to apply:** recordings 테이블 + 파일 저장소 + 녹음 보관함 UI로 해결

### DB: recordings 테이블
- id, file_name, file_path, file_size, mime_type, duration, status(pending/transcribed/completed), meeting_id(FK), created_at

### API 엔드포인트
- POST /api/recordings - 녹음 파일 업로드 저장
- GET /api/recordings - 목록 조회
- GET /api/recordings/:id - 상세
- GET /api/recordings/:id/file - 오디오 스트리밍
- DELETE /api/recordings/:id - 삭제
- POST /api/recordings/:id/transcribe - 저장된 녹음으로 STT

### 파일 저장 구조
- server/recordings/YYYY-MM/UUID.ext (월별 디렉토리, UUID 파일명)

### 프론트엔드
- LiveRecorder: 녹음 완료 시 자동 서버 저장
- RecordingsListView: /recordings 녹음 보관함
- MeetingDetailView: 원본 재생 버튼

### 구현 순서
1. DB 스키마 → 2. API → 3. 스트리밍 → 4. LiveRecorder 연동 → 5. 녹음 목록 뷰 → 6. STT 연동 → 7. 회의 상세 재생
