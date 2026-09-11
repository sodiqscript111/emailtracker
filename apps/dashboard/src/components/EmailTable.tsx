import React, { useState } from 'react';
import type { TrackedEmailSummary } from '@email-tracker/shared';
import {
  Search,
  CheckCircle,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Send,
  MailCheck,
} from 'lucide-react';

interface Props {
  emails: TrackedEmailSummary[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  senders: string[];
  selectedSender: string;
  onSenderChange: (sender: string) => void;
  onPageChange: (newPage: number) => void;
  onSelectEmail: (email: TrackedEmailSummary) => void;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getElapsedDaysInfo(timestamp: number | null): { text: string; isWeek: boolean } {
  if (!timestamp) return { text: '—', isWeek: false };
  const diffMs = Date.now() - timestamp;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 7) {
    return { text: `${days}d ago · Follow up!`, isWeek: true };
  }
  if (days === 0) {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return { text: hours <= 1 ? 'Today' : `${hours}h ago`, isWeek: false };
  }
  return { text: `${days}d ago`, isWeek: false };
}

export const EmailTable: React.FC<Props> = ({
  emails,
  total,
  page,
  limit,
  loading,
  senders,
  selectedSender,
  onSenderChange,
  onPageChange,
  onSelectEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'week'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'opened' | 'unopened'>('all');

  // Count how many emails are 7+ days old
  const weekOldCount = emails.filter((item) => {
    const sentTime = item.sentAt || item.createdAt;
    return sentTime && (Date.now() - sentTime) >= ONE_WEEK_MS;
  }).length;

  const filtered = emails.filter((item) => {
    const sentTime = item.sentAt || item.createdAt;
    const isWeekOld = sentTime && (Date.now() - sentTime) >= ONE_WEEK_MS;

    if (activeTab === 'week' && !isWeekOld) {
      return false;
    }

    const matchesSearch =
      item.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.senderEmail && item.senderEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'opened') return item.openCount > 0;
    if (statusFilter === 'unopened') return item.openCount === 0;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="card-section">
      {/* Tab Header */}
      <div className="table-tabs-header">
        <div className="filter-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <MailCheck size={16} />
            <span>All Emails</span>
            <span className="tab-badge">{total}</span>
          </button>

          <button
            type="button"
            className={`tab-btn tab-week ${activeTab === 'week' ? 'active' : ''}`}
            onClick={() => setActiveTab('week')}
            title="Emails where 7 or more days have passed without reaching out again"
          >
            <Calendar size={16} />
            <span>It's Been a Week</span>
            <span
              className="tab-badge"
              style={
                weekOldCount > 0
                  ? { background: '#fef3c7', color: '#b45309', fontWeight: 700 }
                  : undefined
              }
            >
              {weekOldCount}
            </span>
          </button>
        </div>

        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search recipient, sender, subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {senders.length > 0 && (
            <select
              className="filter-select"
              value={selectedSender}
              onChange={(e) => onSenderChange(e.target.value)}
              title="Filter by sender"
            >
              <option value="">All Senders ({senders.length})</option>
              {senders.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'opened' | 'unopened')}
          >
            <option value="all">All Statuses</option>
            <option value="opened">Opened</option>
            <option value="unopened">Not opened</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sender</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Age / Follow-up</th>
              <th>Sent</th>
              <th>Last opened</th>
              <th>Opens</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading emails...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '0' }}>
                  {activeTab === 'week' ? (
                    <div className="empty-tab-state">
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                      <h3>No 7-Day Follow-ups Due</h3>
                      <p>
                        All tracked job applications were sent within the last 7 days.
                        When an outreach reaches 1 week old, it will automatically appear here!
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      {emails.length === 0 ? 'No tracked emails recorded yet.' : 'No emails match your filter.'}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((email) => {
                const isOpened = email.openCount > 0;
                const sentTime = email.sentAt || email.createdAt;
                const elapsed = getElapsedDaysInfo(sentTime);

                const followUpSubject = email.subject.toLowerCase().startsWith('re:')
                  ? email.subject
                  : `Following up: ${email.subject || 'Application'}`;

                const mailtoUrl = `mailto:${email.recipientEmail}?subject=${encodeURIComponent(
                  followUpSubject
                )}`;

                return (
                  <tr
                    key={email.id}
                    className="table-row"
                    onClick={() => onSelectEmail(email)}
                    title="Click to view details"
                  >
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: email.senderEmail ? 'var(--bg-secondary, #f1f5f9)' : 'transparent',
                          color: 'var(--text-muted, #64748b)',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {email.senderEmail || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{email.recipientEmail}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject || '(No subject)'}
                    </td>
                    <td>
                      {isOpened ? (
                        <span className="badge badge-opened">
                          <CheckCircle size={12} /> Opened
                        </span>
                      ) : email.status === 'sent' ? (
                        <span className="badge badge-unopened">
                          <Clock size={12} /> Not opened
                        </span>
                      ) : (
                        <span className="badge badge-created">
                          <FileText size={12} /> Created
                        </span>
                      )}
                    </td>
                    <td>
                      {elapsed.isWeek ? (
                        <span className="badge badge-week-warning">
                          <AlertCircle size={12} /> {elapsed.text}
                        </span>
                      ) : (
                        <span className="badge badge-recent">
                          {elapsed.text}
                        </span>
                      )}
                    </td>
                    <td>{formatDate(sentTime)}</td>
                    <td>{formatDate(email.lastOpenedAt)}</td>
                    <td style={{ fontWeight: 600 }}>{email.openCount > 0 ? email.openCount : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={mailtoUrl}
                        className="btn-reachout btn-reachout-sm"
                        onClick={(e) => e.stopPropagation()}
                        title="Open email to reach out again"
                      >
                        <Send size={11} /> Reach out
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="pagination-bar">
        <span className="page-info">
          Showing {filtered.length} of {activeTab === 'week' ? weekOldCount : total} tracked emails (Page {page} of {totalPages})
        </span>

        <div className="page-buttons">
          <button
            className="btn btn-default"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <button
            className="btn btn-default"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
