/**
 * ref 스타일의 Node.js 스크립트로 홈택스 수임거래처 조회 테스트
 * ref의 HometaxScrapper 로직을 Node.js로 포팅
 * 
 * 실행 방법:
 *   cd backend
 *   node tests/integration/hometax/test-hometax-clients-ref-style.js
 */

// 프로젝트 루트로 이동 (process.cwd()가 올바른 경로를 가리키도록)
const path = require('path');
const originalCwd = process.cwd();
const backendDir = path.resolve(__dirname, '..', '..', '..');
const projectRoot = path.resolve(backendDir, '..');

// ts-node로 TypeScript 모듈 로드
process.chdir(projectRoot);
require('ts-node').register({
  project: path.join(backendDir, 'tsconfig.json'),
  transpileOnly: true,
});

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar, Cookie } = require('tough-cookie');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// SessionManager (개선: 쿠키 딕셔너리 우선 사용)
class SessionManager {
  constructor() {
    this.cookieJar = new CookieJar();
    this.cookies = {}; // 쿠키 딕셔너리 (우선순위 높음)
    this.tin = null;
    this.pubcUserNo = null;
    this.client = wrapper(
      axios.create({
        jar: this.cookieJar,
      })
    );
  }

  async getCookies(url = "https://hometax.go.kr") {
    return new Promise((resolve, reject) => {
      this.cookieJar.getCookies(url, (err, cookies) => {
        if (err) reject(err);
        else resolve(cookies || []);
      });
    });
  }

  // 쿠키 딕셔너리에서 쿠키 가져오기 (우선순위 높음)
  getCookieFromDict(name) {
    return this.cookies[name] || null;
  }

  // 쿠키 딕셔너리에 쿠키 설정
  setCookieInDict(name, value) {
    this.cookies[name] = value;
  }

  // Python에서 받은 쿠키를 쿠키 딕셔너리와 CookieJar에 모두 설정
  async setCookiesFromPython(cookiesDict, userInfo = null) {
    // 1. 쿠키 딕셔너리에 저장 (우선순위 높음)
    for (const [name, value] of Object.entries(cookiesDict)) {
      // NTS_LOGIN_SYSTEM_CODE_P 보호 (덮어쓰지 않음)
      if (name === 'NTS_LOGIN_SYSTEM_CODE_P' && this.cookies['NTS_LOGIN_SYSTEM_CODE_P']) {
        continue;
      }
      this.cookies[name] = value;
    }

    // ✅ 핵심: 사용자 정보 설정
    if (userInfo) {
      if (userInfo.pubcUserNo) {
        this.pubcUserNo = userInfo.pubcUserNo;
      }
      if (userInfo.tin) {
        this.tin = userInfo.tin;
      }
    }

    // 2. CookieJar에도 설정 (자동 관리용)
    const domains = [
      { domain: '.hometax.go.kr', url: 'https://hometax.go.kr' },
      { domain: '.hometax.go.kr', url: 'https://teht.hometax.go.kr' },
    ];
    
    for (const [name, value] of Object.entries(cookiesDict)) {
      for (const { domain, url } of domains) {
        try {
          const cookieString = `${name}=${value}; Domain=${domain}; Path=/`;
          const cookie = Cookie.parse(cookieString);
          if (cookie) {
            await new Promise((resolve) => {
              this.cookieJar.setCookie(cookie, url, (err) => {
                resolve(); // 에러 무시
              });
            });
          }
        } catch (e) {
          // 쿠키 설정 실패는 무시
        }
      }
    }
  }
}

// 간단한 HometaxScrapper (ref 스타일)
class HometaxScrapper extends SessionManager {
  static LOGIN_SUCCESS_CODE = "S";
  
  constructor(certPath, password, hometaxAdminCode) {
    super();
    this.certPath = certPath;
    this.password = password;
    this.hometaxAdminCode = hometaxAdminCode;
    this.subdomain = null; // hometaxbot 패턴: 서브도메인 캐싱
  }

  randomSecond() {
    return Math.floor(Math.random() * (60 - 30) + 30);
  }

