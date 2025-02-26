/**
 * ロギングモジュール
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private name: string;
  private level: LogLevel;
  private logs: Array<{
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
  }> = [];
  
  constructor(name: string, level: LogLevel = 'info') {
    this.name = name;
    this.level = level;
  }
  
  /**
   * デバッグレベルのログを出力
   * @param message ログメッセージ
   * @param data 追加データ（オプション）
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
  
  /**
   * 情報レベルのログを出力
   * @param message ログメッセージ
   * @param data 追加データ（オプション）
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  /**
   * 警告レベルのログを出力
   * @param message ログメッセージ
   * @param data 追加データ（オプション）
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  /**
   * エラーレベルのログを出力
   * @param message ログメッセージ
   * @param data 追加データ（オプション）
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  /**
   * ログレベルを設定
   * @param level 新しいログレベル
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  /**
   * ログ履歴を取得
   * @returns ログ履歴の配列
   */
  getLogs(): Array<{
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
  }> {
    return [...this.logs];
  }
  
  /**
   * 指定されたレベルのログを出力
   * @param level ログレベル
   * @param message ログメッセージ
   * @param data 追加データ（オプション）
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // レベルチェック
    if (!this.shouldLog(level)) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    
    // ログをメモリに保存
    this.logs.push(logEntry);
    
    // コンソールに出力
    const formattedMessage = this.formatLogMessage(timestamp, level, message);
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
    
    // データが存在する場合は出力
    if (data) {
      if (level === 'error' || level === 'warn') {
        console.error(data);
      } else {
        console.log(data);
      }
    }
  }
  
  /**
   * 指定されたレベルがログ出力対象かチェック
   * @param level チェックするログレベル
   * @returns ログ出力対象かどうか
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex >= configLevelIndex;
  }
  
  /**
   * ログメッセージをフォーマット
   * @param timestamp タイムスタンプ
   * @param level ログレベル
   * @param message ログメッセージ
   * @returns フォーマットされたログメッセージ
   */
  private formatLogMessage(timestamp: string, level: LogLevel, message: string): string {
    return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}`;
  }
}
