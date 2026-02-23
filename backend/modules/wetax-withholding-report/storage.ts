/**
 * 위택스 특별징수 신고서 데이터 저장/조회 (Serving 레이어)
 * data/wetax-withholding-reports/index.json에 저장
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CollectedReport } from '../wetax/reports/types';

const STORE_DIR = path.join(process.cwd(), 'data', 'wetax-withholding-reports');
const INDEX_FILE = path.join(STORE_DIR, 'index.json');

export interface WetaxWithholdingReport {
    id: string;
    // 신고서 기본 정보
    dclrId: string;                    // 신고ID
    businessNumber: string;            // 사업자번호
    clientName: string;                // 거래처명
    taxAccountantId: string;           // 세무사 ID
    taxAccountantName?: string;        // 세무사명
    
    // 신고 정보
    dclrYmd: Date | null;              // 신고일자
    dclrObjCn: string | null;           // 귀속연월 (예: "202511")
    payPargTxa: number | null;         // 납부예정세액
    status: string | null;             // 신고 상태
    payYmd: Date | null;              // 납부일자
    dclrCmnRcptClCd: string | null;   // 신고상태코드 ("06"=신고완료, "07"=신고취소)
    
    // 납부/미납 정보
    dcsnTxa: number | null;            // 결정세액
    pargTxa: number | null;            // 예정세액
    payTxbAmt: number | null;          // 납부과세표준
    payInscAdtnTxa: number | null;     // 납부가산세액
    prpmtTxa: number | null;            // 선납세액
    rmbrSumAmt: number | null;         // 환급합계금액
    addPaySumAmt: number | null;        // 추가납부합계금액
    txaAdjRmbrBal: number | null;      // 세액조정환급잔액
    tmnEtcRmbrAmt: number | null;      // 기타환급금액
    tmnAddPayAmt: number | null;       // 추가납부금액
    yestRmbrAmt: number | null;        // 전기환급금액
    yestAddPayAmt: number | null;       // 전기추가납부금액
    itrmRtrmRmbrAmt: number | null;    // 중간환급금액
    adjsAdjAmt: number | null;          // 조정금액
    
    // 납세의무자 정보 (정규화)
    taxpayers: Array<{
        txplNm: string | null;         // 납세의무자 성명
        tnenc: string | null;          // 주민번호 (마스킹)
        sltLocEarnKndCd: string | null; // 소득종류
        sltTxbAmt: number;             // 과세표준
        sltCmpuTxa: number;            // 산출세액
        sltPayAmt: number;             // 납부세액
        txpBrno: string | null;         // 사업자번호
        txpConmNm: string | null;       // 상호명
    }>;
    
    // 메타데이터
    createdAt: string;
    updatedAt: string;
    _originalData?: any;               // 원본 데이터 참조
}

type ReportIndex = Record<string, WetaxWithholdingReport>;

function loadIndex(): ReportIndex {
    if (!fs.existsSync(INDEX_FILE)) {
        return {};
    }
    try {
        const content = fs.readFileSync(INDEX_FILE, 'utf8');
        const parsed = JSON.parse(content);
        // Date 객체 복원
        Object.values(parsed).forEach((report: any) => {
            if (report.dclrYmd) {
                report.dclrYmd = new Date(report.dclrYmd);
            }
            if (report.payYmd) {
                report.payYmd = new Date(report.payYmd);
            }
        });
        return parsed;
    } catch (e) {
        return {};
    }
}

function saveIndex(index: ReportIndex): void {
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * CollectedReport를 Serving 레이어 형식으로 변환
 */
