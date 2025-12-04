# 📋 view-logs.js 실행 가이드

## 🚀 기본 실행 방법

### Windows (PowerShell)

**현재 디렉토리가 프로젝트 루트(`C:\ian`)인 경우:**

```powershell
# 기본: AI 코칭 로그 최근 10줄
node inswing-api/scripts/view-logs.js

# 또는 inswing-api 폴더로 이동 후
cd inswing-api
node scripts/view-logs.js
```

---

## 📚 모든 사용법

### 1️⃣ 기본 명령어

```powershell
# 최근 10개 AI 코칭 로그 확인
node inswing-api/scripts/view-logs.js
```

### 2️⃣ 로그 개수 지정

```powershell
# 최근 50개 로그 확인
node inswing-api/scripts/view-logs.js --lines 50

# 최근 100개 로그 확인
node inswing-api/scripts/view-logs.js --lines 100
```

### 3️⃣ 로그 파일 선택

```powershell
# 성능 로그 확인 (기본 10줄)
node inswing-api/scripts/view-logs.js --file performance

# 성능 로그 30줄 확인
node inswing-api/scripts/view-logs.js --file performance --lines 30
```

### 4️⃣ 필터링 옵션

```powershell
# 성공한 로그만 확인
node inswing-api/scripts/view-logs.js --success

# 에러 로그만 확인
node inswing-api/scripts/view-logs.js --error

# 성공한 로그 20개만
node inswing-api/scripts/view-logs.js --success --lines 20
```

### 5️⃣ 통계 정보

```powershell
# 통계 정보 확인 (전체 요약)
node inswing-api/scripts/view-logs.js --stats
```

### 6️⃣ 실시간 모니터링

```powershell
# 실시간으로 새 로그 확인 (Ctrl+C로 종료)
node inswing-api/scripts/view-logs.js --follow

# 또는 줄여서
node inswing-api/scripts/view-logs.js -f
```

---

## 🎯 조합 사용 예시

```powershell
# 성능 로그에서 에러만 최근 5개
node inswing-api/scripts/view-logs.js --file performance --error --lines 5

# AI 코칭 로그에서 성공한 것만 30개
node inswing-api/scripts/view-logs.js --success --lines 30

# 성능 로그 통계 확인
node inswing-api/scripts/view-logs.js --file performance --stats
```

---

## ⚡ 더 쉽게 실행하기 (npm 스크립트 추가)

`package.json`에 스크립트를 추가하면 더 쉽게 실행할 수 있습니다:

```json
{
  "scripts": {
    "logs": "node scripts/view-logs.js",
    "logs:error": "node scripts/view-logs.js --error",
    "logs:success": "node scripts/view-logs.js --success",
    "logs:stats": "node scripts/view-logs.js --stats",
    "logs:perf": "node scripts/view-logs.js --file performance",
    "logs:follow": "node scripts/view-logs.js --follow"
  }
}
```

그러면 다음과 같이 실행할 수 있습니다:

```powershell
cd inswing-api
npm run logs              # 기본 로그 확인
npm run logs:error        # 에러만
npm run logs:success      # 성공만
npm run logs:stats        # 통계
npm run logs:perf         # 성능 로그
npm run logs:follow       # 실시간 모니터링
```

---

## 🔍 실행 예시 출력

### 기본 실행 (`node scripts/view-logs.js`)

```
📋 최근 10개 로그 (AI 코칭)

======================================================================

[1] ✅ 2025. 1. 15. 오후 2:30:45
   사용자: 123 | 스윙: 456
   소요시간: 1250ms | 모델: claude-3-haiku-20240307

[2] ❌ 2025. 1. 15. 오후 2:35:12
   사용자: 124 | 스윙: 457
   소요시간: 500ms | 모델: claude-3-haiku-20240307
   에러: API 호출 실패

======================================================================
```

### 통계 실행 (`node scripts/view-logs.js --stats`)

```
📊 로그 통계
==================================================
전체 로그: 150개
✅ 성공: 142개 (94.7%)
❌ 실패: 8개 (5.3%)
평균 소요시간: 1234.56ms
최소 소요시간: 450ms
최대 소요시간: 3200ms

사용된 모델:
  - claude-3-haiku-20240307: 150회
```

---

## ❗ 문제 해결

### 로그 파일이 없다는 오류

```
❌ 로그 파일을 찾을 수 없습니다: C:\ian\inswing-api\logs\ai-coaching.log
💡 서버가 실행되면 자동으로 생성됩니다.
```

**해결 방법**: API 서버를 실행하고 스윙 분석을 한 번 실행하면 로그 파일이 생성됩니다.

### Node.js가 설치되지 않음

```powershell
# Node.js 설치 확인
node --version

# 설치되어 있지 않으면 https://nodejs.org 에서 다운로드
```

---

## 💡 유용한 팁

1. **자주 사용하는 명령어는 alias 설정**
   ```powershell
   # PowerShell 프로필에 추가
   Set-Alias -Name logs -Value "node inswing-api/scripts/view-logs.js"
   ```

2. **에러가 발생하면 즉시 확인**
   ```powershell
   node inswing-api/scripts/view-logs.js --error --lines 5
   ```

3. **실시간으로 서버 모니터링**
   ```powershell
   node inswing-api/scripts/view-logs.js --follow
   ```

---

## 📝 참고

- 로그 파일 위치: `inswing-api/logs/`
- 로그 형식: JSON Lines (한 줄에 하나의 JSON 객체)
- 로그는 서버 실행 시 자동으로 기록됩니다


