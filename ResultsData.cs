using System.Text.Json;
using System.Text.RegularExpressions;

namespace WasmBenchmarkResults
{
    class JsonResultsData
    {
        public List<BenchTask.Result> results;
        public Dictionary<string, double> minTimes;
        public DateTime timeStamp;

        public static JsonResultsData? Load(string path)
        {
            var options = new JsonSerializerOptions { IncludeFields = true };
            return JsonSerializer.Deserialize<JsonResultsData>(File.ReadAllText(path), options);
        }
    }

    internal class FlavorData
    {
        public DateTimeOffset commitTime;
        public string runPath;
        public string flavor;
        public JsonResultsData results;

        public HashSet<string> MeasurementLabels => results.minTimes.Keys.ToHashSet<string>();

        public FlavorData(string path, string flavor)
        {
            runPath = path;
            this.flavor = flavor;
            results = JsonResultsData.Load(Path.Combine(path, "results.json"));
            commitTime = LoadGitLog(Path.Combine(path, "git-log.txt"));
        }

        public DateTimeOffset LoadGitLog(string path)
        {
            var lines = File.ReadAllLines(path);
            var regex = new Regex(@"^Date: +(.*)$");
            string? dateString = null;
            foreach (var line in lines)
            {
                var match = regex.Match(line);
                if (!match.Success)
                    continue;

                dateString = match.Groups[1].Value;

                if (!DateTimeOffset.TryParseExact(dateString, "ddd MMM d HH:mm:ss yyyy K", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var date))
                    continue;

                return date;
            }

            throw new InvalidDataException("unable to load git log data");
        }
    }

    internal class ResultsData
    {
        public Dictionary<string, FlavorData> results = new Dictionary<string, FlavorData>();
        public string baseDirectory;
    }
}

