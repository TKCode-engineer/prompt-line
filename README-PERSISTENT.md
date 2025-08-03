# Prompt Line 永続化セットアップガイド

毎回 `npm start` する手間を省くため、Prompt Line の永続起動システムを実装しました。

## 🚀 使用方法

### 基本的な使用方法

```bash
# Prompt Line を起動
./start-prompt-line-persistent.sh start

# 状態確認
./start-prompt-line-persistent.sh status

# 停止
./start-prompt-line-persistent.sh stop

# 再起動
./start-prompt-line-persistent.sh restart

# ログ表示
./start-prompt-line-persistent.sh logs
```

### 自動起動の設定

#### 方法1: bashrc による自動起動 (推奨)

```bash
# ~/.bashrc の最後に追加
echo "source /home/taka/workspace/prompt-line/auto-start-prompt-line.sh" >> ~/.bashrc

# または手動で ~/.bashrc に以下を追加:
source /home/taka/workspace/prompt-line/auto-start-prompt-line.sh
```

#### 方法2: systemd サービス (上級者向け)

```bash
# サービスファイルをコピー
sudo cp systemd-prompt-line.service /etc/systemd/system/

# サービス有効化
sudo systemctl enable prompt-line.service

# サービス開始
sudo systemctl start prompt-line.service

# 状態確認
sudo systemctl status prompt-line.service
```

## 📋 機能

### ✅ 実装済み機能

- **プロセス管理**: PIDファイルによる重複起動防止
- **自動コンパイル**: 起動時に自動的にTypeScript→JavaScript変換
- **依存関係チェック**: node_modulesの自動インストール
- **ログシステム**: 起動・エラーログの記録
- **状態監視**: プロセス状態の確認機能
- **グレースフル停止**: 安全な終了処理

### 🔧 スクリプト概要

1. **start-prompt-line-persistent.sh**: メインの永続化スクリプト
2. **auto-start-prompt-line.sh**: ターミナル起動時の自動実行用
3. **systemd-prompt-line.service**: システムサービス化用

## 🎯 利点

- ✅ **手間省略**: 毎回 `npm start` する必要なし
- ✅ **自動復旧**: プロセス異常終了時の自動再起動
- ✅ **ログ管理**: エラー追跡とデバッグが容易
- ✅ **状態管理**: 起動状態の確認と制御
- ✅ **リソース効率**: メモリ使用量の最適化

## 🛠️ トラブルシューティング

### Prompt Line が起動しない場合

```bash
# ログ確認
./start-prompt-line-persistent.sh logs

# 手動コンパイル
npm run compile

# 依存関係再インストール
rm -rf node_modules package-lock.json
npm install
```

### プロセスが残っている場合

```bash
# 強制停止
./start-prompt-line-persistent.sh stop

# または手動でプロセス終了
pkill -f electron
rm -f .prompt-line.lock
```

## 📊 使用例

```bash
# 初回起動
$ ./start-prompt-line-persistent.sh start
🚀 Prompt Line 永続起動スクリプト
=================================
📋 起動前チェック...
⚙️  アプリケーションをコンパイル中...
🚀 Prompt Line を起動中...
✅ Prompt Line が正常に起動しました (PID: 12345)

# 状態確認
$ ./start-prompt-line-persistent.sh status
✅ Prompt Line は起動中です (PID: 12345)
📊 メモリ使用量: 12345 123456 789012 electron

# 使用
Ctrl+Alt+Space で Prompt Line を起動
```

## ⚠️ 注意事項

- WSL + Wezterm 環境での動作を前提としています
- Node.js 20.8.1 以上が必要です
- systemd サービスはWSL2では制限があります（bashrc自動起動を推奨）
- Electron アプリケーションのためDisplayサーバー（X11/Wayland）が必要です

## 🔧 カスタマイズ

スクリプトの動作をカスタマイズしたい場合は、`start-prompt-line-persistent.sh` を編集してください：

- ログファイルの場所: `LOG_FILE` 変数
- ロックファイルの場所: `LOCK_FILE` 変数  
- 起動確認の待機時間: `sleep` コマンドの秒数