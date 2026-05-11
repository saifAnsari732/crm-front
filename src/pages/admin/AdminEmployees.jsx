import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { Search, Users, UserCheck, UserX, Shield, ShieldOff, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => { fetchEmployees(); }, [page, search]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getEmployees({ page, limit: 15, search });
      setEmployees(data.employees || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id, name) => {
    setActionLoading(p => ({ ...p, [id + '_approve']: true }));
    try {
      await adminAPI.approveEmployee(id);
      toast.success(`✅ ${name} approved`);
      fetchEmployees();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_approve']: false })); }
  };

  const handleToggleBlock = async (id, name, isBlocked) => {
    setActionLoading(p => ({ ...p, [id + '_block']: true }));
    try {
      await adminAPI.toggleBlock(id);
      toast.success(`${isBlocked ? '✅ Unblocked' : '🚫 Blocked'} ${name}`);
      fetchEmployees();
    } catch { toast.error('Failed'); }
    finally { setActionLoading(p => ({ ...p, [id + '_block']: false })); }
  };

  const pendingCount = employees.filter(e => !e.isApproved).length;

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white text-2xl font-bold">Employees</h1>
            <p className="text-white/40 text-sm">{total} total employees</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-semibold">{pendingCount} pending approval</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="input-field pl-10" placeholder="Search by name, email, or ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Employee', 'Department', 'Status', 'Online', 'Approval', 'Actions'].map(h => (
                    <th key={h} className="text-left text-white/40 text-xs font-semibold uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-10 rounded-lg bg-white/5 animate-pulse" /></td></tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-white/40">No employees found</td></tr>
                ) : employees.map(emp => (
                  <tr key={emp._id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-600/30 flex items-center justify-center text-primary-300 font-bold text-sm flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{emp.name}</p>
                          <p className="text-white/40 text-xs">{emp.employeeId} • {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white/70 text-sm">{emp.department || '—'}</p>
                      <p className="text-white/30 text-xs">{emp.designation || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      {emp.isBlocked
                        ? <span className="badge badge-red">Blocked</span>
                        : emp.isActive
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-yellow">Inactive</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${emp.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                        <span className={`text-xs ${emp.isOnline ? 'text-emerald-400' : 'text-white/30'}`}>
                          {emp.isOnline ? 'Online' : emp.lastSeen ? new Date(emp.lastSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                        </span>
                      </div>
                      {emp.isTracking && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                          <span className="text-violet-400 text-xs">Tracking</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {emp.isApproved
                        ? <span className="badge badge-green flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" />Approved</span>
                        : <span className="badge badge-yellow flex items-center gap-1 w-fit"><Clock className="w-3 h-3" />Pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!emp.isApproved && (
                          <button onClick={() => handleApprove(emp._id, emp.name)} disabled={actionLoading[emp._id + '_approve']}
                            className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50" title="Approve">
                            {actionLoading[emp._id + '_approve']
                              ? <div className="w-4 h-4 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                              : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => handleToggleBlock(emp._id, emp.name, emp.isBlocked)} disabled={actionLoading[emp._id + '_block']}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${emp.isBlocked ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'}`}
                          title={emp.isBlocked ? 'Unblock' : 'Block'}>
                          {actionLoading[emp._id + '_block']
                            ? <div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
                            : emp.isBlocked ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
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
