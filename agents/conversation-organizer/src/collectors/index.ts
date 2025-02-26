/**
 * 会話収集モジュールのインデックス
 */

export * from './base.js';
export * from './chatgpt.js';
export * from './claude.js';
export * from './perplexity.js';

import { BaseCollector, Conversation, CollectorOptions } from './base.js';
import { ChatGPTCollector, ChatGPTCollectorOptions } from './chatgpt.js';
import { ClaudeCollector, ClaudeCollectorOptions } from './claude.js';
import { PerplexityCollector, PerplexityCollectorOptions } from './perplexity.js';

/**
 * 指定されたソースから会話を収集する
 * @param sources 収集元（chatgpt, claude, perplexity）
 * @param options 収集オプション
 * @returns 収集した会話の配列
 */
export async function collectFromSources(
  sources: string[],
  options: {
    chatgpt?: ChatGPTCollectorOptions;
    claude?: ClaudeCollectorOptions;
    perplexity?: PerplexityCollectorOptions;
    common?: CollectorOptions;
  } = {}
): Promise<{
  conversations: Conversation[];
  stats: { [source: string]: any };
}> {
  const results: Conversation[] = [];
  const stats: { [source: string]: any } = {};
  
  // 共通オプション
  const commonOptions = options.common || {};
  
  for (const source of sources) {
    let collector: BaseCollector;
    
    switch (source.toLowerCase()) {
      case 'chatgpt':
        collector = new ChatGPTCollector({
          ...commonOptions,
          ...(options.chatgpt || {})
        });
        break;
        
      case 'claude':
        collector = new ClaudeCollector({
          ...commonOptions,
          ...(options.claude || {})
        });
        break;
        
      case 'perplexity':
        collector = new PerplexityCollector({
          ...commonOptions,
          ...(options.perplexity || {})
        });
        break;
        
      default:
        console.warn(`Unknown source: ${source}`);
        continue;
    }
    
    try {
      console.log(`Collecting from ${source}...`);
      const result = await collector.run();
      results.push(...result.conversations);
      stats[source] = result.stats;
    } catch (error) {
      console.error(`Error collecting from ${source}:`, error);
      stats[source] = {
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }
  
  return {
    conversations: results,
    stats
  };
}
