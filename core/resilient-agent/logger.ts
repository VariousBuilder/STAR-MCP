/**
 * レジリエントエージェントフレームワークのロギングモジュール
 */

import fs from 'fs';
import path from 'path';
import { LogLevel } from './types';

class Logger {
  private logFilePath: string;
  private logLevel: LogLevel;
  private logToConsole: boolean;
  private maxLogSize: number;
  private maxLogFiles: number;

  constructor(options: {
    logDir?: string;
    logLevel?: LogLevel;
    logToConsole?: boolean;
    maxLogSize?: number;
    maxLogFiles?: number;
  } = {}) {
    const logDir = options.logDir || path.join(process.cwd(), 'shared', 'logs');
    this.logLevel = options.logLevel || LogLevel.INFO;
    this.logToConsole = options.logToConsole !== undefined ? options.logToConsole : true;
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;

    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFilePath = path.join(logDir, `app_${this.getFormattedDate()}.log`);
  }

  /**
   * ログを記録する
   */
  log(level: LogLevel, message: string, metadata: object = {}): void {
    // ログレベルチェック
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    const logString = `[${timestamp}] [${level.toUpperCase()}] ${message} ${
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ''
    }`;

    // コンソールにログ出力
    if (this.logToConsole) {
      this.logToConsoleOutput(level, logString);
    }

    // ファイルにログ出力
    this.appendToLogFile(logString);
  }

  /**
   * デバッグログ
   */
  debug(message: string, metadata: object = {}): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * 情報ログ
   */
  info(message: string, metadata: object = {}): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * 警告ログ
   */
  warn(message: string, metadata: object = {}): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * エラーログ
   */
  error(message: string, metadata: object = {}): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * ログレベルを設定する
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * ログファイルをローテーションする
   */
  private rotateLogFileIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return;
      }

      const stats = fs.statSync(this.logFilePath);
      if (stats.size < this.maxLogSize) {
        return;
      }

      // 古いログファイルをローテーション
      const dirName = path.dirname(this.logFilePath);
      const baseName = path.basename(this.logFilePath);
      const ext = path.extname(baseName);
      const nameWithoutExt = baseName.substring(0, baseName.length - ext.length);

      // 既存のログファイルをリネーム
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(dirName, `${nameWithoutExt}.${i}${ext}`);
        const newFile = path.join(dirName, `${nameWithoutExt}.${i + 1}${ext}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // 最大数に達したら古いファイルを削除
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // 現在のログファイルをリネーム
      const newFile = path.join(dirName, `${nameWithoutExt}.1${ext}`);
      fs.renameSync(this.logFilePath, newFile);

    } catch (error) {
      console.error('Error rotating log files:', error);
    }
  }

  /**
   * ログをファイルに追加する
   */
  private appendToLogFile(logString: string): void {
    try {
      this.rotateLogFileIfNeeded();
      fs.appendFileSync(this.logFilePath, logString + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * コンソールにログを出力する
   */
  private logToConsoleOutput(level: LogLevel, logString: string): void {
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      case LogLevel.INFO:
        console.info(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
        console.error(logString);
        break;
    }
  }

  /**
   * 現在のログレベルでログを記録するべきかどうか
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * 現在の日付を取得 (YYYY-MM-DD形式)
   */
  private getFormattedDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

export default Logger;
