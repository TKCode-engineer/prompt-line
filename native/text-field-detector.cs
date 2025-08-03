using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Automation;

class TextFieldDetector
{
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static object GetActiveTextFieldBounds()
    {
        try
        {
            AutomationElement focusedElement = AutomationElement.FocusedElement;
            if (focusedElement == null)
            {
                return new { error = "no_focused_element" };
            }

            // Check if it's a text input element
            var controlType = focusedElement.Current.ControlType;
            if (controlType != ControlType.Edit && 
                controlType != ControlType.Document &&
                controlType != ControlType.Text)
            {
                return new { error = "not_text_field", role = controlType.LocalizedControlType };
            }

            var boundingRect = focusedElement.Current.BoundingRectangle;
            
            IntPtr hWnd = GetForegroundWindow();
            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            var process = System.Diagnostics.Process.GetProcessById((int)processId);

            var result = new
            {
                success = true,
                x = (int)boundingRect.X,
                y = (int)boundingRect.Y,
                width = (int)boundingRect.Width,
                height = (int)boundingRect.Height,
                role = controlType.LocalizedControlType,
                appName = process.ProcessName,
                appPid = processId,
                title = focusedElement.Current.Name ?? "",
                enabled = focusedElement.Current.IsEnabled,
                hasContent = !string.IsNullOrEmpty(focusedElement.Current.Name)
            };

            return result;
        }
        catch (ElementNotAvailableException)
        {
            return new { error = "element_not_available" };
        }
        catch (Exception ex)
        {
            return new { error = string.Format("text_field_detection_failed: {0}", ex.Message) };
        }
    }

    public static object GetFocusedElementInfo()
    {
        try
        {
            AutomationElement focusedElement = AutomationElement.FocusedElement;
            if (focusedElement == null)
            {
                return new { error = "no_focused_element" };
            }

            IntPtr hWnd = GetForegroundWindow();
            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            var process = System.Diagnostics.Process.GetProcessById((int)processId);

            var boundingRect = focusedElement.Current.BoundingRectangle;

            return new
            {
                appName = process.ProcessName,
                appPid = processId,
                role = focusedElement.Current.ControlType.LocalizedControlType,
                title = focusedElement.Current.Name ?? "",
                description = focusedElement.Current.HelpText ?? "",
                x = (int)boundingRect.X,
                y = (int)boundingRect.Y,
                width = (int)boundingRect.Width,
                height = (int)boundingRect.Height,
                enabled = focusedElement.Current.IsEnabled
            };
        }
        catch (Exception ex)
        {
            return new { error = string.Format("focused_element_info_failed: {0}", ex.Message) };
        }
    }

    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("Usage: text-field-detector.exe <command>");
            Console.Error.WriteLine("Commands:");
            Console.Error.WriteLine("  text-field-bounds  - Get bounds of focused text field");
            Console.Error.WriteLine("  focused-element    - Get info about focused element");
            Environment.Exit(1);
        }

        object result;
        if (args[0] == "text-field-bounds")
        {
            result = GetActiveTextFieldBounds();
        }
        else if (args[0] == "focused-element")
        {
            result = GetFocusedElementInfo();
        }
        else
        {
            result = new { error = string.Format("Unknown command: {0}", args[0]) };
        }

        JavaScriptSerializer serializer = new JavaScriptSerializer();
        Console.WriteLine(serializer.Serialize(result));
    }
}