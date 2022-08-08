using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
public class QuerySolver
{
    public HttpClient client;
    public QuerySolver()
    {
        client = new();
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