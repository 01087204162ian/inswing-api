#!/bin/bash
# EC2 서버에서 package.json에 로그 스크립트 추가하기

cd ~/inswing-api || exit 1

# package.json 백업
cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)

# package.json에 스크립트 추가
# test 스크립트 다음에 로그 스크립트들을 추가
cat > /tmp/package_scripts.txt << 'EOF'
    "logs": "node scripts/view-logs.js",
    "logs:error": "node scripts/view-logs.js --error",
    "logs:success": "node scripts/view-logs.js --success",
    "logs:stats": "node scripts/view-logs.js --stats",
    "logs:perf": "node scripts/view-logs.js --file performance",
    "logs:follow": "node scripts/view-logs.js --follow"
EOF

# sed로 scripts 섹션 수정 (더 안전한 방법)
# "test" 라인 뒤에 새 스크립트들 추가
sed -i '/"test": "echo.*exit 1"/a\
    "logs": "node scripts/view-logs.js",\
    "logs:error": "node scripts/view-logs.js --error",\
    "logs:success": "node scripts/view-logs.js --success",\
    "logs:stats": "node scripts/view-logs.js --stats",\
    "logs:perf": "node scripts/view-logs.js --file performance",\
    "logs:follow": "node scripts/view-logs.js --follow"' package.json

echo "✅ package.json에 로그 스크립트가 추가되었습니다."
echo ""
echo "이제 다음 명령어를 사용할 수 있습니다:"
echo "  npm run logs"
echo "  npm run logs:error"
echo "  npm run logs:stats"
echo ""
echo "백업 파일: package.json.backup.*"

