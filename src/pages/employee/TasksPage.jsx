import React, { useState, useEffect } from 'react';
import EmployeeLayout from '../../components/layout/EmployeeLayout';
import { taskAPI } from '../../services/api.service';
import { ClipboardList, CheckCircle, Clock, MapPin, AlertCircle, ChevronRight, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await taskAPI.getMy({ status: filter === 'all' ? '' : filter });
      setTasks(data.tasks || []);
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
            <h1 className="text-white text-2xl font-bold">My Tasks</h1>
            <p className="text-white/50 text-sm">View and manage your assigned field tasks</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            {['pending', 'in-progress', 'completed', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  filter === s ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-white/40 hover:text-white/60'
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
              <ClipboardList className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No tasks found for this status</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="glass-card p-5 group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-bold text-lg group-hover:text-primary-400 transition-colors">{task.title}</h3>
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
                    <p className="text-white/60 text-sm leading-relaxed mb-4">{task.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5 text-white/40">
                        <Clock className="w-4 h-4 text-primary-500" />
                        <span className="text-xs font-semibold">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                      {task.location?.address && (
                        <div className="flex items-center gap-1.5 text-white/40">
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
      </div>
    </EmployeeLayout>
  );
}
