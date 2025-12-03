require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 로그 디렉토리 경로
const LOG_DIR = path.join(__dirname, '../logs');
const AI_COACHING_LOG = path.join(LOG_DIR, 'ai-coaching.log');
const PERFORMANCE_LOG = path.join(LOG_DIR, 'performance.log');

// logs 폴더가 없으면 생성
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 공용 Claude 호출 함수
 */
async function callClaudeAPI(prompt, options = {}) {
  const model = options.model || 'claude-3-haiku-20240307';
  const maxTokens = options.max_tokens || 400;

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: options.temperature ?? 0.6,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  return message?.content?.[0]?.text?.trim() || '';
}

/**
 * Claude API 간단 연결 테스트
 * - 성공 시 한국어 텍스트 한 줄을 반환
 */
async function testConnection() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  try {
    const text = await callClaudeAPI(
      '안녕하세요! INSWING AI 코칭 서버 연결 테스트입니다. 한 문장만 정중하게 답해 주세요.',
      { max_tokens: 80 }
    );
    return text;
  } catch (error) {
    console.error('Claude API 연결 실패:', error);
    throw error;
  }
}

/**
 * 평소 대비 변화량 계산
 * @param {Object} currentMetrics - 현재 스윙 메트릭
 * @param {Object} previousMetrics - 평균 메트릭 (최근 N개 평균)
 * @returns {Object} 변화량 정보
 */
function calculateChange(currentMetrics, previousMetrics) {
  if (!previousMetrics) return null;

  const changes = {};

  // head_movement_pct: 변화량 (퍼센트 포인트)
  if (typeof currentMetrics.head_movement_pct === 'number' && typeof previousMetrics.head_movement_pct === 'number') {
    changes.head_movement_pct = currentMetrics.head_movement_pct - previousMetrics.head_movement_pct;
  }

  // balance_score: 변화량
  if (typeof currentMetrics.balance_score === 'number' && typeof previousMetrics.balance_score === 'number') {
    changes.balance_score = currentMetrics.balance_score - previousMetrics.balance_score;
  }

  // tempo_ratio: 변화량 (퍼센트)
  if (typeof currentMetrics.tempo_ratio === 'number' && typeof previousMetrics.tempo_ratio === 'number') {
    changes.tempo_ratio = ((currentMetrics.tempo_ratio - previousMetrics.tempo_ratio) / previousMetrics.tempo_ratio) * 100;
  }

  // backswing_angle: 변화량 (도)
  if (typeof currentMetrics.backswing_angle === 'number' && typeof previousMetrics.backswing_angle === 'number') {
    changes.backswing_angle = currentMetrics.backswing_angle - previousMetrics.backswing_angle;
  }

  // follow_through_angle: 변화량 (도)
  if (typeof currentMetrics.follow_through_angle === 'number' && typeof previousMetrics.follow_through_angle === 'number') {
    changes.follow_through_angle = currentMetrics.follow_through_angle - previousMetrics.follow_through_angle;
  }

  return changes;
}

/**
 * 변화량 기반 비교 태그 생성
 * @param {Object} changes - calculateChange 결과
 * @returns {string} 비교 태그
 */
function getCompareTag(changes) {
  if (!changes) return '평소 수준 유지';

  // 1순위: head_movement_pct 변화량 ≥ +10%
  if (typeof changes.head_movement_pct === 'number' && changes.head_movement_pct >= 10) {
    return '평소보다 머리 흔들림 증가';
  }

  // 2순위: balance_score 변화량 ≥ ±0.03
  if (typeof changes.balance_score === 'number') {
    if (Math.abs(changes.balance_score) >= 0.03) {
      return changes.balance_score < 0 ? '평소보다 밸런스 흔들림' : '평소보다 밸런스 안정';
    }
  }

  // 3순위: tempo_ratio 변화량 ≥ ±15%
  if (typeof changes.tempo_ratio === 'number') {
    if (Math.abs(changes.tempo_ratio) >= 15) {
      return changes.tempo_ratio > 0 ? '평소보다 템포 빠름' : '평소보다 템포 느림';
    }
  }

  // 4순위: backswing or follow_through ±10°
  if (typeof changes.backswing_angle === 'number' && Math.abs(changes.backswing_angle) >= 10) {
    return changes.backswing_angle > 0 ? '평소보다 백스윙 증가' : '평소보다 백스윙 감소';
  }

  if (typeof changes.follow_through_angle === 'number' && Math.abs(changes.follow_through_angle) >= 10) {
    return changes.follow_through_angle > 0 ? '평소보다 팔로우스루 증가' : '평소보다 팔로우스루 감소';
  }

  // 5순위: 변화 미미
  return '평소 수준 유지';
}

