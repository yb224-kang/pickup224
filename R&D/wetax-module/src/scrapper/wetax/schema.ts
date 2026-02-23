import {
  EngagementStatus,
  TaxReportSubType,
  WetaxReportStatus,
} from "../../core/types";
import { z } from "zod";

/**
 * 문자열 날짜를 Date 객체로 변환하는 헬퍼 함수
 * - YYYYMM 형식: "202409" -> 2024년 9월 1일
 * - YYYYMMDD 형식: "20240915" -> 2024년 9월 15일
 * - YYYYMMDDHHmmss 형식: "20251103170642" -> 2025년 11월 3일 17시 6분 42초
 */
const convertStringToDate = (value: string | null): Date | null => {
  if (!value) return null;

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
  } catch {
    return null;
  }
};

/**
 * '2025년 09월 특별징수' 형태의 문자열을 '202509' 형식으로 변환하는 헬퍼 함수
 */
const convertYearMonthString = (value: string): string => {
  if (!value) return "";

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
const convertKoreanDateString = (value: string | null): Date | null => {
  if (!value) return null;

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
  } catch {
    return null;
  }
};

const convertNullToEmptyString = (value: unknown): string => {
  return value === null ? "" : (value as string);
};

const convertTaxReportSubType = (value: string): TaxReportSubType | string => {
  if (value === "개인") return TaxReportSubType.개인사업자;
  if (value === "프리랜서") return TaxReportSubType.프리랜서;
  if (value === "임대업") return TaxReportSubType.임대업;
  if (value === "기타사업") return TaxReportSubType.기타사업;
  return "";
};

const getReportStatus = (code: string | null): WetaxReportStatus | null => {
  if (code === "00") return WetaxReportStatus.작성중;
  if (code === "06") return WetaxReportStatus.신고완료;
  if (code === "07") return WetaxReportStatus.신고취소;
  if (code === "13") return WetaxReportStatus.신고실패;
  return null;
};

export const 위임자Schema = z.object({
  // 날짜 필드들
  dlgAcdAplyYmd: z
    .string()
    .nullable()
    .default(null)
    .transform(convertStringToDate), // 수임일자 & 동의일자

  // 문자열 필드들
  dlgpBzmnId: z.preprocess(convertNullToEmptyString, z.string()), // 고유ID
  agreStsCdNm: z.preprocess(convertNullToEmptyString, z.string()), // 수임상태
  dlgpBrno: z.preprocess(convertNullToEmptyString, z.string()), // 사업자번호
  dlgpConmNm: z.preprocess(convertNullToEmptyString, z.string()), // 상호명
  dlgpMblTelno: z.preprocess(convertNullToEmptyString, z.string()), // 연락처
  dlgpNm: z.preprocess(convertNullToEmptyString, z.string()), // 성명

  engagementStatus: z
    .nativeEnum(EngagementStatus)
    .default(EngagementStatus.TERMINATED), // 수임상태
});

export const 특별징수신고내역Schema = z
  .object({
    // 날짜 필드들
    dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    dclrTermYmd: z
      .string()
      .nullable()
      .default(null)
      .transform(convertStringToDate), // 납부기한
    vlPayTermYmd: z
      .string()
      .nullable()
      .default(null)
      .transform(convertStringToDate), // 납부마감기한
    payYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    elpn: z.string().nullable().default(null), // 납부번호

    // 문자열 필드들
    dclrId: z.string().default(""), // 신고ID
    dclrBzmnId: z.string().nullable().default(""), // 위택스 회원 고유ID
    dclrObjCn: z.string().default("").transform(convertYearMonthString), // 과세연도
    dclrCmnRcptClCd: z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: z.string().nullable().default(""), // 신고 상태

    // 숫자 필드들
    payPargTxa: z.number().default(0), // 납부예정금액
  })
  .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: parseInt(data.dclrObjCn.substring(4, 6), 10),
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
  }));

export const 종합소득분신고내역Schema = z
  .object({
    // 날짜 필드들
    dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    payYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    payTermYmd: z
      .string()
      .nullable()
      .default(null)
      .transform(convertStringToDate), // 납부기한
    dclrTermYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    elpn: z.string().nullable().default(null), // 납부번호
    mbrId: z.string().nullable().default(null), // 위택스 회원 고유ID

    // 문자열 필드들
    dclrId: z.string().default(""), // 신고ID
    dclrObjCn: z.string().default(""), // 과세연도
    dclrCmnRcptClCd: z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: z.string().nullable().default(""), // 신고 상태

    // 숫자 필드들
    payPargTxa: z.number().default(0), // 납부예정금액
  })
  .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: 1,
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
  }));

