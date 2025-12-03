# INSWING API 로그 파일 가이드

## 📁 로그 파일 위치

```
inswing-api/
└── logs/
    ├── ai-coaching.log    # AI 코칭 생성 로그
    └── performance.log    # 성능 측정 로그
```

**참고**: `logs/` 폴더는 서버 실행 시 자동으로 생성됩니다.

---

## 📋 로그 파일 종류

### 1. `ai-coaching.log`
AI 코칭 생성 관련 로그를 기록합니다.

**로그 형식 (JSON Lines)**:
```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "userId": 123,
  "swingId": 456,
  "success": true,
  "duration": 1250,
  "tokensUsed": null,
  "model": "claude-3-haiku-20240307",
  "error": null
}
```

**필드 설명**:
- `timestamp`: 로그 기록 시간 (ISO 8601 형식)
- `userId`: 사용자 ID (없으면 null)
- `swingId`: 스윙 ID (없으면 null)
- `success`: 성공 여부 (true/false)
- `duration`: 소요 시간 (밀리초)
- `tokensUsed`: 사용된 토큰 수 (현재는 null)
- `model`: 사용된 AI 모델명
- `error`: 에러 메시지 (에러 발생 시)

---

### 2. `performance.log`
성능 측정 관련 로그를 기록합니다.

**로그 형식 (JSON Lines)**:
```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "operation": "generateCoaching",
  "duration": 1250,
  "success": true,
  "error": null
}
```

**필드 설명**:
- `timestamp`: 로그 기록 시간
- `operation`: 작업명 (예: "generateCoaching")
- `duration`: 소요 시간 (밀리초)
- `success`: 성공 여부
- `error`: 에러 메시지 (에러 발생 시)

---

## 🔍 로그 확인 방법

### Windows (PowerShell)

```powershell
# 최근 20줄 확인
Get-Content inswing-api\logs\ai-coaching.log -Tail 20

# 실시간 로그 확인 (tail)
Get-Content inswing-api\logs\ai-coaching.log -Wait -Tail 50

# 성능 로그 확인
Get-Content inswing-api\logs\performance.log -Tail 20
```

### Linux/Mac

```bash
# 최근 20줄 확인
tail -n 20 inswing-api/logs/ai-coaching.log

# 실시간 로그 확인
tail -f inswing-api/logs/ai-coaching.log

# 성능 로그 확인
tail -n 20 inswing-api/logs/performance.log
```

---

## 📊 로그 분석 예시

### 성공한 코칭 생성 확인
```bash
# 성공한 로그만 필터링
grep '"success":true' inswing-api/logs/ai-coaching.log | tail -10
```

### 에러만 확인
```bash
# 에러 로그만 필터링
grep '"success":false' inswing-api/logs/ai-coaching.log | tail -10
```

### 평균 처리 시간 계산
```javascript
// Node.js 스크립트로 평균 시간 계산
const fs = require('fs');
const logs = fs.readFileSync('inswing-api/logs/ai-coaching.log', 'utf8')
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line))
  .filter(log => log.success && log.duration);

const avgDuration = logs.reduce((sum, log) => sum + log.duration, 0) / logs.length;
console.log(`평균 처리 시간: ${avgDuration.toFixed(2)}ms`);
```

---

## 🛠️ 로그 파일 관리

### 로그 파일 크기 제한
현재는 로그 파일 크기 제한이 없습니다. 필요시 로그 로테이션을 추가할 수 있습니다.

### 로그 파일 삭제
```powershell
# Windows
Remove-Item inswing-api\logs\*.log

# Linux/Mac
rm inswing-api/logs/*.log
```

---

## 📝 로그 기록 위치

로그는 다음 함수에서 기록됩니다:

1. **AI 코칭 로그** (`ai-coaching.log`):
   - `services/aiCoachingService.js` → `logAICoaching()` 함수

2. **성능 로그** (`performance.log`):
   - `services/aiCoachingService.js` → `logPerformance()` 함수

---

## ⚠️ 주의사항

1. 로그 파일은 서버가 실행된 후에 생성됩니다.
2. 로그 파일이 없으면 서버 실행 시 자동으로 생성됩니다.
3. 로그 기록 실패 시에도 메인 로직에는 영향이 없도록 처리되어 있습니다.

