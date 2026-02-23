/**
 * 위택스 신고서 수집 관련 타입 정의
 */

import { 특별징수신고서납세의무자별상세 } from '../../../../R&D/wetax-module/src/scrapper/wetax/schema';
import { CertificateData } from '../python-certificate-signer';

/**
 * 수집 옵션
 */
export interface WithholdingTaxCollectionOptions {
    startDate: Date;
    endDate: Date;
    delayBetweenRequests?: number; // 기본값: 0.1초
    onProgress?: (current: number, total: number) => void;
}

/**
 * 수집 결과
 */
export interface WithholdingTaxCollectionResult {
    totalReports: number;
    totalTaxpayers: number;
    successCount: number;
    failCount: number;
    reports: CollectedReport[];
}

/**
 * 수집된 신고서 데이터
 */
export interface CollectedReport {
    metadata: {
        collectedAt: string;
        certName: string;
        certPath: string;
        groupId: string;
        clientName: string;
        businessNumber: string;
    };
    report: {
        dclrId: string;
        dclrYmd: Date | null;
        dclrObjCn: string | null;
        payPargTxa: number | null;
        status: string | null;
        payYmd: Date | null;              // 납부일자
        dclrCmnRcptClCd: string | null;  // 신고상태코드 ("06"=신고완료, "07"=신고취소)
    };
    reportDetails: {
        basicInfo: any[];
        taxpayers: any[];
    };
    raw: 특별징수신고서납세의무자별상세;
}

/**
 * 위임자 정보 (간단한 형태)
 */
export interface WetaxClientInfo {
    dlgpBzmnId?: string;
    dlgpBrno?: string;
    dlgpConmNm?: string;
}

