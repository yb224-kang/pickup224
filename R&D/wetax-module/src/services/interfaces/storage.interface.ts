/**
 * 파일 저장 서비스 인터페이스
 */
export interface StorageService {
  /**
   * 파일을 저장소에 업로드
   * @param buffer 파일 버퍼
   * @param key 저장소 키 (경로)
   * @param contentType MIME 타입
   * @returns 저장된 파일의 URL 또는 키
   */
  uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string>;

  /**
   * 저장된 파일의 URL 가져오기
   * @param key 저장소 키
   * @returns 파일 URL
   */
  getFileUrl?(key: string): Promise<string>;
}