/**
 * 스윙 메트릭 기반 AI 코멘트 생성 (존댓말)
 * metrics: analyze_swing 결과 (숫자/nullable)
 * swing: { club_type, shot_side, user_id?, id?, user_name? }
 * feeling: { feeling_code, note } | null
 * previousMetrics: { ... } | null - 평소 평균 메트릭 (비교용)
 */
async function generateCoaching(metrics, swing, feeling = null, previousMetrics = null) {
  const startTime = Date.now();
  const userId = swing.user_id || null;
  const swingId = swing.id || null;
  const userName = swing.user_name || null;

  if (!metrics || !swing) {
    const error = new Error('metrics와 swing 정보가 필요합니다.');
    logAICoaching({
      userId,
      swingId,
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    });
    throw error;
  }

  const clubNames = {
    driver: '드라이버',
    wood: '우드',
    iron: '아이언',
    wedge: '웨지',
    putter: '퍼터'
  };

  const sideNames = {
    front: '정면',
    side: '측면',
    back: '후면'
  };

  const feelingNames = {
    perfect: '오늘 스윙이 거의 완벽하게 느껴졌습니다.',
    good: '오늘 스윙이 전반적으로 괜찮게 느껴졌습니다.',
    normal: '오늘 스윙이 그냥 보통이라고 느껴졌습니다.',
    bad: '오늘 스윙이 아쉽다고 느껴졌습니다.'
  };

  const clubName = clubNames[swing.club_type] || swing.club_type || '알 수 없음';
  const sideName = sideNames[swing.shot_side] || swing.shot_side || '알 수 없음';

  // 숫자 원본 & 표시용 분리
  const overallRaw = metrics.overall_score;
  const tempoRaw = metrics.tempo_ratio;
  const headMoveRaw = metrics.head_movement_pct;
  const balanceRaw = metrics.balance_score;

  const overall = overallRaw ?? '알 수 없음';
  const tempo = tempoRaw ?? '알 수 없음';
  const headMove = headMoveRaw ?? '알 수 없음';
  const balance = balanceRaw ?? '알 수 없음';

  const feelingLine = feeling?.feeling_code
    ? (feelingNames[feeling.feeling_code] || '')
    : '';

  const userNote = feeling?.note ? feeling.note.trim() : '';

  // 사용자 이름 처리: 있으면 이름 사용, 없으면 "님"만 붙임
  const userGreeting = userName ? `${userName}님` : '님';

  // 점수대에 따른 해석/톤 가이드
  let scoreBand = 'unknown';
  let scoreGuide = '점수 정보가 부족하므로, 무난한 톤으로 솔직하게 피드백해 주세요.';

  if (typeof overallRaw === 'number') {
    if (overallRaw >= 4.5) {
      scoreBand = 'high';
      scoreGuide =
        '오늘은 비교적 잘 맞은 날에 가깝습니다. 장점을 먼저 분명하게 짚어 주시고, 아쉬운 점은 한 가지 정도만 부드럽게 언급해 주세요.';
    } else if (overallRaw >= 3) {
      scoreBand = 'mid';
      scoreGuide =
        '좋은 점과 아쉬운 점이 함께 있는 날입니다. 장점 1~2가지와 개선해야 할 핵심 1가지를 균형 있게 언급해 주세요.';
    } else {
      scoreBand = 'low';
      scoreGuide =
        '오늘은 평소보다 조금 흔들린 날입니다. 스윙이 나빴다고 단정 짓지 말고, 위로와 격려를 먼저 건넨 뒤, 가장 중요한 문제 1가지만 짚어 주세요.';
    }
  }

  const prompt = `당신은 20년 경력의 친절한 골프 레슨 프로입니다.
아마추어 골퍼의 스윙 데이터를 보고, 공감해 주면서도 구체적인 조언을 해 주는 역할입니다.

반드시 **존댓말**로만 말해 주세요. 너무 가볍지 않지만, 따뜻하고 응원하는 톤이면 좋겠습니다.

**호칭 규칙 (매우 중요):**
- "고객님", "고객", "선생님", "선수님", "선배님", "아마추어", "골퍼님" 등의 호칭은 절대 사용하지 마세요.
- 반드시 "${userGreeting}"만 사용하세요.
- 피드백의 첫 문장은 반드시 "${userGreeting},"으로 시작하세요.
- 두 번째 문장 이후에는 "${userGreeting}"을 반복하지 마세요. 자연스러움이 우선입니다.

### 스윙 정보
- 클럽: ${clubName}
- 촬영 방향: ${sideName}
${feelingLine ? `- 골퍼의 주관적 느낌: ${feelingLine}` : ''}
${userNote ? `- 골퍼 메모: "${userNote}"` : ''}

### 분석 메트릭 (숫자는 참고용입니다)
- 종합 스윙 점수(1~5): ${overall}
- 템포 비율(백스윙:다운스윙): ${tempo}
- 머리 흔들림: ${headMove} (%)
- 밸런스 점수: ${balance}
- 백스윙 각도: ${metrics.backswing_angle ?? '알 수 없음'}
- 팔로우스루 각도: ${metrics.follow_through_angle ?? '알 수 없음'}

### 점수대에 따른 톤 가이드
- 점수대: ${scoreBand}
- 설명: ${scoreGuide}
${previousMetrics ? `
### 평소 대비 변화 (중요)
이번 스윙이 평소 대비 어떻게 다른지 아래 정보를 참고해 주세요.
- 평소 평균 머리 흔들림: ${previousMetrics.head_movement_pct?.toFixed(1) ?? '알 수 없음'}% (현재: ${headMoveRaw ?? '알 수 없음'}%)
- 평소 평균 밸런스: ${previousMetrics.balance_score?.toFixed(3) ?? '알 수 없음'} (현재: ${balanceRaw ?? '알 수 없음'})
- 평소 평균 템포: ${previousMetrics.tempo_ratio?.toFixed(2) ?? '알 수 없음'} (현재: ${tempoRaw ?? '알 수 없음'})
- 평소 평균 백스윙 각도: ${previousMetrics.backswing_angle?.toFixed(1) ?? '알 수 없음'}° (현재: ${metrics.backswing_angle ?? '알 수 없음'}°)
- 평소 평균 팔로우스루 각도: ${previousMetrics.follow_through_angle?.toFixed(1) ?? '알 수 없음'}° (현재: ${metrics.follow_through_angle ?? '알 수 없음'}°)

**평소 대비 코멘트 작성 규칙:**
- 이번 스윙이 평소 대비 어떻게 다른지 2~3문장으로 설명해 주세요.
- 수치 변화는 직접 언급하지 말고, 변화의 방향만 언급해 주세요. (예: "평소보다 조금 빠른 편", "평소와 비슷한 수준")
- 비판적이지만 따뜻한 톤으로 작성해 주세요.
- 평소보다 나아진 점이 있으면 격려해 주시고, 아쉬운 점이 있으면 부드럽게 지적해 주세요.
` : ''}

위 정보를 바탕으로, 아래 조건을 꼭 지켜서 **2~3문장**의 피드백을 작성해 주세요.

1. 첫 문장은 전체적인 느낌을 부드럽게 정리해 주세요.
   - 예) "${userGreeting}, 이번 스윙은 전체적으로 리듬이 안정적이셨습니다." 처럼요.
   - 점수대에 따라, 오늘이 "잘 맞은 날", "보통인 날", "조금 흔들린 날" 중 어떤 느낌인지 자연스럽게 표현해 주세요.

2. 두 번째 문장은 가장 중요한 한 가지 포인트를 짚어 주세요.
   - 예) 머리 흔들림, 템포, 밸런스, 회전 중에서 **가장 영향이 큰 것 한 가지만** 선택해서 말씀해 주세요.

3. 세 번째 문장은 바로 연습할 수 있는 간단한 행동 지침을 제안해 주세요.
   - 예) "다음 연습 때는 ○○에만 한 번 집중해서 스윙해 보시면 좋겠습니다." 처럼요.
   - 두 번째 문장 이후에는 "${userGreeting}"을 사용하지 마세요.

추가 규칙:
- 과장된 표현(프로 수준, 완벽합니다 등)은 피하고, 솔직하지만 따뜻하게 말씀해 주세요.
- 템포나 머리 흔들림과 같은 숫자는 그대로 읽어주기보다는,
  "조금 빠른 편", "표준에 가까운 편", "다소 큰 편"처럼 **정성적인 표현**으로 설명해 주세요.
- 너무 전문적인 용어보다는, 아마추어가 이해하기 쉬운 표현으로 정리해 주세요.
- 이모티콘은 사용하지 마세요.
- 전체 코멘트 길이는 120자에서 200자 사이로 맞춰 주세요.
- 문장은 2~3문장으로만 작성하고, 4문장을 넘기지 마세요.
- 말줄임표(...)로 끝내지 말고, 완전한 문장으로 마무리해 주세요.

위 조건을 모두 반영하여, 한글로만 2~3문장으로 피드백을 작성해 주세요.`;

  try {
    const coachingStartTime = Date.now();
    const coaching = await callClaudeAPI(prompt, {
      max_tokens: 320,
      temperature: 0.7
    });
    const coachingDuration = Date.now() - coachingStartTime;

    // ---- 코멘트 후처리: 문장 수 및 길이 제한 ----
    let finalComment = (coaching || '').trim();

    // 1) 공백 정리
    finalComment = finalComment.replace(/\s+/g, ' ');

    // 2) 문장 분리 (마침표 기준) 후 최대 3문장까지만 사용
    let sentences = finalComment.split(/(?<=\.)\s+/).filter(Boolean);
    if (sentences.length > 3) {
      sentences = sentences.slice(0, 3);
    }
    finalComment = sentences.join(' ').trim();

    // 3) 길이 제한 (최대 220자 정도로 컷)
    const MAX_LEN = 220;
    if (finalComment.length > MAX_LEN) {
      const words = finalComment.split(' ');
      let trimmed = '';

      for (const word of words) {
        const candidate = trimmed ? trimmed + ' ' + word : word;
        if (candidate.length > MAX_LEN) break;
        trimmed = candidate;
      }

      finalComment = trimmed.trim();

      // 문장 끝이 마침표가 아니면 간단히 마무리
      if (!/[.!?]$/.test(finalComment)) {
        finalComment += '다.';
      }
    }

    // 4) 말줄임표 제거 및 완전한 문장으로 마무리
    finalComment = finalComment.replace(/\.{2,}/g, '').trim();
    if (!/[.!?]$/.test(finalComment)) {
      finalComment += '다.';
    }

    // 5) 최소 길이 방어 (너무 짧으면 원문 유지)
    if (finalComment.length < 60 && coaching) {
      finalComment = coaching.trim();
      // 원문도 말줄임표 제거
      finalComment = finalComment.replace(/\.{2,}/g, '').trim();
      if (!/[.!?]$/.test(finalComment)) {
        finalComment += '다.';
      }
    }

    const totalDuration = Date.now() - startTime;
    logAICoaching({
      userId,
      swingId,
      success: true,
      duration: totalDuration,
      tokensUsed: null,
      model: 'claude-3-haiku-20240307'
    });

    logPerformance({
      operation: 'generateCoaching',
      duration: totalDuration,
      success: true
    });

    return finalComment;
  } catch (error) {
    const totalDuration = Date.now() - startTime;

    logAICoaching({
      userId,
      swingId,
      success: false,
      duration: totalDuration,
      error: error.message || '알 수 없는 오류'
    });

    logPerformance({
      operation: 'generateCoaching',
      duration: totalDuration,
      success: false,
      error: error.message || '알 수 없는 오류'
    });

    throw error;
  }
}

