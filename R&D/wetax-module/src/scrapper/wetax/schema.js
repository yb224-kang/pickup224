"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.특별징수신고서납세의무자별상세Schema = exports.특별징수신고서기본정보Schema = exports.특별징수납세의무자상세Schema = exports.특별징수신고내역상세Schema = exports.법인소득분신고내역상세Schema = exports.법인소득분신고내역Schema = exports.종합소득분신고내역상세Schema = exports.종합소득분신고내역Schema = exports.특별징수신고내역Schema = exports.위임자Schema = void 0;
const types_1 = require("../../core/types");
const zod_1 = require("zod");
/**
 * 문자열 날짜를 Date 객체로 변환하는 헬퍼 함수
 * - YYYYMM 형식: "202409" -> 2024년 9월 1일
 * - YYYYMMDD 형식: "20240915" -> 2024년 9월 15일
 * - YYYYMMDDHHmmss 형식: "20251103170642" -> 2025년 11월 3일 17시 6분 42초
 */
const convertStringToDate = (value) => {
    if (!value)
        return null;
    try {
        // YYYYMM 형식 (6자리)
        if (/^\d{6}$/.test(value)) {
            const year = parseInt(value.substring(0, 4), 10);
            const month = parseInt(value.substring(4, 6), 10);
            return new Date(year, month - 1, 1);
        }
        // YYYYMMDD 형식 (8자리)
        if (/^\d{8}$/.test(value)) {
            const year = parseInt(value.substring(0, 4), 10);
            const month = parseInt(value.substring(4, 6), 10);
            const day = parseInt(value.substring(6, 8), 10);
            return new Date(year, month - 1, day);
        }
        // YYYYMMDDHHmmss 형식 (14자리)
        if (/^\d{14}$/.test(value)) {
            const year = parseInt(value.substring(0, 4), 10);
            const month = parseInt(value.substring(4, 6), 10);
            const day = parseInt(value.substring(6, 8), 10);
            const hour = parseInt(value.substring(8, 10), 10);
            const minute = parseInt(value.substring(10, 12), 10);
            const second = parseInt(value.substring(12, 14), 10);
            return new Date(year, month - 1, day, hour, minute, second);
        }
        // 그 외 형식은 기본 Date 파서 사용
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    catch {
        return null;
    }
};
/**
 * '2025년 09월 특별징수' 형태의 문자열을 '202509' 형식으로 변환하는 헬퍼 함수
 */
const convertYearMonthString = (value) => {
    if (!value)
        return "";
    const match = value.match(/(\d{4})년\s*(\d{1,2})월/);
    if (match) {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        return `${year}${month}`;
    }
    return value;
};
/**
 * '2026 년 02 월 09 일' 형태의 문자열을 Date 객체로 변환하는 헬퍼 함수
 */
const convertKoreanDateString = (value) => {
    if (!value)
        return null;
    try {
        // "2026 년 02 월 09 일" 형식
        const match = value.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);
            return new Date(year, month - 1, day);
        }
        // 기존 convertStringToDate 사용
        return convertStringToDate(value);
    }
    catch {
        return null;
    }
};
const convertNullToEmptyString = (value) => {
    return value === null ? "" : value;
};
const convertTaxReportSubType = (value) => {
    if (value === "개인")
        return types_1.TaxReportSubType.개인사업자;
    if (value === "프리랜서")
        return types_1.TaxReportSubType.프리랜서;
    if (value === "임대업")
        return types_1.TaxReportSubType.임대업;
    if (value === "기타사업")
        return types_1.TaxReportSubType.기타사업;
    return "";
};
const getReportStatus = (code) => {
    if (code === "00")
        return types_1.WetaxReportStatus.작성중;
    if (code === "06")
        return types_1.WetaxReportStatus.신고완료;
    if (code === "07")
        return types_1.WetaxReportStatus.신고취소;
    if (code === "13")
        return types_1.WetaxReportStatus.신고실패;
    return null;
};
exports.위임자Schema = zod_1.z.object({
    // 날짜 필드들
    dlgAcdAplyYmd: zod_1.z
        .string()
        .nullable()
        .default(null)
        .transform(convertStringToDate), // 수임일자 & 동의일자
    // 문자열 필드들
    dlgpBzmnId: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 고유ID
    agreStsCdNm: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 수임상태
    dlgpBrno: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 사업자번호
    dlgpConmNm: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 상호명
    dlgpMblTelno: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 연락처
    dlgpNm: zod_1.z.preprocess(convertNullToEmptyString, zod_1.z.string()), // 성명
    engagementStatus: zod_1.z
        .nativeEnum(types_1.EngagementStatus)
        .default(types_1.EngagementStatus.TERMINATED), // 수임상태
});
exports.특별징수신고내역Schema = zod_1.z
    .object({
    // 날짜 필드들
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    dclrTermYmd: zod_1.z
        .string()
        .nullable()
        .default(null)
        .transform(convertStringToDate), // 납부기한
    vlPayTermYmd: zod_1.z
        .string()
        .nullable()
        .default(null)
        .transform(convertStringToDate), // 납부마감기한
    payYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    elpn: zod_1.z.string().nullable().default(null), // 납부번호
    // 문자열 필드들
    dclrId: zod_1.z.string().default(""), // 신고ID
    dclrBzmnId: zod_1.z.string().nullable().default(""), // 위택스 회원 고유ID
    dclrObjCn: zod_1.z.string().default("").transform(convertYearMonthString), // 과세연도
    dclrCmnRcptClCd: zod_1.z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: zod_1.z.string().nullable().default(""), // 신고 상태
    // 숫자 필드들
    payPargTxa: zod_1.z.number().default(0), // 납부예정금액
})
    .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: parseInt(data.dclrObjCn.substring(4, 6), 10),
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
}));
exports.종합소득분신고내역Schema = zod_1.z
    .object({
    // 날짜 필드들
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    payYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    payTermYmd: zod_1.z
        .string()
        .nullable()
        .default(null)
        .transform(convertStringToDate), // 납부기한
    dclrTermYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    elpn: zod_1.z.string().nullable().default(null), // 납부번호
    mbrId: zod_1.z.string().nullable().default(null), // 위택스 회원 고유ID
    // 문자열 필드들
    dclrId: zod_1.z.string().default(""), // 신고ID
    dclrObjCn: zod_1.z.string().default(""), // 과세연도
    dclrCmnRcptClCd: zod_1.z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: zod_1.z.string().nullable().default(""), // 신고 상태
    // 숫자 필드들
    payPargTxa: zod_1.z.number().default(0), // 납부예정금액
})
    .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: 1,
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
}));
exports.종합소득분신고내역상세Schema = zod_1.z
    .object({
    dclrId: zod_1.z.string().default(""), // 신고ID
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    frstPayTermYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부기한
    dclrTermYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    payYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    elpn: zod_1.z.string().nullable().default(null), // 납부번호
    dclrSumAmt: zod_1.z.number().nullable().default(0), // 과세표준 합계
    // 문자열 필드들
    dclrObjCn: zod_1.z.string().default("").transform(convertYearMonthString), // 과세연도
    dclrCmnRcptClCd: zod_1.z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: zod_1.z.string().nullable().default(""), // 신고 상태
    txpTypNm: zod_1.z.string().nullable().default("").transform(convertTaxReportSubType), // 세부유형
    // 숫자 필드들
    payPargTxa: zod_1.z.number().default(0), // 납부예정금액
    dclrBzmnId: zod_1.z.string().nullable().default(null), // 회원ID??
})
    .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: parseInt(data.dclrObjCn.substring(4, 6), 10),
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
}));
exports.법인소득분신고내역Schema = zod_1.z
    .object({
    dclrId: zod_1.z.string().default(""), // 신고ID
    dclrObjCn: zod_1.z.string().default(""), // 과세연도
    dclrCmnRcptClCd: zod_1.z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: zod_1.z.string().nullable().default(""), // 신고 상태
    elpn: zod_1.z.string().nullable().default(null), // 납부번호
    payAmt: zod_1.z.number().nullable().default(0), // 납부금액
    payYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    frstPayTermYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 납부기한
    dclrTermYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    dclrTxpId: zod_1.z.string().nullable().default(null), // 신고회원ID??
    cliDclrId: zod_1.z.string().nullable().default(null), // 법인소득분신고ID
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
})
    .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: 1,
    isTaxPaid: data.payAmt === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
}));
exports.법인소득분신고내역상세Schema = zod_1.z.object({
    dclrId: zod_1.z.string().default(""), // 신고ID
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    dclrObjCn: zod_1.z.string().default(""), // 과세연도
    dclrBzmnId: zod_1.z.string().nullable().default(null), // 회원ID??
    dclrSumAmt: zod_1.z.number().nullable().default(0), // 과세표준 합계
}).transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: 1,
}));
/**
 * 기장대리수임납세자 스키마
 */
