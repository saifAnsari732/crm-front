import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Users2,
  UserCheck,
  Users,
  Search,
  Plus,
  MoreVertical,
  Briefcase,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function AdminDepartments() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  
  const isPlanActive = isSuperAdmin || (
    organization?.status === 'active' &&
    Boolean(organization?.plan?.expiresAt) &&
    new Date(organization.plan.expiresAt) > new Date()
  );

  const [departments, setDepartments] = useState([]);
  const [managersList, setManagersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [selectedMgrId, setSelectedMgrId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDepartmentsData = async () => {
    try {
      setLoading(true);
      const [deptRes, mgrRes] = await Promise.all([
        API.get('/admin/departments').catch(() => ({ data: { success: false } })),
        API.get('/admin/managers').catch(() => ({ data: { success: false } })),
      ]);

      if (deptRes.data?.success && Array.isArray(deptRes.data.departments)) {
        setDepartments(deptRes.data.departments);
      }
      if (mgrRes.data?.success && Array.isArray(mgrRes.data.managers)) {
        setManagersList(mgrRes.data.managers);
      }
    } catch (e) {
      console.error('Error fetching departments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentsData();
  }, []);

  const handleOpenAddModal = () => {
    if (!isPlanActive) {
      toast.error('❌ Subscription Plan Not Active! Please activate a plan in Billing to add departments.', {
        id: 'plan-check-add-dept',
        duration: 5000,
      });
      navigate('/admin/billing');
      return;
    }
    setShowAddModal(true);
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!isPlanActive) {
      toast.error('❌ Subscription Plan Not Active! Please activate a plan in Billing.');
      navigate('/admin/billing');
      return;
    }
    if (!newDeptName) return;

    try {
      const res = await API.post('/admin/departments', {
        name: newDeptName,
        description: newDeptDesc,
        managerId: selectedMgrId || null,
      });

      if (res.data?.success) {
        toast.success(`🎉 Department "${newDeptName}" added successfully!`);
        setShowAddModal(false);
        setNewDeptName('');
        setNewDeptDesc('');
        setSelectedMgrId('');
        fetchDepartmentsData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add department');
    }
  };

  const filteredDepts = departments.filter((dept) =>
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEmployees = departments.reduce((acc, d) => acc + (d.empCount || 0), 0);
  const totalManagers = departments.filter((d) => d.manager).length;
  const pieData = departments.map((d) => ({
    name: d.name,
    value: d.empCount || 0,
    color: d.color || '#3b82f6',
    percentage: totalEmployees > 0 ? `${(((d.empCount || 0) / totalEmployees) * 100).toFixed(1)}%` : '0%',
  }));

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Departments</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your organization's departments, assigned managers and field team distribution.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Department
          </button>
        </div>

        {/* 4 Stat Cards (Dynamic from DB) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Departments</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{departments.length}</h3>
              <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <TrendingUp className="w-3 h-3" /> Live from DB
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Operational Units</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{departments.length}</h3>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Active</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Assigned Managers</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{totalManagers}</h3>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Department Leads</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Staff</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{totalEmployees}</h3>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Deployed Staff</span>
            </div>
          </div>
        </div>

        {/* Middle: Departments Table (8 cols) + Department Overview Donut (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Table List */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Departments List ({filteredDepts.length})</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">Employee Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDepts.length > 0 ? (
                    filteredDepts.map((dept) => (
                      <tr key={dept._id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">{dept.name}</span>
                              <span className="text-[10px] text-slate-400 block">{dept.description}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {dept.manager ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                                {dept.manager.name.slice(0, 1)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 block leading-tight">{dept.manager.name}</span>
                                <span className="text-[10px] text-slate-400 block">{dept.manager.title || 'Department Lead'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{dept.empCount} Employees</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {dept.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => toast.success(`Viewing department: ${dept.name}`)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-xs text-slate-400">
                        {loading ? 'Loading departments from database...' : 'No departments found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Overview Donut (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Department Overview</h3>
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 relative flex-shrink-0">
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} innerRadius={38} outerRadius={54} paddingAngle={3} dataKey="value">
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-sm font-bold text-slate-900">{totalEmployees}</span>
                        <span className="text-[9px] text-slate-500">Employees</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                      No Data
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-xs">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 text-[11px] truncate">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></span>
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {d.value} ({d.percentage})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Department Managers List */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Department Leads</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                {departments.filter((d) => d.manager).length > 0 ? (
                  departments
                    .filter((d) => d.manager)
                    .map((d) => (
                      <div key={d._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                            {d.manager.name.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{d.manager.name}</span>
                            <span className="text-[10px] text-slate-400 block">{d.name}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">{d.empCount} Employees</span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No department managers assigned yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cards: Department Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {departments.map((d) => (
            <div key={d._id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-2">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm truncate">{d.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.empCount} Staff Deployed</p>
              </div>

              <button
                onClick={() => toast.success(`Viewing details for ${d.name}`)}
                className="mt-3 w-full py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              >
                View Scope
              </button>
            </div>
          ))}
        </div>

        {/* Add Department Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">Add New Department</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleAddDept} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Field Services, Quality Control"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    placeholder="Brief description of department scope..."
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign Department Manager</label>
                  <select
                    value={selectedMgrId}
                    onChange={(e) => setSelectedMgrId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned (Select later)</option>
                    {managersList.map((m) => (
                      <option key={m._id} value={m._id}>{m.name} ({m.department || 'Manager'})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-sm"
                  >
                    Create Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
