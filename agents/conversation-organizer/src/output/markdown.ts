/**
 * 会話をマークダウン形式で出力するモジュール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Conversation } from '../collectors/base.js';

export interface MarkdownOutputOptions {
  /**
   * 出力先ディレクトリ
   */
  outputDir: string;
  
  /**
   * トピックごとのグループ化を行うかどうか
   */
  groupByTopic: boolean;
  
  /**
   * 目次を生成するかどうか
   */
  generateTableOfContents: boolean;
  
  /**
   * フロントマターを生成するかどうか
   */
  generateFrontMatter: boolean;
  
  /**
   * トピックの検出結果
   */
  topicMap?: Map<string, string[]>;
  
  /**
   * 要約結果
   */
  summaryMap?: Map<string, string>;
}

export interface MarkdownOutputResult {
  /**
   * 出力したファイルの数
   */
  fileCount: number;
  
  /**
   * 出力したトピックの数
   */
  topicCount: number;
  
  /**
   * 出力したファイルのパスと対応する会話数のマップ
   */
  files: Map<string, number>;
  
  /**
   * 出力の詳細レポート
   */
  report: string;
}

/**
 * 会話をマークダウン形式で出力する
 * @param conversations 出力する会話の配列
 * @param options 出力オプション
 * @returns 出力結果
 */
export async function writeConversationsToMarkdown(
  conversations: Conversation[],
  options: MarkdownOutputOptions
): Promise<MarkdownOutputResult> {
  // 出力ディレクトリの作成
  await fs.mkdir(options.outputDir, { recursive: true });
  
  const result: MarkdownOutputResult = {
    fileCount: 0,
    topicCount: 0,
    files: new Map(),
    report: ''
  };
  
  if (options.groupByTopic && options.topicMap) {
    // トピックごとにグループ化して出力
    await writeGroupedByTopic(conversations, options, result);
  } else {
    // ソース別に出力
    await writeBySources(conversations, options, result);
  }
  
  // 目次の作成
  if (options.generateTableOfContents) {
    await generateTableOfContents(options.outputDir, result);
  }
  
  // 結果レポートの作成
  result.report = generateReport(result);
  
  return result;
}

/**
 * トピックごとにグループ化して出力
 */
async function writeGroupedByTopic(
  conversations: Conversation[],
  options: MarkdownOutputOptions,
  result: MarkdownOutputResult
): Promise<void> {
  const { outputDir, topicMap } = options;
  
  if (!topicMap) {
    throw new Error('Topic map is required for grouping by topic');
  }
  
  // トピックごとの会話マップを作成
  const topicConversations = new Map<string, Conversation[]>();
  
  // 各会話を該当するすべてのトピックに追加
  for (const conversation of conversations) {
    for (const [topic, convIds] of topicMap.entries()) {
      if (convIds.includes(conversation.id)) {
        if (!topicConversations.has(topic)) {
          topicConversations.set(topic, []);
        }
        topicConversations.get(topic)!.push(conversation);
      }
    }
  }
  
  // 各トピックについてファイルを作成
  for (const [topic, convs] of topicConversations.entries()) {
    if (convs.length === 0) continue;
    
    const filename = sanitizeFilename(`${topic}.md`);
    const filepath = path.join(outputDir, filename);
    
    const content = formatTopicConversations(topic, convs, options);
    await fs.writeFile(filepath, content, 'utf-8');
    
    result.files.set(filepath, convs.length);
    result.fileCount++;
    result.topicCount++;
  }
}

/**
 * ソース別に出力
 */
async function writeBySources(
  conversations: Conversation[],
  options: MarkdownOutputOptions,
  result: MarkdownOutputResult
): Promise<void> {
  const { outputDir } = options;
  
  // ソースごとの会話マップを作成
  const sourceConversations = new Map<string, Conversation[]>();
  
  // 各会話を該当するソースに追加
  for (const conversation of conversations) {
    if (!sourceConversations.has(conversation.source)) {
      sourceConversations.set(conversation.source, []);
    }
    sourceConversations.get(conversation.source)!.push(conversation);
  }
  
  // 各ソースについてファイルを作成
  for (const [source, convs] of sourceConversations.entries()) {
    if (convs.length === 0) continue;
    
    const filename = sanitizeFilename(`${source}-conversations.md`);
    const filepath = path.join(outputDir, filename);
    
    const content = formatSourceConversations(source, convs, options);
    await fs.writeFile(filepath, content, 'utf-8');
    
    result.files.set(filepath, convs.length);
    result.fileCount++;
  }
}

/**
 * トピック別の会話をフォーマット
 */
