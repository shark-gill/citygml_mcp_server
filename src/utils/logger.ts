/**
 * 간단한 로깅 유틸리티
 * 로그 수준에 따라 콘솔에 출력
 */

// 로그 수준 정의
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// 로거 클래스
class Logger {
  private level: LogLevel = LogLevel.INFO;
  
  /**
   * 로그 수준 설정
   * @param level 로그 수준
   */
  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      switch (level.toLowerCase()) {
        case 'error': this.level = LogLevel.ERROR; break;
        case 'warn': this.level = LogLevel.WARN; break;
        case 'info': this.level = LogLevel.INFO; break;
        case 'debug': this.level = LogLevel.DEBUG; break;
        default: this.level = LogLevel.INFO;
      }
    } else {
      this.level = level;
    }
  }
  
  /**
   * 현재 로그 수준 조회
   */
  getLevel(): LogLevel {
    return this.level;
  }
  
  /**
   * 에러 수준 로그 출력
   */
  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }
  
  /**
   * 경고 수준 로그 출력
   */
  warn(message: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }
  
  /**
   * 정보 수준 로그 출력
   */
  info(message: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, data || '');
    }
  }
  
  /**
   * 디버그 수준 로그 출력
   */
  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }
  
  /**
   * 시간 측정 시작
   */
  time(label: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.time(label);
    }
  }
  
  /**
   * 시간 측정 종료 및 출력
   */
  timeEnd(label: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.timeEnd(label);
    }
  }
}

// 싱글톤 로거 인스턴스 생성 및 내보내기
export const logger = new Logger();

// 로그 수준도 내보내기
export { LogLevel }; 