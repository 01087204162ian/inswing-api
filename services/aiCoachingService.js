require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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
 * swing: { club_type, shot_side, user_id?, id? }
 * feeling: { feeling_code, note } | null
 */
async function generateCoaching(metrics, swing, feeling = null) {
  if (!metrics || !swing) {
    throw new Error('metrics와 swing 정보가 필요합니다.');
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

  const overall = metrics.overall_score ?? '알 수 없음';
  const tempo = metrics.tempo_ratio ?? '알 수 없음';
  const headMove = metrics.head_movement_pct ?? '알 수 없음';
  const balance = metrics.balance_score ?? '알 수 없음';

  const feelingLine = feeling?.feeling_code
    ? (feelingNames[feeling.feeling_code] || '')
    : '';

  const userNote = feeling?.note ? feeling.note.trim() : '';

  const prompt = `당신은 20년 경력의 친절한 골프 레슨 프로입니다.
아마추어 골퍼의 스윙 데이터를 보고, 공감해 주면서도 구체적인 조언을 해 주는 역할입니다.

반드시 **존댓말**로만 말해 주세요. 너무 가볍지 않지만, 따뜻하고 응원하는 톤이면 좋겠습니다.

### 스윙 정보
- 클럽: ${clubName}
- 촬영 방향: ${sideName}
${feelingLine ? `- 골퍼의 주관적 느낌: ${feelingLine}` : ''}
${userNote ? `- 골퍼 메모: "${userNote}"` : ''}

### 분석 메트릭 (숫자는 참고용입니다)
- 종합 스윙 점수: ${overall}
- 템포 비율(백스윙:다운스윙): ${tempo}
- 머리 흔들림: ${headMove} (%)
- 밸런스 점수: ${balance}
- 백스윙 각도: ${metrics.backswing_angle ?? '알 수 없음'}
- 팔로우스루 각도: ${metrics.follow_through_angle ?? '알 수 없음'}

위 정보를 바탕으로, 아래 조건을 꼭 지켜서 **2~3문장**의 피드백을 작성해 주세요.

1. 첫 문장은 전체적인 느낌을 부드럽게 정리해 주세요.
   - 예) "이번 스윙은 전체적으로 리듬이 안정적이셨습니다." 처럼요.
2. 두 번째 문장은 가장 중요한 한 가지 포인트를 짚어 주세요.
   - 예) 머리 흔들림, 템포, 밸런스, 회전 중 하나를 선택해서 말씀해 주세요.
3. 세 번째 문장은 바로 연습할 수 있는 간단한 행동 지침을 제안해 주세요.
   - 예) "다음 연습 때는 ○○에만 한 번 집중해서 스윙해 보시면 좋겠습니다." 처럼요.

추가 규칙:
- 과장된 표현(프로 수준, 완벽합니다 등)은 피하고, 솔직하지만 따뜻하게 말씀해 주세요.
- 너무 전문적인 용어보다는, 아마추어가 이해하기 쉬운 표현으로 정리해 주세요.
- 이모티콘은 사용하지 마세요.

위 조건을 모두 반영하여, 한글로만 2~3문장으로 피드백을 작성해 주세요.`;

  const coaching = await callClaudeAPI(prompt, {
    max_tokens: 320,
    temperature: 0.7
  });

  return coaching;
}

module.exports = {
  testConnection,
  callClaudeAPI,
  generateCoaching
};

