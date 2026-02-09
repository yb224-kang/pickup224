#!/usr/bin/env python3
"""
인증서 유효기간 조회 스크립트
"""
import sys
import json
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
modules_path = project_root / 'backend' / 'modules'
sys.path.insert(0, str(modules_path))

try:
    # 직접 경로로 import
    import importlib.util
    
    # 먼저 infer_metadata_from_file 모듈 로드
    infer_path = modules_path / 'certificate' / 'metadata' / 'infer.py'
    infer_spec = importlib.util.spec_from_file_location("infer_metadata", infer_path)
    infer_module = importlib.util.module_from_spec(infer_spec)
    infer_spec.loader.exec_module(infer_module)
    # 전역 네임스페이스에 추가
    import sys
    sys.modules['infer_metadata_from_file'] = infer_module
    
    # without-password.py 모듈 로드
    without_password_path = modules_path / 'certificate' / 'parsing' / 'without-password.py'
    spec = importlib.util.spec_from_file_location(
        "without_password",
        without_password_path
    )
    parse_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parse_module)
    parse_certificate_without_password = parse_module.parse_certificate_without_password
    
    if len(sys.argv) < 2:
        print(json.dumps({'error': '인증서 경로가 필요합니다'}))
        sys.exit(1)
    
    cert_path = sys.argv[1]
    
    try:
        metadata = parse_certificate_without_password(cert_path)
        result = {
            'validFrom': metadata.get('valid_from'),
            'validTo': metadata.get('valid_to'),
            'isExpired': metadata.get('is_expired', False)
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'validFrom': None,
            'validTo': None,
            'isExpired': False
        }))
except Exception as e:
    import traceback
    print(json.dumps({
        'error': f'모듈 로드 실패: {str(e)}',
        'traceback': traceback.format_exc(),
        'validFrom': None,
        'validTo': None,
        'isExpired': False
    }))

