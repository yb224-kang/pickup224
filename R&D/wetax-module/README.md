# 위택스 모듈 (Wetax Module)

위택스 자동로그인 및 수집 기능을 제공하는 독립 모듈입니다.

## 설치

```bash
npm install @your-org/wetax-module
```

## 사용법

### 기본 사용

```typescript
import {
  WetaxScrapper,
  WetaxService,
  CertificateData,
  CertificateSigner,
} from "@your-org/wetax-module";

// 인증서 서명 모듈 (외부에서 주입)
class KSignAdapter implements CertificateSigner {
  loadCert(files: CertFile[], password: string): CertificateSignerInstance {
    // KSign 또는 다른 인증서 모듈 사용
    const ksign = KSign.loadCert(files, password);
    return {
      validateCertExpiry: () => ksign.validateCertExpiry(),
      pkcs7SignedMsg: (msg: Buffer) => ksign.pkcs7SignedMsg(msg),
    };
  }
}

// 인증서 데이터 준비
const certificate: CertificateData = {
  certFilename: "cert.der",
  certFileData: Buffer.from("..."),
  certPassword: "password",
};

// 서비스 생성
const certificateSigner = new KSignAdapter();
const service = new WetaxService(certificateSigner);

// 위임자 목록 조회
const clients = await service.getWetaxClients(certificate);

// 원천세 신고내역 조회
const reports = await service.getWetaxWithholdingTaxReportDetail(
  certificate,
  new Date("2024-01-01"),
  new Date("2024-12-31")
);
```

### 파일 다운로드

```typescript
import { StorageService } from "@your-org/wetax-module";

// 스토리지 서비스 구현 (선택사항)
class S3StorageService implements StorageService {
  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    // S3 업로드 로직
    return key;
  }
}

const storageService = new S3StorageService();

// 파일 다운로드
const downloadResults = await service.downloadDocument(
  certificate,
  "reportId",
  "원천세",
  "tin",
  "paymentNumber",
  storageService,
  async (file) => {
    // 파일 업로드 후 처리
    console.log(`파일 업로드 완료: ${file.reportId}`);
  }
);
```

## 인터페이스

### CertificateSigner

인증서 서명을 처리하는 인터페이스입니다. 외부 인증서 모듈에서 구현해야 합니다.

### StorageService

파일 저장을 처리하는 인터페이스입니다. 선택사항이며, 제공하지 않으면 로컬에 저장됩니다.

### Logger

로깅을 처리하는 인터페이스입니다. 기본적으로 ConsoleLogger가 사용됩니다.

## 의존성

- `axios`: HTTP 클라이언트
- `playwright`: 브라우저 자동화
- `zod`: 스키마 검증
- `date-fns`: 날짜 처리
- `tough-cookie`: 쿠키 관리

## 라이선스

UNLICENSED

