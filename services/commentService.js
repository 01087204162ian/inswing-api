// services/commentService.js

function pickRandom(arr) {
  if (!arr || arr.length === 0) return '';
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function generateSwingComment(metrics = {}, options = {}) {
  const comments = [];

  const backswing = num(metrics.backswing_angle);
  const follow = num(metrics.follow_through_angle);
  const balance = num(metrics.balance_score);
  const tempo = num(metrics.tempo_ratio);
  const headMove = num(metrics.head_movement_pct);
  const overall = num(metrics.overall_score);

  // 1) 전체 한 줄 요약
  if (overall !== null) {
    if (overall >= 85) {
      comments.push(
        pickRandom([
          '오늘 스윙은 전체적으로 아주 안정적이고 완성도가 높았습니다.',
          '최근 스윙 중에서 상위권에 드는 좋은 결과예요. 자신감을 가져도 좋습니다.',
          '데이터만 보면 거의 베스트 컨디션에 가까운 스윙입니다.'
        ])
      );
    } else if (overall >= 70) {
      comments.push(
        pickRandom([
          '전반적으로 밸런스와 리듬이 나쁘지 않은 스윙입니다.',
          '기본기는 잘 유지되고 있어요. 일부 요소만 다듬으면 더 좋아질 수 있습니다.',
          '균형 잡힌 스윙이지만, 한두 가지 포인트만 보완하면 더 안정적인 샷이 될 수 있어요.'
        ])
      );
    } else {
      comments.push(
        pickRandom([
          '오늘은 전체적으로 몸이 조금 굳어 있었던 날일 수 있습니다.',
          '데이터 상으로는 평소보다 약간 불안한 스윙이에요. 크게 신경 쓰기보다는 원인을 찾는 연습이라고 생각해보세요.',
          '조금은 흔들린 날이지만, 이런 날의 기록이 나중에 큰 도움이 됩니다.'
        ])
      );
    }
  }

  // 2) 템포
  if (tempo !== null) {
    if (tempo >= 2.7 && tempo <= 3.3) {
      comments.push(
        pickRandom([
          `템포 비율이 ${tempo.toFixed(2)}:1 로 이상적인 구간에 가깝습니다. 리듬이 아주 안정적이에요.`,
          `백스윙과 다운스윙의 비율이 ${tempo.toFixed(2)}:1 정도로, 본인만의 리듬이 잘 유지되고 있습니다.`,
          '템포가 일정하게 유지된다는 건, 멘탈과 루틴이 잘 자리 잡았다는 신호입니다.'
        ])
      );
    } else if (tempo < 2.7) {
      comments.push(
        pickRandom([
          `템포 비율이 ${tempo.toFixed(2)}:1 로 약간 빠른 편입니다. 급하게 치지 않도록 여유를 가져보면 좋겠습니다.`,
          '다운스윙 전환이 조금 급하게 붙은 느낌입니다. 백스윙 탑에서 한 박자 멈추는 루틴을 넣어보세요.',
          '리듬이 살짝 빠르게 흘렀던 스윙입니다. 숨을 길게 들이마셨다가 천천히 내쉬면서 스윙해보는 것도 도움이 됩니다.'
        ])
      );
    } else if (tempo > 3.3) {
      comments.push(
        pickRandom([
          `템포 비율이 ${tempo.toFixed(2)}:1 로 조금 느린 편입니다. 임팩트 순간 힘이 빠질 수 있으니, 전환 구간에 약간의 스피드를 실어보세요.`,
          '백스윙이 길어지면서 전체 템포가 조금 느려진 경향이 있습니다. 리듬을 반 박자 정도만 빠르게 가져가도 좋아요.',
          '조금 차분한 템포의 스윙입니다. 비거리를 더 원할 땐 다운스윙 구간에만 가볍게 속도를 더해보세요.'
        ])
      );
    }
  }

  // 3) 머리 흔들림
  if (headMove !== null) {
    if (headMove <= 8) {
      comments.push(
        pickRandom([
          `머리 흔들림이 ${headMove.toFixed(2)}% 수준으로 매우 안정적입니다. 상체 고정이 잘 되고 있어요.`,
          '상체 축이 잘 유지된 스윙입니다. 임팩트 일관성에 큰 도움이 되는 부분입니다.',
          '머리가 거의 움직이지 않는 훌륭한 스윙이에요. 이 부분은 그대로 유지하면 좋겠습니다.'
        ])
      );
    } else if (headMove <= 15) {
      comments.push(
        pickRandom([
          `머리 흔들림이 ${headMove.toFixed(2)}% 정도로, 실전에서 큰 문제는 없는 수준입니다.`,
          '상체가 조금은 함께 움직이지만, 과도한 수준은 아닙니다. 임팩트만 잘 맞으면 충분히 좋은 스윙이에요.',
          '머리 움직임이 살짝 있지만, 실전에서는 이 정도는 자연스러운 범위입니다.'
        ])
      );
    } else {
      comments.push(
        pickRandom([
          `머리 흔들림이 ${headMove.toFixed(2)}%로 다소 큰 편입니다. 상체가 함께 쏠리면서 미스샷이 나올 수 있는 구간이에요.`,
          '상체가 함께 움직이면서 체중이 흔들린 흔적이 보입니다. 임팩트 전후에 머리 위치를 한 번 의식해보면 좋겠습니다.',
          '머리가 많이 움직인 편이라, 탑핑이나 훅/슬라이스가 나기 쉬운 스윙입니다. 다음엔 “머리 고정” 하나만 집중해보세요.'
        ])
      );
    }
  }

  // 4) 밸런스
  if (balance !== null) {
    if (balance >= 0.9) {
      comments.push(
        pickRandom([
          `밸런스 점수가 ${balance.toFixed(2)}로 매우 좋습니다. 체중 이동과 피니시가 안정적으로 연결된 스윙입니다.`,
          '임팩트 전후 체중 이동이 부드럽고 안정적으로 이루어졌습니다.',
          '밸런스가 좋다는 것은, 힘을 과하게 쓰지 않고 효율적으로 사용했다는 의미입니다.'
        ])
      );
    } else if (balance >= 0.75) {
      comments.push(
        pickRandom([
          `밸런스 점수가 ${balance.toFixed(2)}로 무난한 수준입니다. 큰 문제는 없지만, 피니시에서 살짝 더 버텨주면 좋겠습니다.`,
          '균형이 크게 무너지지 않은 스윙입니다. 피니시에서 1초만 더 멈춰 서는 연습을 해보면 더 좋아질 거예요.',
          '전체적으로 안정적인 편이지만, 임팩트 이후 오른발(오른손잡이 기준)에 살짝 체중이 남는 경향이 있을 수 있습니다.'
        ])
      );
    } else {
      comments.push(
        pickRandom([
          `밸런스 점수가 ${balance.toFixed(2)}로 다소 불안한 편입니다. 스윙 후 피니시 자세를 유지하는 데 신경 써보세요.`,
          '체중이 한쪽으로 많이 쏠렸던 스윙입니다. “던진 후에 버틴다”는 느낌으로 피니시를 잡아보세요.',
          '밸런스가 조금 무너진 스윙입니다. 힘을 빼고 80% 스윙으로 리듬 위주 연습을 해보면 좋겠습니다.'
        ])
      );
    }
  }

  // 5) 아크
  if (backswing !== null && follow !== null) {
    if (backswing >= 160 && follow >= 150) {
      comments.push(
        pickRandom([
          '전체 스윙 아크가 크게 나오면서도 회전이 끝까지 이어졌습니다. 파워형 스윙에 가깝습니다.',
          '백스윙과 팔로우스루가 모두 크게 형성된 스윙입니다. 비거리 측면에서 유리한 패턴이에요.'
        ])
      );
    } else if (backswing <= 120 && follow <= 130) {
      comments.push(
        pickRandom([
          '스윙이 전반적으로 컴팩트한 편입니다. 컨트롤 위주의 샷에는 좋은 패턴입니다.',
          '작고 간결한 스윙 궤적입니다. 방향성 측면에서 장점을 가져갈 수 있는 형태예요.'
        ])
      );
    }
  }

  // 옵션: 느낌 반영
  const feeling = options.feelingCode;
  if (feeling && overall !== null) {
    if (feeling === 'bad' && overall >= 75) {
      comments.push(
        '데이터는 꽤 좋은 스윙으로 평가하고 있습니다. 느낌은 아쉬웠지만, 결과 자체는 나쁘지 않은 날이에요.'
      );
    } else if (feeling === 'perfect' && overall < 70) {
      comments.push(
        '느낌은 좋았지만, 데이터상으로는 약간 불안한 부분이 있습니다. 그래도 이런 날의 감각을 기억해 두면 큰 도움이 됩니다.'
      );
    }
  }

  if (comments.length === 0) {
    return '이번 스윙은 데이터가 다소 부족해서, 단순 지표 위주로만 평가가 가능합니다. 다음 스윙부터는 조금씩 패턴을 더 쌓아볼게요.';
  }

  return comments.join(' ');
}

module.exports = {
  generateSwingComment
};
