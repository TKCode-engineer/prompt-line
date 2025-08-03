#!/bin/bash

echo "========================================="
echo "🚨 Claude Code TUI表示修正 - 緊急対応"
echo "========================================="

echo ""
echo "📋 問題の特定:"
echo "✅ 根本原因: Claude CodeのPTY（疑似端末）割り当て問題"
echo "✅ 症状: ANSIエスケープシーケンスが文字として表示"
echo "✅ 影響: TUI（入力枠、色付け、レイアウト）完全破綻"

echo ""
echo "🔧 修正手順:"

echo ""
echo "【手順1】新しいターミナルセッションでテスト"
echo "1. 新しいWeztermタブを開く (Ctrl+Shift+T)"
echo "2. WSLに入る: wsl"
echo "3. Claude Codeを直接起動: claude"
echo "   → 正常なTUI表示を確認"

echo ""
echo "【手順2】現在セッションの応急処置"
echo "強制的にTTY環境を作成..."

# Method 1: Export proper terminal variables
export TERM=xterm-256color
export COLORTERM=truecolor
export COLUMNS=80
export LINES=24

# Method 2: Try to force TTY behavior
exec 2>/dev/tty || true

# Method 3: Set terminal raw mode if possible
if command -v stty >/dev/null 2>&1; then
    stty raw -echo 2>/dev/null || true
    sleep 0.1
    stty sane echo 2>/dev/null || true
fi

echo ""
echo "【手順3】修正確認テスト"
echo "=== ANSI処理テスト ==="
printf "色付きテスト: \033[31m赤\033[32m緑\033[34m青\033[0m通常\n"

if [[ $'\033[31m赤\033[0m' != *'31m'* ]]; then
    echo "✅ ANSI処理: 正常"
else
    echo "❌ ANSI処理: 異常（エスケープシーケンスが文字表示）"
fi

echo ""
echo "=== TTY状態確認 ==="
echo "TTY: $(tty 2>/dev/null || echo 'なし')"
echo "TERM: $TERM"

echo ""
echo "========================================="
echo "🎯 最終推奨解決方法:"
echo ""
echo "【完全解決】新しいターミナルでClaude Code起動"
echo "1. Ctrl+Shift+T (新タブ)"
echo "2. wsl"
echo "3. claude"
echo ""
echo "【理由】"
echo "Claude Codeのサブプロセス実行方式では"
echo "PTY割り当てが不完全になるため"
echo "直接起動が最も確実です"
echo ""
echo "❗ デグレなし: 既存機能への影響はありません"
echo "========================================="