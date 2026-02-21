/**
 * 모든 함수를 export하는 메인 인덱스 파일
 */

// 1. 인증서 조회 (기본조회)
export { discoverCertificatesBasic, CertificateBasicInfo } from './modules/certificate/discovery/basic';

// 2. 인증서 조회 (세부조회)
export { discoverCertificatesDetailed } from './modules/certificate/discovery/detailed';

// 6. 인증서 비밀번호 입력/저장
export {
    saveCertificatePassword,
    getCertificatePassword,
    deleteCertificatePassword,
    listSavedCertificates,
    getCertPathByHash
} from './modules/certificate/password/storage';

// 7. 세무사 데이터 저장/조회
export {
    saveTaxAccountant,
    getTaxAccountant,
    listTaxAccountants,
    updateTaxAccountant,
    deleteTaxAccountant,
    linkCertificate,
    type TaxAccountant
} from './modules/tax-accountant/storage';

// 8. 거래처(사업장) 데이터 저장/조회
export {
    saveCompany,
    saveCompanies,
    getCompany,
    listCompanies,
    updateCompany,
    deleteCompany,
    type Company
} from './modules/company/storage';

