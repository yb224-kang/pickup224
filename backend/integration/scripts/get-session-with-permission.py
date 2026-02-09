"""
Python으로 로그인 + permission.do까지 처리하는 스크립트
Node.js에서 사용할 수 있도록 쿠키와 세션 정보를 JSON으로 출력합니다.
hometaxbot 패턴을 따라 teht 서브도메인 permission.do를 호출합니다.
"""

import sys
import json
import re
import random
from datetime import datetime
from pathlib import Path

# 상위 디렉토리에서 모듈 import
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'modules' / 'hometax' / 'auth'))

import importlib.util
login_module_path = Path(__file__).parent.parent.parent / 'modules' / 'hometax' / 'auth' / 'login.py'
spec = importlib.util.spec_from_file_location("login_with_certificate", login_module_path)
login_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(login_module)
login_with_certificate = login_module.login_with_certificate

def nts_generate_random_string(length):
    """hometaxbot 패턴: 랜덤 문자열 생성"""
    seed = "qwertyuiopasdfghjklzxxcvbnm0123456789QWERTYUIOPASDDFGHJKLZXCVBNBM"
    result = ''
    for i in range(length):
        result += seed[random.randint(0, len(seed) - 1)]
    return result

def request_permission_teht(session, screen_id='UTEABHAA03'):
    """
    hometaxbot 패턴: teht 서브도메인 permission.do 호출
    
    Args:
        session: requests.Session 객체
        screen_id: 화면 ID (기본값: 'UTEABHAA03')
    
    Returns:
        {
            'success': bool,
            'tin': str,
            'pubcUserNo': str,
            'cookies': dict,
            'error': str (실패 시)
        }
    """
    base_url = 'https://teht.hometax.go.kr'
    endpoint = f'{base_url}/permission.do'
    
    try:
        # 1. permission.do 호출 (XML 형식)
        response = session.post(
            endpoint,
            data='<map id="postParam"><popupYn>false</popupYn></map>'.encode('utf-8'),
            params={"screenId": screen_id},
            headers={'Content-Type': "application/xml; charset=UTF-8"},
            timeout=20
        )
        
        response_text = response.text
        
        # 🔍 디버깅: 응답 형식 확인
        import sys
        print(f"[DEBUG Python] permission.do 응답 상태 코드: {response.status_code}", file=sys.stderr)
        print(f"[DEBUG Python] permission.do 응답 길이: {len(response_text)}", file=sys.stderr)
        print(f"[DEBUG Python] permission.do 응답 처음 500자: {response_text[:500]}", file=sys.stderr)
        
        # 2. 로그인 오류 감지
        is_login_error = '<errorMsg>login</errorMsg>' in response_text
        
        # JSON 응답도 확인
        try:
            if response_text.strip().startswith('{'):
                response_json = response.json()
                if isinstance(response_json, dict):
                    result_msg = response_json.get('resultMsg', {})
                    if result_msg.get('errorMsg') == 'login' or result_msg.get('code') == 'login':
                        is_login_error = True
        except:
            pass
        
        if is_login_error:
            # 3. token.do로 SSO 토큰 획득
            random_str = nts_generate_random_string(20)
            today = datetime.today()
            postfix = today.strftime('%Y_%m_%d')
            
            token_response = session.get(
                "https://hometax.go.kr/token.do",
                params={
                    "query": f'_{random_str}',
                    "postfix": postfix
                },
                headers={'Content-Type': "application/xml; charset=UTF-8"},
                timeout=20
            )
            
            # SSO 토큰 추출
            token_text = token_response.text
            sso_token_match = re.search(r'nts_reqPortalCallback\("([^"]+)"\)', token_text)
            
            sso_token = None
            if sso_token_match:
                sso_token = sso_token_match[1]
            else:
                # JSON 응답인 경우
                try:
                    token_json = token_response.json()
                    sso_token = token_json.get('ssoToken')
                except:
                    pass
            
            if not sso_token:
                return {
                    'success': False,
                    'error': 'SSO 토큰을 찾을 수 없습니다',
                    'tin': '',
                    'pubcUserNo': '',
                    'txaaAdmNo': '',  # ⭐ 추가
                    'cookies': {}
                }
            
            # 4. SSO 토큰 포함하여 permission.do 재호출
            response = session.post(
                endpoint,
                data=f'<map id="postParam">{sso_token}<popupYn>false</popupYn></map>'.encode('utf-8'),
                params={"screenId": screen_id, "domain": "hometax.go.kr"},
                headers={'Content-Type': "application/xml; charset=UTF-8"},
                timeout=20
            )
            
            response_text = response.text
            
            # 재호출 후에도 로그인 오류가 있으면 실패
            if '<errorMsg>login</errorMsg>' in response_text:
                try:
                    if response_text.strip().startswith('{'):
                        retry_json = response.json()
                        if isinstance(retry_json, dict):
                            result_msg = retry_json.get('resultMsg', {})
                            if result_msg.get('errorMsg') == 'login' or result_msg.get('code') == 'login':
                                return {
                                    'success': False,
                                    'error': 'SSO 토큰 재호출 후에도 로그인 오류',
                                    'tin': '',
                                    'pubcUserNo': '',
                                    'txaaAdmNo': '',  # ⭐ 추가
                                    'cookies': {}
                                }
                except:
                    pass
        
        # 5. 세션 정보 추출
        tin = ''
        pubc_user_no = ''
        txaa_adm_no = ''  # ⭐ 추가: 세무대리 관리번호
        
        try:
            # JSON 응답 처리
            if response_text.strip().startswith('{'):
                result_json = response.json()
                if isinstance(result_json, dict):
                    if 'resultMsg' in result_json and 'sessionMap' in result_json['resultMsg']:
                        session_map = result_json['resultMsg']['sessionMap']
                        tin = session_map.get('tin', '')
                        pubc_user_no = session_map.get('pubcUserNo', '')
                        txaa_adm_no = session_map.get('txaaAdmNo', '')  # ⭐ 추가
                    else:
                        # 직접 필드 확인
                        tin = result_json.get('tin', '')
                        pubc_user_no = result_json.get('pubcUserNo', '')
                        txaa_adm_no = result_json.get('txaaAdmNo', '')  # ⭐ 추가
            else:
                # XML 응답 처리
                import xml.etree.ElementTree as ET
                # xmlns 제거
                response_text_clean = re.sub(' xmlns="[^"]+"', '', response_text, count=1)
                root = ET.fromstring(response_text_clean)
                tin_elem = root.find('.//tin')
                pubc_user_no_elem = root.find('.//pubcUserNo')
                txaa_adm_no_elem = root.find('.//txaaAdmNo')  # ⭐ 추가
                tin = tin_elem.text if tin_elem is not None else ''
                pubc_user_no = pubc_user_no_elem.text if pubc_user_no_elem is not None else ''
                txaa_adm_no = txaa_adm_no_elem.text if txaa_adm_no_elem is not None else ''  # ⭐ 추가
        except Exception as e:
            return {
                'success': False,
                'error': f'응답 파싱 실패: {str(e)}',
                'tin': '',
                'pubcUserNo': '',
                'txaaAdmNo': '',  # ⭐ 추가
                'cookies': {}
            }
        
        # 6. 쿠키 추출 (permission.do 호출 후 업데이트된 쿠키 포함)
        cookies_dict = {cookie.name: cookie.value for cookie in session.cookies}
        
        # 디버깅: 쿠키 정보 출력
        import sys
        print(f"[DEBUG Python] permission.do 호출 후 쿠키 개수: {len(cookies_dict)}", file=sys.stderr)
        print(f"[DEBUG Python] 쿠키 목록: {list(cookies_dict.keys())}", file=sys.stderr)
        if 'TEHTsessionID' in cookies_dict:
            print(f"[DEBUG Python] TEHTsessionID: {cookies_dict['TEHTsessionID'][:30]}...", file=sys.stderr)
        print(f"[DEBUG Python] 세션 정보 추출 결과:", file=sys.stderr)
        print(f"[DEBUG Python]   tin: {tin[:20] if tin else 'N/A'}...", file=sys.stderr)
        print(f"[DEBUG Python]   pubcUserNo: {pubc_user_no[:20] if pubc_user_no else 'N/A'}...", file=sys.stderr)
        print(f"[DEBUG Python]   txaaAdmNo: {txaa_adm_no[:20] if txaa_adm_no else 'N/A'}...", file=sys.stderr)
        
        return {
            'success': True,
            'tin': tin,
            'pubcUserNo': pubc_user_no,
            'txaaAdmNo': txaa_adm_no,  # ⭐ 추가
            'cookies': cookies_dict
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'permission.do 호출 실패: {str(e)}',
            'tin': '',
            'pubcUserNo': '',
            'cookies': {}
        }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: python get-session-with-permission.py <cert_path> <password>'}))
        sys.exit(1)
    
    cert_path = sys.argv[1]
    password = sys.argv[2]
    
    try:
        # 1. 로그인
        result = login_with_certificate(
            cert_path=cert_path,
            password=password,
            fetch_user_info=True
        )
        
        session = result['session']
        
        # 2-1. 메인 도메인 permission.do 호출 (txaaAdmNo 추출용)
        # ref 프로젝트의 getTxaaAdmNo() 패턴: 메인 도메인에서 먼저 호출
        try:
            main_perm_response = session.post(
                'https://hometax.go.kr/permission.do',
                data='<map id="postParam"><popupYn>false</popupYn></map>'.encode('utf-8'),
                params={"screenId": "index_pp"},
                headers={'Content-Type': "application/xml; charset=UTF-8"},
                timeout=20
            )
            main_perm_text = main_perm_response.text
            print(f"[DEBUG Python] 메인 도메인 permission.do 응답 길이: {len(main_perm_text)}", file=sys.stderr)
            print(f"[DEBUG Python] 메인 도메인 permission.do 응답 처음 500자: {main_perm_text[:500]}", file=sys.stderr)
            
            # 메인 도메인에서 txaaAdmNo 추출 시도
            main_txaa_adm_no = ''
            if main_perm_text.strip().startswith('{'):
                try:
                    main_perm_json = main_perm_response.json()
                    if isinstance(main_perm_json, dict):
                        if 'resultMsg' in main_perm_json and 'sessionMap' in main_perm_json['resultMsg']:
                            main_session_map = main_perm_json['resultMsg']['sessionMap']
                            main_txaa_adm_no = main_session_map.get('txaaAdmNo', '')
                            print(f"[DEBUG Python] 메인 도메인에서 txaaAdmNo 추출: {main_txaa_adm_no[:20] if main_txaa_adm_no else 'N/A'}...", file=sys.stderr)
                except:
                    pass
        except Exception as e:
            print(f"[DEBUG Python] 메인 도메인 permission.do 호출 실패: {str(e)}", file=sys.stderr)
            main_txaa_adm_no = ''
        
        # 2-2. 완전한 SSO 로그인 패턴 구현 (ref 프로젝트의 ssoLogin() 패턴)
        # ⭐ 핵심: 서브도메인에 세션 활성화 주입
        print(f"[DEBUG Python] 완전한 SSO 로그인 패턴 시작...", file=sys.stderr)
        
        # 2-2-1. 서브도메인 permission.do 호출 (1차, 초기화)
        try:
            teht_perm_1 = session.post(
                'https://teht.hometax.go.kr/permission.do',
                data='<map id="postParam"><popupYn>false</popupYn></map>'.encode('utf-8'),
                params={"screenId": "UTERNAAZ11"},
                headers={'Content-Type': "application/xml; charset=UTF-8"},
                timeout=20
            )
            print(f"[DEBUG Python] 서브도메인 permission.do (1차) 완료", file=sys.stderr)
        except Exception as e:
            print(f"[DEBUG Python] 서브도메인 permission.do (1차) 실패: {str(e)}", file=sys.stderr)
        
        # 2-2-2. token.do 호출 → ssoToken, userClCd, txaaAdmNo 획득
        random_str = nts_generate_random_string(20)
        token_response = session.get(
            "https://hometax.go.kr/token.do",
            params={"quer": f"_{random_str}"},
            headers={'Content-Type': "application/xml; charset=UTF-8"},
            timeout=20
        )
        
        token_text = token_response.text
        sso_token = None
        user_cl_cd = None
        token_txaa_adm_no = None
        
        # JSON 응답 처리
        try:
            if token_text.strip().startswith('{'):
                token_json = token_response.json()
                sso_token = token_json.get('ssoToken')
                user_cl_cd = token_json.get('userClCd')
                token_txaa_adm_no = token_json.get('txaaAdmNo')
        except:
            # XML 응답 처리
            sso_token_match = re.search(r'nts_reqPortalCallback\("([^"]+)"\)', token_text)
            if sso_token_match:
                sso_token = sso_token_match[1]
        
        print(f"[DEBUG Python] token.do 결과: ssoToken={'있음' if sso_token else '없음'}, userClCd={user_cl_cd}, txaaAdmNo={token_txaa_adm_no}", file=sys.stderr)
        
        # 2-2-3. 서브도메인 permission.do 호출 (2차, 세션 활성화 주입) ⭐ 핵심
        if sso_token and (main_txaa_adm_no or token_txaa_adm_no):
            txaa_adm_no_to_use = token_txaa_adm_no or main_txaa_adm_no
            print(f"[DEBUG Python] 서브도메인 세션 활성화 주입 시작 (txaaAdmNo: {txaa_adm_no_to_use})...", file=sys.stderr)
            
            # JSON 형식으로 전송 (ref 프로젝트 패턴)
            activation_body = {
                "ssoToken": sso_token,
                "userClCd": user_cl_cd or "",
                "txaaAdmNo": txaa_adm_no_to_use
            }
            
            try:
                teht_perm_2 = session.post(
                    'https://teht.hometax.go.kr/permission.do',
                    json=activation_body,  # ⭐ JSON 형식으로 전송
                    params={"screenId": "UTERNAAZ11", "domain": "hometax.go.kr"},
                    headers={'Content-Type': "application/json; charset=UTF-8"},
                    timeout=20
                )
                print(f"[DEBUG Python] 서브도메인 세션 활성화 주입 완료 (상태 코드: {teht_perm_2.status_code})", file=sys.stderr)
                print(f"[DEBUG Python] 응답: {teht_perm_2.text[:200]}", file=sys.stderr)
            except Exception as e:
                print(f"[DEBUG Python] 서브도메인 세션 활성화 주입 실패: {str(e)}", file=sys.stderr)
        
        # 2-2-4. teht 서브도메인 permission.do 호출 (최종, 세션 정보 추출용)
        perm_result = request_permission_teht(session, screen_id='UTEABHAA03')
        
        # 2-2-5. 메인 도메인에서 추출한 txaaAdmNo가 있으면 사용
        if main_txaa_adm_no and not perm_result.get('txaaAdmNo'):
            perm_result['txaaAdmNo'] = main_txaa_adm_no
            print(f"[DEBUG Python] 메인 도메인에서 추출한 txaaAdmNo를 사용: {main_txaa_adm_no[:20]}...", file=sys.stderr)
        
        if not perm_result.get('success'):
            # permission.do 실패 시에도 쿠키는 반환
            final_cookies = {cookie.name: cookie.value for cookie in session.cookies}
            output = {
                'success': True,
                'cookies': final_cookies,
                'pubcUserNo': result.get('pubcUserNo') or '',
                'tin': result.get('tin') or '',
                'txaaAdmNo': perm_result.get('txaaAdmNo') or '',  # ⭐ 추가
                'charId': result.get('charId') or '',
                'userType': result.get('userType') or '',
                'permissionSuccess': False,
                'permissionError': perm_result.get('error', 'Unknown error'),
            }
            print(json.dumps(output, ensure_ascii=False))
            sys.exit(0)
        
        # 3. permission.do 성공 후 최종 쿠키 추출
        final_cookies = {cookie.name: cookie.value for cookie in session.cookies}
        
        # 4. (선택적) API 호출 테스트 - Python에서 직접 시도
        api_success = False
        api_error = None
        clients_data = []
        
        try:
            # modules/hometax/clients/fetch.py의 fetch_hometax_clients 함수 사용
            import importlib.util
            clients_module_path = Path(__file__).parent.parent.parent / 'modules' / 'hometax' / 'clients' / 'fetch.py'
            spec = importlib.util.spec_from_file_location("fetch_hometax_clients", clients_module_path)
            clients_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(clients_module)
            fetch_hometax_clients = clients_module.fetch_hometax_clients
            
            # 수임거래처 조회
            # ⭐ txaaAdmNo 전달 (permission.do에서 추출한 값 사용)
            txaa_adm_no = perm_result.get('txaaAdmNo') or ''
            clients_data = fetch_hometax_clients(
                session=session,
                hometax_admin_code=txaa_adm_no if txaa_adm_no else None,  # ⭐ None 대신 전달
                engagement_code="1"  # 수임중
            )
            api_success = True
            print(f"[DEBUG Python] API 호출 성공: {len(clients_data)}개 거래처 조회", file=sys.stderr)
            
        except Exception as e:
            api_error = str(e)
            import traceback
            print(f"[DEBUG Python] API 호출 실패: {str(e)}", file=sys.stderr)
            print(f"[DEBUG Python] {traceback.format_exc()}", file=sys.stderr)
        
        # 5. 결과 통합
        output = {
            'success': True,
            'cookies': final_cookies,
            'pubcUserNo': perm_result.get('pubcUserNo') or result.get('pubcUserNo') or '',
            'tin': perm_result.get('tin') or result.get('tin') or '',
            'txaaAdmNo': perm_result.get('txaaAdmNo') or '',  # ⭐ 추가
            'charId': result.get('charId') or '',
            'userType': result.get('userType') or '',
            'permissionSuccess': perm_result.get('success', False),
            'apiSuccess': api_success,
            'apiError': api_error,
            'clients': clients_data if api_success else [],
        }
        
        if not perm_result.get('success'):
            output['permissionError'] = perm_result.get('error', 'Unknown error')
        
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(json.dumps({'error': error_msg}))
        sys.exit(1)

