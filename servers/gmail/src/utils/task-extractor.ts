// タスク抽出用ユーティリティ

// タスク情報抽出関数
export function extractTaskInfo(email: any) {
  // 実際の実装ではLLMやルールベースの分析を使用
  const taskKeywords = [
    "お願い", "依頼", "期限", "deadline", "ただちに", "urgent", "緊急", 
    "必要", "提出", "submit", "タスク", "task", "todo", "アクション"
  ];
  
  const deadlinePattern = /\b(\d{1,2}[\/\.\-]\d{1,2})([\/\.\-]\d{2,4})?\b|\b(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})\b/g;
  const potentialDeadlines = email.body.match(deadlinePattern) || [];
  
  // タスクの可能性を検出
  const taskIndicators = taskKeywords.some(keyword => 
    email.subject.toLowerCase().includes(keyword.toLowerCase()) || 
    email.body.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    emailId: email.id,
    potentialTask: taskIndicators,
    title: taskIndicators ? `RE: ${email.subject}` : "",
    potentialDeadlines: potentialDeadlines,
    priority: calculatePriority(email),
    actionRequired: taskIndicators
  };
}

// 優先度計算関数
export function calculatePriority(email: any) {
  let score = 5; // デフォルトの優先度
  
  // 送信者の重要度による調整
  const importantSenders = [
    "boss@example.com", "client@example.com"
  ]; // 実際は設定から読み込む
  
  if (importantSenders.some(sender => email.from.includes(sender))) {
    score += 2;
  }
  
  // 件名に緊急を示す言葉があれば優先度を上げる
  const urgentKeywords = ["urgent", "緊急", "至急", "ASAP", "immediately"];
  if (urgentKeywords.some(keyword => email.subject.toLowerCase().includes(keyword.toLowerCase()))) {
    score += 3;
  }
  
  // ラベルによる優先度調整
  if (email.labelIds && email.labelIds.includes("IMPORTANT")) {
    score += 1;
  }
  
  return Math.min(Math.max(score, 1), 10); // 1-10の範囲で返す
}