  async hometaxActionCall({ query = null, body = null, needNts = false, endpoint = "https://hometax.go.kr/wqAction.do", checkSuccess = true }) {
    let queryString = null;
    if (query) {
      const filteredParams = {};
      for (const [k, v] of Object.entries(query)) {
        if (v !== null) {
          filteredParams[k] = v;
        }
      }
      queryString = new URLSearchParams(filteredParams).toString();
    }

    const url = `${endpoint}${queryString ? `?${queryString}` : ""}`;
    const jsonBody = body === null ? "{}" : JSON.stringify(body);

    let nts = null;
    if (needNts) {
      const sec = this.randomSecond();
      nts = `${sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI${sec - 11}`;
    }

    const postData = `${jsonBody}${needNts && nts !== null ? nts : ""}`;
    const headers = { 
      "Content-Type": "application/json; charset=UTF-8",
      "Referer": endpoint.includes('teht') ? "https://teht.hometax.go.kr/" : "https://hometax.go.kr/",
      "Origin": endpoint.includes('teht') ? "https://teht.hometax.go.kr" : "https://hometax.go.kr"
    };

    // 쿠키 딕셔너리에서 쿠키를 헤더에 추가 (우선순위 높음)
    const cookieHeader = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    if (cookieHeader) {
      // ⭐ 중요: 기존 Cookie 헤더 확인 및 덮어쓰기 방지
      if (headers['Cookie'] || headers['cookie']) {
        console.warn(`[쿠키 전송] ${url}: 기존 Cookie 헤더가 있습니다. 덮어씁니다.`);
      }
      
      headers['Cookie'] = cookieHeader;
      
      // 디버깅: 전송되는 쿠키 확인 (강화)
      const cookieNames = Object.keys(this.cookies);
      const cookieEntries = Object.entries(this.cookies);
      console.log(`[쿠키 전송] ${url}: 기존 쿠키 딕셔너리에서 ${cookieEntries.length}개 쿠키 전송 (${cookieNames.join(', ')})`);
      console.log(`[쿠키 전송] Cookie 헤더 길이: ${cookieHeader.length}자`);
      
      // 실제 전송되는 쿠키 헤더 확인 (디버깅용)
      if (cookieNames.length > 0) {
        const mainCookies = ['TXPPsessionID', 'NTS_LOGIN_SYSTEM_CODE_P', 'WMONID'];
        const foundMainCookies = mainCookies.filter(name => this.cookies[name]);
        console.log(`[DEBUG] 주요 쿠키 전송: ${foundMainCookies.join(', ')}`);
      }
    } else {
      console.warn(`[WARN] ${url} 호출 - 쿠키 딕셔너리가 비어있음`);
    }

    const response = await this.client.post(url, postData, {
      headers: headers,
      transformRequest: [(data) => data],
    });
    
    // 응답에서 Set-Cookie 헤더를 쿠키 딕셔너리에 저장
    const setCookieHeaders = response.headers['set-cookie'] || [];
    if (setCookieHeaders.length > 0) {
      console.log(`[DEBUG] ${url} 응답 - Set-Cookie: ${setCookieHeaders.length}개`);
    }
    for (const cookieHeader of setCookieHeaders) {
      try {
        const cookie = Cookie.parse(cookieHeader);
        if (cookie) {
          // NTS_LOGIN_SYSTEM_CODE_P 보호
          if (cookie.key === 'NTS_LOGIN_SYSTEM_CODE_P' && this.cookies['NTS_LOGIN_SYSTEM_CODE_P']) {
            continue;
          }
          this.cookies[cookie.key] = cookie.value;
          console.log(`[DEBUG] 쿠키 업데이트: ${cookie.key}`);
        }
      } catch (e) {
        // 쿠키 파싱 실패는 무시
      }
    }

    const resultData = response.data;

    // sessionMap에서 세션 정보 추출
    if (resultData.resultMsg?.sessionMap) {
      const sessionMap = resultData.resultMsg.sessionMap;
      if (sessionMap.tin) this.tin = sessionMap.tin;
      if (sessionMap.pubcUserNo) this.pubcUserNo = sessionMap.pubcUserNo;
    }

    if (checkSuccess && resultData["resultMsg"]["result"] !== HometaxScrapper.LOGIN_SUCCESS_CODE) {
      const errorMsg = resultData["resultMsg"]["msg"] || '알 수 없는 오류';
      const errorCode = resultData["resultMsg"]["code"] || "";
      const detailMsg = resultData["resultMsg"]["detailMsg"] || "";
      const exceptType = resultData["resultMsg"]["exceptType"] || "";
      
      // 🔍 상세 오류 정보 로깅
      const fullUrl = `${endpoint}${queryString ? `?${queryString}` : ""}`;
      console.error("=".repeat(80));
      console.error("[ERROR] API 호출 실패 상세 정보");
      console.error("=".repeat(80));
      console.error(`URL: ${fullUrl}`);
      console.error(`응답 상태 코드: ${response.status}`);
      console.error(`result 코드: ${resultData["resultMsg"]["result"]}`);
      console.error(`error 코드: ${errorCode}`);
      console.error(`error 메시지: ${errorMsg}`);
      console.error(`상세 메시지: ${detailMsg}`);
      console.error(`exceptType: ${exceptType}`);
      console.error(`전체 응답:`, JSON.stringify(resultData, null, 2).substring(0, 2000));
      
      // 오류 유형 판단
      if (errorCode === 'login' || errorMsg.includes('세션정보')) {
        console.error("→ 판단: 세션 관리 문제 (로그인/쿠키 문제)");
      } else if (errorMsg.includes('서비스 실행 중 오류')) {
        console.error("→ 판단: 서버 내부 오류 (스크래핑 지점 문제 가능)");
      } else if (errorCode) {
        console.error(`→ 판단: 기타 오류 (코드: ${errorCode})`);
      } else {
        console.error("→ 판단: 알 수 없는 오류");
      }
      console.error("=".repeat(80));
      
      throw new Error(errorMsg);
    }

    return resultData;
  }

