import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';

export default function ComposeModal({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [startTime, setStartTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          const extracted: string[] = [];
          results.data.forEach((row: any) => {
            const emailStr = Object.values(row).find((val: any) => typeof val === 'string' && val.includes('@'));
            if (emailStr) extracted.push(emailStr as string);
          });
          setEmails(extracted);
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://127.0.0.1:3000/api/campaigns', {
        subject,
        body,
        emails,
        delayBetweenEmails,
        hourlyLimit,
        startTime: startTime ? new Date(startTime).toISOString() : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">New Campaign</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label className="field-label">Subject</label>
              <input 
                type="text" required 
                className="field-input" 
                placeholder="Email subject line"
                value={subject} onChange={e => setSubject(e.target.value)} 
              />
            </div>
            
            <div className="field">
              <label className="field-label">Body</label>
              <textarea 
                required rows={4}
                className="field-input" 
                placeholder="Write your message..."
                value={body} onChange={e => setBody(e.target.value)} 
              />
            </div>

            <div className="field">
              <label className="field-label">Recipients (CSV file)</label>
              <input 
                type="file" accept=".csv" required 
                onChange={handleFileUpload}
                className="file-drop"
              />
              {emails.length > 0 && (
                <div className="email-detected">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  {emails.length} recipient{emails.length !== 1 ? 's' : ''} found
                </div>
              )}
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Start time</label>
                <input 
                  type="datetime-local" 
                  className="field-input" 
                  value={startTime} onChange={e => setStartTime(e.target.value)} 
                />
              </div>
              <div className="field">
                <label className="field-label">Delay (seconds)</label>
                <input 
                  type="number" min="0" required 
                  className="field-input" 
                  value={delayBetweenEmails} onChange={e => setDelayBetweenEmails(Number(e.target.value))} 
                />
              </div>
              <div className="field">
                <label className="field-label">Hourly limit</label>
                <input 
                  type="number" min="1" required 
                  className="field-input" 
                  value={hourlyLimit} onChange={e => setHourlyLimit(Number(e.target.value))} 
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={loading || emails.length === 0} className="btn-submit">
              {loading ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
