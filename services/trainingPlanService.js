// TODO: LLM 연동으로 대체
async function generateTrainingPlan({ userProfile, question, swingAnalysis, practiceFrequency, intensity }) {
  // 더미 계획 반환
  const plan = {
    duration_weeks: 2,
    focus_theme: '피니시 균형 안정',
    sessions_per_week:
      practiceFrequency === '1_per_week'
        ? 1
        : practiceFrequency === '2-3_per_week'
          ? 3
          : 5,
    sessions: [
      {
        week_number: 1,
        day_hint: '월',
        objective: '왼발 위에 중심을 두고 피니시 3초 유지',
        drills: [
          { name: '빈스윙 피니시 3초', reps: 15, balls: 0, notes: '거울 앞에서' },
          { name: '드라이버 실스윙', reps: 20, balls: 20, notes: '피니시 정지 3초' }
        ]
      },
      {
        week_number: 1,
        day_hint: '수',
        objective: '힙턴 선행 느낌 강화',
        drills: [
          { name: '체중이동 연습', reps: 15, balls: 0, notes: '천천히' },
          { name: '7번 아이언 스윙', reps: 30, balls: 30, notes: '왼발 체중 유지' }
        ]
      }
    ]
  };

  return plan;
}

module.exports = {
  generateTrainingPlan
};

