"""
Python 사용 예시
"""

import sys
from pathlib import Path

# src 폴더를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from infer_metadata_from_file import infer_metadata_from_file
from parse_certificate_without_password import parse_certificate_without_password
from parse_certificate_with_password import parse_certificate_with_password
from login_with_certificate import login_with_certificate
from fetch_additional_cookies import fetch_additional_cookies


def example():
    # 예시 인증서 경로 (실제 경로로 변경 필요)
    cert_path = '/path/to/certificate.p12'
    password = 'password123'
    
    # 3. 메타데이터 유추
    print('=== 메타데이터 유추 ===')
    metadata = infer_metadata_from_file(cert_path)
    if metadata:
        print(f"소유자명: {metadata.get('subject_name', 'N/A')}")
        print(f"유효기간: {metadata.get('valid_to', 'N/A')}")
        print(f"만료 여부: {metadata.get('is_expired', False)}")
    
    # 4. 비밀번호 없이 파싱
    print('\n=== 비밀번호 없이 파싱 ===')
    try:
        info = parse_certificate_without_password(cert_path)
        print(f"시리얼 번호: {info.get('serial_number', 'N/A')}")
        print(f"주체명: {info.get('subject_name', 'N/A')}")
        print(f"유효기간: {info.get('valid_to', 'N/A')}")
    except Exception as e:
        print(f"파싱 실패: {e}")
    
    # 5. 비밀번호로 파싱
    print('\n=== 비밀번호로 파싱 ===')
    try:
        full_info = parse_certificate_with_password(cert_path, password)
        print(f"개인키 포함: {full_info.get('has_private_key', False)}")
        print(f"PEM 길이: {len(full_info.get('cert_pem', '')) if full_info.get('cert_pem') else 0}")
    except Exception as e:
        print(f"파싱 실패: {e}")
    
    # 7. 로그인
    print('\n=== 로그인 ===')
    try:
        result = login_with_certificate(cert_path, password, fetch_user_info=True)
        if result['success']:
            print(f"로그인 성공!")
            print(f"쿠키 개수: {len(result['cookies'])}")
            print(f"사용자 번호: {result.get('pubcUserNo', 'N/A')}")
            print(f"납세자 번호: {result.get('tin', 'N/A')}")
            print(f"사용자명: {result.get('charId', 'N/A')}")
            print(f"사용자 구분: {result.get('userType', 'N/A')}")
            
            # 8. 추가 쿠키 획득
            print('\n=== 추가 쿠키 획득 ===')
            user_info = fetch_additional_cookies(result['session'])
            if user_info['success']:
                print(f"추가 쿠키 개수: {len(user_info['cookies'])}")
                print(f"사용자 번호: {user_info.get('pubcUserNo', 'N/A')}")
                print(f"납세자 번호: {user_info.get('tin', 'N/A')}")
        else:
            print("로그인 실패")
    except Exception as e:
        print(f"로그인 실패: {e}")


if __name__ == '__main__':
    # example()  # 주석 해제하여 실행
    print("예시 코드입니다. 실제 인증서 경로와 비밀번호를 설정한 후 실행하세요.")

