/**
 * 会話収集ベースクラスと型定義
 */

export interface Conversation {
  id: string;
  source: string;
  title: string;
  url: string;
  content: string;
  date: string;
  metadata?: Record<string, any>;
}

export interface CollectorOptions {
  maxResults?: number;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  browser?: 'chrome' | 'firefox' | 'edge' | 'safari';
  dataDir?: string;
  credentials?: Record<string, string>;
  debug?: boolean;
}

export interface CollectorStats {
  processedCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  duration: number;
  errors: Error[];
}

export abstract class BaseCollector {
  protected options: CollectorOptions;
  protected stats: CollectorStats;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      maxResults: 100,
      debug: false,
      ...options
    };

    this.stats = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      duration: 0,
      errors: []
    };
  }

  /**
   * 会話の収集を実行
   * @returns 収集した会話の配列
   */
  abstract collect(): Promise<Conversation[]>;

  /**
   * 収集の前処理（認証など）
   */
  abstract initialize(): Promise<void>;

  /**
   * 収集の後処理（リソース解放など）
   */
  abstract cleanup(): Promise<void>;

  /**
   * 統計情報の取得
   */
  getStats(): CollectorStats {
    return { ...this.stats };
  }

  /**
   * ソース名の取得
   */
  abstract get sourceName(): string;

  /**
   * 収集プロセスの実行
   */
  async run(): Promise<{
    conversations: Conversation[];
    stats: CollectorStats;
  }> {
    const startTime = Date.now();

    try {
      await this.initialize();
      const conversations = await this.collect();
      await this.cleanup();

      this.stats.duration = Date.now() - startTime;
      return {
        conversations,
        stats: this.getStats()
      };
    } catch (error: any) {
      this.stats.errors.push(error);
      this.stats.duration = Date.now() - startTime;
      console.error(`Error in ${this.sourceName} collector:`, error);
      
      // エラー後のクリーンアップを試みる
      try {
        await this.cleanup();
      } catch (cleanupError) {
        console.error(`Error during cleanup:`, cleanupError);
      }
      
      return {
        conversations: [],
        stats: this.getStats()
      };
    }
  }
}
