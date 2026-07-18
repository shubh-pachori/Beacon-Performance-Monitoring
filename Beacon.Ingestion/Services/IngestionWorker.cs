using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using Beacon.Ingestion.Models;

namespace Beacon.Ingestion.Services;

public class IngestionWorker : BackgroundService
{
    private readonly IngestionChannel _channel;
    private readonly string _connectionString;
    private readonly ILogger<IngestionWorker> _logger;

    public IngestionWorker(IngestionChannel channel, IConfiguration configuration, ILogger<IngestionWorker> logger)
    {
        _channel = channel;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
                            ?? "Host=localhost;Database=beacon;Username=shubh;Port=5432;";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Beacon Ingestion Worker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Wait until there is at least one item in the channel
                if (await _channel.WaitToReadAsync(stoppingToken))
                {
                    var batch = new List<LogEventDto>();
                    var batchLimit = 1000;
                    var timeout = TimeSpan.FromMilliseconds(200);
                    var stopwatch = Stopwatch.StartNew();

                    // Read up to batchLimit items or until timeout occurs
                    while (batch.Count < batchLimit && stopwatch.Elapsed < timeout && !stoppingToken.IsCancellationRequested)
                    {
                        if (_channel.TryRead(out var logEvent) && logEvent != null)
                        {
                            batch.Add(logEvent);
                        }
                        else
                        {
                            if (batch.Count > 0)
                            {
                                break;
                            }
                            await Task.Delay(10, stoppingToken);
                        }
                    }

                    if (batch.Count > 0)
                    {
                        await ProcessBatchAsync(batch, stoppingToken);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while executing Ingestion Worker loop.");
                await Task.Delay(1000, stoppingToken); // Backoff before retrying
            }
        }

        _logger.LogInformation("Beacon Ingestion Worker stopped.");
    }

    private async Task ProcessBatchAsync(List<LogEventDto> batch, CancellationToken cancellationToken)
    {
        var distinctDates = batch
            .Select(b => (b.Timestamp ?? DateTime.UtcNow).Date)
            .Distinct()
            .ToList();

        try
        {
            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync(cancellationToken);

            // Ensure daily partitions exist for all dates in the batch
            foreach (var date in distinctDates)
            {
                using var cmd = new NpgsqlCommand("SELECT create_daily_partition(@date::date)", conn);
                cmd.Parameters.AddWithValue("date", date);
                await cmd.ExecuteScalarAsync(cancellationToken);
            }

            // Perform rapid binary COPY to logs table
            await using (var writer = await conn.BeginBinaryImportAsync(
                "COPY logs (id, timestamp, trace_id, span_id, parent_span_id, service_name, environment, log_level, message, exception_type, stack_trace, duration_ms, metadata) FROM STDIN (FORMAT BINARY)", 
                cancellationToken))
            {
                foreach (var log in batch)
                {
                    await writer.StartRowAsync(cancellationToken);
                    await writer.WriteAsync(log.Id ?? Guid.NewGuid(), NpgsqlDbType.Uuid, cancellationToken);
                    await writer.WriteAsync(log.Timestamp ?? DateTime.UtcNow, NpgsqlDbType.TimestampTz, cancellationToken);
                    await writer.WriteAsync(log.TraceId, NpgsqlDbType.Uuid, cancellationToken);
                    await writer.WriteAsync(log.SpanId, NpgsqlDbType.Uuid, cancellationToken);
                    await writer.WriteAsync(log.ParentSpanId, NpgsqlDbType.Uuid, cancellationToken);
                    await writer.WriteAsync(log.ServiceName, NpgsqlDbType.Varchar, cancellationToken);
                    await writer.WriteAsync(log.Environment, NpgsqlDbType.Varchar, cancellationToken);
                    await writer.WriteAsync(log.LogLevel, NpgsqlDbType.Varchar, cancellationToken);
                    await writer.WriteAsync(log.Message, NpgsqlDbType.Text, cancellationToken);
                    await writer.WriteAsync(log.ExceptionType, NpgsqlDbType.Varchar, cancellationToken);
                    await writer.WriteAsync(log.StackTrace, NpgsqlDbType.Text, cancellationToken);
                    await writer.WriteAsync(log.DurationMs, NpgsqlDbType.Integer, cancellationToken);

                    string? jsonMetadata = log.Metadata != null ? JsonSerializer.Serialize(log.Metadata) : null;
                    await writer.WriteAsync(jsonMetadata, NpgsqlDbType.Jsonb, cancellationToken);
                }

                await writer.CompleteAsync(cancellationToken);
            }

            _logger.LogInformation("Successfully bulk inserted {Count} log events into database.", batch.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bulk insert batch of {Count} events to PostgreSQL database.", batch.Count);
        }
    }
}