export const 종합소득분신고내역상세Schema = z
  .object({
    dclrId: z.string().default(""), // 신고ID
    dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
    frstPayTermYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부기한
    dclrTermYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    payYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    elpn: z.string().nullable().default(null), // 납부번호
    dclrSumAmt: z.number().nullable().default(0), // 과세표준 합계

    // 문자열 필드들
    dclrObjCn: z.string().default("").transform(convertYearMonthString), // 과세연도
    dclrCmnRcptClCd: z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: z.string().nullable().default(""), // 신고 상태
    txpTypNm: z.string().nullable().default("").transform(convertTaxReportSubType), // 세부유형
    // 숫자 필드들
    payPargTxa: z.number().default(0), // 납부예정금액
    dclrBzmnId: z.string().nullable().default(null), // 회원ID??
  })
  .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: parseInt(data.dclrObjCn.substring(4, 6), 10),
    isTaxPaid: data.payPargTxa === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
  }));

export const 법인소득분신고내역Schema = z
  .object({
    dclrId: z.string().default(""), // 신고ID
    dclrObjCn: z.string().default(""), // 과세연도
    dclrCmnRcptClCd: z.string().nullable().default(""), // 신고 상태 코드
    dclrCmnRcptClNm: z.string().nullable().default(""), // 신고 상태
    elpn: z.string().nullable().default(null), // 납부번호
    payAmt: z.number().nullable().default(0), // 납부금액
    payYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부일자
    frstPayTermYmd: z.string().nullable().default(null).transform(convertStringToDate), // 납부기한
    dclrTermYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고기한
    dclrTxpId: z.string().nullable().default(null), // 신고회원ID??
    cliDclrId: z.string().nullable().default(null), // 법인소득분신고ID
    dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
  })
  .transform((data) => ({
    ...data,
    reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
    reportMonth: 1,
    isTaxPaid: data.payAmt === 0 ? true : !!data.payYmd,
    status: getReportStatus(data.dclrCmnRcptClCd),
  }));

export const 법인소득분신고내역상세Schema = z.object({
  dclrId: z.string().default(""), // 신고ID
  dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
  dclrObjCn: z.string().default(""), // 과세연도
  dclrBzmnId: z.string().nullable().default(null), // 회원ID??
  dclrSumAmt: z.number().nullable().default(0), // 과세표준 합계
}).transform((data) => ({
  ...data,
  reportYear: parseInt(data.dclrObjCn.substring(0, 4), 10),
  reportMonth: 1,
}));

/**
 * 기장대리수임납세자 스키마
 */
