import React, { useEffect, useState } from 'react';
import type { TrackedEmailSummary, TrackedEmailDetail } from '@email-tracker/shared';
import { dashboardApi } from '../api/client.js';
import { X, Trash2, AlertCircle, CheckCircle, Clock, Info } from 'lucide-react';

interface Props {
  email: TrackedEmailSummary;
  onClose: () => void;
  onDeleted: () => void;
}

function formatFullDate(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const EmailDetailDrawer: React.FC<Props> = ({ email, onClose, onDeleted }) => {
  const [detail, setDetail] = useState<TrackedEmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    dashboardApi
      .getEmailDetail(email.id)
      .then((data) => {
        if (mounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [email.id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this tracked email and all recorded open events?')) {
      return;
    }

    setDeleting(true);
    try {
      await dashboardApi.deleteEmail(email.id);
      onDeleted();
      onClose();
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
      setDeleting(false);
    }
  };

  const isOpened = (detail?.openCount ?? email.openCount) > 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Email Details</h2>
          <button className="btn btn-default" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {error ? (
            <div style={{ color: 'var(--danger)', padding: '16px', background: 'var(--danger-bg)', borderRadius: '6px' }}>
              Error loading details: {error}
            </div>
          ) : (
            <>
              <div className="detail-item">
                <span className="detail-label">Recipient</span>
                <span className="detail-value" style={{ fontWeight: 600 }}>
                  {email.recipientEmail}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Subject</span>
                <span className="detail-value">{email.subject || '(No subject)'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Tracking Status</span>
                <div>
                  {isOpened ? (
                    <span className="badge badge-opened">
                      <CheckCircle size={12} /> Opened
                    </span>
                  ) : email.status === 'sent' ? (
                    <span className="badge badge-unopened">
                      <Clock size={12} /> Not opened
                    </span>
                  ) : (
                    <span className="badge badge-created">Created</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="detail-item">
                  <span className="detail-label">Created At</span>
                  <span className="detail-value" style={{ fontSize: '13px' }}>
                    {formatFullDate(email.createdAt)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Sent At</span>
                  <span className="detail-value" style={{ fontSize: '13px' }}>
                    {formatFullDate(email.sentAt)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="detail-item">
                  <span className="detail-label">First Opened</span>
                  <span className="detail-value" style={{ fontSize: '13px' }}>
                    {formatFullDate(detail?.firstOpenedAt || email.firstOpenedAt)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Last Opened</span>
                  <span className="detail-value" style={{ fontSize: '13px' }}>
                    {formatFullDate(detail?.lastOpenedAt || email.lastOpenedAt)}
                  </span>
                </div>
              </div>

              <div className="detail-item">
                <span className="detail-label">Total Requests</span>
                <span className="detail-value" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {detail?.openCount ?? email.openCount}
                </span>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#166534', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Tracking semantics:</strong> "Opened" indicates that the tracking image resource was loaded by the recipient's mail client or an image proxy. It does not definitively prove a human read the contents.
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Open Events History ({detail?.events?.length || 0})</span>
                {loading ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading events...</span>
                ) : !detail?.events || detail.events.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No open events recorded yet.</span>
                ) : (
                  <div className="events-list">
                    {detail.events.map((evt, idx) => (
                      <div key={evt.id || idx} className="event-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>Event #{detail.events.length - idx}</span>
                          <span>{formatFullDate(evt.occurredAt)}</span>
                        </div>
                        {evt.userAgent && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', wordBreak: 'break-all' }}>
                            Client: {evt.userAgent}
                          </div>
                        )}
                        {evt.ipHash && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                            IP Hash (HMAC-SHA256): <code>{evt.ipHash}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="drawer-footer">
          <button
            className="btn btn-danger"
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete Email'}
          </button>
          <button className="btn btn-default" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
