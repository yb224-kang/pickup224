# 홈택스 인증서 관리 백엔드 모듈

이 폴더에는 홈택스 인증서 관리 및 홈택스 API 연동을 위한 독립적인 모듈들이 포함되어 있습니다.

## 📁 폴더 구조

```
backend/
├── modules/                    # ✅ 확정된 독립 모듈 (프로덕션 코드)
│   ├── certificate/            # 인증서 관련 모듈
│   │   ├── discovery/         # 조회 모듈
│   │   │   ├── basic.ts        # 기본 조회
│   │   │   └── detailed.ts    # 세부 조회
│   │   ├── metadata/           # 메타데이터 모듈
│   │   │   └── infer.py        # 메타데이터 유추
│   │   ├── parsing/            # 파싱 모듈
│   │   │   ├── without-password.py  # 비밀번호 없이 파싱
│   │   │   └── with-password.py     # 비밀번호로 파싱
│   │   └── password/           # 비밀번호 관리
│   │       └── storage.ts      # 비밀번호 저장/조회
│   └── hometax/                # 홈택스 관련 모듈
│       ├── auth/               # 인증 모듈
│       │   ├── login.py        # 로그인
│       │   └── session.py     # 세션 관리
│       └── clients/            # 거래처 조회 모듈
│           └── fetch.py       # 거래처 조회
│
├── integration/                # ⚠️ 통합 스크립트 (테스트/검증 필요)
│   ├── scripts/                # 통합 스크립트
│   │   └── get-session-with-permission.py  # 완전한 SSO 로그인
│   └── docs/                   # 문서
│       └── final-success-report.md
│
├── tests/                      # 테스트 코드
│   ├── unit/                   # 단위 테스트
│   │   ├── certificate/        # 인증서 모듈 테스트
│   │   ├── hometax/           # 홈택스 모듈 테스트
│   │   └── test-all.ts        # 통합 단위 테스트
│   └── integration/            # 통합 테스트
│       └── hometax/           # 홈택스 통합 테스트
│
├── utils/                      # 공통 유틸리티
│   └── scrapper/              # 스크래퍼 유틸리티
│       ├── session-manager.ts
│       └── types.ts
│
├── examples/                   # 예시 코드
├── index.ts                    # TypeScript 진입점
├── package.json
├── requirements.txt
└── README.md
```

## 모듈 목록

### 인증서 관련 모듈

#### 1. 인증서 조회 (기본조회)
- **파일**: `modules/certificate/discovery/basic.ts`
- **함수**: `discoverCertificatesBasic()`
- **설명**: NPKI 기본 경로에서만 인증서를 검색합니다.

#### 2. 인증서 조회 (세부조회)
- **파일**: `modules/certificate/discovery/detailed.ts`
- **함수**: `discoverCertificatesDetailed()`
- **설명**: 기본 경로 + 시스템 경로에서 인증서를 검색합니다.

#### 3. 메타데이터 유추
- **파일**: `modules/certificate/metadata/infer.py`
- **함수**: `infer_metadata_from_file(file_path)`
- **설명**: 파일명과 경로를 기반으로 메타데이터를 유추합니다 (비밀번호 불필요).

#### 4. 인증서 파싱 (비밀번호 없이)
- **파일**: `modules/certificate/parsing/without-password.py`
- **함수**: `parse_certificate_without_password(cert_path)`
- **설명**: 비밀번호 없이 인증서 정보를 추출합니다.

#### 5. 인증서 파싱 (비밀번호 사용)
- **파일**: `modules/certificate/parsing/with-password.py`
- **함수**: `parse_certificate_with_password(cert_path, password, key_path?)`
- **설명**: 비밀번호를 사용하여 인증서 정보를 추출합니다.

#### 6. 비밀번호 저장/관리
- **파일**: `modules/certificate/password/storage.ts`
- **함수**: `saveCertificatePassword()`, `getCertificatePassword()`, `deleteCertificatePassword()`
- **설명**: 인증서 비밀번호를 안전하게 저장하고 관리합니다.