export const 특별징수신고내역상세Schema = z.object({
  // 문자열 필드들
  dclrId: z.string().default(""), // 신고ID
  txpBrno: z.string().default("").transform(convertYearMonthString), // 사업자번호

  // 숫자 필드들
  earnCnt01: z.number().nullable().default(0), // 이자소득 인원
  earnCnt02: z.number().nullable().default(0), // 배당소득 인원
  earnCnt03: z.number().nullable().default(0), // 사업소득 인원
  earnCnt04: z.number().nullable().default(0), // 근로소득 인원
  earnCnt05: z.number().nullable().default(0), // 연금소득 인원
  earnCnt06: z.number().nullable().default(0), // 기타소득 인원
  earnCnt07: z.number().nullable().default(0), // 퇴직소득 인원
  earnCnt08: z.number().nullable().default(0), // 저축해지추징세액 등 인원
  earnCnt09: z.number().nullable().default(0), // 비거주자 양도소득 인원
  earnCnt10: z.number().nullable().default(0), // 법인원천(내국법인) 인원
  earnCnt11: z.number().nullable().default(0), // 법인원천(외국법인) 인원

  txbAmt01: z.number().nullable().default(0), // 이자소득 과세표준
  txbAmt02: z.number().nullable().default(0), // 배당소득 과세표준
  txbAmt03: z.number().nullable().default(0), // 사업소득 과세표준
  txbAmt04: z.number().nullable().default(0), // 근로소득 과세표준
  txbAmt05: z.number().nullable().default(0), // 연금소득 과세표준
  txbAmt06: z.number().nullable().default(0), // 기타소득 과세표준
  txbAmt07: z.number().nullable().default(0), // 퇴직소득 과세표준
  txbAmt08: z.number().nullable().default(0), // 저축해지추징세액 등 과세표준
  txbAmt09: z.number().nullable().default(0), // 비거주자 양도소득 과세표준
  txbAmt10: z.number().nullable().default(0), // 법인원천(내국법인) 과세표준
  txbAmt11: z.number().nullable().default(0), // 법인원천(외국법인) 과세표준
  txbAmtSum: z.number().nullable().default(0), // 과세표준 합계

  imtxa01: z.number().nullable().default(0), // 이자소득 납부세액
  imtxa02: z.number().nullable().default(0), // 배당소득 납부세액
  imtxa03: z.number().nullable().default(0), // 사업소득 납부세액
  imtxa04: z.number().nullable().default(0), // 근로소득 납부세액
  imtxa05: z.number().nullable().default(0), // 연금소득 납부세액
  imtxa06: z.number().nullable().default(0), // 기타소득 납부세액
  imtxa07: z.number().nullable().default(0), // 퇴직소득 납부세액
  imtxa08: z.number().nullable().default(0), // 저축해지추징세액 등 납부세액
  imtxa09: z.number().nullable().default(0), // 비거주자 양도소득 납부세액
  imtxa10: z.number().nullable().default(0), // 법인원천(내국법인) 납부세액
  imtxa11: z.number().nullable().default(0), // 법인원천(외국법인) 납부세액
  imtxaSum: z.number().nullable().default(0), // 납부세액 합계
  rmbrSumAmt: z.number().nullable().default(0), // 환급합계금액

  payPargTxa: z.number().nullable().default(0), // 납부예정금액
});

/**
 * 특별징수 신고서의 납세의무자별 상세 정보 스키마
 * (spctxOpratRptSubDVOList의 각 항목)
 */
export const 특별징수납세의무자상세Schema = z.object({
  dclrId: z.string().default(""), // 신고ID
  cvlcptId: z.string().nullable().default(null), // 납세의무자 고유ID
  rcptNo: z.string().nullable().default(null), // 접수번호
  ptclSn: z.string().nullable().default(null), // 순번
  txplNm: z.string().nullable().default(null), // 납세의무자 성명
  tnenc: z.string().nullable().default(null), // 주민번호 (마스킹)
  sltLocEarnKndCd: z.string().nullable().default(null), // 소득종류 (예: "사업소득")
  sltTnenc: z.string().nullable().default(null), // 납세의무자 주민번호 (마스킹)
  sltTxbAmt: z.number().nullable().default(0), // 과세표준
  sltCmpuTxa: z.number().nullable().default(0), // 산출세액
  sltPayAmt: z.number().nullable().default(0), // 납부세액
  sltAdjRmbrAmt: z.number().nullable().default(0), // 조정환급금액
  txpBrno: z.string().nullable().default(null), // 사업자번호
  txpConmNm: z.string().nullable().default(null), // 상호명
  txpNm: z.string().nullable().default(null), // 납세의무자명
  txpZipAddr: z.string().nullable().default(null), // 주소
  txpTelno: z.string().nullable().default(null), // 전화번호
  txpMblTelno: z.string().nullable().default(null), // 휴대전화번호
  txpEaddr: z.string().nullable().default(null), // 이메일
  txpmNo: z.string().nullable().default(null), // 납세관리번호
  txpmFormatNo: z.string().nullable().default(null), // 납세관리번호 (포맷팅)
  dclrYmd: z.string().nullable().default(null).transform(convertStringToDate), // 신고일자
});

/**
 * 특별징수 신고서 기본 정보 스키마
 * (spctxOpratRptDVOList의 각 항목)
 */
