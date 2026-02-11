"""
홈택스 신고현황 조회를 위한 상수 및 매핑 정보
"""

# API 엔드포인트
HOMETAX_WQ_ACTION_URL = "https://teht.hometax.go.kr/wqAction.do"

# 기본 액션 및 화면 ID
DEFAULT_ACTION_ID = "ATERNABA016R01"
DEFAULT_SCREEN_ID = "UTERNAAZ0Z31"

# 세목별 매핑 테이블 (itrf_cd, tm3lIdx)
TAX_MAP = {
    "원천세": {
        "itrf_cd": "14",
        "menu_code": "0405030000"
    },
    "부가세": {
        "itrf_cd": "41",
        "menu_code": "0405010000"
    },
    "법인세": {
        "itrf_cd": "31",
        "menu_code": "0405020000"
    },
    "종합소득세": {
        "itrf_cd": "10",
        "menu_code": "0405040000"
    },
    "양도소득세": {
        "itrf_cd": "22",
        "menu_code": "0405050000"
    },
    "상속세": {
        "itrf_cd": "26",
        "menu_code": "0405150000"
    },
    "증여세": {
        "itrf_cd": "27",
        "menu_code": "0405060000"
    },
    "종합부동산세": {
        "itrf_cd": "17",
        "menu_code": "0405070000"
    }
}
