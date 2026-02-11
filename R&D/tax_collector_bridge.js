const path = require('path');
const { spawn } = require('child_process');

// 프로젝트 루트 보장
const PROJECT_ROOT = '/Users/sunnitic/Desktop/00_dev_/Pickup';
process.chdir(PROJECT_ROOT);

require('ts-node').register({
    project: path.join(PROJECT_ROOT, 'backend/tsconfig.json'),
    transpileOnly: true,
});

const { listSavedCertificates, getCertificatePassword } = require('../backend/index');


async function run() {
    console.log('>>> [준비] 백엔드 모듈을 통해 인증서 및 복호화된 비밀번호를 로드합니다.');

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
        console.error('[오류] 수집 가능한 비밀번호가 저장된 인증서가 없습니다.');
        return;
    }

    console.log(`[확인] ${certsWithPassword.length}개의 인증서로 거래처 목록 조회를 시작합니다... (이 과정은 최대 2분 소요될 수 있습니다)`);

    // 1. 백엔드 fetch-all-clients.py 호출
    const fetchClientsScript = path.join(PROJECT_ROOT, 'backend', 'integration', 'scripts', 'fetch-all-clients.py');
    const fetchProcess = spawn('python3', [
        fetchClientsScript,
        JSON.stringify(certsWithPassword)
    ]);

    let fetchOutput = '';
    fetchProcess.stdout.on('data', (data) => {
        fetchOutput += data.toString();
    });

    fetchProcess.stderr.on('data', (data) => {
        process.stderr.write(`[Fetch Error] ${data.toString()}`);
    });

    fetchProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`[오류] 거래처 목록 조회 프로세스 실패 (코드: ${code})`);
            return;
        }

        try {
            // fetch-all-clients.py의 마지막 줄에 JSON이 출력됨
            const jsonStart = fetchOutput.lastIndexOf('{');
            const jsonEnd = fetchOutput.lastIndexOf('}') + 1;
            const result = JSON.parse(fetchOutput.substring(jsonStart, jsonEnd));

            console.log(`[성공] 총 ${result.totalCount}개의 거래처를 확보했습니다. (성공: ${result.successCount}/${result.totalCertCount}개 인증서)`);

            if (result.totalCount === 0) {
                console.warn('[경고] 수집할 거래처가 없습니다. 종료합니다.');
                return;
            }

            // 2. Python 수집 엔진 실행 (확보된 거래처 리스트와 함께)
            console.log('>>> [실행] 각 거래처별 최근 6개월 원천세 순회 조회를 시작합니다.');
            const pythonScriptPath = path.join(PROJECT_ROOT, 'R&D', 'tax_data_collector.py');
            const pythonProcess = spawn('python3', [
                pythonScriptPath,
                '--certs_json', JSON.stringify(certsWithPassword),
                '--clients_json', JSON.stringify(result.clients)
            ]);

            pythonProcess.stdout.on('data', (data) => process.stdout.write(data.toString()));
            pythonProcess.stderr.on('data', (data) => process.stderr.write(`[Python Error] ${data.toString()}`));
            pythonProcess.on('close', (code) => {
                console.log(`\n>>> [완료] 모든 수집 프로세스가 코드 ${code}로 종료되었습니다.`);
            });

        } catch (e) {
            console.error('[오류] 거래처 목록 결과 처리 중 예외 발생:', e);
            console.log('--- Raw Output (Fetch) ---');
            console.log(fetchOutput);
            console.log('--------------------------');
        }
    });
}

run().catch(err => {
    console.error('[오류]', err);
});
