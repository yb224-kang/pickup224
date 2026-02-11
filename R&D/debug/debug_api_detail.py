import requests
import json
import random
import sys
from pathlib import Path

# 설정
PROJECT_ROOT = Path("/Users/sunnitic/Desktop/00_dev_/Pickup")
SCRIPTS_DIR = PROJECT_ROOT / "backend" / "integration" / "scripts"

def get_session():
    # 백엔드 스크립트 활용
    cert_path = "/Users/sunnitic/Library/Application Support/hometax/certs/소신세무회계(SHIN KANG HYUN)00206812021122220763320/NPKI/yessign/USER/cn=소신세무회계(SHIN KANG HYUN)00206812021122220763320,ou=corp,ou=yessign,o=yessign,c=kr/signPri.key"
    password = "..." # 실제 비밀번호는 브릿지에서 가져와야 함. 
    # 여기서는 이미 브릿지가 실행되었으므로, 세션을 직접 하드코딩하거나 
    # 브릿지 로직을 아주 간단히 재구현합니다.
    pass

# 대신 브릿지를 통해 실행되도록 설계된 tax_data_collector.py의 로직만 따로 떼서 
# 특정 사업자번호로 직접 테스트하는 스크립트 작성
def debug_call(cookies, pubc_user_no, biz_no):
    sec = random.randrange(30, 60)
    nts = f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"
    
    body = {
        "befCallYn": "",
        "dprtUserId": "",
        "itrfCd": "14", # 원천세
        "ntplInfpYn": "Y",
        "pubcUserNo": pubc_user_no,
        "rtnDtEnd": "20251231",
        "rtnDtSrt": "20251201",
        "scrnId": "UTERNAAZ0Z31",
        "txprRgtNo": biz_no,
        "pageInfoVO": { "pageNum": "1" }
    }
    
    payload = json.dumps(body, ensure_ascii=False) + nts
    url = "https://teht.hometax.go.kr/wqAction.do?actionId=ATERNABA016R01"
    
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Accept": "application/json"
    }
    
    print(f">>> Sending request for {biz_no}...")
    res = requests.post(url, data=payload.encode('utf-8'), headers=headers, cookies=cookies)
    print(f"Status: {res.status_code}")
    print("Response Body:")
    print(res.text)

if __name__ == "__main__":
    # 브릿지에서 전달받은 정보로 실행하는 대신, 
    # 세션 획득부터 한 번에 수행
    import subprocess
    script_path = SCRIPTS_DIR / "get-session-with-permission.py"
    cert_path = "/Users/sunnitic/Library/Application Support/hometax/certs/소신세무회계(SHIN KANG HYUN)00206812021122220763320/NPKI/yessign/USER/signCert.der"
    password = sys.argv[1] # PW는 인자로 받음
    
    result = subprocess.run(["python3", str(script_path), cert_path, password], capture_output=True, text=True)
    out = result.stdout
    json_start = out.find('{')
    data = json.loads(out[json_start:])
    
    if data.get("success"):
        debug_call(data["cookies"], data["pubcUserNo"], "1370636307") # 임의의 사업자번호
    else:
        print("Session Fail:", data.get("error"))
