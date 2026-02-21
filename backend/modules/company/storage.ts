/**
 * 거래처(사업장) 데이터 저장/조회
 * data/companies/index.json에 저장
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 프로젝트 내부 data 폴더에 저장
const STORE_DIR = path.join(process.cwd(), 'data', 'companies');
const INDEX_FILE = path.join(STORE_DIR, 'index.json');

export interface Company {
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
    
    // 급여 관련
    salaryCalculationPeriod?: string;
    salaryPaymentDate?: string;
    
    // 세무 관련
    taxAccountantName?: string;
    taxAccountantPhone?: string;
    taxAccountantEmail?: string;
    taxFirmName?: string;
    taxFirmEmail?: string;
    
    // AUTO PW 확장 필드
    establishedDate?: string;
    phone?: string;
    email?: string;
    website?: string;
    
    // 재무 정보
    year1Revenue?: number;
    year2Revenue?: number;
    year3Revenue?: number;
    revenueGrowth?: boolean;
    
    // 고용/보험 정보
    hasInsurance?: boolean;
    
    // 정책 정보
    creditRating?: string;
    hasPolicyFunding?: boolean;
    hasGovernmentSupport?: boolean;
    supportDetails?: string;
    
    // 홈택스 연동 정보
    taxAccountantId?: string; // 연동된 세무사 ID
    _engagementStatus?: '수임중' | '해지중' | '미동의'; // 수임 상태
    _originalData?: any; // 원본 홈택스 데이터
}

/**
 * 인덱스 파일 로드
 */