exports.특별징수신고내역상세Schema = zod_1.z.object({
    // 문자열 필드들
    dclrId: zod_1.z.string().default(""), // 신고ID
    txpBrno: zod_1.z.string().default("").transform(convertYearMonthString), // 사업자번호
    // 숫자 필드들
    earnCnt01: zod_1.z.number().nullable().default(0), // 이자소득 인원
    earnCnt02: zod_1.z.number().nullable().default(0), // 배당소득 인원
    earnCnt03: zod_1.z.number().nullable().default(0), // 사업소득 인원
    earnCnt04: zod_1.z.number().nullable().default(0), // 근로소득 인원
    earnCnt05: zod_1.z.number().nullable().default(0), // 연금소득 인원
    earnCnt06: zod_1.z.number().nullable().default(0), // 기타소득 인원
    earnCnt07: zod_1.z.number().nullable().default(0), // 퇴직소득 인원
    earnCnt08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 인원
    earnCnt09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 인원
    earnCnt10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 인원
    earnCnt11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 인원
    txbAmt01: zod_1.z.number().nullable().default(0), // 이자소득 과세표준
    txbAmt02: zod_1.z.number().nullable().default(0), // 배당소득 과세표준
    txbAmt03: zod_1.z.number().nullable().default(0), // 사업소득 과세표준
    txbAmt04: zod_1.z.number().nullable().default(0), // 근로소득 과세표준
    txbAmt05: zod_1.z.number().nullable().default(0), // 연금소득 과세표준
    txbAmt06: zod_1.z.number().nullable().default(0), // 기타소득 과세표준
    txbAmt07: zod_1.z.number().nullable().default(0), // 퇴직소득 과세표준
    txbAmt08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 과세표준
    txbAmt09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 과세표준
    txbAmt10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 과세표준
    txbAmt11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 과세표준
    txbAmtSum: zod_1.z.number().nullable().default(0), // 과세표준 합계
    imtxa01: zod_1.z.number().nullable().default(0), // 이자소득 납부세액
    imtxa02: zod_1.z.number().nullable().default(0), // 배당소득 납부세액
    imtxa03: zod_1.z.number().nullable().default(0), // 사업소득 납부세액
    imtxa04: zod_1.z.number().nullable().default(0), // 근로소득 납부세액
    imtxa05: zod_1.z.number().nullable().default(0), // 연금소득 납부세액
    imtxa06: zod_1.z.number().nullable().default(0), // 기타소득 납부세액
    imtxa07: zod_1.z.number().nullable().default(0), // 퇴직소득 납부세액
    imtxa08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 납부세액
    imtxa09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 납부세액
    imtxa10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 납부세액
    imtxa11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 납부세액
    imtxaSum: zod_1.z.number().nullable().default(0), // 납부세액 합계
    rmbrSumAmt: zod_1.z.number().nullable().default(0), // 환급합계금액
    payPargTxa: zod_1.z.number().nullable().default(0), // 납부예정금액
});
/**
 * 특별징수 신고서의 납세의무자별 상세 정보 스키마
 * (spctxOpratRptSubDVOList의 각 항목)
 */
