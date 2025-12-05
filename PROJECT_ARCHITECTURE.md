# INSWING 프로젝트 아키텍처 문서

> **목적**: Cursor AI가 INSWING 프로젝트의 전체 구조를 이해하고 작업할 수 있도록 정리한 문서

---

## 📦 전체 프로젝트 구조

INSWING은 4개의 독립적인 리포지토리로 구성된 모듈형 서비스입니다:

```
ian/
├── inswing/          # 프론트엔드 (HTML/JS)
├── inswing-api/      # 백엔드 API (Node.js/Express)
├── inswing-ai/       # AI 분석 서버 (Python/Flask)
└── inswing-realtime/ # 실시간 서비스 (Elixir/Phoenix)
```

---

## 1️⃣ inswing-api (백엔드 API 서버)

### 기술 스택
- **Node.js + Express** (포트 4000)
- **MySQL** (데이터베이스)
- **AWS S3 + CloudFront** (비디오 저장)
- **JWT 인증** + **Passport** (Google/Kakao OAuth)
- **Claude AI** (Anthropic SDK) - 코칭 생성

### 폴더 구조
```
inswing-api/
├── server.js              # 메인 서버 진입점 (포트 4000)
├── db.js                  # MySQL 연결 풀
├── config/
│   ├── cors.js           # CORS 설정
│   ├── passport.js       # OAuth 전략 (Google/Kakao)
│   └── s3.js             # AWS S3 클라이언트
├── middlewares/
│   ├── auth.js           # JWT 인증 미들웨어
│   └── errorHandler.js   # 에러 핸들링
├── routes/
│   ├── auth.js           # 로그인/OAuth 엔드포인트
│   ├── swings.js        # 스윙 업로드/조회/히스토리
│   ├── feelings.js       # 스윙 느낌 저장
│   └── routine.js        # 루틴 세션 관리
└── services/
    ├── aiCoachingService.js  # Claude AI 코칭 생성
    └── commentService.js     # 규칙 기반 코멘트 (Fallback)
```

### 주요 역할
- **모든 비즈니스/데이터 처리의 중심**
- JWT 기반 인증 및 OAuth 로그인 처리
- 스윙 비디오 업로드 → AI 분석 서버 호출 → S3 저장
- Claude AI 기반 코칭 생성 (존댓말, 2-3문장)
- 루틴 세션 관리 (시작/종료)
- 스윙 히스토리 조회 (최근 14일 분석)

### 주요 API 엔드포인트
- `POST /auth/login` - 이메일 로그인
- `GET /auth/google`, `GET /auth/kakao` - OAuth 로그인
- `POST /swings` - 스윙 업로드 + AI 분석 + 코칭 생성
- `GET /swings` - 스윙 히스토리 조회
- `GET /swings/:id` - 스윙 단건 조회
- `POST /swings/:id/regenerate-coaching` - 코칭 재생성
- `GET /routine/today` - 오늘의 루틴
- `POST /routine/start`, `POST /routine/end` - 루틴 세션 관리

---

## 2️⃣ inswing-ai (AI 분석 서버)

### 기술 스택
- **Python + Flask** (포트 5000)
- **MediaPipe** (포즈 추정)
- **OpenCV** (비디오 처리)
- **NumPy** (수치 계산)

### 폴더 구조
```
inswing-ai/
├── app.py              # Flask 서버 (포트 5000)
├── analyze_swing.py    # MediaPipe 기반 스윙 분석 로직
├── requirements.txt    # Python 의존성
└── ecosystem.config.js # PM2 설정
```

### 주요 역할
- **비디오 → 숫자로 바꿔주는 분석 엔진**
- 골프 스윙 비디오를 분석하여 15개 메트릭 추출
- MediaPipe를 사용한 33개 랜드마크 기반 포즈 추정

### 분석 메트릭 (15개)
1. **backswing_angle** - 백스윙 각도
2. **impact_speed** - 임팩트 속도
3. **follow_through_angle** - 팔로우스루 각도
4. **balance_score** - 밸런스 점수
5. **tempo_ratio** - 템포 비율
6. **backswing_time_sec** - 백스윙 시간
7. **downswing_time_sec** - 다운스윙 시간
8. **head_movement_pct** - 머리 흔들림
9. **shoulder_rotation_range** - 어깨 회전 범위
10. **hip_rotation_range** - 골반 회전 범위
11. **rotation_efficiency** - 회전 효율
12. **overall_score** - 종합 점수 (1-5점)

### API 엔드포인트
- `POST /analyze` - 비디오 분석 요청

---

## 3️⃣ inswing (프론트엔드)

### 기술 스택
- 순수 **HTML/JavaScript** (빌드 도구 없음)
- 반응형 디자인

### 폴더 구조
```
inswing/
├── index.html          # 랜딩 페이지
├── ko/                 # 한국어 페이지
│   ├── index.html
│   └── philosophy.html
├── en/                 # 영어 페이지
│   ├── index.html
│   └── philosophy.html
└── app/
    ├── login.html      # 로그인 페이지
    ├── upload.html     # 스윙 업로드
    ├── result.html     # 분석 결과
    ├── history.html    # 히스토리
    ├── routine.html    # 루틴 페이지 (베타)
    └── js/
        └── app.js      # 공통 API 유틸리티
```

