"""
테스트용: 각 인증서별 랜덤 15개 사업자, 최근 1년 법인세 조회
"""
import sys
import json
import random
from pathlib import Path

# 원본 스크립트 import
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / "R&D"))
from tax_data_collector import get_hometax_session, collect_tax_data, OUTPUT_DIR

def main():
    # 테스트 입력 파일 로드
    test_input_path = BASE_DIR / "R&D" / "temp" / "test_input.json"
    if not test_input_path.exists():
        print(f"[FAIL] 테스트 입력 파일이 없습니다: {test_input_path}")
        return
    
    with open(test_input_path, 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    
    certs_list = test_data["certs"]
    cert_clients_map = test_data.get("certClientsMap", {})
    
    # 최근 1년 연월 리스트 생성
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    now = datetime.now()
    month_list = []
    for i in range(1, 13):  # 최근 12개월 (1년)
        dt = now - relativedelta(months=i)
        month_list.append((dt.year, dt.month))
    
    # 여러 세목 조회 (법인세, 부가세, 원천세, 종합소득세)
    TAX_MAP = {
        "법인세": "0405020000",
        "부가세": "0405010000",
        "원천세": "0405030000",
        "종합소득세": "0405040000"
    }
    
    import unicodedata
    def norm(s):
        if not s: return ""
        return unicodedata.normalize('NFC', s)
    
    total_collected = 0
    
    # cert_clients_map이 비어있으면 clients에서 필터링
    all_clients = test_data.get("clients", [])
    
    for cert_info in certs_list:
        cert_name = norm(cert_info["name"])
        cert_path = norm(cert_info["path"])
        password = cert_info["password"]
        
        # 해당 인증서의 랜덤 선정된 거래처 가져오기
        if cert_clients_map and cert_name in cert_clients_map:
            my_clients = cert_clients_map[cert_name]
        else:
            # cert_clients_map이 없으면 직접 필터링
            my_clients = []
            for c in all_clients:
                s_cert = norm(c.get('_sourceCert', ''))
                s_path = norm(c.get('_sourcePath', ''))
                if s_cert == cert_name or s_path == cert_path:
                    my_clients.append(c)
            # 랜덤으로 15개 선정
            if len(my_clients) > 15:
                my_clients = random.sample(my_clients, 15)
        
        print(f"\n{'='*60}")
        print(f">>> [{cert_name}] 테스트 시작")
        print(f">>> 거래처 수: {len(my_clients)}개")
        print(f"{'='*60}")
        
        if not my_clients:
            print(f">>> [{cert_name}] 관리하는 거래처가 없습니다. 패스.")
            continue
        
        print(f">>> [{cert_name}] 세션 활성화 시도 중...", flush=True)
        
        session_data = get_hometax_session(cert_path, password)
        if not session_data.get("success"):
            print(f"  [FAIL] 세션 획득 실패: {session_data.get('error')}", flush=True)
            continue
        
        cookies = session_data.get("cookies", {})
        pubc_user_no = session_data.get("pubcUserNo", "")
        
        print(f"  [OK] 세션 획득 성공", flush=True)
        
        # 거래처별/월별 순회
        for idx, client in enumerate(my_clients):
            biz_no = client.get('bsno')
            biz_name = client.get('txprNm', '불명')
            
            if not biz_no:
                biz_no = client.get('resno', '').replace('*', '')
            
            if not biz_no:
                print(f"  [{idx+1}/{len(my_clients)}] {biz_name}: 사업자번호 없음, 패스", flush=True)
                continue
            
            print(f"\n  [{idx+1}/{len(my_clients)}] 거래처: {biz_name} ({biz_no})", flush=True)
            
            # 법인세만 조회
            for tax_name, tax_code in TAX_MAP.items():
                month_count = 0
                for year, month in month_list:
                    import calendar
                    start_dt = f"{year}{month:02d}01"
                    last_day = calendar.monthrange(year, month)[1]
                    end_dt = f"{year}{month:02d}{last_day:02d}"
                    
                    res = collect_tax_data(cookies, tax_name, tax_code, start_dt, end_dt, 
                                           biz_no=biz_no, pubc_user_no=pubc_user_no)
                    
                    if res.get("status") == "success" and res.get("count", 0) > 0:
                        # 세목별 폴더 생성
                        tax_dir = OUTPUT_DIR / "test_multi_tax"
                        if not tax_dir.exists():
                            tax_dir.mkdir(parents=True)
                        
                        filename = f"DATA_{biz_no}_{tax_name}_{year}{month:02d}.json"
                        filepath = tax_dir / filename
                        with open(filepath, "w", encoding="utf-8") as f:
                            json.dump(res, f, ensure_ascii=False, indent=2)
                        
                        print(f"    ✓ {tax_name} {year}-{month:02d}: {res['count']}건 발견 및 저장", flush=True)
                        month_count += 1
                        total_collected += res['count']
                    elif res.get("status") == "error":
                        # 에러는 조용히 넘어감 (데이터가 없는 경우가 많음)
                        pass
                
                if month_count == 0:
                    print(f"    - {tax_name}: 데이터 없음", flush=True)
    
    print(f"\n{'='*60}")
    print(f"[테스트 완료] 총 수집된 데이터: {total_collected}건")
    print(f"저장 위치: {OUTPUT_DIR / 'test_multi_tax'}")
    print(f"조회 세목: {', '.join(TAX_MAP.keys())}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()

