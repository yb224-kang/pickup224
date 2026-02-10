"""
4. 비밀번호 없이 인증서 파싱 테스트
"""

import sys
import os
from pathlib import Path

# modules 폴더를 경로에 추가
modules_path = Path(__file__).parent.parent
sys.path.insert(0, str(modules_path))

import importlib.util
# 먼저 infer_metadata_from_file 모듈 로드
infer_spec = importlib.util.spec_from_file_location("infer_metadata_from_file", modules_path / 'metadata' / 'infer.py')
infer_module = importlib.util.module_from_spec(infer_spec)
infer_spec.loader.exec_module(infer_module)
sys.modules['infer_metadata_from_file'] = infer_module

# parse_certificate_without_password 모듈 로드
spec = importlib.util.spec_from_file_location("parse_certificate_without_password", modules_path / 'parsing' / 'without-password.py')
parse_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parse_module)
parse_certificate_without_password = parse_module.parse_certificate_without_password


def test_parse_without_password():
    print("=== 4. 비밀번호 없이 인증서 파싱 테스트 ===\n")
    
    if len(sys.argv) > 1:
        cert_path = sys.argv[1]
    else:
        cert_path = input("인증서 파일 경로를 입력하세요: ").strip()
    
    if not cert_path or not os.path.exists(cert_path):
        print("❌ 인증서 파일을 찾을 수 없습니다.")
        return
    
    print(f"테스트 인증서: {cert_path}\n")
    
    try:
        info = parse_certificate_without_password(cert_path)
        
        print("✅ 파싱 성공\n")
        print(f"시리얼 번호: {info.get('serial_number', 'N/A')}")
        print(f"주체명: {info.get('subject_name', 'N/A')}")
        print(f"발급자: {info.get('issuer_name', 'N/A')}")
        print(f"유효기간 시작: {info.get('valid_from', 'N/A')}")
        print(f"유효기간 종료: {info.get('valid_to', 'N/A')}")
        print(f"개인키 포함: {'예' if info.get('has_private_key') else '아니오 (비밀번호 필요)'}")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_parse_without_password()


