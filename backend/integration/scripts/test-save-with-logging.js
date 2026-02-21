/**
 * 거래처 저장 과정을 상세히 로깅하는 테스트 스크립트
 */

const http = require('http');

async function main() {
  const taxAccountantId = process.argv[2] || '6080d9107be502ed4d13cc3cd8bb0459';
  
  console.log('='.repeat(60));
  console.log('[저장 로직 테스트 시작]');
  console.log('='.repeat(60));
  console.log(`세무사 ID: ${taxAccountantId}\n`);

  const postData = JSON.stringify({ taxAccountantId });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/companies/fetch-from-hometax',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          console.log('\n' + '='.repeat(60));
          console.log('[API 응답]');
          console.log('='.repeat(60));
          console.log(`성공: ${result.success}`);
          console.log(`메시지: ${result.message}`);
          console.log(`저장된 거래처 수: ${result.data?.length || 0}개`);
          
          if (result.meta) {
            console.log(`\n[메타 정보]`);
            console.log(`  - 세무사명: ${result.meta.taxAccountantName}`);
            console.log(`  - 조회된 수: ${result.meta.fetchedCount}개`);
          }
          
          // 실제 저장된 파일 확인
          const fs = require('fs');
          const path = require('path');
          const indexFile = path.join(process.cwd(), 'data', 'companies', 'index.json');
          
          if (fs.existsSync(indexFile)) {
            const savedData = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
            const savedCompanies = Object.values(savedData);
            const filtered = savedCompanies.filter(c => c.taxAccountantId === taxAccountantId);
            
            console.log('\n' + '='.repeat(60));
            console.log('[실제 저장된 파일 확인]');
            console.log('='.repeat(60));
            console.log(`전체 저장된 거래처: ${savedCompanies.length}개`);
            console.log(`해당 세무사 거래처: ${filtered.length}개`);
            
            // 상태별 통계
            const activeCount = filtered.filter(c => c._engagementStatus === '수임중').length;
            const terminatedCount = filtered.filter(c => c._engagementStatus === '해지중').length;
            const pendingCount = filtered.filter(c => c._engagementStatus === '미동의').length;
            
            console.log(`\n[상태별 통계]`);
            console.log(`  - 수임중: ${activeCount}개`);
            console.log(`  - 해지중: ${terminatedCount}개`);
            console.log(`  - 미동의: ${pendingCount}개`);
            
            // 사업자번호 통계
            const uniqueBizNos = new Set();
            const emptyBizNos = [];
            filtered.forEach(c => {
              const bn = c.businessNumber || '';
              if (bn && bn.trim()) {
                uniqueBizNos.add(bn.replace(/-/g, ''));
              } else {
                emptyBizNos.push(c);
              }
            });
            
            console.log(`\n[사업자번호 통계]`);
            console.log(`  - 고유한 사업자번호: ${uniqueBizNos.size}개`);
            console.log(`  - 사업자번호 없는 거래처: ${emptyBizNos.length}개`);
            
            // 중복 확인
            const bizNoCounts = {};
            filtered.forEach(c => {
              const bn = (c.businessNumber || '').replace(/-/g, '');
              if (bn && bn.trim()) {
                bizNoCounts[bn] = (bizNoCounts[bn] || 0) + 1;
              }
            });
            
            const duplicates = Object.entries(bizNoCounts).filter(([bn, count]) => count > 1);
            if (duplicates.length > 0) {
              console.log(`\n[중복 사업자번호]`);
              console.log(`  - 중복 개수: ${duplicates.length}개`);
              duplicates.slice(0, 5).forEach(([bn, count]) => {
                console.log(`    ${bn}: ${count}회`);
              });
            }
            
            // API 응답과 실제 저장된 수 비교
            console.log('\n' + '='.repeat(60));
            console.log('[비교 분석]');
            console.log('='.repeat(60));
            console.log(`API 응답 저장 수: ${result.data?.length || 0}개`);
            console.log(`실제 저장된 수: ${filtered.length}개`);
            if (result.data?.length !== filtered.length) {
              console.log(`⚠️  차이: ${Math.abs((result.data?.length || 0) - filtered.length)}개`);
            } else {
              console.log(`✅ 일치`);
            }
          } else {
            console.log('\n⚠️  저장된 파일이 없습니다.');
          }
          
          console.log('\n' + '='.repeat(60));
          resolve(result);
        } catch (e) {
          console.error('[오류] JSON 파싱 실패:', e.message);
          console.error('응답:', data.substring(0, 500));
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`[오류] 요청 실패: ${e.message}`);
      console.error('서버가 실행 중인지 확인해주세요. (node server.js)');
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

