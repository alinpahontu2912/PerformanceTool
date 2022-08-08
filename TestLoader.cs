using System.Collections.Generic;
using System.IO.Compression;
using System.IO;
using System.Text.Json;
using System.Text;
using System.Threading.Tasks;
using WasmBenchmarkResults;

public class TestLoader
{
    readonly static string measurementsUrl = "https://raw.githubusercontent.com/radekdoulik/WasmPerformanceMeasurements/main/measurements/";
    readonly static string zipFileName = "index.json";
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
        List<GraphPointData> list = new();
        var bytes = await querySolver.solveQueryByte(measurementsUrl + "index.zip");
        var memoryStream = new MemoryStream(bytes);
        ZipArchive archive = new ZipArchive(memoryStream);
        var entry = archive.GetEntry(zipFileName);
        Stream readStream = entry.Open();
        StreamReader streamReader = new StreamReader(readStream);
        var data = JsonSerializer.Deserialize<List<Item>>(streamReader.ReadToEnd(), options);
        for (var i = 0; i < data.Count; i++)
        {
            // Atm I'm not doing anything with the gitlog files, keeping this in case I need it later
            var flavor = data[i].flavor.Replace('.', '/');
            var logUrl = measurementsUrl + data[i].hash + "/" + flavor + "/" + "git-log.txt";
            // var content = await querySolver.solveQueryText(logUrl);
            foreach (var pair in data[i].minTimes)
            {
                list.Add(new GraphPointData(data[i].commitTime.ToString(), data[i].flavor, pair, logUrl));
            }
        }
        var jsonData = JsonSerializer.Serialize(list, options);
        return jsonData;
    }
}
