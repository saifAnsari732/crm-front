import React, { useState, useEffect, useMemo } from 'react';
import TrackProLayout from '../../components/layout/TrackProLayout';
import { taskAPI, adminAPI } from '../../services/api.service';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';
import {
  ClipboardList,
  Plus,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Play,
  RotateCcw,
  MoreVertical,
  Trash2,
  Edit,
  Filter,
  Layers,
  Sparkles,
  MapPin,
  CheckSquare,
  AlertTriangle,
  X,
  FileText,
  ChevronDown
} from 'lucide-react';

const TASK_TEMPLATES = [
  {
    title: 'Dealer / Retailer Store Audit',
    description: 'Verify shelf availability, stock inventory count, and collect marketing display photos.',
    priority: 'high',
    department: 'Sales',
  },
  {
    title: 'Farmer Field Demo & Sampling',
    description: 'Demonstrate product application on crop field and collect feedback signatures from local farmers.',
    priority: 'medium',
    department: 'Field Services',
  },
  {
    title: 'Customer Payment Follow-Up',
    description: 'Follow up on pending distributor invoice collection and update account ledger statement.',
    priority: 'high',
    department: 'Accounts',
  },
  {
    title: 'Distributor Quarterly Review',
    description: 'Review monthly sales quota, listen to regional distribution bottlenecks, and set next month targets.',
    priority: 'medium',
    department: 'Operations',
  },
  {
    title: 'Competitor Market Survey',
    description: 'Note pricing strategies, active promotional schemes, and new competitor product entries in local mandi.',
    priority: 'low',
    department: 'Marketing',
  },
];

