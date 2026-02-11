import sys
import json
import argparse
from pathlib import Path

# Backend Root 설정 (상위 2단계)
BASE_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'modules'))
sys.path.insert(0, str(Path(__file__).parent))  # get-session-with-permission.py가 있는 폴더

from hometax.reports import HometaxTaxReportCollector
# sys.path에 현재 폴더를 추가했으므로 바로 import 가능
import get_session_with_permission as session_module
get_hometax_session = session_module.get_hometax_session

def main():
    parser = argparse.ArgumentParser(description="홈택스 세목별 신고 데이터 수집기")
    parser.add_argument("--cookies", required=False, help="JSON encoded cookies (Optional if cert provided)")
    parser.add_argument("--pubc_user_no", required=False, help="Public User No")
    parser.add_argument("--cert_path", required=False, help="인증서 경로 (로그인용)")
    parser.add_argument("--password", required=False, help="인증서 비밀번호 (로그인용)")
    
    parser.add_argument("--tax_name", required=True, help="세목명 (예: 부가세, 원천세)")
    parser.add_argument("--biz_no", required=True, help="사업자등록번호")
    parser.add_argument("--start_date", required=True, help="시작일 (YYYYMMDD)")
    parser.add_argument("--end_date", required=True, help="종료일 (YYYYMMDD)")
    parser.add_argument("--txaa_adm_no", required=False, help="세무대리 관리번호 (Optional)")
    
    args = parser.parse_args()

    session = None
    cookies_dict = {}
    pubc_user_no = args.pubc_user_no
    txaa_adm_no = args.txaa_adm_no

    # 1. 인증서로 로그인 시도 (권장)
    if args.cert_path and args.password:
        # 파일명 import를 위해 동적 로딩 또는 sys.path 이용
        # 하이픈(-)이 포함된 파일명은 import가 까다로우므로 importlib 사용 권장하지만, 
        # 위에서 sys.path 추가했으므로 파일명만 맞추면 됨.
        # 단, get-session-with-permission.py는 하이픈 때문에 표준 import 불가.
        import importlib.util
        script_path = Path(__file__).parent / 'get-session-with-permission.py'
        spec = importlib.util.spec_from_file_location("get_session_module", script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        get_hometax_session = module.get_hometax_session
        
        login_result = get_hometax_session(args.cert_path, args.password)
        if not login_result['success']:
            print(json.dumps({"status": "error", "message": f"Login failed: {login_result.get('error')}"}))
            sys.exit(1)
            
        session = login_result['session']
        pubc_user_no = login_result['pubcUserNo']
        
        # 로그인 결과에서 txaaAdmNo가 있고, 인자로 안 들어왔으면 사용
        if not txaa_adm_no and login_result.get('txaaAdmNo'):
            txaa_adm_no = login_result.get('txaaAdmNo')
            
    # 2. 쿠키로 시도 (기존 방식)
    elif args.cookies:
        try:
            cookies_dict = json.loads(args.cookies)
        except json.JSONDecodeError:
            print(json.dumps({"status": "error", "message": "Invalid Cookies JSON"}))
            sys.exit(1)
    else:
        print(json.dumps({"status": "error", "message": "Must provide either cert/password or cookies"}))
        sys.exit(1)

    collector = HometaxTaxReportCollector(
        session=session,
        cookies=cookies_dict if not session else None,
        pubc_user_no=pubc_user_no,
        txaa_adm_no=txaa_adm_no
    )
    
    result = collector.collect_monthly_report(
        tax_name=args.tax_name,
        biz_no=args.biz_no,
        start_date=args.start_date,
        end_date=args.end_date
    )
    
    # 결과 JSON 출력
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
