"""
3. 메타데이터 유추 테스트
"""

import sys
import os
from pathlib import Path

# modules 폴더를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'modules' / 'certificate' / 'metadata'))

import importlib.util
spec = importlib.util.spec_from_file_location("infer_metadata_from_file", Path(__file__).parent.parent.parent.parent / 'modules' / 'certificate' / 'metadata' / 'infer.py')
infer_metadata_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infer_metadata_module)
infer_metadata_from_file = infer_metadata_module.infer_metadata_from_file


def test_infer_metadata():
    print("=== 3. 메타데이터 유추 테스트 ===\n")
    
    # 인증서 경로 입력 받기
    if len(sys.argv) > 1:
        cert_path = sys.argv[1]
    else:
        # 예시 경로 (실제 경로로 변경 필요)
        cert_path = input("인증서 파일 경로를 입력하세요: ").strip()
    
    if not cert_path or not os.path.exists(cert_path):
        print("❌ 인증서 파일을 찾을 수 없습니다.")
        print(f"   경로: {cert_path}")
        return
    
    print(f"테스트 인증서: {cert_path}\n")
    
    try:
        metadata = infer_metadata_from_file(cert_path)
        
        if metadata:
            print("✅ 메타데이터 유추 성공\n")
            print(f"소유자명: {metadata.get('subject_name', 'N/A')}")
            print(f"유효기간 시작: {metadata.get('valid_from', 'N/A')}")
            print(f"유효기간 종료: {metadata.get('valid_to', 'N/A')}")
            print(f"만료 여부: {'만료됨' if metadata.get('is_expired') else '유효함'}")
            print(f"만료까지 남은 일수: {metadata.get('days_until_expiry', 0)}일")
            print(f"발행기관: {metadata.get('issuer_name', 'N/A')}")
            print(f"유추 방식: {'파일명 기반' if metadata.get('is_heuristic') else '파일 시스템'}")
        else:
            print("⚠️  메타데이터를 유추할 수 없습니다.")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_infer_metadata()

