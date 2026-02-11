const path = require('path');
const PROJECT_ROOT = '/Users/sunnitic/Desktop/00_dev_/Pickup';
require('ts-node').register({
    project: path.join(PROJECT_ROOT, 'backend/tsconfig.json'),
    transpileOnly: true,
});
const { listSavedCertificates, getCertificatePassword } = require(path.join(PROJECT_ROOT, 'backend/index'));

async function main() {
    const savedCerts = await listSavedCertificates();
    const results = [];
    for (const cert of savedCerts) {
        const password = await getCertificatePassword(cert.path);
        results.push({ name: cert.name, path: cert.path, password });
    }
    console.log(JSON.stringify(results));
}
main();
