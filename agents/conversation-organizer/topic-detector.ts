/**
 * トピック検出ユーティリティ
 */

export class TopicDetector {
  // よく使われるトピックのリスト（実際の実装ではこれはもっと包括的になります）
  private commonTopics = [
    "Python", "JavaScript", "TypeScript", "プログラミング",
    "MCP", "Claude", "ChatGPT", "Perplexity", "AI", "LLM",
    "建築", "設計", "確定申告", "経理", "DX", "TweenWorld"
  ];

  /**
   * テキストからトピックを検出
   * 注: 実際の実装ではLLMやNLPライブラリを使用する必要があります
   * @param text トピックを検出するテキスト
   * @returns 検出されたトピックの配列
   */
  async detectTopics(text: string): Promise<string[]> {
    // 簡易実装: テキスト内の既知のトピックをマッチング
    // 実際の実装では、LLMを使ってより高度なトピック検出を行うべきです
    
    const detectedTopics = new Set<string>();
    const lowerText = text.toLowerCase();
    
    this.commonTopics.forEach(topic => {
      if (lowerText.includes(topic.toLowerCase())) {
        detectedTopics.add(topic);
      }
    });
    
    // まったくトピックが検出されなかった場合は「その他」を追加
    if (detectedTopics.size === 0) {
      detectedTopics.add("その他");
    }
    
    return Array.from(detectedTopics);
  }
}