export const 특별징수신고서기본정보Schema = z.object({
  dclrId: z.string().default(""), // 신고ID
  fileDclrGrpId: z.string().nullable().default(null), // 파일신고그룹ID
  cvlcptId: z.string().nullable().default(null), // 납세의무자 고유ID
  rcptNo: z.string().nullable().default(null), // 접수번호
  pslCorpClCdNm: z.string().nullable().default(null), // 개인/법인 구분
  txpNm: z.string().nullable().default(null), // 납세의무자명
  txpConmNm: z.string().nullable().default(null), // 상호명
  txpBrno: z.string().nullable().default(null), // 사업자번호
  tnenc: z.string().nullable().default(null), // 주민번호 (마스킹)
  txpFxno: z.string().nullable().default(null), // 팩스번호
  txpZipAddr: z.string().nullable().default(null), // 주소
  txpTelno: z.string().nullable().default(null), // 전화번호
  txpMblTelno: z.string().nullable().default(null), // 휴대전화번호
  txpEaddr: z.string().nullable().default(null), // 이메일
  txpmNo: z.string().nullable().default(null), // 납세관리번호
  txpmFormatNo: z.string().nullable().default(null), // 납세관리번호 (포맷팅)
  jrsLgvCd: z.string().nullable().default(null), // 관할세무서 코드
  jrsLgvNm: z.string().nullable().default(null), // 관할세무서명
  dclrYmd: z.string().nullable().default(null).transform(convertKoreanDateString), // 신고일자
  giveYm: z.string().nullable().default(null), // 귀속연월 (예: "202601")
  rvrsYm: z.string().nullable().default(null), // 역산연월
  rvrsTi: z.string().nullable().default(null), // 역산내용
  txbCn: z.string().nullable().default(null), // 과세내용
  txbSumAmt: z.number().nullable().default(0), // 과세표준 합계
  cmpuSumTxa: z.number().nullable().default(0), // 산출세액 합계
  cmpuTxa: z.number().nullable().default(0), // 산출세액
  payPargTxa: z.number().nullable().default(0), // 납부예정세액
  dcsnTxa: z.number().nullable().default(0), // 결정세액
  elpn: z.string().nullable().default(null), // 납부번호
  elpn2: z.string().nullable().default(null), // 납부번호2
  txr: z.string().nullable().default(null), // 세율
  earnCnt01: z.number().nullable().default(0), // 이자소득 인원
  earnCnt02: z.number().nullable().default(0), // 배당소득 인원
  earnCnt03: z.number().nullable().default(0), // 사업소득 인원
  earnCnt04: z.number().nullable().default(0), // 근로소득 인원
  earnCnt05: z.number().nullable().default(0), // 연금소득 인원
  earnCnt06: z.number().nullable().default(0), // 기타소득 인원
  earnCnt07: z.number().nullable().default(0), // 퇴직소득 인원
  earnCnt08: z.number().nullable().default(0), // 저축해지추징세액 등 인원
  earnCnt09: z.number().nullable().default(0), // 비거주자 양도소득 인원
  earnCnt10: z.number().nullable().default(0), // 법인원천(내국법인) 인원
  earnCnt11: z.number().nullable().default(0), // 법인원천(외국법인) 인원
  txbAmt01: z.number().nullable().default(0), // 이자소득 과세표준
  txbAmt02: z.number().nullable().default(0), // 배당소득 과세표준
  txbAmt03: z.number().nullable().default(0), // 사업소득 과세표준
  txbAmt04: z.number().nullable().default(0), // 근로소득 과세표준
  txbAmt05: z.number().nullable().default(0), // 연금소득 과세표준
  txbAmt06: z.number().nullable().default(0), // 기타소득 과세표준
  txbAmt07: z.number().nullable().default(0), // 퇴직소득 과세표준
  txbAmt08: z.number().nullable().default(0), // 저축해지추징세액 등 과세표준
  txbAmt09: z.number().nullable().default(0), // 비거주자 양도소득 과세표준
  txbAmt10: z.number().nullable().default(0), // 법인원천(내국법인) 과세표준
  txbAmt11: z.number().nullable().default(0), // 법인원천(외국법인) 과세표준
  txbAmt: z.number().nullable().default(0), // 과세표준
  imtxa01: z.number().nullable().default(0), // 이자소득 산출세액
  imtxa02: z.number().nullable().default(0), // 배당소득 산출세액
  imtxa03: z.number().nullable().default(0), // 사업소득 산출세액
  imtxa04: z.number().nullable().default(0), // 근로소득 산출세액
  imtxa05: z.number().nullable().default(0), // 연금소득 산출세액
  imtxa06: z.number().nullable().default(0), // 기타소득 산출세액
  imtxa07: z.number().nullable().default(0), // 퇴직소득 산출세액
  imtxa08: z.number().nullable().default(0), // 저축해지추징세액 등 산출세액
  imtxa09: z.number().nullable().default(0), // 비거주자 양도소득 산출세액
  imtxa10: z.number().nullable().default(0), // 법인원천(내국법인) 산출세액
  imtxa11: z.number().nullable().default(0), // 법인원천(외국법인) 산출세액
  imtxaSum: z.number().nullable().default(0), // 산출세액 합계
  tmnEtcRmbrAmt: z.number().nullable().default(0), // 기타환급금액
  tmnAddPayAmt: z.number().nullable().default(0), // 추가납부금액
  yestRmbrAmt: z.number().nullable().default(0), // 전기환급금액
  yestAddPayAmt: z.number().nullable().default(0), // 전기추가납부금액
  itrmRtrmRmbrAmt: z.number().nullable().default(0), // 중간환급금액
  adtxTrgtAddPayAmt: z.number().nullable().default(0), // 추가납부대상금액
  adtxTrgtAddAdtnTxa: z.number().nullable().default(0), // 추가납부대상세액
  rmbrSumAmt: z.number().nullable().default(0), // 환급합계금액
  addPaySumAmt: z.number().nullable().default(0), // 추가납부합계금액
  adjsAdjAmtAdsClCd: z.string().nullable().default(null), // 조정금액구분코드
  adjsAdjAmt: z.number().nullable().default(0), // 조정금액
  payTxbAmt: z.number().nullable().default(0), // 납부과세표준
  txaAdjRmbrBal: z.number().nullable().default(0), // 세액조정환급잔액
  pargTxa: z.number().nullable().default(0), // 예정세액
  dclrInscAdtnTxa: z.number().nullable().default(0), // 신고가산세액
  payInscAdtnTxa: z.number().nullable().default(0), // 납부가산세액
  prpmtTxa: z.number().nullable().default(0), // 선납세액
  rdeTxa: z.number().nullable().default(0), // 감면세액
  ptclSn: z.string().nullable().default(null), // 순번
  elpnList: z.string().nullable().default(null), // 납부번호 목록
});

