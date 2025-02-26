/**
 * レジリエントエージェントフレームワークのエラーハンドリングモジュール
 */

import fs from 'fs';
import path from 'path';
import { ErrorType, TaskError, RetryStrategy } from './types';

class ErrorHandler {
  private errorLogs: TaskError[] = [];
  private logFilePath: string;

  constructor(logDir: string = path.join(process.cwd(), 'shared', 'logs')) {
    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, `error-logs_${this.getFormattedDate()}.json`);
    this.loadErrorLogs();
  }

  /**
   * エラーを記録する
   */
  logError(error: TaskError): void {
    console.error(`Error in task ${error.taskName}: ${error.message}`);
    this.errorLogs.push(error);
    this.saveErrorLogs();
  }

  /**
   * エラーを解決済みとしてマークする
   */
  resolveError(errorId: string, resolution: string): void {
    const errorIndex = this.errorLogs.findIndex(e => e.id === errorId);
    if (errorIndex >= 0) {
      this.errorLogs[errorIndex].resolved = true;
      this.errorLogs[errorIndex].resolution = resolution;
      this.saveErrorLogs();
    }
  }

  /**
   * エラーパターンを認識してタイプを判別する
   */
  detectErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection') || message.includes('socket')) {
      return ErrorType.NETWORK;
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }
    
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('unauthenticated')) {
      return ErrorType.AUTHENTICATION;
    }
    
    if (message.includes('permission') || message.includes('access denied') || message.includes('forbidden')) {
      return ErrorType.PERMISSION;
    }

    if (message.includes('not found') || message.includes('404') || message.includes('does not exist')) {
      return ErrorType.RESOURCE_NOT_FOUND;
    }

    if (message.includes('invalid') || message.includes('validation') || message.includes('schema')) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  /**
   * リトライ遅延時間を計算する
   */
  calculateRetryDelay(strategy: RetryStrategy, retryCount: number, baseDelay: number = 1000): number {
    switch (strategy) {
      case RetryStrategy.IMMEDIATE:
        return 0;
      
      case RetryStrategy.LINEAR:
        return baseDelay * retryCount;
      
      case RetryStrategy.EXPONENTIAL:
        return baseDelay * Math.pow(2, retryCount);
      
      case RetryStrategy.CUSTOM:
        // カスタム戦略の場合は、Fibonacciシーケンスを使用する例
        const fibSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
        const index = retryCount < fibSequence.length ? retryCount : fibSequence.length - 1;
        return baseDelay * fibSequence[index];
      
      default:
        return baseDelay;
    }
  }

  /**
   * 特定のエラータイプのエラーを取得する
   */
  getErrorsByType(errorType: ErrorType): TaskError[] {
    return this.errorLogs.filter(e => e.errorType === errorType);
  }

  /**
   * 未解決のエラーを取得する
   */
  getUnresolvedErrors(): TaskError[] {
    return this.errorLogs.filter(e => !e.resolved);
  }

  /**
   * エラーログファイルから既存のエラーログを読み込む
   */
  private loadErrorLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const fileContents = fs.readFileSync(this.logFilePath, 'utf8');
        const data = JSON.parse(fileContents);
        this.errorLogs = data.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load error logs:', error);
      this.errorLogs = [];
    }
  }

  /**
   * エラーログをファイルに保存する
   */
  private saveErrorLogs(): void {
    try {
      fs.writeFileSync(
        this.logFilePath,
        JSON.stringify(this.errorLogs, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save error logs:', error);
    }
  }

  /**
   * 現在の日付を取得 (YYYY-MM-DD形式)
   */
  private getFormattedDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

export default ErrorHandler;
