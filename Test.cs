using System.Collections.Generic;
using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;
using System.Text.Json;
using System.IO.Compression;
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

    internal static async Task<string> loadTests()
    {
        var options = new JsonSerializerOptions { IncludeFields = true };
        QuerySolver querySolver = new();
        SortedDictionary<DateTimeOffset, ResultsData> timedResults = new();
        List<GraphPointData> list = new();
        var bytes = await querySolver.solveQueryByte(main + "measurements/index.zip");
        var memoryStream = new MemoryStream(bytes);
        ZipArchive archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry("index.json");
        Stream readStream = entry.Open();
        StreamReader streamReader = new StreamReader(readStream);
        var data = JsonSerializer.Deserialize<List<Item>>(streamReader.ReadToEnd(), options);
        for (var i = 0; i < data.Count; i++)
        {
            // Atm I'm not doing anything with the gitlog files
            // var flavor = data[i].flavor.Replace('.', '/');
            /*var logUrl = main + "measurements/" + data[i].hash + "/" + flavor + "/" + "git-log.txt";
            var content = await querySolver.solveQueryText(logUrl);*/
            foreach (var pair in data[i].minTimes)
            {
                list.Add(new GraphPointData(data[i].commitTime.ToString(), data[i].flavor, pair));
            }


        }
        var jsonData = JsonSerializer.Serialize(list, options);
        return jsonData;
    }

    internal class QuerySolver
    {
        public HttpClient client;
        public QuerySolver()
        {
            client = new();
            client.DefaultRequestHeaders.Add("User-Agent", "my-app");
        }

        public async Task<byte[]> solveQueryByte(string url)
        {
            var response = await client.GetAsync(url);
            if (response.StatusCode != HttpStatusCode.OK)
                throw new Exception("HTTP request failed with status code " + response.StatusCode + " and message " + response.ReasonPhrase);
            var text = await response.Content.ReadAsByteArrayAsync();
            return text;
        }
        public async Task<string> solveQueryText(string url)
        {
            var response = await client.GetAsync(url);
            if (response.StatusCode != HttpStatusCode.OK)
                throw new Exception("HTTP request failed with status code " + response.StatusCode + " and message " + response.ReasonPhrase);
            var text = await response.Content.ReadAsStringAsync();
            return text;
        }

    }



}