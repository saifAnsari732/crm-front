import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { expenseAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Plus, X, Receipt, Search } from 'lucide-react';

const CATEGORIES = ['fuel', 'food', 'hotel', 'travel', 'misc'];
const CATEGORY_EMOJI = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };
const INITIAL = { category: 'fuel', amount: '', description: '', date: new Date().toISOString().slice(0, 10) };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

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
            <h1 className="text-white text-2xl font-bold">Expenses</h1>
            <p className="text-white/40 text-sm">{expenses.length} entries</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">Approved</p>
            <p className="text-white text-2xl font-bold">₹{totalApproved.toLocaleString()}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">Pending</p>
            <p className="text-white text-2xl font-bold">₹{totalPending.toLocaleString()}</p>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['all', ...CATEGORIES].map(cat => (
            <button key={cat} className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 capitalize transition-colors">
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
            <p className="text-white/50 font-medium">No expenses yet</p>
            <p className="text-white/30 text-sm mt-1">Track your field expenses here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(exp => (
              <div key={exp._id} className="glass-card p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
                  {CATEGORY_EMOJI[exp.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm capitalize">{exp.category}</p>
                    <span className={`badge ${statusColor[exp.status]} capitalize`}>{exp.status}</span>
                  </div>
                  {exp.description && <p className="text-white/40 text-xs truncate">{exp.description}</p>}
                  <p className="text-white/30 text-xs">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <p className="text-white font-bold text-sm flex-shrink-0">₹{exp.amount.toLocaleString()}</p>
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
              <h2 className="text-white font-bold text-lg">Add Expense</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5 text-white/60" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Category</label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map(cat => (
                    <button type="button" key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${form.category === cat ? 'border-primary-500 bg-primary-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="text-xl">{CATEGORY_EMOJI[cat]}</div>
                      <div className="text-white/60 text-[10px] capitalize mt-0.5">{cat}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Amount (₹) *</label>
                <input type="number" className="input-field" placeholder="0.00" value={form.amount} onChange={set('amount')} required />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Description</label>
                <input className="input-field" placeholder="Brief description..." value={form.description} onChange={set('description')} />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">Date</label>
                <input type="date" className="input-field" value={form.date} onChange={set('date')} />
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
