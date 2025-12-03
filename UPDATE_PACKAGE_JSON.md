# EC2 서버에서 package.json 업데이트 방법

## 🔧 방법 1: 직접 편집 (가장 간단)

EC2 서버에서 다음 명령어로 `package.json`을 직접 편집하세요:

```bash
cd ~/inswing-api
nano package.json
# 또는
vim package.json
```

**다음 부분을 찾아서:**

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1"
},
```

**이렇게 수정하세요:**

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1",
  "logs": "node scripts/view-logs.js",
  "logs:error": "node scripts/view-logs.js --error",
  "logs:success": "node scripts/view-logs.js --success",
  "logs:stats": "node scripts/view-logs.js --stats",
  "logs:perf": "node scripts/view-logs.js --file performance",
  "logs:follow": "node scripts/view-logs.js --follow"
},
```

**저장 방법:**
- nano: `Ctrl + X` → `Y` → `Enter`
- vim: `Esc` → `:wq` → `Enter`

---

## 🔧 방법 2: sed 명령어로 자동 추가

EC2 서버에서 한 번에 추가:

```bash
cd ~/inswing-api

# 백업 먼저
cp package.json package.json.backup

# scripts 섹션에 로그 스크립트 추가
sed -i '/"test":/a\
    "logs": "node scripts/view-logs.js",\
    "logs:error": "node scripts/view-logs.js --error",\
    "logs:success": "node scripts/view-logs.js --success",\
    "logs:stats": "node scripts/view-logs.js --stats",\
    "logs:perf": "node scripts/view-logs.js --file performance",\
    "logs:follow": "node scripts/view-logs.js --follow"
' package.json
```

---

## 🔧 방법 3: 전체 package.json 교체

로컬에서 수정한 `package.json` 파일을 EC2에 업로드:

```bash
# Windows에서 (Git Bash 또는 PowerShell)
scp -i your-key.pem inswing-api/package.json ec2-user@your-ec2-ip:~/inswing-api/package.json
```

---

## ✅ 수정 확인

수정 후 다음 명령어로 확인:

```bash
cd ~/inswing-api
npm run
```

다음과 같이 표시되어야 합니다:

```
Scripts available via `npm run-script`:
  logs
  logs:error
  logs:follow
  logs:perf
  logs:stats
  logs:success
  test
```

---

## 🚀 실행 테스트

```bash
# 기본 로그 확인
npm run logs

# 에러만 확인
npm run logs:error

# 통계 확인
npm run logs:stats
```

---

## 📝 참고

`scripts/view-logs.js` 파일도 EC2 서버에 있는지 확인하세요:

```bash
ls -la ~/inswing-api/scripts/view-logs.js
```

없다면 로컬에서 업로드:

```bash
# Windows에서
scp -i your-key.pem inswing-api/scripts/view-logs.js ec2-user@your-ec2-ip:~/inswing-api/scripts/view-logs.js
```

