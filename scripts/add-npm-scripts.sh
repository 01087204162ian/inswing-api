#!/bin/bash
# EC2 서버에서 package.json에 로그 스크립트를 추가하는 스크립트

cd "$(dirname "$0")/.." || exit

# package.json 백업
if [ ! -f package.json.backup ]; then
  cp package.json package.json.backup
  echo "✅ package.json 백업 완료 (package.json.backup)"
fi

# 이미 스크립트가 있는지 확인
if grep -q '"logs":' package.json; then
  echo "⚠️  이미 로그 스크립트가 추가되어 있습니다."
  exit 0
fi

# package.json 수정
# test 스크립트 다음에 로그 스크립트들 추가
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' '/"test":/a\
    "logs": "node scripts/view-logs.js",\
    "logs:error": "node scripts/view-logs.js --error",\
    "logs:success": "node scripts/view-logs.js --success",\
    "logs:stats": "node scripts/view-logs.js --stats",\
    "logs:perf": "node scripts/view-logs.js --file performance",\
    "logs:follow": "node scripts/view-logs.js --follow"
' package.json
else
  # Linux (EC2)
  sed -i '/"test":/a\
    "logs": "node scripts/view-logs.js",\
    "logs:error": "node scripts/view-logs.js --error",\
    "logs:success": "node scripts/view-logs.js --success",\
    "logs:stats": "node scripts/view-logs.js --stats",\
    "logs:perf": "node scripts/view-logs.js --file performance",\
    "logs:follow": "node scripts/view-logs.js --follow"
' package.json
fi

echo "✅ package.json에 로그 스크립트가 추가되었습니다!"
echo ""
echo "사용 가능한 명령어:"
echo "  npm run logs        # 기본 로그 확인"
echo "  npm run logs:error  # 에러만 확인"
echo "  npm run logs:stats  # 통계 확인"
echo ""

