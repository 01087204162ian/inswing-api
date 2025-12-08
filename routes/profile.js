const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');

// GET /v1/me/profile
router.get('/me/profile', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      'SELECT experience_years, avg_score, main_environment, goal, practice_frequency, preferred_style FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.json(null); // 아직 프로필 없으면 null
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /me/profile error:', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT /v1/me/profile
router.put('/me/profile', auth, async (req, res) => {
  const userId = req.user.id;
  const {
    experience_years,
    avg_score,
    main_environment,
    goal,
    practice_frequency,
    preferred_style
  } = req.body;

  try {
    // 이미 있는지 확인
    const [rows] = await pool.query(
      'SELECT id FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      // 새로 생성
      await pool.query(
        `INSERT INTO user_profiles 
         (user_id, experience_years, avg_score, main_environment, goal, practice_frequency, preferred_style)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          experience_years || null,
          avg_score || null,
          main_environment || 'range',
          goal || 'direction',
          practice_frequency || '1_per_week',
          preferred_style || 'simple'
        ]
      );
    } else {
      // 업데이트
      await pool.query(
        `UPDATE user_profiles
         SET experience_years = ?, avg_score = ?, main_environment = ?, goal = ?, practice_frequency = ?, preferred_style = ?
         WHERE user_id = ?`,
        [
          experience_years || null,
          avg_score || null,
          main_environment || 'range',
          goal || 'direction',
          practice_frequency || '1_per_week',
          preferred_style || 'simple',
          userId
        ]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /me/profile error:', err);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
});

module.exports = router;

