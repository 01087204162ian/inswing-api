-- 옵션 2: swing_answers 별도 테이블 생성 (정규화된 방법)
-- 더 복잡한 답변 구조가 필요할 때 사용

CREATE TABLE IF NOT EXISTS `swing_answers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `answer_source` ENUM('ai','coach') NOT NULL DEFAULT 'ai',
  `answer_text` MEDIUMTEXT NOT NULL,
  `model` VARCHAR(64) NULL COMMENT 'AI 모델명 (예: claude-3-haiku-20240307)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_question_answer` (`question_id`),
  CONSTRAINT `fk_swing_answers_question` FOREIGN KEY (`question_id`) REFERENCES `swing_questions` (`id`) ON DELETE CASCADE,
  INDEX `idx_question_created` (`question_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

