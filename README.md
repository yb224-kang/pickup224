# Pickup API Server

외부 API 서버 접속 상태를 확인하는 기본 서버입니다.

## 기능

- 외부 API 서버 (`http://112.155.1.171:8080/api`) 접속 상태 확인
- 서버 상태 모니터링

## 설치

```bash
npm install
```

## 실행

```bash
# 일반 실행
npm start

# 개발 모드 (nodemon 사용)
npm run dev
```

## API 엔드포인트

### GET /
서버 기본 정보를 반환합니다.

### GET /health
서버 자체의 상태를 확인합니다.

### GET /api/status
외부 API 서버의 접속 상태를 확인합니다.

**응답 예시:**
```json
{
  "status": "connected",
  "statusCode": 200,
  "message": "외부 API 서버에 성공적으로 연결되었습니다.",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 환경 변수

- `PORT`: 서버 포트 (기본값: 3000)

## 사용 기술

- Express.js
- Axios
- CORS




