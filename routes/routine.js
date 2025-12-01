const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middlewares/auth'); // 로그인 필수

// 모든 /routine/* 라우트 인증 필요
router.use(authMiddleware);

const DAYS = 14;

// DB Helper: mysql2 / 커스텀 래퍼 모두 대응
async function query(sql, params) {
  const result = await db.query(sql, params);
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  return result;
}

// 평균 계산
function avg(arr) {
  const nums = arr.map(Number).filter(n => !Number.isNaN(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

// 태그 규칙
const weaknessTags = [
  'head_unstable',
  'tempo_fast',
  'tempo_slow',
  'balance_weak',
  'finish_weak',
  'overall_low',
];

const strengthTags = [
  'head_stable',
  'tempo_good',
  'balance_good',
  'overall_good',
];

function buildTagsForSwing(s) {
  const tags = [];
  const head = Number(s.head_movement_pct);
  const balance = Number(s.balance_score);
  const tempo = Number(s.tempo_ratio);
  const score = Number(s.overall_score);
  const comment = (s.ai_comment || '').toLowerCase();

  if (!Number.isNaN(balance)) {
    if (balance >= 0.97) tags.push('balance_good');
    else if (balance < 0.9) tags.push('balance_weak');
  }

  if (!Number.isNaN(head)) {
    if (head >= 40) tags.push('head_unstable');
    else if (head <= 15) tags.push('head_stable');
  }

  if (!Number.isNaN(tempo)) {
    if (tempo < 0.8) tags.push('tempo_fast');
    else if (tempo > 3.5) tags.push('tempo_slow');
    else tags.push('tempo_good');
  }

  if (!Number.isNaN(score)) {
    if (score >= 70) tags.push('overall_good');
    if (score <= 45) tags.push('overall_low');
  }

  if (comment.includes('피니시') && comment.includes('아쉽')) tags.push('finish_weak');
  if (comment.includes('비거리')) tags.push('distance_focus');

  return tags;
}

function tagToLabel(tag) {
  const map = {
    head_unstable: '머리 고정',
    head_stable: '머리 안정',
    tempo_fast: '템포 조금 느리게',
    tempo_slow: '템포 조금 빠르게',
    tempo_good: '템포 유지',
    balance_good: '밸런스 유지',
    balance_weak: '밸런스 개선',
    finish_weak: '피니시 끝까지',
    distance_focus: '비거리 집중',
    overall_low: '기본 리듬 만들기',
    overall_good: '현재 리듬 유지',
  };
  return map[tag] || tag;
}

function buildGoalText(topWeak, topStrong) {
  if (!topWeak.length && !topStrong.length) {
    return '오늘은 가볍게 리듬만 느끼며 스윙해 보세요.';
  }

  const weakLabels = topWeak.map(t => tagToLabel(t.tag));
  if (weakLabels.length >= 2) return `${weakLabels[0]}와 ${weakLabels[1]}에 집중해 보는 하루를 추천합니다.`;
  if (weakLabels.length === 1) return `${weakLabels[0]}에 집중하면서, 강점은 그대로 유지해 보는 루틴입니다.`;

  const strongLabels = topStrong.map(t => tagToLabel(t.tag));
  return `${strongLabels.join(', ')} 강점을 유지하면서 편안하게 스윙해 보세요.`;
}

function buildPatternSentences({ topWeak, topStrong, total, avgHead }) {
  const list = [];
  if (topStrong.length) list.push(`강점 · ${tagToLabel(topStrong[0].tag)} 패턴이 꾸준히 유지되고 있습니다.`);
  if (topWeak.length) list.push(`약점 · 최근 스윙에서 ${tagToLabel(topWeak[0].tag)} 관련 태그가 자주 등장하고 있습니다.`);
  if (avgHead) list.push(`머리 흔들림 평균이 약 ${avgHead.toFixed(1)}% 수준입니다. 오늘은 머리 위치를 한 번 더 의식해 보세요.`);
  list.push(`최근 ${DAYS}일 동안 총 ${total}개의 스윙이 기록되었습니다. 점수 변화 추이를 보며 나만의 리듬을 만들어가고 있습니다.`);
  return list;
}

function pickBestSwing(swings) {
  if (!swings.length) return { exists: false };
  const preferred = swings.filter(s => s.feeling_code === 'perfect' || s.feeling_code === 'good');
  const list = preferred.length ? preferred : swings;
  list.sort((a, b) => Number(b.overall_score || 0) - Number(a.overall_score || 0));
  const best = list[0];

  const clubNames = { driver: '드라이버', wood: '우드', iron: '아이언', wedge: '웨지', putter: '퍼터' };
  const sideNames = { front: '정면', side: '측면', back: '후면' };

  const title = `${clubNames[best.club_type] || best.club_type} / ${sideNames[best.shot_side] || best.shot_side} · 점수 ${best.overall_score ?? '-'}점`;

  return {
    exists: true,
    id: best.id,
    title,
    date_text: new Date(best.created_at).toLocaleString('ko-KR'),
    tags: [
      ...(best.overall_score >= 70 ? ['대표 샷'] : []),
      ...(best.balance_score >= 0.97 ? ['밸런스 좋음'] : []),
      ...(best.tempo_ratio >= 2.5 && best.tempo_ratio <= 3.5 ? ['템포 안정'] : []),
    ],
  };
}

/* =======================================
   📌 GET /routine/today
   ======================================= */
router.get('/today', async (req, res) => {
  try {
    const userId = req.user.id;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - DAYS);

    const rows = await query(
      `
      SELECT s.id, s.user_id, s.club_type, s.shot_side, s.comment AS ai_comment, s.created_at,
             m.balance_score, m.tempo_ratio, m.head_movement_pct, m.overall_score,
             f.feeling_code
      FROM swings s
      LEFT JOIN metrics m ON m.swing_id = s.id
      LEFT JOIN feelings f ON f.swing_id = s.id
      WHERE s.user_id = ?
        AND s.created_at >= ?
      ORDER BY s.created_at DESC
      `,
      [userId, sinceDate]
    );

    if (!rows.length) {
      return res.json({
        ok: true,
        date_text: new Date().toLocaleDateString('ko-KR') + ' · 루틴 첫 시작',
        goal_text: '먼저 스윙을 1개 이상 업로드해 주세요.',
        focus_tags: [],
        recent_stats: [],
        patterns: ['아직 스윙 데이터가 없습니다. 오늘 첫 스윙을 기록해볼까요?'],
        best_swing: { exists: false },
        meta: { total_swings: 0, days_range: DAYS },
      });
    }

    const tagCount = {};
    const enriched = rows.map(s => {
      const tags = buildTagsForSwing(s);
      tags.forEach(t => (tagCount[t] = (tagCount[t] || 0) + 1));
      return { ...s, tags };
    });

    const total = enriched.length;
    const avgScore = avg(enriched.map(s => s.overall_score));
    const avgHead = avg(enriched.map(s => s.head_movement_pct));
    const avgBalance = avg(enriched.map(s => s.balance_score));

    const sortedTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    const topWeak = sortedTags.filter(t => weaknessTags.includes(t.tag)).slice(0, 2);
    const topStrong = sortedTags.filter(t => strengthTags.includes(t.tag)).slice(0, 1);

    const response = {
      ok: true,
      date_text: new Date().toLocaleDateString('ko-KR') + ' · 루틴 베타',
      goal_text: buildGoalText(topWeak, topStrong),
      focus_tags: [...topWeak, ...topStrong].map(t => tagToLabel(t.tag)),
      recent_stats: [
        { key: 'swing_count', label: '스윙 개수', value_text: `${total}개`, ratio: Math.min(total / 20, 1) },
        { key: 'avg_score', label: '평균 점수', value_text: `${Math.round(avgScore)}점`, ratio: Math.min(avgScore / 100, 1) },
        { key: 'head_move', label: '머리 흔들림(평균)', value_text: `${avgHead.toFixed(1)}%`, ratio: Math.min(avgHead / 100, 1) },
        { key: 'balance', label: '밸런스 점수(평균)', value_text: avgBalance.toFixed(2), ratio: Math.min(avgBalance, 1) },
      ],
      patterns: buildPatternSentences({ topWeak, topStrong, total, avgHead }),
      best_swing: pickBestSwing(enriched),
      meta: { total_swings: total, days_range: DAYS },
    };

    return res.json(response);
  } catch (err) {
    console.error('GET /routine/today error:', err);
    return res.status(500).json({ ok: false, error: 'ROUTINE_TODAY_FAILED', detail: err.message });
  }
});

/* =======================================
   📌 GET /routine/active
   ======================================= */
/**
 * GET /routine/active
 * - 현재 진행 중(IN_PROGRESS) 루틴 세션이 있는지 확인
 */
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT id, start_at, end_at, status
      FROM routine_sessions
      WHERE user_id = ?
        AND status = 'IN_PROGRESS'
      ORDER BY start_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.json({ ok: true, active: false });
    }

    const session = rows[0];

    // 선택: 이 세션 동안 업로드된 스윙 개수/평균 점수도 같이 주기
    const [statsRows] = await db.query(
      `
      SELECT 
        COUNT(*)              AS swing_count,
        AVG(m.overall_score)  AS avg_score
      FROM swings s
      LEFT JOIN metrics m ON m.swing_id = s.id
      WHERE s.user_id = ?
        AND s.created_at >= ?
      `,
      [userId, session.start_at]
    );

    const stats = statsRows[0] || { swing_count: 0, avg_score: null };

    return res.json({
      ok: true,
      active: true,
      session,
      stats,
    });
  } catch (err) {
    console.error('GET /routine/active error:', err);
    return res.status(500).json({ ok: false, error: 'ACTIVE_ROUTINE_ERROR' });
  }
});

