import json
import requests
import xml.etree.ElementTree as ET
import sys
from pathlib import Path

# 기존 백엔드 정보 활용을 위해 bridge에서 생성된 JSON 또는 직접 입력된 세션 필요
# 여기서는 가장 최근에 사용된 세무대리인의 정보를 활용하여 특정 달의 raw data를 가져옵니다.

def debug_fetch_raw(cookies, tax_code, start_date, end_date):
    endpoint = "https://teht.hometax.go.kr/wqAction.do"
    params = {
        "actionId": "ATERNABA016R01",
        "screenId": "UTERNAAZ0Z31",
        "popupYn": "true",
        "realScreenId": "UTERNAAZ0Z31"
    }
    
    payload = f"""<map id="postParam">
        <rtnDtSrt>{start_date}</rtnDtSrt>
        <rtnDtEnd>{end_date}</rtnDtEnd>
        <txprRgtNo></txprRgtNo>
        <wrtMthCd></wrtMthCd>
        <infoOthYn>Y</infoOthYn>
    </map>"""
    
    headers = {
        "Content-Type": "application/xml; charset=UTF-8",
        "Referer": f"https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=04&tm2lIdx=0405000000&tm3lIdx={tax_code}"
    }
    
    response = requests.post(endpoint, params=params, data=payload.encode('utf-8'), headers=headers, cookies=cookies)
    print("\n[HTTP Status]", response.status_code)
    print("\n[Raw Response Preview (1000 chars)]")
    print(response.text[:2000])
    
    with open("raw_debug_response.xml", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("\n[File Saved] raw_debug_response.xml에 전체 응답을 저장했습니다.")

if __name__ == "__main__":
    # 이전에 실행했던 세션 쿠키를 수동으로 주입하여 테스트하거나 
    # tax_collector_bridge.js를 수정하여 raw를 찍어보게 할 수 있습니다.
    # 여기서는 안전하게 tax_data_collector.py를 수정하여 모든 응답을 파일로 남기게 하겠습니다.
    pass
