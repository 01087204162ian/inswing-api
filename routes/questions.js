const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const auth = require('../middlewares/auth');
const aiCoachService = require('../services/aiCoachService');

// POST /v1/swings/:swingId/questions
router.post('/swings/:swingId/questions', auth, async (req, res) => {
  const userId = req.user.id;
  const swingId = Number(req.params.swingId);
  const { target = 'ai', question } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    // swings 소유 여부 검증
    const [swingRows] = await pool.query(
      'SELECT id FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );
    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    // 질문 저장
    const [result] = await pool.query(
      `INSERT INTO swing_questions (swing_id, user_id, target, question_text, status)
       VALUES (?, ?, ?, ?, ?)`,
      [swingId, userId, target, question, target === 'ai' ? 'pending' : 'pending']
    );
    const questionId = result.insertId;

    // AI 타겟인 경우, 즉시 답변 생성
    if (target === 'ai') {
      // 프로필, 분석 결과 로드 (분석 결과는 나중에 연동)
      const [profileRows] = await pool.query(
        'SELECT experience_years, avg_score, main_environment, goal, practice_frequency, preferred_style FROM user_profiles WHERE user_id = ?',
        [userId]
      );
      const userProfile = profileRows[0] || null;

      // TODO: swing_analysis는 swings 테이블/별도 테이블에서 가져오기
      const swingAnalysis = null;

      const aiAnswer = await aiCoachService.generateCoachingAnswer({
        userProfile,
        swingAnalysis,
        questionText: question
      });

      await pool.query(
        `INSERT INTO swing_answers
         (question_id, answer_source, cause_text, solution_text, feel_image, drill_text, encouragement)
         VALUES (?, 'ai', ?, ?, ?, ?, ?)`,
        [
          questionId,
          aiAnswer.cause_text,
          aiAnswer.solution_text,
          aiAnswer.feel_image,
          aiAnswer.drill_text,
          aiAnswer.encouragement
        ]
      );

      await pool.query(
        'UPDATE swing_questions SET status = ? WHERE id = ?',
        ['answered', questionId]
      );

      return res.json({
        question_id: questionId,
        target,
        status: 'answered',
        answer: aiAnswer
      });
    }

    // 코치 타겟일 경우 (비동기 처리 전제)
    return res.json({
      question_id: questionId,
      target,
      status: 'pending'
    });
  } catch (err) {
    console.error('POST /swings/:swingId/questions error:', err);
    return res.status(500).json({ error: 'Failed to create question' });
  }
});

// GET /v1/swings/:swingId/questions/:questionId
router.get('/swings/:swingId/questions/:questionId', auth, async (req, res) => {
  const userId = req.user.id;
  const swingId = Number(req.params.swingId);
  const questionId = Number(req.params.questionId);

  try {
    const [rows] = await pool.query(
      `SELECT q.id AS question_id, q.swing_id, q.user_id, q.target, q.question_text, q.status,
              a.answer_source, a.cause_text, a.solution_text, a.feel_image, a.drill_text, a.encouragement,
              q.created_at
       FROM swing_questions q
       LEFT JOIN swing_answers a ON a.question_id = q.id
       WHERE q.id = ? AND q.swing_id = ? AND q.user_id = ?`,
      [questionId, swingId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const row = rows[0];

    return res.json({
      question_id: row.question_id,
      swing_id: row.swing_id,
      target: row.target,
      question: row.question_text,
      status: row.status,
      created_at: row.created_at,
      answer: row.cause_text
        ? {
            source: row.answer_source,
            cause: row.cause_text,
            solution: row.solution_text,
            feel_image: row.feel_image,
            drill: row.drill_text,
            encouragement: row.encouragement
          }
        : null
    });
  } catch (err) {
    console.error('GET /swings/:swingId/questions/:questionId error:', err);
    return res.status(500).json({ error: 'Failed to load question' });
  }
});

module.exports = router;

