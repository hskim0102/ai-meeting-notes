/**
 * server/routes/rooms.js - 회의실 및 예약 API 라우트
 * ─────────────────────────────────────────────────
 * MySQL DB 연동 - 회의실 CRUD, 예약 관리
 * ─────────────────────────────────────────────────
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../services/database.js'

const router = Router()

// ── 헬퍼: DB 행 → API 응답 형식 변환 ──
function formatRoom(row) {
  return {
    id: row.id,
    name: row.name,
    location: { building: row.building, floor: row.floor, detail: row.detail },
    capacity: row.capacity,
    equipment: typeof row.equipment === 'string' ? JSON.parse(row.equipment) : (row.equipment || []),
    status: row.status,
  }
}

function formatReservation(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    organizer: row.organizer,
    participants: typeof row.participants === 'string' ? JSON.parse(row.participants) : (row.participants || []),
    status: row.status,
  }
}

// ── 회의실 목록 조회 ──
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM rooms ORDER BY name')
    res.json({ success: true, data: rows.map(formatRoom) })
  } catch (err) {
    console.error('[회의실 조회 에러]', err.message)
    res.status(500).json({ success: false, error: '회의실 조회 실패' })
  }
})

// ── 회의실 가용성 조회 (GET /availability보다 먼저 매칭되도록 위에 배치) ──
router.get('/availability', async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query
    if (!date) {
      return res.status(400).json({ success: false, error: '날짜(date)는 필수입니다.' })
    }

    const allRooms = await query('SELECT * FROM rooms ORDER BY name')
    const dateReservations = await query(
      'SELECT * FROM reservations WHERE date = ? AND status = ?',
      [date, 'confirmed']
    )

    const availability = allRooms.map(room => {
      const roomReservations = dateReservations
        .filter(r => r.room_id === room.id)
        .map(formatReservation)

      let isAvailable = room.status === 'available'

      if (isAvailable && startTime && endTime) {
        const hasConflict = roomReservations.some(r =>
          startTime < r.endTime && endTime > r.startTime
        )
        isAvailable = !hasConflict
      }

      return {
        ...formatRoom(room),
        isAvailable,
        reservations: roomReservations,
      }
    })

    res.json({ success: true, data: availability })
  } catch (err) {
    console.error('[가용성 조회 에러]', err.message)
    res.status(500).json({ success: false, error: '가용성 조회 실패' })
  }
})

// ── 예약 목록 조회 ──
router.get('/reservations/list', async (req, res) => {
  try {
    const { roomId, date, weekStart } = req.query
    let sql = 'SELECT r.*, rm.name as room_name, rm.building, rm.floor, rm.detail, rm.capacity, rm.equipment as room_equipment, rm.status as room_status FROM reservations r JOIN rooms rm ON r.room_id = rm.id WHERE 1=1'
    const params = []

    if (roomId) { sql += ' AND r.room_id = ?'; params.push(roomId) }
    if (date) { sql += ' AND r.date = ?'; params.push(date) }
    if (weekStart) {
      const start = new Date(weekStart)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      sql += ' AND r.date >= ? AND r.date < ?'
      params.push(weekStart, end.toISOString().slice(0, 10))
    }

    sql += ' ORDER BY r.date, r.start_time'
    const rows = await query(sql, params)

    const result = rows.map(row => ({
      ...formatReservation(row),
      room: {
        id: row.room_id,
        name: row.room_name,
        location: { building: row.building, floor: row.floor, detail: row.detail },
        capacity: row.capacity,
        equipment: typeof row.room_equipment === 'string' ? JSON.parse(row.room_equipment) : (row.room_equipment || []),
        status: row.room_status,
      },
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[예약 목록 에러]', err.message)
    res.status(500).json({ success: false, error: '예약 조회 실패' })
  }
})

// ── 헬스 체크 ──
router.get('/health', async (req, res) => {
  try {
    const [roomCount] = await query('SELECT COUNT(*) as cnt FROM rooms')
    const [rsvCount] = await query('SELECT COUNT(*) as cnt FROM reservations')
    res.json({ status: 'ok', roomCount: roomCount.cnt, reservationCount: rsvCount.cnt })
  } catch (err) {
    res.json({ status: 'error', error: err.message })
  }
})

// ── 회의실 상세 조회 ──
router.get('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM rooms WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '회의실을 찾을 수 없습니다.' })
    }
    res.json({ success: true, data: formatRoom(rows[0]) })
  } catch (err) {
    console.error('[회의실 상세 에러]', err.message)
    res.status(500).json({ success: false, error: '회의실 조회 실패' })
  }
})

// ── 예약 생성 ──
router.post('/reservations', async (req, res) => {
  try {
    const { roomId, title, date, startTime, endTime, organizer, participants } = req.body

    if (!roomId || !title || !date || !startTime || !endTime || !organizer) {
      return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' })
    }

    // 회의실 존재 여부 확인
    const roomRows = await query('SELECT * FROM rooms WHERE id = ?', [roomId])
    if (roomRows.length === 0) {
      return res.status(404).json({ success: false, error: '회의실을 찾을 수 없습니다.' })
    }
    if (roomRows[0].status !== 'available') {
      return res.status(409).json({ success: false, error: '해당 회의실은 현재 사용할 수 없습니다.' })
    }

    // 시간 충돌 검사
    const conflicts = await query(
      'SELECT id FROM reservations WHERE room_id = ? AND date = ? AND status = ? AND start_time < ? AND end_time > ?',
      [roomId, date, 'confirmed', endTime, startTime]
    )

    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, error: '해당 시간에 이미 예약이 있습니다.' })
    }

    const id = `rsv-${uuidv4().slice(0, 8)}`
    await query(
      'INSERT INTO reservations (id, room_id, title, date, start_time, end_time, organizer, participants, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, roomId, title, date, startTime, endTime, organizer, JSON.stringify(participants || []), 'confirmed']
    )

    console.log(`[예약 생성] ${id} - ${title} (${roomRows[0].name}, ${date} ${startTime}~${endTime})`)

    res.status(201).json({
      success: true,
      data: {
        id, roomId, title, date, startTime, endTime, organizer,
        participants: participants || [],
        status: 'confirmed',
        room: formatRoom(roomRows[0]),
      },
    })
  } catch (err) {
    console.error('[예약 생성 에러]', err.message)
    res.status(500).json({ success: false, error: '예약 생성 실패' })
  }
})

// ── 예약 수정 ──
router.put('/reservations/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM reservations WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '예약을 찾을 수 없습니다.' })
    }

    const existing = rows[0]
    const { title, date, startTime, endTime, participants } = req.body
    const newDate = date || (existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : existing.date)
    const newStart = startTime || existing.start_time
    const newEnd = endTime || existing.end_time

    // 충돌 검사
    const conflicts = await query(
      'SELECT id FROM reservations WHERE id != ? AND room_id = ? AND date = ? AND status = ? AND start_time < ? AND end_time > ?',
      [req.params.id, existing.room_id, newDate, 'confirmed', newEnd, newStart]
    )

    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, error: '해당 시간에 이미 예약이 있습니다.' })
    }

    await query(
      'UPDATE reservations SET title = ?, date = ?, start_time = ?, end_time = ?, participants = ? WHERE id = ?',
      [title || existing.title, newDate, newStart, newEnd, JSON.stringify(participants || JSON.parse(existing.participants || '[]')), req.params.id]
    )

    const updated = await query('SELECT * FROM reservations WHERE id = ?', [req.params.id])
    const roomRows = await query('SELECT * FROM rooms WHERE id = ?', [existing.room_id])

    console.log(`[예약 수정] ${req.params.id}`)
    res.json({
      success: true,
      data: { ...formatReservation(updated[0]), room: formatRoom(roomRows[0]) },
    })
  } catch (err) {
    console.error('[예약 수정 에러]', err.message)
    res.status(500).json({ success: false, error: '예약 수정 실패' })
  }
})

// ── 예약 취소 ──
router.delete('/reservations/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM reservations WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '예약을 찾을 수 없습니다.' })
    }

    await query('DELETE FROM reservations WHERE id = ?', [req.params.id])
    console.log(`[예약 취소] ${req.params.id} - ${rows[0].title}`)
    res.json({ success: true, data: formatReservation(rows[0]) })
  } catch (err) {
    console.error('[예약 취소 에러]', err.message)
    res.status(500).json({ success: false, error: '예약 취소 실패' })
  }
})

export default router