function formatTopicConversations(
  topic: string,
  conversations: Conversation[],
  options: MarkdownOutputOptions
): string {
  let content = '';
  
  // フロントマター
  if (options.generateFrontMatter) {
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
    if (options.summaryMap && options.summaryMap.has(conv.id)) {
      content += `#### 要約\n\n${options.summaryMap.get(conv.id)}\n\n`;
    }
    
    // 関連トピック
    if (options.topicMap) {
      content += `#### 関連トピック\n\n`;
      for (const [otherTopic, convIds] of options.topicMap.entries()) {
        if (otherTopic !== topic && convIds.includes(conv.id)) {
          content += `- [${otherTopic}](${sanitizeFilename(`${otherTopic}.md`)})\n`;
        }
      }
      content += `\n`;
    }
    
    content += `#### 会話内容\n\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
    content += `---\n\n`;
  });
  
  return content;
}

/**
 * ソース別の会話をフォーマット
 */
function formatSourceConversations(
  source: string,
  conversations: Conversation[],
  options: MarkdownOutputOptions
): string {
  let content = '';
  
  // フロントマター
  if (options.generateFrontMatter) {
    content += '---\n';
    content += `title: "${source} からの会話"\n`;
    content += `created: "${new Date().toISOString()}"\n`;
    content += `source: "AI会話整理エージェント"\n`;
    content += `tags: ["AI会話", "${source}", "自動生成"]\n`;
    content += '---\n\n';
  }
  
  // タイトル
  content += `# ${source} からの会話\n\n`;
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
    content += `- **日付**: ${formatDate(conv.date)}\n`;
    content += `- **URL**: [会話リンク](${conv.url})\n\n`;
    
    // 要約
    if (options.summaryMap && options.summaryMap.has(conv.id)) {
      content += `#### 要約\n\n${options.summaryMap.get(conv.id)}\n\n`;
    }
    
    // 関連トピック
    if (options.topicMap) {
      content += `#### 関連トピック\n\n`;
      let hasTopics = false;
      for (const [topic, convIds] of options.topicMap.entries()) {
        if (convIds.includes(conv.id)) {
          content += `- [${topic}](${sanitizeFilename(`${topic}.md`)})\n`;
          hasTopics = true;
        }
      }
      if (!hasTopics) {
        content += `- *トピックなし*\n`;
      }
      content += `\n`;
    }
    
    content += `#### 会話内容\n\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
    content += `---\n\n`;
  });
  
  return content;
}

/**
 * 目次ファイルの生成
 */
async function generateTableOfContents(
  outputDir: string,
  result: MarkdownOutputResult
): Promise<void> {
  let content = `# AI会話整理 - 目次\n\n`;
  content += `*生成日時: ${new Date().toISOString().split('T')[0]}*\n\n`;
  
  // ファイルのソート（トピックを優先）
  const sortedFiles = Array.from(result.files.entries()).sort((a, b) => {
    const aIsTopic = !a[0].includes('-conversations');
    const bIsTopic = !b[0].includes('-conversations');
    
    if (aIsTopic !== bIsTopic) {
      return aIsTopic ? -1 : 1;
    }
    
    return a[0].localeCompare(b[0]);
  });
  
  // トピックセクション
  content += `## トピック別\n\n`;
  let hasTopics = false;
  
  for (const [filepath, count] of sortedFiles) {
    if (!filepath.includes('-conversations')) {
      const relativePath = path.basename(filepath);
      const topic = path.basename(filepath, '.md');
      content += `- [${topic} (${count}件)](${relativePath})\n`;
      hasTopics = true;
    }
  }
  
  if (!hasTopics) {
    content += `*トピック別のグループがありません*\n\n`;
  }
  
  // ソースセクション
  content += `\n## ソース別\n\n`;
  let hasSources = false;
  
  for (const [filepath, count] of sortedFiles) {
    if (filepath.includes('-conversations')) {
      const relativePath = path.basename(filepath);
      const source = path.basename(filepath, '-conversations.md');
      content += `- [${source} (${count}件)](${relativePath})\n`;
      hasSources = true;
    }
  }
  
  if (!hasSources) {
    content += `*ソース別のファイルがありません*\n\n`;
  }
  
  // 統計情報
  content += `\n## 統計\n\n`;
  content += `- **会話総数**: ${Array.from(result.files.values()).reduce((sum, count) => sum + count, 0)}\n`;
  content += `- **トピック数**: ${result.topicCount}\n`;
  content += `- **ファイル数**: ${result.fileCount}\n`;
  content += `- **生成日時**: ${new Date().toISOString()}\n`;
  
  const tocFile = path.join(outputDir, "README.md");
  await fs.writeFile(tocFile, content, 'utf-8');
  
  result.files.set(tocFile, 0);
  result.fileCount++;
}

/**
 * 結果レポートの生成
 */
function generateReport(result: MarkdownOutputResult): string {
  const totalConversations = Array.from(result.files.values()).reduce((sum, count) => sum + count, 0);
  
  let report = `会話整理が完了しました。\n\n`;
  report += `## 統計情報\n\n`;
  report += `- 処理した会話: ${totalConversations}件\n`;
  report += `- トピック数: ${result.topicCount}件\n`;
  report += `- 生成したファイル: ${result.fileCount}件\n\n`;
  
  report += `## 出力ファイル\n\n`;
  for (const [filepath, count] of result.files.entries()) {
    report += `- ${filepath} (${count}件)\n`;
  }
  
  return report;
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
 * ファイル名のサニタイズ
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}
