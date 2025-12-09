-- swing_training 테이블 생성
CREATE TABLE IF NOT EXISTS swing_training (
  id INT AUTO_INCREMENT PRIMARY KEY,
  swing_id INT NOT NULL,
  focus JSON NOT NULL,
  routine_items JSON NOT NULL,
  coach_summary TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (swing_id) REFERENCES swings(id) ON DELETE CASCADE,
  UNIQUE KEY unique_swing_training (swing_id),
  INDEX idx_swing_id (swing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

