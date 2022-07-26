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

    public static string CreateDelimiter(int alignmentLength)
    {
        StringBuilder delimiterCell = new();
        delimiterCell.Append('|');
        for (int j = 0; j < alignmentLength; j++)
        {
            delimiterCell.Append('-');
        }
        delimiterCell.Append(":");
        return delimiterCell.ToString();
    }

    private static async Task<List<Item>> LoadItems(string measurementsUrl)
    {
        DataDownloader dataDownloader = new();
        using var memoryStream = new MemoryStream(await dataDownloader.downloadAsBytes(measurementsUrl + zipFileName));
        using var archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry(fileName);
        using Stream readStream = entry.Open();
        using StreamReader streamReader = new StreamReader(readStream);
        return JsonSerializer.Deserialize<List<Item>>(streamReader.ReadToEnd(), options);
    }

    internal static async Task<string> LoadTests(string measurementsUrl)
    {
        HashSet<string> flavorsSet = new();
        HashSet<string> taskNamesSet = new();
        var data = await LoadItems(measurementsUrl);
        var dataLen = data.Count;
        for (var i = 0; i < dataLen; i++)
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
        RequiredData neededData = new(list, flavors, taskNames);
        CalculatePercentages();
        var jsonData = JsonSerializer.Serialize(neededData, options);
        return jsonData;
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
        var startDate = DateTimeOffset.Parse(JsonSerializer.Deserialize<string>(date1, options));
        var endDate = DateTimeOffset.Parse(JsonSerializer.Deserialize<string>(date2, options));
        var availableTests = JsonSerializer.Deserialize<List<string>>(jsonTests, options);
        var availableFlavors = JsonSerializer.Deserialize<List<string>>(jsonFlavors, options);
        var availableData = list.FindAll(point => DateTimeOffset.Parse(point.commitTime) >= startDate
                        && DateTimeOffset.Parse(point.commitTime) <= endDate);
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

            var tableCorner = string.Format("|{0, -30}{1, 10}|", availableTests[i], commits[0].Substring(0, 7));
            markdown.Append(tableCorner);

            for (int j = 1; j < commitLen; j++)
            {
                var commitCell = string.Format("{0, -10}|", commits[j].Substring(0, 7));
                markdown.Append(commitCell);
            }

            markdown.Append("\n");
            markdown.Append(CreateDelimiter(39));
            for (int j = 1; j < commitLen; j++)
            {
                markdown.Append(CreateDelimiter(9));
            }
            markdown.Append("|\n");

            for (int j = 0; j < availableFlavors.Count; j++)
            {
                var rowName = string.Format("|{0, -40}|", availableFlavors[j]);
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

    [JSExport]
    internal static Task<string> LoadData(string measurementsUrl)
    {
        return LoadTests(measurementsUrl);
    }

}
