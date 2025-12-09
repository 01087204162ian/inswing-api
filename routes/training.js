const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middlewares/auth');
const trainingPlanService = require('../services/trainingPlanService');
const { generateTrainingData } = require('../services/aiCoachingService');

// POST /v1/training-sessions (루틴 완료 기록)
router.post('/training-sessions', auth, async (req, res) => {
  const userId = req.user.id;
  const { swing_id, completed_items, total_items } = req.body || {};

  // 기본 검증
  const swingIdNum = Number(swing_id);
  if (!swing_id || Number.isNaN(swingIdNum) || swingIdNum <= 0) {
    return res.status(400).json({ error: 'swing_id is required' });
  }
  if (!Array.isArray(completed_items) || completed_items.length === 0) {
    return res.status(400).json({ error: 'completed_items must be a non-empty array' });
  }
  const totalItemsNum = Number(total_items ?? completed_items.length);
  if (Number.isNaN(totalItemsNum) || totalItemsNum <= 0) {
    return res.status(400).json({ error: 'total_items must be a positive number' });
  }

  try {
    // 스윙 소유 확인
    const [swingRows] = await pool.query(
      'SELECT id FROM swings WHERE id = ? AND user_id = ?',
      [swingIdNum, userId]
    );
    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    // 테이블 이름: training_session_logs (기존 training_sessions 충돌 회피)
    await pool.query(
      `INSERT INTO training_session_logs
       (user_id, swing_id, completed_items, total_items, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        swingIdNum,
        JSON.stringify(completed_items.map((t) => String(t).trim()).filter(Boolean)),
        totalItemsNum
      ]
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST /v1/training-sessions error:', err);
    return res.status(500).json({ error: 'Failed to save training session' });
  }
});

// GET /v1/swings/:id/training-logs
router.get('/swings/:id/training-logs', auth, async (req, res) => {
  const userId = req.user.id;
  const swingId = Number(req.params.id);

  if (Number.isNaN(swingId) || swingId <= 0) {
    return res.status(400).json({ error: 'Invalid swing_id' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, swing_id, completed_items, total_items, created_at
       FROM training_session_logs
       WHERE user_id = ? AND swing_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, swingId]
    );

    const logs = rows.map((row) => {
      let completed = [];
      try {
        completed = JSON.parse(row.completed_items || '[]');
      } catch (err) {
        completed = [];
      }
      return {
        id: row.id,
        swing_id: row.swing_id,
        completed_items: completed,
        total_items: row.total_items,
        created_at: row.created_at
      };
    });

    console.log(`[API] GET /v1/swings/${swingId}/training-logs 호출 완료 (count=${logs.length})`);

    return res.json({
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('GET /v1/swings/:id/training-logs error:', err);
    return res.status(500).json({ error: 'Failed to load training logs' });
  }
});

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

// GET /v1/swings/:id/training
router.get('/swings/:id/training', auth, async (req, res) => {
  const userId = req.user.id;
  const swingId = Number(req.params.id);

  try {
    // 1) 스윙 소유 확인
    const [swingRows] = await pool.query(
      'SELECT id, comment FROM swings WHERE id = ? AND user_id = ?',
      [swingId, userId]
    );

    if (swingRows.length === 0) {
      return res.status(404).json({ error: 'Swing not found' });
    }

    const swing = swingRows[0];

    // 2) DB에 training 데이터가 있는지 확인
    const [trainingRows] = await pool.query(
      'SELECT id, focus, routine_items, coach_summary FROM swing_training WHERE swing_id = ?',
      [swingId]
    );

    // 3) 있으면 그대로 반환
    if (trainingRows.length > 0) {
      const training = trainingRows[0];
      return res.json({
        focus: JSON.parse(training.focus || '[]'),
        routine_items: JSON.parse(training.routine_items || '[]'),
        coach_summary: training.coach_summary || ''
      });
    }

    // 4) 없으면 AI로 생성
    if (!swing.comment || swing.comment.trim().length === 0) {
      return res.status(400).json({ 
        error: '스윙 코멘트가 없어 트레이닝 데이터를 생성할 수 없습니다.' 
      });
    }

    console.log(`[Training] AI 트레이닝 데이터 생성 시작, swingId: ${swingId}`);
    const trainingData = await generateTrainingData(swing.comment);

    // 5) DB에 저장
    await pool.query(
      `INSERT INTO swing_training 
       (swing_id, focus, routine_items, coach_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [
        swingId,
        JSON.stringify(trainingData.focus || []),
        JSON.stringify(trainingData.routine_items || []),
        trainingData.coach_summary || ''
      ]
    );

    console.log(`[Training] 트레이닝 데이터 저장 완료, swingId: ${swingId}`);

    // 6) 반환
    return res.json({
      focus: trainingData.focus,
      routine_items: trainingData.routine_items,
      coach_summary: trainingData.coach_summary
    });

  } catch (err) {
    console.error('GET /swings/:id/training error:', err);
    return res.status(500).json({ error: 'Failed to load training data' });
  }
});

module.exports = router;

