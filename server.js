// 하이브리드 방식: 개발 환경은 ts-node, 프로덕션은 컴파일된 파일 사용
const isDevelopment = process.env.NODE_ENV !== 'production';

// 개발 환경에서만 ts-node 사용
if (isDevelopment) {
  try {
    require('ts-node').register({
      project: './backend/tsconfig.json',
      transpileOnly: true,
    });
    console.log('[Development] TypeScript 런타임 컴파일 활성화');
  } catch (error) {
    console.warn('[Warning] ts-node를 찾을 수 없습니다. 컴파일된 파일을 사용합니다.');
  }
}

// Backend 모듈 로드 (환경에 따라 자동 선택)
let backendModule;
try {
  // 프로덕션: 컴파일된 파일 우선 시도
  backendModule = require('./backend/dist/index');
  if (!isDevelopment) {
    console.log('[Production] 컴파일된 JavaScript 파일 사용');
  }
} catch (error) {
  // 개발: TypeScript 파일 직접 사용 (ts-node가 처리)
  console.log('[DEBUG] dist/index 로드 실패, TypeScript 파일 시도:', error.message);
  backendModule = require('./backend/index');
  if (isDevelopment) {
    console.log('[Development] TypeScript 파일 직접 사용');
  }
}

// 디버깅: backendModule 내용 확인
console.log('[DEBUG] backendModule keys:', Object.keys(backendModule || {}));

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
  deleteCompany
} = backendModule;

// 디버깅: 세무사 모듈 로드 확인
console.log('[DEBUG] 세무사 모듈 확인:', {
  listTaxAccountants: typeof listTaxAccountants,
  saveTaxAccountant: typeof saveTaxAccountant,
  getTaxAccountant: typeof getTaxAccountant,
  updateTaxAccountant: typeof updateTaxAccountant,
  deleteTaxAccountant: typeof deleteTaxAccountant,
  linkCertificate: typeof linkCertificate,
});

// 디버깅: backendModule에서 직접 확인
if (backendModule) {
  console.log('[DEBUG] backendModule.listTaxAccountants:', typeof backendModule.listTaxAccountants);
  console.log('[DEBUG] backendModule에 있는 세무사 관련 함수:', 
    Object.keys(backendModule).filter(key => key.includes('Tax') || key.includes('tax')));
}

// Python 모듈 import (유효기간 파싱용)
let parseCertificateWithoutPassword;
let inferMetadataFromFile;
try {
  const pythonModules = require('./backend/modules/__init__.py');
  parseCertificateWithoutPassword = pythonModules.parse_certificate_without_password;
  inferMetadataFromFile = pythonModules.infer_metadata_from_file;
} catch (error) {
  console.warn('[Warning] Python 모듈 로드 실패, 유효기간 파싱이 제한될 수 있습니다:', error.message);
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 외부 API 서버 주소
const EXTERNAL_API_BASE_URL = 'http://112.155.1.171:8080/api';

// 미들웨어 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
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
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`[Python] ${data.toString().trim()}`);
      });
      
      python.on('close', (code) => {
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
    });
    
    // 거래처 데이터 확인
    console.log(`[server.js] API 응답 확인: apiSuccess=${result.apiSuccess}, clients=${result.clients?.length || 0}개`);
    if (!result.apiSuccess || !result.clients || result.clients.length === 0) {
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
    
    res.json({
      success: true,
      data: savedCompanies,
      message: `${savedCompanies.length}개 거래처가 조회되어 저장되었습니다. (신규: ${newCount}개, 업데이트: ${updatedCount}개)`,
      meta: {
        taxAccountantId,
        taxAccountantName: taxAccountant.name,
        fetchedCount: savedCompanies.length,
        stats: {
          new: newCount,
          updated: updatedCount,
          total: savedCompanies.length
        }
      }
    });
  } catch (error) {
    console.error('[ERROR] 거래처 조회 오류:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: '거래처 조회 중 오류가 발생했습니다.',
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

// 서버 시작
app.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`외부 API 서버: ${EXTERNAL_API_BASE_URL}`);
  console.log(`상태 확인: http://localhost:${PORT}/api/status`);
  console.log('----------------------------------------');
  
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