/**
 * AI 코칭 로그 기록
 * @param {Object} data - 로그 데이터
 * @param {number} data.userId - 사용자 ID
 * @param {number} data.swingId - 스윙 ID
 * @param {boolean} data.success - 성공 여부
 * @param {number} data.duration - 소요 시간 (ms)
 * @param {number} [data.tokensUsed] - 사용된 토큰 수
 * @param {string} [data.error] - 에러 메시지
 * @param {string} [data.model] - 사용된 모델
 */
function logAICoaching(data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      userId: data.userId || null,
      swingId: data.swingId || null,
      success: data.success,
      duration: data.duration,
      tokensUsed: data.tokensUsed || null,
      model: data.model || 'claude-3-haiku-20240307',
      error: data.error || null
    };

    // JSON 형태로 로그 파일에 추가
    fs.appendFileSync(AI_COACHING_LOG, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    // 로깅 실패해도 메인 로직에는 영향 없도록
    console.error('로깅 실패:', err);
  }
}

/**
 * 성능 로그 기록
 * @param {Object} data - 성능 데이터
 * @param {string} data.operation - 작업명 (예: 'generateCoaching', 'callClaudeAPI')
 * @param {number} data.duration - 소요 시간 (ms)
 * @param {boolean} data.success - 성공 여부
 * @param {string} [data.error] - 에러 메시지
 */