  // 서브도메인 권한 요청 (핵심!)
  // ref 로직: hometaxActionCall을 사용하여 permission.do 호출
  // hometaxbot 패턴: nts_generate_random_string
  ntsGenerateRandomString(length) {
    const seed = "qwertyuiopasdfghjklzxxcvbnm0123456789QWERTYUIOPASDDFGHJKLZXCVBNBM";
    let result = '';
    for (let i = 0; i < length; i++) {
      result += seed[Math.floor(Math.random() * seed.length)];
    }
    return result;
  }

  async requestPermission(subdomain = 'teht', screenId = 'UTEABHAA03', retryCount = 0) {
    // hometaxbot 패턴: 캐싱
    if (this.subdomain === subdomain && this.tin && this.pubcUserNo) {
      console.log(`[권한 요청] 이미 권한이 있습니다 (subdomain=${subdomain}, tin=${this.tin?.substring(0, 10)}...)`);
      return;
    }

    const baseUrl = subdomain 
      ? `https://${subdomain}.hometax.go.kr`
      : 'https://hometax.go.kr';
    const endpoint = `${baseUrl}/permission.do`;
    
    console.log(`[권한 요청] subdomain=${subdomain}, screenId=${screenId}, endpoint=${endpoint}`);
    
    // 쿠키 확인 (디버깅)
    const cookiesBefore = await this.getCookies(baseUrl);
    console.log(`[DEBUG] permission.do 호출 전 쿠키: ${cookiesBefore.length}개 (딕셔너리: ${Object.keys(this.cookies).length}개)`);
    
    try {
      // hometaxbot 패턴: XML 형식으로 permission.do 호출
      const cookieHeader = Object.entries(this.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      
      const response = await this.client.post(endpoint, 
        '<map id="postParam"><popupYn>false</popupYn></map>',
        {
          params: { screenId },
          headers: {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Cookie': cookieHeader,
          },
          transformRequest: [(data) => data],
          timeout: 20000,
        }
      );

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      // hometaxbot 패턴: 로그인 오류 감지
      // JSON 응답도 확인
      const isLoginError = responseText.includes('<errorMsg>login</errorMsg>') || 
          (response.data?.resultMsg?.errorMsg === 'login') ||
          (response.data?.resultMsg?.code === 'login') ||
          (typeof response.data === 'object' && response.data?.resultMsg?.errorMsg === 'login');
      
      if (isLoginError) {
        console.log('[권한 요청] 로그인 오류 감지, SSO 토큰 획득 시도...');
        
        // hometaxbot 패턴: token.do로 SSO 토큰 획득
        const randomStr = this.ntsGenerateRandomString(20);
        const today = new Date();
        const postfix = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}`;
        
        const tokenResponse = await this.client.get('https://hometax.go.kr/token.do', {
          params: {
            query: `_${randomStr}`,
            postfix,
          },
          headers: {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Cookie': cookieHeader,
          },
          timeout: 20000,
        });

        // SSO 토큰 추출
        let ssoToken = null;
        
        // JSON 응답에서 직접 추출 시도
        if (tokenResponse.data && typeof tokenResponse.data === 'object' && tokenResponse.data.ssoToken) {
          ssoToken = tokenResponse.data.ssoToken;
          console.log('[권한 요청] SSO 토큰 획득 성공 (JSON 필드)');
        } else {
          // 문자열 응답에서 패턴 매칭 시도
          const tokenText = typeof tokenResponse.data === 'string' 
            ? tokenResponse.data 
            : JSON.stringify(tokenResponse.data);
          
          // hometaxbot 패턴: JavaScript 함수 호출에서 추출
          const ssoTokenMatch = tokenText.match(/nts_reqPortalCallback\("([^"]+)"\)/);
          
          if (ssoTokenMatch) {
            ssoToken = ssoTokenMatch[1];
            console.log('[권한 요청] SSO 토큰 획득 성공 (패턴 매칭)');
          } else {
            // JSON 파싱 시도
            try {
              const parsed = typeof tokenResponse.data === 'string' 
                ? JSON.parse(tokenResponse.data) 
                : tokenResponse.data;
              if (parsed.ssoToken) {
                ssoToken = parsed.ssoToken;
                console.log('[권한 요청] SSO 토큰 획득 성공 (JSON 파싱)');
              }
            } catch (e) {
              // JSON 파싱 실패
            }
          }
        }
        
        if (!ssoToken) {
          console.error(`[ERROR] SSO 토큰을 찾을 수 없습니다. 응답 타입: ${typeof tokenResponse.data}`);
          throw new Error('SSO 토큰을 찾을 수 없습니다');
        }

        // hometaxbot 패턴: SSO 토큰 포함하여 permission.do 재호출
        // hometaxbot에서는 ssoToken을 XML 태그로 감싸지 않고 직접 포함
        const retryResponse = await this.client.post(endpoint,
          `<map id="postParam">${ssoToken}<popupYn>false</popupYn></map>`,
          {
            params: { 
              screenId,
              domain: 'hometax.go.kr',
            },
            headers: {
              'Content-Type': 'application/xml; charset=UTF-8',
              'Cookie': cookieHeader,
            },
            transformRequest: [(data) => data],
            timeout: 20000,
          }
        );

        const retryText = typeof retryResponse.data === 'string' ? retryResponse.data : JSON.stringify(retryResponse.data);
        
        console.log(`[DEBUG] permission.do 재호출 응답 길이: ${retryText.length}자`);
        console.log(`[DEBUG] permission.do 재호출 응답 일부: ${retryText.substring(0, 500)}`);
        
        // 재시도 후에도 로그인 오류가 있으면 실패
        if (retryText.includes('<errorMsg>login</errorMsg>') ||
            (retryResponse.data?.resultMsg?.errorMsg === 'login') ||
            (retryResponse.data?.resultMsg?.code === 'login')) {
          console.error(`[ERROR] permission.do 재호출 후에도 로그인 오류 발생`);
          console.error(`[ERROR] 응답: ${retryText.substring(0, 1000)}`);
          throw new Error('홈택스 로그인 권한 획득에 실패했습니다. 다시 시도해주세요.');
        }

        // 세션 정보 추출
        this.extractSessionInfo(retryResponse.data);
        this.subdomain = subdomain;
        console.log('[권한 요청] 서브도메인 권한 획득 성공');
        return retryResponse.data;
      }

      // 정상 응답 처리
      this.extractSessionInfo(response.data);
      this.subdomain = subdomain;
      return response.data;
      
    } catch (error) {
      console.error(`[권한 요청] 오류: ${error.message}`);
      if (retryCount < 2) {
        console.log(`[권한 요청] 재시도 ${retryCount + 1}/2...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.requestPermission(subdomain, screenId, retryCount + 1);
      }
      throw error;
    }
  }

