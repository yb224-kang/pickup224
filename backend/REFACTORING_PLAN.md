# 백엔드 폴더 정리 계획

## 현재 구조 분석

### 📁 현재 폴더 구조
```
backend/
├── src/                    # 소스 코드 (혼재)
│   ├── 1-8 모듈들 (TypeScript + Python 혼재)
│   └── scrapper/           # 스크래퍼 유틸리티
├── tests/                  # 테스트 코드
├── scripts/                # 통합 스크립트
├── examples/               # 예시 코드
├── dist/                   # 빌드 산출물
└── node_modules/           # 의존성
```

## 정리 목표

1. **확정된 모듈과 테스트 필요 모듈 구분**
2. **테스트 코드와 실제 코드 구분**
3. **언어별 분리 (TypeScript / Python)**
4. **명확한 폴더 구조**

## 제안하는 새로운 구조

```
backend/
├── modules/                    # 확정된 독립 모듈 (프로덕션 코드)
│   ├── certificate/            # 인증서 관련 모듈
│   │   ├── discovery/          # 조회 모듈
│   │   │   ├── basic.ts        # 1-discover-certificates-basic.ts
│   │   │   └── detailed.ts     # 2-discover-certificates-detailed.ts
│   │   ├── metadata/           # 메타데이터 모듈
│   │   │   └── infer.py        # 3-infer-metadata-from-file.py
│   │   ├── parsing/            # 파싱 모듈
│   │   │   ├── without-password.py  # 4-parse-certificate-without-password.py
│   │   │   └── with-password.py     # 5-parse-certificate-with-password.py
│   │   └── password/           # 비밀번호 관리
│   │       └── storage.ts      # 6-save-certificate-password.ts
│   └── hometax/                # 홈택스 관련 모듈
│       ├── auth/               # 인증 모듈
│       │   ├── login.py        # 7-login-with-certificate.py
│       │   └── session.py      # 8-fetch-additional-cookies.py
│       └── clients/            # 거래처 조회 모듈
│           └── fetch.py        # 8-fetch-hometax-clients.py
│
├── integration/                # 통합 스크립트 (테스트/검증 필요)
│   ├── scripts/                # 통합 스크립트
│   │   ├── get-session-with-permission.py  # 완전한 SSO 로그인
│   │   └── test-hometax-clients-ref-style.js  # 통합 테스트
│   └── docs/                   # 문서
│       └── final-success-report.md
│
├── tests/                      # 테스트 코드
│   ├── unit/                   # 단위 테스트
│   │   ├── certificate/        # 인증서 모듈 테스트
│   │   └── hometax/            # 홈택스 모듈 테스트
│   └── integration/            # 통합 테스트
│       └── hometax/            # 홈택스 통합 테스트
│
├── examples/                   # 예시 코드
│   ├── certificate/            # 인증서 예시
│   └── hometax/                # 홈택스 예시
│
├── utils/                      # 공통 유틸리티
│   └── scrapper/               # 스크래퍼 유틸리티
│       ├── session-manager.ts
│       └── types.ts
│
├── dist/                       # 빌드 산출물 (gitignore)
├── node_modules/               # 의존성 (gitignore)
├── index.ts                    # TypeScript 진입점
├── package.json
├── requirements.txt
└── README.md
```

## 모듈 분류

### ✅ 확정된 모듈 (프로덕션 사용 가능)

**인증서 관련:**
- ✅ `1-discover-certificates-basic.ts` - 기본 조회
- ✅ `2-discover-certificates-detailed.ts` - 세부 조회
- ✅ `3-infer-metadata-from-file.py` - 메타데이터 유추
- ✅ `4-parse-certificate-without-password.py` - 비밀번호 없이 파싱
- ✅ `5-parse-certificate-with-password.py` - 비밀번호로 파싱
- ✅ `6-save-certificate-password.ts` - 비밀번호 저장

**홈택스 관련:**
- ✅ `7-login-with-certificate.py` - 로그인 (성공)
- ✅ `8-fetch-additional-cookies.py` - 추가 쿠키 획득
- ✅ `8-fetch-hometax-clients.py` - 거래처 조회 (성공)

### ⚠️ 통합 스크립트 (테스트/검증 필요)

- ⚠️ `scripts/get-session-with-permission.py` - 완전한 SSO 로그인 패턴 (성공했지만 통합 테스트 필요)
- ⚠️ `scripts/test-hometax-clients-ref-style.js` - 통합 테스트 스크립트

## 실행 계획

1. **modules/ 폴더 생성 및 모듈 이동**
2. **integration/ 폴더 생성 및 통합 스크립트 이동**
3. **tests/ 폴더 재구성 (unit/integration 분리)**
4. **utils/ 폴더 생성 및 공통 유틸리티 이동**
5. **import 경로 수정**
6. **README 업데이트**

