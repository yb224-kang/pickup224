/**
 * 위택스 특별징수 신고서의 납세의무자별 상세 정보 수집 스크립트
 * 
 * 수집 대상:
 * - 수임중인 거래처별로 특별징수신고내역 조회
 * - 각 신고서의 납세의무자별 정보 수집 (성명, 주민번호, 과세표준, 산출세액)
 * 
 * 저장 구조:
 * R&D/collected_data/wetax/withholding_taxpayers/{사업자번호}_{신고ID}_{날짜}.json
 */

const path = require('path');
const fs = require('fs');

// 프로젝트 루트로 작업 디렉토리 변경 (data 폴더 접근을 위해)
const PROJECT_ROOT = path.join(__dirname, '..');
process.chdir(PROJECT_ROOT);

// TypeScript 컴파일 설정
require('ts-node').register({
    project: path.join(PROJECT_ROOT, 'backend/tsconfig.json'),
    transpileOnly: true,
});

// Backend 모듈 로드
const backendModule = require(path.join(PROJECT_ROOT, 'backend/dist/index'));
const {
    listSavedCertificates,
    getCertificatePassword
} = backendModule;

// 위택스 모듈 로드
const wetaxModulePath = path.join(__dirname, 'wetax-module/src');
const { WetaxService } = require(path.join(wetaxModulePath, 'services/wetax-service'));
const { WetaxScrapper } = require(path.join(wetaxModulePath, 'scrapper/wetax/wetax-scrapper'));
const { PythonCertificateSigner } = require(path.join(PROJECT_ROOT, 'backend/dist/index'));

// 출력 디렉토리
const OUTPUT_DIR = path.join(__dirname, 'collected_data', 'wetax', 'withholding_taxpayers');

// 딜레이 설정 (초)
const DELAY_BETWEEN_REQUESTS = 0.1; // API 호출 간 딜레이
const DELAY_BETWEEN_CLIENTS = 0.3; // 거래처 간 딜레이

/**
 * 딜레이 함수
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * 날짜 포맷팅 (YYYYMMDD)
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 파일 저장
 */
function saveData(data, filename) {
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`    ✅ 저장: ${filename}`);
}

/**
 * 메인 함수
 */
