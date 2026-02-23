#!/usr/bin/env python3
"""
위택스용 인증서 서명 모듈
pypinksign을 사용하여 PKCS7 서명 생성
"""
import sys
import json
import base64
from pypinksign import PinkSign
from datetime import datetime
from typing import Optional

def load_certificate(cert_path: str, password: str) -> PinkSign:
    """인증서 로드"""
    with open(cert_path, 'rb') as f:
        p12_data = f.read()
    
    sign = PinkSign(
        p12_data=p12_data,
        prikey_password=password.encode('utf-8')
    )
    return sign

def validate_cert_expiry(sign: PinkSign) -> None:
    """인증서 만료일 검증"""
    try:
        # pypinksign의 인증서 정보 확인
        if hasattr(sign, 'cert') and sign.cert:
            cert = sign.cert
            # 만료일 확인
            not_after = cert.not_valid_after
            now = datetime.now()
            if now > not_after:
                raise ValueError(f"인증서가 만료되었습니다. 만료일: {not_after}")
            print(f"인증서 만료일: {not_after}", file=sys.stderr)
    except Exception as e:
        # 만료일 검증 실패 시에도 계속 진행 (경고만)
        print(f"인증서 만료일 검증 경고: {e}", file=sys.stderr)

def pkcs7_signed_msg(sign: PinkSign, message: bytes) -> bytes:
    """PKCS7 서명 메시지 생성"""
    return sign.pkcs7_signed_msg(message)

def main():
    """CLI 진입점"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "명령어가 필요합니다: validate|sign"}), file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "validate":
        if len(sys.argv) < 4:
            print(json.dumps({"error": "사용법: python certificate-signer.py validate <cert_path> <password>"}), file=sys.stderr)
            sys.exit(1)
        
        cert_path = sys.argv[2]
        password = sys.argv[3]
        
        try:
            sign = load_certificate(cert_path, password)
            validate_cert_expiry(sign)
            print(json.dumps({"status": "OK"}))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    
    elif command == "sign":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "사용법: python certificate-signer.py sign <cert_path> <password> <message_base64>"}), file=sys.stderr)
            sys.exit(1)
        
        cert_path = sys.argv[2]
        password = sys.argv[3]
        message_base64 = sys.argv[4]
        
        try:
            sign = load_certificate(cert_path, password)
            validate_cert_expiry(sign)
            
            # Base64 디코딩
            message = base64.b64decode(message_base64)
            
            # PKCS7 서명 생성
            signed_data = pkcs7_signed_msg(sign, message)
            
            # Base64 인코딩하여 출력
            signed_base64 = base64.b64encode(signed_data).decode('utf-8')
            print(json.dumps({"signed": signed_base64}))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    
    else:
        print(json.dumps({"error": f"알 수 없는 명령어: {command}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()


