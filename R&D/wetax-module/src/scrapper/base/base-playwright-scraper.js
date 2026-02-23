"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePlaywrightScraper = void 0;
const playwright_1 = require("playwright");
class BasePlaywrightScraper {
    constructor(cookies, baseUrl) {
        this.baseUrl = baseUrl;
        this.browser = playwright_1.chromium;
        this.cookies = cookies.map((cookie) => ({
            name: cookie.key,
            value: cookie.value,
            domain: cookie.domain ?? undefined,
            path: cookie.path ?? undefined,
            httpOnly: cookie.httpOnly ?? undefined,
            secure: cookie.secure ?? undefined,
            expires: cookie.expires instanceof Date
                ? Math.floor(cookie.expires.getTime() / 1000)
                : undefined,
            sameSite: cookie.sameSite &&
                ["Strict", "Lax", "None"].includes(cookie.sameSite)
                ? cookie.sameSite
                : undefined,
        }));
    }
    /**
     * 새 창으로 열리는 팝업을 처리합니다.
     */
    async handlePopupWindow(page, triggerAction, popupButtonSelector) {
        const popupPromise = page.waitForEvent("popup");
        await triggerAction();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        if (popupButtonSelector) {
            await popup.locator(popupButtonSelector).click();
            await popup.close();
        }
        return popup;
    }
    /**
     * 모달 다이얼로그의 버튼을 클릭합니다.
     */
    async clickModalButton(page, modalButtonSelector, waitBeforeClick = 500) {
        await page.waitForTimeout(waitBeforeClick);
        await page.locator(modalButtonSelector).click();
    }
    async getInitialPage(headless = true, autoAcceptDialogs = true, enableCdp) {
        // 기존 context가 있고 유효한지 확인
        if (enableCdp) {
            const browser = await playwright_1.chromium.connectOverCDP("http://localhost:9222");
            const context = browser.contexts()[0] ?? (await browser.newContext());
            this.context = context;
            const page = await context.newPage();
            this.page = page;
            await page.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", {
                    get: () => undefined,
                });
                window.chrome = { runtime: {} };
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => parameters.name === "notifications"
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
            });
            if (autoAcceptDialogs) {
                this.page.on("dialog", async (dialog) => {
                    console.log(`팝업 감지: ${dialog.type()} - ${dialog.message()}`);
                    await dialog.accept();
                });
            }
            return this.page;
        }
        if (this.context) {
            try {
                const browser = this.context.browser();
                if (browser?.isConnected()) {
                    if (this.page && !this.page.isClosed()) {
                        return this.page;
                    }
                    const page = await this.context.newPage();
                    this.page = page;
                    return page;
                }
            }
            catch (error) {
                console.warn("기존 context가 닫혀있음, 새로 생성합니다:", error);
            }
        }
        const context = await this.browser.launchPersistentContext(BasePlaywrightScraper.BROWSER_PROFILE, {
            headless,
            acceptDownloads: true,
            viewport: { width: 1920, height: 1080 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
            ],
            timeout: 60000,
            ignoreHTTPSErrors: true,
        });
        this.context = context;
        const page = await this.context.newPage();
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", {
                get: () => undefined,
            });
            window.chrome = {
                runtime: {},
            };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => parameters.name === "notifications"
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);
        });
        this.page = page;
        if (autoAcceptDialogs) {
            this.page.on("dialog", async (dialog) => {
                console.log(`팝업 감지: ${dialog.type()} - ${dialog.message()}`);
                await dialog.accept();
            });
        }
        return this.page;
    }
    async setCookies() {
        if (!this.page || this.page.isClosed()) {
            throw new Error("Page가 닫혔거나 존재하지 않습니다. getInitialPage()를 먼저 호출하세요.");
        }
        if (!this.context) {
            throw new Error("Context가 존재하지 않습니다. getInitialPage()를 먼저 호출하세요.");
        }
        try {
            await this.page.goto(this.baseUrl, { waitUntil: "domcontentloaded" });
            await this.context.clearCookies();
            await this.context.addCookies(this.cookies);
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes("Target page, context or browser has been closed")) {
                throw new Error("페이지 또는 컨텍스트가 닫혔습니다. getInitialPage()를 다시 호출하세요.");
            }
            throw error;
        }
    }
}
exports.BasePlaywrightScraper = BasePlaywrightScraper;
BasePlaywrightScraper.BROWSER_PROFILE = "tax-profile";
