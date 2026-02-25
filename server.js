// TypeScript 런타임 지원
require('ts-node').register({
  project: './backend/tsconfig.json',
  transpileOnly: true,
});

// 백엔드 모듈 로드
const backendModule = require('./backend/index');

const {
  discoverCertificatesBasic,
  discoverCertificatesDetailed,
  saveCertificatePassword,
  getCertificatePassword,
  deleteCertificatePassword,
  listSavedCertificates,
  getCertPathByHash,
  saveTaxAccountant,
  getTaxAccountant,
  listTaxAccountants,
  updateTaxAccountant,
  deleteTaxAccountant,
  linkCertificate,
  saveCompany,
  saveCompanies,
  getCompany,
  listCompanies,
  updateCompany,
  deleteCompany,
  WetaxClientFetcher,
  WetaxReportCollector,
  saveWetaxCompanies,
  listWetaxCompanies,
  saveWithholdingReports,
  listWithholdingReports,
  getWithholdingTaxKPI,
  getCompanyWithholdingStats,
  getTaxpayersByFilter,
  startRun,
  completeRun,
  listRuns,
  saveRawSnapshot
} = backendModule;

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const net = require('net');

// ✅ 개선된 에러 핸들러 - 포트 충돌 등을 구분하여 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
  console.error('[FATAL] Promise:', promise);
  if (reason instanceof Error) {
    console.error('[FATAL] Stack:', reason.stack);
  }
  // 치명적인 경우만 종료
  if (reason && reason.code !== 'EADDRINUSE') {
    console.error('[FATAL] 서버를 종료합니다.');
    process.exit(1);
  }
});

