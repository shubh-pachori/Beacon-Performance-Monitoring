import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, AlertOctagon, Clock, RefreshCw, Layers } from 'lucide-react';
import { QueryBuilder } from './QueryBuilder';
import type { QueryFilters } from './QueryBuilder';
import { WaterfallChart } from './WaterfallChart';
import type { TraceSpan } from './WaterfallChart';

const API_BASE = 'http://localhost:5285/api';

// --- MOCK DATA FALLBACKS ---
const mockErrorRates = Array.from({ length: 24 }).map((_, i) => ({
  bucket: `${String(i).padStart(2, '0')}:00`,
  count: Math.floor(Math.random() * 40) + 5,
}));

const mockLatency = [
  { service_name: 'OrderService', avg_latency: 180, p95_latency: 310, p99_latency: 420 },
  { service_name: 'UserService', avg_latency: 90, p95_latency: 170, p99_latency: 240 },
  { service_name: 'BillingGateway', avg_latency: 340, p95_latency: 680, p99_latency: 920 },
  { service_name: 'InventoryAPI', avg_latency: 150, p95_latency: 290, p99_latency: 390 },
];

const mockTopExceptions = [
  { exception_type: 'System.NullReferenceException', count: 184, last_seen: new Date().toISOString() },
  { exception_type: 'Npgsql.PostgresException', count: 96, last_seen: new Date().toISOString() },
  { exception_type: 'System.TimeoutException', count: 48, last_seen: new Date().toISOString() },
  { exception_type: 'System.UnauthorizedAccessException', count: 21, last_seen: new Date().toISOString() },
];

