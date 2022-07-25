using System.Collections.Generic;
using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;
using System.Linq;
using static BenchTask;
using System.Text.Json;
using System.Text.Json.Serialization;

public partial class Program
{
    readonly static string main = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/";
    public static string getFlavor(string line)
    {
        var words = line.Split("/");
        StringBuilder stringBuilder = new();
        for (var i = 2; i < words.Length - 1; i++)
        {
            stringBuilder.Append(words[i] + ".");
        }

        return stringBuilder.ToString().Remove(stringBuilder.Length - 1);
    }

    internal static async Task<string> doSomth()
    {
        QuerySolver querySolver = new();
        List<GraphData> list = new();
        var options = new JsonSerializerOptions { IncludeFields = true };
        SortedDictionary<DateTimeOffset, ResultsData> timedResults = new();
        var text = await querySolver.solveQuery(main + "measurements/jsonDataFiles.txt");
        var lines = text.Split("\n");
        for (var i = 0; i < lines.Length - 1; i++)
        {
            var fileUrl = lines[i];
            var json = await querySolver.solveQuery(main + fileUrl);
            var logUrl = lines[i].Replace("results.json", "git-log.txt");
            var content = await querySolver.solveQuery(main + logUrl);
            var flavorData = new FlavorData(main + fileUrl, getFlavor(fileUrl), json, content);
            
            ResultsData resultsData;
            if (timedResults.ContainsKey(flavorData.commitTime))
                resultsData = timedResults[flavorData.commitTime];
            else
            {
                resultsData = new ResultsData();
                timedResults[flavorData.commitTime] = resultsData;
            }
            resultsData.results[flavorData.flavor] = flavorData;
        }
        StringBuilder stringBuilder = new();
        foreach (var item in timedResults)
        {
            var value = item.Value;
            var key = item.Key;
            var testList = value.results.Values;
            foreach (var test in testList) {
                list.Add(new GraphData(test));
                /*string jsonObj = JsonSerializer.Serialize(new GraphData(test), options);
                Console.WriteLine(jsonObj);
                stringBuilder.Append(jsonObj);*/
            }

        }
        string jsonArray = JsonSerializer.Serialize(list, options);
        return jsonArray;
    }


    internal static DateTimeOffset GetLastDates(SortedDictionary<DateTimeOffset, ResultsData> sortedDictionary)
    {
        /*List<DateTimeOffset> dateTimes = new();
        dateTimes = sortedDictionary.Keys.ToList();*/
        return sortedDictionary.First().Key;
    }

    internal class QuerySolver
    {
        public HttpClient client;
        public QuerySolver()
        {
            client = new();
            client.DefaultRequestHeaders.Add("User-Agent", "my-app");
        }

        public async Task<string> solveQuery(string url)
        {
            var response = await client.GetAsync(url);
            if (response.StatusCode != HttpStatusCode.OK)
                throw new Exception("HTTP request failed with status code " + response.StatusCode + " and message " + response.ReasonPhrase);
            var text = await response.Content.ReadAsStringAsync();
            return text;
        }
    }



}