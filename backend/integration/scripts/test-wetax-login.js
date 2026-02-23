/**
 * 위택스 로그인 테스트 스크립트
 * 저장된 인증서로 위택스 로그인을 테스트합니다.
 */

const path = require('path');
const fs = require('fs');

// TypeScript 컴파일 설정
require('ts-node').register({
    project: path.join(__dirname, '../../tsconfig.json'),
    transpileOnly: true,
});

// Backend 모듈 로드
const backendModule = require('../../dist/index');
const {
    listSavedCertificates,
    getCertificatePassword
} = backendModule;

// 위택스 모듈 로드
const wetaxModulePath = path.join(__dirname, '../../../R&D/wetax-module/src');
const { WetaxService } = require(path.join(wetaxModulePath, 'services/wetax-service'));
const { PythonCertificateSigner } = require('../../dist/index');

async function testWetaxLogin() {
    console.log('=== 위택스 로그인 테스트 ===\n');
    
    try {
        // 1. 저장된 인증서 목록 조회
        console.log('1️⃣ 저장된 인증서 목록 조회...');
        const savedCerts = await listSavedCertificates();
        
        if (savedCerts.length === 0) {
            console.error('❌ 저장된 인증서가 없습니다.');
            process.exit(1);
        }
        
        console.log(`✅ ${savedCerts.length}개의 인증서 발견\n`);
        
        // 2. 첫 번째 인증서 선택
        const cert = savedCerts[0];
        console.log(`2️⃣ 인증서 선택: ${cert.name}`);
        console.log(`   경로: ${cert.path}\n`);
        
        // 3. 인증서 파일 읽기
        console.log('3️⃣ 인증서 파일 읽기...');
        if (!fs.existsSync(cert.path)) {
            console.error(`❌ 인증서 파일을 찾을 수 없습니다: ${cert.path}`);
            process.exit(1);
        }
        
        const certFileData = fs.readFileSync(cert.path);
        console.log(`✅ 인증서 파일 읽기 완료 (${certFileData.length} bytes)\n`);
        
        // 4. 비밀번호 조회
        console.log('4️⃣ 인증서 비밀번호 조회...');
        const password = await getCertificatePassword(cert.path);
        
        if (!password) {
            console.error('❌ 인증서 비밀번호를 찾을 수 없습니다.');
            process.exit(1);
        }
        
        console.log('✅ 비밀번호 조회 완료\n');
        
        // 5. 위택스 모듈 형식으로 변환
        console.log('5️⃣ 위택스 모듈 형식으로 변환...');
        const certificateData = {
            certFilename: path.basename(cert.path),
            certFileData: certFileData,
            certPassword: password
        };
        console.log('✅ 변환 완료\n');
        
        // 6. CertificateSigner 생성
        console.log('6️⃣ CertificateSigner 생성...');
        const certificateSigner = new PythonCertificateSigner();
        console.log('✅ 생성 완료\n');
        
        // 7. WetaxService 생성
        console.log('7️⃣ WetaxService 생성...');
        const service = new WetaxService(certificateSigner);
        console.log('✅ 생성 완료\n');
        
        // 8. 위임자 목록 조회 (로그인 테스트)
        console.log('8️⃣ 위택스 로그인 및 위임자 목록 조회...');
        console.log('   (이 과정에서 로그인이 수행됩니다)\n');
        
        const clients = await service.getWetaxClients(certificateData);
        
        console.log('✅ 로그인 성공!\n');
        console.log('=== 위임자 목록 ===');
        const clientCount = Object.keys(clients).length;
        console.log(`총 ${clientCount}개의 위임자 그룹 발견\n`);
        
        // 각 그룹별 위임자 수 출력
        for (const [groupId, clientList] of Object.entries(clients)) {
            console.log(`그룹 ID: ${groupId}`);
            console.log(`  위임자 수: ${clientList.length}개`);
            if (clientList.length > 0) {
                const firstClient = clientList[0];
                console.log(`  예시: ${firstClient.dlgpConmNm || '이름 없음'} (${firstClient.dlgpBrno || '사업자번호 없음'})`);
            }
            console.log('');
        }
        
        console.log('✅ 위택스 로그인 테스트 완료!');
        
    } catch (error) {
        console.error('\n❌ 오류 발생:');
        console.error(error);
        if (error.stack) {
            console.error('\n스택 트레이스:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 실행
testWetaxLogin();


