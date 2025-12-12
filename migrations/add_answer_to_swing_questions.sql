-- 옵션 1: swing_questions 테이블에 answer 컬럼 추가 (간단한 방법)
-- 추천: 이 방법이 더 간단하고 현재 구조에 맞습니다.

ALTER TABLE `swing_questions`
ADD COLUMN `answer` MEDIUMTEXT NULL AFTER `question_text`,
ADD COLUMN `model` VARCHAR(64) NULL AFTER `answer`;

-- 인덱스는 필요 없음 (이미 기본 키와 외래 키 인덱스가 있음)

