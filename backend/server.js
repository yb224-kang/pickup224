// 하이브리드 방식: 개발 환경은 ts-node, 프로덕션은 컴파일된 파일 사용
const isDevelopment = process.env.NODE_ENV !== 'production';

// 개발 환경에서만 ts-node 사용
if (isDevelopment) {
    try {
        require('ts-node').register({
            project: './tsconfig.json',
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
    backendModule = require('./dist/index');
    if (!isDevelopment) {
        console.log('[Production] 컴파일된 JavaScript 파일 사용');
    }
} catch (error) {
    // 개발: TypeScript 파일 직접 사용 (ts-node가 처리)
    backendModule = require('./index');
    if (isDevelopment) {
        console.log('[Development] TypeScript 파일 직접 사용');
    }
}

const {
    discoverCertificatesBasic,
    discoverCertificatesDetailed,
    saveCertificatePassword,
    getCertificatePassword,
    deleteCertificatePassword,
    listSavedCertificates
} = backendModule;

// Python 모듈 import (유효기간 파싱용)
let parseCertificateWithoutPassword;
let inferMetadataFromFile;
try {
    const pythonModules = require('./modules/__init__.py');
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
        const response = await axios.get(`${EXTERNAL_API_BASE_URL}/docs`, {
            timeout: 15000,
            validateStatus: function (status) {
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
                    const { spawn } = require('child_process');
                    const path = require('path');
                    const pythonScript = path.join(__dirname, 'scripts', 'get-cert-validity.py');

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
                                        resolve(null);
                                    }
                                } catch (parseError) {
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

// 인증서 목록 조회 (세부) - 유효기간 포함
app.get('/api/certificates/detailed', async (req, res) => {
    try {
        const certificates = await discoverCertificatesDetailed();

        // 각 인증서의 유효기간 파싱
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
sys.path.insert(0, '${__dirname}/modules')
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
        const pythonScriptPath = path.join(__dirname, 'integration', 'scripts', 'fetch-all-clients.py');

        const savedCerts = await listSavedCertificates();

        if (!savedCerts || savedCerts.length === 0) {
            return res.json({
                success: false,
                data: [],
                message: '저장된 인증서가 없습니다.',
            });
        }

        const certsWithPassword = await Promise.all(
            savedCerts.map(async (cert) => {
                const password = await getCertificatePassword(cert.path);
                return {
                    path: cert.path,
                    name: cert.name,
                    password: password || '',
                };
            })
        );

        const validCerts = certsWithPassword.filter(cert => cert.password);

        if (validCerts.length === 0) {
            return res.json({
                success: false,
                data: [],
                message: '비밀번호가 저장된 인증서가 없습니다.',
            });
        }

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

// 서버 시작
app.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`외부 API 서버: ${EXTERNAL_API_BASE_URL}`);
    console.log(`상태 확인: http://localhost:${PORT}/api/status`);
    console.log('----------------------------------------');

    try {
        const healthCheck = {
            status: 'ok',
            message: '서버가 정상적으로 실행 중입니다.',
            timestamp: new Date().toISOString()
        };
        console.log('[Health Check] 내부 서버 상태:');
        console.log(JSON.stringify(healthCheck, null, 2));
        console.log('----------------------------------------');

        console.log('[Health Check] 외부 API 서버 상태 확인 중...');
        const externalStatus = await checkExternalApiStatus();
        console.log(JSON.stringify(externalStatus, null, 2));
        console.log('----------------------------------------');
    } catch (error) {
        console.error('[Health Check] 오류 발생:', error.message);
    }
});