exports.특별징수납세의무자상세Schema = zod_1.z.object({
    dclrId: zod_1.z.string().default(""), // 신고ID
    cvlcptId: zod_1.z.string().nullable().default(null), // 납세의무자 고유ID
    rcptNo: zod_1.z.string().nullable().default(null), // 접수번호
    ptclSn: zod_1.z.string().nullable().default(null), // 순번
    txplNm: zod_1.z.string().nullable().default(null), // 납세의무자 성명
    tnenc: zod_1.z.string().nullable().default(null), // 주민번호 (마스킹)
    sltLocEarnKndCd: zod_1.z.string().nullable().default(null), // 소득종류 (예: "사업소득")
    sltTnenc: zod_1.z.string().nullable().default(null), // 납세의무자 주민번호 (마스킹)
    sltTxbAmt: zod_1.z.number().nullable().default(0), // 과세표준
    sltCmpuTxa: zod_1.z.number().nullable().default(0), // 산출세액
    sltPayAmt: zod_1.z.number().nullable().default(0), // 납부세액
    sltAdjRmbrAmt: zod_1.z.number().nullable().default(0), // 조정환급금액
    txpBrno: zod_1.z.string().nullable().default(null), // 사업자번호
    txpConmNm: zod_1.z.string().nullable().default(null), // 상호명
    txpNm: zod_1.z.string().nullable().default(null), // 납세의무자명
    txpZipAddr: zod_1.z.string().nullable().default(null), // 주소
    txpTelno: zod_1.z.string().nullable().default(null), // 전화번호
    txpMblTelno: zod_1.z.string().nullable().default(null), // 휴대전화번호
    txpEaddr: zod_1.z.string().nullable().default(null), // 이메일
    txpmNo: zod_1.z.string().nullable().default(null), // 납세관리번호
    txpmFormatNo: zod_1.z.string().nullable().default(null), // 납세관리번호 (포맷팅)
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
});
/**
 * 특별징수 신고서 기본 정보 스키마
 * (spctxOpratRptDVOList의 각 항목)
 */
