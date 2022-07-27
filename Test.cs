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
using System.IO;

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
        List<GraphPointData> list = new();
        var options = new JsonSerializerOptions { IncludeFields = true };
        SortedDictionary<DateTimeOffset, ResultsData> timedResults = new();
        var text = await querySolver.solveQuery(main + "measurements/jsonDataFiles.txt");
        var lines = text.Split("\n");
        for (var i = 0; i < 1; i++)
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
        var jsonData = JsonSerializer.Serialize(list, options);
        return jsonData;
        //return ExportCSV(timedResults);
    }
    internal static string ExportCSV(SortedDictionary<DateTimeOffset, ResultsData> timedPaths, string flavor = "aot.default.chrome")
    {
        var sw = new StringBuilder();
        {
            SortedDictionary<DateTimeOffset, FlavorData> flavoredData = new();
            SortedSet<string> labels = new();
            foreach (var pair in timedPaths)
            {
                if (!pair.Value.results.ContainsKey(flavor))
                    continue;

                var fd = pair.Value.results[flavor];
                flavoredData[fd.commitTime] = fd;
                Console.WriteLine($"date: {fd.commitTime} path: {fd.origin}");
                labels.UnionWith(fd.MeasurementLabels);
            }

            foreach (var l in labels)
                Console.WriteLine($"l: {l}");

            sw.Append($"taskname");
            foreach (var d in flavoredData.Keys)
            {
                sw.Append($",{d.Date.ToShortDateString()}");
            }

            sw.Append("\n");

            foreach (var l in labels)
            {
                sw.Append($"{l.Replace(",", " -")}");

                foreach (var p in flavoredData)
                {
                    var mt = p.Value.results.minTimes;
                    var v = mt.ContainsKey(l) ? mt[l].ToString() : "N/A";
                    sw.Append($",{v}");
                }

                sw.Append("\n");
            }
            return sw.ToString();
        }
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