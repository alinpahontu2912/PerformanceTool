using System;
using System.Collections.Generic;
using System.Text;

namespace WasmBenchmarkResults
{
    public class Item
    {
        public string hash;
        public string flavor;
        public DateTimeOffset commitTime;
        public Dictionary<string, double> minTimes;

        public override string ToString()
        {
            StringBuilder stringBuilder = new();
            foreach (var pair in minTimes)
            {
                stringBuilder.Append(pair.Key + " " + pair.Value);
            }

            stringBuilder.Append(commitTime);
            stringBuilder.Append(hash);
            stringBuilder.Append(flavor);
            return stringBuilder.ToString();
        }
    }
    public class GraphPointData
    {
        public string commitTime;
        public string taskMeasurementName;
        public double minTime;
        public string flavor;

        public GraphPointData(string commitTime, string flavor, KeyValuePair<string, double> pair)
        {
            this.commitTime = commitTime;
            taskMeasurementName = pair.Key;
            minTime = pair.Value;
            this.flavor = flavor;
        }
    }
}
