import { exec } from 'child_process';
import { logger } from './utils';
import fs from 'fs/promises';

/**
 * Wezterm/WSL統合モジュール
 * Windows環境でWeztermとWSLを使用している場合の特別な処理を提供
 */

export interface WeztermContext {
  isWeztermEnvironment: boolean;
  wslDistribution?: string | undefined;
  currentWorkingDirectory?: string | undefined;
  windowTitle?: string | undefined;
  terminalPid?: number | undefined;
}

export interface WSLInfo {
  isWSL: boolean;
  distribution?: string | undefined;
  version?: string | undefined;
  windowsPath?: string | undefined;
}

class WeztermIntegration {
  private cachedContext: WeztermContext | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5秒間キャッシュ

  /**
   * Wezterm環境の検出
   */
  async detectWeztermEnvironment(): Promise<WeztermContext> {
    // キャッシュチェック
    if (this.cachedContext && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedContext;
    }

    try {
      const context: WeztermContext = {
        isWeztermEnvironment: false
      };

      // WSL環境の検出
      const wslInfo = await this.detectWSLEnvironment();
      if (wslInfo.isWSL) {
        context.isWeztermEnvironment = true;
        context.wslDistribution = wslInfo.distribution;
      }

      // Windows側でWeztermプロセスの検出
      if (process.platform === 'win32') {
        const weztermProcess = await this.detectWeztermProcess();
        if (weztermProcess) {
          context.isWeztermEnvironment = true;
          context.terminalPid = weztermProcess.pid;
          context.windowTitle = weztermProcess.windowTitle;
        }
      }

      // 現在の作業ディレクトリ取得
      if (context.isWeztermEnvironment) {
        context.currentWorkingDirectory = await this.getCurrentWorkingDirectory();
      }

      this.cachedContext = context;
      this.cacheTimestamp = Date.now();

      logger.debug('Wezterm環境検出結果:', context);
      return context;
    } catch (error) {
      logger.warn('Wezterm環境検出エラー:', error);
      return { isWeztermEnvironment: false };
    }
  }

  /**
   * WSL環境の検出
   */
  private async detectWSLEnvironment(): Promise<WSLInfo> {
    try {
      // /proc/version の確認（WSLの場合、"Microsoft"が含まれる）
      const versionInfo = await fs.readFile('/proc/version', 'utf8').catch(() => '');
      if (versionInfo.includes('Microsoft')) {
        const distribution = await this.getWSLDistribution();
        const version = await this.getWSLVersion();
        const windowsPath = await this.getWindowsPath();

        return {
          isWSL: true,
          distribution,
          version,
          windowsPath
        };
      }

      return { isWSL: false };
    } catch (error) {
      logger.debug('WSL検出エラー:', error);
      return { isWSL: false };
    }
  }

