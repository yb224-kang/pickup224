"""
4. 인증서 파싱 (비밀번호 입력전)
비밀번호 없이 공개 인증서 메타데이터만 추출합니다.
"""

import os
from typing import Dict, Optional
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

try:
    from .infer_metadata_from_file import infer_metadata_from_file
except ImportError:
    from infer_metadata_from_file import infer_metadata_from_file


def parse_certificate_without_password(cert_path: str) -> Dict:
    """
    비밀번호 없이 인증서 메타데이터 추출
    
    Args:
        cert_path: 인증서 파일 경로 (.der, .p12, .pfx)
        
    Returns:
        인증서 메타데이터 딕셔너리
    """
    cert_path_lower = cert_path.lower()
    
    # DER 형식
    if cert_path_lower.endswith('.der'):
        return parse_der_without_password(cert_path)
    
    # P12/PFX 형식
    elif cert_path_lower.endswith('.p12') or cert_path_lower.endswith('.pfx'):
        return parse_p12_without_password(cert_path)
    
    else:
        raise ValueError(f"지원하지 않는 인증서 형식: {cert_path}")


def parse_der_without_password(der_path: str) -> Dict:
    """DER 파일에서 공개 인증서 메타데이터 추출"""
    if not os.path.exists(der_path):
        raise FileNotFoundError(f"DER 파일을 찾을 수 없습니다: {der_path}")
    
    try:
        with open(der_path, 'rb') as f:
            der_data = f.read()
        
        cert = x509.load_der_x509_certificate(der_data, default_backend())
        return extract_metadata_from_cert(cert, has_private_key=False)
    except Exception as e:
        # 유추 로직으로 폴백
        heuristic = infer_metadata_from_file(der_path)
        if heuristic:
            return heuristic
        raise ValueError(f"DER 파일 파싱 실패: {str(e)}")


def parse_p12_without_password(p12_path: str) -> Dict:
    """P12/PFX 파일에서 공개 인증서 메타데이터 추출"""
    if not os.path.exists(p12_path):
        raise FileNotFoundError(f"P12 파일을 찾을 수 없습니다: {p12_path}")
    
    # 표준 파싱 시도
    try:
        with open(p12_path, 'rb') as f:
            p12_data = f.read()
        
        try:
            _, cert, _ = serialization.pkcs12.load_key_and_certificates(p12_data, password=None)
        except (ValueError, Exception):
            try:
                _, cert, _ = serialization.pkcs12.load_key_and_certificates(p12_data, password=b'')
            except (ValueError, Exception):
                cert = None
        
        if cert:
            return extract_metadata_from_cert(cert, has_private_key=False)
    except Exception as e:
        pass
    
    # 유추 로직으로 폴백
    heuristic = infer_metadata_from_file(p12_path)
    if heuristic:
        return heuristic
    
    raise ValueError("P12 파일에서 공개 인증서를 추출할 수 없습니다.")


def extract_metadata_from_cert(cert, has_private_key: bool = False) -> Dict:
    """인증서 객체에서 메타데이터 추출"""
    from datetime import datetime, timezone
    
    # 유효기간
    try:
        not_valid_before = cert.not_valid_before_utc
        not_valid_after = cert.not_valid_after_utc
    except AttributeError:
        not_valid_before = cert.not_valid_before
        not_valid_after = cert.not_valid_after
        if not_valid_before.tzinfo is None:
            not_valid_before = not_valid_before.replace(tzinfo=timezone.utc)
        if not_valid_after.tzinfo is None:
            not_valid_after = not_valid_after.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    is_expired = now > not_valid_after
    days_until_expiry = (not_valid_after - now).days if not is_expired else 0
    
    # Subject 정보
    subject = {}
    subject_name = ""
    subject_organization = ""
    
    try:
        for attr in cert.subject:
            oid_name = attr.oid._name
            value = attr.value
            subject[oid_name] = value
            
            if oid_name == 'commonName':
                subject_name = value
            elif oid_name == 'organizationName':
                subject_organization = value
    except:
        pass
    
    # Issuer 정보
    issuer = {}
    issuer_name = ""
    try:
        for attr in cert.issuer:
            oid_name = attr.oid._name
            value = attr.value
            issuer[oid_name] = value
            if oid_name == 'commonName':
                issuer_name = value
    except:
        pass
    
    # 시리얼 번호
    serial_number = hex(cert.serial_number).replace("0x", "").lower()
    
    return {
        'serial_number': serial_number,
        'subject': subject,
        'issuer': issuer,
        'subject_name': subject_name,
        'subject_organization': subject_organization,
        'issuer_name': issuer_name,
        'valid_from': not_valid_before.isoformat(),
        'valid_to': not_valid_after.isoformat(),
        'is_expired': is_expired,
        'days_until_expiry': days_until_expiry,
        'has_private_key': has_private_key,
    }

