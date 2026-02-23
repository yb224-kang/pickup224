import { BaseScrapper } from "../base/base-scrapper";
import { CertificateData } from "../../services/interfaces/certificate.interface";
import { CertificateSigner } from "../../services/interfaces/certificate-signer.interface";
import { EngagementStatus } from "../../core/types";
import {
  법인소득분신고내역,
  법인소득분신고내역Schema,
  법인소득분신고내역상세,
  법인소득분신고내역상세Schema,
  위임자,
  위임자Schema,
  종합소득분신고내역,
  종합소득분신고내역Schema,
  종합소득분신고내역상세,
  종합소득분신고내역상세Schema,
  특별징수신고내역,
  특별징수신고내역Schema,
  특별징수신고내역상세,
  특별징수신고내역상세Schema,
  특별징수신고서납세의무자별상세,
  특별징수신고서납세의무자별상세Schema,
} from "./schema";
import { format } from "date-fns";
import { randomUUID } from "crypto";

export class WetaxScrapper extends BaseScrapper {
  static readonly LOGIN_SUCCESS_CODE = "S";
  static readonly BASE_URL = "https://www.wetax.go.kr";
  static readonly PAGE_INFO = { pagerVO: { pageNo: 1, rowCount: 1000 } };

  constructor(
    certificates: CertificateData[],
    protected readonly password: string,
    certificateSigner: CertificateSigner
  ) {
    super(certificates, password, certificateSigner);
  }

  async login(): Promise<void> {
    // 외부 인증서 서명 모듈 사용
    const signer = this.certificateSigner.loadCert(this.certFiles, this.password);
    signer.validateCertExpiry();

    const pkcs7Signed = signer.pkcs7SignedMsg(
      Buffer.from(this.password, "utf-8")
    );
    const signedBase64 = pkcs7Signed.toString("base64");

    const loginData = {
      lgnDVO: {
        wtxSysClCd: "01",
        lgnCertMtdCd: "01",
        athcfInfCn: signedBase64,
      },
    };

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/tcp/api/lgn/login`,
      loginData
    );

    if (
      !(
        response.data &&
        response.data?.common?.prcsRsltCd === WetaxScrapper.LOGIN_SUCCESS_CODE
      )
    ) {
      throw new Error("로그인 실패");
    }
  }

  async 위임자(searchStart: Date, searchEnd: Date): Promise<위임자[]> {
    const formattedSearchStart = format(searchStart, "yyyyMMdd");
    const formattedSearchEnd = format(searchEnd, "yyyyMMdd");

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

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etq/api/tafAgtEusDlgp/getListTafAgtDlgpSearch`,
      data
    );

    const listData = response.data["tafAgtEusDlgpDVOList"];
    if (Array.isArray(listData)) {
      return listData.map((item) =>
        위임자Schema.parse({
          ...item,
          engagementStatus:
            item.agreStsCdNm === "수임동의"
              ? EngagementStatus.ENGAGED
              : EngagementStatus.TERMINATED,
        })
      );
    }
    return [];
  }

  async 특별징수신고내역(
    searchStart: Date,
    searchEnd: Date
  ): Promise<특별징수신고내역[]> {
    const formattedSearchStart = format(searchStart, "yyyyMMdd");
    const formattedSearchEnd = format(searchEnd, "yyyyMMdd");

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

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getListSpctxOprat`,
      data
    );

    const listData = response.data["spctxOpratDVOList"];
    if (Array.isArray(listData)) {
      return listData.map((item) => 특별징수신고내역Schema.parse(item));
    }

    return [];
  }

  async 특별징수신고내역상세(
    dclrId: string,
    fileDclrGrpId?: string
  ): Promise<특별징수신고내역상세> {
    const data = {
      spctxOpratDetailDVO: { dclrId, fileDclrGrpId },
      common: {
        sPgmId: "B070102",
      },
      ...WetaxScrapper.PAGE_INFO,
    };

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getSpctxOpratDetail`,
      data
    );

    const detailData = response.data["spctxOpratDetailDVO"];
    return 특별징수신고내역상세Schema.parse(detailData);
  }

  async 종합소득분신고내역(
    searchStart: Date,
    searchEnd: Date
  ): Promise<종합소득분신고내역[]> {
    const formattedSearchStart = format(searchStart, "yyyyMMdd");
    const formattedSearchEnd = format(searchEnd, "yyyyMMdd");

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

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/pliDclr/getPliDclrDtcnList`,
      data
    );

    const listData = response.data["pliDclrDVOList"];
    if (Array.isArray(listData)) {
      return listData.map((item) => 종합소득분신고내역Schema.parse(item));
    }

    return [];
  }

  async 종합소득분신고내역상세(
    dclrId: string,
    fileDclrGrpId?: string
  ): Promise<종합소득분신고내역상세> {
    const data = {
      pliDclrParamDVO: { dclrId, fileDclrGrpId, objCd: "C", nowDclrScrnNo: "02" },
      common: {
        sPgmId: "B070202",
      },
      ...WetaxScrapper.PAGE_INFO,
    };

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/pliDclr/getPageIntl`,
      data
    );

    const detailData = response.data["tolart010mDVO"];
    return 종합소득분신고내역상세Schema.parse(detailData);
  }

  async 법인소득분신고내역(
    searchStart: Date,
    searchEnd: Date
  ): Promise<법인소득분신고내역[]> {
    const formattedSearchStart = format(searchStart, "yyyyMMdd");
    const formattedSearchEnd = format(searchEnd, "yyyyMMdd");

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

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/clitxDclr/getListCliDclrCmptn`,
      data
    );

    const listData = response.data["clitxDclrDVOList"];
    if (Array.isArray(listData)) {
      return listData.map((item) => 법인소득분신고내역Schema.parse(item));
    }

    return [];
  }

  async 법인소득분신고내역상세(
    dclrId: string,
    cliDclrId: string
  ): Promise<법인소득분신고내역상세> {
    const data = {
      clitxDclrParamDVO: { dclrId, cliDclrId, pdiSn: "100001" },
      common: {
        sPgmId: "B070403",
      },
      ...WetaxScrapper.PAGE_INFO,
    };

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/clitxDclr/getClitxDclrDtl`,
      data
    );

    const detailData = response.data["tolart010mDVO"];
    return 법인소득분신고내역상세Schema.parse(detailData);
  }

  /**
   * 특별징수 신고서의 납세의무자별 상세 정보 조회
   * @param dclrId 신고ID
   * @returns 신고서 기본 정보 및 납세의무자별 상세 정보
   */
  async 특별징수신고서납세의무자별상세(
    dclrId: string
  ): Promise<특별징수신고서납세의무자별상세> {
    const data = {
      spctxOpratRptDVO: { dclrId },
      common: {
        uxId: randomUUID(),
        sPgmId: "B070102",
        menuId: "",
      },
    };

    const response = await this.client.post(
      `${WetaxScrapper.BASE_URL}/etr/api/spctxOprat/getReportData`,
      data
    );

    return 특별징수신고서납세의무자별상세Schema.parse(response.data);
  }
}

