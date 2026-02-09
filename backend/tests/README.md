# 테스트 파일

이 폴더에는 각 모듈의 테스트 스크립트가 포함되어 있습니다.

## 📁 폴더 구조

```
tests/
├── unit/                      # 단위 테스트
│   ├── certificate/           # 인증서 모듈 테스트
│   │   ├── test-discovery.ts
│   │   ├── test-password.ts
│   │   ├── test-infer-metadata.py
│   │   ├── test-parse-without-password.py
│   │   └── test-parse-with-password.py
│   ├── hometax/              # 홈택스 모듈 테스트
│   │   └── test-fetch-cookies.py
│   └── test-all.ts           # 통합 단위 테스트
└── integration/               # 통합 테스트
    └── hometax/              # 홈택스 통합 테스트
        └── test-hometax-clients-ref-style.js
```

## 테스트 파일 목록

### TypeScript 단위 테스트

- **test-discovery.ts**: 인증서 조회 테스트 (1번 & 2번)
- **test-password.ts**: 비밀번호 저장/관리 테스트 (6번)
- **test-all.ts**: 모든 TypeScript 모듈 통합 테스트

### Python 단위 테스트

- **test-infer-metadata.py**: 메타데이터 유추 테스트 (3번)
- **test-parse-without-password.py**: 비밀번호 없이 파싱 테스트 (4번)
- **test-parse-with-password.py**: 비밀번호로 파싱 테스트 (5번)
- **test-fetch-cookies.py**: 추가 쿠키 획득 테스트 (8번)

### 통합 테스트

- **test-hometax-clients-ref-style.js**: 홈택스 수임거래처 조회 통합 테스트

## 실행 방법

### TypeScript 단위 테스트

```bash
# 개별 테스트
npx ts-node tests/unit/certificate/test-discovery.ts
npx ts-node tests/unit/certificate/test-password.ts

# 통합 테스트
npx ts-node tests/unit/test-all.ts
```

### Python 단위 테스트

```bash
# 메타데이터 유추 테스트
python tests/unit/certificate/test-infer-metadata.py [인증서경로]

# 비밀번호 없이 파싱 테스트
python tests/unit/certificate/test-parse-without-password.py [인증서경로]

# 비밀번호로 파싱 테스트
python tests/unit/certificate/test-parse-with-password.py [인증서경로]

# 추가 쿠키 획득 테스트 (로그인 세션 필요)
python tests/unit/hometax/test-fetch-cookies.py
```

### 통합 테스트

```bash
# 홈택스 수임거래처 조회 통합 테스트
node tests/integration/hometax/test-hometax-clients-ref-style.js
```

## 주의사항

- 7번 인증서 로그인은 통합 테스트에서만 테스트됩니다 (실제 홈택스 서버 접속 필요)
- Python 테스트는 인증서 파일 경로를 인자로 전달하거나 실행 시 입력해야 합니다
- 비밀번호가 필요한 테스트는 보안을 위해 getpass를 사용합니다
- 통합 테스트는 저장된 인증서와 비밀번호가 필요합니다
