/**
 * 기존 meetings 테이블에 speaker_map 컬럼 추가
 * 실행: node server/scripts/addSpeakerMap.js
 */
import 'dotenv/config'
import { query } from '../services/database.js'

async function run() {
  try {
    await query('ALTER TABLE meetings ADD COLUMN speaker_map JSON DEFAULT NULL COMMENT \'화자 이름 매핑\'')
    console.log('speaker_map 컬럼 추가 완료')
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('speaker_map 컬럼이 이미 존재합니다')
    } else {
      throw err
    }
  }
  process.exit(0)
}

run().catch(err => {
  console.error('마이그레이션 실패:', err.message)
  process.exit(1)
})
