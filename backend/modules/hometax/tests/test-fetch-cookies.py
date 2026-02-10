"""
8. 추가 쿠키 획득 테스트
주의: 이 테스트는 로그인된 세션이 필요합니다.
"""

import sys
from pathlib import Path

import importlib.util
import requests

spec = importlib.util.spec_from_file_location("fetch_additional_cookies", Path(__file__).parent.parent / 'auth' / 'session.py')
fetch_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_module)
fetch_additional_cookies = fetch_module.fetch_additional_cookies


def test_fetch_cookies():
    print("=== 8. 추가 쿠키 획득 테스트 ===\n")
    print("⚠️  이 테스트는 로그인된 세션이 필요합니다.")
    print("    실제 사용 시에는 login_with_certificate()로 먼저 로그인하세요.\n")
    
    # 테스트용 세션 (실제로는 로그인된 세션이어야 함)
    session = requests.Session()
    
    print("테스트: 빈 세션으로 시도...")
    try:
        result = fetch_additional_cookies(session)
        
        if result['success']:
            print("✅ 쿠키 획득 성공\n")
            print(f"사용자 번호: {result.get('pubcUserNo', 'N/A')}")
            print(f"납세자 번호: {result.get('tin', 'N/A')}")
            print(f"문자 ID: {result.get('charId', 'N/A')}")
            print(f"사용자 구분: {result.get('userType', 'N/A')}")
            print(f"쿠키 개수: {len(result.get('cookies', {}))}")
        else:
            print("⚠️  쿠키 획득 실패 (로그인되지 않은 세션)")
            print("   정상적인 동작입니다. 로그인 후 다시 시도하세요.")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        print("   로그인된 세션이 필요합니다.")


if __name__ == '__main__':
    test_fetch_cookies()


