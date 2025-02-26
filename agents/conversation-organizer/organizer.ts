/**
 * 会話整理ロジック
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Tokenizer } from "./tokenizer.js";
import { TopicDetector } from "./topic-detector.js";

export class OrganizeConversations {
  private tokenizer: Tokenizer;
  private topicDetector: TopicDetector;

  constructor() {
    this.tokenizer = new Tokenizer();
    this.topicDetector = new TopicDetector();
  }

  /**
   * 会話整理の実行
   * @param sources 収集元（chatgpt, claude, perplexity）
   * @param outputDir 出力先ディレクトリ
   * @param groupByTopic トピックごとにグループ化するか
   * @returns 結果サマリー
   */
  async execute(
    sources: string[],
    outputDir: string,
    groupByTopic: boolean = true
  ): Promise<string> {
    try {
      // 出力ディレクトリの存在確認、なければ作成
      await this.ensureDirectoryExists(outputDir);
      
      // 各ソースからの会話収集
      const conversations = await this.collectConversations(sources);
      
      // 会話の分析とトピック検出
      const analyzedConversations = await this.analyzeConversations(conversations);
      
      // トピックごとのグループ化（オプション）
      const organizedConversations = groupByTopic 
        ? this.groupConversationsByTopic(analyzedConversations)
        : { "all": analyzedConversations };
      
      // 出力処理
      const results = await this.saveOrganizedConversations(organizedConversations, outputDir);
      
      // 目次ファイルの作成
      await this.createTableOfContents(results, outputDir);
      
      return this.generateSummary(results);
    } catch (error) {
      console.error("会話整理中にエラーが発生しました:", error);
      throw error;
    }
  }
  
  /**
   * 特定トピックの会話抽出
   * @param topic 抽出するトピック
   * @param sources 収集元
   * @param outputFile 出力先ファイル
   * @returns 結果サマリー
   */
  async extractTopic(
    topic: string,
    sources: string[],
    outputFile: string
  ): Promise<string> {
    try {
      // 出力ディレクトリの存在確認
      const outputDir = path.dirname(outputFile);
      await this.ensureDirectoryExists(outputDir);
      
      // 各ソースからの会話収集
      const conversations = await this.collectConversations(sources);
      
      // 会話の分析とトピック検出
      const analyzedConversations = await this.analyzeConversations(conversations);
      
      // 特定トピックのフィルタリング
      const matchingConversations = analyzedConversations.filter(
        conv => conv.topics.some(t => 
          t.toLowerCase().includes(topic.toLowerCase())
        )
      );
      
      if (matchingConversations.length === 0) {
        return `トピック「${topic}」に関連する会話は見つかりませんでした。`;
      }
      
      // 出力処理
      const content = this.formatConversationsForMarkdown(matchingConversations, topic);
      await fs.writeFile(outputFile, content, 'utf-8');
      
      return `トピック「${topic}」に関連する会話を ${matchingConversations.length} 件抽出し、${outputFile} に保存しました。`;
    } catch (error) {
      console.error(`トピック「${topic}」の抽出中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * ディレクトリの存在確認、なければ作成
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 会話の収集処理
   * 注: 実際の実装ではブラウザ操作やAPIアクセスが必要
   */
  private async collectConversations(sources: string[]): Promise<any[]> {
    // このメソッドは実際にはAPI接続やブラウザ操作を行う必要があります
    // 現時点ではモック実装
    
    console.log(`以下のソースから会話を収集します: ${sources.join(', ')}`);
    
    return [
      {
        id: "mock-conversation-1",
        source: "chatgpt",
        title: "Pythonプログラミングについて",
        url: "https://chat.openai.com/c/mock-id-1",
        content: "Pythonプログラミングに関する会話内容...",
        date: "2025-02-20"
      },
      // 実際の実装では収集した実際の会話データが入ります
    ];
  }

  /**
   * 会話の分析とトピック検出
   */
  private async analyzeConversations(conversations: any[]): Promise<any[]> {
    return Promise.all(conversations.map(async (conversation) => {
      // トークン数の計算
      const tokenCount = this.tokenizer.countTokens(conversation.content);
      
      // トピック検出
      const topics = await this.topicDetector.detectTopics(conversation.content);
      
      // 要約の生成（実際の実装ではLLMを使用）
      const summary = `${conversation.title} に関する会話の要約...`;
      
      return {
        ...conversation,
        tokenCount,
        topics,
        summary
      };
    }));
  }

  /**
   * トピックごとの会話グループ化
   */
  private groupConversationsByTopic(conversations: any[]): Record<string, any[]> {
    const groupedByTopic: Record<string, any[]> = {};
    
    conversations.forEach(conversation => {
      conversation.topics.forEach((topic: string) => {
        if (!groupedByTopic[topic]) {
          groupedByTopic[topic] = [];
        }
        groupedByTopic[topic].push(conversation);
      });
    });
    
    return groupedByTopic;
  }

  /**
   * グループ化された会話の保存
   */
  private async saveOrganizedConversations(
    organizedConversations: Record<string, any[]>,
    outputDir: string
  ): Promise<any[]> {
    const results = [];
    
    for (const [topic, conversations] of Object.entries(organizedConversations)) {
      // ファイル名の安全な生成
      const safeFileName = this.createSafeFileName(topic);
      const outputFile = path.join(outputDir, `${safeFileName}.md`);
      
      // マークダウンフォーマットでの出力
      const content = this.formatConversationsForMarkdown(conversations, topic);
      await fs.writeFile(outputFile, content, 'utf-8');
      
      results.push({
        topic,
        file: outputFile,
        count: conversations.length
      });
    }
    
    return results;
  }

  /**
   * マークダウン形式への整形
   */
  private formatConversationsForMarkdown(conversations: any[], topic: string): string {
    let markdown = `# ${topic} に関する会話\n\n`;
    markdown += `*生成日時: ${new Date().toISOString().split('T')[0]}*\n\n`;
    markdown += `## 目次\n\n`;
    
    // 目次の生成
    conversations.forEach((conv, index) => {
      markdown += `${index + 1}. [${conv.title}](#${this.createAnchorLink(conv.title)})\n`;
    });
    
    markdown += `\n## 会話内容\n\n`;
    
    // 各会話の詳細
    conversations.forEach((conv, index) => {
      markdown += `### ${index + 1}. ${conv.title} {#${this.createAnchorLink(conv.title)}}\n\n`;
      markdown += `- **ソース**: ${conv.source}\n`;
      markdown += `- **日付**: ${conv.date}\n`;
      markdown += `- **URL**: [会話リンク](${conv.url})\n\n`;
      markdown += `#### 要約\n\n${conv.summary}\n\n`;
      markdown += `#### 関連トピック\n\n`;
      
      conv.topics.forEach((t: string) => {
        markdown += `- ${t}\n`;
      });
      
      markdown += `\n---\n\n`;
    });
    
    return markdown;
  }

  /**
   * 目次ファイルの作成
   */
  private async createTableOfContents(results: any[], outputDir: string): Promise<void> {
    let tocContent = `# AI会話整理 - 目次\n\n`;
    tocContent += `*生成日時: ${new Date().toISOString().split('T')[0]}*\n\n`;
    
    results.forEach(result => {
      const relativePath = path.basename(result.file);
      tocContent += `- [${result.topic} (${result.count}件)](${relativePath})\n`;
    });
    
    const tocFile = path.join(outputDir, "README.md");
    await fs.writeFile(tocFile, tocContent, 'utf-8');
  }

  /**
   * 結果サマリーの生成
   */
  private generateSummary(results: any[]): string {
    const totalTopics = results.length;
    const totalConversations = results.reduce((sum, r) => sum + r.count, 0);
    
    let summary = `会話整理が完了しました。\n`;
    summary += `- トピック数: ${totalTopics}\n`;
    summary += `- 会話数: ${totalConversations}\n\n`;
    summary += `## 整理されたトピック\n\n`;
    
    results.forEach(result => {
      summary += `- ${result.topic} (${result.count}件): ${result.file}\n`;
    });
    
    return summary;
  }

  /**
   * 安全なファイル名の作成
   */
  private createSafeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * アンカーリンクの作成
   */
  private createAnchorLink(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
