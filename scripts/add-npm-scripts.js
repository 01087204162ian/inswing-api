#!/usr/bin/env node
/**
 * package.json에 로그 스크립트를 자동으로 추가하는 스크립트
 * 
 * 사용법:
 *   node scripts/add-npm-scripts.js
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');

// package.json 읽기
let packageJson;
try {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson = JSON.parse(content);
} catch (err) {
  console.error('❌ package.json 읽기 실패:', err.message);
  process.exit(1);
}

// 백업 생성
const backupPath = packageJsonPath + '.backup';
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, fs.readFileSync(packageJsonPath));
  console.log('✅ package.json 백업 완료 (package.json.backup)');
}

// 이미 스크립트가 있는지 확인
if (packageJson.scripts && packageJson.scripts.logs) {
  console.log('⚠️  이미 로그 스크립트가 추가되어 있습니다.');
  console.log('현재 스크립트 목록:');
  Object.keys(packageJson.scripts).forEach(key => {
    if (key.startsWith('logs')) {
      console.log(`  - ${key}`);
    }
  });
  process.exit(0);
}

// scripts 객체가 없으면 생성
if (!packageJson.scripts) {
  packageJson.scripts = {};
}

// 로그 스크립트 추가
packageJson.scripts.logs = 'node scripts/view-logs.js';
packageJson.scripts['logs:error'] = 'node scripts/view-logs.js --error';
packageJson.scripts['logs:success'] = 'node scripts/view-logs.js --success';
packageJson.scripts['logs:stats'] = 'node scripts/view-logs.js --stats';
packageJson.scripts['logs:perf'] = 'node scripts/view-logs.js --file performance';
packageJson.scripts['logs:follow'] = 'node scripts/view-logs.js --follow';

// package.json 저장 (들여쓰기 2칸으로 포맷팅)
const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
fs.writeFileSync(packageJsonPath, updatedContent, 'utf8');

console.log('✅ package.json에 로그 스크립트가 추가되었습니다!');
console.log('');
console.log('사용 가능한 명령어:');
console.log('  npm run logs          # 기본 로그 확인');
console.log('  npm run logs:error    # 에러만 확인');
console.log('  npm run logs:success  # 성공한 로그만');
console.log('  npm run logs:stats    # 통계 정보');
console.log('  npm run logs:perf     # 성능 로그');
console.log('  npm run logs:follow   # 실시간 모니터링');
console.log('');

