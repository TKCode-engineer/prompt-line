import { logger } from '../utils/utils';
import weztermIntegration, { WeztermContext } from '../utils/wezterm-integration';
import { exec } from 'child_process';

/**
 * プラットフォーム固有の機能を管理するマネージャー
 * Windows/macOS/Linux間の差異を抽象化し、統一されたインターフェースを提供
 */

export interface PlatformCapabilities {
  supportsNativeWindowDetection: boolean;
  supportsNativeKeyboardSimulation: boolean;
  supportsNativeTextFieldDetection: boolean;
  supportsClipboardIntegration: boolean;
  supportsAppActivation: boolean;
  requiresSpecialTerminalHandling: boolean;
}

export interface PlatformInfo {
  platform: 'darwin' | 'win32' | 'linux';
  platformName: string;
  capabilities: PlatformCapabilities;
  weztermContext?: WeztermContext | undefined;
  specialEnvironment?: string | undefined;
}

class PlatformManager {
  private cachedPlatformInfo: PlatformInfo | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 10000; // 10秒間キャッシュ

  async initialize(): Promise<void> {
    try {
      logger.info('PlatformManager初期化中...');
      
      // プラットフォーム情報の初期化
      await this.getPlatformInfo();
      
      logger.info('PlatformManager初期化完了');
    } catch (error) {
      logger.error('PlatformManager初期化エラー:', error);
      throw error;
    }
  }

