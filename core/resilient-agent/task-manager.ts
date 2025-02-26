/**
 * タスク管理モジュール
 */

import { AgentConfig, TaskDefinition, TaskProgress, TaskResult, TaskStatus } from './types.js';
import { Logger } from './logger.js';
import { ErrorHandler } from './error-handler.js';

export class TaskManager {
  private config: AgentConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private tasks: TaskDefinition[] = [];
  private results: TaskResult[] = [];
  private currentTaskIndex: number = 0;
  private pausePromise: { resolve: Function, reject: Function } | null = null;
  
  constructor(config: AgentConfig, logger: Logger, errorHandler: ErrorHandler) {
    this.config = config;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }
  
  /**
   * タスクを設定
   * @param tasks タスク定義の配列
   */
  setTasks(tasks: TaskDefinition[]): void {
    this.tasks = [...tasks];
    this.results = [];
    this.currentTaskIndex = 0;
    this.logger.debug(`${tasks.length} 個のタスクを設定しました`);
  }
  
  /**
   * タスクの実行
   * @param progressCallback 進捗報告用コールバック
   * @returns タスク実行結果の配列
   */
  async executeTasks(
    progressCallback?: (progress: TaskProgress) => 'continue' | 'pause' | 'stop'
  ): Promise<TaskResult[]> {
    if (this.tasks.length === 0) {
      this.logger.warn('実行するタスクがありません');
      return [];
    }
    
    this.logger.info(`${this.tasks.length} 個のタスク実行を開始します`);
    
    for (let i = 0; i < this.tasks.length; i++) {
      this.currentTaskIndex = i;
      const task = this.tasks[i];
      
      // 進捗報告
      if (progressCallback) {
        const progress: TaskProgress = {
          totalTasks: this.tasks.length,
          completedTasks: i,
          currentTask: {
            index: i,
            name: task.name,
            status: TaskStatus.PENDING
          },
          results: [...this.results]
        };
        
        const action = progressCallback(progress);
        if (action === 'stop') {
          this.logger.info('タスク実行が停止されました');
          break;
        } else if (action === 'pause') {
          this.logger.info('タスク実行が一時停止されました');
          await this.waitForResume();
        }
      }
      
      try {
        // タスクの実行
        this.logger.info(`タスク ${i + 1}/${this.tasks.length} '${task.name}' を実行します`);
        
        let taskResult: TaskResult;
        let retryCount = 0;
        let executionSuccess = false;
        
        while (!executionSuccess && retryCount <= this.config.maxRetries) {
          try {
            // タスク実行前に進捗報告
            if (progressCallback) {
              const progress: TaskProgress = {
                totalTasks: this.tasks.length,
                completedTasks: i,
                currentTask: {
                  index: i,
                  name: task.name,
                  status: retryCount > 0 ? TaskStatus.RETRYING : TaskStatus.RUNNING
                },
                results: [...this.results]
              };
              
              const action = progressCallback(progress);
              if (action === 'stop') {
                this.logger.info('タスク実行が停止されました');
                return this.results;
              } else if (action === 'pause') {
                this.logger.info('タスク実行が一時停止されました');
                await this.waitForResume();
              }
            }
            
            // タスク実行
            const startTime = Date.now();
            const result = await this.executeTask(task);
            const endTime = Date.now();
            
            taskResult = {
              taskName: task.name,
              success: true,
              result: result,
              error: null,
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime).toISOString(),
              duration: endTime - startTime,
              retryCount
            };
            
            executionSuccess = true;
          } catch (error: any) {
            // エラー処理
            this.logger.error(`タスク '${task.name}' の実行中にエラーが発生しました: ${error.message}`);
            
            const context = {
              task,
              retryCount,
              taskIndex: i
            };
            
            const errorResult = await this.errorHandler.handleError(error, context, retryCount);
            
            if (errorResult.handled) {
              // エラーが処理された場合
              taskResult = {
                taskName: task.name,
                success: true,
                result: errorResult.result || { handled: true },
                error: null,
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: 0,
                retryCount,
                handledError: {
                  message: error.message,
                  name: error.name
                }
              };
              
              executionSuccess = true;
            } else if (errorResult.shouldRetry && retryCount < this.config.maxRetries) {
              // リトライする場合
              retryCount++;
              this.logger.info(`タスク '${task.name}' を ${retryCount}/${this.config.maxRetries} 回目のリトライします`);
              
              // リトライ前の遅延
              await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
            } else if (errorResult.shouldAskHuman) {
              // 人間の介入が必要な場合
              this.logger.warn(`タスク '${task.name}' は人間の介入が必要です`);
              
              if (this.config.humanApprovalNeeded) {
                // 人間の介入を待つ
                this.logger.info('人間の介入を待っています...');
                // 実際の実装では、ここで人間への通知や入力待ちを行う
                
                taskResult = {
                  taskName: task.name,
                  success: false,
                  result: null,
                  error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                  },
                  startTime: new Date().toISOString(),
                  endTime: new Date().toISOString(),
                  duration: 0,
                  retryCount,
                  status: TaskStatus.NEEDS_HUMAN_INTERVENTION
                };
                
                executionSuccess = true; // 人間の介入を求めたので処理としては完了
              } else {
                // 人間の介入を求めず失敗とする
                taskResult = {
                  taskName: task.name,
                  success: false,
                  result: null,
                  error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                  },
                  startTime: new Date().toISOString(),
                  endTime: new Date().toISOString(),
                  duration: 0,
                  retryCount,
                  status: TaskStatus.FAILED
                };
                
                executionSuccess = true; // 失敗として処理完了
              }
            } else {
              // それ以外の場合は失敗として扱う
              taskResult = {
                taskName: task.name,
                success: false,
                result: null,
                error: {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                },
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: 0,
                retryCount,
                status: TaskStatus.FAILED
              };
              
              executionSuccess = true; // 失敗として処理完了
            }
          }
        }
        