export default function AdminTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedTaskMenu, setSelectedTaskMenu] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    employee: '',
    dueDate: '',
    priority: 'medium',
    department: 'Field Services',
    locationAddress: '',
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await taskAPI.getAll();
      setTasks(data.tasks || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await adminAPI.getEmployees({ limit: 200, role: 'all' });
      const emps = data.employees || [];
      setEmployees(emps);

      // Extract unique departments
      const depts = Array.from(new Set(emps.map((e) => e.department).filter(Boolean)));
      setDepartments(depts.length > 0 ? depts : ['Field Services', 'Sales', 'Marketing', 'Operations']);
    } catch {}
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    if (!formData.employee) {
      toast.error('Please assign this task to an employee');
      return;
    }

    try {
      if (editingTask) {
        await taskAPI.update(editingTask._id, {
          title: formData.title,
          description: formData.description,
          employee: formData.employee,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          priority: formData.priority,
          location: { address: formData.locationAddress },
        });
        toast.success('Task updated successfully');
      } else {
        await taskAPI.create({
          title: formData.title,
          description: formData.description,
          employeeId: formData.employee,
          employee: formData.employee,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          priority: formData.priority,
          location: { address: formData.locationAddress },
        });
        toast.success('Task assigned successfully');
      }
      setShowCreateModal(false);
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        employee: '',
        dueDate: '',
        priority: 'medium',
        department: 'Field Services',
        locationAddress: '',
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save task');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await taskAPI.updateStatus(id, { status });
      toast.success(`Task status changed to ${status}`);
      setSelectedTaskMenu(null);
      fetchTasks();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskAPI.delete(id);
      toast.success('Task deleted');
      setSelectedTaskMenu(null);
      fetchTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const applyTemplate = (template) => {
    setFormData((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
      priority: template.priority,
      department: template.department,
    }));
    setShowTemplatesModal(false);
    setShowCreateModal(true);
  };

  const startEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title || '',
      description: task.description || '',
      employee: task.employee?._id || task.employee || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
      priority: task.priority || 'medium',
      department: task.employee?.department || 'Field Services',
      locationAddress: task.location?.address || '',
    });
    setSelectedTaskMenu(null);
    setShowCreateModal(true);
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchSearch =
        !searchQuery.trim() ||
        task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = !statusFilter || task.status === statusFilter;
      const matchPriority = !priorityFilter || task.priority === priorityFilter;
      const matchDept = !departmentFilter || task.employee?.department === departmentFilter;

      return matchSearch && matchStatus && matchPriority && matchDept;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, departmentFilter]);

  // KPI Metrics Calculation
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    return t.dueDate && new Date(t.dueDate) < new Date();
  }).length;

  const inProgressPct = totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;
  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pendingPct = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;
  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  return (
    <TrackProLayout>
      <div className="w-full space-y-6">
        {/* Breadcrumb & Header matching Image */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-rose-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-500 mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Task Management</span>
              <span>/</span>
              <span className="text-slate-900 font-bold">Tasks</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tasks</h1>
                <p className="text-xs text-slate-500 font-medium">
                  Create, manage and track all tasks assigned to your employees.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setEditingTask(null);
                setFormData({
                  title: '',
                  description: '',
                  employee: '',
                  dueDate: '',
                  priority: 'medium',
                  department: 'Field Services',
                  locationAddress: '',
                });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Assign New Task</span>
            </button>

            <button
              onClick={() => setShowTemplatesModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-rose-300 bg-white text-slate-700 text-xs font-bold hover:bg-rose-50 transition shadow-xs"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Task Templates</span>
            </button>

            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setPriorityFilter('');
                setDepartmentFilter('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
              title="Reset Filters"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Total Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Tasks</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900">{totalTasks}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">All tasks</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          </div>

          {/* 2. In Progress */}
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">In Progress</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-emerald-600" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-600">{inProgressTasks}</span>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">{inProgressPct}% of total</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
          </div>

          {/* 3. Completed */}
          <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Completed</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-purple-600">{completedTasks}</span>
              <p className="text-[11px] text-purple-700 font-semibold mt-0.5">{completedPct}% of total</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
          </div>

          {/* 4. Pending */}
          <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-600">{pendingTasks}</span>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">{pendingPct}% of total</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </div>

          {/* 5. Overdue */}
          <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-xs relative overflow-hidden col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Overdue</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-600">{overdueTasks}</span>
              <p className="text-[11px] text-rose-700 font-semibold mt-0.5">{overduePct}% of total</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
          </div>
        </div>

        {/* Filter Toolbar matching Screenshot */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by task title, employee name, or description..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-400 text-slate-900 placeholder:text-slate-400 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Dropdown */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* Priority Dropdown */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Clear Filters Link */}
              {(searchQuery || statusFilter || priorityFilter || departmentFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('');
                    setPriorityFilter('');
                    setDepartmentFilter('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* High-Density Tasks Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input type="checkbox" className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer" />
                  </th>
                  <th className="py-3.5 px-4">Task Title</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-5 px-4">
                        <div className="h-9 bg-slate-100 rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                          <ClipboardList className="w-7 h-7" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">No Tasks Found</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Create your first task or use pre-built templates to assign field duties.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const isOverdue =
                      task.status !== 'completed' &&
                      task.dueDate &&
                      new Date(task.dueDate) < new Date();

                    return (
                      <tr key={task._id} className="hover:bg-rose-50/20 transition-colors group">
                        {/* Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input type="checkbox" className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer" />
                        </td>

                        {/* Task Title + Icon badge + Description */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-100">
                              <ClipboardList className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate group-hover:text-rose-600 transition-colors">
                                {task.title}
                              </span>
                              {task.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assigned To (Avatar + Name + Designation) */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={task.employee?.avatar}
                              name={task.employee?.name || 'Staff'}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">
                                {task.employee?.name || 'Unassigned'}
                              </span>
                              <span className="text-[10px] text-slate-400 capitalize block truncate">
                                {task.employee?.designation || 'Field Executive'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Department Bullet Badge */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {task.employee?.department || 'Field Services'}
                          </span>
                        </td>

                        {/* Priority Badge */}
                        <td className="py-3.5 px-3">
                          {task.priority === 'high' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              High
                            </span>
                          )}
                          {task.priority === 'medium' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Medium
                            </span>
                          )}
                          {task.priority === 'low' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Low
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3">
                          {task.status === 'in-progress' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <Play className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                              In Progress
                            </span>
                          )}
                          {task.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              Completed
                            </span>
                          )}
                          {task.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                          )}
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 ml-1 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Overdue
                            </span>
                          )}
                        </td>

                        {/* Due Date with Calendar Icon */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {task.dueDate
                                ? new Date(task.dueDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'No Due Date'}
                            </span>
                          </div>
                          {task.dueDate && (
                            <span className="text-[10px] text-slate-400 ml-5 block">
                              {new Date(task.dueDate).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </td>

                        {/* Created By (KC Badge + Kisan Choice + Admin) */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              KC
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 text-xs block truncate">
                                {task.assignedBy?.name || 'Kisan Choice'}
                              </span>
                              <span className="text-[10px] text-slate-400 block capitalize truncate">
                                {task.assignedBy?.role || 'Admin'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Actions Dropdown */}
                        <td className="py-3.5 px-4 text-center relative">
                          <button
                            onClick={() =>
                              setSelectedTaskMenu(selectedTaskMenu === task._id ? null : task._id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {selectedTaskMenu === task._id && (
                            <div
                              className="absolute right-4 top-10 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 text-left animate-in fade-in zoom-in-95 duration-100"
                              onMouseLeave={() => setSelectedTaskMenu(null)}
                            >
                              <button
                                onClick={() => handleUpdateStatus(task._id, 'in-progress')}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-2"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Mark In Progress</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(task._id, 'completed')}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Completed</span>
                              </button>
                              <button
                                onClick={() => startEdit(task)}
                                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-2"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit Task</span>
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                onClick={() => handleDelete(task._id)}
                                className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Task</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Assign New Task / Edit Task */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingTask ? 'Edit Task Assignment' : 'Assign New Task'}
                    </h3>
                    <p className="text-xs text-slate-500">Provide task details and assign to a team member</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Field Inspection & Soil Sampling"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description & Instructions</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed steps, customer contact, or checklist items..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assign To Employee *</label>
                    <select
                      required
                      value={formData.employee}
                      onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.department || 'Field Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Due Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Location Address</label>
                    <input
                      type="text"
                      value={formData.locationAddress}
                      onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                      placeholder="e.g. Sector 18 Market, Lucknow"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-md shadow-rose-500/25 transition active:scale-95"
                  >
                    {editingTask ? 'Save Changes' : 'Assign Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Task Templates */}
        {showTemplatesModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowTemplatesModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Pre-built Task Templates</h3>
                    <p className="text-xs text-slate-500">Pick a template to quickly populate and assign tasks</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {TASK_TEMPLATES.map((tmpl, index) => (
                  <div
                    key={index}
                    onClick={() => applyTemplate(tmpl)}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-rose-600 transition-colors">
                        {tmpl.title}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {tmpl.department}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{tmpl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </TrackProLayout>
  );
}