/**
 * 특별징수 신고서 납세의무자별 상세 정보 전체 응답 스키마
 * (getReportData API 응답)
 */
export const 특별징수신고서납세의무자별상세Schema = z.object({
  spctxOpratRptDVO: 특별징수신고서기본정보Schema.nullable().default(null), // 신고서 기본 정보 (단일)
  spctxOpratRptDVOList: z.array(특별징수신고서기본정보Schema).default([]), // 신고서 기본 정보 목록
  spctxOpratRptSubDVOList: z.array(특별징수납세의무자상세Schema).default([]), // 납세의무자별 상세 정보 목록
  common: z.object({
    uxId: z.string().nullable().default(null),
    menuId: z.string().nullable().default(null),
    terIp: z.string().nullable().default(null),
    reqDt: z.string().nullable().default(null),
    ctxNm: z.string().nullable().default(null),
    txId: z.string().nullable().default(null),
    prcsRsltCd: z.string().nullable().default(null),
    rsltMsgId: z.string().nullable().default(null),
    rsltMsgBscCn: z.string().nullable().default(null),
    rsltMsgActnCn: z.string().nullable().default(null),
    sPgmId: z.string().nullable().default(null),
    gTxId: z.string().nullable().default(null),
  }),
});

// 타입 추론
export type 특별징수신고내역 = z.infer<typeof 특별징수신고내역Schema> & {
  detail?: 특별징수신고내역상세;
};
export type 특별징수신고내역상세 = z.infer<typeof 특별징수신고내역상세Schema>;
export type 위임자 = z.infer<typeof 위임자Schema>;
export type 종합소득분신고내역 = z.infer<typeof 종합소득분신고내역Schema> & {
  detail?: 종합소득분신고내역상세;
};
export type 종합소득분신고내역상세 = z.infer<typeof 종합소득분신고내역상세Schema>;
export type 법인소득분신고내역 = z.infer<typeof 법인소득분신고내역Schema> & {
  detail?: 법인소득분신고내역상세;
};
export type 법인소득분신고내역상세 = z.infer<typeof 법인소득분신고내역상세Schema>;
export type 특별징수납세의무자상세 = z.infer<typeof 특별징수납세의무자상세Schema>;
export type 특별징수신고서기본정보 = z.infer<typeof 특별징수신고서기본정보Schema>;
export type 특별징수신고서납세의무자별상세 = z.infer<typeof 특별징수신고서납세의무자별상세Schema>;