// Uncaught Exception 핸들러 - 포트 충돌은 별도 처리
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error.message);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`[ERROR] 포트 ${PORT || 3000}이 이미 사용 중입니다.`);
    console.error('[INFO] 기존 프로세스를 확인하고 종료한 후 다시 시도하세요.');
    console.error('[INFO] 명령어: lsof -ti:3000 | xargs kill -TERM');
    process.exit(1);
  } else {
    console.error('[FATAL] Stack:', error.stack);
    console.error('[FATAL] 치명적 오류로 서버를 종료합니다.');
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// 외부 API 서버 주소
const EXTERNAL_API_BASE_URL = 'http://112.155.1.171:8080/api';

// ✅ 1단계: Graceful Shutdown 개선 - 진행 중 작업 추적 (서버 시작 전에 정의)
const activeTasks = new Set();
const collectionProgress = new Map(); // 수집 진행률 정보 저장
const MAX_SHUTDOWN_WAIT = 2 * 60 * 1000; // 최대 2분 대기

// 진행 중 작업 등록/해제 헬퍼 함수
function registerActiveTask(taskId) {
  activeTasks.add(taskId);
  console.log(`[서버] 작업 등록: ${taskId} (진행 중: ${activeTasks.size}개)`);
}

function unregisterActiveTask(taskId) {
  activeTasks.delete(taskId);
  collectionProgress.delete(taskId); // 진행률 정보도 제거
  console.log(`[서버] 작업 완료: ${taskId} (진행 중: ${activeTasks.size}개)`);
}

// 진행률 업데이트 헬퍼 함수
function updateProgress(taskId, current, total, description) {
  const progress = {
    taskId,
    description,
    current,
    total,
    percentage: Math.round((current / total) * 100),
    timestamp: new Date().toISOString()
  };
  collectionProgress.set(taskId, progress);
}

// 동적 CORS 설정 - 개발/프로덕션 환경별 처리
const corsOptions = {
  origin: function (origin, callback) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment) {
      // 개발 환경: localhost의 모든 포트 허용 + null origin (같은 origin 요청)
      if (!origin || origin.match(/^http:\/\/localhost:\d+$/)) {
        callback(null, true);
      } else {
        console.log(`[CORS] 차단된 origin: ${origin}`);
        callback(new Error('개발 환경에서는 localhost만 허용됩니다.'));
      }
    } else {
      // 프로덕션 환경: 허용된 도메인만
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'https://yourdomain.com',
        process.env.API_URL || 'https://api.yourdomain.com'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS 정책에 의해 차단됨: ${origin}`));
      }
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 외부 API 서버 접속 상태 확인 함수
async function checkExternalApiStatus() {
  try {
    // API 문서 엔드포인트나 health check 엔드포인트를 시도
    // 일반적으로 /docs 또는 /health 엔드포인트가 있을 수 있습니다
    const response = await axios.get(`${EXTERNAL_API_BASE_URL}/docs`, {
      timeout: 15000, // 15초 타임아웃 (5초에서 증가)
      validateStatus: function (status) {
        // 200-399 범위의 상태 코드를 성공으로 간주
        return status >= 200 && status < 400;
      }
    });

    return {
      status: 'connected',
      statusCode: response.status,
      message: '외부 API 서버에 성공적으로 연결되었습니다.',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // 타임아웃 에러 처리 (axios는 ECONNABORTED 또는 메시지에 timeout 포함)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        status: 'timeout',
        statusCode: null,
        message: '외부 API 서버 연결 시간 초과 (15초)',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } else if (error.code === 'ECONNREFUSED') {
      return {
        status: 'disconnected',
        statusCode: null,
        message: '외부 API 서버에 연결할 수 없습니다. (연결 거부)',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } else if (error.code === 'ETIMEDOUT') {
      return {
        status: 'timeout',
        statusCode: null,
        message: '외부 API 서버 연결 시간 초과',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        status: 'error',
        statusCode: error.response?.status || null,
        message: '외부 API 서버 연결 중 오류가 발생했습니다.',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 루트 엔드포인트
app.get('/', (req, res) => {
  res.json({
    message: 'Pickup API Server',
    description: '외부 API 서버 접속 상태 확인 서버',
    endpoints: {
      health: '/health',
      status: '/api/status',
      certificates: {
        basic: '/api/certificates/basic',
        detailed: '/api/certificates/detailed'
      }
    }
  });
});

// 서버 자체 상태 확인
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '서버가 정상적으로 실행 중입니다.',
    timestamp: new Date().toISOString()
  });
});

// 외부 API 서버 접속 상태 확인 엔드포인트
app.get('/api/status', async (req, res) => {
  try {
    const status = await checkExternalApiStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '상태 확인 중 오류가 발생했습니다.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 수집 진행률 조회 API
app.get('/api/collection-status', (req, res) => {
  try {
    const activeCollections = Array.from(collectionProgress.values());
    
    res.json({
      success: true,
      data: {
        activeTasks: activeTasks.size,
        collections: activeCollections,
        hasActiveCollections: activeCollections.length > 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '수집 상태 조회 중 오류가 발생했습니다.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 인증서 목록 조회 (기본) - 유효기간 포함
app.get('/api/certificates/basic', async (req, res) => {
  try {
    const certificates = await discoverCertificatesBasic();

    // 각 인증서의 유효기간 파싱
    const certificatesWithValidity = await Promise.all(
      certificates.map(async (cert) => {
        let validFrom = null;
        let validTo = null;
        let isExpired = false;

        try {
          // Python 스크립트를 사용하여 유효기간 조회
          const { spawn } = require('child_process');
          const path = require('path');
          const pythonScript = path.join(__dirname, 'backend', 'scripts', 'get-cert-validity.py');

          const result = await new Promise((resolve) => {
            const python = spawn('python3', [pythonScript, cert.path]);
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
              stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
              stderr += data.toString();
            });

            python.on('close', (code) => {
              if (code === 0 && stdout.trim()) {
                try {
                  const parsed = JSON.parse(stdout.trim());
                  if (!parsed.error) {
                    resolve(parsed);
                  } else {
                    console.warn(`[인증서 파싱] ${cert.path}: ${parsed.error}`);
                    resolve(null);
                  }
                } catch (parseError) {
                  console.warn(`[인증서 파싱] JSON 파싱 실패: ${stdout.substring(0, 100)}`);
                  resolve(null);
                }
              } else {
                if (stderr) {
                  console.warn(`[인증서 파싱] ${cert.path}: ${stderr.substring(0, 100)}`);
                }
                resolve(null);
              }
            });
          });

          if (result) {
            validFrom = result.validFrom;
            validTo = result.validTo;
            isExpired = result.isExpired;
          }
        } catch (error) {
          // 파싱 실패 시 무시하고 기본 정보만 반환
          console.warn(`[인증서 파싱] ${cert.path}: ${error.message}`);
        }

        return {
          type: cert.type,
          path: cert.path,
          keyPath: cert.keyPath,
          name: cert.name,
          size: cert.size,
          modified: cert.modified.toISOString(),
          validFrom: validFrom,
          validTo: validTo,
          isExpired: isExpired,
        };
      })
    );

    res.json({
      success: true,
      data: certificatesWithValidity,
      message: '인증서 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '인증서 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 인증서 목록 조회 (세부) - 유효기간 포함
app.get('/api/certificates/detailed', async (req, res) => {
  try {
    const certificates = await discoverCertificatesDetailed();

    // 각 인증서의 유효기간 파싱 (기본 조회와 동일한 로직)
    const certificatesWithValidity = await Promise.all(
      certificates.map(async (cert) => {
        let validFrom = null;
        let validTo = null;
        let isExpired = false;

        try {
          const { spawn } = require('child_process');
          const pythonScript = `
import sys
import json
sys.path.insert(0, '${__dirname}/backend/modules')
try:
    from certificate.parsing.without_password import parse_certificate_without_password
    metadata = parse_certificate_without_password('${cert.path.replace(/'/g, "\\'")}')
    print(json.dumps({
        'validFrom': metadata.get('valid_from'),
        'validTo': metadata.get('valid_to'),
        'isExpired': metadata.get('is_expired', False)
    }))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

          const result = await new Promise((resolve) => {
            const python = spawn('python3', ['-c', pythonScript]);
            let stdout = '';

            python.stdout.on('data', (data) => {
              stdout += data.toString();
            });

            python.on('close', (code) => {
              if (code === 0 && stdout.trim()) {
                try {
                  const parsed = JSON.parse(stdout.trim());
                  if (!parsed.error) {
                    resolve(parsed);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          });

          if (result) {
            validFrom = result.validFrom;
            validTo = result.validTo;
            isExpired = result.isExpired;
          }
        } catch (error) {
          console.warn(`[인증서 파싱] ${cert.path}: ${error.message}`);
        }

        return {
          type: cert.type,
          path: cert.path,
          keyPath: cert.keyPath,
          name: cert.name,
          size: cert.size,
          modified: cert.modified.toISOString(),
          validFrom: validFrom,
          validTo: validTo,
          isExpired: isExpired,
        };
      })
    );

    res.json({
      success: true,
      data: certificatesWithValidity,
      message: '인증서 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '인증서 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 인증서 비밀번호 저장
app.post('/api/certificates/password', async (req, res) => {
  try {
    const { certPath, password } = req.body;

    if (!certPath || !password) {
      return res.status(400).json({
        success: false,
        message: '인증서 경로와 비밀번호가 필요합니다.',
      });
    }

    // 로깅: 저장 요청 정보
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(certPath).digest('hex');
    console.log('[비밀번호 저장] 인증서 경로:', certPath);
    console.log('[비밀번호 저장] 해시:', hash);
    console.log('[비밀번호 저장] 비밀번호 길이:', password.length);

    await saveCertificatePassword(certPath, password);

    console.log('[비밀번호 저장] 저장 완료');

    res.json({
      success: true,
      message: '인증서 비밀번호가 저장되었습니다.',
    });
  } catch (error) {
    console.error('[비밀번호 저장] 오류:', error.message);
    res.status(500).json({
      success: false,
      message: '인증서 비밀번호 저장 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 인증서 비밀번호 조회
app.get('/api/certificates/password', async (req, res) => {
  try {
    const { certPath } = req.query;

    if (!certPath) {
      return res.status(400).json({
        success: false,
        message: '인증서 경로가 필요합니다.',
      });
    }

    const password = await getCertificatePassword(certPath);

    if (!password) {
      return res.json({
        success: true,
        data: null,
        message: '저장된 비밀번호가 없습니다.',
      });
    }

    res.json({
      success: true,
      data: { password },
      message: '인증서 비밀번호 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '인증서 비밀번호 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 인증서 비밀번호 삭제
app.delete('/api/certificates/password', async (req, res) => {
  try {
    const { certPath } = req.query;

    if (!certPath) {
      return res.status(400).json({
        success: false,
        message: '인증서 경로가 필요합니다.',
      });
    }

    await deleteCertificatePassword(certPath);

    res.json({
      success: true,
      message: '인증서 비밀번호가 삭제되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '인증서 비밀번호 삭제 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 저장된 모든 인증서의 홈택스 수임거래처 조회
app.post('/api/hometax/clients/fetch-all', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const pythonScriptPath = path.join(__dirname, 'backend', 'integration', 'scripts', 'fetch-all-clients.py');

    // 저장된 인증서 목록 조회
    const savedCerts = await listSavedCertificates();

    if (!savedCerts || savedCerts.length === 0) {
      return res.json({
        success: false,
        data: [],
        message: '저장된 인증서가 없습니다.',
      });
    }

    // 각 인증서의 비밀번호 조회
    const certsWithPassword = await Promise.all(
      savedCerts.map(async (cert) => {
        const password = await getCertificatePassword(cert.path);
        return {
          path: cert.path,
          name: cert.name,
          password: password || '', // 비밀번호가 없으면 빈 문자열
        };
      })
    );

    // 비밀번호가 있는 인증서만 필터링
    const validCerts = certsWithPassword.filter(cert => cert.password);

    if (validCerts.length === 0) {
      return res.json({
        success: false,
        data: [],
        message: '비밀번호가 저장된 인증서가 없습니다.',
      });
    }

    // Python 스크립트 실행 (저장된 인증서 정보와 비밀번호 전달)
    const result = await new Promise((resolve, reject) => {
      const python = spawn('python3', [
        pythonScriptPath,
        JSON.stringify(validCerts)
      ], {
        env: {
          ...process.env,
          AXCEL_ENCRYPTION_KEY: process.env.AXCEL_ENCRYPTION_KEY || '',
        }
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        // Python의 디버그 메시지는 stderr로 출력되므로 로깅
        console.log(`[Python] ${data.toString().trim()}`);
      });

      python.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
          } catch (e) {
            reject(new Error(`JSON 파싱 실패: ${e.message}\n출력: ${stdout.substring(0, 500)}`));
          }
        } else {
          reject(new Error(`Python 스크립트 실패 (코드: ${code})\n${stderr || '알 수 없는 오류'}`));
        }
      });
    });

    res.json({
      success: true,
      data: result.clients || [],
      message: `${result.totalCount || 0}개의 거래처를 불러왔습니다. (${result.successCount || 0}/${result.totalCertCount || 0}개 인증서 성공)`,
      meta: {
        totalCount: result.totalCount || 0,
        successCount: result.successCount || 0,
        totalCertCount: result.totalCertCount || 0,
        errors: result.errors || [],
      },
    });
  } catch (error) {
    console.error('[거래처 조회] 오류:', error);
    res.status(500).json({
      success: false,
      data: [],
      message: '거래처 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 저장된 인증서 목록 조회
app.get('/api/certificates/saved', async (req, res) => {
  try {
    const savedCerts = await listSavedCertificates();
    res.json({
      success: true,
      data: savedCerts,
      message: '저장된 인증서 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '저장된 인증서 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// ========== 세무사 관리 API ==========

// 세무사 목록 조회
app.get('/api/tax-accountants', async (req, res) => {
  try {
    // 디버깅: 함수 존재 확인
    if (typeof listTaxAccountants !== 'function') {
      console.error('[ERROR] listTaxAccountants is not a function:', typeof listTaxAccountants);
      return res.status(500).json({
        success: false,
        data: null,
        message: 'listTaxAccountants 함수를 찾을 수 없습니다.',
        error: `listTaxAccountants type: ${typeof listTaxAccountants}`,
      });
    }

    console.log('[DEBUG] listTaxAccountants 호출 시작');
    const taxAccountants = await listTaxAccountants();
    console.log('[DEBUG] listTaxAccountants 결과:', taxAccountants?.length || 0, '개');

    res.json({
      success: true,
      data: taxAccountants,
      message: '세무사 목록 조회 성공',
    });
  } catch (error) {
    console.error('[ERROR] 세무사 목록 조회 오류:', error);
    console.error('[ERROR] 에러 메시지:', error.message);
    console.error('[ERROR] 스택 트레이스:', error.stack);
    res.status(500).json({
      success: false,
      data: null,
      message: '세무사 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 세무사 상세 조회
app.get('/api/tax-accountants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const taxAccountant = await getTaxAccountant(id);

    if (!taxAccountant) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: taxAccountant,
      message: '세무사 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '세무사 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 세무사 등록
app.post('/api/tax-accountants', async (req, res) => {
  try {
    const { name, representative, certificateHash, certificatePath, status, autoSync, metadata } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사명은 필수입니다.',
      });
    }

    const taxAccountant = await saveTaxAccountant({
      name,
      representative,
      certificateHash,
      certificatePath,
      status: status || 'connected',
      connectedAt: status === 'connected' || !status ? new Date().toISOString() : undefined,
      autoSync: autoSync !== undefined ? autoSync : false,
      metadata,
    });

    res.json({
      success: true,
      data: taxAccountant,
      message: '세무사가 등록되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '세무사 등록 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 세무사 정보 수정
app.put('/api/tax-accountants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, representative, certificateHash, certificatePath, status, autoSync, metadata } = req.body;

    const updated = await updateTaxAccountant(id, {
      name,
      representative,
      certificateHash,
      certificatePath,
      status,
      autoSync,
      metadata,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: updated,
      message: '세무사 정보가 수정되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '세무사 정보 수정 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 세무사 삭제
app.delete('/api/tax-accountants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteTaxAccountant(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      message: '세무사가 삭제되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '세무사 삭제 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 인증서 연동
app.post('/api/tax-accountants/:id/link-certificate', async (req, res) => {
  try {
    const { id } = req.params;
    const { certificateHash, certificatePath } = req.body;

    if (!certificateHash) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '인증서 해시는 필수입니다.',
      });
    }

    // 인증서 경로 조회 (certificateHash로)
    let finalCertPath = certificatePath;
    if (!finalCertPath) {
      const { getCertPathByHash } = require('./backend/modules/certificate/password/storage');
      finalCertPath = await getCertPathByHash(certificateHash) || undefined;
    }

    const updated = await linkCertificate(id, certificateHash, finalCertPath);

    if (!updated) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: updated,
      message: '인증서가 연동되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '인증서 연동 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// ========== 거래처(사업장) 관리 API ==========

// 거래처 목록 조회
app.get('/api/companies', async (req, res) => {
  try {
    const { taxAccountantId } = req.query;
    const companies = await listCompanies(taxAccountantId || undefined);
    res.json({
      success: true,
      data: companies,
      message: '거래처 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '거래처 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 거래처 상세 조회
app.get('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await getCompany(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '거래처를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: company,
      message: '거래처 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '거래처 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 선택된 세무사의 홈택스 거래처 조회 및 저장
app.post('/api/companies/fetch-from-hometax', async (req, res) => {
  let run = null;
  const taskId = `hometax-fetch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  registerActiveTask(taskId);
  console.log(`[server.js] ✅ 거래처 조회 요청 수신: taxAccountantId=${req.body?.taxAccountantId}`);
  try {
    const { taxAccountantId } = req.body;

    if (!taxAccountantId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사 ID는 필수입니다.',
      });
    }

    // 세무사 정보 조회 (검증 먼저)
    const taxAccountant = await getTaxAccountant(taxAccountantId);
    if (!taxAccountant) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    // 인증서 정보 확인
    if (!taxAccountant.certificateHash) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사에 연동된 인증서가 없습니다.',
      });
    }

    // ✅ 검증 완료 후 Run 시작
    if (startRun) {
      run = startRun({ source: 'hometax', type: 'clients', taxAccountantId });
    } else {
      console.warn('[server.js] startRun 함수를 찾을 수 없습니다. Raw 저장을 건너뜁니다.');
    }

    // 인증서 경로 및 비밀번호 조회
    const certPath = taxAccountant.certificatePath || await getCertPathByHash(taxAccountant.certificateHash);
    if (!certPath) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '인증서 경로를 찾을 수 없습니다.',
      });
    }

    const password = await getCertificatePassword(certPath);
    if (!password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '인증서 비밀번호를 찾을 수 없습니다.',
      });
    }

    // Python 스크립트 실행 (get-session-with-permission.py)
    const { spawn } = require('child_process');
    const path = require('path');
    const pythonScriptPath = path.join(__dirname, 'backend', 'integration', 'scripts', 'get-session-with-permission.py');

    console.log(`[server.js] 🔄 Python 스크립트 실행 시작: ${pythonScriptPath}`);
    console.log(`[server.js] 인증서 경로: ${certPath}`);

    const result = await new Promise((resolve, reject) => {
      const python = spawn('python3', [
        pythonScriptPath,
        certPath,
        password
      ], {
        env: {
          ...process.env,
          AXCEL_ENCRYPTION_KEY: process.env.AXCEL_ENCRYPTION_KEY || '',
        }
      });

      let stdout = '';
      let stderr = '';

      // ✅ 1단계: Python 프로세스 정리 로직 개선
      // 타임아웃 설정 (5분)
      let timeoutCleared = false;
      const timeout = setTimeout(() => {
        if (!python.killed) {
          console.warn('[server.js] Python 프로세스 타임아웃, SIGTERM 전송');
          python.kill('SIGTERM');
          // 3초 후 강제 종료 (SIGKILL)
          setTimeout(() => {
            if (!python.killed) {
              console.warn('[server.js] Python 프로세스 강제 종료 (SIGKILL)');
              python.kill('SIGKILL');
            }
          }, 3000);
        }
        timeoutCleared = true;
        reject(new Error('Python 스크립트 실행 시간 초과 (5분)'));
      }, 5 * 60 * 1000);

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`[Python] ${data.toString().trim()}`);
      });

      python.on('close', (code) => {
        if (!timeoutCleared) {
          clearTimeout(timeout);
        }
        // 프로세스가 정상 종료되지 않았고 아직 살아있다면 정리
        if (code !== 0 && !python.killed) {
          try {
            python.kill('SIGKILL');
          } catch (e) {
            // 이미 종료된 경우 무시
          }
        }
        if (code === 0 && stdout.trim()) {
          try {
            // JSON 부분만 추출
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd);
              const parsed = JSON.parse(jsonStr);
              resolve(parsed);
            } else {
              reject(new Error('JSON 응답을 찾을 수 없습니다.'));
            }
          } catch (e) {
            reject(new Error(`JSON 파싱 실패: ${e.message}\n출력: ${stdout.substring(0, 500)}`));
          }
        } else {
          reject(new Error(`Python 스크립트 실패 (코드: ${code})\n${stderr || '알 수 없는 오류'}`));
        }
      });

      python.on('error', (error) => {
        if (!timeoutCleared) {
          clearTimeout(timeout);
        }
        // 에러 발생 시 프로세스 정리 시도
        if (!python.killed) {
          try {
            python.kill('SIGKILL');
          } catch (e) {
            // 무시
          }
        }
        console.error(`[server.js] ❌ Python 프로세스 오류:`, error);
        reject(new Error(`Python 스크립트 실행 실패: ${error.message}`));
      });
    });

    console.log(`[server.js] ✅ Python 스크립트 실행 완료`);
    // 거래처 데이터 확인
    console.log(`[server.js] API 응답 확인: apiSuccess=${result.apiSuccess}, clients=${result.clients?.length || 0}개`);

    // ✅ Phase 1: Raw 스냅샷 저장 (원천 데이터 그대로 보관)
    if (result.clients && result.clients.length > 0 && run && saveRawSnapshot) {
      try {
        saveRawSnapshot({
          source: 'hometax',
          type: 'clients',
          rawPayload: result.clients,
          runId: run.runId || 'unknown',
          taxAccountantId,
          certPath: certPath,
          parseVersion: '1.0.0',
        });
        console.log(`[server.js] ✅ Raw 스냅샷 저장 완료 (홈택스 거래처 ${result.clients.length}건)`);
      } catch (rawErr) {
        console.error(`[server.js] ⚠️ Raw 스냅샷 저장 실패 (서비스에는 영향 없음):`, rawErr.message);
      }
    }

    if (!result.apiSuccess || !result.clients || result.clients.length === 0) {
      // Run 완료 (실패 또는 빈 결과)
      if (run && completeRun) {
        try {
          completeRun(run.runId, { status: 'FAILED', totalTasks: 0, successTasks: 0, failedTasks: 0, errorSummary: result.apiError || '조회된 거래처 없음' });
        } catch (runErr) {
          console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
        }
      }
      return res.json({
        success: true,
        data: [],
        message: result.apiError || '조회된 거래처가 없습니다.',
        meta: {
          taxAccountantId,
          taxAccountantName: taxAccountant.name,
          fetchedCount: 0,
        }
      });
    }

    // 홈택스 거래처 데이터를 Company 형식으로 변환
    console.log(`[server.js] 조회된 거래처 수: ${result.clients?.length || 0}개`);
    const companies = result.clients.map((client) => {
      const name = client.fnm || client.tnmNm || client.거래처명 || client.name || '거래처명 없음';
      const businessNumber = client.bsno || client.clntbsno || client.사업자번호 || '';
      const representative = client.txprNm || client.대표자명 || '';
      const address = client.주소 || client.address || '';
      const phone = client.전화번호 || client.phone || '';

      return {
        name,
        businessNumber: businessNumber.replace(/-/g, ''),
        ceoName: representative,
        address,
        phone,
        email: client.이메일 || client.email || '',
        industry: client.업종 || '',
        employeeCount: 0,
        taxAccountantId: taxAccountantId,
        _engagementStatus: client._engagementStatus || '수임중',
        _originalData: client,
      };
    });

    console.log(`[server.js] 변환된 거래처 수: ${companies.length}개`);
    console.log(`[server.js] saveCompanies 호출 전`);

    // 거래처 저장 (재조회 시 업데이트 옵션 활성화)
    let savedCompanies = [];
    try {
      savedCompanies = await saveCompanies(companies, {
        updateExisting: true // 기존 거래처 업데이트
      });
      console.log(`[server.js] saveCompanies 반환: ${savedCompanies.length}개`);

      // 저장된 개수와 조회된 개수 비교
      if (savedCompanies.length !== companies.length) {
        const missing = companies.length - savedCompanies.length;
        console.warn(`[server.js] ⚠️ 경고: 조회된 거래처 ${companies.length}개 중 ${savedCompanies.length}개만 저장되었습니다. (누락: ${missing}개)`);
        console.warn(`[server.js] 세무사: ${taxAccountant.name} (ID: ${taxAccountantId})`);

        // 누락된 거래처 정보 출력 (처음 5개만)
        const savedBizNos = new Set(savedCompanies.map(c => c.businessNumber || c._originalData?.bsno || '').filter(Boolean));
        const missingCompanies = companies.filter(c => {
          const bizNo = c.businessNumber || c._originalData?.bsno || '';
          return bizNo && !savedBizNos.has(bizNo);
        }).slice(0, 5);

        if (missingCompanies.length > 0) {
          console.warn(`[server.js] 누락된 거래처 예시 (최대 5개):`);
          missingCompanies.forEach(c => {
            const name = c.name || c._originalData?.tnmNm || '이름 없음';
            const bizNo = c.businessNumber || c._originalData?.bsno || '사업자번호 없음';
            const resno = c._originalData?.resno || '주민번호 없음';
            console.warn(`  - ${name} (사업자번호: ${bizNo}, 주민번호: ${resno})`);
          });
        }
      }
    } catch (error) {
      console.error(`[server.js] saveCompanies 오류:`, error);
      // 일부는 저장되었을 수 있으므로 에러를 전파하지 않고 경고만 출력
      // 하지만 클라이언트에는 저장된 개수만 반환
    }

    // 통계 계산 (신규 vs 업데이트)
    let newCount = 0;
    let updatedCount = 0;

    savedCompanies.forEach(company => {
      // createdAt과 updatedAt이 같으면 신규, 다르면 업데이트
      if (company.createdAt === company.updatedAt) {
        newCount++;
      } else {
        updatedCount++;
      }
    });

    // ✅ Run 완료 처리
    if (run && completeRun) {
      try {
        completeRun(run.runId, {
          status: savedCompanies.length > 0 ? 'SUCCESS' : 'FAILED',
          totalTasks: companies.length,
          successTasks: savedCompanies.length,
          failedTasks: companies.length - savedCompanies.length,
          snapshotPath: `hometax/clients/`,
        });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }

    res.json({
      success: true,
      data: savedCompanies,
      message: `${savedCompanies.length}개 거래처가 조회되어 저장되었습니다. (신규: ${newCount}개, 업데이트: ${updatedCount}개)`,
      meta: {
        taxAccountantId,
        taxAccountantName: taxAccountant.name,
        fetchedCount: savedCompanies.length,
        runId: run?.runId,
        stats: {
          new: newCount,
          updated: updatedCount,
          total: savedCompanies.length
        }
      }
    });
  } catch (error) {
    console.error('[ERROR] 거래처 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Run 실패 처리
    if (run && completeRun) {
      try {
        completeRun(run.runId, { status: 'FAILED', totalTasks: 0, successTasks: 0, failedTasks: 0, errorSummary: errorMessage });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }
    res.status(500).json({
      success: false,
      data: null,
      message: `거래처 조회 중 오류가 발생했습니다: ${errorMessage}`,
      error: errorMessage,
    });
  } finally {
    // ✅ 1단계: 작업 완료 등록 해제
    unregisterActiveTask(taskId);
  }
});

// 위택스 거래처 조회 및 저장
app.post('/api/companies/fetch-from-wetax', async (req, res) => {
  let run = null;
  const taskId = `wetax-fetch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  registerActiveTask(taskId);
  try {
    const { taxAccountantId } = req.body;

    if (!taxAccountantId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사 ID는 필수입니다.',
      });
    }

    // 세무사 정보 조회 (검증 먼저)
    const taxAccountant = await getTaxAccountant(taxAccountantId);
    if (!taxAccountant) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    // 인증서 정보 확인
    if (!taxAccountant.certificateHash) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사에 연동된 인증서가 없습니다.',
      });
    }

    // ✅ 검증 완료 후 Run 시작
    if (startRun) {
      run = startRun({ source: 'wetax', type: 'clients', taxAccountantId });
    } else {
      console.warn('[server.js] startRun 함수를 찾을 수 없습니다. Raw 저장을 건너뜁니다.');
    }

    // 인증서 경로 및 비밀번호 조회
    const certPath = taxAccountant.certificatePath || await getCertPathByHash(taxAccountant.certificateHash);
    if (!certPath) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '인증서 경로를 찾을 수 없습니다.',
      });
    }

    const password = await getCertificatePassword(certPath);
    if (!password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '인증서 비밀번호를 찾을 수 없습니다.',
      });
    }

    // 인증서 파일 읽기
    const certFileData = fs.readFileSync(certPath);

    // 위택스 위임자 조회
    const fetcher = new WetaxClientFetcher();
    const certificateData = {
      certFilename: require('path').basename(certPath),
      certFileData: certFileData,
      certPassword: password
    };

    console.log(`[server.js] 위택스 위임자 조회 시작: ${taxAccountant.name} (ID: ${taxAccountantId})`);
    const wetaxClients = await fetcher.fetchClients(certificateData);

    // 위임자 그룹을 평탄화하여 Company 형식으로 변환
    const allClients = [];
    for (const groupId in wetaxClients) {
      const groupClients = wetaxClients[groupId];
      allClients.push(...groupClients);
    }

    console.log(`[server.js] 조회된 위택스 위임자 수: ${allClients.length}개`);

    // ✅ Phase 1: Raw 스냅샷 저장 (원천 데이터 그대로 보관)
    if (allClients.length > 0 && run && saveRawSnapshot) {
      try {
        saveRawSnapshot({
          source: 'wetax',
          type: 'clients',
          rawPayload: wetaxClients, // 그룹화된 원본 그대로 저장
          runId: run.runId || 'unknown',
          taxAccountantId,
          certPath: certPath,
          parseVersion: '1.0.0',
        });
        console.log(`[server.js] ✅ Raw 스냅샷 저장 완료 (위택스 위임자 ${allClients.length}건)`);
      } catch (rawErr) {
        console.error(`[server.js] ⚠️ Raw 스냅샷 저장 실패 (서비스에는 영향 없음):`, rawErr.message);
      }
    }

    if (allClients.length === 0) {
      if (run && completeRun) {
        try {
          completeRun(run.runId, { status: 'FAILED', totalTasks: 0, successTasks: 0, failedTasks: 0, errorSummary: '조회된 위택스 거래처 없음' });
        } catch (runErr) {
          console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
        }
      }
      return res.json({
        success: true,
        data: [],
        message: '조회된 위택스 거래처가 없습니다.',
        meta: {
          taxAccountantId,
          taxAccountantName: taxAccountant.name,
          fetchedCount: 0,
        }
      });
    }

    // 위택스 위임자 데이터를 Company 형식으로 변환
    const companies = allClients.map((client) => {
      const name = client.dlgpConmNm || client.dlgpNm || '거래처명 없음';
      const businessNumber = (client.dlgpBrno || client.dlgpBzmnId || '').replace(/-/g, '');
      const representative = client.dlgpNm || '';
      const phone = client.dlgpMblTelno || '';

      return {
        name,
        businessNumber: businessNumber,
        ceoName: representative,
        address: '',
        phone,
        email: '',
        industry: '',
        employeeCount: 0,
        taxAccountantId: taxAccountantId,
        _source: 'wetax', // 위택스 출처 표시
        _originalData: client,
      };
    });

    console.log(`[server.js] 변환된 거래처 수: ${companies.length}개`);

    // 위택스 거래처 저장 (별도 저장소 사용: data/wetax-companies/index.json)
    let savedCompanies = [];
    try {
      savedCompanies = await saveWetaxCompanies(companies, {
        updateExisting: true // 기존 거래처 업데이트
      });
      console.log(`[server.js] saveWetaxCompanies 반환: ${savedCompanies.length}개`);
    } catch (error) {
      console.error(`[server.js] saveWetaxCompanies 오류:`, error);
    }

    // 통계 계산 (신규 vs 업데이트)
    let newCount = 0;
    let updatedCount = 0;

    savedCompanies.forEach(company => {
      if (company.createdAt === company.updatedAt) {
        newCount++;
      } else {
        updatedCount++;
      }
    });

    // ✅ Run 완료 처리
    if (run && completeRun) {
      try {
        completeRun(run.runId, {
          status: savedCompanies.length > 0 ? 'SUCCESS' : 'FAILED',
          totalTasks: companies.length,
          successTasks: savedCompanies.length,
          failedTasks: companies.length - savedCompanies.length,
          snapshotPath: `wetax/clients/`,
        });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }

    res.json({
      success: true,
      data: savedCompanies,
      message: `${savedCompanies.length}개 위택스 거래처가 조회되어 저장되었습니다. (신규: ${newCount}개, 업데이트: ${updatedCount}개)`,
      meta: {
        taxAccountantId,
        taxAccountantName: taxAccountant.name,
        fetchedCount: savedCompanies.length,
        runId: run?.runId,
        stats: {
          new: newCount,
          updated: updatedCount,
          total: savedCompanies.length
        }
      }
    });
  } catch (error) {
    console.error('[ERROR] 위택스 거래처 조회 오류:', error);
    if (run && completeRun) {
      try {
        completeRun(run.runId, { status: 'FAILED', totalTasks: 0, successTasks: 0, failedTasks: 0, errorSummary: error.message });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }
    res.status(500).json({
      success: false,
      data: null,
      message: '위택스 거래처 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  } finally {
    // ✅ 1단계: 작업 완료 등록 해제
    unregisterActiveTask(taskId);
  }
});

// ========== 위택스 거래처 관리 API ==========

// 위택스 거래처 목록 조회
app.get('/api/wetax-companies', async (req, res) => {
  try {
    const { taxAccountantId } = req.query;
    const companies = await listWetaxCompanies(taxAccountantId || undefined);
    res.json({
      success: true,
      data: companies,
      message: '위택스 거래처 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '위택스 거래처 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// ========== 위택스 특별징수 신고서 관리 API ==========

// 위택스 특별징수 신고서 수집 (최근 12개월)
app.post('/api/wetax/reports/collect-withholding-tax', async (req, res) => {
  let run = null;
  const taskId = `wetax-collect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  registerActiveTask(taskId);

  try {
    const { taxAccountantId } = req.body;

    if (!taxAccountantId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사 ID는 필수입니다.',
      });
    }

    // 세무사 정보 조회
    const taxAccountant = await getTaxAccountant(taxAccountantId);
    if (!taxAccountant) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '세무사를 찾을 수 없습니다.',
      });
    }

    // 인증서 정보 확인
    if (!taxAccountant.certificateHash) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '세무사에 연동된 인증서가 없습니다.',
      });
    }

    // ✅ 검증 완료 후 Run 시작
    if (startRun) {
      run = startRun({ source: 'wetax', type: 'reports', taxAccountantId });
    } else {
      console.warn('[server.js] startRun 함수를 찾을 수 없습니다. Raw 저장을 건너뜁니다.');
    }

    // 인증서 경로 및 비밀번호 조회
    const certPath = taxAccountant.certificatePath || await getCertPathByHash(taxAccountant.certificateHash);
    if (!certPath) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '인증서 경로를 찾을 수 없습니다.',
      });
    }

    const password = await getCertificatePassword(certPath);
    if (!password) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '인증서 비밀번호를 찾을 수 없습니다.',
      });
    }

    // 인증서 파일 읽기
    const fs = require('fs');
    const certFileData = fs.readFileSync(certPath);
    const certificateData = {
      certFilename: require('path').basename(certPath),
      certFileData: certFileData,
      certPassword: password
    };

    // 위임자 목록 조회
    console.log(`[server.js] 위택스 위임자 목록 조회 시작: ${taxAccountant.name} (ID: ${taxAccountantId})`);
    const fetcher = new WetaxClientFetcher();
    const clients = await fetcher.fetchClients(certificateData);

    // 최근 12개월부터 현재일까지 (위택스는 최근 12개월까지만 검색 가능)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // 최근 12개월

    console.log(`[server.js] 수집 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);

    // 특별징수 신고서 수집
    const collector = new WetaxReportCollector();
    const collectionResult = await collector.collectWithholdingTaxReports(
      certificateData,
      clients,
      {
        startDate,
        endDate,
        delayBetweenRequests: 0.1,
        onProgress: (current, total) => {
          if (current % 10 === 0 || current === total) {
            console.log(`[server.js] 진행 상황: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
            // 진행률 업데이트
            updateProgress(taskId, current, total, '위택스 특별징수 신고서 수집');
          }
        }
      }
    );

    console.log(`[server.js] ✅ 수집 완료: ${collectionResult.totalReports}개 신고서, ${collectionResult.totalTaxpayers}명 납세의무자`);

    // ✅ Phase 1: Raw 스냅샷 저장
    if (collectionResult.reports.length > 0 && run && saveRawSnapshot) {
      try {
        saveRawSnapshot({
          source: 'wetax',
          type: 'reports',
          rawPayload: collectionResult.reports,
          runId: run.runId || 'unknown',
          taxAccountantId,
          certPath: certPath,
          parseVersion: '1.0.0',
        });
        console.log(`[server.js] ✅ Raw 스냅샷 저장 완료 (위택스 특별징수 신고서 ${collectionResult.reports.length}건)`);
      } catch (rawErr) {
        console.error(`[server.js] ⚠️ Raw 스냅샷 저장 실패 (서비스에는 영향 없음):`, rawErr.message);
      }
    }

    // ✅ Serving 레이어 저장
    let savedReports = [];
    if (collectionResult.reports.length > 0) {
      try {
        savedReports = await saveWithholdingReports(
          collectionResult.reports,
          taxAccountantId,
          taxAccountant.name
        );
        console.log(`[server.js] ✅ Serving 레이어 저장 완료 (${savedReports.length}건)`);
      } catch (saveErr) {
        console.error(`[server.js] ⚠️ Serving 레이어 저장 실패:`, saveErr.message);
      }
    }

    // ✅ Run 완료 처리
    if (run && completeRun) {
      try {
        completeRun(run.runId, {
          status: collectionResult.successCount > 0 ? 'SUCCESS' : 'FAILED',
          totalTasks: collectionResult.totalReports,
          successTasks: collectionResult.successCount,
          failedTasks: collectionResult.failCount,
          snapshotPath: `wetax/reports/`,
        });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }

    res.json({
      success: true,
      data: savedReports,
      message: `${collectionResult.totalReports}개 신고서 수집 완료 (성공: ${collectionResult.successCount}, 실패: ${collectionResult.failCount}, 납세의무자: ${collectionResult.totalTaxpayers}명)`,
      meta: {
        taxAccountantId,
        taxAccountantName: taxAccountant.name,
        totalReports: collectionResult.totalReports,
        totalTaxpayers: collectionResult.totalTaxpayers,
        successCount: collectionResult.successCount,
        failCount: collectionResult.failCount,
        savedCount: savedReports.length,
        runId: run?.runId,
      }
    });

  } catch (error) {
    console.error('[ERROR] 위택스 특별징수 신고서 수집 오류:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Run 실패 처리
    if (run && completeRun) {
      try {
        completeRun(run.runId, { status: 'FAILED', totalTasks: 0, successTasks: 0, failedTasks: 0, errorSummary: errorMessage });
      } catch (runErr) {
        console.error(`[server.js] ⚠️ Run 완료 처리 실패 (서비스에는 영향 없음):`, runErr.message);
      }
    }

    res.status(500).json({
      success: false,
      data: null,
      message: '위택스 특별징수 신고서 수집 중 오류가 발생했습니다.',
      error: errorMessage,
    });
  } finally {
    // ✅ 1단계: 작업 완료 등록 해제
    unregisterActiveTask(taskId);
  }
});

// 위택스 특별징수 신고서 목록 조회
app.get('/api/wetax/reports/withholding-tax', async (req, res) => {
  try {
    const { taxAccountantId } = req.query;
    const reports = await listWithholdingReports(taxAccountantId || undefined);
    res.json({
      success: true,
      data: reports,
      message: '위택스 특별징수 신고서 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '위택스 특별징수 신고서 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 위택스 특별징수 신고서 KPI 통계 조회
app.get('/api/wetax/reports/withholding-tax/kpi', async (req, res) => {
  try {
    const { taxAccountantId } = req.query;
    const kpi = await getWithholdingTaxKPI(taxAccountantId || undefined);
    res.json({
      success: true,
      data: kpi,
      message: 'KPI 통계 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: 'KPI 통계 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 위택스 특별징수 신고서 거래처별 통계 조회
app.get('/api/wetax/reports/withholding-tax/company-stats', async (req, res) => {
  try {
    const { taxAccountantId } = req.query;
    const stats = await getCompanyWithholdingStats(taxAccountantId || undefined);
    res.json({
      success: true,
      data: stats,
      message: '거래처별 통계 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '거래처별 통계 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 위택스 특별징수 신고서 납세의무자 목록 조회
app.get('/api/wetax/reports/withholding-tax/taxpayers', async (req, res) => {
  try {
    const { businessNumber, month, incomeType, taxAccountantId } = req.query;
    const taxpayers = await getTaxpayersByFilter({
      businessNumber: businessNumber || undefined,
      month: month || undefined,
      incomeType: incomeType || undefined,
      taxAccountantId: taxAccountantId || undefined,
    });
    res.json({
      success: true,
      data: taxpayers,
      message: '납세의무자 목록 조회 성공',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '납세의무자 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// ========== 수집 실행 이력 API ==========

// 수집 실행 이력 조회
app.get('/api/scrape-runs', async (req, res) => {
  try {
    const { source, type, taxAccountantId, limit: limitStr } = req.query;
    const runs = listRuns({
      source: source || undefined,
      type: type || undefined,
      taxAccountantId: taxAccountantId || undefined,
      limit: limitStr ? parseInt(limitStr) : 50,
    });
    res.json({
      success: true,
      data: runs,
      message: `${runs.length}개 수집 실행 이력 조회`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '수집 실행 이력 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 거래처 정보 수정
app.put('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await updateCompany(id, updateData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '거래처를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: updated,
      message: '거래처 정보가 수정되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: '거래처 정보 수정 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 거래처 삭제
app.delete('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteCompany(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '거래처를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      message: '거래처가 삭제되었습니다.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '거래처 삭제 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// ✅ 포트 사용 여부 확인 함수
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(true); // 포트 사용 가능
      });
    });
    
    server.on('error', (err) => {
      resolve(false); // 포트 이미 사용 중
    });
  });
}

// ✅ 안전한 서버 시작
async function startServer() {
  console.log(`[서버] 포트 ${PORT} 사용 가능 여부 확인 중...`);
  
  const isPortAvailable = await checkPortAvailable(PORT);
  
  if (!isPortAvailable) {
    console.error(`[오류] 포트 ${PORT}이 이미 사용 중입니다.`);
    console.error('[해결책] 기존 프로세스를 종료한 후 다시 시도하세요:');
    console.error(`         lsof -ti:${PORT} | xargs kill -TERM`);
    process.exit(1);
    return;
  }
  
  console.log(`[서버] 포트 ${PORT} 사용 가능 확인됨. 서버 시작 중...`);
  
  const server = app.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`외부 API 서버: ${EXTERNAL_API_BASE_URL}`);
  console.log(`상태 확인: http://localhost:${PORT}/api/status`);
  console.log('----------------------------------------');

  // 서버 타임아웃 설정 (수집 작업이 오래 걸릴 수 있으므로 30분으로 설정)
  server.timeout = 30 * 60 * 1000; // 30분
  server.keepAliveTimeout = 30 * 60 * 1000; // 30분

  // 서버 시작 시 자동으로 health check 수행
  try {
    // 내부 서버 health check
    const healthCheck = {
      status: 'ok',
      message: '서버가 정상적으로 실행 중입니다.',
      timestamp: new Date().toISOString()
    };
    console.log('[Health Check] 내부 서버 상태:');
    console.log(JSON.stringify(healthCheck, null, 2));
    console.log('----------------------------------------');

    // 외부 API 서버 상태 확인
    console.log('[Health Check] 외부 API 서버 상태 확인 중...');
    const externalStatus = await checkExternalApiStatus();
    console.log(JSON.stringify(externalStatus, null, 2));
    console.log('----------------------------------------');
  } catch (error) {
    console.error('[Health Check] 오류 발생:', error.message);
  }
});

  // ✅ 서버 시작 오류 처리
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[오류] 포트 ${PORT}가 이미 사용 중입니다.`);
      console.error('[해결책] 다음 명령어로 기존 프로세스를 종료한 후 다시 시도하세요:');
      console.error(`         lsof -ti:${PORT} | xargs kill -TERM`);
      process.exit(1);
    } else {
      console.error('[오류] 서버 시작 중 오류 발생:', error);
      throw error; // 다른 오류는 uncaughtException 핸들러로 전달
    }
  });

  // 전역 변수에 서버 저장 (graceful shutdown용)
  globalServer = server;
  return server;
}

// 전역 서버 변수 (graceful shutdown에서 사용)
let globalServer = null;

// ✅ Graceful shutdown - nodemon 재시작 시 포트 해제 보장
async function gracefulShutdown(signal) {
  console.log(`\n[서버] ${signal} 수신, 서버 종료 중...`);
  console.log(`[서버] 진행 중인 작업: ${activeTasks.size}개`);

  // 진행 중인 작업이 있으면 대기
  if (activeTasks.size > 0) {
    console.log(`[서버] 진행 중인 작업 완료 대기 중... (최대 ${MAX_SHUTDOWN_WAIT / 1000}초)`);
    const startTime = Date.now();

    // 모든 작업이 완료되거나 타임아웃까지 대기
    while (activeTasks.size > 0 && (Date.now() - startTime) < MAX_SHUTDOWN_WAIT) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (activeTasks.size > 0) {
        console.log(`[서버] 대기 중... (진행 중: ${activeTasks.size}개, 경과: ${Math.round((Date.now() - startTime) / 1000)}초)`);
      }
    }

    if (activeTasks.size > 0) {
      console.warn(`[서버] 경고: ${activeTasks.size}개 작업이 완료되지 않았습니다. 강제 종료합니다.`);
    } else {
      console.log('[서버] 모든 작업이 완료되었습니다.');
    }
  }

  // HTTP 서버 종료
  if (globalServer) {
    globalServer.close(() => {
      console.log('[서버] HTTP 서버 종료 완료');
      process.exit(0);
    });
  } else {
    console.log('[서버] 서버 인스턴스를 찾을 수 없습니다.');
    process.exit(0);
  }

  // 추가 안전장치: 5초 후 강제 종료
  setTimeout(() => {
    console.error('[서버] 강제 종료 (서버 종료 타임아웃)');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// nodemon 전용: SIGUSR2 수신 시 graceful shutdown 후 다시 SIGUSR2 전송
process.once('SIGUSR2', async () => {
  console.log('[서버] nodemon 재시작 감지 (SIGUSR2)');
  await gracefulShutdown('SIGUSR2');
  // gracefulShutdown이 완료되면 nodemon이 자동으로 재시작
});

// 헬퍼 함수 export (다른 모듈에서 사용 가능하도록)
if (typeof module !== 'undefined' && module.exports) {
  module.exports.registerActiveTask = registerActiveTask;
  module.exports.unregisterActiveTask = unregisterActiveTask;
}

// ✅ 서버 시작
startServer().catch((error) => {
  console.error('[오류] 서버 시작 실패:', error);
  process.exit(1);
});

