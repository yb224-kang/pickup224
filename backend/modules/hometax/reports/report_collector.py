import json
import random
import requests
from typing import Dict, List, Optional
from .constants import HOMETAX_WQ_ACTION_URL, DEFAULT_ACTION_ID, DEFAULT_SCREEN_ID, TAX_MAP

class HometaxTaxReportCollector:
    """
    홈택스 세목별 신고현황 데이터를 수집하는 모듈
    """

    def __init__(self, session: Optional[requests.Session] = None, cookies: Optional[Dict[str, str]] = None, pubc_user_no: str = "", txaa_adm_no: Optional[str] = None):
        if session:
            self.session = session
        else:
            self.session = requests.Session()
            if cookies:
                self.session.cookies.update(cookies)
        
        self.pubc_user_no = pubc_user_no
        self.txaa_adm_no = txaa_adm_no
        self.headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def _generate_nts_token(self) -> str:
        """홈택스 전용 nts 보안 토큰 생성"""
        sec = random.randrange(30, 60)
        return f"{sec}lpNhzq7ZwSaVt9TU2s8mHzIzLjmDpVKVgvmLBNswI{sec - 11}"

    def collect_monthly_report(self, tax_name: str, biz_no: str, start_date: str, end_date: str) -> Dict:
        """
        특정 세목, 특정 기간에 대한 신고 데이터를 조회합니다.
        """
        tax_info = TAX_MAP.get(tax_name)
        if not tax_info:
            return {"status": "error", "message": f"Unknown tax type: {tax_name}"}

        itrf_cd = tax_info["itrf_cd"]
        menu_code = tax_info["menu_code"]
        
        nts = self._generate_nts_token()
        
        params = {
            "actionId": DEFAULT_ACTION_ID,
            "screenId": DEFAULT_SCREEN_ID,
            "popupYn": "true",
            "realScreenId": DEFAULT_SCREEN_ID
        }
        
        body = {
            "befCallYn": "",
            "dprtUserId": "",
            "itrfCd": itrf_cd,
            "ntplInfpYn": "Y",
            "pubcUserNo": self.pubc_user_no,
            "rtnDtEnd": end_date,
            "rtnDtSrt": start_date,
            "scrnId": DEFAULT_SCREEN_ID,
            "txprRgtNo": biz_no,
            "pageInfoVO": {"pageNum": "1"}
        }
        
        # 세무대리 관리번호가 있으면 추가
        if self.txaa_adm_no:
            body["txaaAdmNo"] = self.txaa_adm_no
        
        json_body = json.dumps(body, ensure_ascii=False)
        payload = f"{json_body}{nts}"
        
        # Referer 설정 (홈택스 검증용)
        headers = self.headers.copy()
        headers["Referer"] = f"https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=04&tm2lIdx=0405000000&tm3lIdx={menu_code}"
        
        # [DEBUG]
        import sys
        print(f"[DEBUG Collector] Requesting {tax_name} for {biz_no}", file=sys.stderr)
        print(f"[DEBUG Collector] Cookie Keys: {list(self.session.cookies.get_dict().keys())}", file=sys.stderr)
        if "TXPPsessionID" in self.session.cookies:
             print(f"[DEBUG Collector] TXPPsessionID: {self.session.cookies['TXPPsessionID'][:20]}...", file=sys.stderr)

        try:
            response = self.session.post(
                HOMETAX_WQ_ACTION_URL,
                params=params,
                data=payload.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                return {"status": "error", "message": f"HTTP {response.status_code}"}
            
            result = response.json()
            rows = self._extract_rows(result)
            
            return {
                "status": "success",
                "count": len(rows),
                "data": rows,
                "raw": result
            }
        except Exception as e:
            return {
                "status": "error", 
                "message": f"JSON 파싱 실패: {str(e)}", 
                "raw_text": response.text[:2000] if 'response' in locals() else "No response"
            }

    def _extract_rows(self, result_data: Dict) -> List:
        """JSON 응답에서 실제 데이터 리스트 추출"""
        rows = []
        # 패턴 1: dlt... 로 시작하는 리스트 키 찾기
        for key, value in result_data.items():
            if isinstance(value, list) and key.startswith("dlt"):
                rows = value
                break
        
        # 패턴 2: 딕셔너리 리스트가 담긴 첫 번째 키 찾기 (범용)
        if not rows:
            for key, value in result_data.items():
                if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                    rows = value
                    break
        return rows
