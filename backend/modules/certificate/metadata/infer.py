"""
3. 조회된 인증서의 파일에서 유효기간등 유추
파일명과 경로를 기반으로 메타데이터를 유추합니다 (비밀번호 불필요)
"""

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict


def infer_metadata_from_file(file_path: str) -> Optional[Dict]:
    """
    파일 경로(파일명)에서 메타데이터 유추 (NPKI 명명 규칙 기반)
    
    Args:
        file_path: 인증서 파일 경로
        
    Returns:
        유추된 메타데이터 딕셔너리 또는 None
    """
    filename = os.path.basename(file_path)
    
    # 1. 소유자명 추출
    subject_name = ""
    name_match = re.match(r'^([^0-9\(]+)', filename)
    if name_match:
        subject_name = name_match.group(1).strip()
    
    if not subject_name:
        name_match = re.search(r'\(([^0-9]+)\)', filename)
        if name_match:
            subject_name = name_match.group(1).strip()
    
    # 2. 날짜 추출 (YYYYMMDD 형식)
    date_match = re.search(r'(20[2-3]\d[0-1]\d[0-3]\d)', filename)
    
    valid_from = None
    valid_to = None
    is_expired = False
    days_until_expiry = 0
    
    if date_match:
        date_str = date_match.group(1)
        try:
            valid_from = datetime.strptime(date_str, '%Y%m%d').replace(tzinfo=timezone.utc)
            valid_to = valid_from + timedelta(days=365)
            
            now = datetime.now(timezone.utc)
            is_expired = now > valid_to
            days_until_expiry = (valid_to - now).days if not is_expired else 0
        except ValueError:
            pass
    
    # 3. 발행기관 유추
    issuer_name = "unknown"
    if '001' in filename: issuer_name = "한국정보인증(KICA)"
    elif '002' in filename: issuer_name = "금융결제원(yessign)"
    elif '003' in filename: issuer_name = "코스컬(SignKorea)"
    elif '004' in filename: issuer_name = "한국전자인증(CrossCert)"
    elif '005' in filename: issuer_name = "한국무역정보통신(TradeSign)"
    
    if valid_to or subject_name:
        return {
            'subject_name': subject_name,
            'valid_from': valid_from.isoformat() if valid_from else None,
            'valid_to': valid_to.isoformat() if valid_to else None,
            'is_expired': is_expired,
            'days_until_expiry': days_until_expiry,
            'issuer_name': issuer_name,
            'is_heuristic': True,
            'serial_number': 'N/A',
            'has_private_key': False,
        }
    
    # 4. 파일 시스템 시간 활용
    try:
        mtime = os.path.getmtime(file_path)
        mtime_dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
        return {
            'subject_name': filename,
            'valid_from': None,
            'valid_to': (mtime_dt + timedelta(days=365)).isoformat(),
            'is_heuristic': True,
            'note': '파일 수정 시간을 기반으로 유추함'
        }
    except:
        return None

