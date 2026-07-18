-- Beacon Database Schema DDL
-- Target Database: PostgreSQL 14+

-- Base partitioned table for logs, exceptions, and traces
CREATE TABLE IF NOT EXISTS logs (
    id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    trace_id UUID NULL,
    span_id UUID NULL,
    parent_span_id UUID NULL,
    service_name VARCHAR(100) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    exception_type VARCHAR(255) NULL,
    stack_trace TEXT NULL,
    duration_ms INT NULL,
    metadata JSONB NULL,
    PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp);

-- GIN Index on JSONB column using jsonb_path_ops for faster key-value and containment queries
CREATE INDEX IF NOT EXISTS idx_logs_metadata_gin ON logs USING gin (metadata jsonb_path_ops);

-- High-performance lookup index for specific trace hierarchies
CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs (trace_id) WHERE trace_id IS NOT NULL;

-- High-performance lookup index for parent-child spans
CREATE INDEX IF NOT EXISTS idx_logs_span ON logs (span_id) WHERE span_id IS NOT NULL;

-- Index for latency aggregation and profiling
CREATE INDEX IF NOT EXISTS idx_logs_perf ON logs (service_name, duration_ms) WHERE duration_ms IS NOT NULL;


-- Function to automatically create daily partition tables if they don't exist
CREATE OR REPLACE FUNCTION create_daily_partition(target_date DATE) 
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
    sql_query TEXT;
BEGIN
    partition_name := 'logs_y' || to_char(target_date, 'YYYY') || 'm' || to_char(target_date, 'MM') || 'd' || to_char(target_date, 'DD');
    start_date := to_char(target_date, 'YYYY-MM-DD');
    end_date := to_char(target_date + 1, 'YYYY-MM-DD');

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_tables 
        WHERE tablename = partition_name
    ) THEN
        sql_query := 'CREATE TABLE ' || quote_ident(partition_name) || 
                     ' PARTITION OF logs FOR VALUES FROM (' || quote_literal(start_date || ' 00:00:00+00') || 
                     ') TO (' || quote_literal(end_date || ' 00:00:00+00') || ')';
        EXECUTE sql_query;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Pre-generate partitions for yesterday, today, and tomorrow
SELECT create_daily_partition(CURRENT_DATE - 1);
SELECT create_daily_partition(CURRENT_DATE);
SELECT create_daily_partition(CURRENT_DATE + 1);
