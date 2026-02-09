"""
8. 인증서 로그인 후 추가 쿠키획득
로그인 후 permission.do를 호출하여 추가 쿠키와 사용자 정보를 획득합니다.
"""

import requests
from typing import Dict


def fetch_additional_cookies(
    session: requests.Session,
    screen_id: str = 'index3'
) -> Dict:
    """
    permission.do 호출하여 추가 쿠키 및 사용자 정보 획득
    
    Args:
        session: 로그인된 requests.Session 객체
        screen_id: 화면 ID (기본값: 'index3')
        
    Returns:
        {
            'success': True,
            'cookies': Dict[str, str],  # 추가 쿠키
            'pubcUserNo': str,
            'tin': str,
            'charId': str,
            'userType': str,
        }
    """
    PERMISSION_URL = "https://hometax.go.kr/permission.do"
    
    headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://hometax.go.kr/',
        'Origin': 'https://hometax.go.kr',
    }
    
    try:
        # 메인 페이지 워밍업
        try:
            session.get('https://hometax.go.kr/', timeout=5)
        except:
            pass
        
        # permission.do 호출
        response = session.post(
            PERMISSION_URL,
            params={'screenId': screen_id},
            headers=headers,
            json={},
            timeout=10
        )
        
        response.raise_for_status()
        perm_json = response.json()
        result_msg = perm_json.get('resultMsg', {})
        session_map = result_msg.get('sessionMap', {})
        
        if not session_map:
            # 다른 screenId 시도
            for alt_screen_id in ['UTXPPABA01', 'UTXPPABA02']:
                try:
                    alt_response = session.post(
                        PERMISSION_URL,
                        params={'screenId': alt_screen_id},
                        headers=headers,
                        json={},
                        timeout=10
                    )
                    alt_response.raise_for_status()
                    alt_json = alt_response.json()
                    alt_result_msg = alt_json.get('resultMsg', {})
                    session_map = alt_result_msg.get('sessionMap', {})
                    if session_map:
                        break
                except:
                    continue
        
        # 쿠키 추출
        cookies_dict = {}
        for cookie in session.cookies:
            cookies_dict[cookie.name] = cookie.value
        
        if session_map:
            pubc_user_no = session_map.get('pubcUserNo', '')
            tin = session_map.get('tin', '')
            char_id = session_map.get('charId', '')
            lgn_user_cl_cd = session_map.get('lgnUserClCd', '')
            
            user_type = ''
            if lgn_user_cl_cd == '01':
                user_type = '개인'
            elif lgn_user_cl_cd == '02':
                user_type = '법인'
            
            return {
                'success': True,
                'cookies': cookies_dict,
                'pubcUserNo': pubc_user_no,
                'tin': tin,
                'charId': char_id,
                'userType': user_type,
            }
        else:
            return {
                'success': False,
                'cookies': cookies_dict,
                'pubcUserNo': '',
                'tin': '',
                'charId': '',
                'userType': '',
            }
            
    except requests.exceptions.RequestException as e:
        raise Exception(f"네트워크 오류: {str(e)}")
    except Exception as e:
        raise Exception(f"오류 발생: {str(e)}")

