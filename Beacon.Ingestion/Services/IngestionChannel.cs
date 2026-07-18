using System.Threading.Channels;
using Beacon.Ingestion.Models;

namespace Beacon.Ingestion.Services;

public class IngestionChannel
{
    private readonly Channel<LogEventDto> _channel;

    public IngestionChannel(int capacity = 10000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            SingleWriter = false,
            SingleReader = true,
            FullMode = BoundedChannelFullMode.DropOldest
        };
        _channel = Channel.CreateBounded<LogEventDto>(options);
    }

    public bool TryWrite(LogEventDto logEvent)
    {
        return _channel.Writer.TryWrite(logEvent);
    }

    public ValueTask<bool> WaitToReadAsync(CancellationToken cancellationToken)
    {
        return _channel.Reader.WaitToReadAsync(cancellationToken);
    }

    public bool TryRead(out LogEventDto? logEvent)
    {
        return _channel.Reader.TryRead(out logEvent);
    }
}