function loadIndex(): Record<string, Company> {
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
function saveIndex(index: Record<string, Company>): void {
    try {
        // 디렉토리 생성
        if (!fs.existsSync(STORE_DIR)) {
            fs.mkdirSync(STORE_DIR, { recursive: true });
        }
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
    } catch (error) {
        console.error(`[saveIndex] 파일 저장 실패:`, error);
        throw new Error(`거래처 데이터 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * 사업자번호 + 세무사ID + 상태로 고유 ID 생성 (중복 방지)
 * 수임중과 해임중에 동시에 있는 거래처도 각각 별도 레코드로 저장
 * 사업자번호가 없는 경우 원본 데이터의 고유 식별자 사용
 */
function generateCompanyId(
    businessNumber: string, 
    taxAccountantId?: string,
    engagementStatus?: string,
    originalData?: any
): string {
    // 사업자번호 + 세무사ID + 상태 조합으로 고유 ID 생성
    const status = engagementStatus || '수임중'; // 기본값
    
    let uniqueKey: string;
    if (businessNumber && businessNumber.trim()) {
        // 사업자번호가 있으면 사업자번호 사용
        uniqueKey = businessNumber.replace(/-/g, '');
    } else {
        // 사업자번호가 없으면 원본 데이터에서 고유 식별자 찾기
        // 우선순위: afaBmanTin > rprsTin > 이름+대표자명
        const afaBmanTin = originalData?.afaBmanTin || originalData?.afaBmanTin || '';
        const rprsTin = originalData?.rprsTin || originalData?.rprsTin || '';
        const name = originalData?.fnm || originalData?.tnmNm || '';
        const repName = originalData?.txprNm || originalData?.rprsTxprNm || '';
        
        if (afaBmanTin && afaBmanTin.trim()) {
            uniqueKey = `tin_${afaBmanTin}`;
        } else if (rprsTin && rprsTin.trim()) {
            uniqueKey = `rprs_${rprsTin}`;
        } else {
            // 최후의 수단: 이름 + 대표자명 조합
            uniqueKey = `name_${name}_${repName}`;
        }
    }
    
    const base = uniqueKey + (taxAccountantId || '') + status;
    const hash = crypto.createHash('sha256').update(base).digest('hex').substring(0, 16);
    return `company-${hash}`;
}

/**
 * 거래처 저장 (조회한 데이터를 그대로 모두 저장)
 * 중복 체크 없이 모든 조회 결과를 그대로 저장
 */
export async function saveCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const index = loadIndex();
    
    // 상태 결정 (원본 데이터 우선)
    const engagementStatus = data._engagementStatus || 
                             (data._originalData?.ofbDt ? '해지중' : '수임중');
    
    const now = new Date().toISOString();
    
    // 중복 체크 없이 항상 새 레코드 생성
    // 타임스탬프 + 랜덤으로 고유 ID 생성
    const uniqueId = `company-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    const company: Company = {
        id: uniqueId,
        ...data,
        _engagementStatus: engagementStatus, // 상태 명시적으로 저장
        createdAt: now,
        updatedAt: now,
    };
    
    index[uniqueId] = company;
    saveIndex(index);
    return company;
}

/**
 * 거래처 일괄 저장 (재조회 시 업데이트 지원)
 * 같은 거래처를 찾을 때:
 * - 사업자번호가 있으면: 사업자번호 + 세무사ID + 상태
 * - 사업자번호가 없으면: 주민번호(resno, 마스킹 제거) + 세무사ID + 상태
 */
export async function saveCompanies(
    companies: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>[],
    options?: {
        updateExisting?: boolean; // 기존 거래처 업데이트 여부
    }
): Promise<Company[]> {
    // 한 번만 파일 읽기
    const index = loadIndex();
    const now = new Date().toISOString();
    const saved: Company[] = [];
    const baseTimestamp = Date.now();
    
    console.log(`[saveCompanies] 시작: ${companies.length}개 거래처 저장 시도 (updateExisting: ${options?.updateExisting || false})`);
    
    const errors: Array<{ index: number; error: string; company: any }> = [];
    // 같은 조회 세션 내에서 이미 처리된 거래처 추적 (같은 세션 내에서 같은 거래처가 여러 번 나올 때 중복 업데이트 방지)
    const processedInSession = new Set<string>(); // 처리된 거래처의 existingId 또는 uniqueId
    
    // 모든 거래처 처리
    for (let i = 0; i < companies.length; i++) {
        try {
            const companyData = companies[i];
            
            // 상태 결정 (원본 데이터 우선)
            const engagementStatus = companyData._engagementStatus || 
                                     (companyData._originalData?.ofbDt ? '해지중' : '수임중');
            
            // 식별자 추출 (기존 거래처 찾기용)
            const newBizNo = (companyData.businessNumber || '').trim();
            const newResno = (companyData._originalData?.resno || '').trim().replace(/\*/g, '').replace(/-/g, '');
            
            // 재조회 시에만 기존 거래처 찾기 (파일에서 읽은 데이터와 비교)
            // 같은 조회 세션 내에서 중복 허용: 기존 거래처를 찾지 못한 경우 신규 추가
            let existingId: string | undefined;
            if (options?.updateExisting) {
                existingId = Object.keys(index).find(id => {
                    try {
                        const existing = index[id];
                        const existingStatus = existing._engagementStatus || 
                                             (existing._originalData?.ofbDt ? '해지중' : '수임중');
                        
                        // 세무사ID와 상태가 일치해야 함
                        if (existing.taxAccountantId !== companyData.taxAccountantId || 
                            existingStatus !== engagementStatus) {
                            return false;
                        }
                        
                        // 재조회 시에는 processedInSession 체크하지 않음
                        // 같은 조회 세션 내에서 같은 거래처가 여러 번 나와도 기존 거래처를 찾아서 업데이트
                        
                        // 식별자 비교: bsno + afaDt + resno 조합으로 고유 식별
                        const existingBizNo = (existing.businessNumber || '').trim();
                        const existingResno = (existing._originalData?.resno || '').trim().replace(/\*/g, '').replace(/-/g, '');
                        const existingAfaDt = (existing._originalData?.afaDt || '').trim();
                        const newAfaDt = (companyData._originalData?.afaDt || '').trim();
                        
                        // 사업자번호가 있는 경우: bsno + afaDt + resno 로 비교
                        if (newBizNo && existingBizNo) {
                            if (newBizNo !== existingBizNo) return false;
                            // 같은 사업자번호 → afaDt와 resno까지 비교하여 고유 식별
                            if (newAfaDt && existingAfaDt && newAfaDt !== existingAfaDt) return false;
                            if (newResno && existingResno && newResno !== existingResno) return false;
                            return true;
                        }
                        
                        // 사업자번호가 없는 경우: 주민번호 + afaDt 로 비교
                        if (!newBizNo && !existingBizNo && newResno && existingResno && newResno.length >= 6 && existingResno.length >= 6) {
                            if (newResno !== existingResno) return false;
                            if (newAfaDt && existingAfaDt && newAfaDt !== existingAfaDt) return false;
                            return true;
                        }
                        
                        // 둘 다 없는 경우: 다른 식별자로 비교 (afaBmanTin, rprsTin 등)
                        if (!newBizNo && !existingBizNo && (!newResno || !existingResno)) {
                            const newAfaBmanTin = (companyData._originalData?.afaBmanTin || '').trim();
                            const existingAfaBmanTin = (existing._originalData?.afaBmanTin || '').trim();
                            if (newAfaBmanTin && existingAfaBmanTin && newAfaBmanTin === existingAfaBmanTin) {
                                return true;
                            }
                            
                            const newRprsTin = (companyData._originalData?.rprsTin || '').trim();
                            const existingRprsTin = (existing._originalData?.rprsTin || '').trim();
                            if (newRprsTin && existingRprsTin && newRprsTin === existingRprsTin) {
                                return true;
                            }
                        }
                        
                        return false;
                    } catch (e) {
                        console.error(`[saveCompanies] 기존 거래처 찾기 중 오류 (index ${i}):`, e);
                        return false;
                    }
                });
            }
            
            if (existingId && options?.updateExisting) {
                // 재조회 시: 기존 거래처 업데이트
                // 같은 조회 세션 내에서 이미 업데이트한 거래처는 다시 업데이트하지 않음
                // 하지만 모든 거래처는 처리되어야 하므로, 업데이트는 하되 saved에는 한 번만 추가
                if (processedInSession.has(existingId)) {
                    // 이미 이 세션에서 처리된 거래처는 업데이트만 하고 saved에는 추가하지 않음
                    const existing = index[existingId];
                    const updated: Company = {
                        ...existing,
                        ...companyData,
                        createdAt: existing.createdAt,
                        updatedAt: now,
                        _originalData: companyData._originalData || existing._originalData,
                        _engagementStatus: engagementStatus,
                    };
                    index[existingId] = updated;
                    console.log(`[saveCompanies] 중복 업데이트 (건너뛰기): ${existingId} (${companyData.name || companyData.businessNumber || companyData._originalData?.resno || '식별자 없음'})`);
                } else {
                    // 첫 번째로 처리되는 거래처: 업데이트하고 saved에 추가
                    const existing = index[existingId];
                    const updated: Company = {
                        ...existing,
                        ...companyData,
                        // createdAt은 유지, updatedAt은 갱신
                        createdAt: existing.createdAt,
                        updatedAt: now,
                        // 원본 데이터는 최신 것으로 업데이트
                        _originalData: companyData._originalData || existing._originalData,
                        _engagementStatus: engagementStatus,
                    };
                    index[existingId] = updated;
                    saved.push(updated);
                    processedInSession.add(existingId);
                    console.log(`[saveCompanies] 업데이트: ${existingId} (${companyData.name || companyData.businessNumber || companyData._originalData?.resno || '식별자 없음'})`);
                }
            } else {
                // 기존 거래처를 찾지 못한 경우: 신규 추가 (같은 조회 세션 내에서 중복 허용)
                const uniqueId = `company-${baseTimestamp}-${i}-${crypto.randomBytes(8).toString('hex')}`;
                const company: Company = {
                    id: uniqueId,
                    ...companyData,
                    _engagementStatus: engagementStatus,
                    createdAt: now,
                    updatedAt: now,
                };
                index[uniqueId] = company;
                saved.push(company);
                processedInSession.add(uniqueId);
                console.log(`[saveCompanies] 신규 추가: ${uniqueId} (${companyData.name || companyData.businessNumber || companyData._originalData?.resno || '식별자 없음'})`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[saveCompanies] 거래처 처리 실패 (index ${i}):`, errorMsg);
            errors.push({
                index: i,
                error: errorMsg,
                company: companies[i]
            });
            // 에러가 발생해도 계속 진행
        }
    }
    
    // 에러가 발생한 경우 상세 로그 출력
    if (errors.length > 0) {
        console.error(`[saveCompanies] ⚠️ ${errors.length}개 거래처 처리 실패:`);
        errors.forEach(e => {
            const company = e.company;
            const name = company?.name || company?._originalData?.tnmNm || '이름 없음';
            const bizNo = company?.businessNumber || company?._originalData?.bsno || '사업자번호 없음';
            const resno = company?._originalData?.resno || '주민번호 없음';
            console.error(`  [실패 #${e.index}] ${name} (사업자번호: ${bizNo}, 주민번호: ${resno}) - 오류: ${e.error}`);
        });
    }
    
    // 실제 저장된 개수는 index의 크기로 확인 (중복 제거하지 않음)
    const actualSavedCount = Object.keys(index).length;
    const beforeCount = Object.keys(loadIndex()).length; // 저장 전 개수 (다시 로드)
    const newlyAddedCount = actualSavedCount - beforeCount + saved.filter(c => {
        // 업데이트된 거래처는 제외 (이미 존재했던 것)
        const existing = loadIndex()[c.id];
        return !existing || existing.createdAt !== c.createdAt;
    }).length;
    
    console.log(`[saveCompanies] ✅ 처리 완료: ${saved.length}개 처리, ${errors.length}개 실패, index 크기: ${actualSavedCount}개`);
    
    // 저장된 개수와 입력 개수 비교
    if (saved.length + errors.length !== companies.length) {
        console.warn(`[saveCompanies] ⚠️ 경고: 입력 ${companies.length}개, 처리 ${saved.length}개, 실패 ${errors.length}개 - 합계 불일치!`);
        console.warn(`[saveCompanies] 누락된 개수: ${companies.length - saved.length - errors.length}개`);
    } else {
        console.log(`[saveCompanies] ✅ 모든 거래처 처리 완료: 처리 ${saved.length}개, 실패 ${errors.length}개`);
    }
    
    // 마지막에 한 번만 파일에 쓰기
    try {
        saveIndex(index);
        console.log(`[saveCompanies] 파일 저장 완료: ${Object.keys(index).length}개`);
    } catch (error) {
        console.error(`[saveCompanies] 파일 저장 실패:`, error);
        throw error; // 파일 저장 실패는 치명적이므로 예외 전파
    }
    
    // 에러가 있었지만 일부는 저장된 경우 경고
    if (errors.length > 0 && saved.length > 0) {
        console.warn(`[saveCompanies] 경고: ${saved.length}개는 저장되었지만 ${errors.length}개는 실패했습니다.`);
    }
    
    return saved;
}

/**
 * 거래처 조회
 */
export async function getCompany(id: string): Promise<Company | null> {
    const index = loadIndex();
    return index[id] || null;
}

/**
 * 거래처 목록 조회
 */
export async function listCompanies(taxAccountantId?: string): Promise<Company[]> {
    const index = loadIndex();
    let companies = Object.values(index);
    
    // 세무사별 필터링
    if (taxAccountantId) {
        companies = companies.filter(c => c.taxAccountantId === taxAccountantId);
    }
    
    // 최신순 정렬
    return companies.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 거래처 정보 수정
 */
export async function updateCompany(
    id: string,
    data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Company | null> {
    const index = loadIndex();
    const existing = index[id];
    
    if (!existing) {
        return null;
    }
    
    const updated: Company = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
    };
    
    index[id] = updated;
    saveIndex(index);
    
    return updated;
}

/**
 * 거래처 삭제
 */
export async function deleteCompany(id: string): Promise<boolean> {
    const index = loadIndex();
    
    if (!index[id]) {
        return false;
    }
    
    delete index[id];
    saveIndex(index);
    
    return true;
}

