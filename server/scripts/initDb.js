/**
 * server/scripts/initDb.js - 데이터베이스 초기화 스크립트
 * ─────────────────────────────────────────────────
 * meetings DB 생성, 테이블 생성, 시드 데이터 삽입
 * 실행: node server/scripts/initDb.js
 * ─────────────────────────────────────────────────
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '30306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
}

const DB_NAME = process.env.DB_NAME || 'meetings'

async function run() {
  console.log('═══════════════════════════════════════════════')
  console.log('  AI 스마트 회의록 - 데이터베이스 초기화')
  console.log('═══════════════════════════════════════════════')
  console.log(`  대상: ${DB_CONFIG.host}:${DB_CONFIG.port}`)
  console.log(`  DB명: ${DB_NAME}`)
  console.log('')

  // ── 1. DB 생성 ──
  const conn = await mysql.createConnection(DB_CONFIG)
  console.log('[1/4] MySQL 연결 성공')

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  console.log(`[2/4] 데이터베이스 '${DB_NAME}' 생성 완료`)

  await conn.query(`USE \`${DB_NAME}\``)

  // ── 2. 테이블 생성 ──
  console.log('[3/4] 테이블 생성 중...')

  // 회의 테이블
  await conn.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL COMMENT '회의 제목',
      date DATE NOT NULL COMMENT '회의 날짜',
      time VARCHAR(10) NOT NULL COMMENT '회의 시작 시간 (HH:MM)',
      duration INT DEFAULT 0 COMMENT '회의 시간 (분)',
      participants JSON COMMENT '참석자 목록 ["이름1", "이름2"]',
      status ENUM('in-progress', 'completed', 'archived') DEFAULT 'in-progress' COMMENT '회의 상태',
      tags JSON COMMENT '키워드 태그 ["태그1", "태그2"]',
      ai_summary TEXT COMMENT 'AI 생성 요약 (TL;DR)',
      key_decisions JSON COMMENT '핵심 결정사항 ["결정1", "결정2"]',
      action_items JSON COMMENT '액션 아이템 [{"text","assignee","dueDate","done"}]',
      sentiment ENUM('positive', 'negative', 'neutral') DEFAULT 'neutral' COMMENT '회의 분위기',
      transcript JSON COMMENT '발언 기록 [{"speaker","time","text"}]',
      full_text TEXT COMMENT 'STT 전체 텍스트 (검색용)',
      speaker_map JSON DEFAULT NULL COMMENT '화자 이름 매핑 {"SPEAKER_00": "김부장"}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date (date),
      INDEX idx_status (status),
      FULLTEXT INDEX ft_search (title, ai_summary, full_text)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회의 정보'
  `)
  console.log('  ✓ meetings 테이블')

  // 회의실 테이블
  await conn.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(20) PRIMARY KEY COMMENT '회의실 ID',
      name VARCHAR(100) NOT NULL COMMENT '회의실 이름',
      building VARCHAR(50) COMMENT '건물',
      floor VARCHAR(20) COMMENT '층',
      detail VARCHAR(100) COMMENT '상세 위치',
      capacity INT DEFAULT 0 COMMENT '수용 인원',
      equipment JSON COMMENT '보유 장비 ["프로젝터", "화이트보드"]',
      status ENUM('available', 'maintenance') DEFAULT 'available' COMMENT '회의실 상태',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회의실 정보'
  `)
  console.log('  ✓ rooms 테이블')

  // 예약 테이블
  await conn.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(50) PRIMARY KEY COMMENT '예약 ID',
      room_id VARCHAR(20) NOT NULL COMMENT '회의실 ID',
      title VARCHAR(255) NOT NULL COMMENT '회의 주제',
      date DATE NOT NULL COMMENT '예약 날짜',
      start_time VARCHAR(10) NOT NULL COMMENT '시작 시간 (HH:MM)',
      end_time VARCHAR(10) NOT NULL COMMENT '종료 시간 (HH:MM)',
      organizer VARCHAR(50) NOT NULL COMMENT '주최자',
      participants JSON COMMENT '참석자 목록',
      linked_meeting_id INT COMMENT '연결된 회의 ID',
      status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed' COMMENT '예약 상태',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_room_date (room_id, date),
      INDEX idx_date (date),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회의실 예약'
  `)
  console.log('  ✓ reservations 테이블')

  // 녹음 보관 테이블
  await conn.query(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL COMMENT '표시용 파일명',
      file_path VARCHAR(500) NOT NULL COMMENT '서버 저장 경로',
      file_size BIGINT NOT NULL COMMENT '파일 크기 (바이트)',
      mime_type VARCHAR(100) DEFAULT 'audio/webm' COMMENT 'MIME 타입',
      duration INT DEFAULT 0 COMMENT '녹음 길이 (초)',
      status ENUM('pending', 'transcribed', 'completed') DEFAULT 'pending' COMMENT '처리 상태',
      meeting_id INT DEFAULT NULL COMMENT '연결된 회의 ID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_created (created_at),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='녹음 보관'
  `)
  console.log('  ✓ recordings 테이블')

  // ── 3. 시드 데이터 삽입 ──
  console.log('[4/4] 시드 데이터 삽입 중...')

  // 기존 데이터 정리 (재실행 시 중복 방지)
  await conn.query('DELETE FROM reservations')
  await conn.query('DELETE FROM rooms')
  await conn.query('DELETE FROM meetings')
  // AUTO_INCREMENT 리셋
  await conn.query('ALTER TABLE meetings AUTO_INCREMENT = 1')

  // 회의 데이터
  const meetingsData = [
    {
      title: '2026년 1분기 제품 로드맵 리뷰',
      date: '2026-03-13', time: '10:00', duration: 65,
      participants: JSON.stringify(['김민수', '이서연', '박준혁', '정하은']),
      status: 'completed',
      tags: JSON.stringify(['제품', '전략']),
      ai_summary: '1분기 목표 달성률 78%로 확인. 모바일 앱 출시를 4월로 조정하기로 결정. AI 추천 기능 우선순위 상향 합의.',
      key_decisions: JSON.stringify(['모바일 앱 베타 출시일을 4월 15일로 확정', 'AI 추천 엔진 개발 우선순위를 P1으로 상향', '사용자 피드백 반영 주기를 2주에서 1주로 단축']),
      action_items: JSON.stringify([
        { text: '모바일 앱 QA 테스트 계획 수립', assignee: '박준혁', dueDate: '2026-03-20', done: false },
        { text: 'AI 추천 엔진 기술 스펙 문서 작성', assignee: '이서연', dueDate: '2026-03-18', done: true },
        { text: '1분기 실적 보고서 최종 정리', assignee: '김민수', dueDate: '2026-03-15', done: false },
      ]),
      sentiment: 'positive',
      transcript: JSON.stringify([
        { speaker: '김민수', time: '10:00', text: '안녕하세요, 오늘은 1분기 제품 로드맵 리뷰를 진행하겠습니다.' },
        { speaker: '이서연', time: '10:03', text: '현재 1분기 목표 대비 달성률은 78%입니다. 주요 미달 항목은 모바일 앱 출시 지연입니다.' },
        { speaker: '박준혁', time: '10:08', text: '모바일 앱은 현재 QA 단계에 있으며, 4월 중순 출시가 현실적입니다.' },
        { speaker: '정하은', time: '10:15', text: 'AI 추천 기능에 대한 사용자 수요가 크게 증가하고 있어 우선순위 조정이 필요합니다.' },
        { speaker: '김민수', time: '10:22', text: '그렇다면 AI 추천 엔진 개발을 P1으로 올리고, 리소스를 재배치하겠습니다.' },
      ]),
      full_text: '안녕하세요, 오늘은 1분기 제품 로드맵 리뷰를 진행하겠습니다. 현재 1분기 목표 대비 달성률은 78%입니다. 주요 미달 항목은 모바일 앱 출시 지연입니다. 모바일 앱은 현재 QA 단계에 있으며, 4월 중순 출시가 현실적입니다. AI 추천 기능에 대한 사용자 수요가 크게 증가하고 있어 우선순위 조정이 필요합니다. 그렇다면 AI 추천 엔진 개발을 P1으로 올리고, 리소스를 재배치하겠습니다.',
    },
    {
      title: '디자인 시스템 v2 킥오프',
      date: '2026-03-12', time: '14:00', duration: 45,
      participants: JSON.stringify(['최유진', '한도윤', '이서연']),
      status: 'completed',
      tags: JSON.stringify(['디자인', 'UI/UX']),
      ai_summary: '디자인 시스템 v2 마이그레이션 계획 논의. Figma 토큰 기반 자동화 도입 합의. 4월 말까지 핵심 컴포넌트 20개 전환 목표.',
      key_decisions: JSON.stringify(['Figma Design Tokens 기반 자동화 파이프라인 구축', '핵심 컴포넌트 20개를 4월 말까지 v2로 전환', '접근성 WCAG 2.1 AA 기준 준수']),
      action_items: JSON.stringify([
        { text: 'Figma 토큰 구조 설계', assignee: '최유진', dueDate: '2026-03-22', done: false },
        { text: '컴포넌트 우선순위 목록 정리', assignee: '한도윤', dueDate: '2026-03-17', done: true },
        { text: '접근성 감사 도구 선정', assignee: '이서연', dueDate: '2026-03-19', done: false },
      ]),
      sentiment: 'positive',
      transcript: JSON.stringify([]),
      full_text: '',
    },
    {
      title: '보안 취약점 대응 긴급 회의',
      date: '2026-03-11', time: '09:00', duration: 30,
      participants: JSON.stringify(['강태호', '김민수', '박준혁']),
      status: 'completed',
      tags: JSON.stringify(['보안', '긴급']),
      ai_summary: 'API 인증 모듈에서 발견된 토큰 갱신 취약점에 대한 긴급 대응. 24시간 내 핫픽스 배포 결정. 전체 보안 감사 일정 앞당기기로 합의.',
      key_decisions: JSON.stringify(['토큰 갱신 로직 핫픽스 24시간 내 배포', '전체 보안 감사를 3월 말로 앞당김', '보안 이슈 대응 프로세스 재정비']),
      action_items: JSON.stringify([
        { text: '토큰 갱신 핫픽스 개발 및 배포', assignee: '박준혁', dueDate: '2026-03-12', done: true },
        { text: '보안 감사 업체 컨택', assignee: '강태호', dueDate: '2026-03-14', done: false },
        { text: '인시던트 보고서 작성', assignee: '김민수', dueDate: '2026-03-13', done: false },
      ]),
      sentiment: 'negative',
      transcript: JSON.stringify([]),
      full_text: '',
    },
    {
      title: '신규 입사자 온보딩 프로세스 개선',
      date: '2026-03-10', time: '15:30', duration: 50,
      participants: JSON.stringify(['정하은', '최유진', '한도윤', '이서연', '강태호']),
      status: 'completed',
      tags: JSON.stringify(['HR', '프로세스']),
      ai_summary: '온보딩 기간을 4주에서 3주로 단축하는 개선안 논의. 멘토링 프로그램 도입과 자동화된 환경 설정 도구 개발 합의.',
      key_decisions: JSON.stringify(['온보딩 기간 4주 → 3주 단축', '버디 멘토링 프로그램 도입', '개발 환경 자동 설정 스크립트 개발']),
      action_items: JSON.stringify([
        { text: '개선된 온보딩 체크리스트 작성', assignee: '정하은', dueDate: '2026-03-20', done: false },
        { text: '멘토링 가이드라인 문서 작성', assignee: '최유진', dueDate: '2026-03-25', done: false },
        { text: '환경 설정 자동화 스크립트 개발', assignee: '한도윤', dueDate: '2026-03-28', done: false },
      ]),
      sentiment: 'neutral',
      transcript: JSON.stringify([]),
      full_text: '',
    },
    {
      title: '주간 스프린트 회고',
      date: '2026-03-13', time: '16:00', duration: 40,
      participants: JSON.stringify(['김민수', '박준혁', '이서연', '한도윤']),
      status: 'in-progress',
      tags: JSON.stringify(['스프린트', '애자일']),
      ai_summary: '',
      key_decisions: JSON.stringify([]),
      action_items: JSON.stringify([]),
      sentiment: 'neutral',
      transcript: JSON.stringify([]),
      full_text: '',
    },
  ]

  for (const m of meetingsData) {
    await conn.query(
      `INSERT INTO meetings (title, date, time, duration, participants, status, tags, ai_summary, key_decisions, action_items, sentiment, transcript, full_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.title, m.date, m.time, m.duration, m.participants, m.status, m.tags, m.ai_summary, m.key_decisions, m.action_items, m.sentiment, m.transcript, m.full_text]
    )
  }
  console.log(`  ✓ meetings: ${meetingsData.length}건 삽입`)

  // 회의실 데이터
  const roomsData = [
    { id: 'room-01', name: '대회의실 A', building: '본관', floor: '3층', detail: '엘리베이터 옆', capacity: 20, equipment: JSON.stringify(['프로젝터', '화이트보드', '화상회의', '마이크']), status: 'available' },
    { id: 'room-02', name: '소회의실 B', building: '본관', floor: '3층', detail: '복도 끝', capacity: 6, equipment: JSON.stringify(['화이트보드', '모니터']), status: 'available' },
    { id: 'room-03', name: '중회의실 C', building: '별관', floor: '2층', detail: '로비 좌측', capacity: 12, equipment: JSON.stringify(['프로젝터', '화상회의', '마이크']), status: 'available' },
    { id: 'room-04', name: '포커스룸 D', building: '본관', floor: '5층', detail: '창가', capacity: 4, equipment: JSON.stringify(['모니터']), status: 'maintenance' },
    { id: 'room-05', name: '대회의실 E', building: '별관', floor: '1층', detail: '정문 옆', capacity: 30, equipment: JSON.stringify(['프로젝터', '화이트보드', '화상회의', '마이크', '스피커']), status: 'available' },
  ]

  for (const r of roomsData) {
    await conn.query(
      'INSERT INTO rooms (id, name, building, floor, detail, capacity, equipment, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.building, r.floor, r.detail, r.capacity, r.equipment, r.status]
    )
  }
  console.log(`  ✓ rooms: ${roomsData.length}건 삽입`)

  // 예약 데이터
  const reservationsData = [
    { id: 'rsv-001', room_id: 'room-01', title: 'Q1 사업 검토 회의', date: '2026-03-22', start_time: '14:00', end_time: '15:30', organizer: '홍길동', participants: JSON.stringify(['김철수', '이영희']), status: 'confirmed' },
    { id: 'rsv-002', room_id: 'room-02', title: '디자인 리뷰', date: '2026-03-22', start_time: '10:00', end_time: '11:00', organizer: '최유진', participants: JSON.stringify(['한도윤']), status: 'confirmed' },
    { id: 'rsv-003', room_id: 'room-03', title: '스프린트 플래닝', date: '2026-03-22', start_time: '09:00', end_time: '10:30', organizer: '김민수', participants: JSON.stringify(['박준혁', '이서연', '한도윤']), status: 'confirmed' },
    { id: 'rsv-004', room_id: 'room-01', title: '마케팅 캠페인 기획', date: '2026-03-23', start_time: '11:00', end_time: '12:00', organizer: '정하은', participants: JSON.stringify(['최유진']), status: 'confirmed' },
    { id: 'rsv-005', room_id: 'room-03', title: '인프라 비용 최적화', date: '2026-03-23', start_time: '15:00', end_time: '16:00', organizer: '강태호', participants: JSON.stringify(['박준혁', '한도윤']), status: 'confirmed' },
    { id: 'rsv-006', room_id: 'room-05', title: '전사 타운홀 미팅', date: '2026-03-24', start_time: '10:00', end_time: '12:00', organizer: '김민수', participants: JSON.stringify(['전 임직원']), status: 'confirmed' },
    { id: 'rsv-007', room_id: 'room-02', title: '1:1 면담', date: '2026-03-24', start_time: '14:00', end_time: '14:30', organizer: '이서연', participants: JSON.stringify(['한도윤']), status: 'confirmed' },
  ]

  for (const r of reservationsData) {
    await conn.query(
      'INSERT INTO reservations (id, room_id, title, date, start_time, end_time, organizer, participants, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.room_id, r.title, r.date, r.start_time, r.end_time, r.organizer, r.participants, r.status]
    )
  }
  console.log(`  ✓ reservations: ${reservationsData.length}건 삽입`)

  await conn.end()

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  초기화 완료!')
  console.log('═══════════════════════════════════════════════')
  console.log('')
}

run().catch(err => {
  console.error('초기화 실패:', err.message)
  process.exit(1)
})