### 홈택스 관련 모듈

#### 7. 인증서 로그인
- **파일**: `modules/hometax/auth/login.py`
- **함수**: `login_with_certificate(cert_path, password, key_path?, fetch_user_info?)`
- **설명**: 홈택스에 인증서로 로그인합니다.
- **상태**: ✅ 성공 (테스트 완료)

#### 8. 세션 관리
- **파일**: `modules/hometax/auth/session.py`
- **함수**: `fetch_additional_cookies(session, screen_id?)`
- **설명**: 로그인 후 추가 쿠키와 사용자 정보를 획득합니다.

#### 9. 거래처 조회
- **파일**: `modules/hometax/clients/fetch.py`
- **함수**: `fetch_hometax_clients(session, hometax_admin_code?, engagement_code?)`
- **설명**: 수임거래처 목록을 조회합니다.
- **상태**: ✅ 성공 (테스트 완료)

## 통합 스크립트

### 완전한 SSO 로그인 패턴
- **파일**: `integration/scripts/get-session-with-permission.py`
- **설명**: 완전한 SSO 로그인 패턴을 구현한 통합 스크립트
- **상태**: ✅ 성공 (200개 거래처 조회 성공)

## 사용 방법

### TypeScript 모듈

```typescript
import {
    discoverCertificatesBasic,
    discoverCertificatesDetailed,
    saveCertificatePassword,
    getCertificatePassword
} from './index';

// 인증서 기본 조회
const certs = await discoverCertificatesBasic();
console.log(`발견된 인증서: ${certs.length}개`);

// 비밀번호 저장
await saveCertificatePassword('/path/to/cert.p12', 'password123');

// 비밀번호 조회
const password = await getCertificatePassword('/path/to/cert.p12');
```

### Python 모듈

```python
import sys
from pathlib import Path

# modules 폴더를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent / 'modules'))

from certificate.metadata.infer import infer_metadata_from_file
from certificate.parsing.with_password import parse_certificate_with_password
from hometax.auth.login import login_with_certificate

# 메타데이터 유추
metadata = infer_metadata_from_file('/path/to/cert.p12')
print(f"유효기간: {metadata['valid_to']}")

# 비밀번호로 파싱
full_info = parse_certificate_with_password('/path/to/cert.p12', 'password123')
print(f"개인키 포함: {full_info['has_private_key']}")

# 홈택스 로그인
result = login_with_certificate('/path/to/cert.p12', 'password123')
print(f"로그인 성공: {result['success']}")
```

## 테스트

### 단위 테스트

```bash
# TypeScript 테스트
npx ts-node tests/unit/certificate/test-discovery.ts
npx ts-node tests/unit/certificate/test-password.ts
npx ts-node tests/unit/test-all.ts

# Python 테스트
python tests/unit/certificate/test-infer-metadata.py [인증서경로]
python tests/unit/certificate/test-parse-without-password.py [인증서경로]
python tests/unit/certificate/test-parse-with-password.py [인증서경로]
```

### 통합 테스트

```bash
# 홈택스 통합 테스트
node tests/integration/hometax/test-hometax-clients-ref-style.js
```

## 모듈 상태

### ✅ 확정된 모듈 (프로덕션 사용 가능)
- 모든 인증서 관련 모듈 (1-6번)
- 홈택스 로그인 모듈 (7번)
- 홈택스 세션 관리 모듈 (8번)
- 홈택스 거래처 조회 모듈 (9번)

### ⚠️ 통합 스크립트 (테스트/검증 필요)
- `integration/scripts/get-session-with-permission.py` - 완전한 SSO 로그인 패턴

## 참고 문서

- [최종 성공 보고서](integration/docs/final-success-report.md) - 홈택스 구조 및 구현 완료 사항
- [리팩토링 계획](REFACTORING_PLAN.md) - 폴더 구조 정리 계획
