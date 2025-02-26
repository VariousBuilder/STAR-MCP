/**
 * レジリエントエージェントフレームワークのタスク管理モジュール
 */

import { 
  Task, 
  TaskStatus, 
  TaskExecutionOptions, 
  TaskError,
  ErrorType,
  RetryStrategy,
  FallbackStrategy,
  EventType
} from './types';
import ErrorHandler from './error-handler';
import Logger from './logger';
import { v4 as uuidv4 } from 'uuid';

class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private runningTasks: Set<string> = new Set();
  private errorHandler: ErrorHandler;
  private logger: Logger;
  private eventListeners: Map<EventType, Function[]> = new Map();
  private defaultOptions: TaskExecutionOptions = {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    fallbackStrategy: FallbackStrategy.HUMAN_INTERVENTION
  };

  constructor(errorHandler: ErrorHandler, logger: Logger) {
    this.errorHandler = errorHandler;
    this.logger = logger;
    
    // 各イベントタイプのリスナー配列を初期化
    Object.values(EventType).forEach(eventType => {
      this.eventListeners.set(eventType as EventType, []);
    });
  }

  /**
   * 新しいタスクを登録する
   */
  registerTask(taskData: Partial<Task> & { name: string, execute: () => Promise<any> }): string {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      name: taskData.name,
      description: taskData.description || '',
      execute: taskData.execute,
      dependencies: taskData.dependencies || [],
      maxRetries: taskData.maxRetries || this.defaultOptions.maxRetries,
      retryDelay: taskData.retryDelay || this.defaultOptions.retryDelay,
      timeout: taskData.timeout || this.defaultOptions.timeout,
      onSuccess: taskData.onSuccess,
      onError: taskData.onError,
      status: TaskStatus.PENDING,
      retryCount: 0,
    };

    this.tasks.set(taskId, task);
    this.logger.log('info', `Task registered: ${task.name} (${taskId})`);
    this.emitEvent(EventType.TASK_CREATED, task);
    return taskId;
  }

  /**
   * タスクを実行する
   */
  async executeTask(taskId: string, options: TaskExecutionOptions = {}): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // 依存タスクが完了しているか確認
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        const depTask = this.tasks.get(depId);
        if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
          throw new Error(`Dependency not satisfied: ${depId} for task ${taskId}`);
        }
      }
    }

    // タスク実行オプションの設定
    const executionOptions = {
      ...this.defaultOptions,
      ...options
    };

    // タスク状態の更新
    task.status = TaskStatus.RUNNING;
    task.startTime = new Date();
    this.runningTasks.add(taskId);
    this.emitEvent(EventType.TASK_STARTED, task);
    this.logger.log('info', `Task started: ${task.name} (${taskId})`);

    try {
      // タイムアウト付きでタスクを実行
      const result = await this.executeWithTimeout(task.execute, executionOptions.timeout);
      
      // 成功時の処理
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.endTime = new Date();
      this.runningTasks.delete(taskId);
      
      if (task.onSuccess) {
        task.onSuccess(result);
      }
      
      this.logger.log('info', `Task completed: ${task.name} (${taskId})`);
      this.emitEvent(EventType.TASK_COMPLETED, task);
      return result;
    } catch (error) {
      // エラー時の処理
      const errorObj = error as Error;
      const errorType = this.errorHandler.detectErrorType(errorObj);
      
      const taskError: TaskError = {
        id: uuidv4(),
        timestamp: new Date(),
        taskId: task.id,
        taskName: task.name,
        errorType: errorType,
        message: errorObj.message,
        stack: errorObj.stack,
        resolved: false,
        retryCount: task.retryCount
      };
      
      task.error = taskError;
      this.errorHandler.logError(taskError);
      
      if (task.onError) {
        task.onError(errorObj);
      }
      
      // リトライ判定
      if (task.retryCount < (task.maxRetries || executionOptions.maxRetries)) {
        return this.retryTask(task, executionOptions);
      } else {
        // リトライ上限に達した場合
        return this.handleTaskFailure(task, executionOptions);
      }
    }
  }

  /**
   * タスクをリトライする
   */
  private async retryTask(task: Task, options: TaskExecutionOptions): Promise<any> {
    task.status = TaskStatus.RETRYING;
    task.retryCount++;
    
    this.logger.log('info', `Retrying task: ${task.name} (${task.id}), attempt ${task.retryCount}`);
    this.emitEvent(EventType.TASK_RETRYING, task);
    
    // リトライ戦略に基づいて遅延時間を計算
    const delay = this.errorHandler.calculateRetryDelay(
      options.retryStrategy,
      task.retryCount,
      options.retryDelay
    );
    
    // 遅延後にリトライ
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.executeTask(task.id, options);
  }

  /**
   * タスク失敗時の処理
   */
  private async handleTaskFailure(task: Task, options: TaskExecutionOptions): Promise<any> {
    task.status = TaskStatus.FAILED;
    task.endTime = new Date();
    this.runningTasks.delete(task.id);
    
    this.logger.log('error', `Task failed: ${task.name} (${task.id}) after ${task.retryCount} retries`);
    this.emitEvent(EventType.TASK_FAILED, task);
    
    // フォールバック戦略の実行
    switch (options.fallbackStrategy) {
      case FallbackStrategy.SKIP:
        this.logger.log('info', `Skipping failed task: ${task.name} (${task.id})`);
        return null;
        
      case FallbackStrategy.ALTERNATIVE_TASK:
        // 代替タスクがあれば実行
        if (task.error?.resolution) {
          this.logger.log('info', `Executing alternative task for: ${task.name} (${task.id})`);
          // ここに代替タスクのロジックを実装
        }
        return null;
        
      case FallbackStrategy.HUMAN_INTERVENTION:
        // 人間の介入を要求
        task.status = TaskStatus.WAITING_FOR_HUMAN;
        this.logger.log('warn', `Human intervention required for task: ${task.name} (${task.id})`);
        this.emitEvent(EventType.HUMAN_INTERVENTION_REQUIRED, task);
        return null;
        
      default:
        throw new Error(`Task failed: ${task.name} (${task.id})`);
    }
  }

  /**
   * タスクの状態を取得する
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.tasks.get(taskId);
    return task ? task.status : null;
  }

  /**
   * 全てのタスクを取得する
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 特定の状態のタスクを取得する
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * 実行中のタスクを取得する
   */
  getRunningTasks(): Task[] {
    return Array.from(this.runningTasks).map(id => this.tasks.get(id)).filter(Boolean) as Task[];
  }

  /**
   * タスクをキャンセルする
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      return false;
    }
    
    task.status = TaskStatus.CANCELLED;
    task.endTime = new Date();
    this.runningTasks.delete(taskId);
    
    this.logger.log('info', `Task cancelled: ${task.name} (${taskId})`);
    this.emitEvent(EventType.TASK_CANCELLED, task);
    return true;
  }

  /**
   * イベントリスナーを登録する
   */
  addEventListener(type: EventType, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  /**
   * イベントを発行する
   */
  private emitEvent(type: EventType, data: any): void {
    const listeners = this.eventListeners.get(type) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        this.logger.log('error', `Error in event listener for ${type}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * タイムアウト付きでPromiseを実行する
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs) {
      return fn();
    }
    
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      fn().then(
        result => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        error => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }
}

export default TaskManager;
