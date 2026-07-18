using System;
using System.Collections.Generic;

namespace Beacon.Ingestion.Models;

public class LogEventDto
{
    public Guid? Id { get; set; }
    public DateTime? Timestamp { get; set; }
    public Guid? TraceId { get; set; }
    public Guid? SpanId { get; set; }
    public Guid? ParentSpanId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string LogLevel { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ExceptionType { get; set; }
    public string? StackTrace { get; set; }
    public int? DurationMs { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}