  // 세션 정보 추출 헬퍼 메서드
  extractSessionInfo(resultData) {
    // hometaxbot 패턴: JSON 응답에서 세션 정보 추출
    if (resultData?.resultMsg?.sessionMap) {
      const sessionMap = resultData.resultMsg.sessionMap;
      if (sessionMap.tin) {
        this.tin = sessionMap.tin;
        console.log(`[세션 정보] tin=${this.tin.substring(0, 10)}...`);
      }
      if (sessionMap.pubcUserNo) {
        this.pubcUserNo = sessionMap.pubcUserNo;
        console.log(`[세션 정보] pubcUserNo=${this.pubcUserNo.substring(0, 10)}...`);
      }
    } else if (resultData?.resultMsg) {
      // XML 응답 파싱 시도
      try {
        const xmlText = typeof resultData === 'string' ? resultData : JSON.stringify(resultData);
        const tinMatch = xmlText.match(/<tin>([^<]+)<\/tin>/);
        const pubcUserNoMatch = xmlText.match(/<pubcUserNo>([^<]+)<\/pubcUserNo>/);
        
        if (tinMatch) {
          this.tin = tinMatch[1];
          console.log(`[세션 정보] tin=${this.tin.substring(0, 10)}...`);
        }
        if (pubcUserNoMatch) {
          this.pubcUserNo = pubcUserNoMatch[1];
          console.log(`[세션 정보] pubcUserNo=${this.pubcUserNo.substring(0, 10)}...`);
        }
      } catch (e) {
        console.warn(`[WARN] 세션 정보 추출 실패: ${e.message}`);
      }
    } else {
      console.warn(`[WARN] permission.do 응답에 sessionMap이 없음`);
    }
  }