function transformToServingReport(
    collectedReport: CollectedReport,
    taxAccountantId: string,
    taxAccountantName?: string
): Omit<WetaxWithholdingReport, 'id' | 'createdAt' | 'updatedAt'> {
    const taxpayers = (collectedReport.reportDetails.taxpayers || []).map((tp: any) => ({
        txplNm: tp.txplNm || null,
        tnenc: tp.sltTnenc || null,          // 납세의무자 주민번호 (sltTnenc 사용, tnenc는 대표자)
        sltLocEarnKndCd: tp.sltLocEarnKndCd || null,
        sltTxbAmt: tp.sltTxbAmt || 0,
        sltCmpuTxa: tp.sltCmpuTxa || 0,
        sltPayAmt: tp.sltPayAmt || 0,
        txpBrno: tp.txpBrno || null,
        txpConmNm: tp.txpConmNm || null,
    }));

    // basicInfo 배열의 첫 번째 항목에서 납부/미납 정보 추출
    const basicInfo = (collectedReport.reportDetails.basicInfo || [])[0] || {};
    
    // 실제 사업자번호 추출 (taxpayers 또는 basicInfo에서, metadata는 위택스 내부 ID일 수 있음)
    const actualBusinessNumber = basicInfo.txpBrno || 
                                 taxpayers.find(t => t.txpBrno)?.txpBrno || 
                                 collectedReport.metadata.businessNumber;
    
    return {
        dclrId: collectedReport.report.dclrId,
        businessNumber: actualBusinessNumber, // 실제 사업자번호 사용
        clientName: collectedReport.metadata.clientName,
        taxAccountantId,
        taxAccountantName,
        dclrYmd: collectedReport.report.dclrYmd,
        dclrObjCn: collectedReport.report.dclrObjCn,
        payPargTxa: collectedReport.report.payPargTxa,
        status: collectedReport.report.status,
        payYmd: collectedReport.report.payYmd ?? null,
        dclrCmnRcptClCd: collectedReport.report.dclrCmnRcptClCd ?? null,
        // 납부/미납 정보
        dcsnTxa: basicInfo.dcsnTxa ?? null,
        pargTxa: basicInfo.pargTxa ?? null,
        payTxbAmt: basicInfo.payTxbAmt ?? null,
        payInscAdtnTxa: basicInfo.payInscAdtnTxa ?? null,
        prpmtTxa: basicInfo.prpmtTxa ?? null,
        rmbrSumAmt: basicInfo.rmbrSumAmt ?? null,
        addPaySumAmt: basicInfo.addPaySumAmt ?? null,
        txaAdjRmbrBal: basicInfo.txaAdjRmbrBal ?? null,
        tmnEtcRmbrAmt: basicInfo.tmnEtcRmbrAmt ?? null,
        tmnAddPayAmt: basicInfo.tmnAddPayAmt ?? null,
        yestRmbrAmt: basicInfo.yestRmbrAmt ?? null,
        yestAddPayAmt: basicInfo.yestAddPayAmt ?? null,
        itrmRtrmRmbrAmt: basicInfo.itrmRtrmRmbrAmt ?? null,
        adjsAdjAmt: basicInfo.adjsAdjAmt ?? null,
        taxpayers,
        _originalData: collectedReport.raw,
    };
}

/**
 * 신고서 저장 (기존 업데이트 또는 신규 생성)
 */
