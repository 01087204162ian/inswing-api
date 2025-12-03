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
 * 스윙 메트릭 기반 AI 코멘트 생성 (존댓말)
 * metrics: analyze_swing 결과 (숫자/nullable)
 * swing: { club_type, shot_side, user_id?, id?, user_name? }
 * feeling: { feeling_code, note } | null
 */
async function generateCoaching(metrics, swing, feeling = null) {
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
- 문장 중간에도 필요시 "${userGreeting}"을 자연스럽게 사용하세요.

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

위 정보를 바탕으로, 아래 조건을 꼭 지켜서 **2~3문장**의 피드백을 작성해 주세요.

1. 첫 문장은 전체적인 느낌을 부드럽게 정리해 주세요.
   - 예) "${userGreeting}, 이번 스윙은 전체적으로 리듬이 안정적이셨습니다." 처럼요.
   - 점수대에 따라, 오늘이 "잘 맞은 날", "보통인 날", "조금 흔들린 날" 중 어떤 느낌인지 자연스럽게 표현해 주세요.

2. 두 번째 문장은 가장 중요한 한 가지 포인트를 짚어 주세요.
   - 예) 머리 흔들림, 템포, 밸런스, 회전 중에서 **가장 영향이 큰 것 한 가지만** 선택해서 말씀해 주세요.

3. 세 번째 문장은 바로 연습할 수 있는 간단한 행동 지침을 제안해 주세요.
   - 예) "${userGreeting}, 다음 연습 때는 ○○에만 한 번 집중해서 스윙해 보시면 좋겠습니다." 처럼요.

추가 규칙:
- 과장된 표현(프로 수준, 완벽합니다 등)은 피하고, 솔직하지만 따뜻하게 말씀해 주세요.
- 템포나 머리 흔들림과 같은 숫자는 그대로 읽어주기보다는,
  "조금 빠른 편", "표준에 가까운 편", "다소 큰 편"처럼 **정성적인 표현**으로 설명해 주세요.
- 너무 전문적인 용어보다는, 아마추어가 이해하기 쉬운 표현으로 정리해 주세요.
- 이모티콘은 사용하지 마세요.

위 조건을 모두 반영하여, 한글로만 2~3문장으로 피드백을 작성해 주세요.`;

  try {
    const coachingStartTime = Date.now();
    const coaching = await callClaudeAPI(prompt, {
      max_tokens: 320,
      temperature: 0.7
    });
    const coachingDuration = Date.now() - coachingStartTime;

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

    return coaching;
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

module.exports = {
  testConnection,
  callClaudeAPI,
  generateCoaching,
  logAICoaching,
  logPerformance
};

