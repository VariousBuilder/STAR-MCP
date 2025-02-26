/**
 * Notion MCP Server - STAR-MCP Ecosystem向け
 * NotionデータベースとVectorDBを組み合わせた知識ベースアクセス
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListResourcesRequestSchema, ReadResourceRequestSchema, 
         ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { NotionClient } from './clients/notion-client.js';
import { VectorDBClient } from './clients/vector-client.js';
import { searchPages, extractPageContent, createEmbeddings } from './utils/notion-utils.js';
import { loadConfig } from './config/index.js';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 設定のロード
const config = loadConfig();

// Notionクライアントの初期化
const notionClient = new NotionClient({
  auth: process.env.NOTION_API_KEY,
  databaseId: process.env.NOTION_DATABASE_ID
});

// VectorDBクライアントの初期化
const vectorClient = new VectorDBClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  tableName: 'notion_vectors'
});

// サーバーインスタンスの作成
const server = new Server({
  name: 'notion-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// リソースリストハンドラー
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.error('Listing Notion resources');
  
  try {
    // Notion最新ページのリスト取得
    const recentPages = await notionClient.getRecentPages(10);
    
    return {
      resources: [
        {
          uri: 'notion://database',
          name: 'Notion Database',
          description: 'Access to your Notion database'
        },
        ...recentPages.map(page => ({
          uri: `notion://page/${page.id}`,
          name: page.title || 'Untitled Page',
          description: `Notion page created ${new Date(page.created_time).toLocaleString()}`
        }))
      ],
      // テンプレートResourceも提供
      resourceTemplates: [
        {
          uriTemplate: 'notion://search/{query}',
          name: 'Notion Search',
          description: 'Search Notion pages with specified query'
        },
        {
          uriTemplate: 'notion://page/{pageId}',
          name: 'Notion Page',
          description: 'Get content of specific Notion page'
        }
      ]
    };
  } catch (error) {
    console.error('Error listing Notion resources:', error);
    throw error;
  }
});

// リソース読み取りハンドラー
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  console.error(`Reading Notion resource: ${uri}`);
  
  try {
    // URIパターンに基づいた処理
    if (uri === 'notion://database') {
      // データベース概要の取得
      const databaseInfo = await notionClient.getDatabaseInfo();
      
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(databaseInfo, null, 2)
        }]
      };
    } 
    else if (uri.startsWith('notion://page/')) {
      // ページIDの抽出
      const pageId = uri.replace('notion://page/', '');
      // ページ内容の取得
      const pageContent = await notionClient.getPageContent(pageId);
      
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: pageContent.markdown
        }]
      };
    }
    else if (uri.startsWith('notion://search/')) {
      // 検索クエリの抽出
      const query = decodeURIComponent(uri.replace('notion://search/', ''));
      
      // セマンティック検索実行
      const searchResults = await vectorClient.semanticSearch(query, 5);
      
      // 検索結果のページ内容を取得
      const pageContents = await Promise.all(
        searchResults.map(async result => ({
          title: result.title,
          url: result.url,
          excerpt: result.excerpt,
          content: await notionClient.getPageContent(result.pageId)
        }))
      );
      
      // マークダウンとして整形
      const markdownResults = pageContents.map((page, index) => {
        return `## ${index + 1}. ${page.title}\n\n` +
               `**URL**: ${page.url}\n\n` +
               `**関連度**: ${searchResults[index].similarity.toFixed(2)}\n\n` +
               `${page.excerpt}\n\n` +
               `---\n\n`;
      }).join('\n');
      
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: `# Notion検索結果: "${query}"\n\n${markdownResults}`
        }]
      };
    }

    throw new Error(`Unsupported Notion resource URI: ${uri}`);
  } catch (error) {
    console.error(`Error reading Notion resource ${uri}:`, error);
    throw error;
  }
});

// ツールリストハンドラー
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'notion_search',
        description: 'Search for pages in your Notion workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'notion_get_page',
        description: 'Get content of a specific Notion page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Notion page ID or URL'
            }
          },
          required: ['pageId']
        }
      },
      {
        name: 'notion_vector_search',
        description: 'Perform semantic search on Notion content',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language query'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 3)'
            }
          },
          required: ['query']
        }
      }
    ]
  };
});

// ツール呼び出しハンドラー
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`Notion tool call: ${name}`, args);
  
  try {
    // ツール処理
    if (name === 'notion_search') {
      const query = args.query;
      const limit = args.limit || 5;
      
      // Notionテキスト検索
      const results = await notionClient.searchPages(query, limit);
      
      return {
        content: [{
          type: 'text',
          text: formatSearchResults(results, query)
        }]
      };
    }
    else if (name === 'notion_get_page') {
      let pageId = args.pageId;
      
      // URLからページIDを抽出
      if (pageId.startsWith('https://')) {
        const urlParts = pageId.split('/');
        pageId = urlParts[urlParts.length - 1].split('?')[0];
      }
      
      // ページ内容の取得
      const pageContent = await notionClient.getPageContent(pageId);
      
      return {
        content: [{
          type: 'text',
          text: `# ${pageContent.title}\n\n${pageContent.markdown}`
        }]
      };
    }
    else if (name === 'notion_vector_search') {
      const query = args.query;
      const limit = args.limit || 3;
      
      // セマンティック検索
      const results = await vectorClient.semanticSearch(query, limit);
      
      // ページ内容の取得
      const pageContents = await Promise.all(
        results.map(async result => {
          try {
            const content = await notionClient.getPageContent(result.pageId);
            return {
              ...result,
              content
            };
          } catch (error) {
            console.error(`Error fetching page ${result.pageId}:`, error);
            return {
              ...result,
              content: { title: result.title, markdown: 'Content unavailable' }
            };
          }
        })
      );
      
      return {
        content: [{
          type: 'text',
          text: formatVectorResults(pageContents, query)
        }]
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`Error calling Notion tool ${name}:`, error);
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }]
    };
  }
});

// 検索結果のフォーマット
function formatSearchResults(results, query) {
  if (results.length === 0) {
    return `No results found for query: "${query}"`;
  }
  
  const formatted = results.map((page, index) => {
    return `## ${index + 1}. ${page.title || 'Untitled'}\n` +
           `**Last edited**: ${new Date(page.last_edited_time).toLocaleString()}\n` +
           `**URL**: ${page.url}\n\n` +
           `${page.excerpt || 'No excerpt available'}\n`;
  }).join('\n\n');
  
  return `# Notion Search Results for "${query}"\n\n${formatted}`;
}

// ベクトル検索結果のフォーマット
function formatVectorResults(results, query) {
  if (results.length === 0) {
    return `No semantic matches found for query: "${query}"`;
  }
  
  const formatted = results.map((result, index) => {
    return `## ${index + 1}. ${result.content.title || 'Untitled'}\n` +
           `**Relevance Score**: ${(result.similarity * 100).toFixed(1)}%\n` +
           `**URL**: ${result.url}\n\n` +
           `${result.excerpt}\n\n` +
           `### Page Content Preview:\n` +
           `${result.content.markdown.substring(0, 500)}${result.content.markdown.length > 500 ? '...' : ''}`;
  }).join('\n\n---\n\n');
  
  return `# Notion Semantic Search Results for "${query}"\n\n${formatted}`;
}

// メイン関数
async function main() {
  try {
    console.error('Starting Notion MCP Server...');
    
    // API キーの確認
    if (!process.env.NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not set in environment variables');
    }
    
    // データベースIDの確認
    if (!process.env.NOTION_DATABASE_ID) {
      console.warn('NOTION_DATABASE_ID is not set. Some features may be limited.');
    }
    
    // Notionクライアントの初期化テスト
    await notionClient.testConnection();
    console.error('Notion client initialized successfully');
    
    // Vector DBの初期化
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await vectorClient.initialize();
      console.error('Vector database client initialized successfully');
    } else {
      console.warn('Supabase credentials not provided. Vector search will not be available.');
    }
    
    // サーバー起動
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Notion MCP Server running on stdio');
  } catch (error) {
    console.error('Error during server startup:', error);
    process.exit(1);
  }
}

// エントリーポイント
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
