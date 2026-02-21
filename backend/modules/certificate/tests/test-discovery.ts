/**
 * 인증서 조회 테스트 (1번 & 2번)
 */

import {
    discoverCertificatesBasic,
    discoverCertificatesDetailed,
    CertificateBasicInfo
} from '../../index';

async function testDiscovery() {
    console.log('=== 1. 기본 조회 테스트 ===');
    try {
        const basicCerts = await discoverCertificatesBasic();
        console.log(`✅ 발견된 인증서: ${basicCerts.length}개\n`);
        
        if (basicCerts.length > 0) {
            basicCerts.forEach((cert, index) => {
                console.log(`[${index + 1}] ${cert.name}`);
                console.log(`   타입: ${cert.type}`);
                console.log(`   경로: ${cert.path}`);
                if (cert.keyPath) {
                    console.log(`   키 경로: ${cert.keyPath}`);
                }
                console.log(`   크기: ${cert.size} bytes`);
                console.log(`   수정일: ${cert.modified.toLocaleString()}`);
                console.log('');
            });
        } else {
            console.log('⚠️  인증서를 찾을 수 없습니다.');
            console.log('   NPKI 폴더에 인증서가 있는지 확인하세요.');
        }
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }

    console.log('\n=== 2. 세부 조회 테스트 ===');
    try {
        const detailedCerts = await discoverCertificatesDetailed();
        console.log(`✅ 발견된 인증서: ${detailedCerts.length}개\n`);
        
        const basicCerts = await discoverCertificatesBasic();
        if (detailedCerts.length > basicCerts.length) {
            console.log(`📊 세부 조회에서 ${detailedCerts.length - basicCerts.length}개 추가 발견`);
        }
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

testDiscovery().catch(console.error);



