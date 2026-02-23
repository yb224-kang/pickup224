/**
 * 인증서 파일 정보
 */
export interface CertFile {
  name: string;
  data: Buffer;
}

/**
 * 인증서 데이터 인터페이스
 * 외부 인증서 모듈에서 이 형식으로 제공
 */
export interface CertificateData {
  certFilename: string;
  certFileData: Buffer | Uint8Array | string;
  certPassword: string;
  keyFileData?: Buffer | Uint8Array | string;
  keyFilename?: string;
}

/**
 * 인증서를 CertFile 배열로 변환하는 어댑터
 */
export interface CertificateAdapter {
  /**
   * 인증서 데이터를 CertFile 배열로 변환
   */
  toCertFiles(certificate: CertificateData): CertFile[];
}

/**
 * 기본 인증서 어댑터 구현
 */
export class DefaultCertificateAdapter implements CertificateAdapter {
  toCertFiles(certificate: CertificateData): CertFile[] {
    const files: CertFile[] = [];

    // 인증서 파일 추가
    const certData =
      certificate.certFileData instanceof Buffer
        ? certificate.certFileData
        : Buffer.from(certificate.certFileData);

    files.push({
      name: certificate.certFilename,
      data: certData,
    });

    // 키 파일이 있으면 추가
    if (certificate.keyFileData) {
      const keyData =
        certificate.keyFileData instanceof Buffer
          ? certificate.keyFileData
          : Buffer.from(certificate.keyFileData);

      files.push({
        name:
          certificate.keyFilename ||
          certificate.certFilename.replace(/\.(der|pfx|p12)$/i, ".key"),
        data: keyData,
      });
    }

    return files;
  }
}

