# 🚀 EC2 서버 로그 확인 명령어 모음

## ⚡ 즉시 실행 가능 (package.json 수정 불필요)

```bash
# 기본: 최근 10개 AI 코칭 로그
node scripts/view-logs.js

# 최근 50개
node scripts/view-logs.js --lines 50

# 에러 로그만
node scripts/view-logs.js --error

# 성공한 로그만
node scripts/view-logs.js --success

# 통계 정보
node scripts/view-logs.js --stats

# 실시간 모니터링
node scripts/view-logs.js --follow

# 성능 로그
node scripts/view-logs.js --file performance
```

---

## 📝 package.json에 스크립트 추가하기 (한 번만)

### 방법 1: 간단한 sed 명령어

```bash
cd ~/inswing-api

# 백업
cp package.json package.json.backup

# 스크립트 추가
sed -i '/"test":/a\    "logs": "node scripts/view-logs.js",\n    "logs:error": "node scripts/view-logs.js --error",\n    "logs:success": "node scripts/view-logs.js --success",\n    "logs:stats": "node scripts/view-logs.js --stats",\n    "logs:perf": "node scripts/view-logs.js --file performance",\n    "logs:follow": "node scripts/view-logs.js --follow"' package.json
```

### 방법 2: vi로 직접 수정

```bash
cd ~/inswing-api
vi package.json
```

**편집 방법:**
1. `i` 키 눌러서 편집 모드
2. `"test"` 줄 다음에 아래 내용 추가:
```json
    "logs": "node scripts/view-logs.js",
    "logs:error": "node scripts/view-logs.js --error",
    "logs:success": "node scripts/view-logs.js --success",
    "logs:stats": "node scripts/view-logs.js --stats",
    "logs:perf": "node scripts/view-logs.js --file performance",
    "logs:follow": "node scripts/view-logs.js --follow"
```
3. `Esc` 누르고 `:wq` 입력 후 Enter

---

## ✅ 스크립트 추가 후 사용

```bash
# 스크립트 목록 확인
npm run

# 로그 확인
npm run logs
npm run logs:error
npm run logs:stats
```

---

## 🔍 스크립트 파일 확인

```bash
# 파일이 있는지 확인
ls -la ~/inswing-api/scripts/view-logs.js

# 없으면 직접 실행 불가
```

---

## 💡 가장 간단한 해결책

**지금 당장 로그를 보려면:**

```bash
node ~/inswing-api/scripts/view-logs.js
```

이 명령어 하나면 됩니다! 🎉

---

## 📋 빠른 참고

| 명령어 | 설명 |
|--------|------|
| `node scripts/view-logs.js` | 기본 (최근 10개) |
| `node scripts/view-logs.js --error` | 에러만 |
| `node scripts/view-logs.js --stats` | 통계 |
| `node scripts/view-logs.js --follow` | 실시간 |

