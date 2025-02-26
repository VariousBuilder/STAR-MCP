/**
 * レジリエントエージェントフレームワークの型定義
 */

// タスクの状態
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
  WAITING_FOR_HUMAN = 'waiting_for_human'
}

// エラータイプ
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

// タスク定義インターフェース
export interface Task {
  id: string;
  name: string;
  description?: string;
  execute: () => Promise<any>;
  dependencies?: string[];
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  status: TaskStatus;
  result?: any;
  error?: TaskError;
  retryCount: number;
  startTime?: Date;
  endTime?: Date;
}

// タスクエラー記録
export interface TaskError {
  id: string;
  timestamp: Date;
  taskId: string;
  taskName: string;
  errorType: ErrorType;
  message: string;
  stack?: string;
  resolution?: string;
  resolved: boolean;
  retryCount: number;
}

// タスク実行オプション
export interface TaskExecutionOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  retryStrategy?: RetryStrategy;
  fallbackStrategy?: FallbackStrategy;
  logLevel?: LogLevel;
}

// リトライ戦略
export enum RetryStrategy {
  IMMEDIATE = 'immediate',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  CUSTOM = 'custom'
}

// フォールバック戦略
export enum FallbackStrategy {
  SKIP = 'skip',
  ALTERNATIVE_TASK = 'alternative_task',
  HUMAN_INTERVENTION = 'human_intervention'
}

// ログレベル
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// イベントタイプ
export enum EventType {
  TASK_CREATED = 'task_created',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_RETRYING = 'task_retrying',
  TASK_CANCELLED = 'task_cancelled',
  HUMAN_INTERVENTION_REQUIRED = 'human_intervention_required'
}

// イベントハンドラ
export interface EventHandler {
  type: EventType;
  handler: (data: any) => void;
}
