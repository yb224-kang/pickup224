import sys
import json
import os
import calendar
import time
import random
import subprocess
from pathlib import Path
from datetime import datetime

# 프로젝트 루트 및 모듈 경로 설정
PROJECT_ROOT = Path("/Users/sunnitic/Desktop/00_dev_/Pickup")
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT / "backend" / "modules"))

from hometax.reports.report_collector import HometaxTaxReportCollector
# 상속, 증여, 양도, 법인, 종소, 종부
TARGET_TAXES_FIXED = {
    "법인세": ["202503"],
    "종합소득세": ["202505"],
    "종합부동산세": ["202512"]
}
TARGET_TAXES_RANDOM = ["양도소득세", "상속세", "증여세"]

# 인증서 비밀번호 로드 및 전체 거래처 가져오기 함수
def get_all_clients_with_certs():
    # 1. 인증서 비번 로드 (Node.js script execution wrapper)
    #    Simpler to just reuse the logic if we had a direct python way, 
    #    but we rely on the bridge usually. 
    #    For this test, let's use the `test_targets.json` if it has all certs? 
    #    No, user wants *all* clients.
    
    # We will use the `tax_collector_bridge.js` logic approach but purely in Python 
    # if we have the passwords. 
    # Start by listing certs and getting passwords from the storage (Node.js helper).
    
    # 1. 인증서 비번 로드 (Node.js script execution)
    dump_script = PROJECT_ROOT / "backend" / "integration" / "scripts" / "dump_certs.js"
    res = subprocess.run(["node", str(dump_script)], cwd=str(PROJECT_ROOT / "backend"), capture_output=True, text=True)
    
    if res.returncode != 0:
        print("Error getting certs:", res.stderr)
        return [], []
        
    try:
        certs = json.loads(res.stdout.strip())
    except:
        return [], []
        
    # Now fetch clients for each cert
    all_clients = []
    
    fetch_script = PROJECT_ROOT / "backend" / "integration" / "scripts" / "fetch-all-clients.py"
    
    # We can pass all certs to fetch-all-clients at once? Yes, it supports array.
    # But it might be slow.
    print(f"[Info] Fetching clients for {len(certs)} certs...")
    
    # Call fetch-all-clients.py
    # It takes JSON string of certs
    fetch_res = subprocess.run(
        ["python3", str(fetch_script), json.dumps(certs)], 
        capture_output=True, text=True
    )
    
    if fetch_res.returncode != 0:
        print("Error fetching clients:", fetch_res.stderr)
        return certs, []
        
    # Parse last line
    lines = fetch_res.stdout.strip().split("\n")
    try:
        data = json.loads(lines[-1])
        all_clients = data.get("clients", [])
    except:
        print("Error parsing client list json")
        
    return certs, all_clients

def get_session(cert_path, password):
    script_path = PROJECT_ROOT / "backend" / "integration" / "scripts" / "get-session-with-permission.py"
    res = subprocess.run(
        ["python3", str(script_path), cert_path, password],
        capture_output=True, text=True
    )
    try:
        # Find JSON in output
        lines = res.stdout.strip().split("\n")
        for line in reversed(lines):
            if line.strip().startswith("{"):
                return json.loads(line)
    except:
        pass
    return None

