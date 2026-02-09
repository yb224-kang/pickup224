"""
모든 모듈을 export하는 메인 인덱스 파일
"""

# 3. 조회된 인증서의 파일에서 유효기간등 유추
try:
    from .certificate.metadata.infer import infer_metadata_from_file
except ImportError:
    from certificate.metadata.infer import infer_metadata_from_file

# 4. 인증서 파싱 (비밀번호 입력전)
try:
    from .certificate.parsing.without_password import parse_certificate_without_password
except ImportError:
    from certificate.parsing.without_password import parse_certificate_without_password

# 5. 인증서 파싱 (비밀번호 입력후)
try:
    from .certificate.parsing.with_password import parse_certificate_with_password
except ImportError:
    from certificate.parsing.with_password import parse_certificate_with_password

# 7. 인증서 로그인
try:
    from .hometax.auth.login import login_with_certificate
except ImportError:
    from hometax.auth.login import login_with_certificate

# 8. 인증서 로그인 후 추가 쿠키획득
try:
    from .hometax.auth.session import fetch_additional_cookies
except ImportError:
    from hometax.auth.session import fetch_additional_cookies

__all__ = [
    'infer_metadata_from_file',
    'parse_certificate_without_password',
    'parse_certificate_with_password',
    'login_with_certificate',
    'fetch_additional_cookies',
]

