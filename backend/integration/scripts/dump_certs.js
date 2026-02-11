const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// tg-node 등록
require('ts-node').register({
    project: path.join(PROJECT_ROOT, 'backend/tsconfig.json'),
    transpileOnly: true,
});

// 프로젝트 루트의 backend/index.ts (가 아니라 backend/index.ts는 없고 backend/index.ts는 있음)
// 실제 경로는 PROJECT_ROOT/index.ts 
// 잠시, backend/index.ts 위치를 확인해야 함.
// view_file backend/index.ts 결과: backend/index.ts 존재.

const { listSavedCertificates, getCertificatePassword } = require('../../index');
// backend/integration/scripts/dump_certs.js 위치 기준:
// ../../index -> backend/index.ts

async function dump() {
    try {
        const certs = await listSavedCertificates();
        const out = [];
        for (const c of certs) {
            const pwd = await getCertificatePassword(c.path);
            if (pwd) {
                out.push({ path: c.path, name: c.name, password: pwd });
            }
        }
        console.log(JSON.stringify(out));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

dump();
