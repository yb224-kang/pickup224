/**
 * TypeScript 사용 예시
 */

import {
    discoverCertificatesBasic,
    discoverCertificatesDetailed,
    saveCertificatePassword,
    getCertificatePassword,
    deleteCertificatePassword,
    CertificateBasicInfo
} from '../index';

async function example() {
    // 1. 기본 조회
    console.log('=== 기본 조회 ===');
    const basicCerts = await discoverCertificatesBasic();
    console.log(`발견된 인증서: ${basicCerts.length}개`);
    basicCerts.forEach(cert => {
        console.log(`- ${cert.name} (${cert.type}): ${cert.path}`);
    });

    // 2. 세부 조회
    console.log('\n=== 세부 조회 ===');
    const detailedCerts = await discoverCertificatesDetailed();
    console.log(`발견된 인증서: ${detailedCerts.length}개`);

    // 3. 비밀번호 저장
    if (basicCerts.length > 0) {
        const certPath = basicCerts[0].path;
        console.log(`\n=== 비밀번호 저장: ${certPath} ===`);
        await saveCertificatePassword(certPath, 'password123');
        console.log('비밀번호 저장 완료');

        // 4. 비밀번호 조회
        const password = await getCertificatePassword(certPath);
        console.log(`비밀번호 조회: ${password ? '성공' : '실패'}`);
    }
}

// example().catch(console.error);

