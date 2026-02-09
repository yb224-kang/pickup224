/**
 * 1. 인증서 조회 (기본조회)
 * NPKI 기본 경로에서만 인증서를 검색합니다.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface CertificateBasicInfo {
    type: 'der+key' | 'p12' | 'pfx';
    path: string;
    keyPath?: string;
    name: string;
    size: number;
    modified: Date;
}

const SEARCH_PATHS: Record<string, string[]> = {
    darwin: [
        path.join(os.homedir(), 'Library/Preferences/NPKI'),
        path.join(os.homedir(), '.npki'),
        path.join(os.homedir(), 'npki'),
    ],
    win32: [
        path.join(os.homedir(), 'AppData/LocalLow/NPKI'),
        path.join(os.homedir(), 'AppData/Local/NPKI'),
        'C:\\Program Files\\INISAFE CrossWeb EX\\UserData\\NPKI',
    ],
    linux: [
        path.join(os.homedir(), '.npki'),
        path.join(os.homedir(), 'npki'),
    ],
};

const EXCLUDED_DIRS = new Set([
    'node_modules', '.git', '.npm', '.cache', '.vscode', '.idea',
    'Library/Caches', 'Library/Logs', 'Library/Application Support/Google',
    'AppData/Local/Temp', 'AppData/Roaming/npm',
    '.Trash', '$RECYCLE.BIN', 'System Volume Information'
]);

const MAX_DEPTH = 4;

/**
 * 기본 경로에서 인증서 파일 경로만 검색 (메타데이터 추출 없음)
 * @returns 인증서 기본 정보 배열
 */
export async function discoverCertificatesBasic(): Promise<CertificateBasicInfo[]> {
    const platform = os.platform();
    const pathsToSearch = SEARCH_PATHS[platform] || SEARCH_PATHS['linux'];
    
    const foundCerts: CertificateBasicInfo[] = [];
    const seenPaths = new Set<string>();
    
    for (const searchPath of pathsToSearch) {
        if (fs.existsSync(searchPath)) {
            scanDirectory(searchPath, foundCerts, seenPaths, 0);
        }
    }
    
    // 중복 제거
    const unique = new Map<string, CertificateBasicInfo>();
    for (const cert of foundCerts) {
        unique.set(cert.path, cert);
    }
    
    return Array.from(unique.values());
}

function scanDirectory(
    dir: string,
    foundCerts: CertificateBasicInfo[],
    seenPaths: Set<string>,
    depth: number = 0
): void {
    if (depth > MAX_DEPTH) return;
    
    const dirName = path.basename(dir);
    if (EXCLUDED_DIRS.has(dirName)) return;
    
    if (seenPaths.has(dir)) return;
    seenPaths.add(dir);
    
    try {
        const files = fs.readdirSync(dir);
        
        // DER+KEY 형식 검색
        if (files.includes('signCert.der')) {
            const derPath = path.join(dir, 'signCert.der');
            const keyPath = path.join(dir, 'signPri.key');
            
            if (fs.existsSync(keyPath)) {
                const stats = fs.statSync(derPath);
                const name = path.basename(dir);
                foundCerts.push({
                    type: 'der+key',
                    path: derPath,
                    keyPath: keyPath,
                    name: name.includes('cn=') ? name.split(',')[0].replace('cn=', '') : name,
                    size: stats.size,
                    modified: stats.mtime,
                });
            }
        }
        
        // P12/PFX 파일 검색
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                scanDirectory(fullPath, foundCerts, seenPaths, depth + 1);
            } else if (file.endsWith('.p12') || file.endsWith('.pfx')) {
                if (stats.size > 500) {
                    foundCerts.push({
                        type: file.endsWith('.p12') ? 'p12' : 'pfx',
                        path: fullPath,
                        name: file,
                        size: stats.size,
                        modified: stats.mtime,
                    });
                }
            }
        }
    } catch (e) {
        // 권한 오류 등 무시
    }
}

