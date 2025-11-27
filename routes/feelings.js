const express = require('express');
const db = require('../db');

const router = express.Router();

// 4) 스윙 느낌 저장
router.post('/:id/feeling', async (req, res) => {
  try {
    const swingId = req.params.id;
    const userId = req.user.id;
    const { feeling_code, note } = req.body || {};

    // 1) feeling_code 필수 검증
    if (!feeling_code || typeof feeling_code !== 'string') {
      return res.status(400).json({ error: 'feeling_code is required' });
    }

    // 2) 스윙 소유자 확인
    const [swingRows] = await db.query(
      'SELECT id FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );

    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
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
    console.error('Error saving feeling:', err);
    return res.status(500).json({ error: 'Save failed' });
  }
});

module.exports = router;
