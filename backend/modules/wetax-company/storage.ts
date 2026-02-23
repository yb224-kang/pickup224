/**
 * 위택스 거래처(사업장) 데이터 저장/조회
 * data/wetax-companies/index.json에 저장
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 프로젝트 내부 data 폴더에 저장
const STORE_DIR = path.join(process.cwd(), 'data', 'wetax-companies');
const INDEX_FILE = path.join(STORE_DIR, 'index.json');

export interface WetaxCompany {
    id: string;
    name: string;
    businessNumber: string;
    ceoName: string;
    address: string;
    industry: string;
    employeeCount: number;
    createdAt: string;
    updatedAt: string;
    
    // 담당자 정보
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    
    // 세무 관련
    taxAccountantId?: string;
    taxAccountantName?: string;
    
    // 위택스 원본 데이터
    _originalData?: any;
    
    // 기타 필드
    phone?: string;
    email?: string;
}

// Index 파일 타입
type CompanyIndex = Record<string, WetaxCompany>;

// Index 파일 로드
function loadIndex(): CompanyIndex {
    try {
        if (!fs.existsSync(INDEX_FILE)) {
            return {};
        }
        const content = fs.readFileSync(INDEX_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('[WetaxCompanyStorage] Index 파일 로드 실패:', error);
        return {};
    }
}

// Index 파일 저장
function saveIndex(index: CompanyIndex): void {
    try {
        if (!fs.existsSync(STORE_DIR)) {
            fs.mkdirSync(STORE_DIR, { recursive: true });
        }
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
        console.error('[WetaxCompanyStorage] Index 파일 저장 실패:', error);
        throw error;
    }
}

// 고유 ID 생성
function generateCompanyId(
    businessNumber: string,
    taxAccountantId: string,
    originalData?: any
): string {
    const baseTimestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    
    // 사업자번호 + 세무사ID + 타임스탬프 + 랜덤으로 고유 ID 생성
    const key = `${businessNumber || 'no-bizno'}-${taxAccountantId || 'no-tax'}-${baseTimestamp}-${randomBytes}`;
    return `wetax-company-${crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)}`;
}

/**
 * 위택스 거래처 저장 (단일)
 */
