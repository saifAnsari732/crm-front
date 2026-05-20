import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { expenseAPI, adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, Filter, Receipt, Image as ImageIcon, X } from 'lucide-react';

const CATEGORY_EMOJI = { fuel: '⛽', food: '🍽️', hotel: '🏨', travel: '🚗', misc: '📦' };

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [empFilter, setEmpFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    adminAPI.getEmployees({ limit: 200 }).then(({ data }) => setEmployees(data.employees || []));
  }, []);
  useEffect(() => { fetchExpenses(); }, [page, statusFilter, empFilter]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await expenseAPI.getAll({ page, limit: 15, status: statusFilter || undefined, employeeId: empFilter || undefined });
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
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-3">
               <Receipt className="w-6 h-6 text-primary-500" />
               Expense Audit
            </h1>
            <div className="flex items-center gap-4 mt-2">
               <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20">
                  <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Grand Total</span>
                  <span className="text-sm font-black text-[var(--text-main)]">₹{totalAmount.toLocaleString()}</span>
               </div>
               <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{total} Total Entries</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1.5 rounded-[1.25rem] border border-[var(--border-color)] shadow-xl">
              {['', 'pending', 'approved', 'rejected'].map(s => (
                <button 
                  key={s} 
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === s 
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
            <select className="input-field py-2 w-44 text-sm" value={empFilter} onChange={e => { setEmpFilter(e.target.value); setPage(1); }}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.designation || 'Staff'})</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden border-[var(--border-color)] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="px-6 py-4">Field Agent</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Submission Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-12 rounded-xl bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center">
                       <div className="w-16 h-16 rounded-2xl bg-[var(--bg-main)] flex items-center justify-center mb-4">
                          <Receipt className="w-8 h-8 text-[var(--text-muted)] opacity-20" />
                       </div>
                       <h3 className="text-[var(--text-main)] font-black text-lg uppercase tracking-tight">No Expense Claims</h3>
                       <p className="text-[var(--text-muted)] text-sm mt-1">New expense submissions will appear here for audit.</p>
                    </div>
                  </td></tr>
                ) : expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-sm shadow-inner group-hover:scale-105 transition-transform uppercase">
                          {exp.employee?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-[var(--text-main)] font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors truncate">{exp.employee?.name}</p>
                          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest truncate">{exp.employee?.employeeId || 'ID Pending'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg-main)] flex items-center justify-center text-xl shadow-inner">
                           {CATEGORY_EMOJI[exp.category] || '💰'}
                        </div>
                        <div>
                          <p className="text-[var(--text-main)] text-xs font-black uppercase tracking-widest">{exp.category}</p>
                          {exp.category === 'travel' && exp.travelDetails && (
                             <p className="text-primary-400 text-[10px] font-black uppercase tracking-tight mt-0.5">
                                {exp.travelDetails.mode} | {exp.travelDetails.source} → {exp.travelDetails.destination}
                             </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {exp.description && <p className="text-[var(--text-muted)] text-[10px] font-medium truncate max-w-[150px] italic">"{exp.description}"</p>}
                            {exp.receipts?.length > 0 && (
                              <button onClick={() => setSelectedReceipt(exp.receipts[0])} className="p-1 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-white transition-all">
                                <ImageIcon className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[var(--text-main)] font-black text-lg tracking-tight">₹{exp.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                         exp.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                         exp.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                         'bg-amber-500/10 text-amber-500 border-amber-500/20'
                       }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            exp.status === 'approved' ? 'bg-emerald-500' :
                            exp.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                         {exp.status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {exp.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleAction(exp._id, 'approved', exp.employee?.name)} disabled={actionLoading[exp._id]}
                            className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-emerald-500/20 disabled:opacity-50" title="Approve Claim">
                            {actionLoading[exp._id] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4.5 h-4.5" />}
                          </button>
                          <button onClick={() => handleAction(exp._id, 'rejected', exp.employee?.name)} disabled={actionLoading[exp._id]}
                            className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 flex items-center justify-center border border-red-500/20 disabled:opacity-50" title="Reject Claim">
                            <XCircle className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest opacity-30">— Audited —</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-center gap-6 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Prev</button>
            <div className="flex items-center gap-2">
               <span className="text-primary-500 text-sm font-black">{page}</span>
               <span className="text-[var(--text-muted)] text-sm">/</span>
               <span className="text-[var(--text-muted)] text-sm font-bold">{Math.ceil(total / 15)}</span>
            </div>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary px-6 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95">Next</button>
          </div>
        )}

        {/* Receipt Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedReceipt(null)}>
            <div className="relative max-w-4xl w-full">
              <button onClick={() => setSelectedReceipt(null)} className="absolute -top-12 right-0 p-2 text-white hover:text-primary-400 transition-colors">
                <X className="w-8 h-8" />
              </button>
              <img src={selectedReceipt} alt="Receipt" className="w-full h-auto rounded-2xl shadow-2xl border-4 border-white/10" />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
