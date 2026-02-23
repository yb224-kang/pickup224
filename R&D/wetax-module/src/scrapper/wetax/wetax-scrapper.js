"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WetaxScrapper = void 0;
const base_scrapper_1 = require("../base/base-scrapper");
const types_1 = require("../../core/types");
const schema_1 = require("./schema");
const date_fns_1 = require("date-fns");
const crypto_1 = require("crypto");
class WetaxScrapper extends base_scrapper_1.BaseScrapper {
    constructor(certificates, password, certificateSigner) {
        super(certificates, password, certificateSigner);
        this.password = password;
    }
    async login() {
        // 외부 인증서 서명 모듈 사용
        const signer = this.certificateSigner.loadCert(this.certFiles, this.password);
        signer.validateCertExpiry();
        const pkcs7Signed = signer.pkcs7SignedMsg(Buffer.from(this.password, "utf-8"));
        const signedBase64 = pkcs7Signed.toString("base64");
        const loginData = {
            lgnDVO: {
                wtxSysClCd: "01",
                lgnCertMtdCd: "01",
                athcfInfCn: signedBase64,
            },
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/tcp/api/lgn/login`, loginData);
        if (!(response.data &&
            response.data?.common?.prcsRsltCd === WetaxScrapper.LOGIN_SUCCESS_CODE)) {
            throw new Error("로그인 실패");
        }
    }
    async 위임자(searchStart, searchEnd) {
        const formattedSearchStart = (0, date_fns_1.format)(searchStart, "yyyyMMdd");
        const formattedSearchEnd = (0, date_fns_1.format)(searchEnd, "yyyyMMdd");
        console.log(`검색 일자: ${formattedSearchStart} ~ ${formattedSearchEnd}`);
        const data = {
            dlgpInqCond: {
                inqBgngYmd: formattedSearchStart,
                inqEndYmd: formattedSearchEnd,
                dlgpNoEnc1: "",
                dlgpNoEnc2: "",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etq/api/tafAgtEusDlgp/getListTafAgtDlgpSearch`, data);
        const listData = response.data["tafAgtEusDlgpDVOList"];
        if (Array.isArray(listData)) {
            return listData.map((item) => schema_1.위임자Schema.parse({
                ...item,
                engagementStatus: item.agreStsCdNm === "수임동의"
                    ? types_1.EngagementStatus.ENGAGED
                    : types_1.EngagementStatus.TERMINATED,
            }));
        }
        return [];
    }
    async 특별징수신고내역(searchStart, searchEnd) {
        const formattedSearchStart = (0, date_fns_1.format)(searchStart, "yyyyMMdd");
        const formattedSearchEnd = (0, date_fns_1.format)(searchEnd, "yyyyMMdd");
        console.log(`검색 일자: ${formattedSearchStart} ~ ${formattedSearchEnd}`);
        const data = {
            searchConditionVO: {
                txiCd: "140004",
                inqYmdBgng: formattedSearchStart,
                inqYmdEnd: formattedSearchEnd,
            },
            common: {
                sPgmId: "B070102",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getListSpctxOprat`, data);
        const listData = response.data["spctxOpratDVOList"];
        if (Array.isArray(listData)) {
            return listData.map((item) => schema_1.특별징수신고내역Schema.parse(item));
        }
        return [];
    }
    async 특별징수신고내역상세(dclrId, fileDclrGrpId) {
        const data = {
            spctxOpratDetailDVO: { dclrId, fileDclrGrpId },
            common: {
                sPgmId: "B070102",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getSpctxOpratDetail`, data);
        const detailData = response.data["spctxOpratDetailDVO"];
        return schema_1.특별징수신고내역상세Schema.parse(detailData);
    }
    async 종합소득분신고내역(searchStart, searchEnd) {
        const formattedSearchStart = (0, date_fns_1.format)(searchStart, "yyyyMMdd");
        const formattedSearchEnd = (0, date_fns_1.format)(searchEnd, "yyyyMMdd");
        const data = {
            pliDclrParamDVO: {
                txiCd: "140001",
                objCd: "C",
            },
            pliDclrDVO: {
                inqYmdBgng: formattedSearchStart,
                inqYmdEnd: formattedSearchEnd,
                inqClCd: "01",
            },
            common: {
                sPgmId: "B070202",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/pliDclr/getPliDclrDtcnList`, data);
        const listData = response.data["pliDclrDVOList"];
        if (Array.isArray(listData)) {
            return listData.map((item) => schema_1.종합소득분신고내역Schema.parse(item));
        }
        return [];
    }
    async 종합소득분신고내역상세(dclrId, fileDclrGrpId) {
        const data = {
            pliDclrParamDVO: { dclrId, fileDclrGrpId, objCd: "C", nowDclrScrnNo: "02" },
            common: {
                sPgmId: "B070202",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/pliDclr/getPageIntl`, data);
        const detailData = response.data["tolart010mDVO"];
        return schema_1.종합소득분신고내역상세Schema.parse(detailData);
    }
    async 법인소득분신고내역(searchStart, searchEnd) {
        const formattedSearchStart = (0, date_fns_1.format)(searchStart, "yyyyMMdd");
        const formattedSearchEnd = (0, date_fns_1.format)(searchEnd, "yyyyMMdd");
        const data = {
            clitxDclrParamDVO: {
                txiCd: "140003",
                inqYmdBgng: formattedSearchStart,
                inqYmdEnd: formattedSearchEnd,
                inqCond: "1",
            },
            common: {
                sPgmId: "B070403",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/clitxDclr/getListCliDclrCmptn`, data);
        const listData = response.data["clitxDclrDVOList"];
        if (Array.isArray(listData)) {
            return listData.map((item) => schema_1.법인소득분신고내역Schema.parse(item));
        }
        return [];
    }
    async 법인소득분신고내역상세(dclrId, cliDclrId) {
        const data = {
            clitxDclrParamDVO: { dclrId, cliDclrId, pdiSn: "100001" },
            common: {
                sPgmId: "B070403",
            },
            ...WetaxScrapper.PAGE_INFO,
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/clitxDclr/getClitxDclrDtl`, data);
        const detailData = response.data["tolart010mDVO"];
        return schema_1.법인소득분신고내역상세Schema.parse(detailData);
    }
    /**
     * 특별징수 신고서의 납세의무자별 상세 정보 조회
     * @param dclrId 신고ID
     * @returns 신고서 기본 정보 및 납세의무자별 상세 정보
     */
    async 특별징수신고서납세의무자별상세(dclrId) {
        const data = {
            spctxOpratRptDVO: { dclrId },
            common: {
                uxId: (0, crypto_1.randomUUID)(),
                sPgmId: "B070102",
                menuId: "",
            },
        };
        const response = await this.client.post(`${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getReportData`, data);
        return schema_1.특별징수신고서납세의무자별상세Schema.parse(response.data);
    }
}
exports.WetaxScrapper = WetaxScrapper;
WetaxScrapper.LOGIN_SUCCESS_CODE = "S";
WetaxScrapper.BASE_URL = "https://www.wetax.go.kr";
WetaxScrapper.PAGE_INFO = { pagerVO: { pageNo: 1, rowCount: 1000 } };