export async function saveWetaxCompany(
    data: Omit<WetaxCompany, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WetaxCompany> {
    const index = loadIndex();
    const now = new Date().toISOString();
    
    const companyId = generateCompanyId(
        data.businessNumber || '',
        data.taxAccountantId || '',
        data._originalData
    );
    
    const company: WetaxCompany = {
        id: companyId,
        ...data,
        createdAt: now,
        updatedAt: now,
    };
    
    index[companyId] = company;
    saveIndex(index);
    
    return company;
}

/**
 * 위택스 거래처 일괄 저장
 */
export async function saveWetaxCompanies(
    companies: Omit<WetaxCompany, 'id' | 'createdAt' | 'updatedAt'>[],
    options?: {
        updateExisting?: boolean;
    }
): Promise<WetaxCompany[]> {
    const index = loadIndex();
    const now = new Date().toISOString();
    const saved: WetaxCompany[] = [];
    const baseTimestamp = Date.now();
    
    console.log(`[saveWetaxCompanies] 시작: ${companies.length}개 위택스 거래처 저장 시도 (updateExisting: ${options?.updateExisting || false})`);
    
    const errors: Array<{ index: number; error: string; company: any }> = [];
    
    for (let i = 0; i < companies.length; i++) {
        try {
            const companyData = companies[i];
            
            const newBizNo = (companyData.businessNumber || '').trim();
            const taxAccountantId = companyData.taxAccountantId || '';
            
            let existingId: string | undefined;
            if (options?.updateExisting) {
                existingId = Object.keys(index).find(id => {
                    try {
                        const existing = index[id];
                        if (existing.taxAccountantId !== taxAccountantId) {
                            return false;
                        }
                        
                        const existingBizNo = (existing.businessNumber || '').trim();
                        
                        // 사업자번호로 비교
                        if (newBizNo && existingBizNo && newBizNo === existingBizNo) {
                            return true;
                        }
                        
                        return false;
                    } catch (e) {
                        console.error(`[saveWetaxCompanies] 기존 거래처 찾기 중 오류 (index ${i}):`, e);
                        return false;
                    }
                });
            }
            
            if (existingId && options?.updateExisting) {
                // 기존 거래처 업데이트
                const existing = index[existingId];
                const updated: WetaxCompany = {
                    ...existing,
                    ...companyData,
                    createdAt: existing.createdAt,
                    updatedAt: now,
                    _originalData: companyData._originalData || existing._originalData,
                };
                index[existingId] = updated;
                saved.push(updated);
                console.log(`[saveWetaxCompanies] 업데이트: ${existingId} (${companyData.name || companyData.businessNumber || '식별자 없음'})`);
            } else {
                // 신규 추가
                const uniqueId = `wetax-company-${baseTimestamp}-${i}-${crypto.randomBytes(8).toString('hex')}`;
                const company: WetaxCompany = {
                    id: uniqueId,
                    ...companyData,
                    createdAt: now,
                    updatedAt: now,
                };
                index[uniqueId] = company;
                saved.push(company);
                console.log(`[saveWetaxCompanies] 신규 추가: ${uniqueId} (${companyData.name || companyData.businessNumber || '식별자 없음'})`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[saveWetaxCompanies] 거래처 처리 실패 (index ${i}):`, errorMsg);
            errors.push({
                index: i,
                error: errorMsg,
                company: companies[i]
            });
        }
    }
    
    if (errors.length > 0) {
        console.error(`[saveWetaxCompanies] ⚠️ ${errors.length}개 거래처 처리 실패:`);
        errors.forEach(e => {
            const company = e.company;
            const name = company?.name || '이름 없음';
            const bizNo = company?.businessNumber || '사업자번호 없음';
            console.error(`  [실패 #${e.index}] ${name} (사업자번호: ${bizNo}) - 오류: ${e.error}`);
        });
    }
    
    const actualSavedCount = Object.keys(index).length;
    console.log(`[saveWetaxCompanies] ✅ 처리 완료: ${saved.length}개 처리, ${errors.length}개 실패, index 크기: ${actualSavedCount}개`);
    
    try {
        saveIndex(index);
        console.log(`[saveWetaxCompanies] 파일 저장 완료: ${Object.keys(index).length}개`);
    } catch (error) {
        console.error(`[saveWetaxCompanies] 파일 저장 실패:`, error);
        throw error;
    }
    
    return saved;
}

/**
 * 위택스 거래처 조회 (단일)
 */
export async function getWetaxCompany(id: string): Promise<WetaxCompany | null> {
    const index = loadIndex();
    return index[id] || null;
}

/**
 * 위택스 거래처 목록 조회
 */
export async function listWetaxCompanies(taxAccountantId?: string): Promise<WetaxCompany[]> {
    const index = loadIndex();
    const companies = Object.values(index);
    
    if (taxAccountantId) {
        return companies.filter(c => c.taxAccountantId === taxAccountantId);
    }
    
    return companies;
}

/**
 * 위택스 거래처 수정
 */
export async function updateWetaxCompany(
    id: string,
    data: Partial<WetaxCompany>
): Promise<WetaxCompany | null> {
    const index = loadIndex();
    const existing = index[id];
    
    if (!existing) {
        return null;
    }
    
    const updated: WetaxCompany = {
        ...existing,
        ...data,
        id: existing.id, // ID는 변경 불가
        createdAt: existing.createdAt, // 생성일은 변경 불가
        updatedAt: new Date().toISOString(),
    };
    
    index[id] = updated;
    saveIndex(index);
    
    return updated;
}

/**
 * 위택스 거래처 삭제
 */
export async function deleteWetaxCompany(id: string): Promise<boolean> {
    const index = loadIndex();
    
    if (!index[id]) {
        return false;
    }
    
    delete index[id];
    saveIndex(index);
    
    return true;
}