async function main() {
    console.log('=== 위택스 특별징수 납세의무자별 상세 정보 수집 ===\n');

    try {
        // 1. 저장된 인증서 목록 조회
        console.log('1️⃣ 저장된 인증서 목록 조회...');
        const savedCerts = await listSavedCertificates();
        
        if (savedCerts.length === 0) {
            console.error('❌ 저장된 인증서가 없습니다.');
            process.exit(1);
        }
        
        console.log(`✅ ${savedCerts.length}개의 인증서 발견\n`);

        // 2. 수집 기간 설정 (최근 3개월)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        
        console.log(`2️⃣ 수집 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}\n`);

        // 3. CertificateSigner 생성
        console.log('3️⃣ CertificateSigner 생성...');
        const certificateSigner = new PythonCertificateSigner();
        const service = new WetaxService(certificateSigner);
        console.log('✅ 생성 완료\n');

        let totalReports = 0;
        let totalTaxpayers = 0;
        let successCount = 0;
        let failCount = 0;

        // 4. 각 인증서별로 처리
        for (let certIndex = 0; certIndex < savedCerts.length; certIndex++) {
            const cert = savedCerts[certIndex];
            console.log(`\n📋 인증서 ${certIndex + 1}/${savedCerts.length}: ${cert.name}`);
            console.log(`   경로: ${cert.path}\n`);

            try {
                // 4-1. 인증서 파일 읽기
                if (!fs.existsSync(cert.path)) {
                    console.log(`   ⚠️ 인증서 파일을 찾을 수 없습니다: ${cert.path}`);
                    continue;
                }

                const certFileData = fs.readFileSync(cert.path);
                const password = await getCertificatePassword(cert.path);
                
                if (!password) {
                    console.log(`   ⚠️ 인증서 비밀번호를 찾을 수 없습니다.`);
                    continue;
                }

                // 4-2. 위택스 모듈 형식으로 변환
                const certificateData = {
                    certFilename: path.basename(cert.path),
                    certFileData: certFileData,
                    certPassword: password
                };

                // 4-3. 위임자 목록 조회
                console.log('   📋 위임자 목록 조회...');
                await sleep(DELAY_BETWEEN_REQUESTS);
                
                const clients = await service.getWetaxClients(certificateData);
                const clientGroups = Object.keys(clients);
                
                console.log(`   ✅ ${clientGroups.length}개의 위임자 그룹 발견\n`);

                // 4-4. 위임자 그룹별로 처리하기 전에 scrapper 생성 및 로그인 (한 번만)
                console.log('   🔐 위택스 로그인 중...');
                const scrapper = new WetaxScrapper(
                    [certificateData],
                    password,
                    certificateSigner
                );
                await scrapper.login();
                console.log('   ✅ 로그인 완료\n');

                // 4-5. 특별징수 신고내역 조회 (전체 위임자 그룹에 대해 한 번만)
                console.log(`   🔍 특별징수 신고내역 조회 중...`);
                await sleep(DELAY_BETWEEN_REQUESTS);
                
                let allReports = [];
                try {
                    const reports = await service.getWetaxWithholdingTaxReportDetail(
                        certificateData,
                        startDate,
                        endDate
                    );
                    allReports = reports;
                    console.log(`   ✅ ${allReports.length}개의 신고서 발견\n`);
                } catch (error) {
                    console.error(`   ❌ 특별징수 신고내역 조회 실패: ${error.message}`);
                    failCount++;
                    continue;
                }

                // 4-6. 모든 신고서 수집 (필터링 없이)
                console.log(`   📋 총 ${allReports.length}개의 신고서 수집 시작\n`);

                // 4-7. 각 신고서별로 납세의무자별 상세 정보 조회 (로그인된 scrapper 재사용)
                for (let reportIndex = 0; reportIndex < allReports.length; reportIndex++) {
                    const report = allReports[reportIndex];
                    
                    if ((reportIndex + 1) % 50 === 0 || reportIndex === 0) {
                        console.log(`   📄 진행 상황: ${reportIndex + 1}/${allReports.length} (${Math.round((reportIndex + 1) / allReports.length * 100)}%)\n`);
                    }
                    
                    await sleep(DELAY_BETWEEN_REQUESTS);
                    
                    try {
                        // 납세의무자별 상세 정보 조회 (이미 로그인된 scrapper 재사용)
                        const taxpayerDetails = await scrapper.특별징수신고서납세의무자별상세(report.dclrId);
                        
                        // 데이터 저장
                        const businessNumber = report.dclrBzmnId || 'unknown';
                        const filename = `${businessNumber}_${report.dclrId}_${formatDate(new Date())}.json`;
                        
                        // 위임자 정보 찾기 (선택적)
                        let groupId = 'unknown';
                        let clientName = 'unknown';
                        for (const gId in clients) {
                            const groupClients = clients[gId];
                            if (groupClients.some(c => (c.dlgpBrno || c.dlgpBzmnId) === businessNumber)) {
                                groupId = gId;
                                clientName = groupClients[0]?.dlgpConmNm || 'unknown';
                                break;
                            }
                        }
                        
                        const saveDataObj = {
                            metadata: {
                                collectedAt: new Date().toISOString(),
                                certName: cert.name,
                                certPath: cert.path,
                                groupId: groupId,
                                clientName: clientName,
                                businessNumber: businessNumber,
                            },
                            report: {
                                dclrId: report.dclrId,
                                dclrYmd: report.dclrYmd,
                                dclrObjCn: report.dclrObjCn,
                                payPargTxa: report.payPargTxa,
                                status: report.status,
                            },
                            reportDetails: {
                                basicInfo: taxpayerDetails.spctxOpratRptDVOList,
                                taxpayers: taxpayerDetails.spctxOpratRptSubDVOList,
                            },
                            raw: taxpayerDetails,
                        };
                        
                        saveData(saveDataObj, filename);
                        
                        totalReports++;
                        totalTaxpayers += taxpayerDetails.spctxOpratRptSubDVOList.length;
                        successCount++;
                        
                        if ((reportIndex + 1) % 10 === 0) {
                            console.log(`   ✅ ${reportIndex + 1}개 신고서 수집 완료 (납세의무자 총 ${totalTaxpayers}명)\n`);
                        }
                        
                    } catch (error) {
                        console.error(`   ❌ 신고서 ${report.dclrId} 오류: ${error.message}`);
                        failCount++;
                    }
                }
                
            } catch (error) {
                console.error(`   ❌ 인증서 처리 실패: ${error.message}`);
                failCount++;
            }
        }

        // 5. 결과 요약
        console.log('\n\n=== 수집 완료 ===');
        console.log(`총 신고서 수집: ${totalReports}개`);
        console.log(`총 납세의무자 수집: ${totalTaxpayers}명`);
        console.log(`성공: ${successCount}건`);
        console.log(`실패: ${failCount}건`);
        console.log(`저장 위치: ${OUTPUT_DIR}\n`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        console.error('\n스택 트레이스:', error.stack);
        process.exit(1);
    }
}

// 실행
main();

