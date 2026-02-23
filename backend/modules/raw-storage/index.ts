/**
 * Raw 데이터 저장소 모듈
 * 
 * 수집한 원천 데이터를 "그대로" 보관하는 레이어.
 * - 원천 사이트 변경 시 원인 분석 가능
 * - 파서 수정 후 재처리(reprocess) 가능  
 * - 법/분쟁/정합성 이슈에서 증빙 가능
 * 
 * 저장 구조:
 *   data/raw/{source}/{type}/{YYYY-MM-DD}_run{runId}.json
 * 
 * 예:
 *   data/raw/hometax/clients/2026-02-23_run001.json
 *   data/raw/wetax/clients/2026-02-23_run001.json
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const RAW_BASE_DIR = path.join(process.cwd(), 'data', 'raw');

// ========== Types ==========

export type DataSource = 'hometax' | 'wetax';
export type DataType = 'clients' | 'reports';

export interface RawSnapshot {
    /** 스냅샷 고유 ID */
    snapshotId: string;
    /** 연관된 수집 실행 ID */
    runId: string;
    /** 데이터 출처 */
    source: DataSource;
    /** 데이터 유형 */
    type: DataType;
    /** 수집 시각 */
    collectedAt: string;
    /** 세무사 ID */
    taxAccountantId: string;
    /** 인증서 경로 (식별용) */
    certPath?: string;
    /** 원천 데이터 (그대로 저장) */
    rawPayload: any;
    /** 페이로드 해시 (중복 감지용) */
    payloadHash: string;
    /** 레코드 수 */
    recordCount: number;
    /** 파서 버전 (향후 재처리용) */
    parseVersion: string;
}

export interface ScrapeRun {
    /** 실행 고유 ID */
    runId: string;
    /** 데이터 출처 */
    source: DataSource;
    /** 데이터 유형 */
    type: DataType;
    /** 실행 시작 시각 */
    startedAt: string;
    /** 실행 종료 시각 */
    endedAt?: string;
    /** 실행 상태 */
    status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
    /** 기준일 (D-1) */
    targetDate: string;
    /** 세무사 ID */
    taxAccountantId: string;
    /** 총 작업 수 */
    totalTasks: number;
    /** 성공 작업 수 */
    successTasks: number;
    /** 실패 작업 수 */
    failedTasks: number;
    /** 오류 요약 */
    errorSummary?: string;
    /** 스냅샷 파일 경로 */
    snapshotPath?: string;
}

// ========== Runs 관리 ==========

const RUNS_DIR = path.join(process.cwd(), 'data', 'meta');
const RUNS_FILE = path.join(RUNS_DIR, 'runs.json');

