using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO.Compression;
using System.IO;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;

Console.WriteLine("Hello, Browser!");
public partial class Program
{
    readonly static string zipFileName = "index.zip";
    readonly static string gitLogFile = "/git-log.txt";
    readonly static string fileName = "index.json";

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

    internal static async Task<string> loadTests(string measurementsUrl)
    {
        var options = new JsonSerializerOptions { IncludeFields = true };
        DataDownloader dataDownloader = new();
        List<GraphPointData> list = new();
        var bytes = await dataDownloader.downloadAsBytes(measurementsUrl + zipFileName);
        var memoryStream = new MemoryStream(bytes);
        ZipArchive archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry(fileName);
        Stream readStream = entry.Open();
        StreamReader streamReader = new StreamReader(readStream);
        var data = JsonSerializer.Deserialize<List<Item>>(streamReader.ReadToEnd(), options);
        for (var i = 0; i < data.Count; i++)
        {
            var flavor = data[i].flavor.Replace('.', '/');
            var logUrl = measurementsUrl + data[i].hash + "/" + flavor + gitLogFile;
            foreach (var pair in data[i].minTimes)
            {
                list.Add(new GraphPointData(data[i].commitTime.ToString(CultureInfo.InvariantCulture), data[i].flavor, pair, logUrl, data[i].hash));
            }
            if (data[i].sizes != null)
            {
                foreach (var pair in data[i].sizes)
                {
                    list.Add(new GraphPointData(data[i].commitTime.ToString(CultureInfo.InvariantCulture), data[i].flavor, new KeyValuePair<string, double>("Size, " + pair.Key, (double)pair.Value), logUrl, data[i].hash, "bytes"));
                }
            }
        }
        var jsonData = JsonSerializer.Serialize(list, options);
        return jsonData;
    }

    [JSExport]
    internal static Task<string> loadData(string measurementsUrl)
    {
        return loadTests(measurementsUrl);
    }
}
