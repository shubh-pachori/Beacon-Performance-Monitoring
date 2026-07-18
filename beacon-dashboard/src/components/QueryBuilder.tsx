import React, { useState } from 'react';
import { Filter, Search, RotateCcw } from 'lucide-react';

export interface QueryFilters {
  serviceName: string;
  environment: string;
  logLevel: string;
  exceptionType: string;
  search: string;
  durationMin: string;
  durationMax: string;
  tagKey: string;
  tagValue: string;
}

interface QueryBuilderProps {
  onSearch: (filters: QueryFilters) => void;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ onSearch }) => {
  const [filters, setFilters] = useState<QueryFilters>({
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    const emptyFilters = {
      serviceName: '',
      environment: '',
      logLevel: '',
      exceptionType: '',
      search: '',
      durationMin: '',
      durationMax: '',
      tagKey: '',
      tagValue: '',
    };
    setFilters(emptyFilters);
    onSearch(emptyFilters);
  };

  return (
    <form onSubmit={handleApply} className="glass-card mb-6">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Filter size={18} className="text-indigo-400" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Search & Query Builder</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Search Message / Stack Trace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Search Content</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
            <input
              type="text"
              name="search"
              placeholder="Query message/stack..."
              value={filters.search}
              onChange={handleChange}
              className="input-field"
              style={{ width: '100%', paddingLeft: '36px' }}
            />
          </div>
        </div>

        {/* Log Level */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Log Level</label>
          <select
            name="logLevel"
            value={filters.logLevel}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          >
            <option value="">All Levels</option>
            <option value="Information">Information</option>
            <option value="Warning">Warning</option>
            <option value="Error">Error</option>
            <option value="Debug">Debug</option>
          </select>
        </div>

        {/* Environment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Environment</label>
          <select
            name="environment"
            value={filters.environment}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          >
            <option value="">All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
          </select>
        </div>

        {/* Service Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Service Name</label>
          <input
            type="text"
            name="serviceName"
            placeholder="e.g. OrderService"
            value={filters.serviceName}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Latency Bounds */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Latency Min (ms)</label>
          <input
            type="number"
            name="durationMin"
            placeholder="Min ms"
            value={filters.durationMin}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Latency Max (ms)</label>
          <input
            type="number"
            name="durationMax"
            placeholder="Max ms"
            value={filters.durationMax}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          />
        </div>

        {/* Exception Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Exception Type</label>
          <input
            type="text"
            name="exceptionType"
            placeholder="e.g. NullReferenceException"
            value={filters.exceptionType}
            onChange={handleChange}
            className="input-field"
            style={{ width: '100%' }}
          />
        </div>

        {/* Custom JSONB Tag Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Custom Metadata Tag</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              name="tagKey"
              placeholder="Key (e.g. browser)"
              value={filters.tagKey}
              onChange={handleChange}
              className="input-field"
              style={{ width: '50%' }}
            />
            <input
              type="text"
              name="tagValue"
              placeholder="Value (e.g. Chrome)"
              value={filters.tagValue}
              onChange={handleChange}
              className="input-field"
              style={{ width: '50%' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          onClick={handleReset}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
        >
          <RotateCcw size={14} />
          Reset Filters
        </button>
        <button
          type="submit"
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 24px' }}
        >
          <Search size={14} />
          Apply Queries
        </button>
      </div>
    </form>
  );
};
