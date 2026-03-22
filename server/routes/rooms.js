/**
 * server/routes/rooms.js - 회의실 및 예약 API 라우트
 * ─────────────────────────────────────────────────
 * 회의실 목록 조회, 가용성 확인, 예약 CRUD
 * 프로토타입 단계이므로 인메모리 데이터 사용
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// ── 인메모리 데이터 (프로토타입용) ──

const rooms = [
  {
    id: 'room-01',
    name: '대회의실 A',
    location: { building: '본관', floor: '3층', detail: '엘리베이터 옆' },
    capacity: 20,
    equipment: ['프로젝터', '화이트보드', '화상회의', '마이크'],
    status: 'available',
  },
  {
    id: 'room-02',
    name: '소회의실 B',
    location: { building: '본관', floor: '3층', detail: '복도 끝' },
    capacity: 6,
    equipment: ['화이트보드', '모니터'],
    status: 'available',
  },
  {
    id: 'room-03',
    name: '중회의실 C',
    location: { building: '별관', floor: '2층', detail: '로비 좌측' },
    capacity: 12,
    equipment: ['프로젝터', '화상회의', '마이크'],
    status: 'available',
  },
  {
    id: 'room-04',
    name: '포커스룸 D',
    location: { building: '본관', floor: '5층', detail: '창가' },
    capacity: 4,
    equipment: ['모니터'],
    status: 'maintenance',
  },
  {
    id: 'room-05',
    name: '대회의실 E',
    location: { building: '별관', floor: '1층', detail: '정문 옆' },
    capacity: 30,
    equipment: ['프로젝터', '화이트보드', '화상회의', '마이크', '스피커'],
    status: 'available',
  },
]

const reservations = [
  { id: 'rsv-001', roomId: 'room-01', title: 'Q1 사업 검토 회의', date: '2026-03-22', startTime: '14:00', endTime: '15:30', organizer: '홍길동', participants: ['김철수', '이영희'], status: 'confirmed' },
  { id: 'rsv-002', roomId: 'room-02', title: '디자인 리뷰', date: '2026-03-22', startTime: '10:00', endTime: '11:00', organizer: '최유진', participants: ['한도윤'], status: 'confirmed' },
  { id: 'rsv-003', roomId: 'room-03', title: '스프린트 플래닝', date: '2026-03-22', startTime: '09:00', endTime: '10:30', organizer: '김민수', participants: ['박준혁', '이서연', '한도윤'], status: 'confirmed' },
  { id: 'rsv-004', roomId: 'room-01', title: '마케팅 캠페인 기획', date: '2026-03-23', startTime: '11:00', endTime: '12:00', organizer: '정하은', participants: ['최유진'], status: 'confirmed' },
  { id: 'rsv-005', roomId: 'room-03', title: '인프라 비용 최적화', date: '2026-03-23', startTime: '15:00', endTime: '16:00', organizer: '강태호', participants: ['박준혁', '한도윤'], status: 'confirmed' },
  { id: 'rsv-006', roomId: 'room-05', title: '전사 타운홀 미팅', date: '2026-03-24', startTime: '10:00', endTime: '12:00', organizer: '김민수', participants: ['전 임직원'], status: 'confirmed' },
  { id: 'rsv-007', roomId: 'room-02', title: '1:1 면담', date: '2026-03-24', startTime: '14:00', endTime: '14:30', organizer: '이서연', participants: ['한도윤'], status: 'confirmed' },
]

// ── 회의실 목록 조회 ──
router.get('/', (req, res) => {
  res.json({ success: true, data: rooms })
})

// ── 회의실 상세 조회 ──
router.get('/:id', (req, res) => {
  const room = rooms.find(r => r.id === req.params.id)
  if (!room) {
    return res.status(404).json({ success: false, error: '회의실을 찾을 수 없습니다.' })
  }
  res.json({ success: true, data: room })
})

// ── 회의실 가용성 조회 ──
router.get('/availability', (req, res) => {
  const { date, startTime, endTime } = req.query
  if (!date) {
    return res.status(400).json({ success: false, error: '날짜(date)는 필수입니다.' })
  }

  const dateReservations = reservations.filter(r => r.date === date && r.status === 'confirmed')

  const availability = rooms.map(room => {
    const roomReservations = dateReservations.filter(r => r.roomId === room.id)
    let isAvailable = room.status === 'available'

    // 시간대 지정 시 해당 시간 충돌 확인
    if (isAvailable && startTime && endTime) {
      const hasConflict = roomReservations.some(r =>
        startTime < r.endTime && endTime > r.startTime
      )
      isAvailable = !hasConflict
    }

    return {
      ...room,
      isAvailable,
      reservations: roomReservations,
    }
  })

  res.json({ success: true, data: availability })
})

// ── 예약 목록 조회 ──
router.get('/reservations/list', (req, res) => {
  const { roomId, date, weekStart } = req.query
  let filtered = [...reservations]

  if (roomId) filtered = filtered.filter(r => r.roomId === roomId)
  if (date) filtered = filtered.filter(r => r.date === date)
  if (weekStart) {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const endStr = end.toISOString().slice(0, 10)
    filtered = filtered.filter(r => r.date >= weekStart && r.date < endStr)
  }

  // 회의실 정보 조인
  const result = filtered.map(r => ({
    ...r,
    room: rooms.find(rm => rm.id === r.roomId),
  }))

  res.json({ success: true, data: result })
})

// ── 예약 생성 ──
router.post('/reservations', (req, res) => {
  const { roomId, title, date, startTime, endTime, organizer, participants } = req.body

  if (!roomId || !title || !date || !startTime || !endTime || !organizer) {
    return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' })
  }

  const room = rooms.find(r => r.id === roomId)
  if (!room) {
    return res.status(404).json({ success: false, error: '회의실을 찾을 수 없습니다.' })
  }
  if (room.status !== 'available') {
    return res.status(409).json({ success: false, error: '해당 회의실은 현재 사용할 수 없습니다.' })
  }

  // 시간 충돌 검사
  const hasConflict = reservations.some(r =>
    r.roomId === roomId &&
    r.date === date &&
    r.status === 'confirmed' &&
    startTime < r.endTime &&
    endTime > r.startTime
  )

  if (hasConflict) {
    return res.status(409).json({ success: false, error: '해당 시간에 이미 예약이 있습니다.' })
  }

  const newReservation = {
    id: `rsv-${uuidv4().slice(0, 8)}`,
    roomId,
    title,
    date,
    startTime,
    endTime,
    organizer,
    participants: participants || [],
    status: 'confirmed',
  }

  reservations.push(newReservation)
  console.log(`[예약 생성] ${newReservation.id} - ${title} (${room.name}, ${date} ${startTime}~${endTime})`)

  res.status(201).json({ success: true, data: { ...newReservation, room } })
})

// ── 예약 수정 ──
router.put('/reservations/:id', (req, res) => {
  const idx = reservations.findIndex(r => r.id === req.params.id)
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '예약을 찾을 수 없습니다.' })
  }

  const { title, date, startTime, endTime, participants } = req.body
  const existing = reservations[idx]

  // 변경된 시간에 대해 충돌 검사
  const newDate = date || existing.date
  const newStart = startTime || existing.startTime
  const newEnd = endTime || existing.endTime

  const hasConflict = reservations.some(r =>
    r.id !== req.params.id &&
    r.roomId === existing.roomId &&
    r.date === newDate &&
    r.status === 'confirmed' &&
    newStart < r.endTime &&
    newEnd > r.startTime
  )

  if (hasConflict) {
    return res.status(409).json({ success: false, error: '해당 시간에 이미 예약이 있습니다.' })
  }

  if (title) existing.title = title
  if (date) existing.date = date
  if (startTime) existing.startTime = startTime
  if (endTime) existing.endTime = endTime
  if (participants) existing.participants = participants

  console.log(`[예약 수정] ${existing.id} - ${existing.title}`)
  res.json({ success: true, data: { ...existing, room: rooms.find(rm => rm.id === existing.roomId) } })
})

// ── 예약 취소 ──
router.delete('/reservations/:id', (req, res) => {
  const idx = reservations.findIndex(r => r.id === req.params.id)
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '예약을 찾을 수 없습니다.' })
  }

  const removed = reservations.splice(idx, 1)[0]
  console.log(`[예약 취소] ${removed.id} - ${removed.title}`)
  res.json({ success: true, data: removed })
})

// ── 헬스 체크 ──
router.get('/health', (req, res) => {
  res.json({ status: 'ok', roomCount: rooms.length, reservationCount: reservations.length })
})

export default router
