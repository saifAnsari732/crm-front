import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { leadAPI, adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Plus, Search, User, MapPin, Phone, CheckCircle, Clock, X, MessageCircle } from 'lucide-react';

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contactNo: '', address: '', assignedTo: '' });

  useEffect(() => { 
    fetchLeads();
    fetchEmployees();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data } = await leadAPI.getAll();
      setLeads(data.leads || []);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 100 });
      setEmployees(data.employees || []);
    } catch { }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leadAPI.create(form);
      toast.success('Lead assigned successfully');
      setShowModal(false);
      setForm({ name: '', contactNo: '', address: '', assignedTo: '' });
      fetchLeads();
    } catch { toast.error('Failed to create lead'); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight uppercase">Lead Assignment</h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Manage and track client leads</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 py-2.5 px-6 rounded-2xl shadow-xl shadow-primary-500/20 transition-all active:scale-95">
             <Plus className="w-4 h-4" /> 
             <span className="text-[10px] font-black uppercase tracking-widest">Assign New Lead</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-48 glass-card animate-pulse" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="glass-card p-20 text-center border-dashed border-2 border-[var(--border-color)]">
             <div className="w-20 h-20 bg-[var(--bg-main)] rounded-3xl flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-10 h-10 text-[var(--text-muted)] opacity-20" />
             </div>
             <h2 className="text-[var(--text-main)] font-black text-xl uppercase tracking-tight">No Active Leads</h2>
             <p className="text-[var(--text-muted)] text-sm mt-2 max-w-sm mx-auto">Click "Assign New Lead" to start distributing leads to your field agents.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map(lead => (
              <div key={lead._id} className="glass-card p-6 flex flex-col group hover:border-primary-500/40 transition-all border-[var(--border-color)]">
                 <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 font-black text-lg shadow-inner">
                       {lead.name ? lead.name[0].toUpperCase() : '?'}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      lead.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {lead.status}
                    </span>
                 </div>
                 
                 <h3 className="text-[var(--text-main)] font-black text-lg tracking-tight mb-1">{lead.name || 'Unnamed Lead'}</h3>
                 <div className="space-y-2 mb-6 flex-1">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                       <Phone className="w-3.5 h-3.5" /> {lead.contactNo || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                       <MapPin className="w-3.5 h-3.5" /> {lead.address || 'No Address'}
                    </div>
                    <div className="pt-2 border-t border-[var(--border-color)] mt-4">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[var(--bg-main)] flex items-center justify-center text-[10px] font-black text-[var(--text-muted)]">
                             {lead.assignedTo?.name?.[0]}
                          </div>
                          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Assigned to {lead.assignedTo?.name}</span>
                       </div>
                    </div>
                 </div>

                 {lead.feedback && (
                   <div className="bg-[var(--bg-main)] p-3 rounded-xl mb-4 border border-[var(--border-color)]">
                      <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">Feedback</p>
                      <p className="text-[var(--text-muted)] text-[11px] italic font-medium leading-relaxed">"{lead.feedback}"</p>
                   </div>
                 )}
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <div className="glass-card w-full max-w-md p-8 shadow-2xl border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tight">New Lead Assignment</h2>
                   <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/5 rounded-2xl transition-colors"><X className="w-6 h-6 text-[var(--text-muted)]" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                   <div>
                      <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Customer Name</label>
                      <input className="input-field" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full Name" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Contact No</label>
                        <input className="input-field" required value={form.contactNo} onChange={e => setForm(p => ({ ...p, contactNo: e.target.value }))} placeholder="+91..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Select Agent</label>
                        <select className="input-field" required value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}>
                           <option value="">Choose...</option>
                           {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                        </select>
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Site Address</label>
                      <textarea className="input-field min-h-[100px] py-3" required value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Complete site location details..." />
                   </div>
                   <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-4 text-xs font-black uppercase tracking-widest">Discard</button>
                      <button type="submit" disabled={saving} className="btn-primary flex-1 py-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary-500/20">
                         {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Confirm Assignment'}
                      </button>
                   </div>
                </form>
             </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
