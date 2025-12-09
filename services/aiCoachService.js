const { callClaudeWithSystem } = require('./aiCoachingService');

const HIGH_CLASS_SYSTEM_PROMPT = `
당신은 투어 프로 선수들을 지도하는 하이클래스 골프 코치입니다.
말투는 항상 존댓말이며, 차분하고 품격 있게 안내합니다.
반말, 과한 감탄사, 가벼운 농담은 사용하지 않습니다.
문제를 솔직하게 지적하되 사람을 비난하지 않습니다.
한 번에 핵심 1~2개에 집중하고, 연습은 횟수/시간을 포함해 구체적으로 조언합니다.
`;

/**
 * 질문 코칭 답변 생성 (5블록 고정)
 */
async function generateCoachingAnswer({ userProfile, swingAnalysis, questionText }) {
  const userProfileLine = userProfile
    ? `- 경험: ${userProfile.experience_years ?? '정보 없음'}년, 평균 스코어: ${userProfile.avg_score ?? '정보 없음'}, 선호 스타일: ${userProfile.preferred_style ?? '정보 없음'}`
    : '- 경험/평균 스코어 정보 없음';

  const swingLine = swingAnalysis
    ? `- 스윙 요약: ${JSON.stringify(swingAnalysis)}`
    : '- 스윙 분석 데이터가 아직 제공되지 않았습니다.';

  const userPrompt = `
질문에 답변할 때 아래 형식을 STRICT하게 지켜 주세요. 순서와 이모지는 절대 바꾸지 마세요.

🔍 원인: (1–2문장)
💡 해결책: (1–2문장)
🎯 느낌: (1문장, 이미지/키워드 중심)
📘 연습: (1–2문장, 횟수/숫자 포함)
✨ 격려: (1문장, 긍정적 마무리)

[골퍼 질문]
${questionText}

[배경 정보]
${userProfileLine}
${swingLine}

추가 규칙:
- 한국어 존댓말, 차분한 전문가 톤
- 한 번에 핵심 1~2개만
- 숫자/횟수를 포함해 구체적으로 제시
- 반말/과한 감탄사/농담 금지
`;

  const parseBlocks = (text) => {
    const blocks = {
      cause_text: '',
      solution_text: '',
      feel_image: '',
      drill_text: '',
      encouragement: ''
    };

    const regexMap = {
      cause_text: /🔍\s*원인:\s*([\s\S]*?)(?=💡|$)/,
      solution_text: /💡\s*해결책:\s*([\s\S]*?)(?=🎯|$)/,
      feel_image: /🎯\s*느낌:\s*([\s\S]*?)(?=📘|$)/,
      drill_text: /📘\s*연습:\s*([\s\S]*?)(?=✨|$)/,
      encouragement: /✨\s*격려:\s*([\s\S]*)/
    };

    Object.entries(regexMap).forEach(([key, regex]) => {
      const match = text.match(regex);
      if (match && match[1]) {
        blocks[key] = match[1].trim().replace(/\s+/g, ' ');
      }
    });

    return blocks;
  };

  const fallback = {
    cause_text: '다운스윙에서 체중이 충분히 왼쪽으로 이동하지 않아 균형이 흔들리는 경향이 있습니다.',
    solution_text: '다운스윙을 시작할 때 왼발을 먼저 단단히 밟고, 상체는 반 박자 늦게 따라오도록 의식해 보세요.',
    feel_image: '"왼발 위에 머리를 세운다"는 느낌으로 피니시를 3초간 유지합니다.',
    drill_text: '드라이버 빈스윙 10회(피니시 3초 정지) 후, 같은 느낌으로 실제 샷 10개를 반복해 보세요.',
    encouragement: '임팩트 전까지의 리듬은 이미 안정적입니다. 오늘은 피니시 균형 한 가지만 차분히 점검해 보시면 좋겠습니다.'
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const llmText = await callClaudeWithSystem(HIGH_CLASS_SYSTEM_PROMPT, userPrompt, {
        max_tokens: 700,
        temperature: 0.35
      });

      const parsed = parseBlocks(llmText || '');
      const allFilled = Object.values(parsed).every((v) => v && v.length > 0);
      if (allFilled) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[generateCoachingAnswer] attempt ${attempt + 1} failed:`, err.message);
    }
  }

  return fallback;
}

console.log('[AI-Coaching] 프롬프트 업데이트 및 하이클래스 코치톤 적용 완료');

module.exports = {
  generateCoachingAnswer
};

