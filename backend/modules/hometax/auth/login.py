"""
7. 인증서 로그인
홈택스에 인증서로 로그인합니다.

ref의 HometaxScrapper 로직을 기반으로 구현되었습니다:
- DER와 P12/PFX 형식에 따라 randomEnc 추출 방식이 다릅니다.
- logSgnt 생성 시 serialNum과 timestamp를 포함합니다.
- pkcLgnClCd는 "04"를 사용합니다.
"""

import requests
from typing import Dict, Optional
from pypinksign import PinkSign


def login_with_certificate(
    cert_path: str,
    password: str,
    key_path: Optional[str] = None,
    fetch_user_info: bool = True
) -> Dict:
    """
    홈택스 로그인 (인증서 경로 사용)
    
    DER와 P12/PFX 형식에 따라 다른 방식으로 처리됩니다:
    - DER+KEY: PinkSign 객체에서 직접 randomEnc 추출
    - P12/PFX: 파일 경로와 비밀번호를 사용하여 randomEnc 추출 (OpenSSL fallback 포함)
    
    Args:
        cert_path: 인증서 파일 경로
        password: 인증서 비밀번호
        key_path: DER+KEY 형식일 때 KEY 파일 경로 (선택)
        fetch_user_info: 로그인 후 사용자 정보 자동 획득 여부
        
    Returns:
        {
            'success': True,
            'session': requests.Session,
            'cookies': Dict[str, str],
            'pubcUserNo': Optional[str],
            'tin': Optional[str],
            'charId': Optional[str],
            'userType': Optional[str],
        }
    """
    cert_path_lower = cert_path.lower()
    is_p12_format = cert_path_lower.endswith('.p12') or cert_path_lower.endswith('.pfx')
    is_der_format = cert_path_lower.endswith('.der')
    
    # 1. 인증서 로드 (형식에 따라 다른 방식)
    if is_p12_format:
        sign = load_p12_certificate(cert_path, password)
    elif is_der_format:
        if not key_path:
            import os
            base_dir = os.path.dirname(cert_path)
            potential_key_path = os.path.join(base_dir, "signPri.key")
            if os.path.exists(potential_key_path):
                key_path = potential_key_path
            else:
                raise ValueError(f"DER 형식 인증서는 .key 파일이 필요합니다: {cert_path}")
        sign = load_der_key_certificate(cert_path, key_path, password)
    else:
        raise ValueError(f"지원하지 않는 인증서 형식: {cert_path}")
    
    # 2. 공개 인증서 추출
    cert_pem = get_cert_pem(sign)
    
    # 3. randomEnc 추출 (형식에 따라 다른 방식)
    if is_p12_format:
        # P12/PFX: 파일 경로와 비밀번호 필요 (OpenSSL fallback 포함)
        random_enc = extract_random_enc_p12(cert_path, password, sign)
    elif is_der_format:
        # DER+KEY: PinkSign 객체에서 직접 추출 (파일 경로 불필요)
        random_enc = extract_random_enc_der_key(sign)
    else:
        raise ValueError(f"지원하지 않는 인증서 형식: {cert_path}")
    
    # 4. 세션 생성
    session = requests.Session()
    
    # 5. 챌린지 요청
    pkc_enc_ssn = request_challenge(session)
    
    # 6. logSgnt 생성 (ref 로직 방식: serialNum과 timestamp 포함)
    log_sgnt = generate_logsgnt(sign, pkc_enc_ssn)
    
    # 7. pubcLogin.do 호출
    result = call_pubclogin(session, log_sgnt, cert_pem, random_enc)
    
    # 8. SSO 로그인 (ref 로직: 세션 유지에 필요)
    sso_login(session)
    
    # 9. 사용자 정보 획득 (선택적)
    pubc_user_no = None
    tin = None
    char_id = None
    user_type = None
    
    if fetch_user_info:
        try:
            import sys
            import os
            from pathlib import Path
            
            # 현재 파일의 디렉토리를 sys.path에 추가
            current_dir = Path(__file__).parent
            if str(current_dir) not in sys.path:
                sys.path.insert(0, str(current_dir))
            
            # 모듈 import 시도
            try:
                from ..session import fetch_additional_cookies
            except ImportError:
                # 파일명으로 직접 import 시도
                import importlib.util
                module_path = current_dir / 'session.py'
                if module_path.exists():
                    spec = importlib.util.spec_from_file_location("fetch_additional_cookies", module_path)
                    fetch_additional_cookies_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(fetch_additional_cookies_module)
                    fetch_additional_cookies = fetch_additional_cookies_module.fetch_additional_cookies
                else:
                    raise ImportError(f"모듈 파일을 찾을 수 없습니다: {module_path}")
            
            print("7단계: 사용자 정보 획득 (permission.do)")
            user_info = fetch_additional_cookies(result['session'])
            if user_info['success']:
                pubc_user_no = user_info.get('pubcUserNo', '')
                tin = user_info.get('tin', '')
                char_id = user_info.get('charId', '')
                user_type = user_info.get('userType', '')
                print("✅ 사용자 정보 획득 완료")
                if pubc_user_no:
                    print(f"   pubcUserNo: {pubc_user_no[:10]}...")
                if tin:
                    print(f"   tin: {tin[:10]}...")
            else:
                print("⚠️  사용자 정보 획득 실패 (계속 진행)")
                # 디버깅: 실패 원인 로깅
                print(f"   실패 원인: {user_info.get('error', 'Unknown')}")
        except Exception as e:
            print(f"⚠️  사용자 정보 획득 중 오류 (계속 진행): {e}")
            import traceback
            print(f"   상세 오류: {traceback.format_exc()}")
    
    return {
        'success': True,
        'session': result['session'],
        'cookies': result['cookies'],
        'pubcUserNo': pubc_user_no,
        'tin': tin,
        'charId': char_id,
        'userType': user_type,
    }


