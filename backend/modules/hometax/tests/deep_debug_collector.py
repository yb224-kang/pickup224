import sys
import json
import re
import subprocess
from pathlib import Path

PROJECT_ROOT = Path("/Users/sunnitic/Desktop/00_dev_/Pickup")
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT / "backend" / "modules"))

from hometax.reports.report_collector import HometaxTaxReportCollector

def main():
    with open(PROJECT_ROOT / "test_targets.json", "r") as f:
        targets = json.load(f)

    cert = targets["certs"][0]
    client = targets["sampledClients"][0]

    script_path = PROJECT_ROOT / "backend/integration/scripts/get-session-with-permission.py"
    res = subprocess.run(["python3", str(script_path), cert["path"], cert["password"]], capture_output=True, text=True)
    stdout = res.stdout.strip()

    try:
        json_candidates = re.findall(r"\{.*\}", stdout, re.DOTALL)
        session_data = json.loads(json_candidates[-1])
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        sys.exit(1)

    collector = HometaxTaxReportCollector(cookies=session_data["cookies"], pubc_user_no=session_data["pubcUserNo"])
    print(">>> Requesting...")
    result = collector.collect_monthly_report("원천세", client["bsno"], "20250101", "20250131")
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
