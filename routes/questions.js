const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');
const auth = require('../middlewares/auth');
const { callClaudeAPI } = require('../services/aiCoachingService');
const { buildQuestionPrompt } = require('../services/coachPrompt');

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
      'SELECT id, user_id, club_type, shot_side, created_at FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );
    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }
    const swingRow = swingRows[0];

    // 질문 저장
    const [result] = await pool.query(
      `INSERT INTO swing_questions (swing_id, user_id, target, question_text, status)
       VALUES (?, ?, ?, ?, ?)`,
      [swingId, userId, target, question, target === 'ai' ? 'pending' : 'pending']
    );
    const questionId = result.insertId;

    // AI 타겟인 경우, 즉시 답변 생성
    if (target === 'ai') {
      const analysis = {
        swing: swingRow,
        metrics: null // 현재 DB에 metrics 컬럼이 없으므로 null로 처리
      };

      const prompt = buildQuestionPrompt({ question, analysis });

      const aiText = await callClaudeAPI(prompt, {
        max_tokens: 700,
        temperature: 0.35
      });

      await pool.query(
        `INSERT INTO swing_answers
         (question_id, answer_source, cause_text, solution_text, feel_image, drill_text, encouragement)
         VALUES (?, 'ai', ?, NULL, NULL, NULL, NULL)`,
        [questionId, aiText || '']
      );

      await pool.query(
        'UPDATE swing_questions SET status = ? WHERE id = ?',
        ['answered', questionId]
      );

      return res.json({
        question_id: questionId,
        target,
        status: 'answered',
        answer: {
          source: 'ai',
          text: aiText
        }
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

