import { SessionManager } from "../../core/session/session-manager";
import {
  CertificateData,
  CertificateAdapter,
  DefaultCertificateAdapter,
  CertFile,
} from "../../services/interfaces/certificate.interface";
import { CertificateSigner } from "../../services/interfaces/certificate-signer.interface";

export abstract class BaseScrapper extends SessionManager {
  protected readonly certFiles: CertFile[];
  protected readonly certificateSigner: CertificateSigner;

  constructor(
    certificates: CertificateData[],
    protected readonly password: string,
    certificateSigner: CertificateSigner,
    certificateAdapter?: CertificateAdapter
  ) {
    super();

    // 인증서 서명 객체 주입
    this.certificateSigner = certificateSigner;

    // 인증서 데이터를 CertFile로 변환
    const adapter = certificateAdapter || new DefaultCertificateAdapter();
    this.certFiles = certificates.flatMap((cert) =>
      adapter.toCertFiles(cert)
    );
  }

  abstract login(): Promise<void>;
}

