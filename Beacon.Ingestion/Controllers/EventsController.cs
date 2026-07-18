using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Beacon.Ingestion.Models;
using Beacon.Ingestion.Services;

namespace Beacon.Ingestion.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("IngestionPolicy")]
public class EventsController : ControllerBase
{
    private readonly IngestionChannel _channel;

    public EventsController(IngestionChannel channel)
    {
        _channel = channel;
    }

    [HttpPost]
    public IActionResult IngestEvent([FromBody] LogEventDto logEvent)
    {
        // Enrich incoming event with ID and Timestamp if missing
        logEvent.Id ??= Guid.NewGuid();
        logEvent.Timestamp ??= DateTime.UtcNow;

        // Try writing to in-memory System.Threading.Channels bounded queue
        bool success = _channel.TryWrite(logEvent);

        if (!success)
        {
            // If channel is full, return 503 Service Unavailable or 429
            return StatusCode(503, "Ingestion buffer is full. Please retry shortly.");
        }

        // Rapid HTTP 202 Accepted returned to client immediately
        return Accepted(new { EventId = logEvent.Id });
    }
}
