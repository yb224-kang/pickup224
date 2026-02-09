"""
8. 홈택스 수임거래처 조회
등록된 인증서로 로그인 후 수임거래처 목록을 조회합니다.
"""

import requests
from typing import Dict, List, Optional
from datetime import datetime
import random
import json
import sys


def fetch_hometax_clients(
    session: requests.Session,
    hometax_admin_code: Optional[str] = None,
    engagement_code: str = "1"
) -> List[Dict]:
    """
    홈택스 수임거래처 조회
    
    ref의 HometaxScrapper.기장대리() 로직을 기반으로 구현되었습니다.
    
    Args:
        session: 로그인된 requests.Session 객체
        hometax_admin_code: 홈택스 관리자 번호 (선택)
        engagement_code: 수임 상태 코드 ("1": 수임중, "2": 해지, "3": 대기)
        
    Returns:
        수임거래처 목록 (Dict 리스트)
        
    Raises:
        Exception: 조회 실패
    """
    # ref의 hometaxActionCall 로직
    # ref에서는 realScreenId가 빈 문자열이지만 null로 처리됨
    query = {
        'actionId': 'ATEABHAA001R10',
        'screenId': 'UTEABHAA03',
        'popupYn': 'false',
        'realScreenId': '',  # 빈 문자열은 유지
    }
    
    body = {
        'afdsCl': engagement_code,
        'txaaAdmNo': hometax_admin_code or '',
        'pageInfoVO': {
            'pageNum': '1',
            'pageSize': '200',
            'totalCount': ''
        }
    }
    
    # 🔍 디버깅: txaaAdmNo 확인
    print(f"[DEBUG] fetch_hometax_clients - txaaAdmNo: '{hometax_admin_code or ''}' (길이: {len(hometax_admin_code or '')})", file=sys.stderr)
    print(f"[DEBUG] fetch_hometax_clients - body.txaaAdmNo: '{body['txaaAdmNo']}' (길이: {len(body['txaaAdmNo'])})", file=sys.stderr)
    
    # 쿠키 확인 (디버깅)
    cookies_before = {cookie.name: cookie.value for cookie in session.cookies}
    if 'TXPPsessionID' not in cookies_before:
        raise Exception("TXPPsessionID 쿠키가 없습니다. SSO 로그인이 필요합니다.")
    
    # NTS 생성 (ref 로직: randomSecond()와 동일)
    # ref: Math.floor(Math.random() * (60 - 30) + 30) -> 30~59 사이의 정수
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    # 요청 URL (ref 로직: null 값 제외, URLSearchParams 사용)
    filtered_params = {k: v for k, v in query.items() if v is not None}
    from urllib.parse import urlencode
    query_string = urlencode(filtered_params)
    url = f"https://teht.hometax.go.kr/wqAction.do?{query_string}" if query_string else "https://teht.hometax.go.kr/wqAction.do"
    
    # 요청 본문 (JSON + NTS) - ref 로직과 동일
    json_body = json.dumps(body, ensure_ascii=False)
    post_data = f"{json_body}{nts}"
    
    # ref 로직: headers는 Content-Type만 사용
    headers = {
        'Content-Type': 'application/json; charset=UTF-8',
    }
    
    # 🔍 상세 로깅 추가
    print("=" * 80, file=sys.stderr)
    print("[DEBUG] API 호출 상세 정보", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"URL: {url}", file=sys.stderr)
    print(f"쿠키 개수: {len(session.cookies)}", file=sys.stderr)
    print(f"쿠키 목록: {[c.name for c in session.cookies]}", file=sys.stderr)
    for cookie in session.cookies:
        print(f"  {cookie.name}:", file=sys.stderr)
        print(f"    도메인: {cookie.domain}", file=sys.stderr)
        print(f"    경로: {cookie.path}", file=sys.stderr)
        print(f"    값 길이: {len(cookie.value)}", file=sys.stderr)
        if cookie.name in ['TXPPsessionID', 'TEHTsessionID']:
            print(f"    값 (처음 50자): {cookie.value[:50]}...", file=sys.stderr)
    print(f"요청 본문 길이: {len(post_data)}", file=sys.stderr)
    print(f"요청 본문 (처음 300자): {post_data[:300]}", file=sys.stderr)
    print(f"Headers: {headers}", file=sys.stderr)
    
    # 실제 전송될 쿠키 확인
    from requests import Request
    req = Request('POST', url, data=post_data.encode('utf-8'), headers=headers)
    prepared = session.prepare_request(req)
    cookie_header = prepared.headers.get('Cookie', 'N/A')
    print(f"실제 전송될 Cookie 헤더: {cookie_header[:200]}..." if len(cookie_header) > 200 else f"실제 전송될 Cookie 헤더: {cookie_header}", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    # ref 로직: this.client.post()는 CookieJar를 통해 자동으로 쿠키를 전달
    # Python requests.Session도 자동으로 쿠키를 전달하지만, 도메인이 다를 경우 문제가 될 수 있음
    # teht.hometax.go.kr로 요청할 때 쿠키가 전달되도록 확인
    # requests.Session은 자동으로 쿠키를 전달하므로, 수동으로 헤더에 추가할 필요 없음
    # 단, 도메인이 다를 경우를 대비해 쿠키를 확인
    response = session.post(
        url,
        data=post_data.encode('utf-8'),
        headers=headers,
        timeout=30
    )
    
    # 🔍 응답 상세 로깅
    print("=" * 80, file=sys.stderr)
    print("[DEBUG] API 응답 상세 정보", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"상태 코드: {response.status_code}", file=sys.stderr)
    print(f"응답 헤더 (주요):", file=sys.stderr)
    for key in ['Content-Type', 'Set-Cookie', 'Content-Length']:
        if key in response.headers:
            print(f"  {key}: {response.headers[key]}", file=sys.stderr)
    print(f"응답 본문 길이: {len(response.text)}", file=sys.stderr)
    print(f"응답 본문 (처음 1000자): {response.text[:1000]}", file=sys.stderr)
    
    # 응답 상태 확인
    if response.status_code != 200:
        raise Exception(f"HTTP 오류: {response.status_code} - {response.text[:200]}")
    
    response.raise_for_status()
    
    # 응답 텍스트 확인 (디버깅)
    try:
        result_data = response.json()
    except:
        raise Exception(f"응답 파싱 실패. 상태 코드: {response.status_code}, 응답: {response.text[:500]}")
    
    # 결과 확인
    result_msg = result_data.get('resultMsg', {})
    if isinstance(result_msg, str):
        result_msg = {}
    
    result_code = result_msg.get('result', '')
    error_code = result_msg.get('code', '')
    error_msg = result_msg.get('msg', '')
    detail_msg = result_msg.get('detailMsg', '')
    
    # 🔍 오류 유형 구분
    print("=" * 80, file=sys.stderr)
    print("[DEBUG] 응답 분석", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"result 코드: {result_code}", file=sys.stderr)
    print(f"error 코드: {error_code}", file=sys.stderr)
    print(f"error 메시지: {error_msg}", file=sys.stderr)
    print(f"상세 메시지: {detail_msg}", file=sys.stderr)
    
    # 오류 유형 판단
    if error_code == 'login':
        print("→ 판단: 세션 관리 문제 (로그인/쿠키 문제)", file=sys.stderr)
    elif '세션정보' in error_msg:
        print("→ 판단: 세션 정보 누락 문제", file=sys.stderr)
    elif '서비스 실행 중 오류' in error_msg:
        print("→ 판단: 서버 내부 오류 (스크래핑 지점 문제 가능)", file=sys.stderr)
    elif error_code:
        print(f"→ 판단: 기타 오류 (코드: {error_code})", file=sys.stderr)
    else:
        print("→ 판단: 알 수 없는 오류", file=sys.stderr)
    
    print(f"전체 응답: {json.dumps(result_data, ensure_ascii=False, indent=2)[:2000]}", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    if result_code != 'S':
        # 전체 응답을 로그로 출력 (디버깅)
        print(f"[DEBUG] 수임거래처 조회 응답: {json.dumps(result_data, ensure_ascii=False, indent=2)[:1000]}", file=sys.stderr)
        raise Exception(f"수임거래처 조회 실패: {error_msg}")
    
    # 수임거래처 목록 추출 (페이지네이션 처리)
    all_clients = []
    page_num = 1
    page_size = 200
    
    while True:
        # 첫 번째 페이지는 이미 조회됨
        if page_num == 1:
            list_data = result_data.get('afdsSttnInfrDVOList', [])
        else:
            # 다음 페이지 조회
            body['pageInfoVO']['pageNum'] = str(page_num)
            
            # NTS 재생성
            sec = random.randrange(30, 60)
            nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
            json_body = json.dumps(body, ensure_ascii=False)
            post_data = f"{json_body}{nts}"
            
            response = session.post(
                url,
                data=post_data.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                print(f"[WARN] 페이지 {page_num} 조회 실패: {response.status_code}", file=sys.stderr)
                break
            
            try:
                result_data = response.json()
            except:
                print(f"[WARN] 페이지 {page_num} 응답 파싱 실패", file=sys.stderr)
                break
            
            result_msg = result_data.get('resultMsg', {})
            if isinstance(result_msg, str):
                result_msg = {}
            
            if result_msg.get('result') != 'S':
                print(f"[WARN] 페이지 {page_num} 조회 실패: {result_msg.get('msg', 'Unknown error')}", file=sys.stderr)
                break
            
            list_data = result_data.get('afdsSttnInfrDVOList', [])
        
        if not isinstance(list_data, list) or len(list_data) == 0:
            print(f"[DEBUG] 페이지 {page_num}: 조회된 거래처 없음", file=sys.stderr)
            break
        
        all_clients.extend(list_data)
        print(f"[DEBUG] 페이지 {page_num}: {len(list_data)}개 거래처 조회 (누적: {len(all_clients)}개)", file=sys.stderr)
        
        # totalCount 확인 (응답에서 추출)
        result_msg = result_data.get('resultMsg', {})
        if isinstance(result_msg, str):
            result_msg = {}
        total_count_str = result_msg.get('totalCount') or result_data.get('totalCount')
        
        if total_count_str:
            try:
                total_count = int(total_count_str)
                print(f"[DEBUG] 총 거래처 수: {total_count}, 현재 조회: {len(all_clients)}", file=sys.stderr)
                if len(all_clients) >= total_count:
                    print(f"[DEBUG] 모든 거래처 조회 완료", file=sys.stderr)
                    break
            except:
                pass
        
        # 다음 페이지가 없으면 중단
        if len(list_data) < page_size:
            print(f"[DEBUG] 마지막 페이지 도달 (조회된 거래처: {len(list_data)}개)", file=sys.stderr)
            break
        
        page_num += 1
    
    print(f"[DEBUG] 최종 조회된 거래처 수: {len(all_clients)}", file=sys.stderr)
    return all_clients


def get_hometax_admin_code(session: requests.Session) -> Optional[str]:
    """
    홈택스 관리자 번호 조회
    
    ref의 HometaxScrapper.getTxaaAdmNo() 로직을 기반으로 구현되었습니다.
    
    Args:
        session: 로그인된 requests.Session 객체
        
    Returns:
        홈택스 관리자 번호 (문자열) 또는 None
    """
    try:
        # permission.do 호출
        sec = random.randrange(30, 60)
        nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
        
        url = "https://hometax.go.kr/permission.do?screenId=index_pp"
        post_data = f"{{}}{nts}"
        
        headers = {
            'Content-Type': 'application/json; charset=UTF-8',
        }
        
        response = session.post(
            url,
            data=post_data,
            headers=headers,
            timeout=10
        )
        
        response.raise_for_status()
        result = response.json()
        
        txaa_adm_no = result.get('txaaAdmNo')
        return txaa_adm_no
        
    except Exception as e:
        print(f"관리자 번호 조회 실패: {e}")
        return None

