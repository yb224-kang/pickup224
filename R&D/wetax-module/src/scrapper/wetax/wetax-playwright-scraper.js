"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WetaxPlaywrightScraper = void 0;
const base_playwright_scraper_1 = require("../base/base-playwright-scraper");
const path_1 = __importDefault(require("path"));
const node_fs_1 = __importDefault(require("node:fs"));
class WetaxPlaywrightScraper extends base_playwright_scraper_1.BasePlaywrightScraper {
    constructor(cookies) {
        super(cookies, `${WetaxPlaywrightScraper.BASE_URL}/main.do`);
    }
    /**
     * 위택스에서 원천세 신고서 파일을 다운로드합니다.
     */
    async downloadWithholdingTaxReportFile(options) {
        const { headless = true, autoAcceptDialogs = true, reportIds, reportInfoMap, storageService, onFileUploaded, } = options;
        try {
            const page = await super.getInitialPage(headless, autoAcceptDialogs);
            await super.setCookies();
            await page.goto(`${WetaxPlaywrightScraper.BASE_URL}/etr/lit/b0701/B070102M01.do`);
            const downloadResults = [];
            for (const reportId of reportIds) {
                const filePath = storageService
                    ? this.generateS3Key(reportId, reportInfoMap?.[reportId])
                    : this.generateFilePath(reportId);
                const reportInfo = reportInfoMap?.[reportId] ?? undefined;
                try {
                    const buffer = await this.downloadSingleWithholdingTaxReportFile(page, reportId, filePath, reportInfo, storageService);
                    downloadResults.push({
                        reportId,
                        savedPath: filePath,
                        isPayment: false,
                    });
                    if (onFileUploaded && buffer) {
                        await onFileUploaded({
                            reportId,
                            savedPath: filePath,
                            isPayment: false,
                            buffer,
                        });
                    }
                }
                catch (error) {
                    console.error(`신고서 리포트 ID: ${reportId} 다운로드 실패: ${error}`);
                    continue;
                }
            }
            await this.context?.close();
            return downloadResults;
        }
        catch (error) {
            console.error(error);
        }
        return [];
    }
    /**
     * 위택스에서 원천세 납부서 파일을 다운로드합니다.
     */
    async downloadWithholdingTaxPaymentFile(options) {
        const { headless = true, autoAcceptDialogs = true, reportIds, reportInfoMap, storageService, onFileUploaded, } = options;
        try {
            const page = await super.getInitialPage(headless, autoAcceptDialogs);
            await super.setCookies();
            await page.goto(`${WetaxPlaywrightScraper.BASE_URL}/etr/lit/b0701/B070102M01.do`);
            const downloadResults = [];
            for (const reportId of reportIds) {
                const filePath = storageService
                    ? this.generateS3Key(reportId, reportInfoMap?.[reportId])
                    : this.generateFilePath(reportId);
                const reportInfo = reportInfoMap?.[reportId] ?? undefined;
                const paymentNumber = reportInfoMap?.[reportId]?.paymentNumber;
                try {
                    const buffer = await this.downloadSingleWithholdingTaxPaymentFile(page, reportId, filePath, paymentNumber, reportInfo, storageService);
                    downloadResults.push({
                        reportId,
                        savedPath: filePath,
                        isPayment: true,
                    });
                    if (onFileUploaded && buffer) {
                        await onFileUploaded({
                            reportId,
                            savedPath: filePath,
                            isPayment: true,
                            buffer,
                        });
                    }
                }
                catch (error) {
                    console.error(`납부서 리포트 ID: ${reportId} 다운로드 실패: ${error}`);
                    continue;
                }
            }
            await this.context?.close();
            return downloadResults;
        }
        catch (error) {
            console.error(error);
        }
        return [];
    }
    /**
     * 위택스에서 종합소득세 신고서 파일을 다운로드합니다.
     */
    async downloadIncomeTaxReportFile(options) {
        const { headless = true, autoAcceptDialogs = true, reportIds, reportInfoMap, storageService, onFileUploaded, } = options;
        try {
            const page = await super.getInitialPage(headless, autoAcceptDialogs);
            await super.setCookies();
            await page.goto(`${WetaxPlaywrightScraper.BASE_URL}/etr/lit/b0702/B070202M01.do`);
            const downloadResults = [];
            for (const reportId of reportIds) {
                const filePath = storageService
                    ? this.generateS3Key(reportId, reportInfoMap?.[reportId])
                    : this.generateFilePath(reportId);
                const reportInfo = reportInfoMap?.[reportId] ?? undefined;
                try {
                    const buffer = await this.downloadSingleIncomeTaxReportFile(page, reportId, filePath, reportInfo, storageService);
                    downloadResults.push({
                        reportId,
                        savedPath: filePath,
                        isPayment: false,
                    });
                    if (onFileUploaded && buffer) {
                        await onFileUploaded({
                            reportId,
                            savedPath: filePath,
                            isPayment: false,
                            buffer,
                        });
                    }
                }
                catch (error) {
                    console.error(`신고서 리포트 ID: ${reportId} 다운로드 실패: ${error}`);
                    continue;
                }
            }
            await this.context?.close();
            return downloadResults;
        }
        catch (error) {
            console.error(error);
        }
        return [];
    }
    /**
     * 위택스에서 법인세 신고서 파일을 다운로드합니다.
     */
    async downloadCorporateTaxReportFile(options) {
        const { headless = true, autoAcceptDialogs = true, reportIds, reportInfoMap, storageService, onFileUploaded, } = options;
        try {
            const page = await super.getInitialPage(headless, autoAcceptDialogs);
            await super.setCookies();
            await page.goto(`${WetaxPlaywrightScraper.BASE_URL}/etr/lit/b0704/B070403M01.do`);
            const downloadResults = [];
            for (const reportId of reportIds) {
                const filePath = storageService
                    ? this.generateS3Key(reportId, reportInfoMap?.[reportId])
                    : this.generateFilePath(reportId);
                const reportInfo = reportInfoMap?.[reportId] ?? undefined;
                try {
                    const buffer = await this.downloadSingleCorporateTaxReportFile(page, reportId, filePath, reportInfo?.paymentNumber ?? "", reportInfo, storageService);
                    downloadResults.push({
                        reportId,
                        savedPath: filePath,
                        isPayment: false,
                    });
                    if (onFileUploaded && buffer) {
                        await onFileUploaded({
                            reportId,
                            savedPath: filePath,
                            isPayment: false,
                            buffer,
                        });
                    }
                }
                catch (error) {
                    console.error(`신고서 리포트 ID: ${reportId} 다운로드 실패: ${error}`);
                    continue;
                }
            }
            await this.context?.close();
            return downloadResults;
        }
        catch (error) {
            console.error(error);
        }
        return [];
    }
    async downloadSingleWithholdingTaxReportFile(page, reportId, savePath, reportInfo, storageService) {
        const params = {
            spctxOpratRptDVO: { dclrId: reportId },
            rptClCd: "1",
        };
        const pages = page.context().pages();
        for (const p of pages) {
            if (p !== page && !p.isClosed()) {
                try {
                    await p.close();
                }
                catch (e) {
                    // 이미 닫힌 팝업은 무시
                }
            }
        }
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 60000 }),
            page.evaluate((args) => {
                const fn = window.fnGetReport;
                if (typeof fn !== "function")
                    throw new Error("fnGetReport 미정의");
                fn(args);
            }, params),
        ]);
        await popup.waitForLoadState("networkidle", { timeout: 60000 });
        await popup.waitForTimeout(3000);
        try {
            return await this.downloadFile(popup, reportId, savePath, reportInfo, storageService);
        }
        catch (error) {
            await popup.screenshot({
                path: `/tmp/wetax-error-${Date.now()}.png`,
                fullPage: true,
            });
            console.error(error);
            await popup.close();
            throw error;
        }
    }
    async downloadSingleWithholdingTaxPaymentFile(page, reportId, savePath, paymentNumber, reportInfo, storageService) {
        const params = { dclrId: reportId, elpn: paymentNumber };
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 10000 }),
            page.evaluate((args) => {
                const fnReportHandler = window.fnReportHandler ||
                    globalThis.fnReportHandler ||
                    new Function("try { return fnReportHandler; } catch(e) { return null; }")();
                if (!fnReportHandler ||
                    typeof fnReportHandler.openPayBill !== "function")
                    throw new Error("fnReportHandler.openPayBill 미정의");
                fnReportHandler.openPayBill(args);
            }, params),
        ]);
        await popup.waitForLoadState("networkidle", { timeout: 60000 });
        await popup.waitForTimeout(3000);
        try {
            return await this.downloadFile(popup, reportId, savePath, reportInfo, storageService, true);
        }
        catch (error) {
            await popup.screenshot({
                path: `/tmp/wetax-error-${Date.now()}.png`,
                fullPage: true,
            });
            console.error(error);
            await popup.close();
            throw error;
        }
    }
    async downloadSingleIncomeTaxReportFile(page, reportId, savePath, reportInfo, storageService) {
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 60000 }),
            page.evaluate((args) => {
                const fn = window.fnPrintDclr;
                if (typeof fn !== "function")
                    throw new Error("fnPrintDclr 미정의");
                fn(args);
            }, reportId),
        ]);
        await popup.waitForLoadState("networkidle", { timeout: 60000 });
        await popup.waitForTimeout(2000);
        try {
            return await this.downloadFile(popup, reportId, savePath, reportInfo, storageService);
        }
        catch (error) {
            await popup.screenshot({
                path: `/tmp/wetax-error-${Date.now()}.png`,
                fullPage: true,
            });
            console.error(error);
            await popup.close();
            throw error;
        }
    }
    async downloadSingleCorporateTaxReportFile(page, reportId, savePath, paymentNumber, reportInfo, storageService) {
        const [popup] = await Promise.all([
            page.context().waitForEvent("page", { timeout: 60000 }),
            page.evaluate((args) => {
                const fn = window.dclrPrint;
                if (typeof fn !== "function")
                    throw new Error("dclrPrint 미정의");
                fn(args.reportId, "01", "1", args.paymentNumber, "V2024.1.01");
            }, { reportId, paymentNumber }),
        ]);
        await popup.waitForLoadState("networkidle", { timeout: 60000 });
        await popup.waitForTimeout(2000);
        try {
            return await this.downloadFile(popup, reportId, savePath, reportInfo, storageService);
        }
        catch (error) {
            await popup.screenshot({
                path: `/tmp/wetax-error-${Date.now()}.png`,
                fullPage: true,
            });
            console.error(error);
            await popup.close();
            throw error;
        }
    }
    async downloadFile(popup, reportId, savePath, reportInfo, storageService, isPayment = false) {
        const pdfButton = popup.locator("input.btnSAVEAS");
        console.log(`[Wetax] 리포트 ID ${reportId}: 저장 버튼 대기 중...`);
        const pdfDataUrlPromise = popup.evaluate(() => {
            const overlays = document.querySelectorAll(".ui-widget-overlay");
            overlays.forEach((overlay) => {
                overlay.remove();
            });
            return new Promise((resolve) => {
                const originalCreateObjectURL = URL.createObjectURL;
                URL.createObjectURL = (blob) => {
                    if (blob && blob.type === "application/pdf") {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            resolve(reader.result);
                        };
                        reader.readAsDataURL(blob);
                    }
                    return originalCreateObjectURL.call(URL, blob);
                };
            });
        });
        await pdfButton.waitFor({ state: "visible", timeout: 60000 });
        await pdfButton.click();
        console.log(`[Wetax] 리포트 ID ${reportId}: 저장 버튼 발견됨`);
        const exportDialog = popup.locator("div.ui-dialog:has(#oztab_exportdlg_filetype)");
        await exportDialog.waitFor({ state: "visible", timeout: 30000 });
        await exportDialog.locator("#oztab_exportdlg_filetype").selectOption({
            label: "Adobe PDF File(*.pdf)",
        });
        const downloadButton = exportDialog.getByRole("button", { name: "확인" });
        await downloadButton.waitFor({ state: "visible", timeout: 30000 });
        await popup.waitForTimeout(500);
        if (popup.isClosed()) {
            throw new Error(`팝업이 예기치 않게 닫혔습니다. 리포트 ID: ${reportId}`);
        }
        await downloadButton.click();
        const pdfDataUrl = await pdfDataUrlPromise;
        const buffer = this.getBase64PdfBuffer(pdfDataUrl);
        if (storageService) {
            const contentType = "application/pdf";
            const s3Key = this.generateS3Key(reportId, reportInfo, isPayment);
            await storageService.uploadFile(buffer, s3Key, contentType);
        }
        else {
            node_fs_1.default.writeFileSync(savePath, buffer);
        }
        await popup.close();
        return buffer;
    }
    getBase64PdfBuffer(dataUrl) {
        const base64 = dataUrl.split(",")[1];
        const buffer = Buffer.from(base64, "base64");
        return buffer;
    }
    generateFilePath(reportId) {
        const fileName = `위택스_신고서_${reportId}.pdf`;
        return path_1.default.posix.join(process.cwd(), WetaxPlaywrightScraper.BASE_PATH, fileName);
    }
    generateS3Key(reportId, reportInfo, isPayment = false) {
        const { reportYear, reportMonth, tin, type } = reportInfo ?? {};
        const paddedReportMonth = reportMonth?.toString().padStart(2, "0") ?? "";
        return `tax-report/wetax/${tin}/${type}/${reportYear}${paddedReportMonth}_${reportId}_${isPayment ? "납부서" : "신고서"}.pdf`;
    }
}
exports.WetaxPlaywrightScraper = WetaxPlaywrightScraper;
WetaxPlaywrightScraper.BASE_URL = "https://www.wetax.go.kr";
WetaxPlaywrightScraper.BASE_PATH = "static/downloads/wetax";
