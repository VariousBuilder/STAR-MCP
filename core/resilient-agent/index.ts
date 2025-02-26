/**
 * レジリエントエージェントフレームワークのメインモジュール
 */

import ErrorHandler from './error-handler';
import TaskManager from './task-manager';
import Logger from './logger';
import { 
  Task, 
  TaskStatus, 
  TaskExecutionOptions, 
  TaskError,
  ErrorType,
  RetryStrategy,
  FallbackStrategy,
  LogLevel,
  EventType
} from './types';
import path from 'path';

class ResilientAgent {
  private errorHandler: ErrorHandler;
  private taskManager: TaskManager;
  private logger: Logger;
  
  constructor(options: {
    logDir?: string;
    logLevel?: LogLevel;
    logToConsole?: boolean;
  } = {}) {
    // 共有ディレクトリパスの設定
    const sharedDir = process.env.SHARED_MCP_DATA || path.join(process.cwd(), 'shared');
    const logDir = options.logDir || path.join(sharedDir, 'logs');
    
    // コンポーネントの初期化
    this.logger = new Logger({
      logDir,
      logLevel: options.logLevel || LogLevel.INFO,
      logToConsole: options.logToConsole
    });
    
    this.errorHandler = new ErrorHandler(logDir);
    this.taskManager = new TaskManager(this.errorHandler, this.logger);
    
    this.logger.info('ResilientAgent initialized', { logDir });
  }

  /**
   * タスクを作成して実行する
   */
  async executeTask(
    taskName: string,
    taskFn: () => Promise<any>,
    options: {
      description?: string;
      dependencies?: string[];
      executionOptions?: TaskExecutionOptions;
    } = {}
  ): Promise<any> {
    this.logger.info(`Creating task: ${taskName}`);
    
    const taskId = this.taskManager.registerTask({
      name: taskName,
      description: options.description,
      dependencies: options.dependencies,
      execute: taskFn
    });
    
    try {
      this.logger.info(`Executing task: ${taskName} (${taskId})`);
      const result = await this.taskManager.executeTask(taskId, options.executionOptions);
      this.logger.info(`Task completed: ${taskName} (${taskId})`);
      return result;
    } catch (error) {
      this.logger.error(`Task execution failed: ${taskName} (${taskId})`, {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 複数のタスクを順次実行する
   */
  async executeSequence(
    tasks: Array<{
      name: string;
      fn: () => Promise<any>;
      description?: string;
    }>,
    options: TaskExecutionOptions = {}
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.executeTask(task.name, task.fn, {
          description: task.description,
          executionOptions: options
        });
        results.push(result);
      } catch (error) {
        this.logger.error(`Sequence execution stopped at task: ${task.name}`, {
          error: (error as Error).message
        });
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 複数のタスクを並列実行する
   */
  async executeParallel(
    tasks: Array<{
      name: string;
      fn: () => Promise<any>;
      description?: string;
    }>,
    options: TaskExecutionOptions & {
      maxConcurrent?: number;
      failFast?: boolean;
    } = {}
  ): Promise<any[]> {
    const maxConcurrent = options.maxConcurrent || 0; // 0は制限なし
    const failFast = options.failFast !== undefined ? options.failFast : true;
    
    // 全てのタスクを登録
    const taskIds = tasks.map(task => 
      this.taskManager.registerTask({
        name: task.name,
        description: task.description,
        execute: task.fn
      })
    );
    
    if (maxConcurrent <= 0 || maxConcurrent >= tasks.length) {
      // 全てのタスクを並列実行
      try {
        const promises = taskIds.map(id => 
          this.taskManager.executeTask(id, options)
        );
        
        if (failFast) {
          return await Promise.all(promises);
        } else {
          // エラーが発生してもすべてのタスクを完了する
          const results = await Promise.allSettled(promises);
          return results.map(result => {
            if (result.status === 'fulfilled') {
              return result.value;
            } else {
              this.logger.warn(`Task failed in parallel execution: ${result.reason}`);
              return null;
            }
          });
        }
      } catch (error) {
        this.logger.error(`Parallel execution failed`, {
          error: (error as Error).message
        });
        throw error;
      }
    } else {
      // 並列度を制限して実行
      const results: any[] = new Array(tasks.length).fill(null);
      let completedCount = 0;
      let failedError: Error | null = null;
      
      // タスクの塊ごとに処理
      for (let i = 0; i < taskIds.length; i += maxConcurrent) {
        const chunk = taskIds.slice(i, i + maxConcurrent);
        const chunkPromises = chunk.map((id, index) => {
          return this.taskManager.executeTask(id, options)
            .then(result => {
              results[i + index] = result;
              completedCount++;
              return result;
            })
            .catch(error => {
              if (failFast && !failedError) {
                failedError = error;
              }
              this.logger.error(`Task failed in chunk: ${tasks[i + index].name}`, {
                error: error.message
              });
              return Promise.reject(error);
            });
        });
        
        try {
          if (failFast) {
            await Promise.all(chunkPromises);
            if (failedError) {
              throw failedError;
            }
          } else {
            await Promise.allSettled(chunkPromises);
          }
        } catch (error) {
          if (failFast) {
            throw error;
          }
        }
      }
      
      this.logger.info(`Parallel execution completed: ${completedCount}/${tasks.length} tasks successful`);
      return results;
    }
  }

  /**
   * 実行中のタスクをキャンセルする
   */
  cancelTask(taskId: string): boolean {
    return this.taskManager.cancelTask(taskId);
  }

  /**
   * タスクの状態を取得する
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    return this.taskManager.getTaskStatus(taskId);
  }
  
  /**
   * 実行中のタスクのリストを取得する
   */
  getRunningTasks(): Task[] {
    return this.taskManager.getRunningTasks();
  }
  
  /**
   * 全てのタスクの一覧を取得する
   */
  getAllTasks(): Task[] {
    return this.taskManager.getAllTasks();
  }
  
  /**
   * ログレベルを設定する
   */
  setLogLevel(level: LogLevel): void {
    this.logger.setLogLevel(level);
  }
  
  /**
   * イベントリスナーを登録する
   */
  addEventListener(type: EventType, listener: (data: any) => void): void {
    this.taskManager.addEventListener(type, listener);
  }
  
  /**
   * エラーハンドラーを取得する
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }
  
  /**
   * タスクマネージャーを取得する
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
  
  /**
   * ロガーを取得する
   */
  getLogger(): Logger {
    return this.logger;
  }
}

export default ResilientAgent;
export {
  ErrorHandler,
  TaskManager,
  Logger,
  TaskStatus,
  ErrorType,
  RetryStrategy,
  FallbackStrategy,
  LogLevel,
  EventType
};
