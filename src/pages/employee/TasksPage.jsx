import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { taskAPI } from '../../services/api.service';
import { ClipboardList, CheckCircle, Clock, MapPin, AlertCircle, ChevronRight, Navigation, Plus, X, Timer } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueDate: new Date().toISOString().slice(0, 10), duration: '1h' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await taskAPI.getMy();
      let filtered = data.tasks || [];
      
      const today = new Date().toISOString().slice(0, 10);
      
      if (filter === 'pending') {
        // Show ALL pending tasks (including previous ones)
        filtered = filtered.filter(t => t.status === 'pending' || t.status === 'in-progress');
      } else if (filter === 'completed') {
        // Show only today's completed tasks
        filtered = filtered.filter(t => t.status === 'completed' && new Date(t.completedAt || t.updatedAt).toISOString().slice(0, 10) === today);
      }
      
      setTasks(filtered);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await taskAPI.updateStatus(id, { status });
      toast.success(`Task marked as ${status}`);
      fetchTasks();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Logic for duration is just text for now as per user request "with time duration"
      const taskData = { ...form, priority: 'medium' };
      await taskAPI.create(taskData);
      toast.success('Action plan updated');
      setShowModal(false);
      setForm({ title: '', description: '', dueDate: new Date().toISOString().slice(0, 10), duration: '1h' });
      fetchTasks();
    } catch { toast.error('Failed to create task'); }
    finally { setSaving(false); }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'in-progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'overdue': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  return (
    <EmployeeLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-bold uppercase tracking-tight">Daily Action Plan</h1>
            <p className="text-[var(--text-muted)] text-sm">Plan and complete your daily field activities</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary py-2.5 px-6 rounded-2xl flex items-center gap-2">
             <Plus className="w-4 h-4" /> <span>Add to Plan</span>
          </button>
          <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)]">
            {['pending', 'in-progress', 'completed', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  filter === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)
          ) : tasks.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <ClipboardList className="w-12 h-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">No tasks found for this status</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="glass-card p-5 group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-[var(--text-main)] font-bold text-lg group-hover:text-primary-400 transition-colors">{task.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                        task.priority === 'high' ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                        task.priority === 'medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                        'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4">{task.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <span className="text-xs font-semibold">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                      {task.duration && (
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Timer className="w-4 h-4 text-violet-500" />
                          <span className="text-xs font-semibold">Duration: {task.duration}</span>
                        </div>
                      )}
                      {task.location?.address && (
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          <span className="text-xs font-semibold truncate max-w-xs">{task.location.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(task._id, 'in-progress')}
                        className="btn-primary py-2 px-4 rounded-xl text-xs flex items-center gap-2"
                      >
                        <Navigation className="w-4 h-4" /> Start Task
                      </button>
                    )}
                    {task.status === 'in-progress' && (
                      <button
                        onClick={() => handleStatusUpdate(task._id, 'completed')}
                        className="btn-primary py-2 px-4 !bg-emerald-600 hover:!bg-emerald-500 rounded-xl text-xs flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                    )}
                    {task.status === 'completed' && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4" />
                        Completed on {new Date(task.completedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-lg font-bold text-[var(--text-main)]">New Action Item</h2>
                   <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
                </div>
                <form onSubmit={handleCreateTask} className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Action Title</label>
                      <input className="input-field" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Visit Apollo Hospital" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Description</label>
                      <textarea className="input-field py-3" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Action details..." />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Duration</label>
                        <div className="relative">
                           <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                           <input className="input-field pl-10" required value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g. 2 hrs" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Date</label>
                        <input type="date" className="input-field" required value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                      </div>
                   </div>
                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                      <button type="submit" disabled={saving} className="btn-primary flex-1">
                         {saving ? 'Creating...' : 'Add to Plan'}
                      </button>
                   </div>
                </form>
             </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
