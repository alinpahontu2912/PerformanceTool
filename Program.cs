using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO.Compression;
using System.IO;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text;
using System.Threading.Tasks;
using System.Linq;
using WasmBenchmarkResults;
using System.Text.Json.Serialization;

Console.WriteLine("Hello, Browser!");
public partial class Program
{
    readonly static string zipFileName = "index.zip";
    readonly static string gitLogFile = "/git-log.txt";
    readonly static string fileName = "index.json";
    readonly static JsonSerializerOptions options = new JsonSerializerOptions { IncludeFields = true, NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals };

    static List<GraphPointData> list = new();
    static List<string> flavors = new();
    static List<string> taskNames = new();

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



    public static void CalculatePercentages()
    {
        var tasksLen = taskNames.Count;
        var flavorsLen = flavors.Count;
        for (int i = 0; i < tasksLen; i++)
        {
            for (int j = 0; j < flavorsLen; j++)
            {
                List<GraphPointData> filteredData = list
                    .FindAll(point => point.taskMeasurementName == taskNames[i] && point.flavor == flavors[j]);
                var filteredDataLen = filteredData.Count;
                for (int k = 1; k < filteredDataLen; k++)
                {
                    filteredData[k].percentage = (filteredData[k - 1].minTime - filteredData[k].minTime) / filteredData[k - 1].minTime * 100;
                }
            }
        }

    }

    internal static async Task<string> loadTests(string measurementsUrl)
    {
        DataDownloader dataDownloader = new();
        HashSet<string> flavorsSet = new();
        HashSet<string> taskNamesSet = new();
        var bytes = await dataDownloader.downloadAsBytes(measurementsUrl + zipFileName);
        var memoryStream = new MemoryStream(bytes);
        ZipArchive archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry(fileName);
        Stream readStream = entry.Open();
        StreamReader streamReader = new StreamReader(readStream);
        var data = JsonSerializer.Deserialize<List<Item>>(streamReader.ReadToEnd(), options);
        for (var i = 0; i < data.Count; i++)
        {
            flavorsSet.Add(data[i].flavor);
            var flavor = data[i].flavor.Replace('.', '/');
            var logUrl = measurementsUrl + data[i].hash + "/" + flavor + gitLogFile;
            foreach (var pair in data[i].minTimes)
            {
                list.Add(new GraphPointData(data[i].commitTime.ToString(CultureInfo.InvariantCulture), data[i].flavor, pair, logUrl, data[i].hash));
                taskNamesSet.Add(pair.Key);
            }
            if (data[i].sizes != null)
            {
                foreach (var pair in data[i].sizes)
                {
                    list.Add(new GraphPointData(data[i].commitTime.ToString(CultureInfo.InvariantCulture), data[i].flavor, new KeyValuePair<string, double>("Size, " + pair.Key, (double)pair.Value), logUrl, data[i].hash, "bytes"));
                }
            }
        }
        flavors = flavorsSet.ToList();
        taskNames = taskNamesSet.ToList();
        NeededData neededData = new(list, flavors, taskNames);
        CalculatePercentages();
        var jsonData = JsonSerializer.Serialize(neededData, options);
        return jsonData;
    }

    [JSExport]
    internal static Task<string> loadData(string measurementsUrl)
    {
        return loadTests(measurementsUrl);
    }

    [JSExport]
    internal static string GetSubFlavors(string jsonFlavors)
    {
        var flavors = JsonSerializer.Deserialize<List<string>>(jsonFlavors, options);
        HashSet<string> subFlavors = new();
        flavors.ForEach(flavor => subFlavors.UnionWith(flavor.Split('.')));
        List<string> result = subFlavors.ToList();
        return JsonSerializer.Serialize(result, options);
    }

    [JSExport]
    internal static string CreateMarkdownText(string date1, string date2, string jsonTests, string jsonFlavors)
    {
        var startDate = DateTime.Parse(JsonSerializer.Deserialize<string>(date1, options));
        var endDate = DateTime.Parse(JsonSerializer.Deserialize<string>(date2, options));
        var availableTests = JsonSerializer.Deserialize<List<string>>(jsonTests, options);
        var availableFlavors = JsonSerializer.Deserialize<List<string>>(jsonFlavors, options);
        var availableData = list.FindAll(point => DateTime.Parse(point.commitTime) >= startDate
                        && DateTime.Parse(point.commitTime) <= endDate);
        HashSet<string> commitSet = new();
        foreach (var item in availableData)
        {
            commitSet.Add(item.commitHash);
        }
        var commits = commitSet.ToList();
        var commitLen = commits.Count;
        StringBuilder markdown = new();

        for (int i = 0; i < availableTests.Count; i++)
        {

            var tableCorner = string.Format("|{0, -30} ({1, 10})|", availableTests[i], commits[0].Substring(0, 7));
            markdown.Append(tableCorner);

            for (int j = 1; j < commitLen; j++)
            {
                var commitCell = string.Format("{0, -10}|", commits[0].Substring(0, 7));
                markdown.Append(commitCell);
            }

            markdown.Append("\n|");

            string delimiterCell = string.Format("{0, -30}", "-:|");
            markdown.Append(delimiterCell);
            for (int j = 1; j < commitLen; j++)
            {
                delimiterCell = string.Format("{0, 10}", "-:|");
                markdown.Append(delimiterCell);
            }

            markdown.Append("\n|");

            for (int j = 0; j < availableFlavors.Count; j++)
            {
                var rowName = string.Format("|{0, -30}|", availableFlavors[j]);
                var filteredData = availableData.FindAll(data => data.taskMeasurementName == availableTests[i]
                               && data.flavor == availableFlavors[j]
                );
                markdown.Append(rowName);
                for (int k = 1; k < commitLen; k++)
                {
                    string percentageCell;
                    var wantedResult = filteredData.Find(data => data.commitHash == commits[k]);
                    if (wantedResult != null)
                    {
                        percentageCell = string.Format("{0, 10:N3}|", wantedResult.percentage);
                    }
                    else
                    {
                        percentageCell = string.Format("{0, 10}|", "N/A");
                    }
                    markdown.Append(percentageCell);
                }
                markdown.Append("\n");
            }
            markdown.Append("\n");
        }
        return markdown.ToString();
    }

}
