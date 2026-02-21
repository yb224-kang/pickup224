/**
 * 세무사 데이터 저장/조회
 * data/tax-accountants/index.json에 저장
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 프로젝트 내부 data 폴더에 저장
const STORE_DIR = path.join(process.cwd(), 'data', 'tax-accountants');
const INDEX_FILE = path.join(STORE_DIR, 'index.json');

export interface TaxAccountant {
    id: string;
    name: string;
    representative?: string;
    certificateHash?: string;
    certificatePath?: string;
    status: 'connected' | 'pending' | 'disconnected';
    connectedAt?: string;
    autoSync: boolean;
    metadata?: {
        txaaAdmNo?: string;
        txaaId?: string;
        phone?: string;
        email?: string;
        address?: string;
    };
    createdAt: string;
    updatedAt: string;
}

/**
 * 인덱스 파일 로드
 */
function loadIndex(): Record<string, TaxAccountant> {
    if (!fs.existsSync(INDEX_FILE)) {
        return {};
    }
    try {
        const content = fs.readFileSync(INDEX_FILE, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        return {};
    }
}

/**
 * 인덱스 파일 저장
 */
function saveIndex(index: Record<string, TaxAccountant>): void {
    // 디렉토리 생성
    if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * 세무사 저장
 */
export async function saveTaxAccountant(data: Omit<TaxAccountant, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaxAccountant> {
    const index = loadIndex();
    const id = generateId();
    const now = new Date().toISOString();
    
    const taxAccountant: TaxAccountant = {
        id,
        ...data,
        createdAt: now,
        updatedAt: now,
    };
    
    index[id] = taxAccountant;
    saveIndex(index);
    
    return taxAccountant;
}

/**
 * 세무사 조회
 */
export async function getTaxAccountant(id: string): Promise<TaxAccountant | null> {
    const index = loadIndex();
    return index[id] || null;
}

/**
 * 세무사 목록 조회
 */
export async function listTaxAccountants(): Promise<TaxAccountant[]> {
    const index = loadIndex();
    return Object.values(index).sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 세무사 정보 수정
 */
export async function updateTaxAccountant(
    id: string,
    data: Partial<Omit<TaxAccountant, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<TaxAccountant | null> {
    const index = loadIndex();
    const existing = index[id];
    
    if (!existing) {
        return null;
    }
    
    const updated: TaxAccountant = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
    };
    
    index[id] = updated;
    saveIndex(index);
    
    return updated;
}

/**
 * 세무사 삭제
 */
export async function deleteTaxAccountant(id: string): Promise<boolean> {
    const index = loadIndex();
    
    if (!index[id]) {
        return false;
    }
    
    delete index[id];
    saveIndex(index);
    
    return true;
}

/**
 * 인증서 연동
 */
export async function linkCertificate(
    taxAccountantId: string,
    certificateHash: string,
    certificatePath?: string
): Promise<TaxAccountant | null> {
    const index = loadIndex();
    const taxAccountant = index[taxAccountantId];
    
    if (!taxAccountant) {
        return null;
    }
    
    const updated: TaxAccountant = {
        ...taxAccountant,
        certificateHash,
        certificatePath: certificatePath || taxAccountant.certificatePath,
        status: 'connected',
        connectedAt: taxAccountant.connectedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    index[taxAccountantId] = updated;
    saveIndex(index);
    
    return updated;
}