def load_p12_certificate(cert_path: str, password: str) -> PinkSign:
    """P12/PFX 형식 인증서 로드"""
    import os
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
    import os
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


def get_cert_pem(sign: PinkSign) -> str:
    """공개 인증서를 PEM 형식으로 추출"""
    try:
        return sign.get_cert_pem()
    except:
        # 대체 방법
        if hasattr(sign, 'pub_cert') and sign.pub_cert:
            from cryptography.hazmat.primitives import serialization
            return sign.pub_cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        raise ValueError("공개 인증서를 추출할 수 없습니다")


def extract_random_enc_p12(p12_path: str, password: str, sign: Optional[PinkSign] = None) -> str:
    """
    P12/PFX 형식에서 randomEnc 추출
    
    방법 1: PinkSign 객체의 _rand_num 속성 사용 (우선)
    방법 2: OpenSSL subprocess 사용 (fallback)
    
    Args:
        p12_path: P12/PFX 파일 경로
        password: 인증서 비밀번호
        sign: PinkSign 객체 (이미 로드된 경우)
        
    Returns:
        Base64 인코딩된 randomEnc 문자열
    """
    import subprocess
    import re
    import base64
    
    ID_KISA_NPKI_RAND_NUM = '1.2.410.200004.10.1.1.3'
    
    # 방법 1: PinkSign 객체의 _rand_num 속성 사용 (우선 시도)
    if sign is not None:
        try:
            if hasattr(sign, '_rand_num') and sign._rand_num is not None:
                random_enc = base64.b64encode(
                    sign._rand_num.asOctets()
                ).decode('utf-8')
                return random_enc
        except Exception:
            pass  # 실패 시 OpenSSL 방법으로 전환
    
    # 방법 2: OpenSSL subprocess 사용 (fallback)
    cmd = [
        'openssl', 'pkcs12', '-info',
        '-in', p12_path,
        '-nodes', '-nocerts',
        '-passin', f'pass:{password}'
    ]
    
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=10
    )
    
    if result.returncode != 0:
        raise Exception(f"OpenSSL 실행 실패: {result.stdout[:200]}")
    
    # OID 패턴 찾기
    pattern = rf'{re.escape(ID_KISA_NPKI_RAND_NUM)}\s*:?\s*([0-9a-fA-F\s:]+)'
    match = re.search(pattern, result.stdout, re.IGNORECASE | re.MULTILINE | re.DOTALL)
    
    if match:
        hex_string = re.sub(r'[\s:]', '', match.group(1))
        rand_num_bytes = bytes.fromhex(hex_string)
        random_enc = base64.b64encode(rand_num_bytes).decode('utf-8')
        return random_enc
    
    raise Exception("랜덤 번호를 찾을 수 없습니다")


