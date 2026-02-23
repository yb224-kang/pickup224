import { CertFile } from "./certificate.interface";

/**
 * 인증서 서명 인터페이스
 * 외부 인증서 모듈(KSign 등)과의 연결점
 */
export interface CertificateSigner {
  /**
   * 인증서 파일과 비밀번호로 서명 객체 생성
   */
  loadCert(files: CertFile[], password: string): CertificateSignerInstance;
}

/**
 * 서명 인스턴스 인터페이스
 */
export interface CertificateSignerInstance {
  /**
   * 인증서 만료일 검증
   */
  validateCertExpiry(): void;

  /**
   * PKCS7 서명 메시지 생성
   */
  pkcs7SignedMsg(message: Buffer): Buffer;

  /**
   * 인증서 PEM 형식 반환 (선택사항)
   */
  getCertPem?(): string;

  /**
   * 시리얼 번호 반환 (선택사항)
   */
  serialNum?(): Buffer | string;

  /**
   * 일반 서명 (선택사항)
   */
  sign?(message: Buffer): Buffer;
}