import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--certs_file", required=True, help="Path to certificates JSON file")
    parser.add_argument("--clients_file", required=True, help="Path to clients JSON file")
    args = parser.parse_args()

    with open(args.certs_file, 'r') as f:
        certs = json.load(f)
    
    with open(args.clients_file, 'r') as f:
        clients_raw = json.load(f)
    
    # Bridge에서 넘어온 clients는 배열 형태이거나 {clients: [...]} 형태일 수 있음. 
    # Bridge 코드를 보면 allClients 배열 자체를 넘김.
    if isinstance(clients_raw, dict) and "clients" in clients_raw:
        clients = clients_raw["clients"]
    else:
        clients = clients_raw

    print(f">>> [PINPOINT SCAN] 8개 세목 실데이터 확보를 위한 정밀 스캔 시작 (Worker)")
    print(f"   - 주입된 인증서: {len(certs)}개")
    print(f"   - 주입된 거래처: {len(clients)}개")
    
    # 2. 거래처 그룹화
    clients_by_cert = {}
    for c in clients:
        p = c.get("_sourcePath")
        if p not in clients_by_cert:
            clients_by_cert[p] = []
        clients_by_cert[p].append(c)
        
    cert_map = {c["path"]: c for c in certs}
    
    output_base = PROJECT_ROOT / "R&D" / "collected_data" / "pinpoint_test"
    output_base.mkdir(parents=True, exist_ok=True)
    
    stats = {t: 0 for t in list(TARGET_TAXES_FIXED.keys()) + TARGET_TAXES_RANDOM}
    
    # 3. 스캔 실행
    for cert_path, my_clients in clients_by_cert.items():
        cert_info = cert_map.get(cert_path)
        if not cert_info: continue
        
        print(f"\n>>> [{cert_info['name']}] 세션 연결 중...")
        session_data = get_session(cert_path, cert_info["password"])
        if not session_data or not session_data.get("success"):
            print("   [Fail] 세션 획득 실패")
            continue
            
        collector = HometaxTaxReportCollector(
            cookies=session_data["cookies"],
            pubc_user_no=session_data["pubcUserNo"]
        )
        
        # 4. 거래처 순회
        # Random Taxes are heavy, so only scan a subset of clients for them?
        # User said "resource minimal". 
        # Strategy: Scan ALL clients for Fixed Taxes.
        # Scan first 10 clients + random 10 clients for Random Taxes?
        
        for idx, client in enumerate(my_clients):
            biz_no = client.get("bsno")
            if not biz_no: continue
            
            # (1) Fixed Taxes (Period Pinpoint)
            for tax, months in TARGET_TAXES_FIXED.items():
                for ym in months:
                    year, month = int(ym[:4]), int(ym[4:])
                    last_day = calendar.monthrange(year, month)[1]
                    start_dt = f"{year}{month:02d}01"
                    end_dt = f"{year}{month:02d}{last_day:02d}"
                    
                    res = collector.collect_monthly_report(tax, biz_no, start_dt, end_dt)
                    
                    if res.get("status") == "success" and res.get("count", 0) > 0:
                         print(f"   [BINGO!] {client['txprNm']}({biz_no}): {tax} {ym} 발견!")
                         stats[tax] += 1
                         # Save
                         tdir = output_base / tax
                         tdir.mkdir(parents=True, exist_ok=True)
                         with open(tdir / f"{biz_no}_{ym}.json", "w") as f:
                             json.dump(res, f, ensure_ascii=False, indent=2)
                    
                    time.sleep(0.1) # Fast scan
            
            # (2) Random Taxes (Full Year Scan, but Limited Clients)
            # Scan only first 5 clients of each cert + any client with '부동산' in name
            is_target_for_random = (idx < 5) or ("부동산" in client.get("txprNm", ""))
            
            if is_target_for_random:
                # Scan entire 2025
                # To save API calls, maybe just scan halves? 
                # 20250101-20250630, 20250701-20251231
                # Hometax allows 1 month max usually for these reports? 
                # Let's check report_collector logic. It usually respects 1 month.
                # Actually for these taxes, sometimes 3 months is allowed. 
                # But let's stick to 1 month to be safe.
                # Just scan 202506 and 202512? (Half year ends?)
                # Or just random 3 months?
                # User wants "actual data". I'll try 2025-06 and 2025-12 first.
                
                target_months_random = ["202506", "202512", "202503", "202509"] # Quarterly
                
                for tax in TARGET_TAXES_RANDOM:
                    # If we already found enough samples, skip? No, user wants verification.
                    if stats[tax] >= 3: continue # Stop if we found 3 examples
                    
                    for ym in target_months_random:
                        year, month = int(ym[:4]), int(ym[4:])
                        last_day = calendar.monthrange(year, month)[1]
                        start_dt = f"{year}{month:02d}01"
                        end_dt = f"{year}{month:02d}{last_day:02d}"
                        
                        res = collector.collect_monthly_report(tax, biz_no, start_dt, end_dt)
                        time.sleep(0.1)
                        
                        if res.get("status") == "success" and res.get("count", 0) > 0:
                             print(f"   [BINGO!] {client['txprNm']}({biz_no}): {tax} {ym} 발견!")
                             stats[tax] += 1
                             tdir = output_base / tax
                             tdir.mkdir(parents=True, exist_ok=True)
                             with open(tdir / f"{biz_no}_{ym}.json", "w") as f:
                                 json.dump(res, f, ensure_ascii=False, indent=2)
                             break # Found one for this tax/client, move to next tax

    print("\n>>> 최종 결과 Stats:", stats)

if __name__ == "__main__":
    main()