def extract_random_enc_der_key(sign: PinkSign) -> str:
    """
    DER+KEY 형식에서 randomEnc 추출
    
    PinkSign 객체의 _rand_num 속성에서 직접 추출합니다.
    파일 경로나 비밀번호가 필요하지 않습니다.
    
    Args:
        sign: PinkSign 객체 (이미 로드된 상태)
        
    Returns:
        Base64 인코딩된 randomEnc 문자열
        
    Raises:
        Exception: 랜덤 번호를 찾을 수 없음
    """
    import base64
    
    if not hasattr(sign, '_rand_num') or sign._rand_num is None:
        raise Exception("랜덤 번호를 찾을 수 없습니다")
    
    # pypinksign의 _rand_num에서 직접 추출
    random_enc = base64.b64encode(
        sign._rand_num.asOctets()
    ).decode('utf-8')
    
    return random_enc


def request_challenge(session: requests.Session) -> str:
    """챌린지 요청"""
    import random
    
    CHALLENGE_URL = "https://hometax.go.kr/wqAction.do"
    CHALLENGE_ACTION_ID = "ATXPPZXA001R01"
    CHALLENGE_SCREEN_ID = "UTXPPABA01"
    
    # 요청 본문 생성
    nts = random.randrange(30, 60)
    challenge_data = f"{{}}<nts<nts>nts>{nts}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{nts - 11}"
    
    params = {
        'actionId': CHALLENGE_ACTION_ID,
        'screenId': CHALLENGE_SCREEN_ID
    }
    
    headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    response = session.post(
        CHALLENGE_URL,
        params=params,
        data=challenge_data,
        headers=headers,
        timeout=10
    )
    
    response.raise_for_status()
    result = response.json()
    result_msg = result.get('resultMsg', {})
    
    if isinstance(result_msg, str):
        result_msg = {}
    
    result_code = result_msg.get('result', '')
    
    if result_code == 'S':
        pkc_enc_ssn = result.get('pkcEncSsn', '') or result_msg.get('pkcEncSsn', '')
        if not pkc_enc_ssn:
            raise Exception("챌린지 문자열을 받을 수 없습니다")
        return pkc_enc_ssn
    else:
        error_msg = result_msg.get('resultMsg', result_msg.get('msg', '알 수 없는 오류'))
        raise Exception(f"챌린지 요청 실패: {error_msg}")


def generate_logsgnt(sign: PinkSign, pkc_enc_ssn: str) -> str:
    """
    logSgnt 생성 (ref 로직 방식)
    
    ref의 HometaxScrapper.getLoginSignature 로직을 따름:
    - serialNum과 timestamp를 포함하여 생성
    - 형식: pckEncSsn$serialNum$timestamp$signedBase64
    - 최종적으로 base64 인코딩하여 반환
    
    Args:
        sign: PinkSign 객체
        pkc_enc_ssn: 챌린지 문자열
        
    Returns:
        Base64 인코딩된 logSgnt 문자열
    """
    import base64
    from datetime import datetime
    
    # serialNum 추출
    try:
        # PinkSign에서 serialNum 추출 시도
        if hasattr(sign, 'cert') and sign.cert:
            serial_num = str(sign.cert.serial_number)
        else:
            # 대체 방법: 인증서에서 직접 추출
            serial_num = "0"  # 기본값
    except:
        serial_num = "0"
    
    # timestamp 생성 (YYYYMMDDHHmmss 형식)
    now = datetime.now()
    timestamp = (
        str(now.year) +
        str(now.month).zfill(2) +
        str(now.day).zfill(2) +
        str(now.hour).zfill(2) +
        str(now.minute).zfill(2) +
        str(now.second).zfill(2)
    )
    
    # 메시지 서명
    message = pkc_enc_ssn.encode('utf-8')
    signed_data = sign.sign(message)
    signed_base64 = base64.b64encode(signed_data).decode('utf-8')
    
    # ref 로직: pckEncSsn$serialNum$timestamp$signedBase64
    content = f"{pkc_enc_ssn}${serial_num}${timestamp}${signed_base64}"
    log_sgnt = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    
    return log_sgnt


