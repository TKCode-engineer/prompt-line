#!/bin/bash

# 日本語入力サポート自動インストールスクリプト
# 実行方法: chmod +x install-japanese-support.sh && ./install-japanese-support.sh

echo "=== 日本語入力サポートのインストールを開始します ==="

# Step 1: パッケージリストの更新
echo "Step 1: パッケージリストを更新中..."
sudo apt update
if [ $? -ne 0 ]; then
    echo "❌ パッケージリスト更新に失敗しました"
    exit 1
fi

# Step 2: 日本語言語パックのインストール
echo "Step 2: 日本語言語パックをインストール中..."
sudo apt install -y language-pack-ja language-pack-ja-base
if [ $? -ne 0 ]; then
    echo "❌ 日本語言語パックのインストールに失敗しました"
    exit 1
fi

# Step 3: 日本語ロケールの生成
echo "Step 3: 日本語ロケールを生成中..."
sudo locale-gen ja_JP.UTF-8
if [ $? -ne 0 ]; then
    echo "❌ 日本語ロケールの生成に失敗しました"
    exit 1
fi

# Step 4: 環境変数の設定（重複チェック付き）
echo "Step 4: 環境変数を設定中..."

# .bashrcに既存の設定があるかチェック
if ! grep -q "export LANG=ja_JP.UTF-8" ~/.bashrc; then
    echo 'export LANG=ja_JP.UTF-8' >> ~/.bashrc
    echo "✅ LANG環境変数を追加しました"
else
    echo "ℹ️  LANG環境変数は既に設定されています"
fi

if ! grep -q "export LC_ALL=ja_JP.UTF-8" ~/.bashrc; then
    echo 'export LC_ALL=ja_JP.UTF-8' >> ~/.bashrc
    echo "✅ LC_ALL環境変数を追加しました"
else
    echo "ℹ️  LC_ALL環境変数は既に設定されています"
fi

# Step 5: 現在のセッションに設定を適用
echo "Step 5: 現在のセッションに設定を適用中..."
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8

# Step 6: インストール結果の確認
echo ""
echo "=== インストール結果の確認 ==="

echo "現在のロケール設定:"
locale

echo ""
echo "利用可能な日本語ロケール:"
locale -a | grep ja || echo "⚠️  日本語ロケールが見つかりません"

echo ""
echo "日本語表示テスト:"
echo "こんにちは、世界！ - テスト用日本語文字列"

echo ""
echo "ファイル内容確認（.bashrcの最後の数行）:"
tail -5 ~/.bashrc

echo ""
echo "=== インストール完了 ==="
echo "✅ 日本語入力サポートのインストールが完了しました"
echo ""
echo "次の手順:"
echo "1. 新しいターミナルセッションを開く"
echo "2. Ctrl+Alt+Space でPrompt Lineを起動"
echo "3. Win + Space でIMEをオンにして日本語入力をテスト"
echo ""
echo "問題がある場合は、ターミナルを再起動してから再度テストしてください。"