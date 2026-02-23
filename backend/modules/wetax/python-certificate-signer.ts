/**
 * 위택스용 Python 기반 CertificateSigner 구현
 * pypinksign을 사용하여 PKCS7 서명 생성
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// 위택스 모듈 인터페이스 타입 정의 (rootDir 문제 해결을 위해 직접 정의)
export interface CertFile {
  name: string;
  data: Buffer;
}

/**
 * 인증서 데이터 인터페이스
 */
export interface CertificateData {
  certFilename: string;
  certFileData: Buffer | Uint8Array | string;
  certPassword: string;
  keyFileData?: Buffer | Uint8Array | string;
  keyFilename?: string;
}

export interface CertificateSigner {
  loadCert(files: CertFile[], password: string): CertificateSignerInstance;
}

export interface CertificateSignerInstance {
  validateCertExpiry(): void;
  pkcs7SignedMsg(message: Buffer): Buffer;
}

export class PythonCertificateSigner implements CertificateSigner {
  private readonly pythonScriptPath: string;
  
  constructor() {
    // Python 스크립트 경로 (컴파일된 파일 기준으로 소스 경로 찾기)
    // __dirname이 dist/modules/wetax일 때, backend/modules/wetax로 변환
    const distPath = __dirname;
    // dist/modules/wetax -> backend/modules/wetax
    const backendPath = distPath.replace(/[\\/]dist[\\/]modules[\\/]wetax$/, '/backend/modules/wetax');
    this.pythonScriptPath = path.join(backendPath, 'certificate-signer.py');
    
    // 만약 위 방법이 실패하면 프로젝트 루트 기준으로 시도
    if (!fs.existsSync(this.pythonScriptPath)) {
      const projectRoot = path.join(distPath, '../../../..');
      const altPath = path.join(projectRoot, 'backend/modules/wetax/certificate-signer.py');
      if (fs.existsSync(altPath)) {
        this.pythonScriptPath = altPath;
      } else {
        throw new Error(`Python 스크립트를 찾을 수 없습니다. 시도한 경로:\n  - ${this.pythonScriptPath}\n  - ${altPath}`);
      }
    }
  }
  
  loadCert(files: CertFile[], password: string): CertificateSignerInstance {
    if (files.length === 0) {
      throw new Error('인증서 파일이 필요합니다');
    }
    
    return new PythonCertificateSignerInstance(files[0], password, this.pythonScriptPath);
  }
}

class PythonCertificateSignerInstance implements CertificateSignerInstance {
  private tempCertPath: string | null = null;
  
  constructor(
    private certFile: CertFile,
    private password: string,
    private scriptPath: string
  ) {
    // 임시 인증서 파일 저장
    this.tempCertPath = this.saveTempCert();
  }
  
  validateCertExpiry(): void {
    if (!this.tempCertPath) {
      throw new Error('인증서 파일이 준비되지 않았습니다');
    }
    
    try {
      const result = execSync(
        `python3 "${this.scriptPath}" validate "${this.tempCertPath}" "${this.password}"`,
        { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024 // 10MB
        }
      );
      
      const response = JSON.parse(result.trim());
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.status !== 'OK') {
        throw new Error('인증서 만료일 검증 실패');
      }
    } catch (error: any) {
      // stderr에서 에러 메시지 추출 시도
      if (error.stderr) {
        try {
          const stderrJson = JSON.parse(error.stderr);
          if (stderrJson.error) {
            throw new Error(stderrJson.error);
          }
        } catch {
          // JSON 파싱 실패 시 원본 에러 사용
        }
      }
      throw new Error(`인증서 만료일 검증 실패: ${error.message || error}`);
    }
  }
  
  pkcs7SignedMsg(message: Buffer): Buffer {
    if (!this.tempCertPath) {
      throw new Error('인증서 파일이 준비되지 않았습니다');
    }
    
    const messageBase64 = message.toString('base64');
    
    try {
      const result = execSync(
        `python3 "${this.scriptPath}" sign "${this.tempCertPath}" "${this.password}" "${messageBase64}"`,
        { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024 // 10MB
        }
      );
      
      const response = JSON.parse(result.trim());
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (!response.signed) {
        throw new Error('PKCS7 서명 생성 실패: 응답에 서명 데이터가 없습니다');
      }
      
      return Buffer.from(response.signed, 'base64');
    } catch (error: any) {
      // stderr에서 에러 메시지 추출 시도
      if (error.stderr) {
        try {
          const stderrJson = JSON.parse(error.stderr);
          if (stderrJson.error) {
            throw new Error(stderrJson.error);
          }
        } catch {
          // JSON 파싱 실패 시 원본 에러 사용
        }
      }
      throw new Error(`PKCS7 서명 생성 실패: ${error.message || error}`);
    } finally {
      // 정리: 임시 파일 삭제는 인스턴스 소멸 시 처리
    }
  }
  
  private saveTempCert(): string {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPath = path.join(tempDir, `cert-${Date.now()}-${Math.random().toString(36).substring(7)}.${this.getCertExtension()}`);
    fs.writeFileSync(tempPath, this.certFile.data);
    return tempPath;
  }
  
  private getCertExtension(): string {
    const name = this.certFile.name.toLowerCase();
    if (name.endsWith('.p12')) return 'p12';
    if (name.endsWith('.pfx')) return 'pfx';
    if (name.endsWith('.der')) return 'der';
    return 'p12'; // 기본값
  }
  
  /**
   * 임시 파일 정리
   */
  cleanup(): void {
    if (this.tempCertPath && fs.existsSync(this.tempCertPath)) {
      try {
        fs.unlinkSync(this.tempCertPath);
      } catch (error) {
        console.warn(`임시 인증서 파일 삭제 실패: ${this.tempCertPath}`, error);
      }
      this.tempCertPath = null;
    }
  }
}