def call_pubclogin(session: requests.Session, log_sgnt: str, cert_pem: str, random_enc: str) -> Dict:
    """
    pubcLogin.do 호출
    
    ref의 HometaxScrapper.login() 로직을 따릅니다:
    - pkcLgnClCd는 "04" 사용
    - cert_pem은 정규화 (CRLF를 LF로 변환, trimEnd 후 \n 추가)
    
    Args:
        session: requests.Session 객체
        log_sgnt: 생성된 logSgnt (base64 인코딩된 문자열)
        cert_pem: 공개 인증서 PEM 형식
        random_enc: Base64 인코딩된 randomEnc
        
    Returns:
        {
            'success': True,
            'cookies': Dict[str, str],
            'session': requests.Session
        }
        
    Raises:
        Exception: 로그인 실패
    """
    import re
    
    PUBCLOGIN_URL = "https://hometax.go.kr/pubcLogin.do"
    
    # ref 로직: cert_pem 정규화 (CRLF를 LF로 변환, trimEnd 후 \n 추가)
    normalized_cert = f"{cert_pem.replace(chr(13) + chr(10), chr(10)).rstrip()}\n"
    
    # ref 로직: pkcLgnClCd는 "04" 사용
    data = {
        'logSgnt': log_sgnt,
        'cert': normalized_cert,
        'randomEnc': random_enc,
        'pkcLoginYnImpv': 'Y',
        'pkcLgnClCd': '04',  # ref의 HometaxScrapper에서 사용하는 값
    }
    
    params = {
        'domain': 'hometax.go.kr',
        'mainSys': 'Y'
    }
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://hometax.go.kr/',
        'Origin': 'https://hometax.go.kr',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
    }
    
    response = session.post(
        PUBCLOGIN_URL,
        params=params,
        data=data,
        headers=headers,
        timeout=10
    )
    
    response.raise_for_status()
    response_text = response.text
    
    if '<!DOCTYPE' in response_text or '<html' in response_text:
        raise Exception("로그인 실패: 서버가 HTML을 반환했습니다")
    
    # JavaScript 콜백 형식 파싱
    callback_pattern = r'nts_loginSystemCallback\s*\(\s*({.*?})\s*\)'
    match = re.search(callback_pattern, response_text, re.DOTALL)
    code_match = re.search(r"'code'\s*:\s*'([FS])'", response_text)
    
    # 응답 파싱 실패 시 오류 메시지 추출 시도
    if not match and not code_match:
        err_msg_match = re.search(r"'errMsg'\s*:\s*decodeURIComponent\('([^']+)'\)", response_text)
        if err_msg_match:
            import urllib.parse
            err_msg = urllib.parse.unquote(err_msg_match.group(1))
            raise Exception(f"로그인 실패: {err_msg}")
    
    if match:
        import json
        callback_data = json.loads(match.group(1))
        result = callback_data.get('result', '')
        code = callback_data.get('code', '')
        
        if code == 'S' or result == 'S':
            cookies_dict = {}
            for cookie in session.cookies:
                cookies_dict[cookie.name] = cookie.value
            
            required_cookies = ['NTS_LOGIN_SYSTEM_CODE_P', 'TXPPsessionID']
            missing_cookies = [name for name in required_cookies if name not in cookies_dict]
            
            if missing_cookies:
                raise Exception(f"필수 쿠키가 없습니다: {', '.join(missing_cookies)}")
            
            return {
                'success': True,
                'cookies': cookies_dict,
                'session': session
            }
        else:
            error_msg = callback_data.get('errMsg', callback_data.get('resultMsg', '로그인 실패'))
            raise Exception(f"로그인 실패: {error_msg}")
    elif code_match:
        code = code_match.group(1)
        if code == 'S':
            cookies_dict = {}
            for cookie in session.cookies:
                cookies_dict[cookie.name] = cookie.value
            
            required_cookies = ['NTS_LOGIN_SYSTEM_CODE_P', 'TXPPsessionID']
            missing_cookies = [name for name in required_cookies if name not in cookies_dict]
            
            if missing_cookies:
                raise Exception(f"필수 쿠키가 없습니다: {', '.join(missing_cookies)}")
            
            return {
                'success': True,
                'cookies': cookies_dict,
                'session': session
            }
        else:
            # 오류 메시지 추출 시도
            err_msg_match = re.search(r"'errMsg'\s*:\s*decodeURIComponent\('([^']+)'\)", response_text)
            if err_msg_match:
                import urllib.parse
                err_msg = urllib.parse.unquote(err_msg_match.group(1))
                raise Exception(f"로그인 실패: {err_msg}")
            raise Exception("로그인 실패: 코드가 'S'가 아닙니다")
    else:
        # 응답 파싱 실패 시 쿠키 확인
        cookies_dict = {}
        for cookie in session.cookies:
            cookies_dict[cookie.name] = cookie.value
        
        required_cookies = ['NTS_LOGIN_SYSTEM_CODE_P', 'TXPPsessionID']
        missing_cookies = [name for name in required_cookies if name not in cookies_dict]
        
        if missing_cookies:
            raise Exception(f"필수 쿠키가 없습니다: {', '.join(missing_cookies)}")
        
        if cookies_dict:
            return {
                'success': True,
                'cookies': cookies_dict,
                'session': session
            }
        
        # 최종 오류 메시지 추출 시도
        err_msg_match = re.search(r"'errMsg'\s*:\s*decodeURIComponent\('([^']+)'\)", response_text)
        if err_msg_match:
            import urllib.parse
            err_msg = urllib.parse.unquote(err_msg_match.group(1))
            raise Exception(f"로그인 실패: {err_msg}")
        
        raise Exception(f"로그인 실패: 응답을 파싱할 수 없습니다. 응답 길이: {len(response_text)}")