### 주요 역할
- **화면 (고객이 보는 곳)**
- OAuth 로그인 (Google/Kakao)
- 비디오 업로드 및 분석 결과 표시
- 스윙 히스토리 조회
- 루틴 페이지 (최근 14일 분석, 약점/강점 패턴)

---

## 4️⃣ inswing-realtime (실시간 서비스)

### 기술 스택
- **Elixir + Phoenix**
- **Phoenix Channels** (WebSocket 실시간 통신)
- (LiveView는 향후 코치 화면에 도입 예정)

### 폴더 구조
```
inswing-realtime/
├── mix.exs             # 프로젝트 설정
├── config/             # 환경별 설정
│   ├── dev.exs
│   ├── prod.exs
│   └── runtime.exs
├── lib/
│   └── inswing_realtime_web/
│       ├── router.ex   # 라우팅
│       ├── controllers/ # 컨트롤러
│       └── user_socket.ex # WebSocket
└── assets/             # 프론트엔드 자산
```

### 주요 역할
- **실시간 코치/채팅/Presence 담당**
- DB 연동 최소화 (세션/채팅 중심)
- 핵심 기능: 실시간 코치 세션, 채팅, Presence, 알림

### 현재 상태
- ✅ 기본 Phoenix 프로젝트 구조 생성 완료
- ✅ WebSocket 엔드포인트(`/socket`) 동작
- ⏳ 실시간 코치 모드(채팅, Presence, 세션 관리)는 Step1부터 순차 구현 예정

### 구현 예정 단계
- **Step1**: `session:*` 채널 + Presence + `chat:new/added` 이벤트
- **Step2**: 프론트 `coach.html` WebSocket UI
- **Step3**: API 서버 → Realtime 서버로 AI 피드백 이벤트 push

### 서버 설정
- **내부 포트**: 4100 (Phoenix)
- **Nginx**: `realtime.inswing.ai`로 SSL Termination + 프록시
- **개발 환경**: 기본 4000 포트 (`mix phx.server`)

---

## 🔄 데이터 흐름

### 스윙 업로드 프로세스
```
1. 사용자 → inswing-api (POST /swings)
   ↓
2. inswing-api → inswing-ai (POST /analyze)
   ↓
3. inswing-ai → MediaPipe 분석 → 15개 메트릭 반환
   ↓
4. inswing-api → AWS S3 업로드
   ↓
5. inswing-api → Claude AI 코칭 생성
   ↓
6. MySQL에 스윙 + 메트릭 + 코칭 저장
   ↓
7. 사용자에게 결과 반환
```

**핵심 플로우**: 스윙 업로드 → AI 분석 → S3 → Claude 코칭 → DB 저장 → 결과 반환

---

## 🌐 인프라 및 도메인

### 서버 구성
- **EC2 서버** (AWS)
- **Nginx** + **SSL** (HTTPS)
- **PM2** 프로세스 관리

### 도메인 구성
- `inswing.ai` → 랜딩/프론트 (S3+CloudFront)
- `api.inswing.ai` → Node API (포트 4000)
- `realtime.inswing.ai` → Phoenix Realtime (내부 4100)

### 서버 포트
- `inswing-api`: **4000**
- `inswing-ai`: **5000**
- `inswing-realtime`: **내부 4100** (Nginx 프록시)

---

## 🔐 환경 변수

### inswing-api 필요 변수
- `JWT_SECRET` - JWT 토큰 시크릿
- `SESSION_SECRET` - 세션 시크릿
- `ANTHROPIC_API_KEY` - Claude AI API 키
- `USE_AI_COACHING` - AI 코칭 사용 여부 (true/false)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - S3 접근
- `AWS_REGION`, `AWS_S3_BUCKET`, `CLOUDFRONT_DOMAIN` - S3/CloudFront 설정
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` - Google OAuth
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_CALLBACK_URL` - Kakao OAuth
- MySQL 연결 정보 (db.js에서 직접 설정 또는 환경 변수)

---

## 📝 Cursor AI 작업 가이드

### 정리 요약

**INSWING은 4개 리포로 나뉜 모듈형 서비스입니다:**

- **inswing** = 화면 (고객이 보는 곳)
- **inswing-api** = 모든 비즈니스/데이터 처리의 중심
- **inswing-ai** = 비디오 → 숫자로 바꿔주는 분석 엔진
- **inswing-realtime** = 실시간 코치/채팅/Presence 담당

### Cursor의 주요 작업 영역

**당신(Cursor)의 1차 역할은 `inswing-realtime`에서 Step1~StepN 작업을 순차적으로 구현하는 것입니다.**

이때 브라운(Brown)이 설계한 지시서(Step1: 채널+Presence+UserSocket)를 기준으로 코드를 작성해 주세요.

### 작업 시 참고사항

1. **inswing-realtime**은 DB 연동을 최소화하고, 주로 세션/채팅/Presence에 집중합니다.
2. **Phoenix Channels** 기반으로 WebSocket 통신을 구현합니다.
3. **LiveView**는 향후 필요 시 도입 예정이므로, 현재는 Channels 위주로 작업합니다.
4. **API 서버(inswing-api)**와의 통신은 Step3에서 구현 예정입니다.

---

**작성일**: 2025년 1월  
**최종 수정**: 2025년 1월

