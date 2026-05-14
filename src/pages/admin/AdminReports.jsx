import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { FileText, Download, Calendar, User, Search, MapPin, Receipt, Briefcase, CheckCircle, Target } from 'lucide-react';

export default function AdminReports() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 100 });
      setEmployees(data.employees || []);
    } catch { }
  };

  const handleGenerate = async () => {
    if (!selectedEmp) return toast.error('Select an employee');
    setLoading(true);
    try {
      const { data } = await adminAPI.getConsolidatedReport({ 
        employeeId: selectedEmp, 
        startDate, 
        endDate 
      });
      setReportData(data.data);
      toast.success('Report generated');
    } catch { toast.error('Failed to generate report'); }
    finally { setLoading(false); }
  };

  const handleExport = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${reportData.employee.name}_${startDate}.json`;
    link.click();
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight uppercase flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary-500" /> Unified Activity Report
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Consolidated data audit for field operations</p>
          </div>
          {reportData && (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2 py-2.5 px-6 rounded-2xl">
              <Download className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Export JSON</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="glass-card p-6 border-[var(--border-color)] shadow-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Select Employee</label>
            <select className="input-field" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
               <option value="">Choose Agent...</option>
               {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Start Date</label>
            <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">End Date</label>
            <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary py-3 rounded-xl flex items-center justify-center gap-2">
             {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Search className="w-4 h-4" /> <span>Generate</span></>}
          </button>
        </div>

        {reportData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
               {[
                 { label: 'Travel', value: `${reportData.summary.totalKm.toFixed(1)} km`, icon: MapPin, color: 'text-blue-400' },
                 { label: 'Meetings', value: reportData.summary.totalMeetings, icon: Briefcase, color: 'text-violet-400' },
                 { label: 'Expenses', value: `₹${reportData.summary.totalExpenses}`, icon: Receipt, color: 'text-emerald-400' },
                 { label: 'Tasks', value: reportData.summary.totalTasks, icon: CheckCircle, color: 'text-amber-400' },
                 { label: 'Leads', value: reportData.summary.totalLeads, icon: Target, color: 'text-primary-400' }
               ].map((s, i) => (
                 <div key={i} className="glass-card p-5 border-[var(--border-color)] text-center">
                    <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-3`} />
                    <p className="text-[var(--text-main)] font-black text-xl tracking-tight">{s.value}</p>
                    <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest mt-1">{s.label}</p>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Detail Sections */}
               <div className="glass-card overflow-hidden">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-primary-500">Meetings Log</h3>
                  </div>
                  <div className="divide-y divide-[var(--border-color)] max-h-[400px] overflow-auto">
                     {reportData.meetings.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)] text-sm">No meetings recorded</p> : 
                      reportData.meetings.map(m => (
                        <div key={m._id} className="p-4 hover:bg-white/5 transition-colors">
                           <div className="flex justify-between items-start mb-1">
                              <p className="text-[var(--text-main)] font-bold text-sm">{m.clientName}</p>
                              <span className="text-[10px] font-bold text-[var(--text-muted)]">{new Date(m.date).toLocaleDateString()}</span>
                           </div>
                           <p className="text-[var(--text-muted)] text-[11px] line-clamp-1">{m.purpose}</p>
                        </div>
                      ))}
                  </div>
               </div>

               <div className="glass-card overflow-hidden">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500">Expense Claims</h3>
                  </div>
                  <div className="divide-y divide-[var(--border-color)] max-h-[400px] overflow-auto">
                     {reportData.expenses.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)] text-sm">No expenses claimed</p> : 
                      reportData.expenses.map(e => (
                        <div key={e._id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between">
                           <div>
                              <p className="text-[var(--text-main)] font-bold text-sm capitalize">{e.category}</p>
                              <p className="text-[var(--text-muted)] text-[10px]">{new Date(e.date).toLocaleDateString()}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[var(--text-main)] font-black">₹{e.amount}</p>
                              <span className="text-[9px] font-black uppercase text-primary-500">{e.status}</span>
                           </div>
                        </div>
                      ))}
                  </div>
               </div>

               <div className="glass-card overflow-hidden lg:col-span-2">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">Daily Action Items & Leads</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="border-r border-[var(--border-color)] max-h-[400px] overflow-auto">
                      {reportData.tasks.map(t => (
                        <div key={t._id} className="p-4 border-b border-[var(--border-color)] last:border-0">
                           <p className="text-[var(--text-main)] font-bold text-sm">{t.title}</p>
                           <p className="text-[var(--text-muted)] text-[10px] mt-1 line-clamp-1">{t.description}</p>
                           <div className="flex gap-2 mt-2">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">{t.status}</span>
                              {t.duration && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-500">{t.duration}</span>}
                           </div>
                        </div>
                      ))}
                    </div>
                    <div className="max-h-[400px] overflow-auto">
                      {reportData.leads.map(l => (
                        <div key={l._id} className="p-4 border-b border-[var(--border-color)] last:border-0">
                           <p className="text-[var(--text-main)] font-bold text-sm">{l.name}</p>
                           <p className="text-[var(--text-muted)] text-[10px]">{l.address}</p>
                           <div className="mt-2 bg-black/20 p-2 rounded-lg">
                              <p className="text-[9px] font-black text-primary-400 uppercase">Agent Feedback</p>
                              <p className="text-[var(--text-muted)] text-[10px] italic">"{l.feedback || 'No feedback yet'}"</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