exports.특별징수신고서기본정보Schema = zod_1.z.object({
    dclrId: zod_1.z.string().default(""), // 신고ID
    fileDclrGrpId: zod_1.z.string().nullable().default(null), // 파일신고그룹ID
    cvlcptId: zod_1.z.string().nullable().default(null), // 납세의무자 고유ID
    rcptNo: zod_1.z.string().nullable().default(null), // 접수번호
    pslCorpClCdNm: zod_1.z.string().nullable().default(null), // 개인/법인 구분
    txpNm: zod_1.z.string().nullable().default(null), // 납세의무자명
    txpConmNm: zod_1.z.string().nullable().default(null), // 상호명
    txpBrno: zod_1.z.string().nullable().default(null), // 사업자번호
    tnenc: zod_1.z.string().nullable().default(null), // 주민번호 (마스킹)
    txpFxno: zod_1.z.string().nullable().default(null), // 팩스번호
    txpZipAddr: zod_1.z.string().nullable().default(null), // 주소
    txpTelno: zod_1.z.string().nullable().default(null), // 전화번호
    txpMblTelno: zod_1.z.string().nullable().default(null), // 휴대전화번호
    txpEaddr: zod_1.z.string().nullable().default(null), // 이메일
    txpmNo: zod_1.z.string().nullable().default(null), // 납세관리번호
    txpmFormatNo: zod_1.z.string().nullable().default(null), // 납세관리번호 (포맷팅)
    jrsLgvCd: zod_1.z.string().nullable().default(null), // 관할세무서 코드
    jrsLgvNm: zod_1.z.string().nullable().default(null), // 관할세무서명
    dclrYmd: zod_1.z.string().nullable().default(null).transform(convertKoreanDateString), // 신고일자
    giveYm: zod_1.z.string().nullable().default(null), // 귀속연월 (예: "202601")
    rvrsYm: zod_1.z.string().nullable().default(null), // 역산연월
    rvrsTi: zod_1.z.string().nullable().default(null), // 역산내용
    txbCn: zod_1.z.string().nullable().default(null), // 과세내용
    txbSumAmt: zod_1.z.number().nullable().default(0), // 과세표준 합계
    cmpuSumTxa: zod_1.z.number().nullable().default(0), // 산출세액 합계
    cmpuTxa: zod_1.z.number().nullable().default(0), // 산출세액
    payPargTxa: zod_1.z.number().nullable().default(0), // 납부예정세액
    dcsnTxa: zod_1.z.number().nullable().default(0), // 결정세액
    elpn: zod_1.z.string().nullable().default(null), // 납부번호
    elpn2: zod_1.z.string().nullable().default(null), // 납부번호2
    txr: zod_1.z.string().nullable().default(null), // 세율
    earnCnt01: zod_1.z.number().nullable().default(0), // 이자소득 인원
    earnCnt02: zod_1.z.number().nullable().default(0), // 배당소득 인원
    earnCnt03: zod_1.z.number().nullable().default(0), // 사업소득 인원
    earnCnt04: zod_1.z.number().nullable().default(0), // 근로소득 인원
    earnCnt05: zod_1.z.number().nullable().default(0), // 연금소득 인원
    earnCnt06: zod_1.z.number().nullable().default(0), // 기타소득 인원
    earnCnt07: zod_1.z.number().nullable().default(0), // 퇴직소득 인원
    earnCnt08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 인원
    earnCnt09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 인원
    earnCnt10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 인원
    earnCnt11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 인원
    txbAmt01: zod_1.z.number().nullable().default(0), // 이자소득 과세표준
    txbAmt02: zod_1.z.number().nullable().default(0), // 배당소득 과세표준
    txbAmt03: zod_1.z.number().nullable().default(0), // 사업소득 과세표준
    txbAmt04: zod_1.z.number().nullable().default(0), // 근로소득 과세표준
    txbAmt05: zod_1.z.number().nullable().default(0), // 연금소득 과세표준
    txbAmt06: zod_1.z.number().nullable().default(0), // 기타소득 과세표준
    txbAmt07: zod_1.z.number().nullable().default(0), // 퇴직소득 과세표준
    txbAmt08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 과세표준
    txbAmt09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 과세표준
    txbAmt10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 과세표준
    txbAmt11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 과세표준
    txbAmt: zod_1.z.number().nullable().default(0), // 과세표준
    imtxa01: zod_1.z.number().nullable().default(0), // 이자소득 산출세액
    imtxa02: zod_1.z.number().nullable().default(0), // 배당소득 산출세액
    imtxa03: zod_1.z.number().nullable().default(0), // 사업소득 산출세액
    imtxa04: zod_1.z.number().nullable().default(0), // 근로소득 산출세액
    imtxa05: zod_1.z.number().nullable().default(0), // 연금소득 산출세액
    imtxa06: zod_1.z.number().nullable().default(0), // 기타소득 산출세액
    imtxa07: zod_1.z.number().nullable().default(0), // 퇴직소득 산출세액
    imtxa08: zod_1.z.number().nullable().default(0), // 저축해지추징세액 등 산출세액
    imtxa09: zod_1.z.number().nullable().default(0), // 비거주자 양도소득 산출세액
    imtxa10: zod_1.z.number().nullable().default(0), // 법인원천(내국법인) 산출세액
    imtxa11: zod_1.z.number().nullable().default(0), // 법인원천(외국법인) 산출세액
    imtxaSum: zod_1.z.number().nullable().default(0), // 산출세액 합계
    tmnEtcRmbrAmt: zod_1.z.number().nullable().default(0), // 기타환급금액
    tmnAddPayAmt: zod_1.z.number().nullable().default(0), // 추가납부금액
    yestRmbrAmt: zod_1.z.number().nullable().default(0), // 전기환급금액
    yestAddPayAmt: zod_1.z.number().nullable().default(0), // 전기추가납부금액
    itrmRtrmRmbrAmt: zod_1.z.number().nullable().default(0), // 중간환급금액
    adtxTrgtAddPayAmt: zod_1.z.number().nullable().default(0), // 추가납부대상금액
    adtxTrgtAddAdtnTxa: zod_1.z.number().nullable().default(0), // 추가납부대상세액
    rmbrSumAmt: zod_1.z.number().nullable().default(0), // 환급합계금액
    addPaySumAmt: zod_1.z.number().nullable().default(0), // 추가납부합계금액
    adjsAdjAmtAdsClCd: zod_1.z.string().nullable().default(null), // 조정금액구분코드
    adjsAdjAmt: zod_1.z.number().nullable().default(0), // 조정금액
    payTxbAmt: zod_1.z.number().nullable().default(0), // 납부과세표준
    txaAdjRmbrBal: zod_1.z.number().nullable().default(0), // 세액조정환급잔액
    pargTxa: zod_1.z.number().nullable().default(0), // 예정세액
    dclrInscAdtnTxa: zod_1.z.number().nullable().default(0), // 신고가산세액
    payInscAdtnTxa: zod_1.z.number().nullable().default(0), // 납부가산세액
    prpmtTxa: zod_1.z.number().nullable().default(0), // 선납세액
    rdeTxa: zod_1.z.number().nullable().default(0), // 감면세액
    ptclSn: zod_1.z.string().nullable().default(null), // 순번
    elpnList: zod_1.z.string().nullable().default(null), // 납부번호 목록
});
/**
 * 특별징수 신고서 납세의무자별 상세 정보 전체 응답 스키마
 * (getReportData API 응답)
 */
