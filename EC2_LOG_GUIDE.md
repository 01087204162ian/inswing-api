# EC2 서버에서 로그 확인 가이드

## 🚀 빠른 실행 (스크립트 없이)

EC2 서버에서 `package.json`을 수정하기 전에, 바로 실행할 수 있는 방법:

```bash
# AI 코칭 로그 최근 10개
node scripts/view-logs.js

# 최근 50개
node scripts/view-logs.js --lines 50

# 에러만
node scripts/view-logs.js --error

# 통계
node scripts/view-logs.js --stats

# 실시간 모니터링
node scripts/view-logs.js --follow
```

---

## 📝 package.json에 스크립트 추가하기

EC2 서버에서 `package.json`을 수정하려면:

### 방법 1: vi 에디터로 직접 수정

```bash
cd ~/inswing-api
vi package.json
```

`scripts` 섹션을 찾아서 다음과 같이 수정:

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1",
  "logs": "node scripts/view-logs.js",
  "logs:error": "node scripts/view-logs.js --error",
  "logs:success": "node scripts/view-logs.js --success",
  "logs:stats": "node scripts/view-logs.js --stats",
  "logs:perf": "node scripts/view-logs.js --file performance",
  "logs:follow": "node scripts/view-logs.js --follow"
}
```

**vi 편집 방법:**
1. `i` 키를 눌러 편집 모드 진입
2. 수정 후 `Esc` 키로 편집 모드 종료
3. `:wq` 입력하고 Enter로 저장 후 종료

### 방법 2: sed 명령어로 자동 추가

```bash
cd ~/inswing-api

# package.json 백업
cp package.json package.json.backup

# scripts 섹션 수정 (test 스크립트 뒤에 추가)
sed -i '/"test":/a\
    "logs": "node scripts/view-logs.js",\
    "logs:error": "node scripts/view-logs.js --error",\
    "logs:success": "node scripts/view-logs.js --success",\
    "logs:stats": "node scripts/view-logs.js --stats",\
    "logs:perf": "node scripts/view-logs.js --file performance",\
    "logs:follow": "node scripts/view-logs.js --follow"' package.json
```

### 방법 3: 원격에서 파일 복사

로컬에서 수정한 `package.json`을 EC2로 복사:

```bash
# 로컬에서 실행 (Windows PowerShell)
scp inswing-api/package.json ec2-user@your-ec2-ip:~/inswing-api/package.json

# 또는 WinSCP 같은 GUI 도구 사용
```

---

## ✅ 스크립트 추가 후 확인

```bash
# 스크립트 목록 확인
npm run

# 로그 확인
npm run logs
```

---

## 🔧 scripts/view-logs.js 파일 확인

스크립트 파일이 있는지 확인:

```bash
cd ~/inswing-api
ls -la scripts/view-logs.js

# 없으면 파일을 생성하거나 원격에서 복사
```

없다면 원격에서 복사하거나 파일을 생성해야 합니다.

---

## 💡 임시 해결책

`package.json`을 수정하지 않고 바로 사용:

```bash
# 별칭(alias) 설정
echo 'alias logs="node ~/inswing-api/scripts/view-logs.js"' >> ~/.bashrc
echo 'alias logs:error="node ~/inswing-api/scripts/view-logs.js --error"' >> ~/.bashrc
echo 'alias logs:stats="node ~/inswing-api/scripts/view-logs.js --stats"' >> ~/.bashrc

# 적용
source ~/.bashrc

# 사용
logs
logs:error
logs:stats
```

---

## 📋 빠른 참고 명령어

```bash
# 기본 로그 확인
node scripts/view-logs.js

# 에러 로그만
node scripts/view-logs.js --error --lines 10

# 통계 확인
node scripts/view-logs.js --stats

# 실시간 모니터링
node scripts/view-logs.js --follow

# 성능 로그
node scripts/view-logs.js --file performance
```

