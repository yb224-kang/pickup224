"""
수임/해임 상태와 원천세 조회 성공/실패 연관성 분석
"""
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

# 1. 거래처 목록 로드
test_input_path = BASE_DIR / "R&D" / "temp" / "test_input.json"
with open(test_input_path, 'r', encoding='utf-8') as f:
    test_data = json.load(f)

clients = test_data.get("clients", [])

# 2. 성공/실패 사업자번호 로드
analysis_result_path = BASE_DIR / "R&D" / "withholding_analysis_result.json"
with open(analysis_result_path, 'r', encoding='utf-8') as f:
    analysis_result = json.load(f)

success_biz_nos = set(analysis_result["success_biz_nos"])
failed_biz_nos = set(analysis_result["failed_biz_nos"])

# 3. 거래처별로 수임/해임 상태와 성공/실패 매칭
engagement_stats = {
    "수임중": {
        "total": 0,
        "success": 0,
        "failed": 0,
        "no_biz_no": 0,
        "not_queried": 0
    },
    "해지중": {
        "total": 0,
        "success": 0,
        "failed": 0,
        "no_biz_no": 0,
        "not_queried": 0
    },
    "알수없음": {
        "total": 0,
        "success": 0,
        "failed": 0,
        "no_biz_no": 0,
        "not_queried": 0
    }
}

# 4. 통계 수집
for client in clients:
    engagement_status = client.get("_engagementStatus", "알수없음")
    biz_no = client.get("bsno") or client.get("resno", "").replace("*", "")
    
    if not biz_no:
        engagement_stats[engagement_status]["no_biz_no"] += 1
        continue
    
    engagement_stats[engagement_status]["total"] += 1
    
    if biz_no in success_biz_nos:
        engagement_stats[engagement_status]["success"] += 1
    elif biz_no in failed_biz_nos:
        engagement_stats[engagement_status]["failed"] += 1
    else:
        engagement_stats[engagement_status]["not_queried"] += 1

# 5. 결과 출력
print("=" * 60)
print("수임/해임 상태별 원천세 조회 성공률 분석")
print("=" * 60)
print()

for status in ["수임중", "해지중", "알수없음"]:
    stats = engagement_stats[status]
    total = stats["total"]
    success = stats["success"]
    failed = stats["failed"]
    no_biz_no = stats["no_biz_no"]
    not_queried = stats["not_queried"]
    
    if total > 0:
        success_rate = (success / total) * 100
        failed_rate = (failed / total) * 100
    else:
        success_rate = 0
        failed_rate = 0
    
    print(f"[{status}]")
    print(f"  - 전체 거래처: {total + no_biz_no + not_queried}개")
    print(f"    * 사업자번호 있음: {total}개")
    print(f"    * 사업자번호 없음: {no_biz_no}개")
    print(f"    * 조회 안됨: {not_queried}개")
    print(f"  - 성공: {success}개 ({success_rate:.1f}%)")
    print(f"  - 실패: {failed}개 ({failed_rate:.1f}%)")
    print()

# 6. 상세 분석
print("=" * 60)
print("상세 분석")
print("=" * 60)

total_active = engagement_stats["수임중"]["total"]
total_terminated = engagement_stats["해지중"]["total"]
total_unknown = engagement_stats["알수없음"]["total"]

success_active = engagement_stats["수임중"]["success"]
success_terminated = engagement_stats["해지중"]["success"]
success_unknown = engagement_stats["알수없음"]["success"]

failed_active = engagement_stats["수임중"]["failed"]
failed_terminated = engagement_stats["해지중"]["failed"]
failed_unknown = engagement_stats["알수없음"]["failed"]

print(f"수임중 거래처:")
print(f"  - 전체: {total_active}개")
print(f"  - 성공: {success_active}개 ({success_active/total_active*100 if total_active > 0 else 0:.1f}%)")
print(f"  - 실패: {failed_active}개 ({failed_active/total_active*100 if total_active > 0 else 0:.1f}%)")
print()

print(f"해지중 거래처:")
print(f"  - 전체: {total_terminated}개")
print(f"  - 성공: {success_terminated}개 ({success_terminated/total_terminated*100 if total_terminated > 0 else 0:.1f}%)")
print(f"  - 실패: {failed_terminated}개 ({failed_terminated/total_terminated*100 if total_terminated > 0 else 0:.1f}%)")
print()

# 7. 결론
print("=" * 60)
print("결론")
print("=" * 60)

if total_active > 0 and total_terminated > 0:
    active_success_rate = success_active / total_active * 100
    terminated_success_rate = success_terminated / total_terminated * 100
    
    print(f"수임중 거래처 성공률: {active_success_rate:.1f}%")
    print(f"해지중 거래처 성공률: {terminated_success_rate:.1f}%")
    print()
    
    if active_success_rate > terminated_success_rate:
        diff = active_success_rate - terminated_success_rate
        print(f"✅ 수임중 거래처가 해지중 거래처보다 {diff:.1f}%p 높은 성공률을 보입니다.")
    elif terminated_success_rate > active_success_rate:
        diff = terminated_success_rate - active_success_rate
        print(f"⚠️ 해지중 거래처가 수임중 거래처보다 {diff:.1f}%p 높은 성공률을 보입니다.")
    else:
        print("→ 수임/해임 상태와 성공률 간에 유의미한 차이가 없습니다.")

# 8. 결과 저장
result_file = BASE_DIR / "R&D" / "engagement_status_analysis.json"
with open(result_file, 'w', encoding='utf-8') as f:
    json.dump({
        "engagement_stats": engagement_stats,
        "summary": {
            "수임중": {
                "total": total_active,
                "success": success_active,
                "failed": failed_active,
                "success_rate": success_active/total_active*100 if total_active > 0 else 0,
                "failed_rate": failed_active/total_active*100 if total_active > 0 else 0
            },
            "해지중": {
                "total": total_terminated,
                "success": success_terminated,
                "failed": failed_terminated,
                "success_rate": success_terminated/total_terminated*100 if total_terminated > 0 else 0,
                "failed_rate": failed_terminated/total_terminated*100 if total_terminated > 0 else 0
            }
        }
    }, f, ensure_ascii=False, indent=2)

print()
print(f"결과가 {result_file}에 저장되었습니다.")