/* =======================================
   📌 POST /routine/start
   ======================================= */
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await query(
      `
      SELECT id
      FROM routine_sessions
      WHERE user_id = ?
        AND status = 'IN_PROGRESS'
      ORDER BY start_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length) {
      return res.status(400).json({
        ok: false,
        error: 'SESSION_ALREADY_ACTIVE',
        message: '이미 진행 중인 루틴이 있습니다. 먼저 마무리해 주세요.',
      });
    }

    const result = await query(
      `
      INSERT INTO routine_sessions (user_id, start_at, status)
      VALUES (?, NOW(), 'IN_PROGRESS')
      `,
      [userId]
    );

    return res.json({ ok: true, session_id: result.insertId });
  } catch (err) {
    console.error('POST /routine/start error:', err);
    return res.status(500).json({ ok: false, error: 'START_ROUTINE_ERROR' });
  }
});

/* =======================================
   📌 POST /routine/end
   ======================================= */
router.post('/end', async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await query(
      `
      SELECT id
      FROM routine_sessions
      WHERE user_id = ?
        AND status = 'IN_PROGRESS'
      ORDER BY start_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        error: 'NO_ACTIVE_SESSION',
        message: '진행 중인 루틴이 없습니다.',
      });
    }

    const sessionId = rows[0].id;

    await query(
      `
      UPDATE routine_sessions
      SET end_at = NOW(), status = 'COMPLETED'
      WHERE id = ?
      `,
      [sessionId]
    );

    return res.json({ ok: true, session_id: sessionId });
  } catch (err) {
    console.error('POST /routine/end error:', err);
    return res.status(500).json({ ok: false, error: 'END_ROUTINE_ERROR' });
  }
});

module.exports = router;
