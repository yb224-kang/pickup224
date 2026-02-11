import os
import json
import sys
import subprocess
import time
from datetime import datetime
from pathlib import Path

# 설정 정보
BASE_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = BASE_DIR / "backend" / "integration" / "scripts"
OUTPUT_DIR = Path(__file__).parent / "collected_data"

# 세목별 메뉴 인덱스 (tm3lIdx)
TAX_TYPES = {
    "원천세": "0405030000",
    "부가세": "0405010000",
    "법인세": "0405020000",
    "종합소득세": "0405040000",
    "양도소득세": "0405050000",
    "상속세": "0405150000",
    "증여세": "0405060000",
    "종합부동산세": "0405070000",
}

# 스마트 딜레이 전역 변수
_delay_state = {
    "current_delay": 0.1,  # 초기 딜레이 0.1초 (테스트용)
    "consecutive_success": 0,
    "consecutive_overload": 0,
    "max_retries": 3  # 최대 재시도 횟수
}

def get_hometax_session(cert_path, password):
    """
    기존 백엔드 스크립트(get-session-with-permission.py)를 실행하여 
    완벽한 세무대리인 권한 세션을 획득합니다.
    """
    script_path = SCRIPTS_DIR / "get-session-with-permission.py"
    try:
        # 백엔드 스크립트 실행
        result = subprocess.run(
            ["python3", str(script_path), cert_path, password],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            stdout = result.stdout.strip()
            # JSON 결과 추출 (출력물 중 JSON 객체만 찾음)
            json_start = stdout.find('{')
            json_end = stdout.rfind('}') + 1
            if json_start >= 0:
                data = json.loads(stdout[json_start:json_end])
                if data.get("success"):
                    return data
        
        error_msg = result.stderr or result.stdout or "알 수 없는 오류"
        return {"success": False, "error": error_msg}
    except Exception as e:
        return {"success": False, "error": str(e)}

def collect_tax_data(cookies, tax_name, tax_code, start_date, end_date, biz_no="", pubc_user_no="", retry_count=0):
    """
    R&D 결과 및 브라우저 실사 결과를 바탕으로 JSON 기반 수집을 수행합니다.
    스마트 딜레이 방식 적용: 정상 응답 시 0.5초, 과부하 제어 감지 시 60초 대기 후 재시도
    """
    import requests
    import random
    
    global _delay_state
    
    # API 호출 전 딜레이 (스마트 딜레이)
    time.sleep(_delay_state["current_delay"])
    
    # nts 토큰 생성 (홈택스 보안 패턴)
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    itrf_cd_map = {
        "원천세": "14",
        "부가세": "41",
        "법인세": "31",
        "종합소득세": "10",
        "양도소득세": "22",
        "상속세": "26",
        "증여세": "27",
        "종합부동산세": "17"
    }
    itrf_cd = itrf_cd_map.get(tax_name, "")

    print(f"    [LOG] {tax_name}({itrf_cd}) 요청: {start_date} ~ {end_date} (사업자: {biz_no or '전체'})")
    
    endpoint = "https://teht.hometax.go.kr/wqAction.do"
    params = {
        "actionId": "ATERNABA016R01",
        "screenId": "UTERNAAZ0Z31",
        "popupYn": "true",
        "realScreenId": "UTERNAAZ0Z31"
    }
    
    # JSON 기반 페이로드 구성
    body = {
        "befCallYn": "",
        "dprtUserId": "",
        "itrfCd": itrf_cd,
        "ntplInfpYn": "Y",
        "pubcUserNo": pubc_user_no,
        "rtnDtEnd": end_date,
        "rtnDtSrt": start_date,
        "scrnId": "UTERNAAZ0Z31",
        "txprRgtNo": biz_no,
        "pageInfoVO": {
            "pageNum": "1"
        }
    }
    
    json_body = json.dumps(body, ensure_ascii=False)
    payload = f"{json_body}{nts}"
    
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Accept": "application/json",
        "Referer": f"https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=04&tm2lIdx=0405000000&tm3lIdx={tax_code}"
    }
    
    try:
        response = requests.post(
            endpoint,
            params=params,
            data=payload.encode('utf-8'),
            headers=headers,
            cookies=cookies,
            timeout=30
        )
        
        if response.status_code != 200:
            return {"status": "error", "error": f"HTTP {response.status_code}", "count": 0}
        
        response_text = response.text
        
        # 분석을 위해 모든 응답 저장
        debug_filename = f"RAW_{tax_name}_{biz_no}_{start_date}.json"
        with open(OUTPUT_DIR / debug_filename, "w", encoding="utf-8") as df:
            df.write(response_text)
        
        # ⭐ 스마트 딜레이: 과부하 제어 감지
        if "과부하제어" in response_text or "60초" in response_text:
            _delay_state["consecutive_overload"] += 1
            _delay_state["consecutive_success"] = 0
            
            # 재시도 횟수 확인
            if retry_count >= _delay_state["max_retries"]:
                print(f"    [ERROR] 과부하 제어: 최대 재시도 횟수({_delay_state['max_retries']}) 초과, 건너뜀", flush=True)
                return {"status": "error", "error": "과부하 제어: 최대 재시도 횟수 초과", "count": 0}
            
            # 60초 대기 후 재시도
            print(f"    [WARN] 과부하 제어 감지 (재시도 {retry_count + 1}/{_delay_state['max_retries']}), 60초 대기 후 재시도...", flush=True)
            time.sleep(60)
            
            # 재시도
            return collect_tax_data(
                cookies, tax_name, tax_code, start_date, end_date, 
                biz_no, pubc_user_no, retry_count + 1
            )
        
        # 정상 응답 처리
        _delay_state["consecutive_success"] += 1
        _delay_state["consecutive_overload"] = 0
        
        # 연속 성공 시 딜레이 유지 (0.5초 고정)
        # 필요시 점진적 감소 로직 추가 가능

        try:
            result_data = response.json()
            rows = []
            for key, value in result_data.items():
                if isinstance(value, list) and key.startswith("dlt"):
                    rows = value
                    break
            
            if not rows:
                for key, value in result_data.items():
                    if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                        rows = value
                        break

            return {
                "status": "success",
                "count": len(rows),
                "data": rows,
                "raw": result_data # 항상 포함
            }
        except Exception as e:
            return {"status": "error", "error": f"JSON 파싱 실패: {str(e)}", "raw_text": response.text[:1000]}

                
    except Exception as e:
        return {"status": "error", "error": str(e), "count": 0}


