import { app, globalShortcut, Tray, Menu, nativeImage, shell } from 'electron';
import fs from 'fs';
import path from 'path';

// Optimized macOS configuration for performance and IMK error prevention
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
  
  // Security warnings: enabled in all environments for better security
  // Note: Security warnings help identify potential security issues
  // Explicitly enable security warnings in all environments
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'false';
  
  process.env.ELECTRON_ENABLE_LOGGING = 'false';
  process.noDeprecation = true;
}

// WSL/Linux IME support configuration
if (process.platform === 'linux') {
  // Enable X11 input method integration for IME support
  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
  app.commandLine.appendSwitch('ozone-platform', 'x11');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  
  // GPU-related fixes for WSL/Linux environment stability
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-plugins');
  
  // Enable logging for IME debugging in development
  if (process.env.NODE_ENV === 'development') {
    process.env.ELECTRON_ENABLE_LOGGING = 'true';
  }
  
  // Disable security warnings in WSL development environment
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

import config from './config/app-config';
import WindowManager from './managers/window-manager';
import HistoryManager from './managers/history-manager';
import OptimizedHistoryManager from './managers/optimized-history-manager';
import DraftManager from './managers/draft-manager';
import SettingsManager from './managers/settings-manager';
import IPCHandlers from './handlers/ipc-handlers';
import { logger, ensureDir } from './utils/utils';
import type { WindowData } from './types';

class PromptLineApp {
  private windowManager: WindowManager | null = null;
  private historyManager: HistoryManager | OptimizedHistoryManager | null = null;
  private draftManager: DraftManager | null = null;
  private settingsManager: SettingsManager | null = null;
  private ipcHandlers: IPCHandlers | null = null;
  private tray: Tray | null = null;
  private isInitialized = false;
  private lockFilePath: string | null = null;
  private processMonitoringInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Prompt Line...');

      await ensureDir(config.paths.userDataDir);
      await ensureDir(config.paths.imagesDir);
      logger.info('Data directories ensured at:', config.paths.userDataDir);

      // WSL環境でのプロセス追跡用ロックファイル作成
      if (process.platform === 'linux') {
        await this.cleanupStaleProcessLockFiles();
        await this.createProcessLockFile();
      }

      this.windowManager = new WindowManager();
      this.draftManager = new DraftManager();
      this.settingsManager = new SettingsManager();

      await this.windowManager.initialize();
      await this.draftManager.initialize();
      await this.settingsManager.init();

      const userSettings = this.settingsManager.getSettings();
      
      // デフォルトで無制限履歴機能（OptimizedHistoryManager）を使用
      logger.info('Using OptimizedHistoryManager (unlimited history by default)');
      this.historyManager = new OptimizedHistoryManager();
      
      await this.historyManager.initialize();
      
      this.windowManager.updateWindowSettings(userSettings.window);

      this.ipcHandlers = new IPCHandlers(
        this.windowManager,
        this.historyManager,
        this.draftManager,
        this.settingsManager
      );


      // Note: Window is now pre-created during WindowManager initialization
      this.registerShortcuts();
      this.createTray();
      this.setupAppEventListeners();
      this.setupWSLProcessMonitoring();

      if (config.platform.isMac && app.dock) {
        app.dock.hide();
      }

      this.isInitialized = true;

      const historyStats = this.historyManager.getHistoryStats();
      const settings = this.settingsManager.getSettings();
      
      logger.info('Prompt Line initialized successfully', {
        historyItems: historyStats.totalItems,
        hasDraft: this.draftManager.hasDraft(),
        platform: process.platform
      });

      console.log('\n=== Prompt Line ===');
      console.log(`Shortcut: ${settings.shortcuts.main}`);
      console.log('Usage: Enter text and press Cmd+Enter to paste');
      console.log(`History: ${historyStats.totalItems} items loaded`);
      console.log('Exit: Ctrl+C\n');

      // WSL環境では初期化完了後に自動でウィンドウを表示（デスクトップアプリの標準動作）
      if (process.platform === 'linux') {
        logger.info('WSL environment: Auto-showing window after initialization');
        await this.showInputWindow();
      }

    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  // WSL環境でのプロセス追跡用ロックファイル作成
  private async createProcessLockFile(): Promise<void> {
    try {
      const timestamp = Date.now();
      const lockFileName = `.prompt-line-${process.pid}-${timestamp}.lock`;
      this.lockFilePath = path.join(process.cwd(), lockFileName);
      
      // プロセスPIDをロックファイルに書き込み
      await fs.promises.writeFile(this.lockFilePath, process.pid.toString(), 'utf8');
      logger.info('Process lock file created', { 
        lockFile: this.lockFilePath, 
        pid: process.pid 
      });
    } catch (error) {
      logger.error('Failed to create process lock file:', error);
    }
  }

  // 古いロックファイルのクリーンアップ
  private async cleanupStaleProcessLockFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(process.cwd());
      const lockFiles = files.filter(file => file.startsWith('.prompt-line-') && file.endsWith('.lock'));
      
      for (const lockFile of lockFiles) {
        try {
          const lockPath = path.join(process.cwd(), lockFile);
          const pidStr = await fs.promises.readFile(lockPath, 'utf8');
          const pid = parseInt(pidStr.trim(), 10);
          
          if (isNaN(pid)) {
            // 無効なPIDファイルは削除
            await fs.promises.unlink(lockPath);
            logger.debug('Removed invalid lock file:', lockFile);
            continue;
          }
          
          // プロセスが存在するかチェック
          try {
            process.kill(pid, 0); // シグナル0でプロセス存在確認
          } catch {
            // プロセスが存在しない場合、ロックファイルを削除
            await fs.promises.unlink(lockPath);
            logger.debug('Removed stale lock file for dead process:', { lockFile, pid });
          }
        } catch (error) {
          logger.warn('Error processing lock file:', { 
            lockFile, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup stale lock files:', error);
    }
  }

  // WSL環境でのプロセス監視機能
  private setupWSLProcessMonitoring(): void {
    if (process.platform !== 'linux') return;

    try {
      // WSL環境の検出
      const parentPid = process.ppid;
      if (!parentPid) return;

      logger.info('Setting up WSL process monitoring', { parentPid });

      // 親プロセス（通常はWezterm）の監視
      const checkParentProcess = () => {
        try {
          // 親プロセスの存在確認
          process.kill(parentPid, 0);
        } catch {
          logger.info('Parent process terminated, shutting down Prompt Line');
          this.cleanup();
          app.quit();
        }
      };

      // 5秒間隔で親プロセスをチェック
      this.processMonitoringInterval = setInterval(checkParentProcess, 5000);

      // アプリ終了時にインターバルをクリア
      app.once('before-quit', () => {
        if (this.processMonitoringInterval) {
          clearInterval(this.processMonitoringInterval);
          this.processMonitoringInterval = null;
        }
      });

      logger.info('WSL process monitoring enabled');
    } catch (error) {
      logger.warn('Failed to setup WSL process monitoring:', error);
    }
  }

  private registerShortcuts(): void {
    try {
      const settings = this.settingsManager?.getSettings();
      const mainShortcut = settings?.shortcuts.main || config.shortcuts.main;
      
      // WSL環境ではElectronのglobalShortcutが機能しないため、シグナルベースのアクティベーションのみ使用
      if (process.platform === 'linux') {
        logger.info('WSL environment detected: Global shortcuts disabled, using SIGUSR1 signal activation instead');
        logger.info('Use ./activate-prompt-line.sh or configure Wezterm keybind for', mainShortcut);
        return;
      }
      
      const mainRegistered = globalShortcut.register(mainShortcut, async () => {
        await this.showInputWindow();
      });

      if (mainRegistered) {
        logger.info('Global shortcut registered:', mainShortcut);
      } else {
        logger.error('Failed to register global shortcut:', mainShortcut);
        throw new Error(`Failed to register shortcut: ${mainShortcut}`);
      }
    } catch (error) {
      logger.error('Error registering shortcuts:', error);
      throw error;
    }
  }

  private async openSettingsFile(): Promise<void> {
    try {
      if (!this.settingsManager) {
        logger.warn('Settings manager not initialized');
        return;
      }

      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      logger.info('Opening settings file:', settingsFilePath);
      
      await shell.openPath(settingsFilePath);
    } catch (error) {
      logger.error('Failed to open settings file:', error);
    }
  }

  private createTray(): void {
    try {
      // Create icon from multiple resolutions for better display quality
      const iconPath22 = path.join(__dirname, '..', 'assets', 'icon-tray-22.png');
      const iconPath44 = path.join(__dirname, '..', 'assets', 'icon-tray-44.png');
      const iconPath88 = path.join(__dirname, '..', 'assets', 'icon-tray-88.png');
      
      // Create empty image and add representations
      const icon = nativeImage.createEmpty();
      
      // Check if files exist and add representations
      if (fs.existsSync(iconPath22)) {
        icon.addRepresentation({
          scaleFactor: 1.0,
          width: 22,
          height: 22,
          buffer: fs.readFileSync(iconPath22)
        });
      }
      
      if (fs.existsSync(iconPath44)) {
        icon.addRepresentation({
          scaleFactor: 2.0,
          width: 44,
          height: 44,
          buffer: fs.readFileSync(iconPath44)
        });
      }
      
      if (fs.existsSync(iconPath88)) {
        icon.addRepresentation({
          scaleFactor: 4.0,
          width: 88,
          height: 88,
          buffer: fs.readFileSync(iconPath88)
        });
      }
      
      icon.setTemplateImage(true); // Make it a template image for proper macOS menu bar appearance
      this.tray = new Tray(icon);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Prompt Line',
          click: async () => {
            await this.showInputWindow();
          }
        },
        {
          label: 'Hide Window',
          click: async () => {
            await this.hideInputWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: async () => {
            await this.openSettingsFile();
          }
        },
        { type: 'separator' },
        {
          label: `Version ${config.app.version}`,
          enabled: false
        },
        {
          label: 'Release Notes',
          click: () => {
            shell.openExternal('https://github.com/nkmr-jp/prompt-line/blob/main/CHANGELOG.md');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit Prompt Line',
          click: () => {
            this.quitApp();
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);
      const settings = this.settingsManager?.getSettings();
      const shortcut = settings?.shortcuts.main || config.shortcuts.main;
      this.tray.setToolTip('Prompt Line - Press ' + shortcut + ' to open');
      
      this.tray.on('double-click', async () => {
        await this.showInputWindow();
      });

      logger.info('System tray created successfully');
    } catch (error) {
      logger.error('Failed to create system tray:', error);
      throw error;
    }
  }

  private quitApp(): void {
    logger.info('Quit requested from tray menu');
    app.quit();
  }

  private setupAppEventListeners(): void {
    // WSL環境用のシグナルハンドラー（グローバルショートカット代替）
    process.on('SIGUSR1', async () => {
      logger.info('Received SIGUSR1 signal - showing input window');
      await this.showInputWindow();
    });

    app.on('will-quit', (event) => {
      event.preventDefault();
      this.cleanup().finally(() => {
        app.exit(0);
      });
    });

    app.on('window-all-closed', () => {
      logger.debug('All windows closed, keeping app running in background');
    });

    app.on('activate', async () => {
      if (config.platform.isMac) {
        await this.showInputWindow();
      }
    });

    app.on('before-quit', async (_event) => {
      logger.info('Application is about to quit');
      
      const savePromises: Promise<unknown>[] = [];
      
      if (this.draftManager && this.draftManager.hasDraft()) {
        savePromises.push(
          this.draftManager.saveDraftImmediately(this.draftManager.getCurrentDraft())
        );
      }
      
      if (this.historyManager) {
        savePromises.push(this.historyManager.flushPendingSaves());
      }
      
      try {
        await Promise.allSettled(savePromises);
        logger.info('Critical data saved before quit');
      } catch (error) {
        logger.error('Error saving critical data before quit:', error);
      }
    });
  }

  async showInputWindow(): Promise<void> {
    try {
      if (!this.isInitialized || !this.windowManager || !this.historyManager || !this.draftManager || !this.settingsManager) {
        logger.warn('App not initialized, cannot show window');
        return;
      }

      const draft = this.draftManager.getCurrentDraft();
      const settings = this.settingsManager.getSettings();
      const history = this.historyManager.getHistory();
      const windowData: WindowData = {
        history,
        draft: draft || null,
        settings
      };

      await this.windowManager.showInputWindow(windowData);
      logger.debug('Input window shown with data', {
        historyItems: windowData.history?.length || 0,
        hasDraft: !!windowData.draft
      });
    } catch (error) {
      logger.error('Failed to show input window:', error);
    }
  }

  async hideInputWindow(): Promise<void> {
    try {
      if (this.windowManager) {
        await this.windowManager.hideInputWindow();
        logger.debug('Input window hidden');
      }
    } catch (error) {
      logger.error('Failed to hide input window:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up application resources...');

      const cleanupPromises: Promise<unknown>[] = [];

      // プロセス監視インターバルの停止
      if (this.processMonitoringInterval) {
        clearInterval(this.processMonitoringInterval);
        this.processMonitoringInterval = null;
        logger.debug('Process monitoring interval cleared');
      }

      // ロックファイルの削除
      if (this.lockFilePath) {
        try {
          await fs.promises.unlink(this.lockFilePath);
          logger.debug('Process lock file removed:', this.lockFilePath);
        } catch (error) {
          logger.warn('Failed to remove lock file:', error);
        }
        this.lockFilePath = null;
      }

      globalShortcut.unregisterAll();

      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
        logger.debug('System tray destroyed');
      }

      if (this.ipcHandlers) {
        cleanupPromises.push(
          Promise.resolve(this.ipcHandlers.removeAllHandlers())
        );
      }

      if (this.draftManager) {
        cleanupPromises.push(this.draftManager.destroy());
      }

      if (this.historyManager) {
        cleanupPromises.push(this.historyManager.destroy());
      }

      if (this.windowManager) {
        cleanupPromises.push(
          Promise.resolve(this.windowManager.destroy())
        );
      }

      await Promise.allSettled(cleanupPromises);

      logger.info('Application cleanup completed (optimized)');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  async restart(): Promise<void> {
    try {
      logger.info('Restarting application...');
      await this.cleanup();
      await this.initialize();
      logger.info('Application restarted successfully');
    } catch (error) {
      logger.error('Failed to restart application:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized && app.isReady();
  }

}

const promptLineApp = new PromptLineApp();

app.whenReady().then(async () => {
  try {
    await promptLineApp.initialize();
  } catch (error) {
    logger.error('Application failed to start:', error);
    console.error('❌ Application failed to start:', error);
    app.quit();
  }
});

// WSL multi-instance support - removed single instance lock
// Each WSL window can have its own Prompt Line instance
logger.info('Multi-instance mode enabled for WSL compatibility');

app.on('second-instance', async (_event, commandLine, workingDirectory) => {
  logger.info('Second instance detected', { 
    commandLine: commandLine.slice(-3), // 最後の3つの引数のみログ出力
    workingDirectory 
  });
  
  // 初期化完了後のみウィンドウを表示（起動時の自動表示を防ぐ）
  if (promptLineApp.isReady()) {
    logger.info('Application ready - showing window for second instance');
    await promptLineApp.showInputWindow();
  } else {
    logger.info('Application not ready - ignoring second instance window request during initialization');
  }
});

export default promptLineApp;