export async function saveWithholdingReport(
    collectedReport: CollectedReport,
    taxAccountantId: string,
    taxAccountantName?: string
): Promise<WetaxWithholdingReport> {
    const index = loadIndex();
    const now = new Date().toISOString();
    
    // 기존 신고서 찾기 (dclrId 기준)
    const existingId = Object.keys(index).find(id => 
        index[id].dclrId === collectedReport.report.dclrId &&
        index[id].taxAccountantId === taxAccountantId
    );
    
    const transformed = transformToServingReport(collectedReport, taxAccountantId, taxAccountantName);
    
    if (existingId) {
        // 업데이트
        const updated: WetaxWithholdingReport = {
            ...index[existingId],
            ...transformed,
            updatedAt: now,
        };
        index[existingId] = updated;
        saveIndex(index);
        return updated;
    } else {
        // 신규 생성
        const id = `report-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const newReport: WetaxWithholdingReport = {
            id,
            ...transformed,
            createdAt: now,
            updatedAt: now,
        };
        index[id] = newReport;
        saveIndex(index);
        return newReport;
    }
}

/**
 * 여러 신고서 일괄 저장
 */
export async function saveWithholdingReports(
    collectedReports: CollectedReport[],
    taxAccountantId: string,
    taxAccountantName?: string
): Promise<WetaxWithholdingReport[]> {
    const index = loadIndex();
    const now = new Date().toISOString();
    const saved: WetaxWithholdingReport[] = [];
    
    for (const collectedReport of collectedReports) {
        const transformed = transformToServingReport(collectedReport, taxAccountantId, taxAccountantName);
        
        // 기존 신고서 찾기
        const existingId = Object.keys(index).find(id => 
            index[id].dclrId === collectedReport.report.dclrId &&
            index[id].taxAccountantId === taxAccountantId
        );
        
        if (existingId) {
            // 업데이트
            const updated: WetaxWithholdingReport = {
                ...index[existingId],
                ...transformed,
                updatedAt: now,
            };
            index[existingId] = updated;
            saved.push(updated);
        } else {
            // 신규 생성
            const id = `report-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
            const newReport: WetaxWithholdingReport = {
                id,
                ...transformed,
                createdAt: now,
                updatedAt: now,
            };
            index[id] = newReport;
            saved.push(newReport);
        }
    }
    
    saveIndex(index);
    return saved;
}

/**
 * 신고서 목록 조회
 */
export async function listWithholdingReports(
    taxAccountantId?: string
): Promise<WetaxWithholdingReport[]> {
    const index = loadIndex();
    let reports = Object.values(index);
    
    if (taxAccountantId) {
        reports = reports.filter(r => r.taxAccountantId === taxAccountantId);
    }
    
    // 최신순 정렬
    return reports.sort((a, b) => {
        const dateA = a.dclrYmd ? new Date(a.dclrYmd).getTime() : 0;
        const dateB = b.dclrYmd ? new Date(b.dclrYmd).getTime() : 0;
        return dateB - dateA;
    });
}

/**
 * 신고서 상세 조회
 */
export async function getWithholdingReport(id: string): Promise<WetaxWithholdingReport | null> {
    const index = loadIndex();
    return index[id] || null;
}

/**
 * KPI 통계 인터페이스
 */
export interface WithholdingTaxKPI {
    totalCompanies: number;      // 거래처 수
    totalReports: number;         // 신고서 수
    totalTaxpayers: number;       // 총 납세의무자 수
    totalMonths: number;           // 신고된 월 수
}

/**
 * 거래처별 통계 인터페이스
 */
export interface CompanyWithholdingStats {
    businessNumber: string;
    clientName: string;
    monthlyStats: Array<{
        month: string; // "202602"
        incomeTypeStats: Array<{
            incomeType: string; // "근로소득", "기타소득" 등
            count: number; // 납세의무자 수
        }>;
    }>;
}

/**
 * 납세의무자 상세 정보 인터페이스
 */
export interface TaxpayerDetail {
    reportId: string;
    dclrId: string;
    dclrYmd: Date | null;
    businessNumber: string;
    clientName: string;
    txplNm: string | null;
    tnenc: string | null;
    sltLocEarnKndCd: string | null;
    sltTxbAmt: number;
    sltCmpuTxa: number;
    sltPayAmt: number;
    txpBrno: string | null;
    txpConmNm: string | null;
}

/**
 * KPI 통계 조회
 */
export async function getWithholdingTaxKPI(
    taxAccountantId?: string
): Promise<WithholdingTaxKPI> {
    const index = loadIndex();
    let reports = Object.values(index);
    
    if (taxAccountantId) {
        reports = reports.filter(r => r.taxAccountantId === taxAccountantId);
    }
    
    const businessNumbers = new Set(reports.map(r => r.businessNumber));
    const months = new Set(reports.map(r => r.dclrObjCn).filter(Boolean) as string[]);
    const totalTaxpayers = reports.reduce((sum, r) => sum + r.taxpayers.length, 0);
    
    return {
        totalCompanies: businessNumbers.size,
        totalReports: reports.length,
        totalTaxpayers,
        totalMonths: months.size,
    };
}

