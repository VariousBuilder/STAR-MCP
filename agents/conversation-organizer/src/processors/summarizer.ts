/**
 * 会話の要約を行うモジュール
 */

import { Conversation } from '../collectors/base.js';

export interface SummarizerOptions {
  /**
   * LLMを使用するかどうか
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
   * 要約の最大文字数
   */
  maxSummaryLength?: number;
  
  /**
   * 要約するかどうかの判断基準となる会話の最小文字数
   */
  minLengthForSummary?: number;
}

/**
 * 会話の要約を行う
 * @param conversations 要約する会話の配列
 * @param options 要約オプション
 * @returns 会話IDと要約のマップ
 */
export async function summarizeConversations(
  conversations: Conversation[],
  options: SummarizerOptions = {}
): Promise<Map<string, string>> {
  const summaries = new Map<string, string>();
  
  // LLMの使用設定
  const useLLM = options.useLLM !== undefined ? options.useLLM : false;
  const maxLength = options.maxSummaryLength || 200;
  const minLength = options.minLengthForSummary || 1000;
  
  for (const conversation of conversations) {
    // 会話が短すぎる場合は要約しない
    if (conversation.content.length < minLength) {
      summaries.set(conversation.id, createSimpleSummary(conversation, maxLength));
      continue;
    }
    
    if (useLLM && options.llmConfig) {
      // LLMによる要約
      try {
        const summary = await summarizeWithLLM(conversation, options);
        summaries.set(conversation.id, summary);
      } catch (error) {
        console.error(`LLMによる要約に失敗しました: ${error}`);
        // 簡易要約にフォールバック
        summaries.set(conversation.id, createSimpleSummary(conversation, maxLength));
      }
    } else {
      // 簡易要約
      summaries.set(conversation.id, createSimpleSummary(conversation, maxLength));
    }
  }
  
  return summaries;
}

/**
 * LLMによる要約
 * 注: 実際の実装ではOpenAI APIやAnthropicを使用する必要があります
 */
async function summarizeWithLLM(
  conversation: Conversation,
  options: SummarizerOptions
): Promise<string> {
  // 実際の実装では、ここでLLM呼び出しを行う
  console.log('LLM-based summarization is not fully implemented yet.');
  console.log('Falling back to simple summarization...');
  
  // 簡易要約にフォールバック
  return createSimpleSummary(conversation, options.maxSummaryLength || 200);
}

/**
 * 簡易的な要約を生成
 */
function createSimpleSummary(conversation: Conversation, maxLength: number): string {
  // タイトルと最初の数行を抽出
  const title = conversation.title;
  const contentLines = conversation.content.split('\n').filter(line => line.trim());
  
  // 最初のユーザー発言を取得
  let firstUserMessage = '';
  for (const line of contentLines) {
    if (line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('あなた:')) {
      firstUserMessage = line.split(':').slice(1).join(':').trim();
      break;
    }
  }
  
  // 最初のAI応答を取得
  let firstAIResponse = '';
  let captureNext = false;
  for (const line of contentLines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('assistant:') || lowerLine.startsWith('claude:') || 
        lowerLine.startsWith('gpt:') || lowerLine.startsWith('ai:')) {
      firstAIResponse = line.split(':').slice(1).join(':').trim();
      if (firstAIResponse.length > 0) break;
      captureNext = true;
    } else if (captureNext && line.trim()) {
      firstAIResponse = line.trim();
      break;
    }
  }
  
  // 会話の要素数を取得
  const turns = countConversationTurns(conversation.content);
  
  // 要約の構築
  let summary = `「${title}」に関する会話`;
  
  if (firstUserMessage) {
    summary += `。最初の質問: "${truncateText(firstUserMessage, 100)}"`;
  }
  
  if (firstAIResponse) {
    summary += `。回答の冒頭: "${truncateText(firstAIResponse, 100)}"`;
  }
  
  summary += `。計${turns}回のやり取りがあります。`;
  
  // 最大長に切り詰め
  return truncateText(summary, maxLength);
}

/**
 * 会話のターン数をカウント
 */
function countConversationTurns(content: string): number {
  const lines = content.split('\n');
  let userTurns = 0;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.startsWith('user:') || lowerLine.startsWith('あなた:')) {
      userTurns++;
    }
  }
  
  return userTurns;
}

/**
 * テキストを指定した長さに切り詰める
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
