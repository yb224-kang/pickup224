/**
 * 2. 인증서 조회 (세부조회)
 * 기본 경로 + 시스템 경로(Desktop, Documents, Downloads)에서 인증서를 검색합니다.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { discoverCertificatesBasic, CertificateBasicInfo } from './basic';

const SYSTEM_PATHS: Record<string, string[]> = {
    darwin: [
        path.join(os.homedir(), 'Desktop'),
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Downloads'),
    ],
    win32: [
        path.join(os.homedir(), 'Desktop'),
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Downloads'),
    ],
    linux: [
        path.join(os.homedir(), 'Desktop'),
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Downloads'),
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
 * 세부 조회: 기본 경로 + 시스템 경로에서 인증서 검색
 * @returns 인증서 기본 정보 배열
 */
export async function discoverCertificatesDetailed(): Promise<CertificateBasicInfo[]> {
    const basicCerts = await discoverCertificatesBasic();
    const platform = os.platform();
    const systemPaths = SYSTEM_PATHS[platform] || SYSTEM_PATHS['linux'];
    
    const systemCerts: CertificateBasicInfo[] = [];
    const seenPaths = new Set<string>();
    
    for (const searchPath of systemPaths) {
        if (fs.existsSync(searchPath)) {
            scanSystemDirectory(searchPath, systemCerts, seenPaths, 0);
        }
    }
    
    // 중복 제거
    const allCerts = [...basicCerts, ...systemCerts];
    const unique = new Map<string, CertificateBasicInfo>();
    for (const cert of allCerts) {
        unique.set(cert.path, cert);
    }
    
    return Array.from(unique.values());
}

function scanSystemDirectory(
    dir: string,
    foundCerts: CertificateBasicInfo[],
    seenPaths: Set<string>,
    depth: number = 0
): void {
    if (depth > MAX_DEPTH) return;
    if (seenPaths.has(dir)) return;
    seenPaths.add(dir);
    
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                scanSystemDirectory(fullPath, foundCerts, seenPaths, depth + 1);
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
        // 무시
    }
}

