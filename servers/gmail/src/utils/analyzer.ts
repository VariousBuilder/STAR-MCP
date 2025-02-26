// メール分析用ユーティリティ

// 共通トピック抽出関数
export function extractCommonTopics(subjects: string[]) {
  // 実際の実装ではNLPやトピックモデリングを使用
  // 簡易実装として件名の単語頻度を計算
  const words: { [key: string]: number } = {};
  
  subjects.forEach(subject => {
    subject.split(/\s+/).forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w\s]/gi, '');
      if (cleanWord && cleanWord.length > 3) { // 短すぎる単語は除外
        words[cleanWord] = (words[cleanWord] || 0) + 1;
      }
    });
  });
  
  // 頻度でソート
  return Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
}

// 高頻度フレーズ抽出関数
export function extractCommonPhrases(bodies: string[]) {
  // 実際の実装ではNLPやフレーズ抽出ライブラリを使用
  // 簡易実装としてダミーデータを返す
  return [
    "よろしくお願いいたします",
    "お忙しい中大変申し訳ありません",
    "Best regards",
    "お時間をいただきありがとうございます",
    "Let me know if you have any questions"
  ];
}
