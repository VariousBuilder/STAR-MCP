/**
 * Claude会話収集モジュール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseCollector, Conversation, CollectorOptions } from './base.js';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface ClaudeCollectorOptions extends CollectorOptions {
  /**
   * Claudeのログディレクトリパス
   */
  logsDir?: string;
  
  /**
   * セッションデータが保存されているディレクトリ
   */
  sessionDir?: string;
  
  /**
   * 認証情報
   */
  auth?: {
    email?: string;
    password?: string;
  };
}

export class ClaudeCollector extends BaseCollector {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: ClaudeCollectorOptions;
  
  constructor(options: ClaudeCollectorOptions = {}) {
    super(options);
    this.options = options;
  }
  
  get sourceName(): string {
    return 'claude';
  }
  
  /**
   * 初期化処理
   */
  async initialize(): Promise<void> {
    // ログディレクトリからの読み込みの場合は何もしない
    if (this.options.logsDir) {
      return;
    }
    
    // ブラウザを起動
    this.browser = await puppeteer.launch({
      headless: false, // ユーザーが認証を確認できるようにheadlessモードをオフに
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // セッションがあればロード
    if (this.options.sessionDir) {
      try {
        await this.loadSession();
      } catch (error) {
        console.warn('Failed to load session, proceeding with login:', error);
      }
    }
    
    // Claudeにアクセス
    await this.page.goto('https://claude.ai/', { waitUntil: 'networkidle2' });
    
    // ログインが必要かチェック
    const isLoggedIn = await this.checkIfLoggedIn();
    
    if (!isLoggedIn) {
      if (!this.options.auth?.email || !this.options.auth?.password) {
        throw new Error('Authentication required but credentials not provided');
      }
      
      await this.login(this.options.auth.email, this.options.auth.password);
      
      // セッションを保存
      if (this.options.sessionDir) {
        await this.saveSession();
      }
    }
  }
  
  /**
   * 会話の収集
   */
  async collect(): Promise<Conversation[]> {
    // ログディレクトリからの読み込み
    if (this.options.logsDir) {
      return this.collectFromLogsDir();
    }
    
    // ブラウザからの収集
    return this.collectFromBrowser();
  }
  
  /**
   * リソースの解放
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
  
  /**
   * ログディレクトリからの会話収集
   */
  private async collectFromLogsDir(): Promise<Conversation[]> {
    if (!this.options.logsDir) {
      return [];
    }
    
    try {
      const conversations: Conversation[] = [];
      const filesList = await fs.readdir(this.options.logsDir);
      const chatFiles = filesList.filter(file => file.endsWith('.json') && !file.includes('config'));
      
      for (const file of chatFiles.slice(0, this.options.maxResults || 100)) {
        try {
          const filePath = path.join(this.options.logsDir, file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const chatData = JSON.parse(fileContent);
          
          // Claudeのログ形式に合わせて処理
          // 具体的な形式はファイルを実際に調査する必要があります
          
          if (chatData.title) {
            const id = file.replace('.json', '') || `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const title = chatData.title || 'Untitled Conversation';
            const date = chatData.createdAt || new Date().toISOString();
            
            // 会話コンテンツの構築
            let content = '';
            
            if (Array.isArray(chatData.messages)) {
              for (const message of chatData.messages) {
                const role = message.role || 'unknown';
                const text = message.content || '';
                content += `${role}: ${text}\n\n`;
              }
            }
            
            conversations.push({
              id,
              source: this.sourceName,
              title,
              url: `https://claude.ai/chat/${id}`,
              content,
              date,
              metadata: {
                model: chatData.model || 'unknown',
                messageCount: (chatData.messages || []).length
              }
            });
            
            this.stats.successCount++;
          } else {
            this.stats.skippedCount++;
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
          this.stats.failureCount++;
          this.stats.errors.push(error as Error);
        }
        
        this.stats.processedCount++;
      }
      
      return conversations;
    } catch (error) {
      console.error('Error reading logs directory:', error);
      throw error;
    }
  }
  
  /**
   * ブラウザからの会話収集
   */
  private async collectFromBrowser(): Promise<Conversation[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    const conversations: Conversation[] = [];
    
    try {
      // 会話履歴ページに移動
      await this.page.goto('https://claude.ai/chats', { waitUntil: 'networkidle2' });
      
      // 会話リストの取得
      await this.page.waitForSelector('[data-qa="chat-history-item"]', { timeout: 30000 });
      
      const conversationLinks = await this.page.$$eval('[data-qa="chat-history-item"] a', (links) => {
        return links.map(link => ({
          href: link.getAttribute('href') || '',
          title: link.textContent?.trim() || 'Untitled'
        }));
      });
      
      const maxToProcess = Math.min(
        conversationLinks.length,
        this.options.maxResults || 100
      );
      
      // 各会話を処理
      for (let i = 0; i < maxToProcess; i++) {
        const link = conversationLinks[i];
        const conversationId = link.href.split('/').pop() || '';
        
        try {
          // 会話ページに移動
          await this.page.goto(`https://claude.ai${link.href}`, { waitUntil: 'networkidle2' });
          await this.page.waitForSelector('[data-qa="message-content"]', { timeout: 30000 });
          
          // 会話内容の取得
          const messages = await this.page.$$eval('[data-qa="message-content"]', (elements) => {
            return elements.map(el => ({
              text: el.textContent?.trim() || '',
              role: el.closest('[data-qa="chat-message"]')?.getAttribute('data-qa-message-role') || 'unknown'
            }));
          });
          
          // 会話内容の構築
          let content = '';
          for (const message of messages) {
            content += `${message.role}: ${message.text}\n\n`;
          }
          
          // 日付の取得（クライアント側で現在の日付を使用）
          const date = new Date().toISOString();
          
          conversations.push({
            id: conversationId,
            source: this.sourceName,
            title: link.title,
            url: `https://claude.ai${link.href}`,
            content,
            date,
            metadata: {
              messageCount: messages.length
            }
          });
          
          this.stats.successCount++;
        } catch (error) {
          console.error(`Error processing conversation ${conversationId}:`, error);
          this.stats.failureCount++;
          this.stats.errors.push(error as Error);
        }
        
        this.stats.processedCount++;
      }
      
      return conversations;
    } catch (error) {
      console.error('Error collecting conversations from browser:', error);
      throw error;
    }
  }
  
  /**
   * ユーザーがログイン済みかチェック
   */
  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // ログイン状態のチェック（例: チャット履歴の有無）
      const isLoginPage = await this.page.evaluate(() => {
        return !!document.querySelector('button[data-qa="login"]');
      });
      
      return !isLoginPage;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }
  
  /**
   * ログイン処理
   */
  private async login(email: string, password: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // ログインボタンをクリック
      await this.page.waitForSelector('button[data-qa="login"]', { timeout: 10000 });
      await this.page.click('button[data-qa="login"]');
      
      // メールアドレス入力
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await this.page.type('input[type="email"]', email);
      
      // 続行ボタンをクリック
      await this.page.click('button[type="submit"]');
      
      // パスワード入力
      await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await this.page.type('input[type="password"]', password);
      
      // ログインボタンをクリック
      await this.page.click('button[type="submit"]');
      
      // ログイン完了を待機（チャット履歴ページへのリダイレクト）
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      
      // ログイン成功の確認
      const isLoggedIn = await this.checkIfLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Login failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * セッションの保存
   */
  private async saveSession(): Promise<void> {
    if (!this.browser || !this.options.sessionDir) return;
    
    try {
      // セッションディレクトリの作成
      await fs.mkdir(this.options.sessionDir, { recursive: true });
      
      // Cookieの保存
      const cookies = await this.page?.cookies();
      await fs.writeFile(
        path.join(this.options.sessionDir, 'cookies.json'),
        JSON.stringify(cookies, null, 2)
      );
      
      // ローカルストレージの保存
      const localStorage = await this.page?.evaluate(() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            (items as any)[key] = localStorage.getItem(key);
          }
        }
        return items;
      });
      
      await fs.writeFile(
        path.join(this.options.sessionDir, 'localStorage.json'),
        JSON.stringify(localStorage, null, 2)
      );
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }
  
  /**
   * セッションのロード
   */
  private async loadSession(): Promise<void> {
    if (!this.page || !this.options.sessionDir) return;
    
    try {
      // Cookieのロード
      const cookiesPath = path.join(this.options.sessionDir, 'cookies.json');
      const cookiesContent = await fs.readFile(cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesContent);
      await this.page.setCookie(...cookies);
      
      // ローカルストレージのロード
      const localStoragePath = path.join(this.options.sessionDir, 'localStorage.json');
      const localStorageContent = await fs.readFile(localStoragePath, 'utf-8');
      const localStorage = JSON.parse(localStorageContent);
      
      await this.page.evaluate((data) => {
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, value as string);
        }
      }, localStorage);
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  }
}
