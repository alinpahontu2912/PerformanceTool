using System.Collections.Generic;
using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;
using System.Linq;
using System.Text.Json;

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

    internal static string createJson(SortedDictionary<DateTimeOffset, ResultsData> timedResults)
    {
        List<GraphPointData> list = new();
        foreach (var item in timedResults)
        {
            foreach (var pair in item.Value.results)
            {
                foreach (var testData in pair.Value.results.minTimes)
                {
                    list.Add(new GraphPointData(item.Key.ToString(), pair.Key, testData));
                }
            }
        }
        var options = new JsonSerializerOptions { IncludeFields = true };
        var jsonData = JsonSerializer.Serialize(list, options);
        return jsonData;
    }

    internal static async Task<string> doSomth()
    {
        QuerySolver querySolver = new();
        List<GraphPointData> list = new();
        
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
            foreach (var item in flavorData.results.minTimes)
            {
                list.Add(new GraphPointData(flavorData.commitTime.Date.ToShortDateString(), flavorData.flavor, item));
            }
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

        list = list.OrderByDescending(x => DateTime.Parse(x.dateTime)).ToList();
        return createJson(timedResults);
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