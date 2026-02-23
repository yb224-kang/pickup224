"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_cookiejar_support_1 = require("axios-cookiejar-support");
const tough_cookie_1 = require("tough-cookie");
/**
 * 세션 관리 클래스
 * 여러 API 호출 동안 쿠키를 자동으로 관리합니다.
 */
class SessionManager {
    constructor() {
        // CookieJar 초기화
        this.cookieJar = new tough_cookie_1.CookieJar();
        this.client = (0, axios_cookiejar_support_1.wrapper)(axios_1.default.create({
            jar: this.cookieJar,
        }));
    }
    /**
     * 특정 URL의 쿠키를 가져옵니다.
     */
    async getCookies(url = "https://www.wetax.go.kr") {
        return await this.cookieJar.getCookies(url);
    }
    /**
     * 특정 쿠키 값을 가져옵니다.
     */
    async getCookieValue(cookieName, url = "https://www.wetax.go.kr") {
        return new Promise((resolve, reject) => {
            this.cookieJar.getCookies(url, (err, cookies) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!cookies) {
                    resolve(null);
                    return;
                }
                const cookie = cookies.find((c) => c.key === cookieName);
                resolve(cookie ? cookie.value : null);
            });
        });
    }
    /**
     * 여러 쿠키 값을 한번에 가져옵니다.
     */
    async getCookieValues(cookieNames, url = "https://www.wetax.go.kr") {
        return new Promise((resolve, reject) => {
            this.cookieJar.getCookies(url, (err, cookies) => {
                if (err) {
                    reject(err);
                    return;
                }
                const result = {};
                if (!cookies) {
                    for (const name of cookieNames) {
                        result[name] = null;
                    }
                    resolve(result);
                    return;
                }
                for (const name of cookieNames) {
                    const cookie = cookies.find((c) => c.key === name);
                    result[name] = cookie ? cookie.value : null;
                }
                resolve(result);
            });
        });
    }
    /**
     * 모든 쿠키를 초기화합니다.
     */
    async clearCookies() {
        return new Promise((resolve, reject) => {
            this.cookieJar.removeAllCookies((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.SessionManager = SessionManager;
