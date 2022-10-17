using System.Net;
public class DataDownloader
{
    public HttpClient client;
    public DataDownloader()
    {
        client = new();
    }

    public async Task<byte[]> downloadAsBytes(string url)
    {
        var response = await client.GetAsync(url);
        if (response.StatusCode != HttpStatusCode.OK)
            throw new Exception("HTTP request failed with status code " + response.StatusCode + " and message " + response.ReasonPhrase);
        var text = await response.Content.ReadAsByteArrayAsync();
        return text;
    }
    public async Task<string> downloadAsText(string url)
    {
        var response = await client.GetAsync(url);
        if (response.StatusCode != HttpStatusCode.OK)
            throw new Exception("HTTP request failed with status code " + response.StatusCode + " and message " + response.ReasonPhrase);
        var text = await response.Content.ReadAsStringAsync();
        return text;
    }
}