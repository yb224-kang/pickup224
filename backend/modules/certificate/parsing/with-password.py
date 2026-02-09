"""
5. 인증서 파싱 (비밀번호 입력후)
비밀번호를 사용하여 인증서를 완전히 파싱합니다.
"""

import os
from typing import Dict, Optional
from pypinksign import PinkSign


def parse_certificate_with_password(
    cert_path: str,
    password: str,
    key_path: Optional[str] = None
) -> Dict:
    """
    비밀번호를 사용하여 인증서 파싱
    
    Args:
        cert_path: 인증서 파일 경로
        password: 인증서 비밀번호
        key_path: DER+KEY 형식일 때 KEY 파일 경로 (선택)
        
    Returns:
        인증서 정보 딕셔너리 (개인키 포함)
    """
    cert_path_lower = cert_path.lower()
    
    # P12/PFX 형식
    if cert_path_lower.endswith('.p12') or cert_path_lower.endswith('.pfx'):
        sign = load_p12_certificate(cert_path, password)
    
    # DER+KEY 형식
    elif cert_path_lower.endswith('.der'):
        if not key_path:
            # 자동으로 signPri.key 찾기
            base_dir = os.path.dirname(cert_path)
            potential_key_path = os.path.join(base_dir, "signPri.key")
            if os.path.exists(potential_key_path):
                key_path = potential_key_path
            else:
                raise ValueError(f"DER 형식 인증서는 .key 파일이 필요합니다: {cert_path}")
        
        sign = load_der_key_certificate(cert_path, key_path, password)
    
    else:
        raise ValueError(f"지원하지 않는 인증서 형식: {cert_path}")
    
    # 인증서 정보 추출
    return get_certificate_info(sign)


def load_p12_certificate(cert_path: str, password: str) -> PinkSign:
    """P12/PFX 형식 인증서 로드"""
    if not os.path.exists(cert_path):
        raise FileNotFoundError(f"인증서 파일을 찾을 수 없습니다: {cert_path}")
    
    with open(cert_path, 'rb') as f:
        p12_data = f.read()
    
    sign = PinkSign(
        p12_data=p12_data,
        prikey_password=password.encode('utf-8')
    )
    
    return sign


def load_der_key_certificate(der_path: str, key_path: str, password: str) -> PinkSign:
    """DER+KEY 형식 인증서 로드"""
    if not os.path.exists(der_path):
        raise FileNotFoundError(f"DER 파일을 찾을 수 없습니다: {der_path}")
    if not os.path.exists(key_path):
        raise FileNotFoundError(f"KEY 파일을 찾을 수 없습니다: {key_path}")
    
    with open(der_path, 'rb') as f:
        der_data = f.read()
    
    sign = PinkSign(pubkey_data=der_data)
    
    with open(key_path, 'rb') as f:
        key_data = f.read()
    
    sign.load_prikey(
        prikey_data=key_data,
        prikey_password=password.encode('utf-8')
    )
    
    return sign


def get_certificate_info(sign: PinkSign) -> Dict:
    """PinkSign 객체에서 인증서 정보 추출"""
    try:
        from .parse_certificate_without_password import extract_metadata_from_cert
    except ImportError:
        from parse_certificate_without_password import extract_metadata_from_cert
    
    # 공개 인증서 추출
    try:
        cert_pem = sign.get_cert_pem()
    except:
        cert_pem = None
    
    # 시리얼 번호
    try:
        serial_num = sign.serialnum()
        serial_hex = hex(serial_num).replace("0x", "").lower() if serial_num else None
    except:
        serial_hex = None
    
    # 메타데이터 추출
    if hasattr(sign, 'pub_cert') and sign.pub_cert:
        metadata = extract_metadata_from_cert(sign.pub_cert, has_private_key=True)
    else:
        metadata = {
            'serial_number': serial_hex,
            'has_private_key': True,
        }
    
    return {
        **metadata,
        'cert_pem': cert_pem,
        'serial_number': serial_hex,
        'has_private_key': True,
    }

