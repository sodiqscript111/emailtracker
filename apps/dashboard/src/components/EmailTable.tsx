import React, { useState } from 'react';
import type { TrackedEmailSummary } from '@email-tracker/shared';
import { Search, Filter, CheckCircle, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'opened' | 'unopened'>('all');

  const filtered = emails.filter((item) => {
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
      <div className="section-header">
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

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sender</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Last opened</th>
              <th>Requests</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Loading emails...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  {emails.length === 0 ? 'No tracked emails recorded yet.' : 'No emails match your filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((email) => {
                const isOpened = email.openCount > 0;
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
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <td>{formatDate(email.sentAt || email.createdAt)}</td>
                    <td>{formatDate(email.lastOpenedAt)}</td>
                    <td style={{ fontWeight: 600 }}>{email.openCount > 0 ? email.openCount : '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span className="page-info">
          Showing {emails.length} of {total} total tracked emails (Page {page} of {totalPages})
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
