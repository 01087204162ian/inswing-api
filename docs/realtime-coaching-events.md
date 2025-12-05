# INSWING Realtime Coaching – 이벤트 & 구조 설계

## 1. 개요

INSWING 실시간 코칭은 하나의 골프 상황(예: 연습장 스윙 5개 묶음, 대회 중 특정 홀)을
**하나의 "세션(Session)"**으로 보고, 그 세션을 기준으로 골퍼·코치·AI 코치가
실시간으로 소통할 수 있는 "레슨방"을 제공하는 것을 목표로 한다.

- 세션 = 레슨방
- 참여자 = 골퍼(golfer), 코치(coach), AI(ai)
- 채널 토픽 = `session:{session_id}`
- 모든 실시간 이벤트는 `event:new`로 전달하고, `payload.type`으로 구분한다.

---

## 2. 용어 정의

- **Session**
  - 레슨방 단위의 ID.
  - 예: `sess_2025-12-05-1234`
  - 하나의 상황(연습, 한 홀, 특정 미션 등)을 하나의 세션으로 묶는다.

- **Participant**
  - `golfer` : 일반 사용자(골퍼)
  - `coach` : 인간 코치
  - `ai` : AI 코치(LLM/분석 시스템)

- **Channel Topic**
  - Phoenix 채널 토픽 규칙: `session:{session_id}`
  - 예: `session:sess_123`

---

## 3. Phoenix 메시지 형식

모든 실시간 이벤트는 Phoenix WebSocket을 통해 다음 형식으로 전달한다.

```json
{
  "topic": "session:{session_id}",
  "event": "event:new",
  "payload": {
    "type": "...",
    ...
  },
  "ref": 1
}
topic: 세션별 채널 이름 (예: session:sess_123)

event: 항상 "event:new"를 사용 (단순화를 위해 통일)

payload: 실제 이벤트 내용

ref: 요청/응답 매칭용 숫자 (필요 시 사용)

4. 이벤트 타입 정의
type	설명	주요 필드
chat_message	채팅/멘탈 코칭 메시지	author_role, message, swing_id, ts
swing_created	새 스윙 업로드됨	swing_id, golfer_id, status
swing_analyzed	스윙 분석 완료	swing_id, metrics, previous_compare_tag
coach_tip	코치 기술 코멘트	swing_id, category, message
ai_insight	AI 인사이트	swing_id, persona, message
feeling_update	골퍼 느낌 업데이트	swing_id, feeling
focus_point	특정 프레임/구간 강조	swing_id, frame, label
system_notice	시스템 알림 (예: 분석 완료 안내 등)	message, swing_id
4.1 chat_message
{
  "type": "chat_message",
  "session_id": "sess_123",
  "author_role": "golfer",       
  "author_id": "golfer_1",
  "message": "이번에는 힘을 뺐는데도 슬라이스가 납니다.",
  "meta": {
    "swing_id": "sw_456",
    "ts": 1764936413351
  }
}

4.2 swing_created
{
  "type": "swing_created",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "golfer_id": "golfer_1",
  "status": "analyzing"
}

4.3 swing_analyzed
{
  "type": "swing_analyzed",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "metrics": {
    "tempo": 0.92,
    "face_angle": 3.2
  },
  "previous_compare_tag": "백스윙 상단이 안정되었습니다."
}

4.4 coach_tip
{
  "type": "coach_tip",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "category": "backswing",
  "message": "백스윙 때 오른팔이 너무 접히지 않도록 해보세요."
}

4.5 ai_insight
{
  "type": "ai_insight",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "persona": "tour_pro",
  "message": "투어 선수 기준으로는 템포는 좋지만, 피니시에서 체중이 왼발에 더 실리면 좋겠습니다."
}

4.6 feeling_update
{
  "type": "feeling_update",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "feeling": "부드럽게 친 느낌인데 공이 짧았습니다."
}

4.7 focus_point
{
  "type": "focus_point",
  "session_id": "sess_123",
  "swing_id": "sw_456",
  "frame": 123,
  "label": "임팩트 직전 힙 회전"
}

5. 아키텍처 구조
[골퍼 브라우저]                    [코치 브라우저]
   upload.html / result.html         coach/session.html
          |                                  |
          | (HTTP, REST)                     | (HTTP, REST)
          v                                  v
          [INSWING API - Node/Express]
                     |
                     | 1) 영상 업로드 & 스윙 생성
                     v
                 [MySQL]  <-- 스윙/유저/세션 저장
                     |
                     | 2) Python 분석 서버 호출
                     v
           [Python 분석 서버]
                     |
                     | 3) 분석완료 → API로 결과 전달
                     v
          [INSWING API - Node/Express]
                     |
                     | 4) Realtime 서버로 이벤트 전달 (HTTP)
                     v
          [INSWING Realtime - Phoenix]
                     ^
                     | 5) WebSocket 브로드캐스트
          [골퍼 브라우저]     [코치 브라우저]
           (session 채널)      (session 채널)

6. UI/UX 연결 개요
6.1 골퍼 화면 (result.html)

업로드 후 API에서 swing_id, session_id를 응답으로 받는다.

result.html?id={swing_id}&session={session_id}로 이동한다.

result 화면에서:

스윙 영상/분석 수치 상단 표시

우측/하단에 "실시간 코칭" 패널

WebSocket 연결 후 session:{session_id} 채널 join

수신 이벤트에 따라:

chat_message → 채팅 말풍선 UI 갱신

swing_analyzed → 분석 수치 갱신

coach_tip, ai_insight → 코칭 카드 렌더

6.2 코치 화면 (coach/session.html)

좌측: 실시간 세션 리스트 (GET /coach/sessions)

우측: 선택된 세션 상세

상단: 스윙 영상 플레이어

중단: 이벤트 타임라인

하단: 채팅 입력창

WebSocket으로 동일한 session:{session_id}에 접속하여 실시간으로 이벤트를 주고받는다.

7. 향후 확장 방향

그룹 코칭 세션 지원 (여러 골퍼 + 한 코치)

세션 녹화/리플레이 (과거 레슨 세션 다시 보기)

AI 코치 자동 응답 트리거 (특정 metric/feeling 조건에서 자동 코멘트)

1️⃣ Phoenix에서 event:new 수신/브로드캐스트 구현
2️⃣ result.html 에 WebSocket 연결 코드 추가 (console.log 테스트)
3️⃣ inswing-api에서 swing 업로드 시 session_id 생성 로직 추가
4️⃣ 커서에게 전달할 “실시간 코칭 화면 개발 지시서” 만들어주기
5️⃣ 위 1~3을 하나의 체크리스트로 관리하는 PR 템플릿 구성