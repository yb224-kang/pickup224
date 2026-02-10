/**
 * 인증서 비밀번호 저장/관리 테스트 (6번)
 */

import {
    discoverCertificatesBasic,
    saveCertificatePassword,
    getCertificatePassword,
    deleteCertificatePassword
} from '../../index';

async function testPassword() {
    console.log('=== 6. 비밀번호 저장/관리 테스트 ===\n');
    
    // 인증서 찾기
    const certs = await discoverCertificatesBasic();
    
    if (certs.length === 0) {
        console.log('⚠️  테스트할 인증서가 없습니다.');
        return;
    }
    
    const testCert = certs[0];
    const testPassword = 'test_password_123';
    
    console.log(`테스트 인증서: ${testCert.path}\n`);
    
    // 1. 비밀번호 저장
    console.log('1️⃣  비밀번호 저장 테스트...');
    try {
        await saveCertificatePassword(testCert.path, testPassword);
        console.log('✅ 비밀번호 저장 성공\n');
    } catch (error) {
        console.error('❌ 비밀번호 저장 실패:', error);
        return;
    }
    
    // 2. 비밀번호 조회
    console.log('2️⃣  비밀번호 조회 테스트...');
    try {
        const retrievedPassword = await getCertificatePassword(testCert.path);
        if (retrievedPassword === testPassword) {
            console.log('✅ 비밀번호 조회 성공 (일치)');
            console.log(`   저장된 비밀번호: ${retrievedPassword}\n`);
        } else {
            console.log('⚠️  비밀번호가 일치하지 않습니다.');
            console.log(`   저장된 값: ${retrievedPassword}\n`);
        }
    } catch (error) {
        console.error('❌ 비밀번호 조회 실패:', error);
    }
    
    // 3. 비밀번호 삭제
    console.log('3️⃣  비밀번호 삭제 테스트...');
    try {
        await deleteCertificatePassword(testCert.path);
        console.log('✅ 비밀번호 삭제 성공');
        
        // 삭제 확인
        const afterDelete = await getCertificatePassword(testCert.path);
        if (afterDelete === null) {
            console.log('✅ 삭제 확인 완료 (비밀번호 없음)\n');
        } else {
            console.log('⚠️  삭제 후에도 비밀번호가 존재합니다.\n');
        }
    } catch (error) {
        console.error('❌ 비밀번호 삭제 실패:', error);
    }
}

testPassword().catch(console.error);