/**
 * 사업자번호 정규화 (앞의 0 제거하여 비교 가능하게)
 */
function normalizeBusinessNumber(bizNo: string | null | undefined): string {
    if (!bizNo) return '';
    const cleaned = bizNo.replace(/[^0-9]/g, '');
    // 18자리 사업자번호의 경우 앞의 0을 제거하여 10자리로 정규화
    if (cleaned.length === 18 && cleaned.startsWith('00000000')) {
        return cleaned.substring(8);
    }
    // 앞의 0을 제거하고 숫자만 추출
    return cleaned.replace(/^0+/, '');
}

/**
 * 거래처별 특별징수 신고서 통계 조회
 */
export async function getCompanyWithholdingStats(
    taxAccountantId?: string
): Promise<CompanyWithholdingStats[]> {
    const index = loadIndex();
    let reports = Object.values(index);
    
    if (taxAccountantId) {
        reports = reports.filter(r => r.taxAccountantId === taxAccountantId);
    }
    
    // 거래처별로 그룹화
    // 1차: report.businessNumber로 그룹화
    // 2차: taxpayers의 txpBrno로도 그룹화 (더 정확한 매칭)
    const byBusiness: Record<string, {
        businessNumber: string; // 정규화된 사업자번호 (위택스 거래처와 매칭)
        clientName: string;
        reports: WetaxWithholdingReport[];
    }> = {};
    
    for (const report of reports) {
        // 1. report.businessNumber로 그룹화 시도
        const normalizedKey = normalizeBusinessNumber(report.businessNumber);
        
        // 2. taxpayers의 txpBrno도 확인 (더 정확한 매칭)
        const taxpayerBizNos = new Set<string>();
        for (const taxpayer of report.taxpayers) {
            if (taxpayer.txpBrno) {
                const normalized = normalizeBusinessNumber(taxpayer.txpBrno);
                if (normalized) {
                    taxpayerBizNos.add(normalized);
                }
            }
        }
        
        // 매칭 키 결정: taxpayers의 txpBrno가 있으면 그것을 우선 사용, 없으면 report.businessNumber 사용
        const matchKey = taxpayerBizNos.size > 0 
            ? Array.from(taxpayerBizNos)[0] // 첫 번째 txpBrno 사용
            : normalizedKey;
        
        if (!matchKey) continue; // 사업자번호가 없으면 건너뛰기
        
        if (!byBusiness[matchKey]) {
            byBusiness[matchKey] = {
                businessNumber: matchKey,
                clientName: report.clientName || '이름 없음',
                reports: [],
            };
        }
        byBusiness[matchKey].reports.push(report);
    }
    
    // 통계 생성
    const stats: CompanyWithholdingStats[] = Object.values(byBusiness).map(business => {
        // 월별로 그룹화
        const byMonth: Record<string, WetaxWithholdingReport[]> = {};
        for (const report of business.reports) {
            const month = report.dclrObjCn || '미지정';
            if (!byMonth[month]) {
                byMonth[month] = [];
            }
            byMonth[month].push(report);
        }
        
        // 월별, 소득종류별 통계
        const monthlyStats = Object.entries(byMonth).map(([month, monthReports]) => {
            // 소득종류별로 집계
            const byIncomeType: Record<string, number> = {};
            for (const report of monthReports) {
                for (const taxpayer of report.taxpayers) {
                    const incomeType = taxpayer.sltLocEarnKndCd || '미지정';
                    byIncomeType[incomeType] = (byIncomeType[incomeType] || 0) + 1;
                }
            }
            
            const incomeTypeStats = Object.entries(byIncomeType).map(([incomeType, count]) => ({
                incomeType,
                count,
            })).sort((a, b) => b.count - a.count);
            
            return {
                month,
                incomeTypeStats,
            };
        }).sort((a, b) => b.month.localeCompare(a.month)); // 최신월 우선
        
        return {
            businessNumber: business.businessNumber, // 정규화된 사업자번호 반환 (위택스 거래처와 매칭)
            clientName: business.clientName,
            monthlyStats,
        };
    });
    
    return stats;
}

