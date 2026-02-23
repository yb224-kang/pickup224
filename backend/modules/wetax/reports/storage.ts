/**
 * 위택스 수집 데이터 저장 유틸리티
 */

import * as fs from 'fs';
import * as path from 'path';
import { CollectedReport } from './types';

export interface StorageOptions {
    outputDir?: string; // 기본값: data/wetax/reports
    filenameFormat?: (report: CollectedReport) => string;
}

/**
 * 날짜 포맷팅 (YYYYMMDD)
 */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 위택스 신고서 데이터 저장 클래스
 */
export class WetaxReportStorage {
    private outputDir: string;
    private filenameFormat: (report: CollectedReport) => string;

    constructor(options?: StorageOptions) {
        this.outputDir = options?.outputDir || 
            path.join(process.cwd(), 'data', 'wetax', 'reports');
        
        // 디렉토리 생성
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // 파일명 포맷 함수
        this.filenameFormat = options?.filenameFormat || this.defaultFilenameFormat;
    }

    /**
     * 수집된 신고서 데이터 저장
     * @param report 수집된 신고서 데이터
     * @param customFilename 커스텀 파일명 (선택)
     * @returns 저장된 파일 경로
     */
    saveReport(report: CollectedReport, customFilename?: string): string {
        const filename = customFilename || this.filenameFormat(report);
        const filepath = path.join(this.outputDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
        return filepath;
    }

    /**
     * 여러 신고서 일괄 저장
     * @param reports 수집된 신고서 데이터 배열
     * @returns 저장된 파일 경로 배열
     */
    saveReports(reports: CollectedReport[]): string[] {
        return reports.map(report => this.saveReport(report));
    }

    /**
     * 기본 파일명 생성 함수
     * 형식: {사업자번호}_{신고ID}_{날짜}.json
     */
    private defaultFilenameFormat(report: CollectedReport): string {
        const businessNumber = report.metadata.businessNumber || 'unknown';
        const dclrId = report.report.dclrId || 'unknown';
        const date = formatDate(new Date());
        return `${businessNumber}_${dclrId}_${date}.json`;
    }

    /**
     * 저장 디렉토리 경로 반환
     */
    getOutputDir(): string {
        return this.outputDir;
    }
}


