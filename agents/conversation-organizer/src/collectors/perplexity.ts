/**
 * Perplexity会話収集モジュール
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseCollector, Conversation, CollectorOptions } from './base.js';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface PerplexityCollectorOptions extends CollectorOptions {
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
    googleAuth?: boolean;
  };
}

export class PerplexityCollector extends BaseCollector {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: PerplexityCollectorOptions;
  
  constructor(options: PerplexityCollectorOptions = {}) {
    super(options);
    this.options = options;
  }
  
  get sourceName(): string {
    return 'perplexity';
  }
  
  /**
   * 初期化処理
   */
  async initialize(): Promise<void> {
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
    
    // Perplexityにアクセス
    await this.page.goto('https://www.perplexity.ai/', { waitUntil: 'networkidle2' });
    
    // ログインが必要かチェック
    const isLoggedIn = await this.checkIfLoggedIn();
    
    if (!isLoggedIn) {
      if (!this.options.auth?.email || !this.options.auth?.password) {
        throw new Error('Authentication required but credentials not provided');
      }
      
      await this.login(
        this.options.auth.email,
        this.options.auth.password,
        this.options.auth.googleAuth || false
      );
      
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
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    const conversations: Conversation[] = [];
    
    try {
      // 履歴ページに移動
      await this.page.goto('https://www.perplexity.ai/history', { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('.history-item', { timeout: 30000 });
      
      // 会話リンクの取得
      const conversationLinks = await this.page.$$eval('.history-item a', (links) => {
        return links.map(link => ({
          href: link.getAttribute('href') || '',
          title: link.querySelector('.history-title')?.textContent?.trim() || 'Untitled',
          date: link.querySelector('.history-date')?.textContent?.trim() || ''
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
          await this.page.goto(`https://www.perplexity.ai${link.href}`, { waitUntil: 'networkidle2' });
          
          // 会話内容の取得
          await this.page.waitForSelector('.query-text, .answer-text', { timeout: 30000 });
          
          const queries = await this.page.$$eval('.query-text', (elements) => {
            return elements.map(el => el.textContent?.trim() || '');
          });
          
          const answers = await this.page.$$eval('.answer-text', (elements) => {
            return elements.map(el => el.textContent?.trim() || '');
          });
          
          // 会話内容の構築
          let content = '';
          for (let j = 0; j < Math.max(queries.length, answers.length); j++) {
            if (j < queries.length) {
              content += `User: ${queries[j]}\n\n`;
            }
            if (j < answers.length) {
              content += `Assistant: ${answers[j]}\n\n`;
            }
          }
          
          // 日付のパース (例: "2 days ago" -> ISO日付)
          let dateStr = link.date;
          let date = new Date().toISOString();
          if (dateStr) {
            try {
              if (dateStr.includes('minute') || dateStr.includes('hour')) {
                // 今日の日付を使用
                date = new Date().toISOString();
              } else if (dateStr.includes('yesterday')) {
                // 昨日の日付を使用
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                date = yesterday.toISOString();
              } else if (dateStr.includes('day')) {
                // X日前
                const match = dateStr.match(/(\d+)\s+day/);
                if (match && match[1]) {
                  const daysAgo = parseInt(match[1], 10);
                  const pastDate = new Date();
                  pastDate.setDate(pastDate.getDate() - daysAgo);
                  date = pastDate.toISOString();
                }
              } else {
                // その他のフォーマットは現在の日付を使用
                date = new Date().toISOString();
              }
            } catch (error) {
              console.warn(`Could not parse date: ${dateStr}`, error);
              // デフォルトは現在の日付
              date = new Date().toISOString();
            }
          }
          
          conversations.push({
            id: conversationId,
            source: this.sourceName,
            title: link.title,
            url: `https://www.perplexity.ai${link.href}`,
            content,
            date,
            metadata: {
              messageCount: Math.max(queries.length, answers.length)
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
      console.error('Error collecting conversations from Perplexity:', error);
      throw error;
    }
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
   * ユーザーがログイン済みかチェック
   */
  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // ログイン状態のチェック（例: ユーザーアイコンの有無）
      return await this.page.evaluate(() => {
        return !!document.querySelector('.user-avatar') && !document.querySelector('.login-button');
      });
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }
  
  /**
   * ログイン処理
   */
  private async login(email: string, password: string, useGoogleAuth: boolean = false): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // ログインボタンをクリック
      await this.page.waitForSelector('.login-button', { timeout: 10000 });
      await this.page.click('.login-button');
      
      if (useGoogleAuth) {
        // Google認証を使用
        await this.page.waitForSelector('button.google-login', { timeout: 10000 });
        await this.page.click('button.google-login');
        
        // Googleログインフォームに入力
        await this.page.waitForSelector('input[type="email"]', { timeout: 20000 });
        await this.page.type('input[type="email"]', email);
        await this.page.click('#identifierNext');
        
        await this.page.waitForSelector('input[type="password"]', { timeout: 20000 });
        await this.page.type('input[type="password"]', password);
        await this.page.click('#passwordNext');
      } else {
        // メールアドレス認証を使用
        await this.page.waitForSelector('button.email-login', { timeout: 10000 });
        await this.page.click('button.email-login');
        
        // メールアドレス入力
        await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await this.page.type('input[type="email"]', email);
        await this.page.click('button[type="submit"]');
        
        // パスワード入力
        await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await this.page.type('input[type="password"]', password);
        await this.page.click('button[type="submit"]');
      }
      
      // ログイン完了を待機
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
