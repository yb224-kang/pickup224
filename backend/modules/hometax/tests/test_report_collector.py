import unittest
from ..reports.report_collector import HometaxTaxReportCollector
from ..reports.constants import TAX_MAP

class TestReportCollector(unittest.TestCase):
    def setUp(self):
        # 테스트용 가짜 세션 정보
        self.cookies = {"WMONID": "test", "TXPPsessionID": "test"}
        self.pubc_user_no = "12345678"
        self.collector = HometaxTaxReportCollector(self.cookies, self.pubc_user_no)

    def test_tax_map_completeness(self):
        """8개 세목 매핑 정보가 모두 포함되어 있는지 확인"""
        expected_taxes = ["원천세", "부가세", "법인세", "종합소득세", "양도소득세", "상속세", "증여세", "종합부동산세"]
        for tax in expected_taxes:
            self.assertIn(tax, TAX_MAP)
            self.assertIn("itrf_cd", TAX_MAP[tax])
            self.assertIn("menu_code", TAX_MAP[tax])

    def test_nts_token_format(self):
        """NTS 보안 토큰 생성 규격 확인"""
        token = self.collector._generate_nts_token()
        self.assertTrue(len(token) > 20)
        self.assertTrue(token[0:2].isdigit())

if __name__ == '__main__':
    unittest.main()
