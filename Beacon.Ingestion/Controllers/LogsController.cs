using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Dapper;

namespace Beacon.Ingestion.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LogsController : ControllerBase
{
    private readonly string _connectionString;

    public LogsController(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
                            ?? "Host=localhost;Database=beacon;Username=shubh;Port=5432;";
    }

    private IDbConnection CreateConnection() => new NpgsqlConnection(_connectionString);

    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] string? serviceName,
        [FromQuery] string? environment,
        [FromQuery] string? logLevel,
        [FromQuery] string? exceptionType,
        [FromQuery] string? search,
        [FromQuery] int? durationMin,
        [FromQuery] int? durationMax,
        [FromQuery] string? tagKey,
        [FromQuery] string? tagValue,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        using var db = CreateConnection();
        var sqlBuilder = new System.Text.StringBuilder("SELECT * FROM logs WHERE 1=1");
        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(serviceName))
        {
            sqlBuilder.Append(" AND service_name = @serviceName");
            parameters.Add("serviceName", serviceName);
        }

        if (!string.IsNullOrEmpty(environment))
        {
            sqlBuilder.Append(" AND environment = @environment");
            parameters.Add("environment", environment);
        }

        if (!string.IsNullOrEmpty(logLevel))
        {
            sqlBuilder.Append(" AND log_level = @logLevel");
            parameters.Add("logLevel", logLevel);
        }

        if (!string.IsNullOrEmpty(exceptionType))
        {
            sqlBuilder.Append(" AND exception_type = @exceptionType");
            parameters.Add("exceptionType", exceptionType);
        }

        if (!string.IsNullOrEmpty(search))
        {
            sqlBuilder.Append(" AND (message ILIKE @search OR stack_trace ILIKE @search)");
            parameters.Add("search", $"%{search}%");
        }

        if (durationMin.HasValue)
        {
            sqlBuilder.Append(" AND duration_ms >= @durationMin");
            parameters.Add("durationMin", durationMin.Value);
        }

        if (durationMax.HasValue)
        {
            sqlBuilder.Append(" AND duration_ms <= @durationMax");
            parameters.Add("durationMax", durationMax.Value);
        }

        // Search in JSONB using containment operator to utilize GIN index
        if (!string.IsNullOrEmpty(tagKey) && !string.IsNullOrEmpty(tagValue))
        {
            var dict = new Dictionary<string, string> { { tagKey, tagValue } };
            var jsonQuery = JsonSerializer.Serialize(dict);
            sqlBuilder.Append(" AND metadata @> @tagQuery::jsonb");
            parameters.Add("tagQuery", jsonQuery);
        }

        sqlBuilder.Append(" ORDER BY timestamp DESC LIMIT @limit OFFSET @offset");
        parameters.Add("limit", limit);
        parameters.Add("offset", offset);

        var logs = await db.QueryAsync(sqlBuilder.ToString(), parameters);

        // Deserializing metadata back to dictionary before returning
        var result = logs.Select(row => {
            var rowDict = (IDictionary<string, object>)row;
            if (rowDict.ContainsKey("metadata") && rowDict["metadata"] is string jsonStr)
            {
                rowDict["metadata"] = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr) ?? new();
            }
            return rowDict;
        });

        return Ok(result);
    }

    [HttpGet("trace/{traceId}")]
    public async Task<IActionResult> GetTraceSpans(Guid traceId)
    {
        using var db = CreateConnection();
        var sql = "SELECT * FROM logs WHERE trace_id = @traceId ORDER BY timestamp ASC";
        var spans = await db.QueryAsync(sql, new { traceId });

        var result = spans.Select(row => {
            var rowDict = (IDictionary<string, object>)row;
            if (rowDict.ContainsKey("metadata") && rowDict["metadata"] is string jsonStr)
            {
                rowDict["metadata"] = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr) ?? new();
            }
            return rowDict;
        });

        return Ok(result);
    }

    [HttpGet("stats/error-rates")]
    public async Task<IActionResult> GetErrorRates([FromQuery] string? environment)
    {
        using var db = CreateConnection();
        var sql = @"
            SELECT 
                date_trunc('minute', timestamp) AS bucket,
                COUNT(*) AS count
            FROM logs
            WHERE log_level IN ('Error', 'Fatal', 'Critical')
              AND (@environment IS NULL OR environment = @environment)
            GROUP BY bucket
            ORDER BY bucket ASC
            LIMIT 100;";

        var stats = await db.QueryAsync(sql, new { environment });
        return Ok(stats);
    }

    [HttpGet("stats/latency")]
    public async Task<IActionResult> GetLatencyStats([FromQuery] string? serviceName)
    {
        using var db = CreateConnection();
        var sql = @"
            SELECT 
                COUNT(duration_ms) AS total_requests,
                AVG(duration_ms) AS avg_latency,
                percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_latency,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_latency,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_latency
            FROM logs
            WHERE duration_ms IS NOT NULL
              AND (@serviceName IS NULL OR service_name = @serviceName);";

        var stats = await db.QueryFirstOrDefaultAsync(sql, new { serviceName });
        return Ok(stats);
    }

    [HttpGet("stats/top-exceptions")]
    public async Task<IActionResult> GetTopExceptions()
    {
        using var db = CreateConnection();
        var sql = @"
            SELECT 
                exception_type,
                COUNT(*) AS count,
                MAX(timestamp) AS last_seen
            FROM logs
            WHERE exception_type IS NOT NULL
            GROUP BY exception_type
            ORDER BY count DESC
            LIMIT 10;";

        var exceptions = await db.QueryAsync(sql);
        return Ok(exceptions);
    }
}
