/**
 * 특정 세무사의 거래처를 조회하고 저장하는 테스트 스크립트
 * 사용법: node test-save-companies.js <세무사ID>
 */

const http = require('http');

async function main() {
  const taxAccountantId = process.argv[2];
  
  if (!taxAccountantId) {
    console.error('사용법: node test-save-companies.js <세무사ID>');
    console.error('예시: node test-save-companies.js 6080d9107be502ed4d13cc3cd8bb0459');
    process.exit(1);
  }

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
          if (result.success) {
            console.log('\n' + '='.repeat(60));
            console.log('[저장 결과]');
            console.log('='.repeat(60));
            console.log(`✅ 성공: ${result.message}`);
            console.log(`\n저장된 거래처 수: ${result.data.length}개`);
            
            // 상태별 통계
            const activeCount = result.data.filter(c => c._engagementStatus === '수임중').length;
            const terminatedCount = result.data.filter(c => c._engagementStatus === '해지중').length;
            const pendingCount = result.data.filter(c => c._engagementStatus === '미동의').length;
            
            console.log(`\n[상태별 통계]`);
            console.log(`  - 수임중: ${activeCount}개`);
            console.log(`  - 해지중: ${terminatedCount}개`);
            console.log(`  - 미동의: ${pendingCount}개`);
            
            if (result.meta) {
              console.log(`\n[메타 정보]`);
              console.log(`  - 세무사명: ${result.meta.taxAccountantName}`);
              console.log(`  - 조회된 수: ${result.meta.fetchedCount}개`);
            }
            
            console.log('='.repeat(60));
            resolve(result);
          } else {
            console.error('[실패]', result.message);
            reject(new Error(result.message));
          }
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

