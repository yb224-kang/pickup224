"""
테스트용: 10개 거래처 × 8개 세목, 최근 1년 전체 기간 조회
예상 시간: 약 3-4분
"""
import sys
import json
import random
import time
from pathlib import Path
from datetime import datetime
from dateutil.relativedelta import relativedelta

# 원본 스크립트 import
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / "R&D"))
from tax_data_collector import get_hometax_session, collect_tax_data, OUTPUT_DIR

def main():
    # 테스트 입력 파일 로드
    test_input_path = BASE_DIR / "R&D" / "temp" / "test_input.json"
    if not test_input_path.exists():
        print(f"[FAIL] 테스트 입력 파일이 없습니다: {test_input_path}")
        print(f"[INFO] 먼저 거래처 목록을 생성해야 합니다.")
        return
    
    with open(test_input_path, 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    
    certs_list = test_data["certs"]
    all_clients = test_data.get("clients", [])
    
    # 최근 1년 연월 리스트 생성 (전체 기간 계산용)
    now = datetime.now()
    month_list = []
    for i in range(1, 13):  # 최근 12개월 (1년)
        dt = now - relativedelta(months=i)
        month_list.append((dt.year, dt.month))
    
    # 8개 세목 모두 조회
    TAX_MAP = {
        "원천세": "0405030000",
        "부가세": "0405010000",
        "법인세": "0405020000",
        "종합소득세": "0405040000",
        "양도소득세": "0405050000",
        "상속세": "0405150000",
        "증여세": "0405060000",
        "종합부동산세": "0405070000"
    }
    
    import unicodedata
    import calendar
    
    def norm(s):
        if not s: return ""
        return unicodedata.normalize('NFC', s)
    
    # 전체 기간 계산
    if month_list:
        oldest_year, oldest_month = month_list[-1]  # 가장 오래된 월
        newest_year, newest_month = month_list[0]    # 가장 최근 월
        
        start_dt = f"{oldest_year}{oldest_month:02d}01"
        last_day = calendar.monthrange(newest_year, newest_month)[1]
        end_dt = f"{newest_year}{newest_month:02d}{last_day:02d}"
    else:
        start_dt = f"{now.year}{now.month:02d}01"
        last_day = calendar.monthrange(now.year, now.month)[1]
        end_dt = f"{now.year}{now.month:02d}{last_day:02d}"
    
    print(f"\n{'='*60}")
    print(f"[테스트 설정]")
    print(f"  - 거래처 수: 10개 (랜덤 선정)")
    print(f"  - 세목 수: {len(TAX_MAP)}개")
    print(f"  - 조회 기간: {start_dt} ~ {end_dt} (최근 1년)")
    print(f"  - 예상 API 호출: 10 × {len(TAX_MAP)} = {10 * len(TAX_MAP)}회")
    print(f"  - 예상 시간: 약 3-4분")
    print(f"{'='*60}\n")
    
    total_collected = 0
    total_api_calls = 0
    start_time = time.time()
    
    for cert_info in certs_list:
        cert_name = norm(cert_info["name"])
        cert_path = norm(cert_info["path"])
        password = cert_info["password"]
        
        # 해당 인증서에 소속된 거래처 필터링
        my_clients = []
        for c in all_clients:
            s_cert = norm(c.get('_sourceCert', ''))
            s_path = norm(c.get('_sourcePath', ''))
            if s_cert == cert_name or s_path == cert_path:
                my_clients.append(c)
        
        # 랜덤으로 10개 선정 (10개보다 적으면 모두 선택)
        if len(my_clients) > 10:
            my_clients = random.sample(my_clients, 10)
        elif len(my_clients) == 0:
            print(f">>> [{cert_name}] 관리하는 거래처가 없습니다. 패스.")
            continue
        
        print(f"\n{'='*60}")
        print(f">>> [{cert_name}] 테스트 시작")
        print(f">>> 거래처 수: {len(my_clients)}개 (전체 {len(all_clients)}건 중)")
        print(f"{'='*60}")
        
        print(f">>> [{cert_name}] 세션 활성화 시도 중...", flush=True)
        
        session_data = get_hometax_session(cert_path, password)
        if not session_data.get("success"):
            print(f"  [FAIL] 세션 획득 실패: {session_data.get('error')}", flush=True)
            continue
        
        cookies = session_data.get("cookies", {})
        pubc_user_no = session_data.get("pubcUserNo", "")
        
        print(f"  [OK] 세션 획득 성공", flush=True)
        
        # 거래처별 순회
        for idx, client in enumerate(my_clients):
            biz_no = client.get('bsno')
            biz_name = client.get('txprNm', '불명')
            
            if not biz_no:
                biz_no = client.get('resno', '').replace('*', '')
            
            if not biz_no:
                print(f"  [{idx+1}/{len(my_clients)}] {biz_name}: 사업자번호 없음, 패스", flush=True)
                continue
            
            print(f"\n  [{idx+1}/{len(my_clients)}] 거래처: {biz_name} ({biz_no})", flush=True)
            
            # 8개 세목 모두 조회 (전체 기간 한번에)
            for tax_name, tax_code in TAX_MAP.items():
                total_api_calls += 1
                res = collect_tax_data(cookies, tax_name, tax_code, start_dt, end_dt, 
                                       biz_no=biz_no, pubc_user_no=pubc_user_no)
                
                if res.get("status") == "success" and res.get("count", 0) > 0:
                    # 세목별 폴더 생성
                    tax_dir = OUTPUT_DIR / "test_10clients_8taxes"
                    if not tax_dir.exists():
                        tax_dir.mkdir(parents=True)
                    
                    # 전체 기간 결과 저장
                    filename = f"DATA_{biz_no}_{tax_name}_{start_dt}_{end_dt}.json"
                    filepath = tax_dir / filename
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(res, f, ensure_ascii=False, indent=2)
                    
                    # 월별로 분리하여 저장 (응답 데이터에 과세연월 정보가 있는 경우)
                    data_rows = res.get("data", [])
                    if data_rows:
                        monthly_data = {}
                        for row in data_rows:
                            tax_month = None
                            for field in ['txnrmYm', 'pymnYm', 'rtnYm', 'sbmsYm']:
                                if field in row and row[field]:
                                    tax_month = row[field]
                                    break
                            
                            if tax_month:
                                if len(str(tax_month)) == 6:
                                    year = int(str(tax_month)[:4])
                                    month = int(str(tax_month)[4:6])
                                    month_key = f"{year}{month:02d}"
                                    
                                    if month_key not in monthly_data:
                                        monthly_data[month_key] = []
                                    monthly_data[month_key].append(row)
                        
                        # 월별 파일 저장
                        for month_key, month_rows in monthly_data.items():
                            year = int(month_key[:4])
                            month = int(month_key[4:6])
                            monthly_filename = f"DATA_{biz_no}_{tax_name}_{year}{month:02d}.json"
                            monthly_res = {
                                "status": "success",
                                "count": len(month_rows),
                                "data": month_rows,
                                "raw": res.get("raw", {})
                            }
                            with open(tax_dir / monthly_filename, "w", encoding="utf-8") as f:
                                json.dump(monthly_res, f, ensure_ascii=False, indent=2)
                            print(f"    ✓ {tax_name} {year}-{month:02d}: {len(month_rows)}건 발견 및 저장", flush=True)
                            total_collected += len(month_rows)
                    else:
                        print(f"    ✓ {tax_name} {start_dt}~{end_dt}: {res['count']}건 발견 및 저장", flush=True)
                        total_collected += res['count']
                elif res.get("status") == "error":
                    error_msg = res.get("error", "알 수 없는 오류")
                    if "과부하" in error_msg or "60초" in error_msg:
                        print(f"    ⚠ {tax_name}: 과부하 제어 발생", flush=True)
                    else:
                        # 일반 에러는 조용히 넘어감
                        pass
    
    elapsed_time = time.time() - start_time
    
    print(f"\n{'='*60}")
    print(f"[테스트 완료]")
    print(f"  - 총 API 호출: {total_api_calls}회")
    print(f"  - 총 수집된 데이터: {total_collected}건")
    print(f"  - 소요 시간: {elapsed_time:.1f}초 ({elapsed_time/60:.1f}분)")
    print(f"  - 평균 호출당 시간: {elapsed_time/total_api_calls:.2f}초")
    print(f"  - 저장 위치: {OUTPUT_DIR / 'test_10clients_8taxes'}")
    print(f"  - 조회 세목: {', '.join(TAX_MAP.keys())}")
    print(f"{'='*60}")
    
    # 전체 규모 예상 시간 계산
    if total_api_calls > 0:
        avg_time_per_call = elapsed_time / total_api_calls
        estimated_full_scale = avg_time_per_call * 600 * 8  # 600거래처 × 8세목
        print(f"\n[전체 규모 예상 시간]")
        print(f"  - 600거래처 × 8세목 = 4,800회 호출")
        print(f"  - 예상 시간: {estimated_full_scale:.0f}초 ({estimated_full_scale/60:.1f}분, {estimated_full_scale/3600:.1f}시간)")
        print(f"{'='*60}")

if __name__ == "__main__":
    main()


