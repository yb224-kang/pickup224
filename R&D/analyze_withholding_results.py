"""
원천세 최근 3개월 조회 결과 분석
성공한 사업자번호와 실패한 사업자번호 리스팅
"""
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
output_dir = BASE_DIR / "R&D" / "collected_data" / "withholding_3months"
raw_dir = BASE_DIR / "R&D" / "collected_data"

# 성공한 사업자번호 추출 (파일명에서)
success_biz_nos = set()
if output_dir.exists():
    for file in output_dir.glob('DATA_*_원천세_*.json'):
        # 파일명 형식: DATA_{biz_no}_원천세_{date}.json
        match = re.search(r'DATA_(\d+)_원천세_', file.name)
        if match:
            success_biz_nos.add(match.group(1))

# 실패한 사업자번호 추출 (RAW 파일에서 resultCnt=0 확인)
failed_biz_nos = set()
all_raw_biz_nos = set()

if raw_dir.exists():
    for file in raw_dir.glob('RAW_원천세_*_*.json'):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                biz_no = data.get('txprRgtNo', '')
                result_cnt = data.get('resultCnt', -1)
                
                if biz_no:
                    all_raw_biz_nos.add(biz_no)
                    if result_cnt == 0:
                        failed_biz_nos.add(biz_no)
        except Exception as e:
            # 파일명에서 사업자번호 추출 시도
            match = re.search(r'RAW_원천세_(\d+)_', file.name)
            if match:
                all_raw_biz_nos.add(match.group(1))

# 성공한 사업자번호 중 RAW 파일에 없는 경우도 포함
# (RAW 파일이 삭제되었을 수 있음)
all_queried_biz_nos = all_raw_biz_nos | success_biz_nos

# 실패한 사업자번호 = 전체 조회한 사업자번호 - 성공한 사업자번호
final_failed_biz_nos = all_queried_biz_nos - success_biz_nos

print("=" * 60)
print("원천세 최근 3개월 조회 결과 분석")
print("=" * 60)
print(f"성공한 사업자번호: {len(success_biz_nos)}개")
print(f"실패한 사업자번호: {len(final_failed_biz_nos)}개")
print(f"전체 조회한 사업자번호: {len(all_queried_biz_nos)}개")
print()

print("=" * 60)
print("성공한 사업자번호 목록")
print("=" * 60)
for biz_no in sorted(success_biz_nos):
    print(biz_no)
print()

print("=" * 60)
print("실패한 사업자번호 목록")
print("=" * 60)
for biz_no in sorted(final_failed_biz_nos):
    print(biz_no)
print()

# 통계 저장
result_file = BASE_DIR / "R&D" / "withholding_analysis_result.json"
with open(result_file, 'w', encoding='utf-8') as f:
    json.dump({
        "success_count": len(success_biz_nos),
        "failed_count": len(final_failed_biz_nos),
        "total_count": len(all_queried_biz_nos),
        "success_biz_nos": sorted(list(success_biz_nos)),
        "failed_biz_nos": sorted(list(final_failed_biz_nos))
    }, f, ensure_ascii=False, indent=2)

print(f"결과가 {result_file}에 저장되었습니다.")

