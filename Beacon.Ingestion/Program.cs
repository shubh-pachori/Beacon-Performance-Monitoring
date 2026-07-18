using System;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Beacon.Ingestion.Services;

var builder = WebApplication.CreateBuilder(args);

// Add controllers
builder.Services.AddControllers();

// Add Swagger/OpenAPI support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for React dashboard frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure Partitioned Token Bucket Rate Limiting Policy
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("IngestionPolicy", context =>
    {
        // Rate limit by X-API-Key header or remote IP
        string partitionKey = context.Request.Headers["X-API-Key"].ToString();
        if (string.IsNullOrEmpty(partitionKey))
        {
            partitionKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        }

        return RateLimitPartition.GetTokenBucketLimiter(partitionKey, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 100,
            QueueLimit = 5,
            ReplenishmentPeriod = TimeSpan.FromSeconds(1),
            TokensPerPeriod = 10,
            AutoReplenishment = true
        });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers.RetryAfter = "1";
        await context.HttpContext.Response.WriteAsync("Rate limit exceeded. Too many requests.");
    };
});

// Register Bounded System.Threading.Channels Queue
builder.Services.AddSingleton<IngestionChannel>(_ => new IngestionChannel(capacity: 10000));

// Register Background Worker Service
builder.Services.AddHostedService<IngestionWorker>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseRateLimiter();

app.MapControllers();

app.Run();