exports.특별징수신고서납세의무자별상세Schema = zod_1.z.object({
    spctxOpratRptDVO: exports.특별징수신고서기본정보Schema.nullable().default(null), // 신고서 기본 정보 (단일)
    spctxOpratRptDVOList: zod_1.z.array(exports.특별징수신고서기본정보Schema).default([]), // 신고서 기본 정보 목록
    spctxOpratRptSubDVOList: zod_1.z.array(exports.특별징수납세의무자상세Schema).default([]), // 납세의무자별 상세 정보 목록
    common: zod_1.z.object({
        uxId: zod_1.z.string().nullable().default(null),
        menuId: zod_1.z.string().nullable().default(null),
        terIp: zod_1.z.string().nullable().default(null),
        reqDt: zod_1.z.string().nullable().default(null),
        ctxNm: zod_1.z.string().nullable().default(null),
        txId: zod_1.z.string().nullable().default(null),
        prcsRsltCd: zod_1.z.string().nullable().default(null),
        rsltMsgId: zod_1.z.string().nullable().default(null),
        rsltMsgBscCn: zod_1.z.string().nullable().default(null),
        rsltMsgActnCn: zod_1.z.string().nullable().default(null),
        sPgmId: zod_1.z.string().nullable().default(null),
        gTxId: zod_1.z.string().nullable().default(null),
    }),
});
