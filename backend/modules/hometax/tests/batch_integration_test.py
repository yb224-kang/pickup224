import sys
import json
import os
import calendar
from pathlib import Path
from datetime import datetime
from dateutil.relativedelta import relativedelta
import subprocess

# 프로젝트 루트 및 모듈 경로 설정
PROJECT_ROOT = Path("/Users/sunnitic/Desktop/00_dev_/Pickup")
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT / "backend" / "modules"))

from hometax.reports.report_collector import HometaxTaxReportCollector
from hometax.reports.constants import TAX_MAP

def get_session_via_script(cert_path, password):
    """get-session-with-permission.py 스크립트를 호출하여 세션 획득"""
    script_path = PROJECT_ROOT / "backend" / "integration" / "scripts" / "get-session-with-permission.py"
    try:
        result = subprocess.run(
            ["python3", str(script_path), cert_path, password],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return {"success": False, "error": result.stderr}
        
        # 마지막 줄의 JSON 추출
        lines = result.stdout.strip().split("\n")
        for line in reversed(lines):
            if line.startswith("{"):
                return json.loads(line)
        return {"success": False, "error": "No JSON found in output"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    # 1. 테스트 대상 로드
    targets_path = PROJECT_ROOT / "test_targets.json"
    with open(targets_path, "r", encoding="utf-8") as f:
        targets = json.load(f)
    
    certs = targets["certs"]
    clients = targets["sampledClients"]
    
    # 2. 최근 14개월 연월 리스트 생성 (2025-01 ~ 2026-02)
    now = datetime(2026, 2, 10)
    month_list = []
    for i in range(0, 14):
        dt = now - relativedelta(months=i)
        month_list.append((dt.year, dt.month))
    month_list.reverse() # 과거순 정렬
    
    print(f"\n[시작] 10개 사업자 대규모 통합 테스트 (8개 세목 x 14개월)")
    print(f"대상 기간: {month_list[0][0]}-{month_list[0][1]:02d} ~ {month_list[-1][0]}-{month_list[-1][1]:02d}")
    
    output_base = PROJECT_ROOT / "R&D" / "collected_data" / "batch_test"
    output_base.mkdir(parents=True, exist_ok=True)

    summary = {
        "total_targets": len(clients),
        "total_requests": 0,
        "success_count": 0,
        "bingo_count": 0,
        "results": []
    }

    # 3. 인증서별로 그룹화하여 세션 재사용
    cert_map = {c["path"]: c for c in certs}
    clients_by_cert = {}
    for client in clients:
        cert_path = client.get("_sourcePath")
        if cert_path not in clients_by_cert:
            clients_by_cert[cert_path] = []
        clients_by_cert[cert_path].append(client)

    for cert_path, my_clients in clients_by_cert.items():
        cert_info = cert_map.get(cert_path)
        if not cert_info: continue

        print(f"\n>>> [{cert_info['name']}] 세션 획득 중...")
        session_data = get_session_via_script(cert_path, cert_info["password"])
        
        if not session_data.get("success"):
            print(f"  [FAIL] 세션 실패: {session_data.get('error')}")
            continue
        
        collector = HometaxTaxReportCollector(
            cookies=session_data["cookies"],
            pubc_user_no=session_data["pubcUserNo"]
        )

        for idx, client in enumerate(my_clients):
            biz_no = client.get("bsno")
            biz_name = client.get("txprNm", "불명")
            if not biz_no: continue

            print(f"  ({idx+1}/{len(my_clients)}) [거래처] {biz_name} ({biz_no}) 조회 시작...")
            
            for tax_name in TAX_MAP.keys():
                for year, month in month_list:
                    start_dt = f"{year}{month:02d}01"
                    last_day = calendar.monthrange(year, month)[1]
                    end_dt = f"{year}{month:02d}{last_day:02d}"
                    
                    summary["total_requests"] += 1
                    res = collector.collect_monthly_report(tax_name, biz_no, start_dt, end_dt)
                    
                    # 홈택스 차단 방지를 위한 미세 지연 추가
                    import time
                    time.sleep(0.3)
                    
                    if res.get("status") == "success":
                        summary["success_count"] += 1
                        count = res.get("count", 0)
                        if count > 0:
                            summary["bingo_count"] += 1
                            # 결과 저장
                            tax_dir = output_base / tax_name
                            tax_dir.mkdir(parents=True, exist_ok=True)
                            filename = f"DATA_{biz_no}_{tax_name}_{year}{month:02d}.json"
                            with open(tax_dir / filename, "w", encoding="utf-8") as rf:
                                json.dump(res, rf, ensure_ascii=False, indent=2)
                            print(f"    [BINGO!] {tax_name} {year}-{month:02d}: {count}건")
                    else:
                        print(f"    [ERR] {tax_name} {year}-{month:02d}: {res.get('message')}")

    print("\n" + "="*50)
    print(f"최종 통계")
    print(f"- 총 시도 횟수: {summary['total_requests']}")
    print(f"- API 성공 횟수: {summary['success_count']}")
    print(f"- 데이터 발견(BINGO): {summary['bingo_count']}")
    print("="*50)

if __name__ == "__main__":
    main()
