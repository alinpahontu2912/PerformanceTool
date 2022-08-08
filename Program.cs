using System;
using System.Runtime.InteropServices.JavaScript;
using System.Threading.Tasks;

Console.WriteLine("Hello, Browser!");

public partial class MyClass
{
    [JSExport]
    internal static Task<string> loadData()
    {
        return TestLoader.loadTests();
    }
}
