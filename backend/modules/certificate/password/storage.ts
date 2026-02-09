/**
 * 6. 인증서 비밀번호 입력/저장
 * 인증서 비밀번호를 안전하게 저장합니다.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 프로젝트 내부 data 폴더에 저장
const PASSWORD_STORE_DIR = path.join(process.cwd(), 'data', 'certificates-passwords');
const INDEX_FILE = path.join(PASSWORD_STORE_DIR, 'index.json');
const ENCRYPTION_KEY = process.env.AXCEL_ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * 인덱스 파일 로드
 */
function loadIndex(): Record<string, { path: string; name: string; savedAt: string }> {
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
function saveIndex(index: Record<string, { path: string; name: string; savedAt: string }>): void {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * 인증서 이름 추출 (경로에서)
 */
function extractCertName(certPath: string): string {
    const basename = path.basename(certPath);
    // .p12, .pfx, .der 확장자 제거
    return basename.replace(/\.(p12|pfx|der)$/i, '');
}

/**
 * 인증서 비밀번호 저장
 */
export async function saveCertificatePassword(
    certPath: string,
    password: string
): Promise<void> {
    // 저장소 디렉토리 생성
    if (!fs.existsSync(PASSWORD_STORE_DIR)) {
        fs.mkdirSync(PASSWORD_STORE_DIR, { recursive: true });
    }
    
    // 인증서 경로를 해시하여 파일명 생성
    const hash = crypto.createHash('sha256').update(certPath).digest('hex');
    const passwordFile = path.join(PASSWORD_STORE_DIR, `${hash}.pwd`);
    
    // 비밀번호 암호화
    const encrypted = encryptPassword(password);
    
    // 비밀번호 파일 저장
    fs.writeFileSync(passwordFile, encrypted, 'utf8');
    
    // 인덱스에 메타데이터 저장 (인증서 경로와 이름 매핑)
    const index = loadIndex();
    index[hash] = {
        path: certPath,
        name: extractCertName(certPath),
        savedAt: new Date().toISOString()
    };
    saveIndex(index);
}

/**
 * 인증서 비밀번호 조회
 */
export async function getCertificatePassword(certPath: string): Promise<string | null> {
    const hash = crypto.createHash('sha256').update(certPath).digest('hex');
    const passwordFile = path.join(PASSWORD_STORE_DIR, `${hash}.pwd`);
    
    if (!fs.existsSync(passwordFile)) {
        return null;
    }
    
    try {
        const encrypted = fs.readFileSync(passwordFile, 'utf8');
        return decryptPassword(encrypted);
    } catch (e) {
        return null;
    }
}

/**
 * 인증서 비밀번호 삭제
 */
export async function deleteCertificatePassword(certPath: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(certPath).digest('hex');
    const passwordFile = path.join(PASSWORD_STORE_DIR, `${hash}.pwd`);
    
    if (fs.existsSync(passwordFile)) {
        fs.unlinkSync(passwordFile);
    }
    
    // 인덱스에서도 제거
    const index = loadIndex();
    if (index[hash]) {
        delete index[hash];
        saveIndex(index);
    }
}

/**
 * 저장된 모든 인증서 비밀번호 목록 조회
 */
export async function listSavedCertificates(): Promise<Array<{ hash: string; path: string; name: string; savedAt: string }>> {
    const index = loadIndex();
    return Object.entries(index).map(([hash, data]) => ({
        hash,
        ...data
    }));
}

/**
 * 해시로 인증서 경로 조회
 */
export async function getCertPathByHash(hash: string): Promise<string | null> {
    const index = loadIndex();
    return index[hash]?.path || null;
}

function encryptPassword(password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
}

function decryptPassword(encrypted: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

