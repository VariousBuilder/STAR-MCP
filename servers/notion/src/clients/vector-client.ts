/**
 * ベクトルデータベースクライアントクラス
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'pgvector/node';

interface VectorDBClientOptions {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
}

export class VectorDBClient {
  private supabase;
  private openai;
  private tableName: string;
  private embeddingModel: string;
  private initialized: boolean = false;

  constructor(options: VectorDBClientOptions) {
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
    this.tableName = options.tableName || 'notion_vectors';
    this.embeddingModel = options.embeddingModel || 'text-embedding-ada-002';
    
    // OpenAI APIキーがあれば初期化
    if (options.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * ベクトルDBの初期化
   */
  async initialize(): Promise<void> {
    try {
      // テーブルが存在するか確認
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error checking vector table:', error);
        console.error('Creating vector table...');
        
        // テーブルが存在しない場合は作成
        await this.createVectorTable();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      throw error;
    }
  }

  /**
   * ベクターテーブルの作成
   */
  private async createVectorTable(): Promise<void> {
    // pgvector拡張を有効化
    const { error: extError } = await this.supabase.rpc('create_pg_vector_extension');
    if (extError && !extError.message.includes('already exists')) {
      throw extError;
    }

    // テーブル作成のSQL実行
    const { error } = await this.supabase.rpc('create_notion_vector_table', { 
      table_name: this.tableName 
    });
    
    if (error) {
      throw error;
    }
  }

  /**
   * エンベディングの作成
   */
  async createEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client is not initialized, cannot create embeddings');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }

  /**
   * ページベクトルのインデックス作成
   */
  async indexPage(pageData: {
    pageId: string;
    title: string;
    url: string;
    content: string;
    excerpt?: string;
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.openai) {
      throw new Error('OpenAI client is not initialized, cannot index content');
    }

    try {
      // 既存のエントリがあるか確認
      const { data: existingData } = await this.supabase
        .from(this.tableName)
        .select('id')
        .eq('page_id', pageData.pageId)
        .maybeSingle();

      // テキストからエンベディングを生成
      // タイトル + 概要 + 内容の最初の部分を使用
      const textForEmbedding = 
        `${pageData.title}\n\n${pageData.excerpt || ''}\n\n${pageData.content.substring(0, 8000)}`;
      
      const embedding = await this.createEmbedding(textForEmbedding);
      
      // 抜粋がなければ内容から生成
      const excerpt = pageData.excerpt || pageData.content.substring(0, 160) + '...';

      if (existingData) {
        // 既存エントリの更新
        const { error } = await this.supabase
          .from(this.tableName)
          .update({
            title: pageData.title,
            content: pageData.content,
            excerpt: excerpt,
            url: pageData.url,
            embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('page_id', pageData.pageId);

        if (error) throw error;
      } else {
        // 新規エントリの作成
        const { error } = await this.supabase
          .from(this.tableName)
          .insert({
            page_id: pageData.pageId,
            title: pageData.title,
            content: pageData.content,
            excerpt: excerpt,
            url: pageData.url,
            embedding: embedding
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error(`Error indexing page ${pageData.pageId}:`, error);
      throw error;
    }
  }

  /**
   * セマンティック検索の実行
   */
  async semanticSearch(query: string, limit: number = 3, threshold: number = 0.7): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.openai) {
      throw new Error('OpenAI client is not initialized, cannot perform semantic search');
    }

    try {
      // クエリからエンベディングを生成
      const queryEmbedding = await this.createEmbedding(query);
      
      // ベクトル検索の実行
      const { data, error } = await this.supabase.rpc('match_notion_vectors', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      });

      if (error) throw error;
      
      return data.map(item => ({
        pageId: item.page_id,
        title: item.title,
        excerpt: item.excerpt,
        url: item.url,
        similarity: item.similarity
      }));
    } catch (error) {
      console.error(`Error performing semantic search for "${query}":`, error);
      throw error;
    }
  }

  /**
   * ページベクターの削除
   */
  async removePage(pageId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('page_id', pageId);

      if (error) throw error;
    } catch (error) {
      console.error(`Error removing page ${pageId} from vector index:`, error);
      throw error;
    }
  }
}