  /**
   * プラットフォーム情報の取得
   */
  async getPlatformInfo(): Promise<PlatformInfo> {
    // キャッシュチェック
    if (this.cachedPlatformInfo && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedPlatformInfo;
    }

    try {
      const platform = process.platform as 'darwin' | 'win32' | 'linux';
      let platformName: string;
      let capabilities: PlatformCapabilities;
      let weztermContext: WeztermContext | undefined;
      let specialEnvironment: string | undefined;

      // プラットフォーム別の設定
      switch (platform) {
        case 'darwin':
          platformName = 'macOS';
          capabilities = {
            supportsNativeWindowDetection: true,
            supportsNativeKeyboardSimulation: true,
            supportsNativeTextFieldDetection: true,
            supportsClipboardIntegration: true,
            supportsAppActivation: true,
            requiresSpecialTerminalHandling: false
          };
          break;

        case 'win32':
          platformName = 'Windows';
          // Wezterm環境の検出
          weztermContext = await weztermIntegration.detectWeztermEnvironment();
          
          capabilities = {
            supportsNativeWindowDetection: true,
            supportsNativeKeyboardSimulation: true,
            supportsNativeTextFieldDetection: true,
            supportsClipboardIntegration: true,
            supportsAppActivation: true,
            requiresSpecialTerminalHandling: weztermContext.isWeztermEnvironment
          };

          if (weztermContext.isWeztermEnvironment) {
            specialEnvironment = weztermContext.wslDistribution 
              ? `Wezterm+WSL(${weztermContext.wslDistribution})`
              : 'Wezterm';
          }
          break;

        case 'linux':
          platformName = 'Linux';
          capabilities = {
            supportsNativeWindowDetection: false, // X11/Waylandサポートは今後の課題
            supportsNativeKeyboardSimulation: false,
            supportsNativeTextFieldDetection: false,
            supportsClipboardIntegration: true,
            supportsAppActivation: false,
            requiresSpecialTerminalHandling: false
          };
          break;

        default:
          throw new Error(`サポートされていないプラットフォーム: ${platform}`);
      }

      const platformInfo: PlatformInfo = {
        platform,
        platformName,
        capabilities,
        weztermContext,
        specialEnvironment
      };

      this.cachedPlatformInfo = platformInfo;
      this.cacheTimestamp = Date.now();

      logger.debug('プラットフォーム情報:', platformInfo);
      return platformInfo;
    } catch (error) {
      logger.error('プラットフォーム情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * プラットフォーム固有のペースト操作
   */
  async performPlatformSpecificPaste(text: string, previousApp?: any): Promise<boolean> {
    const platformInfo = await this.getPlatformInfo();

    try {
      // Wezterm環境の場合
      if (platformInfo.capabilities.requiresSpecialTerminalHandling && platformInfo.weztermContext) {
        const success = await weztermIntegration.performWeztermPaste(text);
        if (success) {
          logger.info('Wezterm統合ペースト成功');
          return true;
        } else {
          logger.warn('Wezterm統合ペースト失敗、フォールバック処理');
        }
      }

      // macOSの場合
      if (platformInfo.platform === 'darwin') {
        if (previousApp && platformInfo.capabilities.supportsAppActivation) {
          const { activateAndPasteWithNativeTool } = await import('../utils/utils');
          await activateAndPasteWithNativeTool(previousApp);
          logger.info('macOSネイティブペースト成功');
          return true;
        }
      }

      // Windows標準の場合
      if (platformInfo.platform === 'win32') {
        return await this.performWindowsPaste(text);
      }

      // Linuxの場合
      if (platformInfo.platform === 'linux') {
        return await this.performLinuxPaste(text);
      }

      return false;
    } catch (error) {
      logger.error('プラットフォーム固有ペースト操作エラー:', error);
      return false;
    }
  }

  /**
   * Windows標準のペースト操作
   */
  private async performWindowsPaste(text: string): Promise<boolean> {
    try {
      // PowerShellを使用してクリップボードに設定
      const escapedText = text.replace(/'/g, "''").replace(/"/g, '""');
      const command = `powershell -Command "Set-Clipboard -Value '${escapedText}'"`;
      
      await this.executeCommand(command);
      
      // 短い遅延
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Ctrl+Vキーの送信
      const pasteCommand = `powershell -Command "
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('^v')
      "`;
      
      await this.executeCommand(pasteCommand);
      logger.debug('Windows標準ペースト操作完了');
      return true;
    } catch (error) {
      logger.error('Windows標準ペースト操作エラー:', error);
      return false;
    }
  }

  /**
   * Linuxのペースト操作
   */
  private async performLinuxPaste(text: string): Promise<boolean> {
    try {
      // xclipまたはxselを使用してクリップボードに設定
      const hasXclip = await this.commandExists('xclip');
      const hasXsel = await this.commandExists('xsel');
      
      if (hasXclip) {
        await this.executeCommand(`echo '${this.escapeShellString(text)}' | xclip -selection clipboard`);
      } else if (hasXsel) {
        await this.executeCommand(`echo '${this.escapeShellString(text)}' | xsel --clipboard --input`);
      } else {
        logger.warn('xclipまたはxselが見つかりません');
        return false;
      }

      logger.debug('Linuxクリップボード設定完了');
      return true;
    } catch (error) {
      logger.error('Linuxペースト操作エラー:', error);
      return false;
    }
  }

  /**
   * プラットフォーム固有のウィンドウ検出
   */
  async getActiveWindowInfo(): Promise<any> {
    const platformInfo = await this.getPlatformInfo();

    if (!platformInfo.capabilities.supportsNativeWindowDetection) {
      return null;
    }

    try {
      if (platformInfo.platform === 'darwin') {
        const { getActiveWindowBounds } = await import('../utils/utils');
        return await getActiveWindowBounds();
      }

      if (platformInfo.platform === 'win32') {
        // Windows版のウィンドウ検出を実装予定
        // 現在はnullを返す
        return null;
      }

      return null;
    } catch (error) {
      logger.error('ウィンドウ情報取得エラー:', error);
      return null;
    }
  }

  /**
   * プラットフォーム固有のアプリ検出
   */
  async getCurrentAppInfo(): Promise<any> {
    const platformInfo = await this.getPlatformInfo();

    try {
      if (platformInfo.platform === 'darwin') {
        const { getCurrentApp } = await import('../utils/utils');
        return await getCurrentApp();
      }

      if (platformInfo.platform === 'win32') {
        // Windows版のアプリ検出を実装予定
        // 現在はnullを返す
        return null;
      }

      return null;
    } catch (error) {
      logger.error('現在のアプリ情報取得エラー:', error);
      return null;
    }
  }

  /**
   * コマンドの存在確認
   */
  private async commandExists(command: string): Promise<boolean> {
    try {
      await this.executeCommand(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * シェル文字列のエスケープ
   */
  private escapeShellString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  /**
   * コマンド実行ヘルパー
   */
  private executeCommand(command: string, timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { timeout, encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout || '');
        }
      });
    });
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.cachedPlatformInfo = null;
    this.cacheTimestamp = 0;
    weztermIntegration.clearCache();
  }

  /**
   * 破棄
   */
  destroy(): void {
    this.clearCache();
    logger.debug('PlatformManager破棄完了');
  }
}

export default PlatformManager;