        // タスク結果を記録
        this.results.push(taskResult!);
        
        // タスク実行後の進捗報告
        if (progressCallback) {
          const progress: TaskProgress = {
            totalTasks: this.tasks.length,
            completedTasks: i + 1,
            currentTask: {
              index: i,
              name: task.name,
              status: taskResult!.success ? TaskStatus.COMPLETED : TaskStatus.FAILED
            },
            results: [...this.results]
          };
          
          const action = progressCallback(progress);
          if (action === 'stop') {
            this.logger.info('タスク実行が停止されました');
            break;
          } else if (action === 'pause') {
            this.logger.info('タスク実行が一時停止されました');
            await this.waitForResume();
          }
        }
        
        // 失敗したタスクが続行不可の場合は中断
        if (!taskResult!.success && task.continueOnFailure === false) {
          this.logger.warn(`タスク '${task.name}' が失敗し、続行オプションが無効なため実行を中断します`);
          break;
        }
      } catch (error: any) {
        // タスク実行中の予期しないエラー
        this.logger.error(`タスク ${i + 1}/${this.tasks.length} '${task.name}' の実行中に予期しないエラーが発生しました: ${error.message}`);
        
        // エラー結果を記録
        this.results.push({
          taskName: task.name,
          success: false,
          result: null,
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 0,
          retryCount: 0,
          status: TaskStatus.FAILED
        });
        
        // 続行不可の場合は中断
        if (task.continueOnFailure === false) {
          this.logger.warn(`タスク '${task.name}' が失敗し、続行オプションが無効なため実行を中断します`);
          break;
        }
      }
    }
    
    this.logger.info(`${this.results.filter(r => r.success).length}/${this.results.length} 個のタスクが成功しました`);
    return this.results;
  }
  
  /**
   * 一時停止した実行を再開
   */
  resumeExecution(): void {
    if (this.pausePromise) {
      const { resolve } = this.pausePromise;
      this.pausePromise = null;
      resolve();
    }
  }
  
  /**
   * 現在のタスク状態を取得
   */
  getCurrentTaskStatus(): any {
    if (this.currentTaskIndex >= 0 && this.currentTaskIndex < this.tasks.length) {
      const task = this.tasks[this.currentTaskIndex];
      return {
        index: this.currentTaskIndex,
        name: task.name,
        status: this.pausePromise ? TaskStatus.PAUSED : TaskStatus.RUNNING
      };
    }
    return null;
  }
  
  /**
   * 完了したタスク数を取得
   */
  getCompletedTaskCount(): number {
    return this.results.length;
  }
  
  /**
   * 全タスク数を取得
   */
  getTotalTaskCount(): number {
    return this.tasks.length;
  }
  
  /**
   * 単一のタスクを実行
   * @param task 実行するタスク
   * @returns タスク実行結果
   */
  private async executeTask(task: TaskDefinition): Promise<any> {
    // タスクタイムアウトの処理
    const timeout = task.timeoutMs || this.config.timeoutMs;
    
    if (timeout) {
      return new Promise(async (resolve, reject) => {
        // タイムアウトタイマーを設定
        const timer = setTimeout(() => {
          reject(new Error(`タスク '${task.name}' がタイムアウトしました (${timeout}ms)`));
        }, timeout);
        
        try {
          // タスクを実行
          const result = await task.execute();
          clearTimeout(timer);
          resolve(result);
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
    } else {
      // タイムアウトなしでタスクを実行
      return task.execute();
    }
  }
  
  /**
   * 再開を待つ
   */
  private waitForResume(): Promise<void> {
    if (this.pausePromise) {
      return Promise.reject(new Error('すでに一時停止中です'));
    }
    
    return new Promise((resolve, reject) => {
      this.pausePromise = { resolve, reject };
    });
  }
}
