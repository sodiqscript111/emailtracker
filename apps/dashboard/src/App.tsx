import React, { useState, useEffect, useCallback } from 'react';
import type { DashboardStats, TrackedEmailSummary } from '@email-tracker/shared';
import { dashboardApi } from './api/client.js';
import { OverviewCards } from './components/OverviewCards.js';
import { EmailTable } from './components/EmailTable.js';
import { EmailDetailDrawer } from './components/EmailDetailDrawer.js';
import { AuthModal } from './components/AuthModal.js';
import { Mail, Settings, RefreshCw, AlertTriangle } from 'lucide-react';

export default function App() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [emails, setEmails] = useState<TrackedEmailSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [senders, setSenders] = useState<string[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmailSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [statsData, listData, sendersList] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.listEmails(page, limit, selectedSender || null),
        dashboardApi.getSenders(),
      ]);
      setStats(statsData);
      setEmails(listData.items);
      setTotal(listData.total);
      setSenders(sendersList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'UNAUTHORIZED') {
        setErrorMessage('Authentication required: Invalid or missing API token.');
        setSettingsOpen(true);
      } else {
        setErrorMessage(`Cannot connect to backend: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedSender]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Mail size={18} />
          </div>
          <div>
            <span className="brand-title">Email Open Tracker</span>
            <span className="brand-badge" style={{ marginLeft: '8px' }}>Personal</span>
          </div>
        </div>

        <div className="nav-actions">
          <button
            className="btn btn-default"
            disabled={loading}
            onClick={() => fetchData()}
            title="Refresh data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            className="btn btn-default"
            onClick={() => setSettingsOpen(true)}
            title="Configure connection settings"
          >
            <Settings size={14} />
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              className="btn btn-default"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setSettingsOpen(true)}
            >
              Configure Token
            </button>
          </div>
        )}

        {/* Overview Stats */}
        <OverviewCards stats={stats} loading={loading} />

        {/* Tracked Emails List */}
        <EmailTable
          emails={emails}
          total={total}
          page={page}
          limit={limit}
          loading={loading}
          senders={senders}
          selectedSender={selectedSender}
          onSenderChange={(newSender) => {
            setSelectedSender(newSender);
            setPage(1);
          }}
          onPageChange={(newPage) => setPage(newPage)}
          onSelectEmail={(email) => setSelectedEmail(email)}
        />
      </main>

      {/* Drawer */}
      {selectedEmail && (
        <EmailDetailDrawer
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onDeleted={() => {
            setSelectedEmail(null);
            fetchData();
          }}
        />
      )}

      {/* Settings Modal */}
      <AuthModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => fetchData()}
      />
    </div>
  );
}
