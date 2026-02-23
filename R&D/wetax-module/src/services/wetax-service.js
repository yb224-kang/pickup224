"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WetaxService = void 0;
const logger_interface_1 = require("./interfaces/logger.interface");
const wetax_scrapper_1 = require("../scrapper/wetax/wetax-scrapper");
const wetax_playwright_scraper_1 = require("../scrapper/wetax/wetax-playwright-scraper");
const date_util_1 = require("../utils/date.util");
const date_fns_1 = require("date-fns");
const tz_1 = require("@date-fns/tz");
class WetaxService {
    constructor(certificateSigner, loggerImpl) {
        this.certificateSigner = certificateSigner;
        this.loggerImpl = loggerImpl;
        this.logger = loggerImpl || new logger_interface_1.ConsoleLogger();
    }
    /**
     * 위택스 클라이언트(위임자) 목록 조회
     */
    async getWetaxClients(certificate) {
        const scrapper = new wetax_scrapper_1.WetaxScrapper([certificate], certificate.certPassword, this.certificateSigner);
        await scrapper.login();
        const allResults = [];
        const koreaTimeZone = "Asia/Seoul";
        const now = new Date();
        const koreaNow = new tz_1.TZDate(now, koreaTimeZone);
        const today = (0, date_fns_1.startOfDay)(koreaNow);
        let searchEnd = new Date(today);
        let searchStart = (0, date_fns_1.subYears)(today, 1);
        while (true) {
            const result = await scrapper.위임자(searchStart, searchEnd);
            if (result.length === 0) {
                break;
            }
            allResults.push(...result);
            searchEnd = (0, date_fns_1.subDays)(searchStart, 1);
            searchStart = (0, date_fns_1.subYears)(searchEnd, 1);
        }
        allResults.forEach((item) => {
            if (!item.dlgpBzmnId || !item.dlgpBrno) {
                this.logger.warn(`dlgpBzmnId 또는 사업자번호 없음 dlgpBzmnId: ${item.dlgpBzmnId} / brno: ${item.dlgpBrno}`);
            }
        });
        const filteredResult = allResults.filter((item) => item.dlgpBrno && item.dlgpBzmnId);
        const groupedResult = {};
        for (const item of filteredResult) {
            const key = item.dlgpBzmnId;
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
    async getWetaxWithholdingTaxReportDetail(certificate, searchStart, searchEnd, reportId) {
        const scrapper = new wetax_scrapper_1.WetaxScrapper([certificate], certificate.certPassword, this.certificateSigner);
        await scrapper.login();
        const dateRanges = (0, date_util_1.splitDateRange)(searchStart, searchEnd, {
            type: "year",
            value: 1,
        });
        const allResults = [];
        for (const dateRange of dateRanges) {
            const result = await scrapper.특별징수신고내역(dateRange.startDate, dateRange.endDate);
            const filteredResult = result.filter((item) => item.dclrId &&
                item.dclrBzmnId &&
                (reportId ? item.dclrId === reportId : true));
            allResults.push(...filteredResult);
        }
        const resultsWithDetails = await this.includeReportDetails(allResults, scrapper);
        return resultsWithDetails;
    }
    /**
     * 종합소득세 신고내역 조회
     */
    async getWetaxIncomeTaxReportDetail(certificate, searchStart, searchEnd, reportId) {
        const scrapper = new wetax_scrapper_1.WetaxScrapper([certificate], certificate.certPassword, this.certificateSigner);
        await scrapper.login();
        const dateRanges = (0, date_util_1.splitDateRange)(searchStart, searchEnd, {
            type: "year",
            value: 1,
        });
        const allResults = [];
        for (const dateRange of dateRanges) {
            const result = await scrapper.종합소득분신고내역(dateRange.startDate, dateRange.endDate);
            const filteredResult = result.filter((item) => item.dclrId &&
                item.detail?.dclrBzmnId &&
                (reportId ? item.dclrId === reportId : true));
            allResults.push(...filteredResult);
        }
        const resultsWithDetails = await this.includeIncomeTaxReportDetails(allResults, scrapper);
        return resultsWithDetails;
    }
    /**
     * 법인세 신고내역 조회
     */
    async getWetaxCorporateIncomeTaxReportDetail(certificate, searchStart, searchEnd, reportId) {
        const scrapper = new wetax_scrapper_1.WetaxScrapper([certificate], certificate.certPassword, this.certificateSigner);
        await scrapper.login();
        const dateRanges = (0, date_util_1.splitDateRange)(searchStart, searchEnd, {
            type: "year",
            value: 1,
        });
        const allResults = [];
        for (const dateRange of dateRanges) {
            const result = await scrapper.법인소득분신고내역(dateRange.startDate, dateRange.endDate);
            const filteredResult = result.filter((item) => item.dclrId &&
                item.cliDclrId &&
                (reportId ? item.dclrId === reportId : true));
            allResults.push(...filteredResult);
        }
        const resultsWithDetails = await this.includeCorporateIncomeTaxReportDetails(allResults, scrapper);
        const filterdResults = resultsWithDetails.filter((item) => item.detail && !!item.detail.dclrBzmnId);
        return filterdResults;
    }
    /**
     * 파일 다운로드
     */
    async downloadDocument(certificate, reportId, taxType, tin, paymentNumber, storageService, onFileUploaded) {
        const scrapper = new wetax_scrapper_1.WetaxScrapper([certificate], certificate.certPassword, this.certificateSigner);
        await scrapper.login();
        const cookies = await scrapper.getCookies("https://www.wetax.go.kr");
        const playwrightScrapper = new wetax_playwright_scraper_1.WetaxPlaywrightScraper(cookies);
        const reportInfoMap = {
            [reportId]: {
                reportYear: new Date().getFullYear(),
                reportMonth: new Date().getMonth() + 1,
                tin: tin,
                type: taxType,
                paymentNumber: paymentNumber,
            },
        };
        let downloadResults = [];
        if (taxType === "원천세") {
            const withholdingTaxReportDownloadResults = await playwrightScrapper.downloadWithholdingTaxReportFile({
                headless: true,
                reportIds: [reportId],
                reportInfoMap: reportInfoMap,
                storageService,
                onFileUploaded,
            });
            const withholdingTaxPaymentDownloadResults = await playwrightScrapper.downloadWithholdingTaxPaymentFile({
                headless: true,
                reportIds: [reportId],
                reportInfoMap: reportInfoMap,
                storageService,
                onFileUploaded,
            });
            downloadResults.push(...withholdingTaxReportDownloadResults, ...withholdingTaxPaymentDownloadResults);
        }
        if (taxType === "법인세") {
            const corporateTaxReportDownloadResults = await playwrightScrapper.downloadCorporateTaxReportFile({
                headless: true,
                reportIds: [reportId],
                reportInfoMap: reportInfoMap,
                storageService,
                onFileUploaded,
            });
            downloadResults.push(...corporateTaxReportDownloadResults);
        }
        if (taxType === "종합소득세") {
            const incomeTaxReportDownloadResults = await playwrightScrapper.downloadIncomeTaxReportFile({
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
    async includeReportDetails(reports, scrapper) {
        const BATCH_SIZE = 10;
        const results = [];
        for (let i = 0; i < reports.length; i += BATCH_SIZE) {
            const batch = reports.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (report) => {
                try {
                    const detail = await scrapper.특별징수신고내역상세(report.dclrId);
                    report.detail = detail;
                    return report;
                }
                catch (error) {
                    this.logger.error(`Failed to fetch detail for dclrId ${report.dclrId}:`, error);
                    return report;
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        return results;
    }
    async includeIncomeTaxReportDetails(reports, scrapper) {
        const BATCH_SIZE = 10;
        const results = [];
        for (let i = 0; i < reports.length; i += BATCH_SIZE) {
            const batch = reports.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (report) => {
                try {
                    const detail = await scrapper.종합소득분신고내역상세(report.dclrId);
                    report.detail = detail;
                    return report;
                }
                catch (error) {
                    this.logger.error(`Failed to fetch detail for dclrId ${report.dclrId}:`, error);
                    return report;
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        return results;
    }
    async includeCorporateIncomeTaxReportDetails(reports, scrapper) {
        const BATCH_SIZE = 10;
        const results = [];
        for (let i = 0; i < reports.length; i += BATCH_SIZE) {
            const batch = reports.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (report) => {
                try {
                    const detail = await scrapper.법인소득분신고내역상세(report.dclrId, report.cliDclrId);
                    return { ...report, detail };
                }
                catch (error) {
                    this.logger.error(`Failed to fetch detail for dclrId ${report.dclrId} and cliDclrId ${report.cliDclrId}:`, error);
                    return report;
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        return results;
    }
}
exports.WetaxService = WetaxService;
