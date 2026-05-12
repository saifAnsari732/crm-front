import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { taskAPI, adminAPI } from '../../services/api.service';
import { ClipboardList, Plus, Search, Calendar, User, Clock, AlertCircle, CheckCircle, Navigation, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    employeeId: '',
    dueDate: '',
    priority: 'medium',
    location: { address: '', lat: 0, lng: 0 }
  });

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  const fetchTasks = async () => {
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
      const { data } = await adminAPI.getEmployees({ limit: 100 });
      setEmployees(data.employees || []);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await taskAPI.create(formData);
      toast.success('Task assigned successfully');
      setShowForm(false);
      setFormData({ title: '', description: '', employeeId: '', dueDate: '', priority: 'medium', location: { address: '', lat: 0, lng: 0 } });
      fetchTasks();
    } catch (err) {
      toast.error('Failed to assign task');
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold">Field Tasks</h1>
            <p className="text-[var(--text-muted)] text-sm">Assign and track employee tasks</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary py-2.5 px-6 rounded-xl flex items-center gap-2"
          >
            {showForm ? 'Cancel' : <><Plus className="w-5 h-5" /> Assign Task</>}
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-6 border-primary-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-[var(--text-main)] font-bold mb-6 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary-500" />
              Create New Task
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Task Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Visit Client for Installation"
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details about the task..."
                    className="input-field w-full h-32 resize-none"
                    required
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Assign To</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.department})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="input-field w-full"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest px-1">Location Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" />
                    <input
                      type="text"
                      value={formData.location.address}
                      onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address: e.target.value } })}
                      placeholder="Task location address..."
                      className="input-field w-full pl-10"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2">
                  <Plus className="w-5 h-5" />
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)
          ) : tasks.length === 0 ? (
            <div className="col-span-full glass-card p-12 text-center">
              <ClipboardList className="w-12 h-12 text-[var(--text-muted)]/20 mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">No tasks assigned yet</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="glass-card p-5 group hover:border-primary-500/50 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-600/10 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-[var(--text-main)] font-bold leading-tight group-hover:text-primary-500 transition-colors">{task.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                          task.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {task.priority}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                          task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          task.status === 'overdue' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[var(--text-muted)] text-xs mb-4 line-clamp-2">{task.description}</p>
                <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[var(--bg-main)] flex items-center justify-center text-[10px] font-bold text-primary-500 overflow-hidden">
                        {task.employee?.avatar ? <img src={task.employee.avatar} className="w-full h-full object-cover" /> : task.employee?.name?.[0]}
                      </div>
                      <span className="text-[var(--text-main)] text-xs font-semibold">{task.employee?.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">{new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {task.location?.address && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--bg-main)]/50 border border-[var(--border-color)]">
                      <MapPin className="w-3.5 h-3.5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] text-[var(--text-muted)] line-clamp-1">{task.location.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
