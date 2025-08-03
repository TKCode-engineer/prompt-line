#!/bin/bash

echo "========================================="
echo "🔧 Claude Code TUI表示修正テスト"
echo "========================================="

echo ""
echo "1️⃣ TTY状態確認"
if [[ -t 1 ]]; then
    echo "✅ 標準出力はTTY"
else
    echo "❌ 標準出力は非TTY（問題の可能性）"
fi

if [[ -t 0 ]]; then
    echo "✅ 標準入力はTTY"  
else
    echo "❌ 標準入力は非TTY"
fi

echo ""
echo "2️⃣ ターミナル設定確認"
echo "TERM: $TERM" 
echo "COLUMNS: $COLUMNS"
echo "LINES: $LINES"
echo "TTY デバイス: $(tty 2>/dev/null || echo '未接続')"

echo ""
echo "3️⃣ ANSIエスケープシーケンステスト"
printf "色付きテスト: \033[31m赤\033[32m緑\033[34m青\033[0m通常\n"
printf "カーソル制御テスト: \033[s保存\033[10G移動\033[u復元\n"

echo ""
echo "4️⃣ 画面制御機能テスト"
echo "画面サイズ: $(tput cols)x$(tput lines)"
echo "カーソル位置制御:"
tput cup 8 20 && echo "→ここに移動" && tput cup 10 0

echo ""
echo "5️⃣ Claude Code向け環境テスト"
echo "Terminal capabilities:"
echo "- Colors: $(tput colors 2>/dev/null || echo 'unknown')"
echo "- Cup capability: $(tput cup 1 1 2>/dev/null && echo 'OK' || echo 'NG')"
echo "- Clear capability: $(tput clear 2>/dev/null && echo 'OK' || echo 'NG')"

echo ""
echo "6️⃣ 修正適用確認"
source ~/.bashrc

echo ""
echo "========================================="
echo "🎯 結果判定："
echo "✅ 正常 → ANSIシーケンスが色付き・制御として動作"
echo "❌ 異常 → エスケープシーケンスが文字として表示"
echo ""
echo "Claude Codeを新しいセッションで起動してテスト！"
echo "========================================="