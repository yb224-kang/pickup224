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

// 9. 위택스 인증서 서명 모듈
export { PythonCertificateSigner } from './modules/wetax/python-certificate-signer';

// 10. 위택스 모듈
export {
    WetaxReportCollector,
    WetaxClientFetcher,
    WetaxReportStorage
} from './modules/wetax/reports/collector';

export {
    type WithholdingTaxCollectionOptions,
    type WithholdingTaxCollectionResult,
    type CollectedReport
} from './modules/wetax/reports/types';

export {
    type WetaxClient
} from './modules/wetax/clients/fetch';

// 11. 위택스 거래처 데이터 저장/조회
export {
    saveWetaxCompany,
    saveWetaxCompanies,
    getWetaxCompany,
    listWetaxCompanies,
    updateWetaxCompany,
    deleteWetaxCompany,
    type WetaxCompany
} from './modules/wetax-company/storage';

// 12. Raw 데이터 저장소 (수집 파이프라인)
export {
    startRun,
    completeRun,
    listRuns,
    getRun,
    saveRawSnapshot,
    listRawSnapshots,
    loadRawSnapshot,
    type DataSource,
    type DataType,
    type RawSnapshot,
    type ScrapeRun
} from './modules/raw-storage';

// 13. 위택스 특별징수 신고서 데이터 저장/조회 (Serving 레이어)
export {
    saveWithholdingReport,
    saveWithholdingReports,
    listWithholdingReports,
    getWithholdingReport,
    getWithholdingTaxKPI,
    getCompanyWithholdingStats,
    getTaxpayersByFilter,
    type WetaxWithholdingReport,
    type WithholdingTaxKPI,
    type CompanyWithholdingStats,
    type TaxpayerDetail
} from './modules/wetax-withholding-report/storage';

