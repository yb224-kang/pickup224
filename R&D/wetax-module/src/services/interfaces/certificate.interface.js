"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCertificateAdapter = void 0;
/**
 * 기본 인증서 어댑터 구현
 */
class DefaultCertificateAdapter {
    toCertFiles(certificate) {
        const files = [];
        // 인증서 파일 추가
        const certData = certificate.certFileData instanceof Buffer
            ? certificate.certFileData
            : Buffer.from(certificate.certFileData);
        files.push({
            name: certificate.certFilename,
            data: certData,
        });
        // 키 파일이 있으면 추가
        if (certificate.keyFileData) {
            const keyData = certificate.keyFileData instanceof Buffer
                ? certificate.keyFileData
                : Buffer.from(certificate.keyFileData);
            files.push({
                name: certificate.keyFilename ||
                    certificate.certFilename.replace(/\.(der|pfx|p12)$/i, ".key"),
                data: keyData,
            });
        }
        return files;
    }
}
exports.DefaultCertificateAdapter = DefaultCertificateAdapter;
