#!/usr/bin/env node
/**
 * AI会話整理エージェント
 * 
 * このモジュールは、ChatGPT、Claude、Perplexityなどの
 * 過去の会話履歴を収集、分析、整理し、トピックごとに
 * 構造化された知識ベースを構築します。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from 'fs/promises';
import * as path from 'path';

// 内部モジュール
import { collectFromSources, Conversation } from './collectors/index.js';
import { detectTopics, TopicDetectionOptions } from './processors/topic-detector.js';
import { summarizeConversations, SummarizerOptions } from './processors/summarizer.js';
import { writeConversationsToMarkdown, MarkdownOutputOptions } from './output/markdown.js';

// 環境変数設定
import dotenv from 'dotenv';
dotenv.config();

/**
 * 会話を収集して整理するメイン関数
 */
export async function organizeConversations(
  sources: string[],
  outputDir: string,
  options: {
    groupByTopic?: boolean;
    generateTableOfContents?: boolean;
    generateFrontMatter?: boolean;
    useLLM?: boolean;
    collectorOptions?: any;
    topicOptions?: TopicDetectionOptions;
    summarizerOptions?: SummarizerOptions;
  } = {}
): Promise<string> {
  try {
    console.log(`会話整理を開始します (ソース: ${sources.join(', ')})`);
    
    // 出力ディレクトリの作成
    await fs.mkdir(outputDir, { recursive: true });
    
    // 1. 会話の収集
    console.log('会話を収集しています...');
    const { conversations, stats } = await collectFromSources(sources, options.collectorOptions || {});
    
    if (conversations.length === 0) {
      return '会話が見つかりませんでした。';
    }
    
    console.log(`${conversations.length}件の会話を収集しました。`);
    
    // 2. トピックの検出
    console.log('トピックを検出しています...');
    const topicResult = await detectTopics(conversations, options.topicOptions);
    console.log(`${topicResult.topicMap.size}個のトピックを検出しました。`);
    
    // 3. 要約の生成
    console.log('会話を要約しています...');
    const summaries = await summarizeConversations(conversations, options.summarizerOptions);
    console.log(`${summaries.size}件の会話を要約しました。`);
    
    // 4. マークダウン形式で出力
    console.log('マークダウン形式で出力しています...');
    const markdownOptions: MarkdownOutputOptions = {
      outputDir,
      groupByTopic: options.groupByTopic !== undefined ? options.groupByTopic : true,
      generateTableOfContents: options.generateTableOfContents !== undefined ? options.generateTableOfContents : true,
      generateFrontMatter: options.generateFrontMatter !== undefined ? options.generateFrontMatter : true,
      topicMap: topicResult.topicMap,
      summaryMap: summaries
    };
    
    const result = await writeConversationsToMarkdown(conversations, markdownOptions);
    
    // 5. 結果の返却
    return result.report;
  } catch (error) {
    console.error('会話整理中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * 特定のトピックに関する会話を抽出する関数
 */
export async function extractTopicConversations(
  topic: string,
  sources: string[],
  outputFile: string,
  options: {
    useLLM?: boolean;
    generateFrontMatter?: boolean;
    collectorOptions?: any;
    topicOptions?: TopicDetectionOptions;
    summarizerOptions?: SummarizerOptions;
  } = {}
): Promise<string> {
  try {
    console.log(`トピック「${topic}」に関する会話を抽出します (ソース: ${sources.join(', ')})`);
    
    // 出力ディレクトリの作成
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });
    
    // 1. 会話の収集
    console.log('会話を収集しています...');
    const { conversations, stats } = await collectFromSources(sources, options.collectorOptions || {});
    
    if (conversations.length === 0) {
      return '会話が見つかりませんでした。';
    }
    
    console.log(`${conversations.length}件の会話を収集しました。`);
    
    // 2. トピックの検出
    console.log('トピックを検出しています...');
    const topicResult = await detectTopics(conversations, options.topicOptions);
    console.log(`${topicResult.topicMap.size}個のトピックを検出しました。`);
    
    // 3. 特定のトピックに関する会話を抽出
    const targetTopic = Array.from(topicResult.topicMap.keys()).find(
      t => t.toLowerCase() === topic.toLowerCase()
    ) || topic;
    
    const matchingConversationIds = topicResult.topicMap.get(targetTopic) || [];
    const matchingConversations = conversations.filter(conv => 
      matchingConversationIds.includes(conv.id)
    );
    
    if (matchingConversations.length === 0) {
      return `トピック「${topic}」に関連する会話は見つかりませんでした。`;
    }
    
    console.log(`トピック「${topic}」に関連する会話が${matchingConversations.length}件見つかりました。`);
    
    // 4. 要約の生成
    console.log('会話を要約しています...');
    const summaries = await summarizeConversations(matchingConversations, options.summarizerOptions);
    
    // 5. マークダウン形式で出力
    console.log('マークダウン形式で出力しています...');
    const outputContent = formatTopicConversations(
      targetTopic,
      matchingConversations,
      summaries,
      options.generateFrontMatter !== false
    );
    
    await fs.writeFile(outputFile, outputContent, 'utf-8');
    
    // 6. 結果の返却
    return `トピック「${topic}」に関連する会話を${matchingConversations.length}件抽出し、${outputFile}に保存しました。`;
  } catch (error) {
    console.error(`トピック「${topic}」の抽出中にエラーが発生しました:`, error);
    throw error;
  }
}

/**
 * トピック別の会話をフォーマット
 */
function formatTopicConversations(
  topic: string,
  conversations: Conversation[],
  summaries: Map<string, string>,
  generateFrontMatter: boolean
): string {
  let content = '';
  
  // フロントマター
  if (generateFrontMatter) {
    content += '---\n';
    content += `title: "${topic} に関する会話"\n`;
    content += `created: "${new Date().toISOString()}"\n`;
    content += `source: "AI会話整理エージェント"\n`;
    content += `tags: ["AI会話", "${topic}", "自動生成"]\n`;
    content += '---\n\n';
  }
  
  // タイトル
  content += `# ${topic} に関する会話\n\n`;
  content += `*生成日時: ${new Date().toISOString().split('T')[0]}*\n\n`;
  
  // 目次
  content += `## 目次\n\n`;
  conversations.forEach((conv, index) => {
    content += `${index + 1}. [${conv.title}](#${createAnchorLink(conv.title)})\n`;
  });
  
  // 各会話の詳細
  content += `\n## 会話内容\n\n`;
  conversations.forEach((conv, index) => {
    content += `### ${index + 1}. ${conv.title} {#${createAnchorLink(conv.title)}}\n\n`;
    content += `- **ソース**: ${conv.source}\n`;
    content += `- **日付**: ${formatDate(conv.date)}\n`;
    content += `- **URL**: [会話リンク](${conv.url})\n\n`;
    
    // 要約
    if (summaries.has(conv.id)) {
      content += `#### 要約\n\n${summaries.get(conv.id)}\n\n`;
    }
    
    content += `#### 会話内容\n\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
    content += `---\n\n`;
  });
  
  return content;
}

/**
 * 日付のフォーマット
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * アンカーリンクの作成
 */
function createAnchorLink(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * MCPサーバーエントリーポイント
 */
async function main(): Promise<void> {
  // サーバーの設定
  const server = new McpServer({
    name: "conversation-organizer",
    version: "1.0.0",
  });

  // 会話整理ツール
  server.tool(
    "organize-conversations",
    "過去のAI会話を収集し、トピックごとに整理します",
    {
      sources: z.array(z.string()).describe("収集元（chatgpt, claude, perplexity）"),
      outputDir: z.string().describe("出力先ディレクトリ"),
      groupByTopic: z.boolean().optional().describe("トピックごとにグループ化するか"),
      useLLM: z.boolean().optional().describe("LLMを使用するか"),
    },
    async ({ sources, outputDir, groupByTopic = true, useLLM = false }) => {
      try {
        const result = await organizeConversations(sources, outputDir, {
          groupByTopic,
          useLLM,
        });
        
        return {
          content: [
            {
              type: "text",
              text: result
            }
          ]
        };
      } catch (error: any) {
        console.error("[organize-conversations] Error:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `会話整理中にエラーが発生しました: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // トピック抽出ツール
  server.tool(
    "extract-topic",
    "特定のトピックに関する会話を抽出します",
    {
      topic: z.string().describe("抽出するトピック"),
      sources: z.array(z.string()).describe("収集元（chatgpt, claude, perplexity）"),
      outputFile: z.string().describe("出力先ファイル"),
    },
    async ({ topic, sources, outputFile }) => {
      try {
        const result = await extractTopicConversations(topic, sources, outputFile);
        
        return {
          content: [
            {
              type: "text",
              text: result
            }
          ]
        };
      } catch (error: any) {
        console.error("[extract-topic] Error:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `トピック抽出中にエラーが発生しました: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // サーバー起動
  try {
    console.error("会話整理エージェントを起動しています...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("会話整理エージェントが起動しました");
  } catch (error) {
    console.error("サーバー起動中にエラーが発生しました:", error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合のみ実行
if (process.argv[1] === import.meta.url.substring(7)) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