  async ssoLogin() {
    await this.hometaxActionCall({
      query: { screenId: "index_pp" },
      endpoint: "https://hometax.go.kr/permission.do",
      checkSuccess: false,
    });

    await this.hometaxActionCall({
      query: { screenId: "UTERNAAZ11" },
      endpoint: "https://teht.hometax.go.kr/permission.do",
      checkSuccess: false,
    });

    const res = await this.hometaxActionCall({
      query: { quer: "_Ar3dDhwBaAEjwbp6RxK8" },
      endpoint: "https://hometax.go.kr/token.do",
      checkSuccess: false,
    });

    await this.hometaxActionCall({
      query: { screenId: "UTERNAAZ11", domain: "hometax.go.kr" },
      endpoint: "https://teht.hometax.go.kr/permission.do",
      body: {
        ssoToken: res.ssoToken,
        userClCd: res.userClCd,
        txaaAdmNo: res.txaaAdmNo,
      },
      checkSuccess: false,
    });
  }

  async loginWithPython() {
    // Python 스크립트를 통해 로그인하여 쿠키 획득
    return new Promise((resolve, reject) => {
      // 새로운 Python 스크립트 사용 (permission.do까지 처리)
      const pythonScript = path.join(backendDir, 'integration', 'scripts', 'get-session-with-permission.py');
      const python = spawn('python3', [pythonScript, this.certPath, this.password]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
        // Python의 DEBUG 메시지 출력
        const text = data.toString();
        if (text.includes('[DEBUG Python]')) {
          process.stderr.write(text);
        }
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            // stdout에서 JSON 부분만 추출 (로그 메시지 제거)
            const lines = stdout.trim().split('\n');
            let jsonLine = '';
            
            // 마지막 줄부터 역순으로 검색하여 JSON 찾기
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                jsonLine = line;
                break;
              }
            }
            
            // JSON을 찾지 못한 경우 정규식으로 검색
            if (!jsonLine) {
              const jsonMatch = stdout.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                jsonLine = jsonMatch[0];
              } else {
                throw new Error(`JSON을 찾을 수 없습니다`);
              }
            }
            
            const result = JSON.parse(jsonLine);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              // ✅ 사용자 정보와 permission.do 결과, API 결과도 함께 반환
              resolve({
                success: true,
                cookies: result.cookies || {},
                pubcUserNo: result.pubcUserNo || '',
                tin: result.tin || '',
                permissionSuccess: result.permissionSuccess || false,
                permissionError: result.permissionError || null,
                apiSuccess: result.apiSuccess || false,
                apiError: result.apiError || null,
                clients: result.clients || [],
              });
            }
          } catch (e) {
            reject(new Error(`Python 출력 파싱 실패: ${e.message}\n출력: ${stdout.substring(0, 500)}`));
          }
        } else {
          reject(new Error(`Python 로그인 실패: ${stderr || stdout}`));
        }
      });
    });
  }

  // TypeScript 스타일: 세션 정보 획득 (Fallback)
  async acquireSessionInfo() {
    // 세션 정보가 없으면 permission.do로 획득
    if (!this.pubcUserNo || !this.tin) {
      console.log('[수임거래처 조회] 세션 정보가 없습니다. permission.do로 획득 시도...');
      
      try {
        // 메인 도메인 permission.do 호출하여 세션 정보 획득
        const permResponse = await this.hometaxActionCall({
          query: { screenId: 'index_pp' },
          endpoint: 'https://hometax.go.kr/permission.do',
          body: {},
          needNts: true,
          checkSuccess: false,
        });
        
        // sessionMap에서 세션 정보 추출
        if (permResponse && permResponse.resultMsg?.sessionMap) {
          const sessionMap = permResponse.resultMsg.sessionMap;
          this.pubcUserNo = sessionMap.pubcUserNo || this.pubcUserNo;
          this.tin = sessionMap.tin || this.tin;
          
          if (this.pubcUserNo && this.tin) {
            console.log(`[수임거래처 조회] 세션 정보 획득 성공: pubcUserNo=${this.pubcUserNo.substring(0, 10)}..., tin=${this.tin.substring(0, 10)}...`);
            await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
            return true;
          }
        }
        
        console.warn('[수임거래처 조회] permission.do 응답에 sessionMap이 없음');
      } catch (error) {
        console.warn(`[수임거래처 조회] permission.do 호출 실패: ${error.message}`);
      }
    } else {
      console.log('[수임거래처 조회] 세션 정보 확인:', {
        pubcUserNo: this.pubcUserNo.substring(0, 10) + '...',
        tin: this.tin.substring(0, 10) + '...',
      });
      return true;
    }
    
    return false;
  }

  async 기장대리(engagementCode = "1") {
    // Python에서 이미 permission.do와 API 호출까지 처리했으므로
    // Python 결과를 반환하거나, 실패한 경우에만 Node.js에서 재시도
    console.log('[수임거래처 조회] Python에서 이미 처리 완료');
    
    // Python 결과는 loginWithPython에서 받아서 저장해두어야 함
    // 현재는 Node.js에서 직접 호출하도록 유지
    // TODO: Python 결과를 저장하고 재사용하도록 개선
    
    if (!this.tin || !this.pubcUserNo) {
      throw new Error('세션 정보가 없습니다. Python 스크립트에서 permission.do 처리가 실패했을 수 있습니다.');
    }
    
    // API 호출 (재시도 로직 포함)
    let retryCount = 0;
    const MAX_RETRY = 2;
    
    while (retryCount <= MAX_RETRY) {
      try {
        const res = await this.hometaxActionCall({
          query: {
            actionId: "ATEABHAA001R10",
            screenId: "UTEABHAA03",
            popupYn: "false",
            realScreenId: "",
          },
          body: {
            afdsCl: engagementCode,
            txaaAdmNo: this.hometaxAdminCode ?? "",
            pageInfoVO: { pageNum: "1", pageSize: "200", totalCount: "" },
          },
          needNts: true,
          endpoint: "https://teht.hometax.go.kr/wqAction.do",
        });

        const listData = res["afdsSttnInfrDVOList"];
        if (Array.isArray(listData)) {
          return listData;
        }
        return [];
      } catch (error) {
        // 세션 오류 감지 및 재시도
        const errorMsg = error.message || '';
        if ((errorMsg.includes('세션정보가 존재하지 않습니다') || errorMsg.includes('login')) && retryCount < MAX_RETRY) {
          console.log('[수임거래처 조회] 세션 오류 감지, 재시도...');
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // 재시도 불가능한 오류는 그대로 throw
        throw error;
      }
    }
    
    return [];
  }
}

