import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { Cookie, CookieJar } from "tough-cookie";

/**
 * Hometax session class with cookie management using tough-cookie
 * 여러 API 호출 동안 쿠키를 자동으로 관리합니다.
 */
export class SessionManager {
  public readonly cookieJar: CookieJar;
  public readonly client: AxiosInstance;

  constructor() {
    // CookieJar 초기화
    this.cookieJar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.cookieJar,
      }),
    );
  }

  /**
   * 특정 URL의 쿠키를 가져옵니다.
   */
  async getCookies(url: string = "https://hometax.go.kr"): Promise<Cookie[]> {
    return await this.cookieJar.getCookies(url);
  }

  /**
   * 특정 쿠키 값을 가져옵니다.
   */
  async getCookieValue(
    cookieName: string,
    url: string = "https://hometax.go.kr",
  ): Promise<string | null> {
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
  async getCookieValues(
    cookieNames: string[],
    url: string = "https://hometax.go.kr",
  ): Promise<Record<string, string | null>> {
    return new Promise((resolve, reject) => {
      this.cookieJar.getCookies(url, (err, cookies) => {
        if (err) {
          reject(err);
          return;
        }

        const result: Record<string, string | null> = {};

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
  async clearCookies(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cookieJar.removeAllCookies((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}



