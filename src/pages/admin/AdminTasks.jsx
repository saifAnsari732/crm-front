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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-main)] text-2xl font-black tracking-tight flex items-center gap-3">
               <ClipboardList className="w-6 h-6 text-primary-500" />
               Operational Tasks
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest mt-1">Delegation & Progress Monitoring</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`py-3 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-2 active:scale-95 shadow-2xl ${
              showForm 
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                : 'bg-primary-600 text-white hover:bg-primary-500 shadow-primary-600/20'
            }`}
          >
            {showForm ? 'Cancel Operation' : <><Plus className="w-5 h-5" /> Assign New Task</>}
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-8 border-primary-500/30 animate-in fade-in slide-in-from-top-10 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
               <Plus className="w-64 h-64 rotate-12" />
            </div>
            
            <h3 className="text-[var(--text-main)] font-black text-lg uppercase tracking-tight mb-8 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-primary-600/10 flex items-center justify-center">
                 <ClipboardList className="w-5 h-5 text-primary-500" />
              </div>
              Create Operational Directive
            </h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
              <div className="lg:col-span-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Directive Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Critical Client Site Inspection"
                    className="input-field w-full py-4 px-5 text-sm font-semibold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Detailed Instructions</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide step-by-step guidance for the field agent..."
                    className="input-field w-full h-44 resize-none p-5 text-sm font-medium leading-relaxed"
                    required
                  />
                </div>
              </div>
              
              <div className="lg:col-span-4 space-y-6">
                <div className="space-y-2">
                  <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Assigned Personnel</label>
                  <div className="relative">
                     <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-primary-500" />
                     <select
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                        className="input-field w-full pl-12 py-4 appearance-none font-bold text-sm"
                        required
                      >
                        <option value="">Select Field Agent</option>
                        {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} — {emp.department}</option>)}
                      </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="input-field w-full py-4 font-black uppercase text-[10px] tracking-widest"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Deadline</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="input-field w-full py-3.5 font-bold text-sm"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] px-1">Target Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-primary-500" />
                    <input
                      type="text"
                      value={formData.location.address}
                      onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address: e.target.value } })}
                      placeholder="Street, City, Pin..."
                      className="input-field w-full pl-12 py-4 text-sm font-semibold"
                    />
                  </div>
                </div>
                
                <button type="submit" className="w-full py-4 rounded-[1.5rem] bg-primary-600 text-white font-black uppercase tracking-[0.2em] hover:bg-primary-500 transition-all shadow-xl shadow-primary-600/20 flex items-center justify-center gap-3 active:scale-95 mt-2">
                  <Navigation className="w-5 h-5" />
                  Dispatch Directive
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 rounded-[2.5rem] bg-[var(--bg-card)] animate-pulse border border-[var(--border-color)]" />)
          ) : tasks.length === 0 ? (
            <div className="col-span-full glass-card p-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--bg-main)] flex items-center justify-center mb-6">
                 <ClipboardList className="w-10 h-10 text-[var(--text-muted)] opacity-20" />
              </div>
              <h3 className="text-[var(--text-main)] font-black text-xl uppercase tracking-tight">System Idle</h3>
              <p className="text-[var(--text-muted)] text-sm mt-2 max-w-sm">No active directives found in the operational queue. Start by assigning a task to your field team.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="group glass-card p-7 border-2 border-transparent hover:border-primary-500/40 transition-all duration-500 shadow-xl hover:shadow-primary-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500">
                   <ClipboardList className="w-32 h-32 rotate-12" />
                </div>
                
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        task.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        task.priority === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                         <span className={`w-1 h-1 rounded-full ${
                           task.priority === 'high' ? 'bg-red-500' :
                           task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                         }`} />
                        {task.priority} Priority
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        task.status === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <h3 className="text-[var(--text-main)] font-black text-lg leading-tight group-hover:text-primary-400 transition-colors">{task.title}</h3>
                  </div>
                </div>
                
                <p className="text-[var(--text-muted)] text-[11px] font-medium mb-6 line-clamp-3 leading-relaxed relative z-10">{task.description}</p>
                
                <div className="space-y-4 pt-6 border-t border-[var(--border-color)] relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-[11px] font-black text-primary-500 uppercase shadow-inner overflow-hidden">
                        {task.employee?.avatar ? <img src={task.employee.avatar} className="w-full h-full object-cover" /> : task.employee?.name?.[0]}
                      </div>
                      <div>
                         <p className="text-[var(--text-main)] text-xs font-black tracking-tight">{task.employee?.name}</p>
                         <p className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-widest">{task.employee?.department || 'Field Staff'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                       <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Deadline</p>
                       <div className="flex items-center gap-1.5 text-primary-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase">{new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                       </div>
                    </div>
                  </div>
                  
                  {task.location?.address && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] group/loc hover:bg-[var(--bg-main)] transition-colors">
                      <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5 group-hover/loc:animate-bounce" />
                      <span className="text-[10px] font-bold text-[var(--text-muted)] leading-relaxed line-clamp-2">{task.location.address}</span>
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
