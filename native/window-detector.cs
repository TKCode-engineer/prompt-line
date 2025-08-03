using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

class WindowDetector
{
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int left, top, right, bottom;
    }

    public static object GetActiveWindowBounds()
    {
        try
        {
            IntPtr hWnd = GetForegroundWindow();
            if (hWnd == IntPtr.Zero)
            {
                return new { error = "No active window found" };
            }

            RECT rect;
            if (!GetWindowRect(hWnd, out rect))
            {
                return new { error = "Failed to get window bounds" };
            }

            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            var process = Process.GetProcessById((int)processId);
            
            int length = GetWindowTextLength(hWnd);
            StringBuilder windowTitle = new StringBuilder(length + 1);
            GetWindowText(hWnd, windowTitle, windowTitle.Capacity);

            return new
            {
                x = rect.left,
                y = rect.top,
                width = rect.right - rect.left,
                height = rect.bottom - rect.top,
                appName = process.ProcessName,
                executablePath = process.MainModule.FileName,
                windowTitle = windowTitle.ToString()
            };
        }
        catch (Exception ex)
        {
            return new { error = string.Format("Window detection failed: {0}", ex.Message) };
        }
    }

    public static object GetCurrentApp()
    {
        try
        {
            IntPtr hWnd = GetForegroundWindow();
            if (hWnd == IntPtr.Zero)
            {
                return new { error = "No active application found" };
            }

            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            var process = Process.GetProcessById((int)processId);

            return new
            {
                name = process.ProcessName,
                executablePath = process.MainModule.FileName,
                processId = processId
            };
        }
        catch (Exception ex)
        {
            return new { error = string.Format("App detection failed: {0}", ex.Message) };
        }
    }

    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("Usage: window-detector.exe <command>");
            Console.Error.WriteLine("Commands: window-bounds, current-app");
            Environment.Exit(1);
        }

        object result;
        if (args[0] == "window-bounds")
        {
            result = GetActiveWindowBounds();
        }
        else if (args[0] == "current-app")
        {
            result = GetCurrentApp();
        }
        else
        {
            result = new { error = string.Format("Unknown command: {0}", args[0]) };
        }

        JavaScriptSerializer serializer = new JavaScriptSerializer();
        Console.WriteLine(serializer.Serialize(result));
    }
}