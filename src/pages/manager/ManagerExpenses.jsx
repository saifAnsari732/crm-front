import React, { useEffect, useState } from 'react';
import ManagerLayout from '../../components/layout/ManagerLayout';
import { managerAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Receipt, Search, Filter } from 'lucide-react';

export default function ManagerExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchExpenses(); }, [page, status]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await managerAPI.getExpenses({ page, limit: 15, status });
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <ManagerLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-amber-500" />
              Team Expenses
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Expenses submitted by your team</p>
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select className="input-field py-2.5 w-36 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-[var(--text-muted)] font-bold italic">No expenses found</td></tr>
                ) : expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-[var(--bg-card-hover)] transition-all">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-[var(--text-main)] font-black text-sm">{exp.employee?.name}</p>
                        <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold">{exp.employee?.employeeId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-main)] text-xs font-bold capitalize">{exp.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-500 text-sm font-black">₹{exp.amount?.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-muted)] text-xs">{new Date(exp.createdAt).toLocaleDateString('en-IN')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[exp.status] || ''}`}>
                        <span className="w-1 h-1 rounded-full bg-current" />{exp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {total > 15 && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Prev</button>
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-sm font-black">{page}</span>
              <span className="text-[var(--text-muted)] text-sm">/</span>
              <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
