const express = require('express');
const router = express.Router();
const db = require('../db');        // 사용 중인 DB 헬퍼
const auth = require('../middlewares/auth');

// 최근 14일 기준
const DAYS = 14;

router.get('/routine/today', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) 최근 14일 스윙 조회
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - DAYS);

    // 예시: swings + metrics + feeling 조인 (SQL은 환경에 맞게 수정)
    const swings = await db.query(`
      SELECT
        s.id,
        s.user_id,
        s.club_type,
        s.shot_side,
        s.created_at,
        m.backswing_angle,
        m.impact_speed,
        m.follow_through_angle,
        m.balance_score,
        m.tempo_ratio,
        m.backswing_time_sec,
        m.downswing_time_sec,
        m.head_movement_pct,
        m.shoulder_rotation_range,
        m.hip_rotation_range,
        m.rotation_efficiency,
        m.overall_score,
        s.comment AS ai_comment,
        f.feeling_code,
        f.note AS feeling_note
      FROM swings s
      LEFT JOIN swing_metrics m ON m.swing_id = s.id
      LEFT JOIN swing_feelings f ON f.swing_id = s.id
      WHERE s.user_id = ?
        AND s.created_at >= ?
      ORDER BY s.created_at DESC
    `, [userId, sinceDate]);

    if (!swings.length) {
      return res.json({
        ok: true,
        date_text: '오늘 · 루틴 첫 시작',
        goal_text: '먼저 스윙을 1개 이상 업로드해 주세요.',
        focus_tags: [],
        recent_stats: [],
        patterns: ['아직 스윙 데이터가 없습니다. 오늘 첫 스윙을 기록해볼까요?'],
        best_swing: { exists: false },
        meta: { total_swings: 0, days_range: DAYS }
      });
    }

    // 2) 각 스윙별 태그 생성
    const tagCount = {};
    const strengthTags = ['balance_good', 'tempo_good', 'head_stable'];
    const weaknessTags = ['head_unstable', 'tempo_fast', 'tempo_slow', 'finish_weak'];

    const enriched = swings.map(s => {
      const tags = buildTagsForSwing(s);  // 아래 함수 참고
      tags.forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
      return { ...s, tags };
    });

    // 3) 통계 계산
    const total = enriched.length;
    const avgScore = avg(enriched.map(s => s.overall_score));
    const avgHead = avg(enriched.map(s => s.head_movement_pct));
    const avgBalance = avg(enriched.map(s => s.balance_score));

    // ratio(0~1) 값은 간단하게 정규화
    const recentStats = [
      { key: 'swing_count', label: '스윙 개수', value_text: `${total}개`, ratio: Math.min(total / 20, 1) },
      { key: 'avg_score', label: '평균 점수', value_text: `${Math.round(avgScore)}점`, ratio: Math.min(avgScore / 100, 1) },
      { key: 'head_move', label: '머리 흔들림(평균)', value_text: `${avgHead.toFixed(1)}%`, ratio: Math.min(avgHead / 100, 1) },
      { key: 'balance', label: '밸런스 점수(평균)', value_text: avgBalance.toFixed(2), ratio: Math.min(avgBalance, 1) }
    ];

    // 4) 강점/약점 태그 상위 추출
    const sortedTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    const topWeak = sortedTags.filter(t => weaknessTags.includes(t.tag)).slice(0, 2);
    const topStrong = sortedTags.filter(t => strengthTags.includes(t.tag)).slice(0, 1);

    // 5) 포커스 태그 한국어 레이블
    const focusTags = [
      ...topWeak,
      ...topStrong
    ].map(t => tagToLabel(t.tag));

    // 6) 패턴 설명 문장
    const patterns = buildPatternSentences({ topWeak, topStrong, total, avgScore, avgHead, avgBalance });

    // 7) 대표 스윙 선택 (점수 + feeling 고려)
    const bestSwing = pickBestSwing(enriched);

    const response = {
      ok: true,
      date_text: '오늘 · 루틴 베타',
      goal_text: buildGoalText(topWeak, topStrong),
      focus_tags: focusTags,
      recent_stats: recentStats,
      patterns,
      best_swing: bestSwing,
      meta: { total_swings: total, days_range: DAYS }
    };

    res.json(response);
  } catch (err) {
    console.error('GET /routine/today error:', err);
    res.status(500).json({ ok: false, error: 'ROUTINE_TODAY_FAILED' });
  }
});

