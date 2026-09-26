import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ComposeModal from '../components/ComposeModal';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [emails, setEmails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const fetchEmails = useCallback(async (query?: string) => {
    try {
      const res = await axios.get('http://127.0.0.1:3000/api/search', {
        params: query ? { q: query } : {},
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmails(res.data);
    } catch (err) {
      console.error('Error fetching emails', err);
    }
  }, [token]);

  const fetchHealth = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:3000/api/health');
      setHealthStatus(res.data);
    } catch {
      setHealthStatus({ status: 'down' });
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchHealth();
    const interval = setInterval(() => fetchEmails(searchQuery || undefined), 10000);
    return () => clearInterval(interval);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmails(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const connectSlack = async () => {
    const webhookUrl = prompt('Enter your Slack Incoming Webhook URL:');
    if (webhookUrl) {
      try {
        await axios.post('http://127.0.0.1:3000/api/auth/slack-webhook', 
          { webhookUrl },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        addToast('Slack webhook connected.', 'success');
      } catch {
        addToast('Failed to connect Slack.', 'error');
      }
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      await axios.post(`http://127.0.0.1:3000/api/retry/${jobId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Retrying email...', 'info');
      setTimeout(() => fetchEmails(searchQuery || undefined), 2000);
    } catch {
      addToast('Retry failed.', 'error');
    }
  };

  const filteredEmails = emails.filter((e: any) => 
    activeTab === 'scheduled' 
      ? (e.status === 'PENDING' || e.status === 'DELAYED') 
      : (e.status === 'SENT' || e.status === 'FAILED' || e.status === 'OPENED')
  );

  const sentCount = emails.filter((e: any) => e.status === 'SENT' || e.status === 'OPENED').length;
  const pendingCount = emails.filter((e: any) => e.status === 'PENDING' || e.status === 'DELAYED').length;
  const failedCount = emails.filter((e: any) => e.status === 'FAILED').length;

  const badgeClass = (status: string) => {
    switch (status) {
      case 'SENT': return 'sent';
      case 'OPENED': return 'opened';
      case 'FAILED': return 'failed';
      case 'DELAYED': return 'delayed';
      default: return 'pending';
    }
  };

  return (
    <div className="dashboard-page">
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
            {t.type === 'error' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>}
            {t.type === 'info' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="dash-header">
        <div className="dash-brand">
          <div className="dash-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <span className="dash-brand-text">ReachInbox</span>
          {healthStatus && (
            <span className={`health-dot ${healthStatus.status === 'ok' ? 'healthy' : 'unhealthy'}`} title={`System: ${healthStatus.status}`}></span>
          )}
        </div>
        
        <div className="dash-header-right">
          <button onClick={connectSlack} className="header-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
            Slack
          </button>

          <button onClick={() => setIsDark(!isDark)} className="theme-toggle" title="Toggle theme">
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
          </button>
          
          <div className="user-group">
            {user.picture && <img src={user.picture} alt="" className="dash-avatar" />}
            <span className="dash-username">{user.name}</span>
          </div>
          
          <button onClick={handleLogout} className="header-btn danger">Log out</button>
        </div>
      </header>

      <main className="dash-main">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{emails.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Delivered</div>
            <div className="stat-value success">{sentCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Queued</div>
            <div className="stat-value warning">{pendingCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value danger">{failedCount}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="dash-toolbar">
          <div className="toolbar-left">
            <div className="dash-tabs">
              <button className={`dash-tab ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')}>
                Scheduled
              </button>
              <button className={`dash-tab ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => setActiveTab('sent')}>
                Sent
              </button>
            </div>

            {/* Search */}
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Search emails..." 
                className="search-input" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>&times;</button>
              )}
            </div>

            <button onClick={() => fetchEmails(searchQuery || undefined)} className="btn-refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              Refresh
            </button>
          </div>
          
          <button onClick={() => setComposeOpen(true)} className="btn-compose">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Campaign
          </button>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="email-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Time</th>
                <th>Status</th>
                {activeTab === 'sent' && <th style={{ width: '80px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'sent' ? 5 : 4}>
                    <div className="empty-state">
                      <div className="empty-title">
                        {searchQuery 
                          ? `No results for "${searchQuery}"`
                          : activeTab === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
                      </div>
                      <div className="empty-sub">
                        {searchQuery 
                          ? 'Try a different search term.'
                          : activeTab === 'scheduled' 
                            ? 'Create a campaign to get started.' 
                            : 'Emails appear here after delivery.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email: any) => (
                  <tr key={email.id}>
                    <td className="cell-email">{email.recipientEmail}</td>
                    <td>{email.subject}</td>
                    <td className="cell-time">{new Date(email.scheduledTime).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${badgeClass(email.status)}`}>
                        <span className="badge-dot"></span>
                        {email.status}
                      </span>
                    </td>
                    {activeTab === 'sent' && (
                      <td>
                        {email.status === 'FAILED' && (
                          <button className="btn-retry" onClick={() => retryJob(email.id)} title="Retry this email">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            Retry
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      
      {isComposeOpen && (
        <ComposeModal 
          onClose={() => setComposeOpen(false)} 
          onRefresh={() => { fetchEmails(); addToast('Campaign scheduled.', 'success'); }} 
        />
      )}
    </div>
  );
}
