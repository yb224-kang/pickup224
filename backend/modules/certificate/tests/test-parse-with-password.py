"""
5. 비밀번호로 인증서 파싱 테스트
"""

import sys
import os
import getpass
from pathlib import Path

import importlib.util
spec = importlib.util.spec_from_file_location("parse_certificate_with_password", Path(__file__).parent.parent / 'parsing' / 'with-password.py')
parse_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parse_module)
parse_certificate_with_password = parse_module.parse_certificate_with_password


def test_parse_with_password():
    print("=== 5. 비밀번호로 인증서 파싱 테스트 ===\n")
    
    if len(sys.argv) > 1:
        cert_path = sys.argv[1]
    else:
        cert_path = input("인증서 파일 경로를 입력하세요: ").strip()
    
    if not cert_path or not os.path.exists(cert_path):
        print("❌ 인증서 파일을 찾을 수 없습니다.")
        return
    
    # 비밀번호 입력
    password = getpass.getpass("인증서 비밀번호를 입력하세요: ")
    
    if not password:
        print("❌ 비밀번호가 입력되지 않았습니다.")
        return
    
    print(f"\n테스트 인증서: {cert_path}\n")
    
    try:
        full_info = parse_certificate_with_password(cert_path, password)
        
        print("✅ 파싱 성공\n")
        print(f"시리얼 번호: {full_info.get('serial_number', 'N/A')}")
        print(f"주체명: {full_info.get('subject_name', 'N/A')}")
        print(f"발급자: {full_info.get('issuer_name', 'N/A')}")
        print(f"유효기간 시작: {full_info.get('valid_from', 'N/A')}")
        print(f"유효기간 종료: {full_info.get('valid_to', 'N/A')}")
        print(f"개인키 포함: {'예' if full_info.get('has_private_key') else '아니오'}")
        
        if full_info.get('cert_pem'):
            print(f"PEM 인증서 길이: {len(full_info['cert_pem'])} bytes")
        
        if full_info.get('private_key_info'):
            print(f"개인키 알고리즘: {full_info['private_key_info'].get('algorithm', 'N/A')}")
        
    except ValueError as e:
        print(f"❌ 인증서 형식 오류: {e}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_parse_with_password()