def main():
    import argparse
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--certs_json', type=str)
    parser.add_argument('--clients_json', type=str) # 추가: 거래처 리스트
    args = parser.parse_args()

    if not OUTPUT_DIR.exists():
        OUTPUT_DIR.mkdir(parents=True)

    if not args.certs_json or not args.clients_json:
        print("[FAIL] certs_json 및 clients_json 주입 필요")
        return

    certs_list = json.loads(args.certs_json)
    
    # clients_json이 파일 경로인지 확인
    if args.clients_json.endswith('.json') and Path(args.clients_json).exists():
        with open(args.clients_json, 'r', encoding='utf-8') as f:
            clients_raw = json.load(f)
            # fetch-all-clients.py의 결과가 dict 형태인 경우 처리
            if isinstance(clients_raw, dict) and "clients" in clients_raw:
                all_clients = clients_raw["clients"]
            else:
                all_clients = clients_raw
    else:
        all_clients = json.loads(args.clients_json)


    # 최근 6개월 연월 리스트 생성 (정합성 검증용)
    now = datetime.now()
    month_list = []
    for i in range(1, 7):
        dt = now - relativedelta(months=i)
        month_list.append((dt.year, dt.month))

    # 상속세, 증여세 등을 포함한 8개 세목의 코드값(itrfCd) 및 메뉴 ID(tm3lIdx) 매핑
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
    def norm(s):
        if not s: return ""
        return unicodedata.normalize('NFC', s)

    for cert_info in certs_list:
        cert_name = norm(cert_info["name"])
        cert_path = norm(cert_info["path"])
        password = cert_info["password"]

        # 해당 인증서에 소속된 거래처 필터링 (정규화 비교)
        my_clients = []
        for c in all_clients:
            s_cert = norm(c.get('_sourceCert', ''))
            s_path = norm(c.get('_sourcePath', ''))
            if s_cert == cert_name or s_path == cert_path:
                my_clients.append(c)
        
        print(f"\n>>> [{cert_name}] 필터링 결과: {len(my_clients)}건 발견 (전체 {len(all_clients)}건 중)")
        
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
        
        print(f"  [DEBUG] my_clients type: {type(my_clients)}, length: {len(my_clients)}", flush=True)
        if len(my_clients) > 0:
            print(f"  [DEBUG] First client sample: {my_clients[0].get('txprNm', 'NoName')} / {my_clients[0].get('txprRgtNo', 'NoBizNo')}", flush=True)

        # 실제 데이터가 하나라도 집계되는지 확인하기 위해 사업자별/월별 순회
        for idx, client in enumerate(my_clients):
            biz_no = client.get('bsno') # 수정: txprRgtNo -> bsno
            biz_name = client.get('txprNm', '불명')
            
            if not biz_no:
                # 개인사업자 등 bsno가 없는 경우 resno 등을 시도하거나 패스
                biz_no = client.get('resno', '').replace('*', '')
            
            if not biz_no: continue
            
            print(f"  [{cert_name}] ({idx+1}/{len(my_clients)}) [거래처] {biz_name} ({biz_no}) 조회 중...", flush=True)
            
            # 전체 기간 계산 (가장 오래된 월부터 가장 최근 월까지)
            import calendar
            if month_list:
                oldest_year, oldest_month = month_list[-1]  # 가장 오래된 월
                newest_year, newest_month = month_list[0]    # 가장 최근 월
                
                start_dt = f"{oldest_year}{oldest_month:02d}01"
                last_day = calendar.monthrange(newest_year, newest_month)[1]
                end_dt = f"{newest_year}{newest_month:02d}{last_day:02d}"
            else:
                # month_list가 비어있으면 현재 월 기준으로 처리
                now = datetime.now()
                start_dt = f"{now.year}{now.month:02d}01"
                last_day = calendar.monthrange(now.year, now.month)[1]
                end_dt = f"{now.year}{now.month:02d}{last_day:02d}"
            
            for tax_name, tax_code in TAX_MAP.items():
                # 💡 핵심: 전체 기간을 한번에 조회 (월별 순회 제거)
                res = collect_tax_data(cookies, tax_name, tax_code, start_dt, end_dt, 
                                       biz_no=biz_no, pubc_user_no=pubc_user_no)
                
                if res.get("count", 0) > 0:
                    # 세목별 폴더 생성
                    tax_dir = OUTPUT_DIR / tax_name
                    if not tax_dir.exists(): tax_dir.mkdir(parents=True)
                    
                    # 전체 기간 결과를 하나의 파일로 저장
                    filename = f"DATA_{biz_no}_{tax_name}_{start_dt}_{end_dt}.json"
                    with open(tax_dir / filename, "w", encoding="utf-8") as f:
                        json.dump(res, f, ensure_ascii=False, indent=2)
                    
                    # 결과를 월별로 분리하여 저장 (응답 데이터에 과세연월 정보가 있는 경우)
                    data_rows = res.get("data", [])
                    if data_rows:
                        # 월별로 그룹화
                        monthly_data = {}
                        for row in data_rows:
                            # 과세연월 추출 (필드명은 응답 구조에 따라 다를 수 있음)
                            # 일반적인 필드명: txnrmYm, pymnYm, rtnYm 등
                            tax_month = None
                            for field in ['txnrmYm', 'pymnYm', 'rtnYm', 'sbmsYm']:
                                if field in row and row[field]:
                                    tax_month = row[field]
                                    break
                            
                            if tax_month:
                                # YYYYMM 형식으로 변환
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
                            print(f"    [BINGO!] {tax_name} {year}-{month:02d}: {len(month_rows)}건 발견 및 저장", flush=True)
                    else:
                        # 월별 분리가 안되면 전체 결과만 저장
                        print(f"    [BINGO!] {tax_name} {start_dt}~{end_dt}: {res['count']}건 발견 및 저장", flush=True)
        
    print("\n[상세 순회 수집 종료]", flush=True)



if __name__ == "__main__":
    main()
