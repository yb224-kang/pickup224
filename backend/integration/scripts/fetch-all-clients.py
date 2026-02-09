"""
저장된 모든 인증서의 홈택스 수임거래처 조회
get-session-with-permission.py를 재사용하여 완전한 SSO 패턴 적용
"""
import sys
import json
import subprocess
import os
from pathlib import Path

def main():
    # 저장된 인증서 정보와 비밀번호 받기 (JSON 형식)
    saved_certs_json = sys.argv[1] if len(sys.argv) > 1 else '[]'
    saved_certs = json.loads(saved_certs_json)
    
    all_clients = []
    errors = []
    
    # get-session-with-permission.py 경로
    script_path = Path(__file__).parent / 'get-session-with-permission.py'
    
    for cert_info in saved_certs:
        cert_path = cert_info.get('path')
        cert_name = cert_info.get('name', cert_path)
        password = cert_info.get('password')
        
        if not cert_path or not password:
            errors.append({
                'cert': cert_name,
                'error': '인증서 경로 또는 비밀번호가 없습니다.'
            })
            continue
        
        try:
            # get-session-with-permission.py를 subprocess로 실행
            # 이 스크립트는 완전한 SSO 패턴과 거래처 조회를 포함
            env = os.environ.copy()
            if 'AXCEL_ENCRYPTION_KEY' not in env:
                env['AXCEL_ENCRYPTION_KEY'] = ''
            
            result = subprocess.run(
                ['python3', str(script_path), cert_path, password],
                capture_output=True,
                text=True,
                timeout=120,  # 2분 타임아웃
                env=env
            )
            
            # stdout에서 JSON 파싱 시도 (성공/실패 모두 JSON 형식)
            # stdout에 JSON 외 데이터가 섞일 수 있으므로 JSON 부분만 추출
            try:
                stdout_clean = result.stdout.strip()
                
                # JSON 객체 시작과 끝 찾기
                json_start = stdout_clean.find('{')
                json_end = stdout_clean.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = stdout_clean[json_start:json_end]
                    output = json.loads(json_str)
                else:
                    # JSON을 찾을 수 없으면 전체를 시도
                    output = json.loads(stdout_clean)
                
                if result.returncode == 0:
                    # API 호출 성공 여부 확인 (빈 배열도 성공으로 처리)
                    if output.get('apiSuccess'):
                        clients = output.get('clients', [])
                        
                        # 인증서 정보 추가
                        for client in clients:
                            client['_sourceCert'] = cert_name
                            client['_sourcePath'] = cert_path
                        
                        all_clients.extend(clients)
                        print(f"[SUCCESS] {cert_name}: {len(clients)}개 거래처 조회 성공", file=sys.stderr)
                    else:
                        # API 호출 실패
                        error_msg = output.get('apiError') or output.get('permissionError') or output.get('error') or '거래처 조회 실패'
                        errors.append({
                            'cert': cert_name,
                            'error': error_msg
                        })
                        print(f"[WARNING] {cert_name}: {error_msg}", file=sys.stderr)
                else:
                    # returncode != 0: 에러 발생
                    error_msg = output.get('error', '알 수 없는 오류')
                    errors.append({
                        'cert': cert_name,
                        'error': error_msg[:200]  # 처음 200자만
                    })
                    print(f"[ERROR] {cert_name}: {error_msg[:200]}", file=sys.stderr)
                    
            except json.JSONDecodeError as e:
                # JSON 파싱 실패
                error_output = result.stderr or result.stdout or '알 수 없는 오류'
                errors.append({
                    'cert': cert_name,
                    'error': f'응답 파싱 실패: {str(e)}'
                })
                print(f"[ERROR] {cert_name}: JSON 파싱 실패", file=sys.stderr)
                print(f"[ERROR] 출력: {error_output[:500]}", file=sys.stderr)
                
        except subprocess.TimeoutExpired:
            errors.append({
                'cert': cert_name,
                'error': '타임아웃 (120초 초과)'
            })
            print(f"[ERROR] {cert_name}: 타임아웃", file=sys.stderr)
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            errors.append({
                'cert': cert_name,
                'error': error_msg
            })
            print(f"[ERROR] {cert_name}: {error_msg}", file=sys.stderr)
            print(f"[ERROR] {traceback.format_exc()}", file=sys.stderr)
    
    # 결과 출력
    result = {
        'clients': all_clients,
        'totalCount': len(all_clients),
        'errors': errors,
        'successCount': len(saved_certs) - len(errors),
        'totalCertCount': len(saved_certs)
    }
    
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
