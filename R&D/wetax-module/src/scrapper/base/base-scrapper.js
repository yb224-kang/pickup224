"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseScrapper = void 0;
const session_manager_1 = require("../../core/session/session-manager");
const certificate_interface_1 = require("../../services/interfaces/certificate.interface");
class BaseScrapper extends session_manager_1.SessionManager {
    constructor(certificates, password, certificateSigner, certificateAdapter) {
        super();
        this.password = password;
        // 인증서 서명 객체 주입
        this.certificateSigner = certificateSigner;
        // 인증서 데이터를 CertFile로 변환
        const adapter = certificateAdapter || new certificate_interface_1.DefaultCertificateAdapter();
        this.certFiles = certificates.flatMap((cert) => adapter.toCertFiles(cert));
    }
}
exports.BaseScrapper = BaseScrapper;
