import { logger } from '../utils/utils';
import path from 'path';
import os from 'os';

/**
 * プラットフォーム固有の設定管理
 */

export interface PlatformPaths {
  userDataDir: string;
  historyFile: string;
  draftFile: string;
  logFile: string;
  imagesDir: string;
  settingsFile: string;
  nativeToolsDir: string;
}

export interface PlatformShortcuts {
  main: string;
  paste: string;
  close: string;
  historyNext: string;
  historyPrev: string;
}

export interface PlatformSpecificConfig {
  platform: 'darwin' | 'win32' | 'linux';
  paths: PlatformPaths;
  shortcuts: PlatformShortcuts;
  windowDefaults: {
    position: string;
    width: number;
    height: number;
  };
  nativeTools: {
    windowDetector: string;
    keyboardSimulator: string;
    textFieldDetector: string;
  };
}

class PlatformConfig {
  private config: PlatformSpecificConfig;

  constructor() {
    this.config = this.generatePlatformConfig();
    logger.debug('プラットフォーム設定初期化:', {
      platform: this.config.platform,
      userDataDir: this.config.paths.userDataDir
    });
  }

  private generatePlatformConfig(): PlatformSpecificConfig {
    const platform = process.platform as 'darwin' | 'win32' | 'linux';
    const userDataDir = path.join(os.homedir(), '.prompt-line');

    // プラットフォーム別のベースパス設定
    const paths: PlatformPaths = {
      userDataDir,
      historyFile: path.join(userDataDir, 'history.jsonl'),
      draftFile: path.join(userDataDir, 'draft.json'),
      logFile: path.join(userDataDir, 'app.log'),
      imagesDir: path.join(userDataDir, 'images'),
      settingsFile: path.join(userDataDir, 'settings.yml'),
      nativeToolsDir: this.getNativeToolsDir()
    };

    // プラットフォーム別のショートカット設定
    const shortcuts: PlatformShortcuts = this.getPlatformShortcuts(platform);

    // ネイティブツールのパス設定
    const nativeTools = this.getNativeToolsPaths(platform, paths.nativeToolsDir);

    return {
      platform,
      paths,
      shortcuts,
      windowDefaults: {
        position: 'active-text-field',
        width: 600,
        height: 300
      },
      nativeTools
    };
  }

  private getPlatformShortcuts(platform: string): PlatformShortcuts {
    switch (platform) {
      case 'darwin':
        return {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k'
        };
      
      case 'win32':
        return {
          main: 'Ctrl+Shift+Space',
          paste: 'Ctrl+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k'
        };
      
      case 'linux':
        return {
          main: 'Ctrl+Shift+Space',
          paste: 'Ctrl+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k'
        };
      
      default:
        logger.warn('サポートされていないプラットフォーム、デフォルト設定を使用:', platform);
        return {
          main: 'Ctrl+Shift+Space',
          paste: 'Ctrl+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k'
        };
    }
  }

  private getNativeToolsDir(): string {
    const { app } = require('electron');
    
    if (app && app.isPackaged) {
      // パッケージ化された環境
      const appPath = app.getAppPath();
      const resourcesPath = path.dirname(appPath);
      return path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native-tools');
    } else {
      // 開発環境
      return path.join(__dirname, '..', 'native-tools');
    }
  }

  private getNativeToolsPaths(platform: string, nativeToolsDir: string) {
    const extension = platform === 'win32' ? '.exe' : '';
    
    return {
      windowDetector: path.join(nativeToolsDir, `window-detector${extension}`),
      keyboardSimulator: path.join(nativeToolsDir, `keyboard-simulator${extension}`),
      textFieldDetector: path.join(nativeToolsDir, `text-field-detector${extension}`)
    };
  }

  /**
   * プラットフォーム設定の取得
   */
  getConfig(): PlatformSpecificConfig {
    return { ...this.config };
  }

  /**
   * パス設定の取得
   */
  getPaths(): PlatformPaths {
    return { ...this.config.paths };
  }

  /**
   * ショートカット設定の取得
   */
  getShortcuts(): PlatformShortcuts {
    return { ...this.config.shortcuts };
  }

  /**
   * ネイティブツールパスの取得
   */
  getNativeTools() {
    return { ...this.config.nativeTools };
  }

  /**
   * プラットフォーム名の取得
   */
  getPlatform(): string {
    return this.config.platform;
  }

  /**
   * プラットフォーム固有の設定値取得
   */
  getValue(key: string): unknown {
    const keys = key.split('.');
    let current: any = this.config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * プラットフォーム判定ヘルパー
   */
  isMac(): boolean {
    return this.config.platform === 'darwin';
  }

  isWindows(): boolean {
    return this.config.platform === 'win32';
  }

  isLinux(): boolean {
    return this.config.platform === 'linux';
  }

  /**
   * ネイティブツール対応プラットフォーム判定
   */
  supportsNativeTools(): boolean {
    return this.isMac() || this.isWindows();
  }

  /**
   * テキストフィールド検出対応プラットフォーム判定
   */
  supportsTextFieldDetection(): boolean {
    return this.isMac() || this.isWindows();
  }

  /**
   * アプリアクティベーション対応プラットフォーム判定
   */
  supportsAppActivation(): boolean {
    return this.isMac() || this.isWindows();
  }
}

// シングルトンインスタンス
const platformConfig = new PlatformConfig();

export default platformConfig;