function avg(list) {
  const nums = list.map(Number).filter(n => !Number.isNaN(n));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ---- 태그 생성 규칙 ----
function buildTagsForSwing(s) {
  const tags = [];
  const head = Number(s.head_movement_pct);
  const balance = Number(s.balance_score);
  const tempo = s.tempo_ratio != null ? Number(s.tempo_ratio) : null;
  const score = s.overall_score != null ? Number(s.overall_score) : null;
  const comment = (s.ai_comment || '').toLowerCase();

  if (!Number.isNaN(balance) && balance >= 0.97) tags.push('balance_good');
  if (!Number.isNaN(balance) && balance < 0.9) tags.push('balance_weak');

  if (!Number.isNaN(head) && head >= 40) tags.push('head_unstable');
  if (!Number.isNaN(head) && head <= 15) tags.push('head_stable');

  if (tempo != null && !Number.isNaN(tempo)) {
    if (tempo < 0.8) tags.push('tempo_fast');
    else if (tempo > 3.5) tags.push('tempo_slow');
    else tags.push('tempo_good');
  }

  if (score != null && score >= 70) tags.push('overall_good');
  if (score != null && score <= 45) tags.push('overall_low');

  // 코멘트 키워드 기반
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
    overall_good: '현재 리듬 유지'
  };
  return map[tag] || tag;
}

function buildGoalText(topWeak, topStrong) {
  if (!topWeak.length && !topStrong.length) return '오늘은 가볍게 리듬만 느끼며 스윙해 보세요.';
  const weakLabels = topWeak.map(t => tagToLabel(t.tag));
  if (weakLabels.length >= 2) {
    return `${weakLabels[0]}와 ${weakLabels[1]}에 집중해 보는 하루를 추천합니다.`;
  }
  if (weakLabels.length === 1) {
    return `${weakLabels[0]}에 집중하면서, 강점은 그대로 유지해 보는 루틴입니다.`;
  }
  const strongLabels = topStrong.map(t => tagToLabel(t.tag));
  return `${strongLabels.join(', ')} 강점을 유지하면서 편안하게 스윙해 보세요.`;
}

function buildPatternSentences({ topWeak, topStrong, total, avgScore, avgHead, avgBalance }) {
  const sentences = [];
  if (topStrong.length) {
    const label = tagToLabel(topStrong[0].tag);
    sentences.push(`강점 · ${label} 패턴이 꾸준히 유지되고 있습니다.`);
  }
  if (topWeak.length) {
    const label = tagToLabel(topWeak[0].tag);
    sentences.push(`약점 · 최근 스윙에서 ${label} 관련 태그가 자주 등장하고 있습니다.`);
  }
  if (avgHead) {
    sentences.push(`머리 흔들림 평균이 약 ${avgHead.toFixed(1)}% 수준입니다. 오늘은 머리 위치를 한 번 더 의식해 보세요.`);
  }
  sentences.push(`최근 ${DAYS}일 동안 총 ${total}개의 스윙이 기록되었습니다. 점수 변화 추이를 보며 나만의 리듬을 만들어가고 있습니다.`);
  return sentences;
}

function pickBestSwing(swings) {
  if (!swings.length) return { exists: false };

  // feeling이 perfect/good인 것 우선 + 점수
  const preferred = swings.filter(s =>
    s.feeling_code === 'perfect' || s.feeling_code === 'good'
  );
  const candidateList = preferred.length ? preferred : swings;

  candidateList.sort((a, b) => {
    const sa = Number(a.overall_score || 0);
    const sb = Number(b.overall_score || 0);
    return sb - sa;
  });

  const best = candidateList[0];
  const clubNames = { driver: '드라이버', wood: '우드', iron: '아이언', wedge: '웨지', putter: '퍼터' };
  const sideNames = { front: '정면', side: '측면', back: '후면' };

  const title = `${clubNames[best.club_type] || best.club_type} / ${sideNames[best.shot_side] || best.shot_side} · 점수 ${best.overall_score ?? '-'}점`;

  const date = new Date(best.created_at);
  const dateText = date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  });

  const tags = [];
  if (best.overall_score >= 70) tags.push('대표 샷');
  if (best.balance_score >= 0.97) tags.push('밸런스 좋음');
  if (best.tempo_ratio && best.tempo_ratio >= 2.5 && best.tempo_ratio <= 3.5) tags.push('템포 안정');

  return {
    exists: true,
    id: best.id,
    title,
    date_text: dateText,
    tags
  };
}

module.exports = router;
