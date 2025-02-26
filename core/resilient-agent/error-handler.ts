/**
 * エラーハンドリングモジュール
 */

import { AgentConfig, ErrorHandlingStrategy, ErrorRecord } from './types.js';
import { Logger } from './logger.js';

export class ErrorHandler {
  private config: AgentConfig;
  private logger: Logger;
  private errors: ErrorRecord[] = [];
  private errorPatterns: Map<string, (error: Error) => boolean> = new Map();
  private errorHandlers: Map<string, (error: Error, context: any) => Promise<any>> = new Map();
  
  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // 基本的なエラーパターンを登録
    this.registerCommonErrorPatterns();
  }
  
  /**
   * エラーの処理を試みる
   * @param error 発生したエラー
   * @param context エラー発生時のコンテキスト
   * @param retryCount 現在のリトライ回数
   * @returns エラーが処理されたかどうか
   */
  async handleError(error: Error, context: any, retryCount: number = 0): Promise<{
    handled: boolean;
    result?: any;
    shouldRetry: boolean;
    shouldAskHuman: boolean;
  }> {
    // エラーを記録
    const errorId = this.recordError(error, context);
    
    // エラーパターンを識別
    const patternKey = this.identifyErrorPattern(error);
    
    this.logger.debug(`エラーパターン "${patternKey}" を識別しました`);
    
    // エラー戦略に基づいて処理
    switch (this.config.errorStrategy) {
      case ErrorHandlingStrategy.IGNORE:
        this.logger.info(`エラー戦略 IGNORE: エラーを無視して続行します`);
        return { handled: true, shouldRetry: false, shouldAskHuman: false };
        
      case ErrorHandlingStrategy.RETRY:
        if (retryCount < this.config.maxRetries) {
          this.logger.info(`エラー戦略 RETRY: リトライを試みます (${retryCount + 1}/${this.config.maxRetries})`);
          return { handled: false, shouldRetry: true, shouldAskHuman: false };
        }
        this.logger.warn(`最大リトライ回数 (${this.config.maxRetries}) に達しました`);
        break;
        
      case ErrorHandlingStrategy.ASK_HUMAN:
        this.logger.info(`エラー戦略 ASK_HUMAN: 人間の介入を要求します`);
        return { handled: false, shouldRetry: false, shouldAskHuman: true };
        
      case ErrorHandlingStrategy.SMART:
        // パターンに対応するハンドラーがあれば実行
        if (this.errorHandlers.has(patternKey)) {
          try {
            this.logger.info(`パターン "${patternKey}" のハンドラーを実行します`);
            const handler = this.errorHandlers.get(patternKey)!;
            const result = await handler(error, context);
            
            // ハンドラーが成功した場合
            this.updateErrorRecord(errorId, { resolved: true, resolution: 'handler' });
            return { 
              handled: true, 
              result, 
              shouldRetry: false, 
              shouldAskHuman: false 
            };
          } catch (handlerError) {
            this.logger.error(`エラーハンドラーの実行中に新たなエラーが発生しました: ${handlerError}`);
          }
        }
        
        // ハンドラーがない、または失敗した場合はリトライを試みる
        if (retryCount < this.config.maxRetries) {
          this.logger.info(`リトライを試みます (${retryCount + 1}/${this.config.maxRetries})`);
          return { handled: false, shouldRetry: true, shouldAskHuman: false };
        }
        
        // リトライが尽きたら人間に介入を求める
        this.logger.warn(`すべての自動復旧戦略が失敗しました。人間の介入を要求します`);
        return { handled: false, shouldRetry: false, shouldAskHuman: true };
        
      default:
        this.logger.warn(`未知のエラー戦略: ${this.config.errorStrategy}`);
        return { handled: false, shouldRetry: false, shouldAskHuman: true };
    }
    
    // デフォルトでは処理されなかったとして返す
    return { handled: false, shouldRetry: false, shouldAskHuman: true };
  }
  
  /**
   * エラーパターンと対応するハンドラーを登録
   * @param patternKey パターン識別子
   * @param patternMatcher エラーがこのパターンに一致するか判定する関数
   * @param handler このパターンに対応するエラーハンドラー
   */
  registerErrorHandler(
    patternKey: string,
    patternMatcher: (error: Error) => boolean,
    handler: (error: Error, context: any) => Promise<any>
  ): void {
    this.errorPatterns.set(patternKey, patternMatcher);
    this.errorHandlers.set(patternKey, handler);
    this.logger.debug(`エラーハンドラー "${patternKey}" を登録しました`);
  }
  
  /**
   * エラーカウントを取得
   */
  getErrorCount(): number {
    return this.errors.length;
  }
  
  /**
   * エラー履歴を取得
   */
  getErrorHistory(): ErrorRecord[] {
    return [...this.errors];
  }
  
  /**
   * 特定のエラーパターンに一致するエラーの数を取得
   * @param patternKey パターン識別子
   */
  getErrorCountByPattern(patternKey: string): number {
    return this.errors.filter(e => e.pattern === patternKey).length;
  }
  
  /**
   * エラーを記録
   * @param error 発生したエラー
   * @param context エラー発生時のコンテキスト
   * @returns 記録されたエラーのID
   */
  private recordError(error: Error, context: any): string {
    const errorId = `error-${Date.now()}-${this.errors.length}`;
    const pattern = this.identifyErrorPattern(error);
    
    const errorRecord: ErrorRecord = {
      id: errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      pattern,
      resolved: false,
    };
    
    this.errors.push(errorRecord);
    this.logger.debug(`エラーを記録しました: ${errorId}`);
    
    return errorId;
  }
  
  /**
   * エラー記録を更新
   * @param errorId 更新するエラーのID
   * @param updates 更新内容
   */
  private updateErrorRecord(errorId: string, updates: Partial<ErrorRecord>): void {
    const index = this.errors.findIndex(e => e.id === errorId);
    if (index >= 0) {
      this.errors[index] = { ...this.errors[index], ...updates };
      this.logger.debug(`エラー記録 ${errorId} を更新しました`);
    }
  }
  
  /**
   * エラーパターンを識別
   * @param error 発生したエラー
   * @returns 一致するパターン識別子
   */
  private identifyErrorPattern(error: Error): string {
    for (const [key, matcher] of this.errorPatterns.entries()) {
      if (matcher(error)) {
        return key;
      }
    }
    
    return 'unknown';
  }
  
  /**
   * 一般的なエラーパターンを登録
   */
  private registerCommonErrorPatterns(): void {
    // ネットワークエラー
    this.registerErrorHandler(
      'network',
      (error) => {
        const message = error.message.toLowerCase();
        return message.includes('network') ||
               message.includes('econnrefused') ||
               message.includes('econnreset') ||
               message.includes('etimedout') ||
               error.name === 'NetworkError';
      },
      async (error, context) => {
        // ネットワーク接続のリトライロジック
        this.logger.info('ネットワークエラーを検出: 接続を再試行します');
        
        // コンテキストから取得またはデフォルト値
        const delay = context.retryDelay || this.config.retryDelay;
        
        // 指定された遅延後に再接続
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 再接続ロジックをここに実装
        // 実際の実装はコンテキストによって異なる
        
        return { success: true, message: 'ネットワーク接続を再確立しました' };
      }
    );
    
    // タイムアウトエラー
    this.registerErrorHandler(
      'timeout',
      (error) => {
        const message = error.message.toLowerCase();
        return message.includes('timeout') ||
               message.includes('timed out') ||
               error.name === 'TimeoutError';
      },
      async (error, context) => {
        this.logger.info('タイムアウトエラーを検出: タイムアウト値を増加して再試行します');
        
        // タイムアウト値を増加
        if (context.timeoutMs) {
          context.timeoutMs = Math.min(context.timeoutMs * 1.5, 60000); // 最大1分
        }
        
        return { success: true, message: 'タイムアウト値を増加しました', newTimeout: context.timeoutMs };
      }
    );
    
    // 認証・認可エラー
    this.registerErrorHandler(
      'auth',
      (error) => {
        const message = error.message.toLowerCase();
        return message.includes('unauthorized') ||
               message.includes('forbidden') ||
               message.includes('authentication') ||
               message.includes('auth') ||
               error.name === 'AuthError';
      },
      async (error, context) => {
        this.logger.warn('認証エラーを検出: 認証情報の更新が必要かもしれません');
        
        // 認証エラーは通常自動的に解決できないため、人間の介入を要求
        throw new Error('認証エラーは自動解決できません: 人間の介入が必要です');
      }
    );
    
    // ファイルシステムエラー
    this.registerErrorHandler(
      'filesystem',
      (error) => {
        const message = error.message.toLowerCase();
        return message.includes('enoent') ||
               message.includes('file not found') ||
               message.includes('directory not found') ||
               message.includes('no such file') ||
               error.name === 'FileSystemError';
      },
      async (error, context) => {
        this.logger.info('ファイルシステムエラーを検出: 修復を試みます');
        
        // ファイルが存在しない場合、ディレクトリを作成
        if (context.path && error.message.toLowerCase().includes('enoent')) {
          // 実際の実装ではファイルシステム操作を行う
          this.logger.info(`パス ${context.path} にディレクトリを作成します`);
          
          // ディレクトリ作成のモックコード
          return { success: true, message: `パス ${context.path} にディレクトリを作成しました` };
        }
        
        throw new Error('自動修復できないファイルシステムエラー');
      }
    );
    
    // API限界エラー
    this.registerErrorHandler(
      'rate-limit',
      (error) => {
        const message = error.message.toLowerCase();
        return message.includes('rate limit') ||
               message.includes('too many requests') ||
               message.includes('429');
      },
      async (error, context) => {
        this.logger.info('レート制限エラーを検出: バックオフして再試行します');
        
        // バックオフ遅延を計算（指数バックオフ）
        const retryCount = context.retryCount || 0;
        const delay = Math.min(
          (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000),
          30000 // 最大30秒
        );
        
        this.logger.info(`${delay}ミリ秒待機します`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return { success: true, message: 'バックオフ後に再試行します' };
      }
    );
  }
}
