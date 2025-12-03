#!/usr/bin/env node
/**
 * INSWING API 로그 확인 유틸리티
 * 
 * 사용법:
 *   node scripts/view-logs.js                    # ai-coaching.log 최근 10줄
 *   node scripts/view-logs.js --file performance # performance.log 최근 10줄
 *   node scripts/view-logs.js --lines 50         # 최근 50줄
 *   node scripts/view-logs.js --success          # 성공한 로그만
 *   node scripts/view-logs.js --error            # 에러 로그만
 *   node scripts/view-logs.js --stats            # 통계 정보
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const AI_COACHING_LOG = path.join(LOG_DIR, 'ai-coaching.log');
const PERFORMANCE_LOG = path.join(LOG_DIR, 'performance.log');

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const options = {
  file: args.includes('--file') ? args[args.indexOf('--file') + 1] : 'ai-coaching',
  lines: args.includes('--lines') ? parseInt(args[args.indexOf('--lines') + 1]) : 10,
  success: args.includes('--success'),
  error: args.includes('--error'),
  stats: args.includes('--stats'),
  follow: args.includes('--follow') || args.includes('-f')
};

// 로그 파일 경로 결정
let logFile;
if (options.file === 'performance' || options.file === 'perf') {
  logFile = PERFORMANCE_LOG;
} else {
  logFile = AI_COACHING_LOG;
}

// 로그 파일 존재 확인
if (!fs.existsSync(logFile)) {
  console.error(`❌ 로그 파일을 찾을 수 없습니다: ${logFile}`);
  console.log(`💡 서버가 실행되면 자동으로 생성됩니다.`);
  process.exit(1);
}

// 로그 읽기
function readLogs() {
  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.log('📝 로그 파일이 비어있습니다.');
      return [];
    }
    
    // JSON 파싱
    const logs = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(log => log !== null);
    
    return logs;
  } catch (err) {
    console.error(`❌ 로그 파일 읽기 실패: ${err.message}`);
    return [];
  }
}

// 로그 출력
function printLog(log, index) {
  const timestamp = new Date(log.timestamp).toLocaleString('ko-KR');
  
  if (logFile === AI_COACHING_LOG) {
    const status = log.success ? '✅' : '❌';
    console.log(`\n[${index}] ${status} ${timestamp}`);
    console.log(`   사용자: ${log.userId || 'N/A'} | 스윙: ${log.swingId || 'N/A'}`);
    console.log(`   소요시간: ${log.duration}ms | 모델: ${log.model}`);
    if (log.error) {
      console.log(`   에러: ${log.error}`);
    }
  } else {
    const status = log.success ? '✅' : '❌';
    console.log(`\n[${index}] ${status} ${timestamp}`);
    console.log(`   작업: ${log.operation} | 소요시간: ${log.duration}ms`);
    if (log.error) {
      console.log(`   에러: ${log.error}`);
    }
  }
}

// 통계 정보 출력
function printStats(logs) {
  if (logs.length === 0) {
    console.log('📊 통계를 계산할 로그가 없습니다.');
    return;
  }
  
  const total = logs.length;
  const successful = logs.filter(log => log.success).length;
  const failed = total - successful;
  
  const durations = logs
    .filter(log => log.duration)
    .map(log => log.duration);
  
  const avgDuration = durations.length > 0
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)
    : 0;
  
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  
  console.log('\n📊 로그 통계');
  console.log('='.repeat(50));
  console.log(`전체 로그: ${total}개`);
  console.log(`✅ 성공: ${successful}개 (${((successful/total)*100).toFixed(1)}%)`);
  console.log(`❌ 실패: ${failed}개 (${((failed/total)*100).toFixed(1)}%)`);
  console.log(`평균 소요시간: ${avgDuration}ms`);
  console.log(`최소 소요시간: ${minDuration}ms`);
  console.log(`최대 소요시간: ${maxDuration}ms`);
  
  if (logFile === AI_COACHING_LOG) {
    const models = {};
    logs.forEach(log => {
      if (log.model) {
        models[log.model] = (models[log.model] || 0) + 1;
      }
    });
    
    console.log('\n사용된 모델:');
    Object.entries(models).forEach(([model, count]) => {
      console.log(`  - ${model}: ${count}회`);
    });
  }
}

// 메인 실행
function main() {
  if (options.stats) {
    const logs = readLogs();
    printStats(logs);
    return;
  }
  
  let logs = readLogs();
  
  // 필터링
  if (options.success) {
    logs = logs.filter(log => log.success);
  } else if (options.error) {
    logs = logs.filter(log => !log.success);
  }
  
  // 최근 N개만
  const recentLogs = logs.slice(-options.lines);
  
  if (recentLogs.length === 0) {
    console.log('📝 필터링된 로그가 없습니다.');
    return;
  }
  
  console.log(`\n📋 최근 ${recentLogs.length}개 로그 (${options.file === 'performance' ? '성능' : 'AI 코칭'})\n`);
  console.log('='.repeat(70));
  
  recentLogs.forEach((log, index) => {
    printLog(log, logs.length - recentLogs.length + index + 1);
  });
  
  console.log('\n' + '='.repeat(70));
  
  if (options.follow) {
    console.log('\n⏳ 실시간 모니터링 모드 (Ctrl+C로 종료)...\n');
    
    let lastSize = fs.statSync(logFile).size;
    
    setInterval(() => {
      const currentSize = fs.statSync(logFile).size;
      
      if (currentSize > lastSize) {
        // 새 로그 읽기
        const fd = fs.openSync(logFile, 'r');
        const buffer = Buffer.alloc(currentSize - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);
        
        const newLines = buffer.toString().split('\n').filter(line => line.trim());
        newLines.forEach(line => {
          try {
            const log = JSON.parse(line);
            printLog(log, 'NEW');
          } catch (e) {
            // 무시
          }
        });
        
        lastSize = currentSize;
      }
    }, 1000);
  }
}

main();

