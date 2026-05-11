import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { expenseAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, Filter, Receipt } from 'lucide-react';

const CATEGORY_EMOJI = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => { fetchExpenses(); }, [page, statusFilter]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await expenseAPI.getAll({ page, limit: 15, status: statusFilter || undefined });
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      setTotalAmount((data.expenses || []).reduce((a, e) => a + e.amount, 0));
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  const handleAction = async (id, status, name) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await expenseAPI.approve(id, { status });
      toast.success(`${status === 'approved' ? '✅ Approved' : '❌ Rejected'}: ${name}'s expense`);
      fetchExpenses();
    } catch { toast.error('Action failed'); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const statusColor = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white text-2xl font-bold">Expenses</h1>
            <p className="text-white/40 text-sm">{total} entries • ₹{totalAmount.toLocaleString()} total</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-primary-600 border-primary-500 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Employee', 'Category', 'Amount', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-10 rounded-lg bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12">
                    <Receipt className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">No expenses found</p>
                  </td></tr>
                ) : expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary-600/30 flex items-center justify-center text-primary-300 font-bold text-xs flex-shrink-0">
                          {exp.employee?.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{exp.employee?.name}</p>
                          <p className="text-white/30 text-xs">{exp.employee?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_EMOJI[exp.category]}</span>
                        <span className="text-white/70 text-sm capitalize">{exp.category}</span>
                      </div>
                      {exp.description && <p className="text-white/30 text-xs truncate max-w-32">{exp.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-bold">₹{exp.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white/60 text-sm">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColor[exp.status]} capitalize`}>{exp.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {exp.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAction(exp._id, 'approved', exp.employee?.name)} disabled={actionLoading[exp._id]}
                            className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50" title="Approve">
                            {actionLoading[exp._id] ? <div className="w-4 h-4 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleAction(exp._id, 'rejected', exp.employee?.name)} disabled={actionLoading[exp._id]}
                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {exp.status !== 'pending' && <span className="text-white/20 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {total > 15 && (
          <div className="flex items-center justify-center gap-3">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">← Prev</button>
            <span className="text-white/40 text-sm">{page} / {Math.ceil(total / 15)}</span>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
