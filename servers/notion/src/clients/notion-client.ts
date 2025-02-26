/**
 * Notion API クライアントクラス
 */

import { Client } from '@notionhq/client';
import { extractPageContent } from '../utils/notion-utils.js';

interface NotionClientOptions {
  auth: string;
  databaseId?: string;
}

export class NotionClient {
  private client: Client;
  private databaseId?: string;

  constructor(options: NotionClientOptions) {
    this.client = new Client({ 
      auth: options.auth 
    });
    this.databaseId = options.databaseId;
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      // APIキーが有効かどうかを確認するため、ユーザー情報を取得
      const response = await this.client.users.me({});
      console.error(`Connected to Notion as ${response.name || response.id}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to Notion API:', error);
      throw new Error(`Notion API connection failed: ${error.message}`);
    }
  }

  /**
   * データベース情報の取得
   */
  async getDatabaseInfo() {
    if (!this.databaseId) {
      throw new Error('Database ID is not configured');
    }

    try {
      const database = await this.client.databases.retrieve({
        database_id: this.databaseId
      });

      return {
        id: database.id,
        title: database.title[0]?.plain_text || 'Untitled Database',
        properties: Object.keys(database.properties).map(key => ({
          name: key,
          type: database.properties[key].type
        })),
        created_time: database.created_time,
        last_edited_time: database.last_edited_time
      };
    } catch (error) {
      console.error('Error retrieving database info:', error);
      throw error;
    }
  }

  /**
   * 最近のページ取得
   */
  async getRecentPages(limit: number = 10) {
    try {
      const response = await this.client.search({
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        },
        page_size: limit
      });

      return response.results
        .filter(item => item.object === 'page')
        .map(page => {
          // ページのタイトルを取得しようとする
          let title = 'Untitled';
          if ('properties' in page) {
            const titleProp = Object.values(page.properties).find(
              prop => prop.type === 'title'
            );
            if (titleProp && 'title' in titleProp) {
              title = titleProp.title.map(t => t.plain_text).join('') || 'Untitled';
            }
          }

          return {
            id: page.id,
            title,
            url: 'url' in page ? page.url : null,
            created_time: page.created_time,
            last_edited_time: page.last_edited_time
          };
        });
    } catch (error) {
      console.error('Error retrieving recent pages:', error);
      throw error;
    }
  }

  /**
   * ページ内容の取得とマークダウン変換
   */
  async getPageContent(pageId: string) {
    try {
      // ページ情報の取得
      const page = await this.client.pages.retrieve({ page_id: pageId });

      // ブロック内容の取得
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100 // 必要に応じて調整
      });

      // タイトルを探す
      let title = 'Untitled';
      if ('properties' in page) {
        const titleProp = Object.values(page.properties).find(
          prop => prop.type === 'title'
        );
        if (titleProp && 'title' in titleProp) {
          title = titleProp.title.map(t => t.plain_text).join('') || 'Untitled';
        }
      }

      // ブロックからマークダウンを生成
      const markdown = await extractPageContent(this.client, blocks.results);

      return {
        id: page.id,
        title,
        url: 'url' in page ? page.url : null,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        markdown
      };
    } catch (error) {
      console.error(`Error retrieving page content for ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * テキスト検索
   */
  async searchPages(query: string, limit: number = 5) {
    try {
      const response = await this.client.search({
        query,
        page_size: limit
      });

      return response.results
        .filter(item => item.object === 'page')
        .map(page => {
          // ページのタイトルを取得しようとする
          let title = 'Untitled';
          if ('properties' in page) {
            const titleProp = Object.values(page.properties).find(
              prop => prop.type === 'title'
            );
            if (titleProp && 'title' in titleProp) {
              title = titleProp.title.map(t => t.plain_text).join('') || 'Untitled';
            }
          }

          // ページの抜粋を取得（プロパティから推測）
          let excerpt = '';
          if ('properties' in page) {
            // まず説明/概要フィールドを探す
            const descriptionProp = Object.entries(page.properties).find(
              ([key, prop]) => 
                ['description', 'summary', 'excerpt', 'about'].includes(key.toLowerCase()) && 
                ['rich_text', 'text'].includes(prop.type)
            );
            
            if (descriptionProp && descriptionProp[1].type === 'rich_text') {
              excerpt = descriptionProp[1].rich_text
                .map(t => t.plain_text)
                .join('');
            }
          }

          return {
            id: page.id,
            title,
            excerpt,
            url: 'url' in page ? page.url : null,
            created_time: page.created_time,
            last_edited_time: page.last_edited_time
          };
        });
    } catch (error) {
      console.error(`Error searching pages for "${query}":`, error);
      throw error;
    }
  }

  /**
   * データベースのページを取得
   */
  async getDatabasePages(limit: number = 100) {
    if (!this.databaseId) {
      throw new Error('Database ID is not configured');
    }

    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        page_size: limit
      });

      return response.results.map(page => {
        // ページのタイトルを取得しようとする
        let title = 'Untitled';
        if ('properties' in page) {
          const titleProp = Object.values(page.properties).find(
            prop => prop.type === 'title'
          );
          if (titleProp && 'title' in titleProp) {
            title = titleProp.title.map(t => t.plain_text).join('') || 'Untitled';
          }
        }

        return {
          id: page.id,
          title,
          url: 'url' in page ? page.url : null,
          created_time: page.created_time,
          last_edited_time: page.last_edited_time,
          properties: page.properties
        };
      });
    } catch (error) {
      console.error('Error querying database pages:', error);
      throw error;
    }
  }
}