/**
 * 특정 조건의 납세의무자 목록 조회
 */
export async function getTaxpayersByFilter(filters: {
    businessNumber?: string;
    month?: string;
    incomeType?: string;
    taxAccountantId?: string;
}): Promise<TaxpayerDetail[]> {
    const index = loadIndex();
    let reports = Object.values(index);
    
    if (filters.taxAccountantId) {
        reports = reports.filter(r => r.taxAccountantId === filters.taxAccountantId);
    }
    
    if (filters.month) {
        reports = reports.filter(r => r.dclrObjCn === filters.month);
    }
    
    const taxpayers: TaxpayerDetail[] = [];
    const normalizedFilterBizNo = filters.businessNumber ? normalizeBusinessNumber(filters.businessNumber) : null;
    
    for (const report of reports) {
        // businessNumber 필터: report.businessNumber 또는 taxpayers의 txpBrno로 매칭
        if (normalizedFilterBizNo) {
            const reportBizNoNormalized = normalizeBusinessNumber(report.businessNumber);
            const hasMatchingTaxpayer = report.taxpayers.some(tp => {
                const tpBizNoNormalized = normalizeBusinessNumber(tp.txpBrno);
                return tpBizNoNormalized === normalizedFilterBizNo;
            });
            
            // report.businessNumber 또는 taxpayers의 txpBrno 중 하나라도 매칭되면 포함
            if (reportBizNoNormalized !== normalizedFilterBizNo && !hasMatchingTaxpayer) {
                continue;
            }
        }
        
        // _originalData에서 납세의무자별 sltTnenc를 추출 (기존 잘못 저장된 데이터 보정)
        const rawTaxpayers: any[] = report._originalData?.spctxOpratRptSubDVOList || [];
        
        for (let tpIdx = 0; tpIdx < report.taxpayers.length; tpIdx++) {
            const taxpayer = report.taxpayers[tpIdx];
            const rawTp = rawTaxpayers[tpIdx]; // 원본 데이터에서 같은 인덱스의 납세의무자
            
            // businessNumber 필터: taxpayers의 txpBrno도 확인
            if (normalizedFilterBizNo) {
                const tpBizNoNormalized = normalizeBusinessNumber(taxpayer.txpBrno);
                if (tpBizNoNormalized !== normalizedFilterBizNo) {
                    continue;
                }
            }
            
            if (filters.incomeType && taxpayer.sltLocEarnKndCd !== filters.incomeType) {
                continue;
            }
            
            // tnenc 보정: 기존 데이터는 대표자 주민번호가 저장됨 → 원본의 sltTnenc 사용
            const correctTnenc = rawTp?.sltTnenc || taxpayer.tnenc;
            
            taxpayers.push({
                reportId: report.id,
                dclrId: report.dclrId,
                dclrYmd: report.dclrYmd,
                businessNumber: report.businessNumber,
                clientName: report.clientName,
                txplNm: taxpayer.txplNm,
                tnenc: correctTnenc,
                sltLocEarnKndCd: taxpayer.sltLocEarnKndCd,
                sltTxbAmt: taxpayer.sltTxbAmt,
                sltCmpuTxa: taxpayer.sltCmpuTxa,
                sltPayAmt: taxpayer.sltPayAmt,
                txpBrno: taxpayer.txpBrno,
                txpConmNm: taxpayer.txpConmNm,
            });
        }
    }
    
    return taxpayers;
}

