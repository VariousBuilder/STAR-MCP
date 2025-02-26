/**
 * レジリエントエージェントタイプ定義
 */

import { LogLevel } from './logger.js';

/**
 * エラー処理戦略
 */
export enum ErrorHandlingStrategy {
  /** エラーを無視して続行 */
  IGNORE = 'ignore',
  
  /** エラー発生時にリトライ */
  RETRY = 'retry',
  
  /** エラー発生時に人間に介入を求める */
  ASK_HUMAN = 'ask_human',
  
  /** エラーパターンに応じて最適な処理を試みる */
  SMART = 'smart'
}

/**
 * タスク状態
 */
export enum TaskStatus {
  /** 実行待ち */
  PENDING = 'pending',
  
  /** 実行中 */
  RUNNING = 'running',
  
  /** リトライ中 */
  RETRYING = 'retrying',
  
  /** 一時停止中 */
  PAUSED = 'paused',
  
  /** 完了 */
  COMPLETED = 'completed',
  
  /** 失敗 */
  FAILED = 'failed',
  
  /** 人間の介入が必要 */
  NEEDS_HUMAN_INTERVENTION = 'needs_human_intervention'
}

/**
 * エージェント設定
 */
export interface AgentConfig {
  /** エージェント名 */
  name: string;
  
  /** 最大リトライ回数 */
  maxRetries: number;
  
  /** リトライ間の遅延（ミリ秒） */
  retryDelay: number;
  
  /** エラー処理戦略 */
  errorStrategy: ErrorHandlingStrategy;
  
  /** 進捗報告を行うかどうか */
  reportProgress: boolean;
  
  /** ログレベル */
  logLevel: LogLevel;
  
  /** 人間の承認が必要かどうか */
  humanApprovalNeeded: boolean;
  
  /** タイムアウト（ミリ秒） */
  timeoutMs: number;
  
  /** その他の設定 */
  [key: string]: any;
}

/**
 * エージェントオプション
 */
export interface AgentOptions {
  /** エージェント名 */
  name?: string;
  
  /** 最大リトライ回数 */
  maxRetries?: number;
  
  /** リトライ間の遅延（ミリ秒） */
  retryDelay?: number;
  
  /** エラー処理戦略 */
  errorStrategy?: ErrorHandlingStrategy;
  
  /** 進捗報告を行うかどうか */
  reportProgress?: boolean;
  
  /** ログレベル */
  logLevel?: LogLevel;
  
  /** 人間の承認が必要かどうか */
  humanApprovalNeeded?: boolean;
  
  /** タイムアウト（ミリ秒） */
  timeoutMs?: number;
  
  /** その他のオプション */
  [key: string]: any;
}

/**
 * タスク定義
 */
export interface TaskDefinition {
  /** タスク名 */
  name: string;
  
  /** タスク実行関数 */
  execute: () => Promise<any>;
  
  /** 失敗時に続行するかどうか */
  continueOnFailure?: boolean;
  
  /** タスク固有のタイムアウト（ミリ秒） */
  timeoutMs?: number;
  
  /** タスク固有のメタデータ */
  metadata?: Record<string, any>;
}

/**
 * タスク実行結果
 */
export interface TaskResult {
  /** タスク名 */
  taskName: string;
  
  /** 成功したかどうか */
  success: boolean;
  
  /** タスク結果 */
  result: any;
  
  /** エラー情報 */
  error: {
    message: string;
    name: string;
    stack?: string;
  } | null;
  
  /** 開始時刻 */
  startTime: string;
  
  /** 終了時刻 */
  endTime: string;
  
  /** 実行時間（ミリ秒） */
  duration: number;
  
  /** リトライ回数 */
  retryCount: number;
  
  /** タスク状態 */
  status?: TaskStatus;
  
  /** 処理されたエラー情報 */
  handledError?: {
    message: string;
    name: string;
  };
}

/**
 * タスク進捗情報
 */
export interface TaskProgress {
  /** 全タスク数 */
  totalTasks: number;
  
  /** 完了タスク数 */
  completedTasks: number;
  
  /** 現在のタスク情報 */
  currentTask: {
    /** タスクインデックス */
    index: number;
    
    /** タスク名 */
    name: string;
    
    /** タスク状態 */
    status: TaskStatus;
  };
  
  /** これまでの結果 */
  results: TaskResult[];
}

/**
 * エラー記録
 */
export interface ErrorRecord {
  /** エラーID */
  id: string;
  
  /** タイムスタンプ */
  timestamp: string;
  
  /** エラー情報 */
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  
  /** エラー発生時のコンテキスト */
  context: any;
  
  /** エラーパターン */
  pattern: string;
  
  /** 解決したかどうか */
  resolved: boolean;
  
  /** 解決方法 */
  resolution?: string;
}
