
import sys
import json
import argparse
from pathlib import Path
import argparse
from pathlib import Path
import datetime
import time

# Backend Root 설정
BASE_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'modules'))
sys.path.insert(0, str(Path(__file__).parent))

# 모듈 Import
# 모듈 Import
from hometax.reports import HometaxTaxReportCollector

# 하이픈(-)이 포함된 파일명은 importlib으로 동적 로딩
import importlib.util
session_script_path = Path(__file__).parent / 'get-session-with-permission.py'
spec = importlib.util.spec_from_file_location("get_session_with_permission", session_script_path)
session_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(session_module)
get_hometax_session = session_module.get_hometax_session

from hometax.clients.fetch import fetch_hometax_clients

def main():
    parser = argparse.ArgumentParser(description="홈택스 세목별 신고 데이터 통합 수집기")
    parser.add_argument("--cert_path", required=True, help="인증서 경로")
    parser.add_argument("--password", required=True, help="인증서 비밀번호")
    parser.add_argument("--tax_name", required=True, help="세목명 (예: 부가세, 원천세)")
    parser.add_argument("--start_date", required=True, help="시작일 (YYYYMMDD)")
    parser.add_argument("--end_date", required=True, help="종료일 (YYYYMMDD)")
    parser.add_argument("--target_biz_no", required=False, help="특정 사업자번호만 수집 (Optional)")
    
    args = parser.parse_args()

    # 1. 로그인 및 세션 획득
    print(f"[INFO] 1. 로그인 및 세션 획득 중...", file=sys.stderr)
    session_result = get_hometax_session(args.cert_path, args.password)
    
    if not session_result['success']:
        print(json.dumps({"status": "error", "message": f"Login failed: {session_result.get('error')}"}))
        sys.exit(1)
        
    session = session_result['session']
    pubc_user_no = session_result['pubcUserNo']
    # get_session_with_permission에서 txaaAdmNo를 반환하도록 수정했음
    txaa_adm_no = session_result.get('txaaAdmNo', '')
    
    print(f"[INFO] 로그인 성공 (UserNo: {pubc_user_no}, AdminCode: {txaa_adm_no})", file=sys.stderr)

    # 2. 거래처 목록 조회
    print(f"[INFO] 2. 수임거래처 목록 조회 중...", file=sys.stderr)
    try:
        # 수임중(1) 거래처만 조회
        clients = fetch_hometax_clients(session, txaa_adm_no, "1")
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Client fetch failed: {str(e)}"}))
        sys.exit(1)
        
    if not clients:
        print(json.dumps({"status": "error", "message": "No clients found"}))
        sys.exit(0)
        
    print(f"[INFO] 총 {len(clients)}개 거래처 조회됨", file=sys.stderr)

    # 3. 데이터 수집 준비
    collector = HometaxTaxReportCollector(
        session=session,
        pubc_user_no=pubc_user_no,
        txaa_adm_no=txaa_adm_no
    )
    
    results = []
    
    # 4. 순회 및 수집
    print(f"[INFO] 3. 데이터 수집 시작 ({args.tax_name}, {args.start_date}~{args.end_date})", file=sys.stderr)
    
    for client in clients:
        biz_no = client.get('bsno')
        client_name = client.get('txprNm')
        
        # 특정 사업자 필터링
        if args.target_biz_no and args.target_biz_no != biz_no:
            continue
            
        print(f"[INFO] 수집 중: {client_name} ({biz_no})", file=sys.stderr)
        
        try:
            res = collector.collect_monthly_report(
                tax_name=args.tax_name,
                biz_no=biz_no,
                start_date=args.start_date,
                end_date=args.end_date
            )
            
            # 결과에 메타데이터 추가
            res['biz_no'] = biz_no
            res['client_name'] = client_name
            results.append(res)
            
            # 과부하 방지 딜레이
            time.sleep(2)
            
        except Exception as e:
             results.append({
                "status": "error",
                "biz_no": biz_no,
                "client_name": client_name,
                "message": str(e)
            })
    
    # 5. 결과 출력 (JSON)
    print(json.dumps({
        "status": "success",
        "total_count": len(results),
        "results": results
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
