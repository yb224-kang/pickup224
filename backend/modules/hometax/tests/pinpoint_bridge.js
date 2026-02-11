const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 프로젝트 루트 설정
const PROJECT_ROOT = path.resolve(__dirname, '../../../..'); // backend/modules/hometax/tests -> backend -> modules -> hometax -> tests (4 levels deep from backend root? No.)
// __dirname: .../backend/modules/hometax/tests
// PROJECT_ROOT: .../ (root of repo)

// Let's use absolute path like existing bridge
const ROOT_DIR = '/Users/sunnitic/Desktop/00_dev_/Pickup';
process.chdir(ROOT_DIR);

require('ts-node').register({
    project: path.join(ROOT_DIR, 'backend/tsconfig.json'),
    transpileOnly: true,
});

// Import backend functions
const { listSavedCertificates, getCertificatePassword } = require(path.join(ROOT_DIR, 'backend/index'));

async function run() {
    console.log('>>> [PINPOINT BRIDGE] 인증서 및 비밀번호 로드 중...');

    try {
        const savedCerts = await listSavedCertificates();
        const certsWithPassword = [];

        for (const cert of savedCerts) {
            const password = await getCertificatePassword(cert.path);
            if (password) {
                certsWithPassword.push({
                    path: cert.path,
                    name: cert.name,
                    password: password
                });
            }
        }

        if (certsWithPassword.length === 0) {
            console.error('[오류] 사용 가능한 인증서(비밀번호 포함)가 없습니다.');
            return;
        }

        console.log(`>>> [PINPOINT BRIDGE] ${certsWithPassword.length}개의 인증서 확보. 거래처 목록 조회 시작...`);

        // 1. 거래처 목록 확보 (fetch-all-clients.py)
        const fetchScript = path.join(ROOT_DIR, 'backend', 'integration', 'scripts', 'fetch-all-clients.py');
        const fetchProcess = spawn('python3', [
            fetchScript,
            JSON.stringify(certsWithPassword)
        ]);

        let fetchOutput = '';
        fetchProcess.stdout.on('data', d => fetchOutput += d.toString());
        fetchProcess.stderr.on('data', d => process.stderr.write(`[Fetch Err] ${d}`));

        await new Promise((resolve, reject) => {
            fetchProcess.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`Fetch failed with code ${code}`));
            });
        });

        // Parse Clients
        const lines = fetchOutput.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        let allClients = [];
        try {
            const res = JSON.parse(lastLine);
            allClients = res.clients || [];
        } catch (e) {
            console.error('[오류] 거래처 목록 JSON 파싱 실패');
            console.log(lastLine);
            return;
        }

        if (allClients.length === 0) {
            console.warn('[경고] 조회된 거래처가 없습니다.');
            // But maybe we want to test even without clients if we were just testing certs? No.
            return;
        }

        console.log(`>>> [PINPOINT BRIDGE] 총 ${allClients.length}개 거래처 확보. 핀포인트 스캔 시작...`);

        // E2BIG 방지를 위해 파일로 저장
        const tempDir = path.join(ROOT_DIR, 'R&D/temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const certsFile = path.join(tempDir, 'certs_temp.json');
        const clientsFile = path.join(tempDir, 'clients_temp.json');

        fs.writeFileSync(certsFile, JSON.stringify(certsWithPassword));
        fs.writeFileSync(clientsFile, JSON.stringify(allClients));

        // 2. 핀포인트 스캔 Python 실행
        const pinpointScript = path.join(ROOT_DIR, 'backend/modules/hometax/tests/pinpoint_integration_test.py');
        const runner = spawn('python3', [
            pinpointScript,
            '--certs_file', certsFile,
            '--clients_file', clientsFile
        ]);

        runner.stdout.on('data', d => process.stdout.write(d));
        runner.stderr.on('data', d => process.stderr.write(d));

        runner.on('close', code => {
            console.log(`>>> [PINPOINT BRIDGE] 테스트 종료 (Code: ${code})`);
        });

    } catch (e) {
        console.error('[FATAL ERROR]', e);
    }
}

run();
