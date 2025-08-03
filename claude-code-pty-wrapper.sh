#!/bin/bash

# Claude Code PTY Wrapper
# Forces proper pseudo-terminal allocation for TUI applications

echo "=== Claude Code PTY修正ラッパー ==="

# Method 1: Force TTY allocation using script command
if command -v script >/dev/null 2>&1; then
    echo "script コマンドによるPTY強制割り当てを試行..."
    
    # Create a temporary script that runs bash with proper PTY
    TEMP_SCRIPT=$(mktemp)
    cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash
export TERM=xterm-256color
export COLUMNS=$(tput cols 2>/dev/null || echo 80)
export LINES=$(tput lines 2>/dev/null || echo 24)

# Enable ANSI processing
stty sane 2>/dev/null || true

echo "=== PTY修正後テスト ==="
printf "色付きテスト: \033[31m赤\033[32m緑\033[0m通常\n"
echo "TTY状態: $(tty)"
echo "ANSIテスト完了"

# Keep session alive
exec bash
EOF
    
    chmod +x "$TEMP_SCRIPT"
    
    echo "PTYラッパーでbashを起動中..."
    script -q /dev/null "$TEMP_SCRIPT"
    
    rm -f "$TEMP_SCRIPT"
    
else
    echo "❌ script コマンドが利用できません"
fi

# Method 2: Direct TTY allocation attempt
echo ""
echo "=== 直接TTY割り当て試行 ==="

# Try to use unbuffer if available
if command -v unbuffer >/dev/null 2>&1; then
    echo "unbuffer による強制TTY化..."
    unbuffer bash -c '
        echo "=== unbuffer環境テスト ==="
        printf "色付きテスト: \033[31m赤\033[0m\n"
        echo "TTY: $(tty)"
        exec bash
    '
else
    echo "❌ unbuffer が利用できません"
fi

echo ""
echo "=== 修正方法の提案 ==="
echo "1. 新しいWeztermタブ/ウィンドウでClaude Code起動"
echo "2. 直接ターミナルからclaude コマンド実行"
echo "3. PTY割り当てが正常な環境でのテスト"