/**
 * 会話からトピックを検出するモジュール
 */

import { Conversation } from '../collectors/base.js';

export interface TopicDetectionOptions {
  /**
   * 事前定義されたトピックリスト
   */
  predefinedTopics?: string[];
  
  /**
   * トピック検出にLLMを使用するかどうか
   */
  useLLM?: boolean;
  
  /**
   * LLMの設定
   */
  llmConfig?: {
    apiKey?: string;
    model?: string;
    endpoint?: string;
  };
  
  /**
   * キーワード検出の最小出現回数
   */
  minKeywordOccurrence?: number;
  
  /**
   * ルールベースのトピックマッピング
   */
  topicRules?: { [keyword: string]: string };
}

export interface TopicDetectionResult {
  /**
   * トピックと会話IDのマップ
   */
  topicMap: Map<string, string[]>;
  
  /**
   * 会話IDとトピックのマップ
   */
  conversationTopics: Map<string, string[]>;
  
  /**
   * 検出されたトピックの頻度
   */
  topicFrequency: Map<string, number>;
}

/**
 * 会話からトピックを検出する
 * @param conversations トピックを検出する会話の配列
 * @param options トピック検出オプション
 * @returns トピック検出結果
 */
export async function detectTopics(
  conversations: Conversation[],
  options: TopicDetectionOptions = {}
): Promise<TopicDetectionResult> {
  const result: TopicDetectionResult = {
    topicMap: new Map<string, string[]>(),
    conversationTopics: new Map<string, string[]>(),
    topicFrequency: new Map<string, number>()
  };
  
  // 事前定義トピックがなければデフォルトを使用
  const predefinedTopics = options.predefinedTopics || getDefaultTopics();
  
  // トピックルールの設定
  const topicRules = options.topicRules || getDefaultTopicRules();
  
  // LLMの使用設定
  const useLLM = options.useLLM !== undefined ? options.useLLM : false;
  
  if (useLLM && options.llmConfig) {
    // LLMを使用したトピック検出
    return await detectTopicsWithLLM(conversations, options);
  } else {
    // ルールベースのトピック検出
    return detectTopicsWithRules(conversations, predefinedTopics, topicRules, options);
  }
}

/**
 * ルールベースのトピック検出
 */
function detectTopicsWithRules(
  conversations: Conversation[],
  predefinedTopics: string[],
  topicRules: { [keyword: string]: string },
  options: TopicDetectionOptions
): TopicDetectionResult {
  const result: TopicDetectionResult = {
    topicMap: new Map<string, string[]>(),
    conversationTopics: new Map<string, string[]>(),
    topicFrequency: new Map<string, number>()
  };
  
  // 最小キーワード出現回数
  const minOccurrence = options.minKeywordOccurrence || 1;
  
  // 各会話のトピックを検出
  for (const conversation of conversations) {
    const detectedTopics = new Set<string>();
    const conversationText = `${conversation.title} ${conversation.content}`.toLowerCase();
    
    // 事前定義トピックの検出
    for (const topic of predefinedTopics) {
      const lowerTopic = topic.toLowerCase();
      if (conversationText.includes(lowerTopic)) {
        // 出現回数をカウント
        const regex = new RegExp(escapeRegExp(lowerTopic), 'gi');
        const occurrences = (conversationText.match(regex) || []).length;
        
        if (occurrences >= minOccurrence) {
          detectedTopics.add(topic);
        }
      }
    }
    
    // キーワードベースのトピック検出
    for (const [keyword, topic] of Object.entries(topicRules)) {
      const lowerKeyword = keyword.toLowerCase();
      if (conversationText.includes(lowerKeyword)) {
        const regex = new RegExp(escapeRegExp(lowerKeyword), 'gi');
        const occurrences = (conversationText.match(regex) || []).length;
        
        if (occurrences >= minOccurrence) {
          detectedTopics.add(topic);
        }
      }
    }
    
    // タイトルからの追加トピック検出（単語ベース）
    const titleWords = conversation.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3); // 短すぎる単語を除外
    
    for (const word of titleWords) {
      // 単語が複数回出現する場合はトピックとして追加
      const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
      const occurrences = (conversationText.match(regex) || []).length;
      
      if (occurrences >= 3 && !isStopWord(word)) {
        detectedTopics.add(capitalizeFirstLetter(word));
      }
    }
    
    // トピックがない場合は「その他」を追加
    if (detectedTopics.size === 0) {
      detectedTopics.add('その他');
    }
    
    // 結果に追加
    const topicsArray = Array.from(detectedTopics);
    result.conversationTopics.set(conversation.id, topicsArray);
    
    // トピックマップの更新
    for (const topic of topicsArray) {
      if (!result.topicMap.has(topic)) {
        result.topicMap.set(topic, []);
      }
      result.topicMap.get(topic)!.push(conversation.id);
      
      // 頻度の更新
      result.topicFrequency.set(
        topic,
        (result.topicFrequency.get(topic) || 0) + 1
      );
    }
  }
  
  return result;
}

