# 개발 및 배포 가이드

## 1. 로컬 개발 환경 실행

### 사전 준비
- **Mac**: Node.js 설치 (`brew install node`)
- **Windows**: [Node.js 다운로드](https://nodejs.org) 후 설치

### 실행
```bash
npm install --legacy-peer-deps
npm run dev:all
```
브라우저에서 `http://localhost:3000` 접속

---

## 2. 서버 배포

### 사전 준비
- **Mac**: 터미널 사용
- **Windows**: WinSCP(SFTP) + PuTTY 또는 Windows Terminal(SSH)

### 서버 접속 정보
| 항목 | 값 |
|------|-----|
| 호스트 | `112.172.10.200` |
| 포트 | `2222` |
| 계정 | `deploy` |

### 배포 순서

**Step 1 — 수정한 파일 SFTP 업로드**

- Mac:
```bash
sftp -P 2222 deploy@112.172.10.200
put 수정한파일 ai-meeting-notes-main/경로/
```
- Windows: WinSCP 또는 FileZilla로 접속 후 `~/ai-meeting-notes-main/` 경로에 업로드

**Step 2 — 서버 접속 후 빌드**
```bash
ssh -p 2222 deploy@112.172.10.200
~/deploy.sh
```
- Windows: PuTTY로 접속 후 동일하게 `~/deploy.sh` 실행

빌드 완료 후 `https://meetings.suooclub.com` 에서 확인