def sso_login(session: requests.Session) -> None:
    """
    SSO 로그인 (ref의 HometaxScrapper.ssoLogin() 로직)
    
    로그인 후 세션을 유지하기 위해 필요한 추가 인증 단계입니다.
    
    Args:
        session: 로그인된 requests.Session 객체
        
    Raises:
        Exception: SSO 로그인 실패
    """
    import random
    import json
    
    # 1. permission.do 호출 (index_pp)
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    url = "https://hometax.go.kr/permission.do?screenId=index_pp"
    post_data = f"{{}}{nts}"
    
    headers = {
        'Content-Type': 'application/json; charset=UTF-8',
    }
    
    response = session.post(url, data=post_data.encode('utf-8'), headers=headers, timeout=10)
    response.raise_for_status()
    
    # 2. permission.do 호출 (UTERNAAZ11)
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    url = "https://teht.hometax.go.kr/permission.do?screenId=UTERNAAZ11"
    post_data = f"{{}}{nts}"
    
    response = session.post(url, data=post_data.encode('utf-8'), headers=headers, timeout=10)
    response.raise_for_status()
    
    # 3. token.do 호출
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    url = "https://hometax.go.kr/token.do?quer=_Ar3dDhwBaAEjwbp6RxK8"
    post_data = f"{{}}{nts}"
    
    response = session.post(url, data=post_data.encode('utf-8'), headers=headers, timeout=10)
    response.raise_for_status()
    
    try:
        token_result = response.json()
    except:
        # JSON 파싱 실패 시 텍스트로 확인
        raise Exception(f"token.do 응답 파싱 실패: {response.text[:200]}")
    
    sso_token = token_result.get('ssoToken')
    user_cl_cd = token_result.get('userClCd')
    txaa_adm_no = token_result.get('txaaAdmNo')
    
    if not sso_token:
        raise Exception(f"SSO 토큰을 받을 수 없습니다. 응답: {token_result}")
    
    # 4. permission.do 호출 (SSO 토큰 전달)
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    body = {
        'ssoToken': sso_token,
        'userClCd': user_cl_cd,
        'txaaAdmNo': txaa_adm_no,
    }
    
    url = "https://teht.hometax.go.kr/permission.do?screenId=UTERNAAZ11&domain=hometax.go.kr"
    json_body = json.dumps(body, ensure_ascii=False)
    post_data = f"{json_body}{nts}"
    
    response = session.post(url, data=post_data.encode('utf-8'), headers=headers, timeout=10)
    response.raise_for_status()
    
    # SSO 로그인 완료 후 쿠키 도메인 재설정
    # teht.hometax.go.kr에서도 쿠키를 사용할 수 있도록 .hometax.go.kr 도메인으로 설정
    cookies_to_update = []
    for cookie in list(session.cookies):
        cookies_to_update.append({
            'name': cookie.name,
            'value': cookie.value,
            'domain': cookie.domain,
            'path': cookie.path or '/'
        })
    
    # 기존 쿠키 삭제 후 도메인 재설정
    for cookie_info in cookies_to_update:
        try:
            # 기존 쿠키 삭제
            if cookie_info['domain']:
                session.cookies.clear(cookie_info['domain'], cookie_info['path'], cookie_info['name'])
        except:
            pass
        
        # 새 도메인으로 쿠키 설정 (.hometax.go.kr로 설정하여 하위 도메인에서도 사용 가능)
        session.cookies.set(
            cookie_info['name'],
            cookie_info['value'],
            domain='.hometax.go.kr',
            path=cookie_info['path']
        )

