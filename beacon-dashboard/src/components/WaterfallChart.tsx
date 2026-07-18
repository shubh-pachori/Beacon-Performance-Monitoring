import React, { useMemo } from 'react';
import { Database, Globe, Cpu } from 'lucide-react';

export interface TraceSpan {
  id: string;
  timestamp: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  environment: string;
  log_level: string;
  message: string;
  duration_ms: number | null;
  exception_type: string | null;
  metadata: Record<string, any> | null;
}

interface WaterfallChartProps {
  spans: TraceSpan[];
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ spans }) => {
  // Sort spans chronologically by timestamp
  const sortedSpans = useMemo(() => {
    return [...spans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [spans]);

  // Find root span or minimum timestamp to base relative offsets
  const rootSpan = useMemo(() => {
    return sortedSpans.find(s => !s.parent_span_id) || sortedSpans[0];
  }, [sortedSpans]);

  const traceStartTime = useMemo(() => {
    return rootSpan ? new Date(rootSpan.timestamp).getTime() : 0;
  }, [rootSpan]);

  // Calculate total duration (either root span duration or max timestamp + duration - start)
  const totalDurationMs = useMemo(() => {
    if (!rootSpan) return 100;
    if (rootSpan.duration_ms) return rootSpan.duration_ms;

    let maxEnd = traceStartTime;
    sortedSpans.forEach(span => {
      const start = new Date(span.timestamp).getTime();
      const end = start + (span.duration_ms || 0);
      if (end > maxEnd) maxEnd = end;
    });

    return Math.max(maxEnd - traceStartTime, 10);
  }, [sortedSpans, rootSpan, traceStartTime]);

  // Render icon based on trace span type
  const getSpanIcon = (span: TraceSpan) => {
    const msg = span.message.toLowerCase();
    if (msg.includes('select') || msg.includes('update') || msg.includes('insert') || msg.includes('delete') || span.metadata?.db_operation) {
      return <Database size={14} className="text-emerald-400" />;
    }
    if (msg.includes('http') || msg.includes('get /') || msg.includes('post /') || span.metadata?.http_method) {
      return <Globe size={14} className="text-cyan-400" />;
    }
    return <Cpu size={14} className="text-indigo-400" />;
  };

  // Get bar color based on span type or error state
  const getBarColor = (span: TraceSpan) => {
    if (span.log_level === 'Error' || span.log_level === 'Fatal' || span.exception_type) {
      return 'linear-gradient(90deg, #f87171, #ef4444)'; // Red
    }
    const msg = span.message.toLowerCase();
    if (msg.includes('select') || msg.includes('update') || msg.includes('insert') || msg.includes('delete') || span.metadata?.db_operation) {
      return 'linear-gradient(90deg, #34d399, #10b981)'; // Emerald
    }
    if (msg.includes('http') || msg.includes('get /') || msg.includes('post /') || span.metadata?.http_method) {
      return 'linear-gradient(90deg, #22d3ee, #06b6d4)'; // Cyan
    }
    return 'linear-gradient(90deg, #818cf8, #6366f1)'; // Indigo
  };

  // Build indentation/nesting mapping helper
  const getIndentation = (span: TraceSpan) => {
    let depth = 0;
    let currentParentId = span.parent_span_id;
    
    // Safety counter to prevent infinite loops in bad parent data
    let safety = 0;
    while (currentParentId && safety < 10) {
      const parent = sortedSpans.find(s => s.span_id === currentParentId);
      if (parent) {
        depth++;
        currentParentId = parent.parent_span_id;
      } else {
        break;
      }
      safety++;
    }
    return depth;
  };

  if (spans.length === 0) {
    return (
      <div className="glass-card text-center p-8 text-slate-400">
        No spans found for this trace. Select a log with a Trace ID to view waterfall hierarchy.
      </div>
    );
  }

  return (
    <div className="glass-card mb-6" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Trace Waterfall Timeline
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
            Trace ID: <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{rootSpan?.trace_id}</span>
          </p>
        </div>
        <div className="badge badge-info" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
          Total Duration: {totalDurationMs}ms ({spans.length} spans)
        </div>
      </div>

      {/* Timeline headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
        <div>SPAN HIERARCHY / OPERATION</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', width: '100%', paddingLeft: '8px' }}>
          <span>0ms</span>
          <span>{Math.round(totalDurationMs * 0.25)}ms</span>
          <span>{Math.round(totalDurationMs * 0.5)}ms</span>
          <span>{Math.round(totalDurationMs * 0.75)}ms</span>
          <span>{totalDurationMs}ms</span>
          {/* Vertical grid lines */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '25%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '75%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>
        </div>
      </div>

      {/* Waterfall Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '8px 0' }}>
        {sortedSpans.map(span => {
          const spanStart = new Date(span.timestamp).getTime();
          const relativeStart = Math.max(0, spanStart - traceStartTime);
          const duration = span.duration_ms || 1; // Fallback to 1ms for instant logs
          const leftPercent = Math.min(99, (relativeStart / totalDurationMs) * 100);
          const widthPercent = Math.min(100 - leftPercent, (duration / totalDurationMs) * 100);
          const depth = getIndentation(span);

          return (
            <div
              key={span.id}
              className="waterfall-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                fontSize: '0.85rem'
              }}
            >
              {/* Span Label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: `${depth * 16 + 8}px`,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
              >
                {getSpanIcon(span)}
                <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{span.service_name}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {span.message}
                </span>
              </div>

              {/* Span Timeline Bar */}
              <div style={{ position: 'relative', width: '100%', height: '24px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                {/* Background tracks */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '25%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '75%', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}></div>

                {/* Actual bar */}
                <div
                  className="waterfall-bar"
                  style={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    width: `${Math.max(1.5, widthPercent)}%`,
                    background: getBarColor(span),
                  }}
                  title={`${span.service_name}: ${span.message} (${duration}ms)`}
                />
                
                {/* Label right after the bar */}
                <span
                  style={{
                    position: 'absolute',
                    left: `calc(${leftPercent}% + ${Math.max(1.5, widthPercent)}% + 8px)`,
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {duration}ms
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
