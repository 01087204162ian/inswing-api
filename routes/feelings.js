const express = require('express');
const db = require('../db');

const router = express.Router();

// 4) 스윙 느낌 저장
router.post('/:id/feeling', async (req, res, next) => {
  try {
    const swingId = req.params.id;
    const userId = req.user.id;
    const { feeling_code, note } = req.body || {};

    // 1) feeling_code 필수 검증
    if (!feeling_code || typeof feeling_code !== 'string') {
      return res.status(400).json({ ok: false, error: 'feeling_code is required' });
    }

    // 2) 스윙 소유자 확인
    const [swingRows] = await db.query(
      'SELECT id FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );

    if (swingRows.length === 0) {
      const error = new Error('Swing not found');
      error.status = 404;
      error.clientMessage = '해당 스윙을 찾을 수 없습니다.';
      return next(error);
    }

    // 3) note는 선택사항 → 공백이면 NULL로 저장
    const cleanedNote =
      typeof note === 'string' && note.trim() !== '' ? note.trim() : null;

    // 4) 느낌 upsert
    await db.query(
      `
      INSERT INTO feelings (swing_id, feeling_code, note)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        feeling_code = VALUES(feeling_code),
        note = VALUES(note)
      `,
      [swingId, feeling_code, cleanedNote]
    );

    return res.json({ ok: true });
  } catch (err) {
    err.clientMessage = '스윙 느낌을 저장하는 중 오류가 발생했습니다.';
    return next(err);
  }
});

module.exports = router;
