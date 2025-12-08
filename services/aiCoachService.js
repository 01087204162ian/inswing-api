// TODO: 실제 LLM API 연동
async function generateCoachingAnswer({ userProfile, swingAnalysis, questionText }) {
  // 지금은 더미 데이터 반환
  return {
    cause_text: '다운스윙에서 상체가 먼저 풀리면서 체중이 오른발에 남습니다.',
    solution_text: '다운스윙 시작 시 왼발을 먼저 밟고, 힙을 먼저 돌린다는 느낌으로 스윙해보세요.',
    feel_image: '"왼발 위에 머리를 세운다"는 느낌으로 피니시를 3초간 유지해보세요.',
    drill_text: '드라이버 빈스윙 10회(피니시 3초 정지) 후, 공 20개를 같은 느낌으로 스윙해보세요.',
    encouragement: '지금처럼 피니시에 신경 쓰기 시작한 것만으로도 이미 큰 첫걸음을 떼신 겁니다. 오늘은 느낌 하나만 기억해보세요.'
  };
}

module.exports = {
  generateCoachingAnswer
};

