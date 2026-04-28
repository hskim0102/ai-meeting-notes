/**
 * meetings 테이블과 Dify 지식 도큐먼트 간 매핑 테이블 생성
 * 실행: node server/scripts/addRagDocsTable.js
 */
import 'dotenv/config'
import { query } from '../services/database.js'

async function run() {
  await query(`
    CREATE TABLE IF NOT EXISTS meeting_rag_docs (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id  INT NOT NULL,
      document_id VARCHAR(255) DEFAULT NULL COMMENT 'Dify 지식 도큐먼트 ID',
      status      ENUM('pending','completed','failed') DEFAULT 'pending',
      error_msg   TEXT DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_meeting_id (meeting_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='meetings ↔ Dify RAG 도큐먼트 매핑'
  `)
  console.log('meeting_rag_docs 테이블 생성 완료 (이미 있으면 스킵)')
  process.exit(0)
}

run().catch(err => {
  console.error('마이그레이션 실패:', err.message)
  process.exit(1)
})
