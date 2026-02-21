/**
 * 특정 세무사의 거래처 조회 테스트 스크립트
 * 사용법: node test-fetch-single-tax-accountant.js <세무사ID>
 */

const { spawn } = require('child_process');
const path = require('path');

// Backend 모듈 로드
const backendModule = require('../../dist/index');
const {
  getTaxAccountant,
  getCertPathByHash,
  getCertificatePassword
} = backendModule;

async function main() {
  const taxAccountantId = process.argv[2];
  
  if (!taxAccountantId) {
    console.error('사용법: node test-fetch-single-tax-accountant.js <세무사ID>');
    console.error('예시: node test-fetch-single-tax-accountant.js 6080d9107be502ed4d13cc3cd8bb0459');
    process.exit(1);
  }

  try {
    console.log(`[INFO] 세무사 정보 조회 중... (ID: ${taxAccountantId})`);
    
    // 1. 세무사 정보 조회
    const taxAccountant = await getTaxAccountant(taxAccountantId);
    if (!taxAccountant) {
      console.error(`[ERROR] 세무사를 찾을 수 없습니다: ${taxAccountantId}`);
      process.exit(1);
    }
    
    console.log(`[INFO] 세무사명: ${taxAccountant.name}`);
    console.log(`[INFO] 인증서 해시: ${taxAccountant.certificateHash || '없음'}`);
    
    // 2. 인증서 경로 조회
    if (!taxAccountant.certificateHash) {
      console.error('[ERROR] 세무사에 연동된 인증서가 없습니다.');
      process.exit(1);
    }
    
    const certPath = taxAccountant.certificatePath || await getCertPathByHash(taxAccountant.certificateHash);
    if (!certPath) {
      console.error('[ERROR] 인증서 경로를 찾을 수 없습니다.');
      process.exit(1);
    }
    
    console.log(`[INFO] 인증서 경로: ${certPath}`);
    
    // 3. 인증서 비밀번호 조회
    const password = await getCertificatePassword(certPath);
    if (!password) {
      console.error('[ERROR] 인증서 비밀번호를 찾을 수 없습니다.');
      process.exit(1);
    }
    
    console.log(`[INFO] 인증서 비밀번호: 확인됨`);
    console.log(`[INFO] 홈택스 거래처 조회 시작...\n`);
    
    // 4. Python 스크립트 실행
    const pythonScriptPath = path.join(__dirname, 'get-session-with-permission.py');
    
    const result = await new Promise((resolve, reject) => {
      const python = spawn('python3', [
        pythonScriptPath,
        certPath,
        password
      ], {
        env: {
          ...process.env,
          AXCEL_ENCRYPTION_KEY: process.env.AXCEL_ENCRYPTION_KEY || '',
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      python.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd);
              const parsed = JSON.parse(jsonStr);
              resolve(parsed);
            } else {
              reject(new Error('JSON 응답을 찾을 수 없습니다.'));
            }
          } catch (e) {
            reject(new Error(`JSON 파싱 실패: ${e.message}\n출력: ${stdout.substring(0, 500)}`));
          }
        } else {
          reject(new Error(`Python 스크립트 실패 (코드: ${code})\n${stderr || '알 수 없는 오류'}`));
        }
      });
    });
    
    // 5. 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('[결과]');
    console.log('='.repeat(60));
    
    if (!result.apiSuccess || !result.clients) {
      console.log(`[실패] 거래처 조회 실패`);
      console.log(`오류: ${result.apiError || result.permissionError || result.error || '알 수 없는 오류'}`);
      process.exit(1);
    }
    
    const clients = result.clients || [];
    console.log(`[성공] 총 ${clients.length}개 거래처 조회됨`);
    console.log(`\n[상세 통계]`);
    
    // 수임중/해지중/미동의 통계
    const activeCount = clients.filter(c => c._engagementStatus === '수임중').length;
    const terminatedCount = clients.filter(c => c._engagementStatus === '해지중').length;
    const pendingCount = clients.filter(c => c._engagementStatus === '미동의').length;
    console.log(`  - 수임중: ${activeCount}개`);
    console.log(`  - 해지중: ${terminatedCount}개`);
    console.log(`  - 미동의: ${pendingCount}개`);
    
    // 사업자번호 통계
    const uniqueBizNos = new Set();
    const emptyBizNos = [];
    clients.forEach(client => {
      const bizNo = client.bsno || client.clntbsno || client.사업자번호 || '';
      if (bizNo && bizNo.trim()) {
        uniqueBizNos.add(bizNo.replace(/-/g, ''));
      } else {
        emptyBizNos.push(client);
      }
    });
    
    console.log(`  - 고유한 사업자번호: ${uniqueBizNos.size}개`);
    console.log(`  - 사업자번호 없는 거래처: ${emptyBizNos.length}개`);
    
    // 중복 사업자번호 확인
    const bizNoCounts = {};
    clients.forEach(client => {
      const bizNo = (client.bsno || client.clntbsno || client.사업자번호 || '').replace(/-/g, '');
      if (bizNo && bizNo.trim()) {
        bizNoCounts[bizNo] = (bizNoCounts[bizNo] || 0) + 1;
      }
    });
    
    const duplicates = Object.entries(bizNoCounts).filter(([bizNo, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`\n[중복 사업자번호 발견]`);
      duplicates.forEach(([bizNo, count]) => {
        console.log(`  - ${bizNo}: ${count}회`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`[요약]`);
    console.log(`  - 조회된 거래처: ${clients.length}개`);
    console.log(`  - 고유한 사업자번호: ${uniqueBizNos.size}개`);
    console.log(`  - 중복 사업자번호: ${duplicates.length}개`);
    console.log('='.repeat(60));
    
    // 샘플 데이터 출력 (처음 5개)
    if (clients.length > 0) {
      console.log('\n[샘플 데이터 (처음 5개)]');
      clients.slice(0, 5).forEach((client, idx) => {
        console.log(`\n${idx + 1}. ${client.tnmNm || client.fnm || '이름 없음'}`);
        console.log(`   사업자번호: ${client.bsno || client.clntbsno || '없음'}`);
        console.log(`   대표자: ${client.txprNm || '없음'}`);
        console.log(`   상태: ${client._engagementStatus || '수임중'}`);
      });
    }
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

