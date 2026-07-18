using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Beacon.Emulator;

class Program
{
    private static readonly HttpClient HttpClient = new();
    private static string _apiUrl = "http://localhost:5285/api/events";
    private static string _apiKey = "emulator_api_key_xyz123";

    static async Task Main(string[] args)
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("==================================================");
        Console.WriteLine("   Beacon API Performance & Exception Emulator   ");
        Console.WriteLine("==================================================");
        Console.ResetColor();

        if (args.Length > 0)
        {
            _apiUrl = args[0];
        }

        Console.WriteLine($"Ingestion API Endpoint: {_apiUrl}");
        Console.WriteLine("Select Mode:");
        Console.WriteLine("1. Send a single batch of simulated trace trees & exceptions");
        Console.WriteLine("2. Loop continuously (Normal simulated load)");
        Console.WriteLine("3. Log Storm Mode (High frequency loop to test rate limits)");
        Console.Write("Enter choice (1-3): ");
        var choice = Console.ReadLine();

        switch (choice)
        {
            case "1":
                await SendSingleBatchAsync();
                break;
            case "2":
                await RunContinuousSimulatedLoadAsync();
                break;
            case "3":
                await RunLogStormAsync();
                break;
            default:
                Console.WriteLine("Invalid choice. Exiting.");
                break;
        }
    }

    private static async Task SendSingleBatchAsync()
    {
        Console.WriteLine("\nSending simulated trace trees...");
        var tasks = new List<Task>();
        for (int i = 0; i < 5; i++)
        {
            tasks.Add(SendTraceTreeAsync());
        }
        await Task.WhenAll(tasks);

        Console.WriteLine("Sending simulated exceptions...");
        await SendExceptionAsync("NullReferenceException", "Object reference not set to an instance of an object.\n   at Beacon.Client.Services.OrderService.Checkout(Cart cart) in Services\\OrderService.cs:line 42\n   at Beacon.Client.Controllers.CheckoutController.Submit() in Controllers\\CheckoutController.cs:line 18");
        await SendExceptionAsync("PostgresException", "Fatal: connection to server at \"10.0.4.12\", port 5432 failed: Connection refused\n   at Npgsql.Internal.NpgsqlConnector.Connect() in Internal\\NpgsqlConnector.cs:line 204\n   at Npgsql.NpgsqlConnection.Open() in NpgsqlConnection.cs:line 120");
        await SendExceptionAsync("TimeoutException", "The operation has timed out.\n   at System.Net.Http.HttpConnection.SendAsync() in System\\Net\\Http\\HttpConnection.cs:line 309");

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\nSingle batch completed!");
        Console.ResetColor();
    }

    private static async Task RunContinuousSimulatedLoadAsync()
    {
        Console.WriteLine("\nRunning continuous simulated load. Press Ctrl+C to stop...");
        var random = new Random();
        int count = 0;

        while (true)
        {
            count++;
            try
            {
                if (random.Next(1, 100) > 90)
                {
                    // 10% chance of generating exception
                    string[] excTypes = { "NullReferenceException", "KeyNotFoundException", "InvalidOperationException", "ArgumentException" };
                    var exc = excTypes[random.Next(excTypes.Length)];
                    await SendExceptionAsync(exc, $"Simulated {exc} error generated during user session.");
                }
                else
                {
                    // 90% chance of trace trees
                    await SendTraceTreeAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending event: {ex.Message}");
            }

            Console.Write($"\rEvents simulated: {count}");
            await Task.Delay(random.Next(500, 2000));
        }
    }

    private static async Task RunLogStormAsync()
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("\n*** LOG STORM MODE INITIATED ***");
        Console.WriteLine("Sending high-throughput concurrent requests to trigger rate limiting...");
        Console.ResetColor();

        using var cts = new CancellationTokenSource();
        var workers = new List<Task>();
        int totalSent = 0;
        int rateLimited = 0;

        // Run 8 concurrent worker tasks firing requests
        for (int w = 0; w < 8; w++)
        {
            workers.Add(Task.Run(async () =>
            {
                var random = new Random();
                while (!cts.IsCancellationRequested)
                {
                    var payload = new
                    {
                        id = Guid.NewGuid(),
                        timestamp = DateTime.UtcNow,
                        serviceName = "CheckoutService",
                        environment = "Production",
                        logLevel = "Error",
                        message = "Infinite loop log storm event",
                        exceptionType = "LogStormException",
                        stackTrace = "at Beacon.App.StormTest() in StormTest.cs:line 99",
                        metadata = new Dictionary<string, object>
                        {
                            { "client_ip", "192.168.1.100" },
                            { "thread_id", Thread.CurrentThread.ManagedThreadId }
                        }
                    };

                    try
                    {
                        var request = new HttpRequestMessage(HttpMethod.Post, _apiUrl);
                        request.Headers.Add("X-API-Key", _apiKey);
                        request.Content = JsonContent.Create(payload);
                        
                        var response = await HttpClient.SendAsync(request);
                        Interlocked.Increment(ref totalSent);

                        if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                        {
                            Interlocked.Increment(ref rateLimited);
                        }
                    }
                    catch
                    {
                        // Ignore network connection failures during storm
                    }

                    await Task.Delay(10); // Minimal sleep to keep loop hot
                }
            }));
        }

        // Run for 15 seconds then stop
        for (int sec = 15; sec > 0; sec--)
        {
            Console.WriteLine($"Running storm... {sec} seconds remaining. Total sent: {totalSent}, Rate-limited (429): {rateLimited}");
            await Task.Delay(1000);
        }

        cts.Cancel();
        await Task.WhenAll(workers);

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"\nLog Storm finished. Total: {totalSent}, Rate-Limited (429): {rateLimited}");
        Console.ResetColor();
    }

    private static async Task SendTraceTreeAsync()
    {
        var traceId = Guid.NewGuid();
        var rootSpanId = Guid.NewGuid();
        var random = new Random();

        var serviceNames = new[] { "OrderService", "UserService", "BillingGateway", "InventoryAPI" };
        var serviceName = serviceNames[random.Next(serviceNames.Length)];
        var envs = new[] { "Production", "Staging" };
        var env = envs[random.Next(envs.Length)];
        var browserNames = new[] { "Chrome", "Firefox", "Safari", "Edge" };
        var osNames = new[] { "Windows", "macOS", "Linux", "iOS" };

        var commonMetadata = new Dictionary<string, object>
        {
            { "browser", browserNames[random.Next(browserNames.Length)] },
            { "os", osNames[random.Next(osNames.Length)] },
            { "user_id", random.Next(1000, 9999).ToString() },
            { "app_version", "2.1.4" }
        };

        // 1. Send Parent Span: HTTP Request
        int dbTime = random.Next(20, 100);
        int apiTime = random.Next(40, 150);
        int totalDuration = dbTime + apiTime + random.Next(10, 50);

        var rootSpan = new
        {
            id = rootSpanId,
            timestamp = DateTime.UtcNow.AddMilliseconds(-totalDuration),
            traceId = traceId,
            spanId = rootSpanId,
            parentSpanId = (Guid?)null,
            serviceName = serviceName,
            environment = env,
            logLevel = "Information",
            message = $"GET /api/checkout/orders",
            durationMs = totalDuration,
            metadata = commonMetadata
        };

        await PostEventAsync(rootSpan);

        // 2. Send Child Span 1: PostgreSQL query
        var childSpan1Id = Guid.NewGuid();
        var childSpan1 = new
        {
            id = childSpan1Id,
            timestamp = DateTime.UtcNow.AddMilliseconds(-totalDuration + 10),
            traceId = traceId,
            spanId = childSpan1Id,
            parentSpanId = rootSpanId,
            serviceName = serviceName,
            environment = env,
            logLevel = "Debug",
            message = "SELECT * FROM orders WHERE user_id = @UserId LIMIT 10",
            durationMs = dbTime,
            metadata = new Dictionary<string, object>(commonMetadata)
            {
                { "db_operation", "SELECT" },
                { "db_table", "orders" },
                { "rows_returned", random.Next(1, 10) }
            }
        };

        await PostEventAsync(childSpan1);

        // 3. Send Child Span 2: External HTTP POST API query
        var childSpan2Id = Guid.NewGuid();
        var childSpan2 = new
        {
            id = childSpan2Id,
            timestamp = DateTime.UtcNow.AddMilliseconds(-totalDuration + 10 + dbTime),
            traceId = traceId,
            spanId = childSpan2Id,
            parentSpanId = rootSpanId,
            serviceName = serviceName,
            environment = env,
            logLevel = "Information",
            message = "POST https://api.stripe.com/v3/charges",
            durationMs = apiTime,
            metadata = new Dictionary<string, object>(commonMetadata)
            {
                { "http_method", "POST" },
                { "http_status", 200 },
                { "provider", "Stripe" }
            }
        };

        await PostEventAsync(childSpan2);
    }

    private static async Task SendExceptionAsync(string exceptionType, string stackTrace)
    {
        var random = new Random();
        var traceId = Guid.NewGuid();
        var spanId = Guid.NewGuid();
        var browserNames = new[] { "Chrome", "Firefox", "Safari", "Edge" };
        var osNames = new[] { "Windows", "macOS", "Linux", "iOS" };

        var logEvent = new
        {
            id = Guid.NewGuid(),
            timestamp = DateTime.UtcNow,
            traceId = traceId,
            spanId = spanId,
            serviceName = "OrderService",
            environment = "Production",
            logLevel = "Error",
            message = $"An unhandled exception occurred during transaction: {exceptionType}",
            exceptionType = exceptionType,
            stackTrace = stackTrace,
            durationMs = random.Next(10, 100),
            metadata = new Dictionary<string, object>
            {
                { "browser", browserNames[random.Next(browserNames.Length)] },
                { "os", osNames[random.Next(osNames.Length)] },
                { "user_id", "user_storm_99" },
                { "cpu_usage", $"{random.Next(15, 80)}%" }
            }
        };

        await PostEventAsync(logEvent);
    }

    private static async Task PostEventAsync(object payload)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, _apiUrl);
            request.Headers.Add("X-API-Key", _apiKey);
            request.Content = JsonContent.Create(payload);
            
            var response = await HttpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Ingestion returned status code: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Network error: {ex.Message}");
        }
    }
}
