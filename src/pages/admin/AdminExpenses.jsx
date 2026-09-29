import React, { useEffect, useState, useMemo } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import { expenseAPI, adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';
import {
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Calendar,
  Clock,
  Trash2,
  Eye,
  X,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  CreditCard,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Fuel,
  Utensils,
  Hotel,
  Car,
  Package
} from 'lucide-react';

const CATEGORY_MAP = {
  fuel: { label: 'Fuel & Gas', icon: Fuel, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  food: { label: 'Food & Meals', icon: Utensils, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  hotel: { label: 'Hotel & Stay', icon: Hotel, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  travel: { label: 'Travel & Fare', icon: Car, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  misc: { label: 'Miscellaneous', icon: Package, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [serverStats, setServerStats] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, name: '', reason: '' });

  useEffect(() => {
    adminAPI.getEmployees({ limit: 200, role: 'all' })
      .then(({ data }) => setEmployees(data.employees || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [page, statusFilter, empFilter, categoryFilter]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data } = await expenseAPI.getAll({
        page,
        limit: 15,
        status: statusFilter || undefined,
        employeeId: empFilter || undefined,
        category: categoryFilter || undefined,
      });
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      if (data.stats) {
        setServerStats(data.stats);
      }
    } catch {
      toast.error('Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status, name, reason = '') => {
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      await expenseAPI.approve(id, { status, rejectionReason: reason });
      if (status === 'approved') {
        toast.success(`Claim approved for ${name}`);
      } else {
        toast.error(`Claim rejected for ${name}`);
      }
      setRejectModal({ open: false, id: null, name: '', reason: '' });
      fetchExpenses();
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this expense claim?')) return;
    try {
      await expenseAPI.delete(id);
      toast.success('Expense claim deleted');
      fetchExpenses();
    } catch {
      toast.error('Failed to delete claim');
    }
  };

  // Client-side search filtering
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (exp) =>
        exp.employee?.name?.toLowerCase().includes(q) ||
        exp.employee?.employeeId?.toLowerCase().includes(q) ||
        exp.description?.toLowerCase().includes(q) ||
        exp.category?.toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    if (expenses.length === 0) {
      toast.error('No expenses to export');
      return;
    }
    const headers = ['Agent Name', 'Employee ID', 'Category', 'Amount (INR)', 'Submission Date', 'Status', 'Description'];
    const rows = filteredExpenses.map((exp) => [
      `"${exp.employee?.name || 'N/A'}"`,
      `"${exp.employee?.employeeId || 'N/A'}"`,
      `"${exp.category}"`,
      exp.amount,
      `"${new Date(exp.date || exp.createdAt).toLocaleDateString('en-IN')}"`,
      `"${exp.status}"`,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expense_audit_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report exported');
  };

  // Compute stats fallback if serverStats is not present
  const totalClaimsAmount = serverStats?.totalAmount ?? expenses.reduce((a, b) => a + (b.amount || 0), 0);
  const pendingClaimsAmount = serverStats?.pendingAmount ?? expenses.filter(e => e.status === 'pending').reduce((a, b) => a + (b.amount || 0), 0);
  const approvedClaimsAmount = serverStats?.approvedAmount ?? expenses.filter(e => e.status === 'approved').reduce((a, b) => a + (b.amount || 0), 0);
  const rejectedClaimsAmount = serverStats?.rejectedAmount ?? expenses.filter(e => e.status === 'rejected').reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <TrackProLayout>
      <div className="w-full space-y-6">
        {/* Breadcrumb & Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-500 mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Finance & Claims</span>
              <span>/</span>
              <span className="text-slate-900 font-bold">Expense Audit</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Expense Audit</h1>
                <p className="text-xs text-slate-500 font-medium">
                  Review, audit, and approve field travel allowances, fuel claims, and bills.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-rose-300 bg-white text-slate-700 text-xs font-bold hover:bg-rose-50 transition shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('');
                setCategoryFilter('');
                setEmpFilter('');
                setSearchQuery('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
              title="Reset Filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Grand Total */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Claims</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900">₹{totalClaimsAmount.toLocaleString('en-IN')}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{serverStats?.totalCount ?? total} claims recorded</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          </div>

          {/* 2. Pending Audit */}
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-amber-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-600">₹{pendingClaimsAmount.toLocaleString('en-IN')}</span>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                {serverStats?.pendingCount ?? expenses.filter(e => e.status === 'pending').length} claims awaiting action
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </div>

          {/* 3. Approved */}
          <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-600">₹{approvedClaimsAmount.toLocaleString('en-IN')}</span>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                {serverStats?.approvedCount ?? expenses.filter(e => e.status === 'approved').length} claims verified
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
          </div>

          {/* 4. Rejected */}
          <div className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-xs relative overflow-hidden bg-gradient-to-br from-white to-rose-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Rejected</span>
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-600">₹{rejectedClaimsAmount.toLocaleString('en-IN')}</span>
              <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                {serverStats?.rejectedCount ?? expenses.filter(e => e.status === 'rejected').length} claims declined
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by agent name, employee ID, or note..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-400 text-slate-900 placeholder:text-slate-400 bg-slate-50/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Tab Bar */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: '', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStatusFilter(s.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === s.id
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="fuel">⛽ Fuel</option>
                <option value="food">🍽️ Food</option>
                <option value="hotel">🏨 Hotel</option>
                <option value="travel">🚗 Travel</option>
                <option value="misc">📦 Misc</option>
              </select>

              {/* Employee Dropdown */}
              <select
                value={empFilter}
                onChange={(e) => {
                  setEmpFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer max-w-[180px] truncate"
              >
                <option value="">All Field Agents</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} ({e.employeeId || 'EMP'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Expenses Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <input type="checkbox" className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer" />
                  </th>
                  <th className="py-3.5 px-4">Field Agent</th>
                  <th className="py-3.5 px-4">Classification</th>
                  <th className="py-3.5 px-4 text-center">Receipt</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4">Submission Date</th>
                  <th className="py-3.5 px-4">Audit Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-5 px-4">
                        <div className="h-8 bg-slate-100 rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                          <Receipt className="w-7 h-7" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">No Expense Claims Found</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          No claims match your selected filters. New expense submissions from field agents will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const cat = CATEGORY_MAP[exp.category] || CATEGORY_MAP.misc;
                    const CatIcon = cat.icon;
                    const receiptImg = (exp.receipts && exp.receipts[0]) || exp.ticketPhoto;

                    return (
                      <tr key={exp._id} className="hover:bg-rose-50/30 transition-colors group">
                        {/* Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input type="checkbox" className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer" />
                        </td>

                        {/* Field Agent with Photo & ID */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={exp.employee?.avatar} name={exp.employee?.name || 'Agent'} size="md" />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate group-hover:text-rose-600 transition-colors">
                                {exp.employee?.name || 'Unassigned Agent'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {exp.employee?.employeeId || 'EMP-ID'}
                                </span>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {exp.employee?.designation || exp.employee?.department || 'Field Staff'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Classification */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cat.color}`}
                            >
                              <CatIcon className="w-3.5 h-3.5" />
                              <span>{cat.label}</span>
                            </span>
                            {exp.category === 'travel' && exp.travelDetails && (
                              <p className="text-[10px] text-slate-500 font-medium">
                                {exp.travelDetails.mode} • {exp.travelDetails.source} → {exp.travelDetails.destination}
                              </p>
                            )}
                            {exp.description && (
                              <p className="text-[11px] text-slate-600 italic truncate max-w-[200px]">
                                "{exp.description}"
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Receipt Thumbnail */}
                        <td className="py-3.5 px-4 text-center">
                          {receiptImg ? (
                            <button
                              onClick={() => setSelectedReceipt({ img: receiptImg, exp })}
                              className="relative inline-block w-10 h-10 rounded-xl overflow-hidden border border-slate-200 hover:border-rose-400 hover:scale-105 transition-all shadow-xs group/img"
                              title="Click to view receipt"
                            >
                              <img src={receiptImg} alt="Receipt" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 rounded bg-slate-100">
                              No Bill
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-sm font-black text-slate-900 block">
                            ₹{exp.amount?.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">INR</span>
                        </td>

                        {/* Submission Date */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(exp.date || exp.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 ml-5 block">
                            {new Date(exp.date || exp.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        {/* Audit Status */}
                        <td className="py-3.5 px-4">
                          {exp.status === 'approved' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Approved
                            </span>
                          )}
                          {exp.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Rejected
                            </span>
                          )}
                          {exp.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Audit Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {exp.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleAction(exp._id, 'approved', exp.employee?.name)}
                                  disabled={actionLoading[exp._id]}
                                  className="p-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition shadow-xs disabled:opacity-50"
                                  title="Approve Claim"
                                >
                                  {actionLoading[exp._id] ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    setRejectModal({
                                      open: true,
                                      id: exp._id,
                                      name: exp.employee?.name || 'Agent',
                                      reason: '',
                                    })
                                  }
                                  disabled={actionLoading[exp._id]}
                                  className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-xs disabled:opacity-50"
                                  title="Reject Claim"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">
                                Audited
                              </span>
                            )}

                            <button
                              onClick={() => handleDelete(exp._id)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {total > 15 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing {Math.min((page - 1) * 15 + 1, total)} to {Math.min(page * 15, total)} of {total} claims
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 font-bold text-rose-600 bg-rose-50 rounded-xl">
                  {page} / {Math.ceil(total / 15)}
                </span>
                <button
                  disabled={page * 15 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Full Receipt Lightbox */}
        {selectedReceipt && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
            onClick={() => setSelectedReceipt(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-rose-100 relative animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={selectedReceipt.exp?.employee?.avatar}
                    name={selectedReceipt.exp?.employee?.name || 'Agent'}
                    size="sm"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Receipt Claim - ₹{selectedReceipt.exp?.amount?.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {selectedReceipt.exp?.employee?.name} • {selectedReceipt.exp?.category?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center p-2">
                <img
                  src={selectedReceipt.img}
                  alt="Receipt Document"
                  className="max-h-[55vh] w-auto object-contain rounded-xl shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Submitted: {new Date(selectedReceipt.exp?.date || selectedReceipt.exp?.createdAt).toLocaleString('en-IN')}
                </span>
                <a
                  href={selectedReceipt.img}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs hover:bg-rose-100 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open Full Size</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Rejection Reason */}
        {rejectModal.open && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setRejectModal({ open: false, id: null, name: '', reason: '' })}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Decline Expense Claim</h3>
                  <p className="text-xs text-slate-500">{rejectModal.name}'s claim</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  placeholder="e.g. Invalid bill photo, amount exceeds daily travel policy..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setRejectModal({ open: false, id: null, name: '', reason: '' })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(rejectModal.id, 'rejected', rejectModal.name, rejectModal.reason)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
