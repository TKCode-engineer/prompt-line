using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Threading;

class KeyboardSimulator
{
    [DllImport("user32.dll")]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    const int INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const ushort VK_CONTROL = 0x11;
    const ushort VK_SHIFT = 0x10;
    const ushort VK_V = 0x56;
    const int SW_RESTORE = 9;

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT
    {
        public int type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion
    {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public static bool SendCtrlV()
    {
        try
        {
            INPUT[] inputs = new INPUT[4];

            // Ctrl key down
            inputs[0] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_CONTROL,
                        dwFlags = KEYEVENTF_KEYDOWN
                    }
                }
            };

            // V key down
            inputs[1] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_V,
                        dwFlags = KEYEVENTF_KEYDOWN
                    }
                }
            };

            // V key up
            inputs[2] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_V,
                        dwFlags = KEYEVENTF_KEYUP
                    }
                }
            };

            // Ctrl key up
            inputs[3] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_CONTROL,
                        dwFlags = KEYEVENTF_KEYUP
                    }
                }
            };

            uint result = SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT)));
            return result == 4;
        }
        catch
        {
            return false;
        }
    }

    public static bool SendCtrlShiftV()
    {
        try
        {
            INPUT[] inputs = new INPUT[6];

            // Ctrl key down
            inputs[0] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_CONTROL,
                        dwFlags = KEYEVENTF_KEYDOWN
                    }
                }
            };

            // Shift key down
            inputs[1] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_SHIFT,
                        dwFlags = KEYEVENTF_KEYDOWN
                    }
                }
            };

            // V key down
            inputs[2] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_V,
                        dwFlags = KEYEVENTF_KEYDOWN
                    }
                }
            };

            // V key up
            inputs[3] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_V,
                        dwFlags = KEYEVENTF_KEYUP
                    }
                }
            };

            // Shift key up
            inputs[4] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_SHIFT,
                        dwFlags = KEYEVENTF_KEYUP
                    }
                }
            };

            // Ctrl key up
            inputs[5] = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = VK_CONTROL,
                        dwFlags = KEYEVENTF_KEYUP
                    }
                }
            };

            uint result = SendInput(6, inputs, Marshal.SizeOf(typeof(INPUT)));
            return result == 6;
        }
        catch
        {
            return false;
        }
    }

    public static bool ActivateApplication(string processName)
    {
        try
        {
            // Wezterm特別対応: 複数の可能性のあるプロセス名をチェック
            string[] possibleNames = { processName, "wezterm", "wezterm-gui" };
            
            foreach (string name in possibleNames)
            {
                Process[] processes = Process.GetProcessesByName(name);
                if (processes.Length > 0)
                {
                    Process targetProcess = processes[0];
                    IntPtr hWnd = targetProcess.MainWindowHandle;
                    
                    if (hWnd != IntPtr.Zero)
                    {
                        // Weztermの場合は、より強力なアクティベーション
                        if (name.ToLower().Contains("wezterm"))
                        {
                            ShowWindow(hWnd, SW_RESTORE);
                            SetForegroundWindow(hWnd);
                            Thread.Sleep(50); // 追加の安定化時間
                            SetForegroundWindow(hWnd); // 2回実行で確実にフォーカス
                            return true;
                        }
                        else
                        {
                            ShowWindow(hWnd, SW_RESTORE);
                            return SetForegroundWindow(hWnd);
                        }
                    }
                }
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("Usage: keyboard-simulator.exe <command> [arguments]");
            Console.Error.WriteLine("Commands:");
            Console.Error.WriteLine("  paste - Send Ctrl+V");
            Console.Error.WriteLine("  paste-wezterm - Send Ctrl+Shift+V for Wezterm");
            Console.Error.WriteLine("  activate-name <process_name> - Activate process");
            Console.Error.WriteLine("  activate-and-paste-name <process_name> - Activate and paste (auto-detects Wezterm)");
            Environment.Exit(1);
        }

        bool success = false;

        switch (args[0])
        {
            case "paste":
                success = SendCtrlV();
                break;

            case "paste-wezterm":
                success = SendCtrlShiftV();
                break;

            case "activate-name":
                if (args.Length >= 2)
                    success = ActivateApplication(args[1]);
                break;

            case "activate-and-paste-name":
                if (args.Length >= 2)
                {
                    success = ActivateApplication(args[1]);
                    if (success)
                    {
                        // Wezterm特別対応: より長い待機時間と専用ペースト
                        if (args[1].ToLower().Contains("wezterm"))
                        {
                            Thread.Sleep(300); // Weztermには300ms待機
                            success = SendCtrlShiftV(); // WeztermはCtrl+Shift+V
                        }
                        else
                        {
                            Thread.Sleep(100); // 通常アプリは100ms
                            success = SendCtrlV(); // 通常アプリはCtrl+V
                        }
                    }
                }
                break;
        }

        var result = new
        {
            success = success,
            command = args[0]
        };

        JavaScriptSerializer serializer = new JavaScriptSerializer();
        Console.WriteLine(serializer.Serialize(result));
        Environment.Exit(success ? 0 : 1);
    }
}