import React, { useState } from 'react';
import { getSettings, saveSettings, type DashboardSettings, dashboardApi } from '../api/client.js';
import { Key, Server, Check, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const current = getSettings();
  const [apiBaseUrl, setApiBaseUrl] = useState(current.apiBaseUrl);
  const [apiToken, setApiToken] = useState(current.apiToken);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    saveSettings({ apiBaseUrl, apiToken });

    try {
      await dashboardApi.testConnection();
      await dashboardApi.getStats();
      setTestResult({ success: true, message: 'Connected to Worker successfully!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: msg === 'UNAUTHORIZED' ? 'Invalid API Token (401 Unauthorized)' : `Connection failed: ${msg}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ apiBaseUrl, apiToken });
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Backend Connection Settings</h2>
          <button className="btn btn-default" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Configure the Cloudflare Worker API URL and your private authentication token.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Worker Base URL</label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                required
                className="search-input"
                style={{ paddingLeft: '12px' }}
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="http://localhost:8787"
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Local dev: <code>http://localhost:8787</code>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>API Authentication Token</label>
            <input
              type="password"
              className="search-input"
              style={{ paddingLeft: '12px' }}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your secret token"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Matches <code>API_AUTH_TOKEN</code> in your Worker secrets.
            </span>
          </div>

          {testResult && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: testResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: testResult.success ? 'var(--success-text)' : 'var(--danger-text)',
              }}
            >
              {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-default"
              disabled={testing}
              onClick={handleTest}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button type="submit" className="btn btn-primary">
              Save & Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
