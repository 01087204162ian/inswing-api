const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const trainingPlanService = require('../services/trainingPlanService');

// POST /v1/training-plans
router.post('/training-plans', auth, async (req, res) => {
  const userId = req.user.id;
  const {
    swing_id,
    question_id,
    focus_override,
    practice_frequency,
    intensity
  } = req.body;

  try {
    const [profileRows] = await pool.query(
      'SELECT experience_years, avg_score, main_environment, goal, practice_frequency, preferred_style FROM user_profiles WHERE user_id = ?',
      [userId]
    );
    const userProfile = profileRows[0] || null;

    let question = null;
    if (question_id) {
      const [qRows] = await pool.query(
        'SELECT question_text FROM swing_questions WHERE id = ? AND user_id = ?',
        [question_id, userId]
      );
      question = qRows[0] ? qRows[0].question_text : null;
    }

    // TODO: swings 분석 결과 연동
    const swingAnalysis = null;

    const planData = await trainingPlanService.generateTrainingPlan({
      userProfile,
      question,
      swingAnalysis,
      practiceFrequency: practice_frequency,
      intensity
    });

    // training_plans 저장
    const [planResult] = await pool.query(
      `INSERT INTO training_plans
       (user_id, swing_id, question_id, duration_weeks, focus_theme, sessions_per_week, practice_frequency, intensity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        swing_id || null,
        question_id || null,
        planData.duration_weeks,
        focus_override || planData.focus_theme,
        planData.sessions_per_week,
        practice_frequency,
        intensity
      ]
    );
    const planId = planResult.insertId;

    // training_sessions 저장
    for (const [index, session] of planData.sessions.entries()) {
      const [sessionResult] = await pool.query(
        `INSERT INTO training_sessions
         (plan_id, week_number, day_hint, objective, drills_json, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          planId,
          session.week_number,
          session.day_hint || null,
          session.objective,
          JSON.stringify(session.drills || []),
          index
        ]
      );
      session.session_id = sessionResult.insertId; // 응답용
    }

    return res.json({
      plan_id: planId,
      ...planData,
      sessions: planData.sessions
    });
  } catch (err) {
    console.error('POST /training-plans error:', err);
    return res.status(500).json({ error: 'Failed to create training plan' });
  }
});

// GET /v1/training-plans/:planId
router.get('/training-plans/:planId', auth, async (req, res) => {
  const userId = req.user.id;
  const planId = Number(req.params.planId);

  try {
    const [planRows] = await pool.query(
      'SELECT * FROM training_plans WHERE id = ? AND user_id = ?',
      [planId, userId]
    );
    if (planRows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const [sessionRows] = await pool.query(
      'SELECT id AS session_id, week_number, day_hint, objective, drills_json, sort_order FROM training_sessions WHERE plan_id = ? ORDER BY sort_order ASC',
      [planId]
    );

    const sessions = sessionRows.map(row => ({
      session_id: row.session_id,
      week_number: row.week_number,
      day_hint: row.day_hint,
      objective: row.objective,
      drills: JSON.parse(row.drills_json || '[]')
    }));

    return res.json({
      ...planRows[0],
      sessions
    });
  } catch (err) {
    console.error('GET /training-plans/:planId error:', err);
    return res.status(500).json({ error: 'Failed to load training plan' });
  }
});

// POST /v1/training-sessions/:sessionId/progress
router.post('/training-sessions/:sessionId/progress', auth, async (req, res) => {
  const userId = req.user.id;
  const sessionId = Number(req.params.sessionId);
  const { completion_rate = 0, feeling_note, body_condition = 'normal' } = req.body;

  try {
    // 세션 사용자 소유 검증 (플랜 → user_id)
    const [rows] = await pool.query(
      `SELECT ts.id
       FROM training_sessions ts
       JOIN training_plans tp ON tp.id = ts.plan_id
       WHERE ts.id = ? AND tp.user_id = ?`,
      [sessionId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await pool.query(
      `INSERT INTO training_progress
       (session_id, user_id, completion_rate, feeling_note, body_condition)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        Math.max(0, Math.min(1, completion_rate)),
        feeling_note || null,
        body_condition
      ]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /training-sessions/:sessionId/progress error:', err);
    return res.status(500).json({ error: 'Failed to save progress' });
  }
});

// GET /v1/training-plans/:planId/progress
router.get('/training-plans/:planId/progress', auth, async (req, res) => {
  const userId = req.user.id;
  const planId = Number(req.params.planId);

  try {
    // 플랜 소유 확인
    const [planRows] = await pool.query(
      'SELECT id FROM training_plans WHERE id = ? AND user_id = ?',
      [planId, userId]
    );
    if (planRows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const [sessionRows] = await pool.query(
      'SELECT id FROM training_sessions WHERE plan_id = ?',
      [planId]
    );
    const sessionIds = sessionRows.map(r => r.id);
    if (sessionIds.length === 0) {
      return res.json({
        plan_id: planId,
        completion_summary: {
          total_sessions: 0,
          done_sessions: 0,
          avg_completion_rate: 0
        },
        last_feelings: []
      });
    }

    const [progressRows] = await pool.query(
      `SELECT tp.session_id, tp.completion_rate, tp.feeling_note, tp.created_at
       FROM training_progress tp
       WHERE tp.user_id = ? AND tp.session_id IN (?)
       ORDER BY tp.created_at DESC`,
      [userId, sessionIds]
    );

    const totalSessions = sessionIds.length;
    const doneSessions = new Set(progressRows.map(r => r.session_id)).size;
    const avgCompletion =
      progressRows.length === 0
        ? 0
        : progressRows.reduce((sum, r) => sum + Number(r.completion_rate || 0), 0) /
          progressRows.length;

    const lastFeelings = progressRows.slice(0, 5).map(r => ({
      session_id: r.session_id,
      date: r.created_at,
      feeling_note: r.feeling_note,
      completion_rate: r.completion_rate
    }));

    return res.json({
      plan_id: planId,
      completion_summary: {
        total_sessions: totalSessions,
        done_sessions: doneSessions,
        avg_completion_rate: Number(avgCompletion.toFixed(2))
      },
      last_feelings: lastFeelings
    });
  } catch (err) {
    console.error('GET /training-plans/:planId/progress error:', err);
    return res.status(500).json({ error: 'Failed to load progress' });
  }
});

module.exports = router;

