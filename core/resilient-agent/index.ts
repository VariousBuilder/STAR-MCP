/**
 * レジリエント（回復力のある）エージェントフレームワーク
 * 
 * このモジュールは、エラーで停止せずに目的達成まで動き続ける
 * AIエージェントのコアフレームワークを提供します。
 */

import { EventEmitter } from 'events';
import { ErrorHandler } from './error-handler.js';
import { TaskManager } from './task-manager.js';
import { Logger } from './logger.js';
import { AgentConfig, AgentOptions, ErrorHandlingStrategy, TaskResult } from './types.js';

export class ResilientAgent extends EventEmitter {
  private config: AgentConfig;
  private errorHandler: ErrorHandler;
  private taskManager: TaskManager;
  private logger: Logger;
  private isRunning: boolean = false;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;
  
  /**
   * レジリエントエージェントを初期化
   * @param options エージェント設定オプション
   */
  constructor(options: AgentOptions) {
    super();
    
    this.config = {
      name: options.name || 'unnamed-agent',
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      errorStrategy: options.errorStrategy || ErrorHandlingStrategy.RETRY,
      reportProgress: options.reportProgress !== false,
      logLevel: options.logLevel || 'info',
      humanApprovalNeeded: options.humanApprovalNeeded || false,
      timeoutMs: options.timeoutMs || 30000,
      ...options
    };
    
    this.logger = new Logger(this.config.name, this.config.logLevel);
    this.errorHandler = new ErrorHandler(this.config, this.logger);
    this.taskManager = new TaskManager(this.config, this.logger, this.errorHandler);
    
    this.logger.info(`エージェント "${this.config.name}" が初期化されました`);
  }
  
  /**
   * エージェントが指定されたタスクを実行
   * @param taskDefinitions 実行するタスク定義の配列
   * @returns タスク実行結果
   */
  async run(taskDefinitions: any[]): Promise<TaskResult[]> {
    if (this.isRunning) {
      throw new Error('エージェントは既に実行中です');
    }
    
    this.isRunning = true;
    this.pauseRequested = false;
    this.stopRequested = false;
    
    this.logger.info(`エージェントが ${taskDefinitions.length} 個のタスクを開始します`);
    this.emit('start', { taskCount: taskDefinitions.length });
    
    try {
      // タスクマネージャーにタスクを登録
      this.taskManager.setTasks(taskDefinitions);
      
      // タスクを実行
      const results = await this.taskManager.executeTasks((progress) => {
        if (this.config.reportProgress) {
          this.emit('progress', progress);
        }
        
        if (this.stopRequested) {
          this.logger.info('停止リクエストにより実行を中断します');
          return 'stop';
        }
        
        if (this.pauseRequested) {
          this.logger.info('一時停止リクエストにより実行を一時停止します');
          return 'pause';
        }
        
        return 'continue';
      });
      
      this.logger.info(`エージェントがすべてのタスクを完了しました`);
      this.emit('complete', { results });
      return results;
    } catch (error) {
      this.logger.error(`エージェント実行中にエラーが発生しました: ${error}`);
      this.emit('error', { error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * エージェントの実行を一時停止
   */
  pause(): void {
    if (!this.isRunning) {
      this.logger.warn('エージェントは実行中ではないため一時停止できません');
      return;
    }
    
    this.pauseRequested = true;
    this.logger.info('エージェントの一時停止をリクエストしました');
    this.emit('pause-requested');
  }
  
  /**
   * 一時停止したエージェントを再開
   */
  resume(): void {
    if (!this.isRunning || !this.pauseRequested) {
      this.logger.warn('エージェントは一時停止していないため再開できません');
      return;
    }
    
    this.pauseRequested = false;
    this.logger.info('エージェントの実行を再開します');
    this.emit('resume');
    
    // タスクマネージャーに再開を通知
    this.taskManager.resumeExecution();
  }
  
  /**
   * エージェントの実行を停止
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('エージェントは実行中ではないため停止できません');
      return;
    }
    
    this.stopRequested = true;
    this.logger.info('エージェントの停止をリクエストしました');
    this.emit('stop-requested');
  }
  
  /**
   * 現在の実行状態を取得
   * @returns 現在の実行状態
   */
  getStatus(): any {
    return {
      name: this.config.name,
      isRunning: this.isRunning,
      isPaused: this.pauseRequested,
      isStopRequested: this.stopRequested,
      currentTasks: this.taskManager.getCurrentTaskStatus(),
      completedTaskCount: this.taskManager.getCompletedTaskCount(),
      totalTaskCount: this.taskManager.getTotalTaskCount(),
      errorCount: this.errorHandler.getErrorCount()
    };
  }
}

// 型とクラスをエクスポート
export * from './types.js';
export { ErrorHandler } from './error-handler.js';
export { TaskManager } from './task-manager.js';
export { Logger } from './logger.js';
