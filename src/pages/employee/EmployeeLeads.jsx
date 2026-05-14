import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { leadAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Phone, MapPin, MessageSquare, CheckCircle, Clock, Search, Filter } from 'lucide-react';

export default function EmployeeLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data } = await leadAPI.getAll();
      setLeads(data.leads || []);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leadAPI.update(selectedLead._id, { status, feedback });
      toast.success('Lead updated');
      setSelectedLead(null);
      fetchLeads();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--text-main)] text-2xl font-bold">My Leads</h1>
          <div className="bg-primary-500/10 px-3 py-1.5 rounded-full border border-primary-500/20">
            <span className="text-primary-500 text-xs font-bold uppercase">{leads.length} Active</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 glass-card animate-pulse" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-[var(--text-main)] font-bold">No leads assigned yet</p>
            <p className="text-[var(--text-muted)] text-sm">New assignments will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {leads.map(lead => (
              <div key={lead._id} className="glass-card p-5 group hover:border-primary-500/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[var(--text-main)] font-bold text-lg truncate">{lead.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                        <Phone className="w-3.5 h-3.5" /> <span>{lead.contactNo}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                        <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{lead.address}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSelectedLead(lead); setStatus(lead.status); setFeedback(lead.feedback || ''); }}
                    className="btn-secondary py-2.5 px-6 text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> Feedback
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Update Modal */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Update Lead Status</h2>
                <p className="text-[var(--text-muted)] text-sm">Lead: {selectedLead.name}</p>
              </div>
              <form onSubmit={handleUpdate} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Select Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['pending', 'completed', 'follow-up'].map(s => (
                      <button 
                        key={s} type="button" 
                        onClick={() => setStatus(s)}
                        className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                          status === s ? 'bg-primary-500 border-primary-500 text-white' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Feedback / Notes</label>
                  <textarea 
                    className="input-field min-h-[100px] py-3" 
                    placeholder="Enter visit details or client feedback..."
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-3">
                   <button type="button" onClick={() => setSelectedLead(null)} className="btn-ghost flex-1">Cancel</button>
                   <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Update'}
                   </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