/**
 * LLMを使用したトピック検出
 * 注: 実際の実装ではOpenAI APIやAnthropicを使用する必要があります
 */
async function detectTopicsWithLLM(
  conversations: Conversation[],
  options: TopicDetectionOptions
): Promise<TopicDetectionResult> {
  // 実際の実装では、ここでLLM呼び出しを行う
  console.log('LLM-based topic detection is not fully implemented yet.');
  console.log('Falling back to rule-based detection...');
  
  // 事前定義トピックがなければデフォルトを使用
  const predefinedTopics = options.predefinedTopics || getDefaultTopics();
  
  // トピックルールの設定
  const topicRules = options.topicRules || getDefaultTopicRules();
  
  // ルールベースの検出にフォールバック
  return detectTopicsWithRules(conversations, predefinedTopics, topicRules, options);
}

/**
 * デフォルトのトピックリストを取得
 */
function getDefaultTopics(): string[] {
  return [
    // プログラミング関連
    'Python', 'TypeScript', 'JavaScript', 'React', 'Node.js', 'SQL', 'データベース',
    'API', 'フロントエンド', 'バックエンド', 'DevOps', 'Git', 'GitHub', 'Docker',
    'Kubernetes', 'CI/CD', 'クラウド', 'AWS', 'Azure', 'GCP',
    
    // AI関連
    'AI', '機械学習', 'LLM', 'ChatGPT', 'Claude', 'Perplexity', 'プロンプトエンジニアリング',
    '自然言語処理', 'コンピュータビジョン', 'MLOps', 'データサイエンス',
    
    // MCP関連
    'MCP', 'Model Context Protocol', 'STAR-MCP', 'クライアント', 'サーバー',
    
    // 建築関連
    '建築', '設計', '建築基準法', '構造', '設備', '図面', 'BIM', 'CAD',
    
    // ビジネス関連
    '会社設立', '確定申告', '経理', '会計', '税務', '起業', 'DX', 'SaaS',
    
    // その他
    'ブレインストーミング', 'キャリア', '学習', '生産性', 'タスク管理', 'ワークフロー',
    'プレゼンテーション', 'コミュニケーション', 'コラボレーション', '健康', '趣味'
  ];
}

/**
 * デフォルトのトピックルールを取得
 */
function getDefaultTopicRules(): { [keyword: string]: string } {
  return {
    // プログラミング言語
    'python': 'Python',
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'java': 'Java',
    'c#': 'C#',
    'c++': 'C++',
    'golang': 'Go',
    'rust': 'Rust',
    'php': 'PHP',
    'ruby': 'Ruby',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'scala': 'Scala',
    
    // ウェブ開発
    'react': 'React',
    'vue': 'Vue.js',
    'angular': 'Angular',
    'svelte': 'Svelte',
    'next.js': 'Next.js',
    'node': 'Node.js',
    'express': 'Express',
    'django': 'Django',
    'flask': 'Flask',
    'fastapi': 'FastAPI',
    
    // データベース
    'sql': 'SQL',
    'mysql': 'MySQL',
    'postgresql': 'PostgreSQL',
    'mongodb': 'MongoDB',
    'redis': 'Redis',
    'sqlite': 'SQLite',
    
    // AI関連
    'openai': 'OpenAI',
    'gpt': 'GPT',
    'gpt-4': 'GPT-4',
    'gpt-3': 'GPT-3',
    'transformer': 'Transformer',
    'fine-tuning': 'ファインチューニング',
    'embedding': 'エンベディング',
    'rag': 'RAG',
    
    // MCP関連
    'model context protocol': 'MCP',
    'mcp server': 'MCPサーバー',
    'mcp client': 'MCPクライアント',
    'claude desktop': 'Claude Desktop',
    
    // 建築関連
    '建築士': '建築',
    '意匠': '建築設計',
    '構造計算': '構造設計',
    '建築設備': '設備設計',
    '建築基準法': '法規',
    '都市計画': '都市計画',
    '開発許可': '開発行為',
    
    // 会社関連
    '法人': '会社運営',
    '税務': '税務',
    '会計': '経理',
    '貸借対照表': '会計',
    '損益計算書': '会計',
    '確定申告': '確定申告',
    '消費税': '税務'
  };
}

/**
 * ストップワードかどうかを判定
 */
function isStopWord(word: string): boolean {
  const stopWords = [
    'the', 'and', 'for', 'with', 'that', 'have', 'this', 'from', 'but', 'not',
    'what', 'when', 'where', 'who', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'than', 'these', 'this', 'those',
    'would', 'could', 'should', 'will', 'shall', 'may', 'might', 'must', 'then',
    'です', 'ます', 'また', 'および', 'ただし', 'ところ', 'ため', 'から', 'まで', 'など',
    'より', 'いる', 'ある', 'れる', 'られる', 'なる', 'する', 'ない', 'よう', 'いう',
    'という', 'あり', 'なり', 'れば', 'なければ', 'できる', 'できない'
  ];
  
  return stopWords.includes(word.toLowerCase());
}

/**
 * 正規表現のエスケープ
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 最初の文字を大文字にする
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
