/**
 * 위택스 신고서 수집 모듈
 * R&D/collect_wetax_withholding_taxpayers.js의 핵심 로직을 모듈화
 */

import { CertificateData } from '../python-certificate-signer';
import { WetaxService } from '../../../../R&D/wetax-module/src/services/wetax-service';
import { WetaxScrapper } from '../../../../R&D/wetax-module/src/scrapper/wetax/wetax-scrapper';
import { PythonCertificateSigner } from '../python-certificate-signer';
import { 특별징수신고서납세의무자별상세, 특별징수신고내역 } from '../../../../R&D/wetax-module/src/scrapper/wetax/schema';
import {
    WithholdingTaxCollectionOptions,
    WithholdingTaxCollectionResult,
    CollectedReport,
    WetaxClientInfo
} from './types';

// Re-export for convenience
export { WetaxClientFetcher } from '../clients/fetch';
export { WetaxReportStorage } from './storage';

/**
 * 위택스 신고서 수집 클래스
 */
export class WetaxReportCollector {
    private certificateSigner: PythonCertificateSigner;
    private service: WetaxService;

    constructor() {
        this.certificateSigner = new PythonCertificateSigner();
        this.service = new WetaxService(this.certificateSigner);
    }

    /**
     * 특별징수(원천세) 신고서의 납세의무자별 상세 정보 수집
     * 
     * @param certificate 인증서 데이터
     * @param clients 위임자 그룹 (키: dlgpBzmnId, 값: 위임자 배열)
     * @param options 수집 옵션
     * @returns 수집 결과
     */
    async collectWithholdingTaxReports(
        certificate: CertificateData,
        clients: Record<string, WetaxClientInfo[]>,
        options: WithholdingTaxCollectionOptions
    ): Promise<WithholdingTaxCollectionResult> {
        const delay = options.delayBetweenRequests || 0.1;
        const result: WithholdingTaxCollectionResult = {
            totalReports: 0,
            totalTaxpayers: 0,
            successCount: 0,
            failCount: 0,
            reports: []
        };

        // 1. WetaxScrapper 생성 및 로그인 (한 번만)
        const scrapper = new WetaxScrapper(
            [certificate],
            certificate.certPassword,
            this.certificateSigner
        );
        await scrapper.login();

        // 2. 특별징수 신고내역 조회
        let allReports;
        try {
            allReports = await this.service.getWetaxWithholdingTaxReportDetail(
                certificate,
                options.startDate,
                options.endDate
            );
        } catch (error) {
            console.error(`특별징수 신고내역 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
            result.failCount++;
            return result;
        }

        // 3. 각 신고서별로 납세의무자별 상세 정보 조회
        for (let i = 0; i < allReports.length; i++) {
            const report = allReports[i];
            
            if (options.onProgress) {
                options.onProgress(i + 1, allReports.length);
            }

            await this.sleep(delay);

            try {
                const taxpayerDetails = await scrapper.특별징수신고서납세의무자별상세(report.dclrId);
                
                // 실제 사업자번호 추출 (taxpayers 또는 basicInfo에서)
                const basicInfo = taxpayerDetails.spctxOpratRptDVOList?.[0];
                const taxpayers = taxpayerDetails.spctxOpratRptSubDVOList || [];
                const actualBusinessNumber = basicInfo?.txpBrno || 
                                            taxpayers.find((t: any) => t.txpBrno)?.txpBrno || 
                                            report.dclrBzmnId || 
                                            'unknown';
                
                // 위임자 정보 찾기 (실제 사업자번호로 검색)
                const { groupId, clientName } = this.findClientInfo(clients, actualBusinessNumber);

                const collectedReport: CollectedReport = {
                    metadata: {
                        collectedAt: new Date().toISOString(),
                        certName: certificate.certFilename,
                        certPath: '', // 필요시 추가
                        groupId,
                        clientName,
                        businessNumber: actualBusinessNumber // 실제 사업자번호 사용
                    },
                    report: {
                        dclrId: report.dclrId,
                        dclrYmd: report.dclrYmd,
                        dclrObjCn: report.dclrObjCn,
                        payPargTxa: report.payPargTxa,
                        status: report.status?.toString() || null,
                        payYmd: report.payYmd ?? null,
                        dclrCmnRcptClCd: report.dclrCmnRcptClCd ?? null
                    },
                    reportDetails: {
                        basicInfo: taxpayerDetails.spctxOpratRptDVOList,
                        taxpayers: taxpayerDetails.spctxOpratRptSubDVOList
                    },
                    raw: taxpayerDetails
                };

                result.reports.push(collectedReport);
                result.totalReports++;
                result.totalTaxpayers += taxpayerDetails.spctxOpratRptSubDVOList.length;
                result.successCount++;

            } catch (error) {
                result.failCount++;
                console.error(`신고서 ${report.dclrId} 수집 실패:`, error instanceof Error ? error.message : String(error));
            }
        }

        return result;
    }

    /**
     * 위임자 정보 찾기
     */
    private findClientInfo(
        clients: Record<string, WetaxClientInfo[]>,
        businessNumber: string
    ): { groupId: string; clientName: string } {
        for (const groupId in clients) {
            const groupClients = clients[groupId];
            if (groupClients.some(c => (c.dlgpBrno || c.dlgpBzmnId) === businessNumber)) {
                return {
                    groupId,
                    clientName: groupClients[0]?.dlgpConmNm || 'unknown'
                };
            }
        }
        return { groupId: 'unknown', clientName: 'unknown' };
    }

    /**
     * 딜레이 함수
     */
    private sleep(seconds: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }
}

