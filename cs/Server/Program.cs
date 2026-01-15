using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Serve the 'web' folder from repo root
var webRoot = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "web");
if (!Directory.Exists(webRoot))
{
    // fallback to 'web' in current directory
    webRoot = Path.Combine(Directory.GetCurrentDirectory(), "web");
}

app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(webRoot) });
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(webRoot) });

app.MapGet("/health", () => Results.Text("ok"));

app.Run();
