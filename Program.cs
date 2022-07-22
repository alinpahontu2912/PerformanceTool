using System;
using System.Runtime.InteropServices.JavaScript;
using System.Threading.Tasks;

Console.WriteLine("Hello, Browser!");

public partial class MyClass
{
    [JSExport]
    internal static string Greeting()
    {
        var text = $"Hello, World! Greetings from {GetHRef()}";
        Console.WriteLine(text);
        return text;
    }

    [JSExport]
    internal static Task<string> testMe()
    {
        return Program.doSomth();
    }  

    [JSImport("window.location.href")]
    internal static partial string GetHRef();
}
