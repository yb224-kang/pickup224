import { CertificateData } from "./interfaces/certificate.interface";
import { CertificateSigner } from "./interfaces/certificate-signer.interface";
import { StorageService } from "./interfaces/storage.interface";
import { Logger, ConsoleLogger } from "./interfaces/logger.interface";
import { WetaxScrapper } from "../scrapper/wetax/wetax-scrapper";
import { WetaxPlaywrightScraper, ReportInfo } from "../scrapper/wetax/wetax-playwright-scraper";
import {
  법인소득분신고내역,
  위임자,
  종합소득분신고내역,
  특별징수신고내역,
} from "../scrapper/wetax/schema";
import { splitDateRange } from "../utils/date.util";
import { startOfDay, subYears, subDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

export class WetaxService {
  private readonly logger: Logger;

  constructor(
    private readonly certificateSigner: CertificateSigner,
    private readonly loggerImpl?: Logger
  ) {
    this.logger = loggerImpl || new ConsoleLogger();
  }

  /**
   * 위택스 클라이언트(위임자) 목록 조회
   */
  async getWetaxClients(
    certificate: CertificateData
  ): Promise<Record<string, 위임자[]>> {
    const scrapper = new WetaxScrapper(
      [certificate],
      certificate.certPassword,
      this.certificateSigner
    );

    await scrapper.login();

    const allResults: 위임자[] = [];
    const koreaTimeZone = "Asia/Seoul";
    const now = new Date();
    const koreaNow = new TZDate(now, koreaTimeZone);
    const today = startOfDay(koreaNow);

    let searchEnd = new Date(today);
    let searchStart = subYears(today, 1);

    while (true) {
      const result = await scrapper.위임자(searchStart, searchEnd);

      if (result.length === 0) {
        break;
      }

      allResults.push(...result);

      searchEnd = subDays(searchStart, 1);
      searchStart = subYears(searchEnd, 1);
    }

    allResults.forEach((item) => {
      if (!item.dlgpBzmnId || !item.dlgpBrno) {
        this.logger.warn(
          `dlgpBzmnId 또는 사업자번호 없음 dlgpBzmnId: ${item.dlgpBzmnId} / brno: ${item.dlgpBrno}`
        );
      }
    });

    const filteredResult = allResults.filter(
      (item) => item.dlgpBrno && item.dlgpBzmnId
    );

    const groupedResult: Record<string, 위임자[]> = {};

    for (const item of filteredResult) {
      const key = item.dlgpBzmnId!;
      if (!groupedResult[key]) {
        groupedResult[key] = [];
      }
      groupedResult[key].push(item);
    }

    return groupedResult;
  }

  /**
   * 원천세 신고내역 조회
   */
  async getWetaxWithholdingTaxReportDetail(
    certificate: CertificateData,
    searchStart: Date,
    searchEnd: Date,
    reportId?: string
  ): Promise<특별징수신고내역[]> {
    const scrapper = new WetaxScrapper(
      [certificate],
      certificate.certPassword,
      this.certificateSigner
    );
    await scrapper.login();

    // 위택스는 최근 12개월까지만 검색 가능하므로 12개월 단위로 분할
    const dateRanges = splitDateRange(searchStart, searchEnd, {
      type: "month",
      value: 12,
    });
    const allResults: 특별징수신고내역[] = [];

    for (const dateRange of dateRanges) {
      const result = await scrapper.특별징수신고내역(
        dateRange.startDate,
        dateRange.endDate
      );
      const filteredResult = result.filter(
        (item) =>
          item.dclrId &&
          item.dclrBzmnId &&
          (reportId ? item.dclrId === reportId : true)
      );
      allResults.push(...filteredResult);
    }

    const resultsWithDetails = await this.includeReportDetails(
      allResults,
      scrapper
    );

    return resultsWithDetails;
  }

  /**
   * 종합소득세 신고내역 조회
   */
  async getWetaxIncomeTaxReportDetail(
    certificate: CertificateData,
    searchStart: Date,
    searchEnd: Date,
    reportId?: string
  ): Promise<종합소득분신고내역[]> {
    const scrapper = new WetaxScrapper(
      [certificate],
      certificate.certPassword,
      this.certificateSigner
    );
    await scrapper.login();

    const dateRanges = splitDateRange(searchStart, searchEnd, {
      type: "year",
      value: 1,
    });
    const allResults: 종합소득분신고내역[] = [];

    for (const dateRange of dateRanges) {
      const result = await scrapper.종합소득분신고내역(
        dateRange.startDate,
        dateRange.endDate
      );
      const filteredResult = result.filter(
        (item) =>
          item.dclrId &&
          item.detail?.dclrBzmnId &&
          (reportId ? item.dclrId === reportId : true)
      );
      allResults.push(...filteredResult);
    }

    const resultsWithDetails = await this.includeIncomeTaxReportDetails(
      allResults,
      scrapper
    );

    return resultsWithDetails;
  }

  /**
   * 법인세 신고내역 조회
   */
  async getWetaxCorporateIncomeTaxReportDetail(
    certificate: CertificateData,
    searchStart: Date,
    searchEnd: Date,
    reportId?: string
  ): Promise<법인소득분신고내역[]> {
    const scrapper = new WetaxScrapper(
      [certificate],
      certificate.certPassword,
      this.certificateSigner
    );
    await scrapper.login();

    const dateRanges = splitDateRange(searchStart, searchEnd, {
      type: "year",
      value: 1,
    });
    const allResults: 법인소득분신고내역[] = [];

    for (const dateRange of dateRanges) {
      const result = await scrapper.법인소득분신고내역(
        dateRange.startDate,
        dateRange.endDate
      );
      const filteredResult = result.filter(
        (item) =>
          item.dclrId &&
          item.cliDclrId &&
          (reportId ? item.dclrId === reportId : true)
      );
      allResults.push(...filteredResult);
    }

    const resultsWithDetails = await this.includeCorporateIncomeTaxReportDetails(
      allResults,
      scrapper
    );

    const filterdResults = resultsWithDetails.filter(
      (item) => item.detail && !!item.detail.dclrBzmnId
    );

    return filterdResults;
  }

  /**
   * 파일 다운로드
   */
  async downloadDocument(
    certificate: CertificateData,
    reportId: string,
    taxType: string,
    tin: string,
    paymentNumber?: string,
    storageService?: StorageService,
    onFileUploaded?: (file: {
      reportId: string;
      savedPath: string;
      isPayment: boolean;
      buffer: Buffer;
    }) => Promise<void> | void
  ): Promise<{ reportId: string; savedPath: string; isPayment: boolean }[]> {
    const scrapper = new WetaxScrapper(
      [certificate],
      certificate.certPassword,
      this.certificateSigner
    );
    await scrapper.login();
    const cookies = await scrapper.getCookies("https://www.wetax.go.kr");
    const playwrightScrapper = new WetaxPlaywrightScraper(cookies);

    const reportInfoMap: Record<string, ReportInfo> = {
      [reportId]: {
        reportYear: new Date().getFullYear(),
        reportMonth: new Date().getMonth() + 1,
        tin: tin,
        type: taxType as any,
        paymentNumber: paymentNumber,
      },
    };

    let downloadResults: {
      reportId: string;
      savedPath: string;
      isPayment: boolean;
    }[] = [];

    if (taxType === "원천세") {
      const withholdingTaxReportDownloadResults =
        await playwrightScrapper.downloadWithholdingTaxReportFile({
          headless: true,
          reportIds: [reportId],
          reportInfoMap: reportInfoMap,
          storageService,
          onFileUploaded,
        });
      const withholdingTaxPaymentDownloadResults =
        await playwrightScrapper.downloadWithholdingTaxPaymentFile({
          headless: true,
          reportIds: [reportId],
          reportInfoMap: reportInfoMap,
          storageService,
          onFileUploaded,
        });
      downloadResults.push(
        ...withholdingTaxReportDownloadResults,
        ...withholdingTaxPaymentDownloadResults
      );
    }
    if (taxType === "법인세") {
      const corporateTaxReportDownloadResults =
        await playwrightScrapper.downloadCorporateTaxReportFile({
          headless: true,
          reportIds: [reportId],
          reportInfoMap: reportInfoMap,
          storageService,
          onFileUploaded,
        });
      downloadResults.push(...corporateTaxReportDownloadResults);
    }
    if (taxType === "종합소득세") {
      const incomeTaxReportDownloadResults =
        await playwrightScrapper.downloadIncomeTaxReportFile({
          headless: true,
          reportIds: [reportId],
          reportInfoMap: reportInfoMap,
          storageService,
          onFileUploaded,
        });
      downloadResults.push(...incomeTaxReportDownloadResults);
    }

    return downloadResults;
  }

  private async includeReportDetails(
    reports: 특별징수신고내역[],
    scrapper: WetaxScrapper
  ): Promise<특별징수신고내역[]> {
    const BATCH_SIZE = 10;
    const results: 특별징수신고내역[] = [];

    for (let i = 0; i < reports.length; i += BATCH_SIZE) {
      const batch = reports.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (report) => {
        try {
          const detail = await scrapper.특별징수신고내역상세(report.dclrId);
          report.detail = detail;
          return report;
        } catch (error) {
          this.logger.error(
            `Failed to fetch detail for dclrId ${report.dclrId}:`,
            error
          );
          return report;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private async includeIncomeTaxReportDetails(
    reports: 종합소득분신고내역[],
    scrapper: WetaxScrapper
  ): Promise<종합소득분신고내역[]> {
    const BATCH_SIZE = 10;
    const results: 종합소득분신고내역[] = [];

    for (let i = 0; i < reports.length; i += BATCH_SIZE) {
      const batch = reports.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (report) => {
        try {
          const detail = await scrapper.종합소득분신고내역상세(report.dclrId);
          report.detail = detail;
          return report;
        } catch (error) {
          this.logger.error(
            `Failed to fetch detail for dclrId ${report.dclrId}:`,
            error
          );
          return report;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  private async includeCorporateIncomeTaxReportDetails(
    reports: 법인소득분신고내역[],
    scrapper: WetaxScrapper
  ): Promise<법인소득분신고내역[]> {
    const BATCH_SIZE = 10;
    const results: 법인소득분신고내역[] = [];

    for (let i = 0; i < reports.length; i += BATCH_SIZE) {
      const batch = reports.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (report) => {
        try {
          const detail = await scrapper.법인소득분신고내역상세(
            report.dclrId,
            report.cliDclrId!
          );
          return { ...report, detail };
        } catch (error) {
          this.logger.error(
            `Failed to fetch detail for dclrId ${report.dclrId} and cliDclrId ${report.cliDclrId}:`,
            error
          );
          return report;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }
}

