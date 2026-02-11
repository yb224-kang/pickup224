const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'backend/integration/scripts');

// Helper to run python script and get JSON output
function runPython(scriptName, args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        console.log(`[EXEC] python3 ${scriptName} ${args.map(a => a.length > 50 ? a.substring(0, 20) + '...' : a).join(' ')}`);

        const proc = spawn('python3', [scriptPath, ...args], { cwd: PROJECT_ROOT });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('close', code => {
            if (code !== 0) {
                console.error(`[ERR] ${stderr}`);
                return reject(new Error(`Script ${scriptName} failed with code ${code}`));
            }
            try {
                // Find last JSON object
                const lines = stdout.trim().split('\n');
                let jsonStr = '';
                // Try to parse the output. Sometimes it prints logs before JSON.
                // We look for { ... } at the end.
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    resolve(JSON.parse(jsonMatch[0]));
                } else {
                    resolve(null);
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Helper to run dump_certs.js (Node script)
function runDumpCerts() {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, 'dump_certs.js');
        const proc = spawn('node', [scriptPath], { cwd: PROJECT_ROOT });
        let stdout = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.on('close', code => {
            if (code !== 0) return reject(new Error('dump_certs failed'));
            resolve(JSON.parse(stdout));
        });
    });
}

async function run() {
    try {
        console.log('>>> [1/2] 인증서 확보 중...');
        const certs = await runDumpCerts();
        if (!certs || certs.length === 0) throw new Error('인증서가 없습니다.');
        const targetCert = certs[0];
        console.log(`   - 인증서 선택: ${targetCert.name}`);

        console.log('>>> [2/2] 통합 데이터 수집 실행 (run-hometax-collection.py)...');

        // 최근 1개월 데이터 수집 (2026년 1월)
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        };
        
        const startDate = formatDate(lastMonth);
        const endDate = formatDate(lastMonthEnd);
        
        console.log(`   - 수집 기간: ${startDate} ~ ${endDate} (최근 1개월)`);

        const collectArgs = [
            '--cert_path', targetCert.path,
            '--password', targetCert.password,
            '--tax_name', '부가세',
            '--start_date', startDate,
            '--end_date', endDate,
            // '--target_biz_no', '7740403391' // 테스트용 특정 사업자
        ];

        const result = await runPython('run-hometax-collection.py', collectArgs, true); // Use -u option

        console.log('\n>>> [RESULT] 수집 결과:');
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('\n[TEST FAILED]', e);
    }
}

run();