// 메인 테스트 함수
async function testHometaxClients() {
  console.log('='.repeat(60));
  console.log('Node.js 스크립트로 홈택스 수임거래처 조회 테스트 (ref 스타일)');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 저장된 인증서 목록 조회
    console.log('1. 저장된 인증서 목록 조회 중...');
    // 프로젝트 루트 기준으로 모듈 로드
    const { listSavedCertificates, getCertificatePassword } = require(path.join(backendDir, 'modules/certificate/password/storage'));
    const savedCerts = await listSavedCertificates();
    
    if (!savedCerts || savedCerts.length === 0) {
      console.log('❌ 저장된 인증서가 없습니다.');
      return;
    }
    
    console.log(`✅ 발견된 인증서: ${savedCerts.length}개\n`);
    
    // 첫 번째 인증서 선택
    const certInfo = savedCerts[0];
    console.log(`선택된 인증서:`);
    console.log(`  이름: ${certInfo.name}`);
    console.log(`  경로: ${certInfo.path}\n`);
    
    // 2. 저장된 비밀번호 조회
    console.log('2. 저장된 비밀번호 조회 중...');
    const password = await getCertificatePassword(certInfo.path);
    
    if (!password) {
      console.log('❌ 비밀번호 조회 실패: 비밀번호가 저장되지 않았습니다.');
      return;
    }
    
    console.log(`✅ 비밀번호 조회 성공 (길이: ${password.length}자)\n`);
    
    // 3. Python으로 로그인하여 쿠키 획득
    console.log('3. Python으로 로그인하여 쿠키 획득 중...');
    const scrapper = new HometaxScrapper(certInfo.path, password, null);
    
    const loginResult = await scrapper.loginWithPython();
    if (!loginResult.success) {
      throw new Error('Python 로그인 실패');
    }
    
    console.log('✅ Python 로그인 성공');
    console.log(`   쿠키 개수: ${Object.keys(loginResult.cookies).length}`);
    if (loginResult.cookies.TXPPsessionID) {
      console.log(`   TXPPsessionID: ${loginResult.cookies.TXPPsessionID.substring(0, 30)}...`);
    }
    // ✅ 사용자 정보 확인
    console.log(`   pubcUserNo: ${loginResult.pubcUserNo || 'N/A'}`);
    console.log(`   tin: ${loginResult.tin || 'N/A'}`);
    if (loginResult.permissionSuccess !== undefined) {
      console.log(`   permission.do 성공: ${loginResult.permissionSuccess}`);
      if (loginResult.permissionError) {
        console.log(`   ⚠️  permission.do 오류: ${loginResult.permissionError}`);
      }
    }
    console.log();
    
    // 4. Python에서 받은 쿠키를 CookieJar에 설정
    console.log('4. 쿠키를 CookieJar에 설정 중...');
    await scrapper.setCookiesFromPython(loginResult.cookies, {
      pubcUserNo: loginResult.pubcUserNo,
      tin: loginResult.tin
    });
    
    // ✅ 핵심: 세션 정보 확인 (로그인 시점에 받은 정보)
    if (loginResult.pubcUserNo) {
      console.log(`✅ 세션 정보 설정: pubcUserNo=${loginResult.pubcUserNo}`);
    }
    if (loginResult.tin) {
      console.log(`✅ 세션 정보 설정: tin=${loginResult.tin}`);
    }
    
    // 쿠키 확인
    const cookiesAfterSet = await scrapper.getCookies('https://teht.hometax.go.kr');
    console.log(`✅ 쿠키 설정 완료 (teht.hometax.go.kr 쿠키: ${cookiesAfterSet.length}개)`);
    if (cookiesAfterSet.length > 0) {
      const txppCookie = cookiesAfterSet.find(c => c.key === 'TXPPsessionID');
      if (txppCookie) {
        console.log(`   TXPPsessionID: ${txppCookie.value.substring(0, 30)}...`);
      }
    }
    console.log();
    
    // 4-1. 로그인 직후 세션 초기화 (핵심!)
    console.log('4-1. 세션 초기화 중 (메인 페이지 워밍업)...');
    try {
      // 메인 페이지 워밍업
      await scrapper.client.get('https://hometax.go.kr/', {
        headers: {
          'Cookie': Object.entries(scrapper.cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; ')
        }
      });
      console.log('✅ 메인 페이지 워밍업 완료');
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 대기
    } catch (error) {
      console.warn('⚠️  메인 페이지 워밍업 실패 (계속 진행):', error.message);
    }
    
    // 4-2. SSO 토큰 획득 시도
    console.log('4-2. SSO 토큰 획득 시도 중...');
    try {
      const randomStr = Math.random().toString(36).substring(2, 22);
      const today = new Date();
      const postfix = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}_${String(today.getDate()).padStart(2, '0')}`;
      
      const tokenResponse = await scrapper.hometaxActionCall({
        query: {
          quer: `_${randomStr}`,
          postfix: postfix
        },
        endpoint: 'https://hometax.go.kr/token.do',
        checkSuccess: false
      });
      
      if (tokenResponse.ssoToken) {
        console.log('✅ SSO 토큰 획득 성공');
      } else {
        console.warn('⚠️  SSO 토큰 획득 실패 (계속 진행)');
      }
    } catch (error) {
      console.warn('⚠️  SSO 토큰 획득 실패 (계속 진행):', error.message);
    }
    console.log();
    
    // 5. SSO 로그인 (ref 로직: Python에서 이미 SSO 로그인을 했으므로, 여기서는 다시 실행하지 않음)
    // 하지만 Python에서 받은 쿠키가 이미 SSO 로그인된 상태이므로 바로 사용
    console.log('5. SSO 로그인 확인 중...');
    // Python 스크립트에서 이미 SSO 로그인을 완료했으므로, 여기서는 확인만
    const cookiesBeforeSSO = await scrapper.getCookies('https://teht.hometax.go.kr');
    console.log(`   현재 쿠키 개수: ${cookiesBeforeSSO.length}개`);
    
    // 필요시 SSO 로그인 재실행 (쿠키가 제대로 전달되지 않은 경우)
    if (cookiesBeforeSSO.length < 3) {
      console.log('   쿠키가 부족하여 SSO 로그인 재실행...');
      await scrapper.ssoLogin();
      const cookiesAfterSSO = await scrapper.getCookies('https://teht.hometax.go.kr');
      console.log(`✅ SSO 로그인 완료 (teht.hometax.go.kr 쿠키: ${cookiesAfterSSO.length}개)\n`);
    } else {
      console.log('✅ 쿠키 확인 완료 (SSO 로그인 불필요)\n');
    }
    
    // 6. 수임거래처 조회
    console.log('6. 수임거래처 조회 중 (수임중)...');
    const clients = await scrapper.기장대리("1");
    
    console.log(`✅ 수임거래처 조회 성공: ${clients.length}개\n`);
    
    if (clients.length > 0) {
      console.log('='.repeat(60));
      console.log('수임거래처 목록 (수임중)');
      console.log('='.repeat(60));
      clients.slice(0, 10).forEach((client, i) => {
        console.log(`\n${i + 1}. ${client.txprNm || client.tnmNm || 'N/A'}`);
        console.log(`   사업자번호: ${client.bsno || 'N/A'}`);
        console.log(`   납세자번호: ${client.afaBmanTin || 'N/A'}`);
      });
      
      if (clients.length > 10) {
        console.log(`\n... 외 ${clients.length - 10}개 더 있음`);
      }
      
      console.log();
      console.log('='.repeat(60));
    } else {
      console.log('수임중인 거래처가 없습니다.');
    }
    
    console.log('\n✅ 테스트 완료');
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testHometaxClients()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { testHometaxClients, HometaxScrapper };
