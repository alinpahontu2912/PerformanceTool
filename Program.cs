using System;
using System.Collections.Generic;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;

Console.WriteLine("Hello, Browser!");


public partial class MyClass
{
    internal static SortedDictionary<DateTimeOffset, ResultsData> results;

    /*[JSExport]
    internal static Task getData()
    {
        return Program.doSomth(results);
    }*/


    [JSExport]
    internal static string Greeting()
    {
        var text = $"Hello, World! Greetings from {GetHRef()}";
        Console.WriteLine(text);
        return text;
    }

    /*  [JSExport]
      internal static async Task<DateTimeOffset> sendDates()
      {
          return Program.GetLastDates(sortedDictionary);

      }*/


    [JSExport]
    internal static Task<string> testMe()
    {
        return Program.doSomth();
    }

   /* [JSExport]
    internal static List<string> testList()
    {
        List<string> list = new();
        list.Add("aaa");
        list.Add("aaa");
        return list;
    }*/

    [JSImport("window.location.href")]
    internal static partial string GetHRef();
}
