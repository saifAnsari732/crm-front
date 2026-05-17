import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { FileText, Download, Calendar, User, Search, MapPin, Receipt, Briefcase, CheckCircle, Target } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  console.log(employees)

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

  const handleExportJSON = () => {
    if (!reportData) return;
    const jsonData = {
      exportDate: new Date().toISOString(),
      period: { startDate, endDate },
      employee: reportData.employee,
      summary: reportData.summary,
      activities: {
        meetings: reportData.meetings,
        expenses: reportData.expenses,
        tasks: reportData.tasks,
        leads: reportData.leads,
        daHistory: (reportData.employee.daHistory || employees.find(e => e._id === reportData.employee._id)?.daHistory || [])?.filter(da => {
            const daDate = new Date(da.date).toISOString().slice(0, 10);
            return daDate >= startDate && daDate <= endDate;
        }) || []
      }
    };
    const filename = `en_dreport_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.json`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }));
    link.download = filename;
    link.click();
    toast.success('JSON exported');
  };

  const handleExport = () => {
    if (!reportData) return;

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFontSize(16);
      doc.text('Unified Activity Report', 40, 40);
      doc.setFontSize(10);
      doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
      doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);

      // Employee Details
      const empDetailsStart = 96;
      const empDetailsBody = [
        ['Name', reportData.employee.name],
        ['Employee ID', reportData.employee.employeeId || '-'],
        ['Department', reportData.employee.department || '-'],
        ['Designation', reportData.employee.designation || '-'],
        ['Phone', reportData.employee.phone || '-'],
        ['Allocated Area', reportData.employee.allocatedArea || '-'],
        ['Monthly Salary', `₹${reportData.employee.salary || 12000}`],
        ['Travel Rate (TA)', `₹${reportData.employee.TA || 2.5} / km`],
        ['Daily Allowance (DA)', `₹${reportData.employee.DA || 0}`],
      ];
      // @ts-ignore
      doc.autoTable({ startY: empDetailsStart, head: [['Field','Value']], body: empDetailsBody, styles: { fontSize: 8 } });

      let y = doc.previousAutoTable.finalY + 18;

      // Summary
      doc.setFontSize(12);
      doc.text('Activity Summary', 40, y);
      const summaryBody = [
        ['Total Km', `${reportData.summary.totalKm.toFixed(2)} km`],
        ['Travel Pay (₹2.50/km)', `₹${(reportData.summary.totalKm * 2.5).toFixed(2)}`],
        ['Meetings', String(reportData.summary.totalMeetings)],
        ['Expenses (₹)', String(reportData.summary.totalExpenses)],
        ['Tasks', String(reportData.summary.totalTasks)],
        ['Leads', String(reportData.summary.totalLeads)],
      ];
      // @ts-ignore
      doc.autoTable({ startY: y + 6, head: [['Metric','Value']], body: summaryBody, styles: { fontSize: 8 } });

      y = doc.previousAutoTable.finalY + 18;

      // Meetings
      if (reportData.meetings && reportData.meetings.length > 0) {
        doc.setFontSize(12);
        doc.text('Meetings', 40, y);
        // @ts-ignore
        doc.autoTable({ startY: y + 6, head: [['Date','Client','Purpose']], body: reportData.meetings.map(m => [new Date(m.date).toLocaleString(), m.clientName, (m.purpose || m.meetingNotes || '').slice(0, 80)]), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } });
        y = doc.previousAutoTable.finalY + 12;
      }

      // Expenses
      if (reportData.expenses && reportData.expenses.length > 0) {
        doc.setFontSize(12);
        doc.text('Expenses', 40, y);
        // @ts-ignore
        doc.autoTable({ startY: y + 6, head: [['Date','Category','Amount','Status']], body: reportData.expenses.map(e => [new Date(e.date).toLocaleDateString(), e.category, `₹${e.amount}`, e.status]), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } });
        y = doc.previousAutoTable.finalY + 12;
      }

      // Tasks
      if (reportData.tasks && reportData.tasks.length > 0) {
        doc.setFontSize(12);
        doc.text('Tasks', 40, y);
        // @ts-ignore
        doc.autoTable({ startY: y + 6, head: [['Title','Due','Status']], body: reportData.tasks.map(t => [t.title, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-', t.status]), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } });
        y = doc.previousAutoTable.finalY + 12;
      }

      // Leads
      if (reportData.leads && reportData.leads.length > 0) {
        doc.setFontSize(12);
        doc.text('Leads', 40, y);
        // @ts-ignore
        doc.autoTable({ startY: y + 6, head: [['Name','Address','Feedback']], body: reportData.leads.map(l => [l.name, l.address || '-', (l.feedback || '').slice(0,80)]), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } });
        y = doc.previousAutoTable.finalY + 12;
      }

      // DA History
      const employeeDaHistory = reportData.employee.daHistory || employees.find(e => e._id === reportData.employee._id)?.daHistory || [];
      const filteredDaHistory = employeeDaHistory.filter(da => {
         const daDate = new Date(da.date).toISOString().slice(0, 10);
         return daDate >= startDate && daDate <= endDate;
      });

      if (filteredDaHistory.length > 0) {
        doc.setFontSize(12);
        doc.text('DA Upload History', 40, y);
        // @ts-ignore
        doc.autoTable({ startY: y + 6, head: [['Date','Amount','Receipt']], body: filteredDaHistory.map(da => [new Date(da.date).toLocaleString(), `₹${da.amount}`, da.receipt ? 'Yes (Link in system)' : 'No Receipt']), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } });
      }

      const filename = `Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate || 'start'}.pdf`;
      doc.save(filename);
      toast.success('PDF exported');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    }
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
            <div className="flex gap-3">
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2 py-2.5 px-6 rounded-2xl">
                <Download className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Export PDF</span>
              </button>
              <button onClick={handleExportJSON} className="btn-secondary flex items-center gap-2 py-2.5 px-6 rounded-2xl">
                <FileText className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Export JSON</span>
              </button>
            </div>
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
            {console.log('reportData.employee.daHistory:', reportData.employee.daHistory)}
            {/* Employee Details Card */}
            <div className="glass-card p-6 border-[var(--border-color)] shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary-500 mb-4">Employee Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Name</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Employee ID</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.employeeId || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Designation</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.designation || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Department</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.department || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Phone</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Allocated Area</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">{reportData.employee.allocatedArea || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Salary (₹/Month)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">₹{reportData.employee.salary || 12000}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Travel Rate (TA)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">₹{reportData.employee.TA || 2.5}/km</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Daily Allowance (DA)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">₹{reportData.employee.DA || 0}</p>
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

               <div className="glass-card overflow-hidden">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">DA History</h3>
                  </div>
                  <div className="divide-y divide-[var(--border-color)] max-h-[400px] overflow-auto">
                     {!(reportData.employee.daHistory || employees.find(e => e._id === reportData.employee._id)?.daHistory || []).some(da => {
                         const d = new Date(da.date).toISOString().slice(0, 10);
                         return d >= startDate && d <= endDate;
                     }) ? <p className="p-8 text-center text-[var(--text-muted)] text-sm">No DA claimed</p> : 
                      (reportData.employee.daHistory || employees.find(e => e._id === reportData.employee._id)?.daHistory || []).filter(da => {
                         const d = new Date(da.date).toISOString().slice(0, 10);
                         return d >= startDate && d <= endDate;
                      }).map(da => (
                        <div key={da._id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between">
                           <div>
                              <p className="text-[var(--text-main)] font-bold text-sm">DA Claim</p>
                              <p className="text-[var(--text-muted)] text-[10px]">{new Date(da.date).toLocaleDateString()}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[var(--text-main)] font-black">₹{da.amount}</p>
                              {da.receipt ? (
                                <a href={da.receipt} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase text-blue-500 underline">View Receipt</a>
                              ) : (
                                <span className="text-[9px] font-black uppercase text-[var(--text-muted)]">No Receipt</span>
                              )}
                           </div>
                        </div>
                      ))}
                  </div>
               </div>

               <div className="glass-card overflow-hidden lg:col-span-3">
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