function logPerformance(data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation: data.operation,
      duration: data.duration,
      success: data.success,
      error: data.error || null
    };

    fs.appendFileSync(PERFORMANCE_LOG, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error('성능 로깅 실패:', err);
  }
}

/**
 * 스윙 메트릭 기반 핵심 포인트 태그 생성
 * - 입력: analyze_swing 결과(metrics)
 * - 출력: string (예: '머리 고정', '템포', '밸런스', '회전', '리듬 유지')
 */
function getFocusTag(metrics = {}) {
  const tempo = metrics.tempo_ratio;
  const headMove = metrics.head_movement_pct;
  const balance = metrics.balance_score;
  const backswing = metrics.backswing_angle;
  const followThrough = metrics.follow_through_angle;

  // 1순위: 머리 흔들림 (크면 '머리 고정')
  if (typeof headMove === 'number') {
    if (headMove >= 50) {
      return '머리 고정';
    }
  }

  // 2순위: 밸런스 (낮으면 '밸런스')
  if (typeof balance === 'number') {
    if (balance < 0.95) {
      return '밸런스';
    }
  }

  // 3순위: 템포 (너무 빠르거나, 비정상적인 값이면 '템포')
  if (typeof tempo === 'number') {
    // INSwing 데이터 기준: 0.5 이하, 4.0 이상은 "리듬이 흔들린 상태"로 간주
    if (tempo <= 0.5 || tempo >= 4.0) {
      return '템포';
    }
  }

  // 4순위: 회전 (백스윙/팔로우스루가 작은 경우)
  if (typeof backswing === 'number' && typeof followThrough === 'number') {
    if (backswing < 100 || followThrough < 100) {
      return '회전';
    }
  }

  // 기본: 특별한 문제 없으면 리듬 유지
  return '리듬 유지';
}

module.exports = {
  testConnection,
  callClaudeAPI,
  generateCoaching,
  logAICoaching,
  logPerformance,
  getFocusTag,
  calculateChange,
  getCompareTag
};

