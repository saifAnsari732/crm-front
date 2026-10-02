import React, { useState, useEffect, useRef } from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { adminAPI } from '../../services/api.service';
import toast from 'react-hot-toast';
import {
  FileText,
  Download,
  Calendar,
  User,
  Search,
  MapPin,
  Receipt,
  Briefcase,
  CheckCircle,
  Target,
  Image as ImageIcon,
  Printer,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  DollarSign,
  TrendingUp,
  Shield,
  Eye,
  Phone,
  Sparkles,
  ArrowRight,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import Avatar from '../../components/shared/Avatar';

export default function AdminReports() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('All');
  const [expandedDates, setExpandedDates] = useState({});
  const printableReportRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 100, role: 'all' });
      const empList = data.employees || [];
      setEmployees(empList);
      if (empList.length > 0 && !selectedEmp) {
        setSelectedEmp(empList[0]._id);
      }
    } catch {
      toast.error('Failed to load employee list');
    }
  };

  const handleQuickDatePreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(y);
      setEndDate(y);
    } else if (preset === '7days') {
      const s = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'lastMonth') {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
      const e = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(e);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEmp) return toast.error('Please select an employee first');
    setLoading(true);
    try {
      const { data } = await adminAPI.getConsolidatedReport({
        employeeId: selectedEmp,
        startDate,
        endDate,
      });
      setReportData(data.data);
      setExpandedDates({});
      toast.success('Consolidated Report generated successfully');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const toggleDateExpansion = (dateKey) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  // ─── Export to JPEG (Clean Target Ref without UI Buttons) ───────────────────
  const handleExportJPEG = async () => {
    if (!printableReportRef.current) return;
    try {
      const element = printableReportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Report_${reportData?.employee?.name?.replace(/\s+/g, '_') || 'Audit'}_${startDate}_to_${endDate}.jpg`;
      link.click();
      toast.success('JPEG snapshot exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export JPEG');
    }
  };

  // ─── Export to CSV / Excel ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!reportData) return;
    try {
      const emp = reportData.employee;
      const summary = reportData.summary;
      const daily = reportData.dailyDistances || [];

      let csv = `KISANCONNECT FIELD OPERATIONS REPORT\n`;
      csv += `Employee,${emp.name} (${emp.employeeId || 'N/A'})\n`;
      csv += `Department,${emp.department || 'N/A'}\n`;
      csv += `Designation,${emp.designation || 'N/A'}\n`;
      csv += `Phone,${emp.phone || 'N/A'}\n`;
      csv += `Period,${startDate} to ${endDate}\n`;
      csv += `Monthly Salary,Rs ${emp.salary || 12000}\n`;
      csv += `TA Rate,Rs ${summary.taRate || 2.5} / km\n`;
      csv += `DA Rate,Rs ${summary.daRate || 0} / day\n\n`;

      csv += `--- SUMMARY TOTALS ---\n`;
      csv += `Total Distance (km),${summary.totalKm}\n`;
      csv += `Total Travel Pay (TA),Rs ${summary.travelPay}\n`;
      csv += `Total Meetings,${summary.totalMeetings}\n`;
      csv += `Total Expenses Claimed,Rs ${summary.totalExpenses}\n`;
      csv += `Approved Expenses,Rs ${summary.approvedExpenses || 0}\n`;
      csv += `Total Tasks,${summary.totalTasks}\n`;
      csv += `Total Leads,${summary.totalLeads}\n\n`;

      csv += `--- DAILY CONSOLIDATED DISTANCE & TRAVEL ALLOWANCE ---\n`;
      csv += `Date,Day,Sessions,Total Distance (km),TA Rate (Rs/km),Daily Travel Pay (Rs),Start Address,End Address\n`;
      daily.forEach((d) => {
        const dayName = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        csv += `"${d.date}","${dayName}",${d.sessionsCount},"${d.totalDistance}","${summary.taRate || 2.5}","${d.travelPay}","${(d.startAddress || '').replace(/"/g, '""')}","${(d.endAddress || '').replace(/"/g, '""')}"\n`;
      });
      csv += `\n`;

      if (reportData.meetings?.length > 0) {
        csv += `--- MEETINGS & CLIENT VISITS ---\n`;
        csv += `Date,Client Name,Store / Company,Phone,Status,Deal Value,Meeting Notes\n`;
        reportData.meetings.forEach((m) => {
          csv += `"${new Date(m.date).toLocaleDateString()}","${m.clientName || ''}","${m.companyName || ''}","${m.mobileNumber || ''}","${m.status || ''}","Rs ${m.dealAmount || 0}","${(m.meetingNotes || m.purpose || '').replace(/"/g, '""')}"\n`;
        });
        csv += `\n`;
      }

      if (reportData.expenses?.length > 0) {
        csv += `--- EXPENSE CLAIMS ---\n`;
        csv += `Date,Category,Amount,Status,Description\n`;
        reportData.expenses.forEach((e) => {
          csv += `"${new Date(e.date).toLocaleDateString()}","${e.category}","Rs ${e.amount}","${e.status}","${(e.description || '').replace(/"/g, '""')}"\n`;
        });
        csv += `\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Report_${emp.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV / Excel report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV');
    }
  };

  // ─── Export to PDF (Clean Formatting with autoTable) ─────────────────────────
  const handleExport = () => {
    if (!reportData) return;

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const emp = reportData.employee;
      const summary = reportData.summary;
      const daily = reportData.dailyDistances || [];

      // Header Banner
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 595.28, 70, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('KISANCONNECT FIELD OPERATIONS REPORT', 40, 32);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`AUDIT PERIOD: ${startDate} to ${endDate}   |   GENERATED: ${new Date().toLocaleDateString()}`, 40, 50);

      // Employee Information Block
      const empTableData = [
        ['Employee Name', emp.name, 'Department', emp.department || 'Field Services'],
        ['Employee ID', emp.employeeId || '-', 'Designation', emp.designation || 'Field Executive'],
        ['Contact Phone', emp.phone || '-', 'Allocated Area', emp.allocatedArea || 'General Zone'],
        ['Monthly Salary', `Rs. ${emp.salary || 12000}`, 'TA Travel Rate', `Rs. ${summary.taRate || 2.5} / km`],
      ];

      // @ts-ignore
      doc.autoTable({
        startY: 85,
        head: [['Profile Field', 'Information', 'Operations Field', 'Information']],
        body: empTableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        margin: { left: 40, right: 40 },
      });

      let y = doc.previousAutoTable.finalY + 15;

      // Executive Summary KPI Table
      const summaryTableData = [
        ['Total Traveled Distance', `${summary.totalKm.toFixed(2)} km`, 'Client Meetings / Visits', `${summary.totalMeetings} (${summary.completedMeetings || 0} Done)`],
        ['Total Travel Pay (TA)', `Rs. ${summary.travelPay}`, 'Expense Claims', `Rs. ${summary.totalExpenses} (Rs. ${summary.approvedExpenses || 0} Approved)`],
        ['Assigned Tasks', `${summary.totalTasks} Tasks`, 'New Leads Captured', `${summary.totalLeads} Leads`],
      ];

      // @ts-ignore
      doc.autoTable({
        startY: y,
        head: [['Metric', 'Summary Result', 'Activity Metric', 'Summary Result']],
        body: summaryTableData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        margin: { left: 40, right: 40 },
      });

      y = doc.previousAutoTable.finalY + 20;

      // 1. Consolidated Daily Distance Table
      if (daily.length > 0 && (reportType === 'All' || reportType === 'Distance')) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('1. Consolidated Daily Distance & Travel Allowance (TA)', 40, y);

        const distanceRows = daily.map((d) => [
          d.date,
          new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
          `${d.sessionsCount} Session(s)`,
          `${d.totalDistance.toFixed(2)} km`,
          `Rs. ${summary.taRate || 2.5}/km`,
          `Rs. ${d.travelPay.toFixed(2)}`,
          d.startAddress ? d.startAddress.substring(0, 30) : '-',
        ]);

        // @ts-ignore
        doc.autoTable({
          startY: y + 8,
          head: [['Date', 'Day', 'Sessions', 'Total Distance', 'Rate', 'Travel Pay', 'Start Location']],
          body: distanceRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: [14, 116, 144], textColor: 255, fontStyle: 'bold' },
          margin: { left: 40, right: 40 },
        });

        y = doc.previousAutoTable.finalY + 20;
      }

      // 2. Client Meetings Table
      if (reportData.meetings?.length > 0 && (reportType === 'All' || reportType === 'Meetings')) {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('2. Client Meetings & Visits Log', 40, y);

        const meetingRows = reportData.meetings.map((m) => [
          new Date(m.date).toLocaleDateString(),
          m.clientName || 'Client',
          m.companyName || '-',
          m.mobileNumber || '-',
          `Rs. ${m.dealAmount || 0}`,
          m.status || 'scheduled',
          (m.meetingNotes || m.purpose || '').slice(0, 40),
        ]);

        // @ts-ignore
        doc.autoTable({
          startY: y + 8,
          head: [['Date', 'Client', 'Store/Company', 'Phone', 'Deal Value', 'Status', 'Notes']],
          body: meetingRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
          margin: { left: 40, right: 40 },
        });

        y = doc.previousAutoTable.finalY + 20;
      }

      // 3. Expense Claims Table
      if (reportData.expenses?.length > 0 && (reportType === 'All' || reportType === 'Expenses')) {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('3. Expense Claims & Reimbursements', 40, y);

        const expenseRows = reportData.expenses.map((e) => [
          new Date(e.date).toLocaleDateString(),
          e.category?.toUpperCase() || 'MISC',
          `Rs. ${e.amount}`,
          e.status?.toUpperCase() || 'PENDING',
          (e.description || '-').slice(0, 50),
        ]);

        // @ts-ignore
        doc.autoTable({
          startY: y + 8,
          head: [['Date', 'Category', 'Amount', 'Status', 'Description']],
          body: expenseRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
          margin: { left: 40, right: 40 },
        });

        y = doc.previousAutoTable.finalY + 20;
      }

      const filename = `Report_${emp.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`;
      doc.save(filename);
      toast.success('PDF report exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('PDF Export failed');
    }
  };

  return (
    <KisanConnectLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
        {/* ── Top Header & Export Toolbar (Hidden on Print) ── */}
        <div className="no-print print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full w-fit mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Executive Data Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Unified Activity & Distance Report
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Consolidated daily distance audit, travel allowance calculation, client visits, and expense summaries.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              disabled={!reportData}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!reportData}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel / CSV</span>
            </button>

            <button
              onClick={handleExportJPEG}
              disabled={!reportData}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>JPEG Snapshot</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={!reportData}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* ── Filter & Generation Control Panel (Hidden on Print) ── */}
        <div className="no-print print:hidden bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              Report Configuration & Date Range Filters
            </h3>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 mr-1 hidden sm:inline">Quick Presets:</span>
              {[
                { label: 'Today', key: 'today' },
                { label: 'Yesterday', key: 'yesterday' },
                { label: 'Last 7 Days', key: '7days' },
                { label: 'This Month', key: 'thisMonth' },
                { label: 'Last Month', key: 'lastMonth' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleQuickDatePreset(p.key)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[11px] font-bold transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* 1. Report Focus Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Report View Focus
              </label>
              <select
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="All">Unified (All Operations Data)</option>
                <option value="Distance">Distance Details & TA Pay</option>
                <option value="Meetings">Meetings & Client Visits Log</option>
                <option value="Expenses">Expense Claims & Settlements</option>
                <option value="Tasks">Tasks & Work Orders</option>
                <option value="Leads">Leads & Customer Pipeline</option>
                <option value="DA">Daily Allowance (DA) History</option>
              </select>
            </div>

            {/* 2. Select Employee */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Field Executive
              </label>
              <select
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
              >
                <option value="">Choose Field Employee...</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} ({e.employeeId || 'ID N/A'}) • {e.department || 'General'}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* 4. End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* 5. Generate Button */}
            <div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/25 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing DB...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Empty State Hero Card (When No Report Generated Yet) ── */}
        {!reportData && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-10 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
              <FileText className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-black text-slate-900">Build a Field Staff Report</h3>
              <p className="text-xs text-slate-500 font-medium">
                Choose an employee and a date range from the panel above, then click <strong className="text-blue-600">Generate Report</strong> to inspect consolidated distance, meetings, expenses, and TA/DA totals.
              </p>
            </div>

            {employees.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>Generate Report for {employees.find((e) => e._id === selectedEmp)?.name || 'Selected Staff'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Printable Report Document Container ── */}
        {reportData && (
          <div
            ref={printableReportRef}
            className="space-y-6 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Print-Only Document Banner (Appears only on Paper / Print Preview) */}
            <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    KISANCONNECT FIELD OPERATIONS
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    Consolidated Activity & Distance Audit Report
                  </p>
                </div>
                <div className="text-right text-xs font-semibold text-slate-700">
                  <div>Period: <strong className="text-slate-900">{startDate} to {endDate}</strong></div>
                  <div>Printed On: <strong>{new Date().toLocaleDateString('en-IN')}</strong></div>
                </div>
              </div>
            </div>

            {/* Employee Profile & Remuneration Card */}
            <div className="print-avoid-break bg-slate-50/70 print:bg-white rounded-3xl p-6 border border-slate-200/90 print:border-slate-300 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                <div className="flex items-center gap-3.5">
                  <Avatar
                    src={reportData.employee.avatar}
                    name={reportData.employee.name}
                    size="lg"
                  />
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {reportData.employee.name}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold print:border print:border-blue-200">
                        {reportData.employee.employeeId || 'EMP-N/A'}
                      </span>
                      <span>•</span>
                      <span>{reportData.employee.department || 'Field Operations'}</span>
                      <span>•</span>
                      <span>{reportData.employee.designation || 'Field Executive'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 bg-white print:bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    Audit Period: <strong>{startDate} to {endDate}</strong>
                  </span>
                </div>
              </div>

              {/* Remuneration Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-1">
                <div className="bg-white print:bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Phone / Mobile
                  </span>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600 print:hidden" />
                    <span>{reportData.employee.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="bg-white print:bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Allocated Area
                  </span>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-600 print:hidden" />
                    <span className="capitalize">{reportData.employee.allocatedArea || 'Assigned Zone'}</span>
                  </div>
                </div>

                <div className="bg-white print:bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Base Salary
                  </span>
                  <div className="text-xs font-black text-slate-900">
                    ₹{(reportData.employee.salary || 12000).toLocaleString()}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">/ mo</span>
                  </div>
                </div>

                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80">
                  <span className="text-[10px] font-black uppercase text-blue-700 block mb-1">
                    Travel Rate (TA)
                  </span>
                  <div className="text-xs font-black text-blue-900">
                    ₹{reportData.summary.taRate || 2.5}{' '}
                    <span className="text-[10px] text-blue-600 font-bold">/ km</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80">
                  <span className="text-[10px] font-black uppercase text-emerald-700 block mb-1">
                    Daily Allowance (DA)
                  </span>
                  <div className="text-xs font-black text-emerald-900">
                    ₹{reportData.summary.daRate || 0}{' '}
                    <span className="text-[10px] text-emerald-600 font-bold">/ day</span>
                  </div>
                </div>

                <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200/80">
                  <span className="text-[10px] font-black uppercase text-indigo-700 block mb-1">
                    Net TA Payout
                  </span>
                  <div className="text-xs font-black text-indigo-900">
                    ₹{reportData.summary.travelPay}
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Core KPI Metric Cards */}
            <div className="print-avoid-break grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Distance */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    ₹{reportData.summary.travelPay} TA
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 pt-1">
                  {reportData.summary.totalKm.toFixed(2)}{' '}
                  <span className="text-xs text-slate-400 font-bold">km</span>
                </h4>
                <p className="text-xs font-bold text-slate-500">Total Distance</p>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {reportData.dailyDistances?.length || 0} active days
                </span>
              </div>

              {/* Meetings */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                    {reportData.summary.completedMeetings || 0} Done
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 pt-1">
                  {reportData.summary.totalMeetings}
                </h4>
                <p className="text-xs font-bold text-slate-500">Client Meetings</p>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Store & client visits
                </span>
              </div>

              {/* Expenses */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    ₹{reportData.summary.approvedExpenses || 0} Approved
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 pt-1">
                  ₹{reportData.summary.totalExpenses}
                </h4>
                <p className="text-xs font-bold text-slate-500">Expenses Claimed</p>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Fuel, meals, stays
                </span>
              </div>

              {/* Tasks */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    {reportData.summary.completedTasks || 0} Closed
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 pt-1">
                  {reportData.summary.totalTasks}
                </h4>
                <p className="text-xs font-bold text-slate-500">Assigned Tasks</p>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Field assignments
                </span>
              </div>

              {/* Leads */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Target className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    Pipeline
                  </span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 pt-1">
                  {reportData.summary.totalLeads}
                </h4>
                <p className="text-xs font-bold text-slate-500">Leads Captured</p>
                <span className="text-[10px] text-slate-400 block font-medium">
                  New client prospects
                </span>
              </div>
            </div>

            {/* ── 1. CONSOLIDATED DAILY DISTANCE SECTION (COMBINED BY DATE) ── */}
            {(reportType === 'All' || reportType === 'Distance') && (
              <div className="print-avoid-break bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
                <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <span>Consolidated Daily Distance & Travel Allowance (TA)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      All tracking sessions on each date are combined into a single total km entry with TA rate calculation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
                      Total: <strong>{reportData.summary.totalKm.toFixed(2)} km</strong> (₹{reportData.summary.travelPay})
                    </span>
                  </div>
                </div>

                {reportData.dailyDistances && reportData.dailyDistances.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 min-w-[120px]">Date & Day</th>
                          <th className="py-3 px-4 min-w-[90px]">Sessions</th>
                          <th className="py-3 px-4 min-w-[110px]">Daily Total Distance</th>
                          <th className="py-3 px-4 min-w-[80px]">TA Rate</th>
                          <th className="py-3 px-4 min-w-[110px]">Calculated Travel Pay</th>
                          <th className="py-3 px-4 min-w-[140px]">Start Location</th>
                          <th className="py-3 px-4 min-w-[140px]">End Location</th>
                          <th className="py-3 px-4 text-right no-print print:hidden">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                        {reportData.dailyDistances.map((d) => {
                          const dateObj = new Date(d.date);
                          const formattedDate = dateObj.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                          const isExpanded = expandedDates[d.date];

                          return (
                            <React.Fragment key={d.date}>
                              <tr className="hover:bg-slate-50/80 transition">
                                {/* Date & Day */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{formattedDate}</div>
                                  <div className="text-[11px] text-slate-400 font-medium">{dayName}</div>
                                </td>

                                {/* Sessions Count Badge */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] print:border print:border-blue-200">
                                    <Layers className="w-3 h-3 print:hidden" />
                                    <span>{d.sessionsCount} Session{d.sessionsCount > 1 ? 's' : ''}</span>
                                  </span>
                                </td>

                                {/* Total Combined Distance */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="text-base font-black text-slate-900">
                                    {d.totalDistance.toFixed(2)}{' '}
                                    <span className="text-xs text-slate-500 font-bold">km</span>
                                  </span>
                                </td>

                                {/* Rate */}
                                <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-500">
                                  ₹{reportData.summary.taRate || 2.5}/km
                                </td>

                                {/* Daily Travel Pay */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg print:border print:border-emerald-200">
                                    ₹{d.travelPay.toFixed(2)}
                                  </span>
                                </td>

                                {/* Start Address */}
                                <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-600" title={d.startAddress}>
                                  {d.startAddress || '—'}
                                </td>

                                {/* End Address */}
                                <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-600" title={d.endAddress}>
                                  {d.endAddress || '—'}
                                </td>

                                {/* Expand Details Button */}
                                <td className="py-3.5 px-4 text-right no-print print:hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleDateExpansion(d.date)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Sessions'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Individual Sessions Breakdown (Interactive / Screen) */}
                              {isExpanded && (
                                <tr className="no-print print:hidden">
                                  <td colSpan="8" className="bg-slate-50 p-4 border-y border-slate-200">
                                    <div className="space-y-2.5 max-w-4xl mx-auto">
                                      <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                                        Individual Session Log for {formattedDate} ({d.sessionsCount} Sessions)
                                      </h5>

                                      <div className="grid grid-cols-1 gap-2">
                                        {d.sessions.map((sess, idx) => {
                                          const startTimeStr = sess.startTime
                                            ? new Date(sess.startTime).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : 'N/A';
                                          const endTimeStr = sess.endTime
                                            ? new Date(sess.endTime).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : sess.isActive
                                            ? 'Currently Active'
                                            : 'Completed';

                                          return (
                                            <div
                                              key={sess._id || idx}
                                              className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                            >
                                              <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                                  {idx + 1}
                                                </span>
                                                <div>
                                                  <span className="font-bold text-slate-800">
                                                    {startTimeStr} → {endTimeStr}
                                                  </span>
                                                  <p className="text-[11px] text-slate-400 font-medium">
                                                    {sess.startAddress || 'Start location'} →{' '}
                                                    {sess.endAddress || 'End location'}
                                                  </p>
                                                </div>
                                              </div>

                                              <div className="text-right font-bold text-slate-900 shrink-0">
                                                <span className="text-blue-600 font-black">
                                                  {sess.distance} km
                                                </span>{' '}
                                                •{' '}
                                                <span className="text-emerald-700">
                                                  ₹{(sess.distance * (reportData.summary.taRate || 2.5)).toFixed(2)}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                        <tr>
                          <td className="py-3.5 px-4" colSpan="2">
                            Total Traveled ({reportData.dailyDistances.length} Active Days)
                          </td>
                          <td className="py-3.5 px-4 text-base text-blue-600">
                            {reportData.summary.totalKm.toFixed(2)} km
                          </td>
                          <td className="py-3.5 px-4">—</td>
                          <td className="py-3.5 px-4 text-base text-emerald-700">
                            ₹{reportData.summary.travelPay}
                          </td>
                          <td className="py-3.5 px-4" colSpan="3">
                            <span className="text-xs text-slate-500 font-semibold">
                              Total TA calculated at ₹{reportData.summary.taRate || 2.5}/km
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    No distance telemetry recorded for this period.
                  </div>
                )}
              </div>
            )}

            {/* ── 2. CLIENT MEETINGS & VISITS SECTION ── */}
            {(reportType === 'All' || reportType === 'Meetings') && (
              <div className="print-avoid-break bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
                <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                      <span>Client Meetings & Field Visits Log</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Client discussions, shop check-ins, store locations, and deal status.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-purple-800 bg-purple-100 px-3 py-1 rounded-full">
                    {reportData.meetings?.length || 0} Total Meetings
                  </span>
                </div>

                {reportData.meetings && reportData.meetings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Client / Store</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4">Address / Location</th>
                          <th className="py-3 px-4">Deal Value</th>
                          <th className="py-3 px-4">Notes / Purpose</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                        {reportData.meetings.map((m) => (
                          <tr key={m._id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                              {new Date(m.date).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">{m.clientName || 'Client'}</span>
                              <span className="text-[11px] text-slate-400 block">{m.companyName || 'Store'}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {m.mobileNumber || '—'}
                            </td>
                            <td className="py-3.5 px-4 max-w-[200px] truncate" title={m.meetingAddress}>
                              {m.meetingAddress || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {m.dealAmount > 0 ? `₹${m.dealAmount.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-600" title={m.meetingNotes || m.purpose}>
                              {m.meetingNotes || m.purpose || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  m.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.status === 'scheduled'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {m.status || 'Scheduled'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    No client meetings found for this period.
                  </div>
                )}
              </div>
            )}

            {/* ── 3. EXPENSE CLAIMS SECTION ── */}
            {(reportType === 'All' || reportType === 'Expenses') && (
              <div className="print-avoid-break bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
                <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                      <span>Expense Claims & Reimbursements</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Itemized travel, meal, fuel, and hotel reimbursement requests.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                    Total: ₹{reportData.summary.totalExpenses}
                  </span>
                </div>

                {reportData.expenses && reportData.expenses.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4 no-print print:hidden">Receipts</th>
                          <th className="py-3 px-4 text-right">Approval Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                        {reportData.expenses.map((e) => (
                          <tr key={e._id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4 uppercase font-bold text-slate-800">
                              {e.category}
                            </td>
                            <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                              ₹{e.amount}
                            </td>
                            <td className="py-3.5 px-4 max-w-[250px] truncate text-slate-600">
                              {e.description || '—'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap no-print print:hidden">
                              {e.receipts?.length > 0 ? (
                                <a
                                  href={e.receipts[0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Receipt</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 font-normal">No receipt</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  e.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : e.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    No expense claims filed for this period.
                  </div>
                )}
              </div>
            )}

            {/* ── 4. TASKS & LEADS GRID ── */}
            {(reportType === 'All' || reportType === 'Tasks' || reportType === 'Leads') && (
              <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tasks Section */}
                {(reportType === 'All' || reportType === 'Tasks') && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-600" />
                        <span>Tasks & Field Work Orders ({reportData.tasks?.length || 0})</span>
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                      {reportData.tasks?.length > 0 ? (
                        reportData.tasks.map((t) => (
                          <div key={t._id} className="p-4 hover:bg-slate-50/80 transition space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-bold text-slate-900 text-xs">{t.title}</h5>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  t.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-2">
                              {t.description || 'No description provided.'}
                            </p>
                            <div className="text-[10px] text-slate-400 font-semibold pt-1 flex items-center gap-3">
                              <span>Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}</span>
                              <span>Priority: <strong className="uppercase text-slate-700">{t.priority || 'Medium'}</strong></span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs font-bold">
                          No tasks recorded in this timeframe.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Leads Section */}
                {(reportType === 'All' || reportType === 'Leads') && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Target className="w-4 h-4 text-rose-600" />
                        <span>Customer Leads & Pipeline ({reportData.leads?.length || 0})</span>
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                      {reportData.leads?.length > 0 ? (
                        reportData.leads.map((l) => (
                          <div key={l._id} className="p-4 hover:bg-slate-50/80 transition space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-slate-900 text-xs">{l.name}</h5>
                                <span className="text-[11px] font-mono text-slate-500">{l.contactNo || l.phone || 'No phone'}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                                {l.status || 'New'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Address: {l.address || '—'}
                            </p>
                            {l.feedback && (
                              <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                "{l.feedback}"
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs font-bold">
                          No leads generated in this timeframe.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