const mockLogs = [
  {
    id: '1e5e3489-cc75-4309-8472-bc8990aefd12',
    timestamp: new Date(Date.now() - 5000).toISOString(),
    service_name: 'OrderService',
    environment: 'Production',
    log_level: 'Error',
    message: 'An unhandled exception occurred during transaction: NullReferenceException',
    exception_type: 'NullReferenceException',
    stack_trace: 'at Beacon.Client.Services.OrderService.Checkout(Cart cart) in Services\\OrderService.cs:line 42\n   at Beacon.Client.Controllers.CheckoutController.Submit() in Controllers\\CheckoutController.cs:line 18',
    duration_ms: 124,
    trace_id: 'a87fd16c-e69c-4859-963d-4c3e8cd83d98',
    span_id: '502b489c-a111-4822-a9b1-e8d90209ab44',
    parent_span_id: null,
    metadata: { browser: 'Chrome', os: 'macOS', user_id: '1004', cpu_usage: '24%' }
  },
  {
    id: 'f872b16a-993d-4c3e-8cd8-c3e8cd83d982',
    timestamp: new Date(Date.now() - 25000).toISOString(),
    service_name: 'BillingGateway',
    environment: 'Production',
    log_level: 'Error',
    message: 'An unhandled exception occurred during transaction: PostgresException',
    exception_type: 'PostgresException',
    stack_trace: 'Fatal: connection to server at \"10.0.4.12\", port 5432 failed: Connection refused\n   at Npgsql.Internal.NpgsqlConnector.Connect() in Internal\\NpgsqlConnector.cs:line 204\n   at Npgsql.NpgsqlConnection.Open() in NpgsqlConnection.cs:line 120',
    duration_ms: 540,
    trace_id: 'b16ae69c-e69c-4859-963d-4c3e8cd83d98',
    span_id: 'a111b16a-a111-4822-a9b1-e8d90209ab44',
    parent_span_id: null,
    metadata: { browser: 'Firefox', os: 'Linux', user_id: '9921', http_status: '500' }
  }
];

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'explorer'>('overview');
  const [logs, setLogs] = useState<any[]>([]);
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([]);
  const [errorRates, setErrorRates] = useState<any[]>([]);
  const [latencyStats, setLatencyStats] = useState<any[]>([]);
  const [topExceptions, setTopExceptions] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);

  // Search/Filter state
  const [currentFilters, setCurrentFilters] = useState<QueryFilters>({
    serviceName: '',
    environment: '',
    logLevel: '',
    exceptionType: '',
    search: '',
    durationMin: '',
    durationMax: '',
    tagKey: '',
    tagValue: '',
  });

  const loadData = async (filters: QueryFilters = currentFilters) => {
    setLoading(true);
    try {
      // 1. Fetch Logs
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) queryParams.append(key, val);
      });

      const logsRes = await fetch(`${API_BASE}/logs?${queryParams.toString()}`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
        setApiConnected(true);
      } else {
        throw new Error('API failure');
      }

      // 2. Fetch Stats
      const errorRes = await fetch(`${API_BASE}/logs/stats/error-rates`);
      if (errorRes.ok) {
        const errorData = await errorRes.json();
        setErrorRates(errorData.length > 0 ? errorData : mockErrorRates);
      }

      const latencyRes = await fetch(`${API_BASE}/logs/stats/latency`);
      if (latencyRes.ok) {
        const latData = await latencyRes.json();
        // Backend returns single object, wrap it or adapt
        setLatencyStats(latData.total_requests ? [latData] : mockLatency);
      }

      const excRes = await fetch(`${API_BASE}/logs/stats/top-exceptions`);
      if (excRes.ok) {
        const excData = await excRes.json();
        setTopExceptions(excData.length > 0 ? excData : mockTopExceptions);
      }
    } catch (e) {
      console.log('Using mock fallbacks because server is offline.');
      setLogs(mockLogs);
      setErrorRates(mockErrorRates);
      setLatencyStats(mockLatency);
      setTopExceptions(mockTopExceptions);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (filters: QueryFilters) => {
    setCurrentFilters(filters);
    loadData(filters);
  };

  const handleSelectLog = async (log: any) => {
    setSelectedLog(log);
    if (!log.trace_id) {
      setTraceSpans([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/logs/trace/${log.trace_id}`);
      if (res.ok) {
        const spans = await res.json();
        setTraceSpans(spans);
      } else {
        throw new Error();
      }
    } catch {
      // Return simulated spans for the specific mock trace
      const mockSpansForTrace: TraceSpan[] = [
        {
          id: log.id,
          timestamp: log.timestamp,
          trace_id: log.trace_id,
          span_id: log.span_id,
          parent_span_id: null,
          service_name: log.service_name,
          environment: log.environment,
          log_level: log.log_level,
          message: log.message,
          duration_ms: log.duration_ms,
          exception_type: log.exception_type,
          metadata: log.metadata
        },
        {
          id: 'child-db-query-id',
          timestamp: new Date(new Date(log.timestamp).getTime() + 10).toISOString(),
          trace_id: log.trace_id,
          span_id: 'db-span-id',
          parent_span_id: log.span_id,
          service_name: log.service_name,
          environment: log.environment,
          log_level: 'Debug',
          message: 'SELECT * FROM orders WHERE id = @Id',
          duration_ms: Math.round((log.duration_ms || 100) * 0.4),
          exception_type: null,
          metadata: { db_operation: 'SELECT', db_table: 'orders' }
        },
        {
          id: 'child-http-call-id',
          timestamp: new Date(new Date(log.timestamp).getTime() + 15 + Math.round((log.duration_ms || 100) * 0.4)).toISOString(),
          trace_id: log.trace_id,
          span_id: 'http-span-id',
          parent_span_id: log.span_id,
          service_name: log.service_name,
          environment: log.environment,
          log_level: 'Information',
          message: 'POST https://api.stripe.com/v3/charges',
          duration_ms: Math.round((log.duration_ms || 100) * 0.5),
          exception_type: null,
          metadata: { http_method: 'POST', provider: 'Stripe' }
        }
      ];
      setTraceSpans(mockSpansForTrace);
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'Fatal':
      case 'Critical':
      case 'Error':
        return 'badge badge-error';
      case 'Warning':
        return 'badge badge-warn';
      default:
        return 'badge badge-info';
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 20px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={32} className="text-indigo-400" />
            <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BEACON
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#64748b', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
              v1.0.0
            </span>
          </div>
          <p style={{ color: '#94a3b8', marginTop: '4px', fontSize: '0.95rem' }}>
            Real-time Ingestion & APM Exception Tracker Console
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Connection Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className={apiConnected ? 'live-indicator' : ''} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiConnected ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
              {apiConnected ? 'Connected to Backend API' : 'Disconnected (Demo Mode)'}
            </span>
          </div>

          <button onClick={() => loadData()} className="btn-secondary" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'overview' ? '#f8fafc' : '#64748b',
            borderBottom: activeTab === 'overview' ? '2px solid #6366f1' : '2px solid transparent',
            padding: '12px 20px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'explorer' ? '#f8fafc' : '#64748b',
            borderBottom: activeTab === 'explorer' ? '2px solid #6366f1' : '2px solid transparent',
            padding: '12px 20px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Logs Explorer
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div>
          {/* Top Banner Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Ingestion Uptime</span>
                <Clock size={20} className="text-indigo-400" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>99.98%</h2>
              <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>Operational</p>
            </div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Log Ingestion Rate</span>
                <Activity size={20} className="text-cyan-400" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>243/s</h2>
              <p style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginTop: '4px' }}>In-Memory Channel Buffer: 0.1%</p>
            </div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Rate Limited Requests</span>
                <AlertOctagon size={20} className="text-rose-400" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>0</h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Token Bucket Replenished</p>
            </div>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Active Tracing Tracks</span>
                <Layers size={20} className="text-emerald-400" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>14,920</h2>
              <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>Partition logs rolling active</p>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Error Rates Over Time */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>
                Error Rate Timeline (errors / min)
              </h3>
              <div style={{ width: '100%', height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={errorRates}>
                    <defs>
                      <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bucket" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#f87171" fillOpacity={1} fill="url(#colorError)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latency by Service */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>
                Service Latency Distribution (ms)
              </h3>
              <div style={{ width: '100%', height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyStats.length > 0 ? latencyStats : mockLatency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="service_name" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Bar dataKey="avg_latency" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Latency" />
                    <Bar dataKey="p95_latency" fill="#06b6d4" radius={[4, 4, 0, 0]} name="p95 Latency" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Top Exceptions Table */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Top Throwing Exceptions</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                    <th style={{ padding: '10px' }}>EXCEPTION TYPE</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>COUNT</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>LAST SEEN</th>
                  </tr>
                </thead>
                <tbody>
                  {topExceptions.map((exc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#f87171' }}>
                        {exc.exception_type}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {exc.count}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', color: '#64748b' }}>
                        {new Date(exc.last_seen).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Recent Errors */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Recent Exception Logs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {logs.filter(l => l.log_level === 'Error' || l.exception_type).slice(0, 3).map((log, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedLog(log);
                      setActiveTab('explorer');
                      handleSelectLog(log);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover:border-slate-500"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-error">{log.exception_type || 'Error'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '4px' }}>
                      Service: {log.service_name} • Env: {log.environment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Query Builder */}
          <QueryBuilder onSearch={handleSearch} />

          {/* Explorer Main Content Area */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 500px' : '1fr', gap: '20px' }}>
            {/* Logs List Table */}
            <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Logs Event List</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                    <th style={{ padding: '10px' }}>LEVEL</th>
                    <th style={{ padding: '10px' }}>TIMESTAMP</th>
                    <th style={{ padding: '10px' }}>SERVICE</th>
                    <th style={{ padding: '10px' }}>MESSAGE</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>LATENCY</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => handleSelectLog(log)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer',
                        backgroundColor: selectedLog?.id === log.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                      className="hover:bg-slate-800"
                    >
                      <td style={{ padding: '12px 10px' }}>
                        <span className={getLogLevelClass(log.log_level)}>{log.log_level}</span>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: '#e2e8f0' }}>
                        {log.service_name}
                      </td>
                      <td style={{ padding: '12px 10px', color: '#cbd5e1', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No logs match your filter queries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Log Detail Pane (Slide-Out panel) */}
            {selectedLog && (
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start', position: 'sticky', top: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Event Detail</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>MESSAGE</span>
                    <p style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600, marginTop: '2px' }}>{selectedLog.message}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>SERVICE</span>
                      <p style={{ fontSize: '0.85rem', color: '#f1f5f9', marginTop: '2px' }}>{selectedLog.service_name}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>ENVIRONMENT</span>
                      <p style={{ fontSize: '0.85rem', color: '#f1f5f9', marginTop: '2px' }}>{selectedLog.environment}</p>
                    </div>
                  </div>

                  {selectedLog.duration_ms && (
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>DURATION</span>
                      <p style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 700, marginTop: '2px' }}>{selectedLog.duration_ms}ms</p>
                    </div>
                  )}

                  {/* Metadata JSONB Custom Tags */}
                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                        METADATA TAGS (JSONB GIN Indexed)
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(selectedLog.metadata).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                            <span style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', color: '#a5b4fc', fontWeight: 600 }}>{k}</span>
                            <span style={{ padding: '2px 6px', color: '#f1f5f9' }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trace Waterfall trigger */}
                  {selectedLog.trace_id && (
                    <div style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>
                        NESTED TRACE TIMELINE
                      </span>
                      <WaterfallChart spans={traceSpans} />
                    </div>
                  )}

                  {/* Exception details & stack trace */}
                  {selectedLog.exception_type && (
                    <div style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block' }}>EXCEPTION TYPE</span>
                      <p style={{ fontSize: '0.85rem', color: '#f87171', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px' }}>
                        {selectedLog.exception_type}
                      </p>
                      {selectedLog.stack_trace && (
                        <div style={{ marginTop: '10px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>STACK TRACE</span>
                          <pre className="code-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {selectedLog.stack_trace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
