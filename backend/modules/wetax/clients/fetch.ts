/**
 * 위택스 위임자(클라이언트) 조회 모듈
 * WetaxService를 래핑하여 간단한 인터페이스 제공
 */

import { CertificateData } from '../python-certificate-signer';
import { WetaxService } from '../../../../R&D/wetax-module/src/services/wetax-service';
import { PythonCertificateSigner } from '../python-certificate-signer';

export interface WetaxClient {
    dlgpBzmnId?: string;
    dlgpBrno?: string;
    dlgpConmNm?: string;
    dlgpNm?: string;
    dlgpMblTelno?: string;
    // ... 기타 필드
}

/**
 * 위택스 위임자 조회 클래스
 */
export class WetaxClientFetcher {
    private certificateSigner: PythonCertificateSigner;
    private service: WetaxService;

    constructor() {
        this.certificateSigner = new PythonCertificateSigner();
        this.service = new WetaxService(this.certificateSigner);
    }

    /**
     * 위임자 목록 조회
     * @param certificate 인증서 데이터
     * @returns 위임자 그룹 (키: dlgpBzmnId, 값: 위임자 배열)
     */
    async fetchClients(certificate: CertificateData): Promise<Record<string, any[]>> {
        return await this.service.getWetaxClients(certificate);
    }
}
