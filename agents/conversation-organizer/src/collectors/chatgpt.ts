/**
 * ChatGPT会話収集モジュール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseCollector, Conversation, CollectorOptions } from './base.js';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface ChatGPTCollectorOptions extends CollectorOptions {
  /**
   * ChatGPTからエクスポートしたJSONファイルのパス
   */
  exportFilePath?: string;
  
  /**
   * セッションデータが保存されているディレクトリ
   */
  sessionDir?: string;
  
  /**
   * OpenAI認証情報
   */
  auth?: {
    email?: string;
    password?: string;
  };
}

export class ChatGPTCollector extends BaseCollector {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: ChatGPTCollectorOptions;

  constructor(options: ChatGPTCollectorOptions = {}) {
    super(options);
    this.options = options;
  }

  get sourceName(): string {
    return 'chatgpt';
  }

  /**
   * 初期化処理
   */
  async initialize(): Promise<void> {
    // エクスポートファイルがある場合は何もしない
    if (this.options.exportFilePath) {
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
    
    // ChatGPTにアクセス
    await this.page.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });
    
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
    // エクスポートファイルからの読み込み
    if (this.options.exportFilePath) {
      return this.collectFromExportFile();
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
   * エクスポートファイルからの会話収集
   */
  private async collectFromExportFile(): Promise<Conversation[]> {
    if (!this.options.exportFilePath) {
      return [];
    }
    
    try {
      const fileContent = await fs.readFile(this.options.exportFilePath, 'utf-8');
      const exportData = JSON.parse(fileContent);
      
      // ChatGPTのエクスポート形式に合わせて処理
      const conversations: Conversation[] = [];
      
      // エクスポートデータを解析
      // 実際のChatGPTエクスポート形式に合わせて調整が必要
      for (const item of exportData.conversations || []) {
        try {
          const id = item.id || `chatgpt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const title = item.title || 'Untitled Conversation';
          const url = `https://chat.openai.com/c/${id}`;
          const date = item.create_time || new Date().toISOString();
          
          // 会話コンテンツの構築
          let content = '';
          
          for (const message of item.messages || []) {
            const role = message.role || 'unknown';
            const text = message.content?.text || message.content || '';
            content += `${role}: ${text}\n\n`;
          }
          
          conversations.push({
            id,
            source: this.sourceName,
            title,
            url,
            content,
            date,
            metadata: {
              model: item.model || 'unknown',
              messageCount: (item.messages || []).length
            }
          });
          
          this.stats.successCount++;
        } catch (error) {
          console.error('Error processing conversation:', error);
          this.stats.failureCount++;
          this.stats.errors.push(error as Error);
        }
        
        this.stats.processedCount++;
        
        // 最大結果数に達したら終了
        if (conversations.length >= (this.options.maxResults || 100)) {
          break;
        }
      }
      
      return conversations;
    } catch (error) {
      console.error('Error reading export file:', error);
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
      await this.page.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('nav', { timeout: 60000 });
      
      // 会話リストの取得
      const conversationLinks = await this.page.$$eval('nav a', (links) => {
        return links
          .filter(link => link.getAttribute('href')?.startsWith('/c/'))
          .map(link => ({
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
          await this.page.goto(`https://chat.openai.com${link.href}`, { waitUntil: 'networkidle2' });
          await this.page.waitForSelector('.markdown', { timeout: 30000 });
          
          // 会話内容の取得
          const messages = await this.page.$$eval('.markdown', (elements) => {
            return elements.map(el => el.textContent?.trim() || '');
          });
          
          // 質問内容の取得
          const questions = await this.page.$$eval('[data-message-author-role="user"]', (elements) => {
            return elements.map(el => el.textContent?.trim() || '');
          });
          
          // 会話内容の構築
          let content = '';
          for (let j = 0; j < Math.max(questions.length, messages.length); j++) {
            if (j < questions.length) {
              content += `User: ${questions[j]}\n\n`;
            }
            if (j < messages.length) {
              content += `Assistant: ${messages[j]}\n\n`;
            }
          }
          
          // 会話メタデータの取得
          const dateText = await this.page.$eval('time', (el) => el.textContent?.trim() || '');
          const date = dateText ? new Date(dateText).toISOString() : new Date().toISOString();
          
          conversations.push({
            id: conversationId,
            source: this.sourceName,
            title: link.title,
            url: `https://chat.openai.com${link.href}`,
            content,
            date,
            metadata: {
              messageCount: Math.max(questions.length, messages.length)
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
      // ログイン状態のチェック（例: ナビゲーションメニューの存在）
      const navExists = await this.page.evaluate(() => {
        return !!document.querySelector('nav');
      });
      
      // ログインボタンの存在チェック
      const loginButtonExists = await this.page.evaluate(() => {
        return !!document.querySelector('button:not(.cf-im-loginButton)');
      });
      
      return navExists && !loginButtonExists;
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
      // ログインページに移動
      await this.page.waitForSelector('button:not(.cf-im-loginButton)', { timeout: 10000 });
      await this.page.click('button:not(.cf-im-loginButton)');
      
      // メールアドレス入力
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await this.page.type('input[name="username"]', email);
      await this.page.click('button[type="submit"]');
      
      // パスワード入力
      await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });
      await this.page.type('input[name="password"]', password);
      await this.page.click('button[type="submit"]');
      
      // ログイン完了を待機
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      
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