  /**
   * WSLディストリビューション名取得
   */
  private async getWSLDistribution(): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('cat /etc/os-release | grep "^NAME=" | cut -d"=" -f2 | tr -d \'"\'');
      return result.trim() || undefined;
    } catch (error) {
      logger.debug('WSLディストリビューション取得エラー:', error);
      return undefined;
    }
  }

  /**
   * WSLバージョン取得
   */
  private async getWSLVersion(): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('uname -r');
      return result.trim() || undefined;
    } catch (error) {
      logger.debug('WSLバージョン取得エラー:', error);
      return undefined;
    }
  }

  /**
   * WindowsパスからWSLパスへの変換
   */
  private async getWindowsPath(): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('cmd.exe /c "echo %USERPROFILE%"');
      return result.trim().replace('\r', '') || undefined;
    } catch (error) {
      logger.debug('Windowsパス取得エラー:', error);
      return undefined;
    }
  }

  /**
   * Windows側でWeztermプロセス検出
   */
  private async detectWeztermProcess(): Promise<{ pid: number; windowTitle?: string } | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      // PowerShellを使用してWeztermプロセスを検出
      const command = `powershell -Command "Get-Process -Name wezterm-gui -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle | ConvertTo-Json"`;
      const result = await this.executeCommand(command);
      
      if (result.trim()) {
        const processes = JSON.parse(result);
        const processArray = Array.isArray(processes) ? processes : [processes];
        
        for (const proc of processArray) {
          if (proc.Id && proc.MainWindowTitle) {
            return {
              pid: proc.Id,
              windowTitle: proc.MainWindowTitle
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.debug('Weztermプロセス検出エラー:', error);
      return null;
    }
  }

  /**
   * 現在の作業ディレクトリ取得
   */
  private async getCurrentWorkingDirectory(): Promise<string | undefined> {
    try {
      return process.cwd();
    } catch (error) {
      logger.debug('作業ディレクトリ取得エラー:', error);
      return undefined;
    }
  }

  /**
   * Wezterm特有のクリップボード操作
   */
  async handleWeztermClipboard(text: string): Promise<boolean> {
    const context = await this.detectWeztermEnvironment();
    
    if (!context.isWeztermEnvironment) {
      return false;
    }

    try {
      if (context.wslDistribution) {
        // WSL環境の場合：clip.exeを使用してWindowsクリップボードに設定
        await this.executeCommand(`echo '${this.escapeShellString(text)}' | clip.exe`);
        logger.debug('WSL環境でクリップボードに設定:', { textLength: text.length });
        return true;
      } else if (process.platform === 'win32') {
        // Windows環境の場合：PowerShellを使用
        const command = `powershell -Command "Set-Clipboard -Value '${this.escapePowerShellString(text)}'"`;
        await this.executeCommand(command);
        logger.debug('Windows環境でクリップボードに設定:', { textLength: text.length });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Weztermクリップボード操作エラー:', error);
      return false;
    }
  }

  /**
   * Wezterm固有のアプリケーション復元
   */
  async restoreWeztermFocus(): Promise<boolean> {
    const context = await this.detectWeztermEnvironment();
    
    if (!context.isWeztermEnvironment || !context.terminalPid) {
      return false;
    }

    try {
      if (process.platform === 'win32') {
        // PowerShellを使用してWeztermウィンドウをアクティブ化
        const command = `powershell -Command "
          Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'
          $proc = Get-Process -Id ${context.terminalPid} -ErrorAction SilentlyContinue
          if ($proc -and $proc.MainWindowHandle) {
            [Win32]::ShowWindow($proc.MainWindowHandle, 9)  # SW_RESTORE
            [Win32]::SetForegroundWindow($proc.MainWindowHandle)
          }
        "`;
        
        await this.executeCommand(command);
        logger.debug('Weztermウィンドウをアクティブ化:', { pid: context.terminalPid });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Weztermフォーカス復元エラー:', error);
      return false;
    }
  }

  /**
   * Wezterm環境でのペースト操作統合
   */
  async performWeztermPaste(text: string): Promise<boolean> {
    try {
      // クリップボードに設定
      const clipboardSuccess = await this.handleWeztermClipboard(text);
      if (!clipboardSuccess) {
        return false;
      }

      // 短い遅延でクリップボードの設定を確実にする
      await new Promise(resolve => setTimeout(resolve, 50));

      // Weztermにフォーカスを復元
      const focusSuccess = await this.restoreWeztermFocus();
      if (!focusSuccess) {
        logger.warn('Weztermフォーカス復元に失敗しましたが、クリップボードは設定済み');
      }

      // さらに短い遅延でWeztermのCtrl+Shift+Vをシミュレート
      await new Promise(resolve => setTimeout(resolve, 100));

      // WSL環境の場合、Windows native toolを使用してCtrl+Shift+Vを送信
      if (process.platform === 'linux') {
        const { KEYBOARD_SIMULATOR_PATH } = require('./utils');
        const windowsNativeToolPath = require('path').join(require('path').dirname(KEYBOARD_SIMULATOR_PATH), 'keyboard-simulator.exe');
        
        try {
          const command = `"${windowsNativeToolPath}" paste-wezterm`;
          logger.debug('Windows native tool経由でCtrl+Shift+Vを送信', { command });
          
          await this.executeCommand(command, 3000);
          logger.info('Wezterm Ctrl+Shift+V ペースト完了（Windows native tool使用）');
          return true;
        } catch (nativeError) {
          logger.warn('Windows native toolでのCtrl+Shift+V送信に失敗、PowerShellフォールバックを試行', { error: nativeError });
        }
      }

      // Windows環境またはWSLでnative toolが失敗した場合のフォールバック
      if (process.platform === 'win32' || process.platform === 'linux') {
        // PowerShell経由でCtrl+Shift+Vを送信（Wezterm用）
        const command = `powershell -Command "
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait('^+v')
        "`;
        
        await this.executeCommand(command);
        logger.debug('PowerShell経由でWezterm Ctrl+Shift+Vキーを送信');
      }

      return true;
    } catch (error) {
      logger.error('Weztermペースト操作エラー:', error);
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
   * PowerShell文字列のエスケープ
   */
  private escapePowerShellString(str: string): string {
    return str
      .replace(/'/g, "''")
      .replace(/"/g, '""')
      .replace(/`/g, '``')
      .replace(/\$/g, '`$');
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
    this.cachedContext = null;
    this.cacheTimestamp = 0;
  }
}

// シングルトンインスタンス
const weztermIntegration = new WeztermIntegration();

export default weztermIntegration;

// 名前付きエクスポート
export {
  weztermIntegration
};