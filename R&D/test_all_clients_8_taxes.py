"""
전체 규모 테스트: 모든 거래처 × 8개 세목, 최근 1년 전체 기간 조회
예상: 600거래처 × 8세목 = 4,800회 호출, 약 20-25분
"""
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from dateutil.relativedelta import relativedelta

# 원본 스크립트 import
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR / "R&D"))
from tax_data_collector import get_hometax_session, collect_tax_data, OUTPUT_DIR

def main():
    # 전체 거래처 목록 가져오기 (fetch-all-clients.py 결과 사용)
    # test_input.json이 있으면 사용, 없으면 fetch-all-clients.py 실행
    test_input_path = BASE_DIR / "R&D" / "temp" / "test_input.json"
    
    if not test_input_path.exists():
        print(f"[INFO] test_input.json이 없습니다. fetch-all-clients.py를 실행하여 전체 거래처 목록을 가져옵니다...")
        
        # fetch-all-clients.py 실행을 위한 Node.js 스크립트 실행
        import subprocess
        node_script = f"""
const path = require('path');
process.chdir(__dirname);
require('ts-node').register({{
  project: path.join(__dirname, 'backend', 'tsconfig.json'),
  transpileOnly: true,
}});

const {{ listSavedCertificates, getCertificatePassword }} = require('./backend/modules/certificate/password/storage');
const {{ spawn }} = require('child_process');
const fs = require('fs');

(async () => {{
  try {{
    const savedCerts = await listSavedCertificates();
    const certsWithPassword = await Promise.all(
      savedCerts.map(async (cert) => {{
        const password = await getCertificatePassword(cert.path);
        return {{
          path: cert.path,
          name: cert.name,
          password: password || ''
        }};
      }})
    );
    const validCerts = certsWithPassword.filter(cert => cert.password);
    
    const pythonScript = path.join(__dirname, 'backend', 'integration', 'scripts', 'fetch-all-clients.py');
    const certsJson = JSON.stringify(validCerts);
    
    const python = spawn('python3', [pythonScript, certsJson], {{
      cwd: __dirname,
      env: {{ ...process.env, AXCEL_ENCRYPTION_KEY: process.env.AXCEL_ENCRYPTION_KEY || '' }}
    }});
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {{
      stdout += data.toString();
    }});
    
    python.stderr.on('data', (data) => {{
      stderr += data.toString();
    }});
    
    await new Promise((resolve, reject) => {{
      python.on('close', (code) => {{
        if (code === 0) {{
          try {{
            const jsonStart = stdout.indexOf('{{');
            const jsonEnd = stdout.lastIndexOf('}}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {{
              const result = JSON.parse(stdout.substring(jsonStart, jsonEnd));
              
              const output = {{
                certs: validCerts,
                clients: result.clients || []
              }};
              
              const outputPath = path.join(__dirname, 'R&D', 'temp', 'test_input.json');
              fs.mkdirSync(path.dirname(outputPath), {{ recursive: true }});
              fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
              
              console.log(JSON.stringify(output));
              resolve(output);
            }} else {{
              reject(new Error('JSON 파싱 실패'));
            }}
          }} catch (e) {{
            reject(e);
          }}
        }} else {{
          reject(new Error(`fetch-all-clients.py 실패: ${{stderr}}`));
        }}
      }});
    }});
    
  }} catch (error) {{
    console.error('오류:', error);
    process.exit(1);
  }}
}})();
"""
        result = subprocess.run(
            ['node', '-e', node_script],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            print(f"[FAIL] 거래처 목록 가져오기 실패: {result.stderr}")
            return
        
        # 결과를 test_input.json으로 저장
        try:
            test_data = json.loads(result.stdout)
            test_input_path.parent.mkdir(parents=True, exist_ok=True)
            with open(test_input_path, 'w', encoding='utf-8') as f:
                json.dump(test_data, f, ensure_ascii=False, indent=2)
            print(f"[OK] 거래처 목록 저장 완료: {len(test_data.get('clients', []))}개")
        except Exception as e:
            print(f"[FAIL] 결과 파싱 실패: {e}")
            return
    
    # 테스트 입력 파일 로드
    with open(test_input_path, 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    
    certs_list = test_data["certs"]
    all_clients = test_data.get("clients", [])
    
    if len(all_clients) == 0:
        print(f"[FAIL] 거래처 목록이 비어있습니다.")
        return
    
    # 최근 1년 연월 리스트 생성 (전체 기간 계산용)
    now = datetime.now()
    month_list = []
    for i in range(1, 13):  # 최근 12개월 (1년)
        dt = now - relativedelta(months=i)
        month_list.append((dt.year, dt.month))
    
    # 8개 세목 모두 조회
    TAX_MAP = {
        "원천세": "0405030000",
        "부가세": "0405010000",
        "법인세": "0405020000",
        "종합소득세": "0405040000",
        "양도소득세": "0405050000",
        "상속세": "0405150000",
        "증여세": "0405060000",
        "종합부동산세": "0405070000"
    }
    
    import unicodedata
    import calendar
    
    def norm(s):
        if not s: return ""
        return unicodedata.normalize('NFC', s)
    
    # 전체 기간 계산
    if month_list:
        oldest_year, oldest_month = month_list[-1]  # 가장 오래된 월
        newest_year, newest_month = month_list[0]    # 가장 최근 월
        
        start_dt = f"{oldest_year}{oldest_month:02d}01"
        last_day = calendar.monthrange(newest_year, newest_month)[1]
        end_dt = f"{newest_year}{newest_month:02d}{last_day:02d}"
    else:
        start_dt = f"{now.year}{now.month:02d}01"
        last_day = calendar.monthrange(now.year, now.month)[1]
        end_dt = f"{now.year}{now.month:02d}{last_day:02d}"
    
    print(f"\n{'='*60}")
    print(f"[전체 규모 테스트 설정]")
    print(f"  - 인증서 수: {len(certs_list)}개")
    print(f"  - 전체 거래처 수: {len(all_clients)}개")
    print(f"  - 세목 수: {len(TAX_MAP)}개")
    print(f"  - 조회 기간: {start_dt} ~ {end_dt} (최근 1년)")
    print(f"  - 예상 API 호출: {len(all_clients)} × {len(TAX_MAP)} = {len(all_clients) * len(TAX_MAP)}회")
    print(f"  - 예상 시간: 약 20-25분 (딜레이 0.1초 기준)")
    print(f"{'='*60}\n")
    
    total_collected = 0
    total_api_calls = 0
    total_errors = 0
    start_time = time.time()
    
    for cert_info in certs_list:
        cert_name = norm(cert_info["name"])
        cert_path = norm(cert_info["path"])
        password = cert_info["password"]
        
        # 해당 인증서에 소속된 거래처 필터링
        my_clients = []
        for c in all_clients:
            s_cert = norm(c.get('_sourceCert', ''))
            s_path = norm(c.get('_sourcePath', ''))
            if s_cert == cert_name or s_path == cert_path:
                my_clients.append(c)
        
        if len(my_clients) == 0:
            print(f">>> [{cert_name}] 관리하는 거래처가 없습니다. 패스.")
            continue
        
        print(f"\n{'='*60}")
        print(f">>> [{cert_name}] 테스트 시작")
        print(f">>> 거래처 수: {len(my_clients)}개 (전체 {len(all_clients)}건 중)")
        print(f"{'='*60}")
        
        print(f">>> [{cert_name}] 세션 활성화 시도 중...", flush=True)
        
        session_data = get_hometax_session(cert_path, password)
        if not session_data.get("success"):
            print(f"  [FAIL] 세션 획득 실패: {session_data.get('error')}", flush=True)
            continue
        
        cookies = session_data.get("cookies", {})
        pubc_user_no = session_data.get("pubcUserNo", "")
        
        print(f"  [OK] 세션 획득 성공", flush=True)
        
        # 거래처별 순회
        for idx, client in enumerate(my_clients):
            biz_no = client.get('bsno')
            biz_name = client.get('txprNm', '불명')
            
            if not biz_no:
                biz_no = client.get('resno', '').replace('*', '')
            
            if not biz_no:
                if (idx + 1) % 50 == 0:  # 50개마다 진행 상황 출력
                    print(f"  [{idx+1}/{len(my_clients)}] 진행 중... (사업자번호 없음 건너뜀)", flush=True)
                continue
            
            if (idx + 1) % 50 == 0 or (idx + 1) == len(my_clients):
                elapsed = time.time() - start_time
                print(f"  [{idx+1}/{len(my_clients)}] 진행 중... (소요 시간: {elapsed/60:.1f}분)", flush=True)
            
            # 8개 세목 모두 조회 (전체 기간 한번에)
            for tax_name, tax_code in TAX_MAP.items():
                total_api_calls += 1
                res = collect_tax_data(cookies, tax_name, tax_code, start_dt, end_dt, 
                                       biz_no=biz_no, pubc_user_no=pubc_user_no)
                
                if res.get("status") == "success" and res.get("count", 0) > 0:
                    # 세목별 폴더 생성
                    tax_dir = OUTPUT_DIR / "full_scale_test"
                    if not tax_dir.exists():
                        tax_dir.mkdir(parents=True)
                    
                    # 전체 기간 결과 저장
                    filename = f"DATA_{biz_no}_{tax_name}_{start_dt}_{end_dt}.json"
                    filepath = tax_dir / filename
                    with open(filepath, "w", encoding="utf-8") as f:
                        json.dump(res, f, ensure_ascii=False, indent=2)
                    
                    # 월별로 분리하여 저장 (응답 데이터에 과세연월 정보가 있는 경우)
                    data_rows = res.get("data", [])
                    if data_rows:
                        monthly_data = {}
                        for row in data_rows:
                            tax_month = None
                            for field in ['txnrmYm', 'pymnYm', 'rtnYm', 'sbmsYm']:
                                if field in row and row[field]:
                                    tax_month = row[field]
                                    break
                            
                            if tax_month:
                                if len(str(tax_month)) == 6:
                                    year = int(str(tax_month)[:4])
                                    month = int(str(tax_month)[4:6])
                                    month_key = f"{year}{month:02d}"
                                    
                                    if month_key not in monthly_data:
                                        monthly_data[month_key] = []
                                    monthly_data[month_key].append(row)
                        
                        # 월별 파일 저장
                        for month_key, month_rows in monthly_data.items():
                            year = int(month_key[:4])
                            month = int(month_key[4:6])
                            monthly_filename = f"DATA_{biz_no}_{tax_name}_{year}{month:02d}.json"
                            monthly_res = {
                                "status": "success",
                                "count": len(month_rows),
                                "data": month_rows,
                                "raw": res.get("raw", {})
                            }
                            with open(tax_dir / monthly_filename, "w", encoding="utf-8") as f:
                                json.dump(monthly_res, f, ensure_ascii=False, indent=2)
                            total_collected += len(month_rows)
                elif res.get("status") == "error":
                    error_msg = res.get("error", "알 수 없는 오류")
                    if "과부하" in error_msg or "60초" in error_msg:
                        total_errors += 1
                        if total_errors <= 5:  # 처음 5개만 출력
                            print(f"    ⚠ {tax_name} ({biz_name}): 과부하 제어 발생", flush=True)
    
    elapsed_time = time.time() - start_time
    
    print(f"\n{'='*60}")
    print(f"[전체 규모 테스트 완료]")
    print(f"  - 총 API 호출: {total_api_calls}회")
    print(f"  - 총 수집된 데이터: {total_collected}건")
    print(f"  - 과부하 제어 발생: {total_errors}회")
    print(f"  - 소요 시간: {elapsed_time:.1f}초 ({elapsed_time/60:.1f}분, {elapsed_time/3600:.2f}시간)")
    print(f"  - 평균 호출당 시간: {elapsed_time/total_api_calls:.2f}초")
    print(f"  - 저장 위치: {OUTPUT_DIR / 'full_scale_test'}")
    print(f"  - 조회 세목: {', '.join(TAX_MAP.keys())}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()

