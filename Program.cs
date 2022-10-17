using System.Globalization;
using System.IO.Compression;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text;
using WasmBenchmarkResults;
using System.Text.Json.Serialization;

Console.WriteLine("Hello, Browser!");
public partial class Program
{
    readonly static string zipFileName = "index2.zip";
    readonly static string gitLogFile = "/git-log.txt";
    readonly static string fileName = "index.json";
    readonly static JsonSerializerOptions options = new()
    {
        IncludeFields = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        Converters = { new WasmBenchmarkResults.Index.IdMap.Converter() }
    };

    static List<GraphPointData> list = new();

    public static string CreateDelimiter(int alignmentLength)
    {
        return $"|{new string('-', alignmentLength)}:";
    }

    private static async Task<WasmBenchmarkResults.Index> LoadIndex(string measurementsUrl)
    {
        DataDownloader dataDownloader = new();
        using var memoryStream = new MemoryStream(await dataDownloader.downloadAsBytes(measurementsUrl + zipFileName));
        using var archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry(fileName);
        using Stream readStream = entry.Open();
        using StreamReader streamReader = new StreamReader(readStream);
        var index = JsonSerializer.Deserialize<WasmBenchmarkResults.Index>(streamReader.ReadToEnd(), options);

        return index;
    }

    internal static async Task<string> LoadTests(string measurementsUrl)
    {
        var data = await LoadIndex(measurementsUrl);
        var dataLen = data.Data.Count;
        for (var i = 0; i < dataLen; i++)
        {
            var flavor = data.FlavorMap[data.Data[i].flavorId];
            var logUrl = measurementsUrl + data.Data[i].hash + "/" + flavor.Replace('.', '/') + gitLogFile;
            foreach (var pair in data.Data[i].minTimes)
            {
                list.Add(new GraphPointData(data.Data[i].commitTime.ToString(CultureInfo.InvariantCulture), flavor, new KeyValuePair<string, double>(data.MeasurementMap[pair.Key], pair.Value), logUrl, data.Data[i].hash));
            }
            if (data.Data[i].sizes != null)
            {
                foreach (var pair in data.Data[i].sizes)
                {
                    list.Add(new GraphPointData(data.Data[i].commitTime.ToString(CultureInfo.InvariantCulture), flavor, new KeyValuePair<string, double>(data.MeasurementMap[pair.Key], (double)pair.Value), logUrl, data.Data[i].hash, "bytes"));
                }
            }
        }
        RequiredData neededData = new(list, data.FlavorMap.Keys.ToList<string>(), data.MeasurementMap.Keys.ToList<string>());
        var jsonData = JsonSerializer.Serialize(neededData, options);
        await Console.Out.WriteLineAsync($"jsonData length: {jsonData.Length}");
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

    static GraphPointData GetDataForHash(List<GraphPointData> list, string hash)
    {
        return list.Find(data => data.commitHash == hash);
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
                var prevData = GetDataForHash(filteredData, commits[0]);
                for (int k = 1; k < commitLen; k++)
                {
                    string percentageCell;
                    var currentData = GetDataForHash(filteredData, commits[k]);
                    if (currentData != null && prevData != null)
                    {
                        percentageCell = string.Format("{0, 10:N3}|", (currentData.minTime/prevData.minTime - 1)*100);
                    }
                    else
                    {
                        percentageCell = string.Format("{0, 10}|", "N/A");
                    }
                    markdown.Append(percentageCell);
                    prevData = currentData;
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
