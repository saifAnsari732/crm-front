import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import { FileText, Download, Calendar, User, Search, MapPin, Receipt, Briefcase, CheckCircle, Target, Image as ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';

export default function AdminReports() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('All');
  const reportRef = useRef(null);
  const handleExportJPEG = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = "Report__.jpg";
      link.click();
      toast.success('JPEG exported');
    } catch (err) { console.error(err); toast.error('Failed to export JPEG'); }
  };


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
      
      if (reportType === 'Distance') {
        doc.setFontSize(16);
        doc.text('Distance Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        
        if (reportData.locations && reportData.locations.length > 0) {
          const distanceBody = reportData.locations.map(loc => [
            loc.date || new Date(loc.startTime).toISOString().slice(0, 10),
            new Date(loc.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            loc.endTime ? new Date(loc.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active',
            loc.startAddress ? loc.startAddress.substring(0, 40) : '-',
            loc.endAddress ? loc.endAddress.substring(0, 40) : '-',
            `${(loc.totalDistance || 0).toFixed(2)} km`
          ]);
          
          // @ts-ignore
          doc.autoTable({ 
            startY: 96, 
            head: [['Date', 'Start Time', 'End Time', 'Start Location', 'End Location', 'Distance']], 
            body: distanceBody, 
            styles: { fontSize: 8 }, 
            margin: { left: 40, right: 40 } 
          });
          
          let y = doc.previousAutoTable.finalY + 30;
          doc.setFontSize(12);
          doc.text(`Total Distance: ${reportData.summary.totalKm.toFixed(2)} km`, 40, y);
          doc.text(`Total Travel Pay (TA): Rs ${(reportData.summary.totalKm * (reportData.employee.TA || 2.5)).toFixed(2)}`, 40, y + 20);
        } else {
           doc.text('No distance tracking data found for this period.', 40, 100);
        }
        
        doc.save(`Distance_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('Distance PDF exported');
        return;
      }

      if (reportType === 'Expenses') {
        doc.setFontSize(16);
        doc.text('Expense Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        
        if (reportData.expenses && reportData.expenses.length > 0) {
          const expenseBody = reportData.expenses.map(e => [
            new Date(e.date).toLocaleDateString(),
            e.category,
            e.description || '-',
            `Rs ${e.amount}`,
            e.status
          ]);
          // @ts-ignore
          doc.autoTable({ startY: 96, head: [['Date', 'Category', 'Description', 'Amount', 'Status']], body: expenseBody, styles: { fontSize: 8 } });
          
          let y = doc.previousAutoTable.finalY + 30;
          doc.setFontSize(12);
          doc.text(`Total Expenses: Rs ${reportData.summary.totalExpenses}`, 40, y);
        } else {
           doc.text('No expense data found for this period.', 40, 100);
        }
        
        doc.save(`Expense_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('Expense PDF exported');
        return;
      }

      if (reportType === 'Meetings') {
        doc.setFontSize(16);
        doc.text('Meetings Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        if (reportData.meetings && reportData.meetings.length > 0) {
          const mBody = reportData.meetings.map(m => [
            new Date(m.date).toLocaleString(),
            m.clientName,
            m.companyName || '-',
            m.mobileNumber || '-',
            (m.purpose || m.meetingNotes || '').slice(0, 80)
          ]);
          // @ts-ignore
          doc.autoTable({ startY: 96, head: [['Date', 'Client', 'Company', 'Phone', 'Purpose']], body: mBody, styles: { fontSize: 8 } });
          doc.setFontSize(12);
          doc.text(`Total Meetings: ${reportData.summary.totalMeetings}`, 40, doc.previousAutoTable.finalY + 30);
        } else {
           doc.text('No meeting data found for this period.', 40, 100);
        }
        doc.save(`Meetings_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('Meetings PDF exported');
        return;
      }

      if (reportType === 'Tasks') {
        doc.setFontSize(16);
        doc.text('Tasks Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        if (reportData.tasks && reportData.tasks.length > 0) {
          const tBody = reportData.tasks.map(t => [
            t.title,
            t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-',
            t.status,
            (t.description || '').slice(0, 80)
          ]);
          // @ts-ignore
          doc.autoTable({ startY: 96, head: [['Title', 'Due Date', 'Status', 'Description']], body: tBody, styles: { fontSize: 8 } });
        } else {
           doc.text('No task data found for this period.', 40, 100);
        }
        doc.save(`Tasks_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('Tasks PDF exported');
        return;
      }

      if (reportType === 'Leads') {
        doc.setFontSize(16);
        doc.text('Leads Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        if (reportData.leads && reportData.leads.length > 0) {
          const lBody = reportData.leads.map(l => [
            l.name,
            l.contactNo || '-',
            l.address || '-',
            l.status,
            (l.feedback || '').slice(0, 80)
          ]);
          // @ts-ignore
          doc.autoTable({ startY: 96, head: [['Lead Name', 'Phone', 'Address', 'Status', 'Feedback']], body: lBody, styles: { fontSize: 8 } });
        } else {
           doc.text('No leads found for this period.', 40, 100);
        }
        doc.save(`Leads_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('Leads PDF exported');
        return;
      }

      if (reportType === 'DA') {
        doc.setFontSize(16);
        doc.text('DA History Details Report', 40, 40);
        doc.setFontSize(10);
        doc.text(`Employee: ${reportData.employee.name} (${reportData.employee.employeeId || ''})`, 40, 60);
        doc.text(`Period: ${startDate} to ${endDate}`, 40, 76);
        
        const daList = reportData.employee.daHistory || employees.find(e => e._id === reportData.employee._id)?.daHistory || [];
        const filteredDa = daList.filter(da => {
           const daDate = new Date(da.date).toISOString().slice(0, 10);
           return daDate >= startDate && daDate <= endDate;
        });
        
        if (filteredDa.length > 0) {
          const daBody = filteredDa.map(da => [
            new Date(da.date).toLocaleString(),
            `Rs ${da.amount}`,
            da.receipt ? 'Yes' : 'No'
          ]);
          // @ts-ignore
          doc.autoTable({ startY: 96, head: [['Date', 'Amount', 'Receipt Uploaded']], body: daBody, styles: { fontSize: 8 } });
        } else {
           doc.text('No DA data found for this period.', 40, 100);
        }
        doc.save(`DA_Report_${reportData.employee.name.replace(/\s+/g,'_')}_${startDate}.pdf`);
        toast.success('DA PDF exported');
        return;
      }

      // Default (All)
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
    } catch (err) { console.error(err); toast.error('Export failed'); }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tighter uppercase italic flex items-center gap-3">
               <FileText className="w-7 h-7 text-primary-500" />
               Unified Activity Report
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-2">Consolidated Data Audit for Field Operations</p>
          </div>
          
          <div className="flex items-center gap-3 relative z-10">
            <button onClick={handleExport} disabled={!reportData} className="btn-ghost py-2.5 px-5 rounded-xl flex items-center gap-2">
              <Download className="w-4 h-4" /> <span className="text-xs uppercase font-black tracking-widest">Export PDF</span>
            </button>
            <button onClick={handleExportJPEG} disabled={!reportData} className="btn-ghost py-2.5 px-5 rounded-xl flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> <span className="text-xs uppercase font-black tracking-widest">Export JPEG</span>
            </button>
            <button onClick={handleExportJSON} disabled={!reportData} className="btn-ghost py-2.5 px-5 rounded-xl flex items-center gap-2">
              <FileText className="w-4 h-4" /> <span className="text-xs uppercase font-black tracking-widest">Export JSON</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-6 border-[var(--border-color)] shadow-xl grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Report Type</label>
            <select className="input-field" value={reportType} onChange={e => setReportType(e.target.value)}>
               <option value="All">Unified (All Data)</option>
               <option value="Distance">Distance Details</option>
               <option value="Expenses">Expense Details</option>
               <option value="Meetings">Meetings Log</option>
               <option value="Tasks">Tasks</option>
               <option value="Leads">Leads</option>
               <option value="DA">DA History</option>
            </select>
          </div>
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
          <div ref={reportRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[var(--bg-main)] p-4 rounded-2xl">
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
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Salary (Rs/Month)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">Rs{reportData.employee.salary || 12000}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Travel Rate (TA)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">Rs{reportData.employee.TA || 2.5}/km</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Daily Allowance (DA)</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mt-1">Rs{reportData.employee.DA || 0}</p>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
               {[
                 { label: 'Travel', value: `${reportData.summary.totalKm.toFixed(1)} km`, icon: MapPin, color: 'text-blue-400' },
                 { label: 'Meetings', value: reportData.summary.totalMeetings, icon: Briefcase, color: 'text-violet-400' },
                 { label: 'Expenses', value: `Rs${reportData.summary.totalExpenses}`, icon: Receipt, color: 'text-emerald-400' },
                 { label: 'Tasks', value: reportData.summary.totalTasks, icon: CheckCircle, color: 'text-amber-400' },
                 { label: 'Leads', value: reportData.summary.totalLeads, icon: Target, color: 'text-primary-400' }
               ].map((s, i) => (
                 <div key={i} className="glass-card p-5 border-[var(--border-color)] text-center">
                    <s.icon className={`w-6 h-6 mx-auto mb-3 ${s.color}`} />
                    <p className="text-[var(--text-main)] font-black text-xl tracking-tight leading-none">{s.value}</p>
                    <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest mt-2">{s.label}</p>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Detail Sections Conditionally Rendered */}

               {(reportType === 'All' || reportType === 'Distance') && (
               <div className="glass-card overflow-hidden lg:col-span-3">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-teal-500">Distance Details</h3>
                  </div>
                  <div className="divide-y divide-[var(--border-color)] max-h-[400px] overflow-auto">
                     {reportData.locations && reportData.locations.length > 0 ? (
                       reportData.locations.map(loc => (
                        <div key={loc._id} className="p-4 hover:bg-white/5 transition-colors flex justify-between items-center">
                           <div>
                              <p className="text-[var(--text-main)] font-bold text-sm">{new Date(loc.date).toLocaleDateString()}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[var(--text-main)] font-black text-teal-500">{loc.totalDistance ? loc.totalDistance.toFixed(2) : 0} km</p>
                           </div>
                        </div>
                       ))
                     ) : (
                       <p className="p-8 text-center text-[var(--text-muted)] text-sm">No distance recorded</p>
                     )}
                  </div>
               </div>
               )}

               {(reportType === 'All' || reportType === 'Meetings') && (
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
               )}

               {(reportType === 'All' || reportType === 'Expenses') && (
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
                              <p className="text-[var(--text-main)] font-black">Rs{e.amount}</p>
                              <span className="text-[9px] font-black uppercase text-primary-500">{e.status}</span>
                           </div>
                        </div>
                      ))}
                  </div>
               </div>
               )}

               {(reportType === 'All' || reportType === 'DA') && (
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
                              <p className="text-[var(--text-main)] font-black">Rs{da.amount}</p>
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
               )}

               {(reportType === 'All' || reportType === 'Tasks' || reportType === 'Leads') && (
               <div className="glass-card overflow-hidden lg:col-span-3">
                  <div className="p-4 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                     <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">Daily Action Items & Leads</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {(reportType === 'All' || reportType === 'Tasks') && (
                    <div className="border-r border-[var(--border-color)] max-h-[400px] overflow-auto">
                      {reportData.tasks.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)] text-sm">No tasks recorded</p> : reportData.tasks.map(t => (
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
                    )}
                    {(reportType === 'All' || reportType === 'Leads') && (
                    <div className="max-h-[400px] overflow-auto">
                      {reportData.leads.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)] text-sm">No leads recorded</p> : reportData.leads.map(l => (
                        <div key={l._id} className="p-4 border-b border-[var(--border-color)] last:border-0">
                           <p className="text-[var(--text-main)] font-bold text-sm">{l.name}</p>
                           <p className="text-[var(--text-muted)] text-[10px]">{l.address}</p>
                           <div className="mt-2 text-[10px] font-bold">
                              <span className="text-primary-500 uppercase tracking-widest">{l.status}</span>
                              {l.feedback && <p className="text-[var(--text-muted)] font-medium mt-1 italic">"{l.feedback}"</p>}
                           </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
               </div>
               )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
