import React from 'react';
import type { DashboardStats } from '@email-tracker/shared';
import { Mail, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  stats: DashboardStats | null;
  loading: boolean;
}

export const OverviewCards: React.FC<Props> = ({ stats, loading }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-info">
          <span className="stat-title">Tracked emails</span>
          <span className="stat-num">{loading || !stats ? '—' : stats.totalTracked}</span>
        </div>
        <div className="stat-icon-wrapper stat-icon-blue">
          <Mail size={20} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-info">
          <span className="stat-title">Opened</span>
          <span className="stat-num" style={{ color: 'var(--success)' }}>
            {loading || !stats ? '—' : stats.openedCount}
          </span>
        </div>
        <div className="stat-icon-wrapper stat-icon-green">
          <CheckCircle2 size={20} />
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-info">
          <span className="stat-title">Not opened</span>
          <span className="stat-num" style={{ color: 'var(--text-muted)' }}>
            {loading || !stats ? '—' : stats.notOpenedCount}
          </span>
        </div>
        <div className="stat-icon-wrapper stat-icon-gray">
          <Clock size={20} />
        </div>
      </div>
    </div>
  );
};
