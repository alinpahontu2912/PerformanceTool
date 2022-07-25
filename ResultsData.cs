using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text;
using System.Collections.Generic;
using System;
using System.IO;
using System.Linq;

namespace WasmBenchmarkResults
{
    class JsonResultsData
    {
        public List<BenchTask.Result> results;
        public Dictionary<string, double> minTimes;
        public DateTime timeStamp;
        public string origin;

        public static JsonResultsData? Load(string origin, string json)
        {
            var options = new JsonSerializerOptions { IncludeFields = true };
            var data = JsonSerializer.Deserialize<JsonResultsData>(json, options);
            if (data == null)
                throw new Exception("Unable to deserialize");
            data.origin = origin;
            return data;
        }

        public static JsonResultsData? Load(string path)
        {
            return Load(path, File.ReadAllText(path));
        }

        public override string ToString()
        {
            StringBuilder stringBuilder = new();
            foreach (var result in results)
            {
                stringBuilder.Append(result.ToString() + '\n');
            }

            foreach (var pair in minTimes)
            {
                stringBuilder.Append(pair.Key + " " + pair.Value + "\n");
            }

            stringBuilder.Append(timeStamp);
            return stringBuilder.ToString();
        }
    }

    internal class FlavorData
    {
        public DateTimeOffset commitTime;
        public string origin;
        public string flavor;
        public JsonResultsData results;

        public HashSet<string> MeasurementLabels => results.minTimes.Keys.ToHashSet<string>();

        public FlavorData(string origin, string flavor)
        {
            this.origin = origin;
            this.flavor = flavor;
            results = JsonResultsData.Load(Path.Combine(origin, "results.json"));
            commitTime = LoadGitLog(File.ReadAllText(Path.Combine(origin, "git-log.txt")));
        }

        public FlavorData(string origin, string flavor, string jsonResultsData, string gitLogContent)
        {
            this.origin = origin;
            this.flavor = flavor;
            results = JsonResultsData.Load(origin, jsonResultsData);
            commitTime = LoadGitLog(gitLogContent);
        }

        public DateTimeOffset LoadGitLog(string content)
        {
            var lines = content.Split("\n");
            var regex = new Regex(@"^Date: +(.*)$");
            foreach (var line in lines)
            {
                var match = regex.Match(line);
                if (!match.Success)
                    continue;

                var dateString = match.Groups[1].Value;

                if (!DateTimeOffset.TryParseExact(dateString, "ddd MMM d HH:mm:ss yyyy K", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var date))
                    continue;

                return date;
            }

            throw new InvalidDataException("unable to load git log data");
        }

        public override string ToString()
        {
            return "\npath: " + origin + "\nflavor: " + flavor + "\ndata: " + results + "\nCommitTime: " + commitTime;
        }

    }

    internal class ResultsData
    {
        public Dictionary<string, FlavorData> results = new();
    }

    internal class GraphData {
        public DateTimeOffset dateTime;
        public Dictionary<string, double> minTimes;
        public string flavor;

        public GraphData(FlavorData flavorData) {
            dateTime = flavorData.commitTime;
            minTimes = flavorData.results.minTimes;
            flavor = flavorData.flavor;
        }
    }
}

