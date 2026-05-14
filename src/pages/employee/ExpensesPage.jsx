import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { expenseAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Plus, X, Receipt, Search, Image as ImageIcon, Loader2, MapPin, Navigation, Train, Bus, Bike, Car } from 'lucide-react';
import { uploadAPI } from '../../services/api.service';

const CATEGORIES = ['fuel', 'food', 'hotel', 'travel', 'misc'];
const CATEGORY_EMOJI = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };
const INITIAL = { 
  category: 'fuel', 
  amount: '', 
  description: '', 
  date: new Date().toISOString().slice(0, 10), 
  receipts: [],
  travelDetails: { mode: 'bike', source: '', destination: '' }
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchExpenses(); }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await expenseAPI.getMy({ limit: 20 });
      const exps = data.expenses || [];
      setExpenses(exps);
      setTotalApproved(exps.filter(e => e.status === 'approved').reduce((a, e) => a + e.amount, 0));
      setTotalPending(exps.filter(e => e.status === 'pending').reduce((a, e) => a + e.amount, 0));
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await uploadAPI.uploadImage(formData);
      setForm(p => ({ ...p, receipts: [...p.receipts, data.url] }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await expenseAPI.create({ ...form, amount: Number(form.amount) });
      toast.success('✅ Expense submitted!');
      setShowForm(false);
      setForm(INITIAL);
      fetchExpenses();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const statusColor = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Expenses</h1>
            <p className="text-[var(--text-muted)] text-sm">{expenses.length} entries</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <p className="text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-1">Approved</p>
            <p className="text-[var(--text-main)] text-2xl font-bold">₹{totalApproved.toLocaleString()}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-amber-500 text-xs font-semibold uppercase tracking-wider mb-1">Pending</p>
            <p className="text-[var(--text-main)] text-2xl font-bold">₹{totalPending.toLocaleString()}</p>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['all', ...CATEGORIES].map(cat => (
            <button key={cat} className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-medium hover:bg-[var(--bg-card-hover)] capitalize transition-colors">
              {cat !== 'all' ? CATEGORY_EMOJI[cat] + ' ' : ''}{cat}
            </button>
          ))}
        </div>

        {/* Expense list */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}</div>
        ) : expenses.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-[var(--text-main)] opacity-50 font-medium">No expenses yet</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Track your field expenses here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(exp => (
              <div key={exp._id} className="glass-card p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl flex-shrink-0">
                  {CATEGORY_EMOJI[exp.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[var(--text-main)] font-semibold text-sm capitalize">{exp.category}</p>
                    <span className={`badge ${statusColor[exp.status]} capitalize`}>{exp.status}</span>
                    {exp.receipts?.length > 0 && <ImageIcon className="w-3 h-3 text-primary-500" />}
                  </div>
                  {exp.category === 'travel' && exp.travelDetails && (
                    <p className="text-primary-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                       {exp.travelDetails.mode} • {exp.travelDetails.source} ➔ {exp.travelDetails.destination}
                    </p>
                  )}
                  {exp.description && <p className="text-[var(--text-muted)] text-xs truncate mt-0.5">{exp.description}</p>}
                  <p className="text-[var(--text-muted)] opacity-60 text-[10px]">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <p className="text-[var(--text-main)] font-bold text-sm flex-shrink-0">₹{exp.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-md glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text-main)] font-bold text-lg">Add Expense</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-[var(--bg-card-hover)]"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Category</label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map(cat => (
                    <button type="button" key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${form.category === cat ? 'border-primary-500 bg-primary-500/10' : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'}`}>
                      <div className="text-xl">{CATEGORY_EMOJI[cat]}</div>
                      <div className="text-[var(--text-muted)] text-[10px] capitalize mt-0.5">{cat}</div>
                    </button>
                  ))}
                </div>
              </div>
              {form.category === 'travel' && (
                <div className="bg-primary-500/10 p-4 rounded-2xl border border-primary-500/30 space-y-4 animate-in zoom-in-95 duration-300">
                   <div>
                      <label className="block text-primary-400 text-[10px] font-black uppercase tracking-widest mb-2">Transport Mode</label>
                      <div className="grid grid-cols-4 gap-2">
                         {[
                           { id: 'bike', label: 'Bike', icon: Bike },
                           { id: 'train', label: 'Tren', icon: Train },
                           { id: 'bus', label: 'Bus', icon: Bus },
                           { id: 'taxi', label: 'Taxxy', icon: Car }
                         ].map(m => (
                           <button type="button" key={m.id} onClick={() => setForm(p => ({ ...p, travelDetails: { ...p.travelDetails, mode: m.id } }))}
                             className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${form.travelDetails.mode === m.id ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-600/20' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-primary-500/50'}`}>
                              <m.icon className="w-4 h-4" />
                              <span className="text-[8px] font-black uppercase">{m.label}</span>
                           </button>
                         ))}
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                         <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase mb-1.5">Source</label>
                         <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-500" />
                            <input className="input-field pl-9 !py-2.5 text-xs font-bold" placeholder="From..." value={form.travelDetails.source} onChange={e => setForm(p => ({ ...p, travelDetails: { ...p.travelDetails, source: e.target.value } }))} />
                         </div>
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase mb-1.5">Destination</label>
                         <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-500" />
                            <input className="input-field pl-9 !py-2.5 text-xs font-bold" placeholder="To..." value={form.travelDetails.destination} onChange={e => setForm(p => ({ ...p, travelDetails: { ...p.travelDetails, destination: e.target.value } }))} />
                         </div>
                      </div>
                   </div>
                </div>
              )}

              <div>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                <input type="number" className="input-field" placeholder="0.00" value={form.amount} onChange={set('amount')} required />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Description</label>
                <input className="input-field" placeholder="Brief description..." value={form.description} onChange={set('description')} />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Date</label>
                <input type="date" className="input-field" value={form.date} onChange={set('date')} />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1.5">Receipt Photo</label>
                <div className="flex flex-wrap gap-2">
                  {form.receipts.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--border-color)]">
                      <img src={url} className="w-full h-full object-cover" alt="receipt" />
                      <button type="button" onClick={() => setForm(p => ({ ...p, receipts: p.receipts.filter((_, idx) => idx !== i) }))}
                        className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-colors">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary-500" /> : <Plus className="w-5 h-5 text-[var(--text-muted)]" />}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}
