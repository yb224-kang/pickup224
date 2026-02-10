/**
 * 모든 모듈 통합 테스트 (7번 제외)
 */

import {
    discoverCertificatesBasic,
    discoverCertificatesDetailed,
    saveCertificatePassword,
    getCertificatePassword,
    deleteCertificatePassword
} from '../../index';

async function testAll() {
    console.log('🧪 Function 모듈 통합 테스트\n');
    console.log('='.repeat(50));
    
    // 1. 기본 조회
    console.log('\n[1] 인증서 기본 조회');
    const basicCerts = await discoverCertificatesBasic();
    console.log(`   발견된 인증서: ${basicCerts.length}개`);
    
    // 2. 세부 조회
    console.log('\n[2] 인증서 세부 조회');
    const detailedCerts = await discoverCertificatesDetailed();
    console.log(`   발견된 인증서: ${detailedCerts.length}개`);
    
    // 6. 비밀번호 관리 (인증서가 있을 때만)
    if (basicCerts.length > 0) {
        const testCert = basicCerts[0];
        console.log(`\n[6] 비밀번호 저장/관리 (${testCert.name})`);
        
        try {
            await saveCertificatePassword(testCert.path, 'test123');
            const password = await getCertificatePassword(testCert.path);
            console.log(`   저장/조회: ${password === 'test123' ? '✅ 성공' : '❌ 실패'}`);
            
            await deleteCertificatePassword(testCert.path);
            const afterDelete = await getCertificatePassword(testCert.path);
            console.log(`   삭제: ${afterDelete === null ? '✅ 성공' : '❌ 실패'}`);
        } catch (error) {
            console.log(`   ❌ 오류: ${error}`);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ TypeScript 모듈 테스트 완료');
    console.log('\n📝 Python 모듈 테스트는 별도로 실행하세요:');
    console.log('   python modules/certificate/tests/test-infer-metadata.py [인증서경로]');
    console.log('   python modules/certificate/tests/test-parse-without-password.py [인증서경로]');
    console.log('   python modules/certificate/tests/test-parse-with-password.py [인증서경로]');
    console.log('   python modules/hometax/tests/test-fetch-cookies.py');
}

testAll().catch(console.error);