function loadRuns(): ScrapeRun[] {
    try {
        if (!fs.existsSync(RUNS_FILE)) return [];
        const content = fs.readFileSync(RUNS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
}

function saveRuns(runs: ScrapeRun[]): void {
    if (!fs.existsSync(RUNS_DIR)) {
        fs.mkdirSync(RUNS_DIR, { recursive: true });
    }
    fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf-8');
}

/**
 * 새 수집 실행(Run) 시작
 */
export function startRun(params: {
    source: DataSource;
    type: DataType;
    taxAccountantId: string;
    targetDate?: string;
}): ScrapeRun {
    const now = new Date();
    const runId = `run-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
    
    const run: ScrapeRun = {
        runId,
        source: params.source,
        type: params.type,
        startedAt: now.toISOString(),
        status: 'RUNNING',
        targetDate: params.targetDate || now.toISOString().slice(0, 10),
        taxAccountantId: params.taxAccountantId,
        totalTasks: 0,
        successTasks: 0,
        failedTasks: 0,
    };
    
    const runs = loadRuns();
    runs.push(run);
    saveRuns(runs);
    
    console.log(`[RawStorage] 수집 실행 시작: ${runId} (${params.source}/${params.type})`);
    return run;
}

/**
 * 수집 실행(Run) 완료 처리
 */
export function completeRun(runId: string, result: {
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    errorSummary?: string;
    snapshotPath?: string;
}): ScrapeRun | null {
    const runs = loadRuns();
    const runIndex = runs.findIndex(r => r.runId === runId);
    
    if (runIndex === -1) {
        console.error(`[RawStorage] Run을 찾을 수 없습니다: ${runId}`);
        return null;
    }
    
    runs[runIndex] = {
        ...runs[runIndex],
        endedAt: new Date().toISOString(),
        status: result.status,
        totalTasks: result.totalTasks,
        successTasks: result.successTasks,
        failedTasks: result.failedTasks,
        errorSummary: result.errorSummary,
        snapshotPath: result.snapshotPath,
    };
    
    saveRuns(runs);
    
    console.log(`[RawStorage] 수집 실행 완료: ${runId} (${result.status}, 성공: ${result.successTasks}/${result.totalTasks})`);
    return runs[runIndex];
}

/**
 * 최근 수집 실행 목록 조회
 */
export function listRuns(filter?: {
    source?: DataSource;
    type?: DataType;
    taxAccountantId?: string;
    limit?: number;
}): ScrapeRun[] {
    let runs = loadRuns();
    
    if (filter?.source) runs = runs.filter(r => r.source === filter.source);
    if (filter?.type) runs = runs.filter(r => r.type === filter.type);
    if (filter?.taxAccountantId) runs = runs.filter(r => r.taxAccountantId === filter.taxAccountantId);
    
    // 최신순 정렬
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    if (filter?.limit) runs = runs.slice(0, filter.limit);
    
    return runs;
}

/**
 * 특정 Run 조회
 */
export function getRun(runId: string): ScrapeRun | null {
    const runs = loadRuns();
    return runs.find(r => r.runId === runId) || null;
}

// ========== Raw 스냅샷 저장 ==========

/**
 * 페이로드 해시 생성 (중복 감지용)
 */
function createPayloadHash(payload: any): string {
    const content = JSON.stringify(payload);
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Raw 데이터 스냅샷 저장
 * 
 * @param source 데이터 출처 (hometax, wetax)
 * @param type 데이터 유형 (clients, reports)
 * @param rawPayload 원천 데이터 (그대로)
 * @param runId 연관된 수집 실행 ID
 * @param taxAccountantId 세무사 ID
 * @returns 저장된 스냅샷 정보
 */
export function saveRawSnapshot(params: {
    source: DataSource;
    type: DataType;
    rawPayload: any;
    runId: string;
    taxAccountantId: string;
    certPath?: string;
    parseVersion?: string;
}): RawSnapshot {
    const { source, type, rawPayload, runId, taxAccountantId, certPath, parseVersion } = params;
    
    // 디렉토리 생성: data/raw/{source}/{type}/
    const dir = path.join(RAW_BASE_DIR, source, type);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const snapshotId = `snap-${dateStr.replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
    
    // 레코드 수 계산
    let recordCount = 0;
    if (Array.isArray(rawPayload)) {
        recordCount = rawPayload.length;
    } else if (rawPayload && typeof rawPayload === 'object') {
        // 그룹화된 데이터의 경우 전체 합계
        const values = Object.values(rawPayload) as any[];
        const sum = values.reduce((acc: number, arr: any) => {
            if (Array.isArray(arr)) {
                return acc + arr.length;
            }
            return acc + 1;
        }, 0);
        recordCount = sum;
    }
    
    const snapshot: RawSnapshot = {
        snapshotId,
        runId,
        source,
        type,
        collectedAt: now.toISOString(),
        taxAccountantId,
        certPath,
        rawPayload,
        payloadHash: createPayloadHash(rawPayload),
        recordCount,
        parseVersion: parseVersion || '1.0.0',
    };
    
    // 파일명: {YYYY-MM-DD}_{runId}_{taxAccountantId}.json
    const safeAccountantId = taxAccountantId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 20);
    const filename = `${dateStr}_${runId}_${safeAccountantId}.json`;
    const filepath = path.join(dir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
    
    console.log(`[RawStorage] Raw 스냅샷 저장: ${filepath} (${recordCount}건, hash: ${snapshot.payloadHash})`);
    
    return snapshot;
}

/**
 * Raw 스냅샷 목록 조회
 */
export function listRawSnapshots(source: DataSource, type: DataType): string[] {
    const dir = path.join(RAW_BASE_DIR, source, type);
    if (!fs.existsSync(dir)) return [];
    
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse(); // 최신순
}

/**
 * Raw 스냅샷 읽기
 */
export function loadRawSnapshot(source: DataSource, type: DataType, filename: string): RawSnapshot | null {
    const filepath = path.join(RAW_BASE_DIR, source, type, filename);
    if (!fs.existsSync(filepath)) return null;
    
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

