import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users2,
  Users,
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  UserCheck,
  User,
  Phone,
  Mail,
  MoreVertical,
  X,
  ChevronRight,
  Shield,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { API } from '../../services/api.service';
import toast from 'react-hot-toast';
import Avatar from '../../components/shared/Avatar';

export default function AdminTeams() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  
  const isPlanActive = isSuperAdmin || (
    organization?.status === 'active' &&
    Boolean(organization?.plan?.expiresAt) &&
    new Date(organization.plan.expiresAt) > new Date()
  );

  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [creating, setCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentId: '',
    managerId: '',
  });

  const fetchTeamsData = async () => {
    try {
      setLoading(true);
      const [teamsRes, deptsRes, mgrsRes] = await Promise.all([
        API.get('/admin/teams').catch(() => ({ data: { success: false, teams: [] } })),
        API.get('/admin/departments').catch(() => ({ data: { success: false, departments: [] } })),
        API.get('/admin/managers').catch(() => ({ data: { success: false, managers: [] } })),
      ]);

      if (teamsRes.data?.success && Array.isArray(teamsRes.data.teams)) {
        setTeams(teamsRes.data.teams);
      }
      if (deptsRes.data?.success && Array.isArray(deptsRes.data.departments)) {
        setDepartments(deptsRes.data.departments);
      }
      if (mgrsRes.data?.success && Array.isArray(mgrsRes.data.managers)) {
        setManagers(mgrsRes.data.managers);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
      toast.error('Failed to load teams data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamsData();
  }, []);

  const handleOpenCreateModal = () => {
    if (!isPlanActive) {
      toast.error('❌ Subscription Plan Not Active! Please activate a plan in Billing to create teams.', {
        id: 'plan-check-create-team',
        duration: 5000,
      });
      navigate('/admin/billing');
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!isPlanActive) {
      toast.error('❌ Subscription Plan Not Active! Please activate a plan in Billing.');
      navigate('/admin/billing');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      setCreating(true);
      const res = await API.post('/admin/teams', formData);
      if (res.data?.success) {
        toast.success(`🎉 Team "${formData.name}" created successfully!`);
        setShowCreateModal(false);
        setFormData({
          name: '',
          description: '',
          departmentId: '',
          managerId: '',
        });
        fetchTeamsData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const filteredTeams = teams.filter((team) => {
    const matchesSearch =
      team.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.manager?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept =
      selectedDept === 'all' ||
      team.departmentId?.name === selectedDept ||
      team.departmentId === selectedDept;
    return matchesSearch && matchesDept;
  });

  const totalMembers = teams.reduce((acc, t) => acc + (t.membersCount || 0), 0);
  const totalActiveNow = teams.reduce((acc, t) => acc + (t.activeCount || 0), 0);

  return (
    <KisanConnectLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teams & Squads</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Organize your workforce into operational field squads, assign leaders, and monitor performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create Team
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Teams</span>
              <span className="text-2xl font-black text-slate-900">{teams.length}</span>
              <span className="text-[11px] text-slate-500 block">Operational squads</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Members</span>
              <span className="text-2xl font-black text-slate-900">{totalMembers}</span>
              <span className="text-[11px] text-emerald-600 font-semibold block">Field personnel assigned</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Team Leaders</span>
              <span className="text-2xl font-black text-slate-900">{managers.length}</span>
              <span className="text-[11px] text-slate-500 block">Supervisors deployed</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Online In Field</span>
              <span className="text-2xl font-black text-slate-900">{totalActiveNow}</span>
              <span className="text-[11px] text-amber-600 font-semibold block">Active GPS telemetry</span>
            </div>
          </div>
        </div>

        {/* Filter & View Switcher Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team by name, leader, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end md:self-auto bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content View: Grid or Table */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading teams from database...</span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Users2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No teams found</p>
            <p className="text-xs text-slate-400 mt-1">Create a new operational squad or adjust your search filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.map((team) => (
              <div
                key={team._id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {team.departmentId?.name || 'Field Services'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{team.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {team.description || 'Dedicated squad for rapid field operations and monitoring.'}
                  </p>
                </div>

                {/* Team Lead Section */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={team.manager?.avatar}
                      name={team.manager?.name || 'Ritesh'}
                      size="sm"
                      shape="rounded-xl"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {team.manager?.name || 'Ritesh Srivastava'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">Team Leader</span>
                    </div>
                  </div>
                  {team.manager?.phone && (
                    <a
                      href={`tel:${team.manager.phone}`}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-600 transition"
                      title={team.manager.phone}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Members Count & Avatars Pile */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      <strong className="text-slate-900 font-bold text-xs">{team.membersCount || 0}</strong> Members
                    </span>
                    {team.activeCount > 0 && (
                      <span className="text-[10px] text-emerald-600 font-semibold block">
                        ● {team.activeCount} online now
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedTeam(team)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    View Squad <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">Team Name</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Team Lead</th>
                    <th className="py-3.5 px-4">Total Members</th>
                    <th className="py-3.5 px-4">Online Now</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeams.map((team) => (
                    <tr key={team._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {team.name}
                        <span className="block text-[11px] font-normal text-slate-400">{team.description}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {team.departmentId?.name || 'Field Services'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Avatar src={team.manager?.avatar} name={team.manager?.name || 'Ritesh'} size="xs" />
                          <span>{team.manager?.name || 'Ritesh Srivastava'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {team.membersCount || 0}
                      </td>
                      <td className="py-3.5 px-4">
                        {team.activeCount > 0 ? (
                          <span className="text-emerald-700 font-semibold">● {team.activeCount} active</span>
                        ) : (
                          <span className="text-slate-400">Offline</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedTeam(team)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CREATE TEAM MODAL                                                         */}
        {/* ========================================================================= */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Squad / Team</h3>
                  <p className="text-xs text-slate-500">Group employees under a team lead for targeted field missions.</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Team Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lucknow Field Force Alpha"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Team Leader / Manager</label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                    >
                      <option value="">Select Team Leader</option>
                      {managers.map((m) => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Operational Scope</label>
                  <textarea
                    rows="3"
                    placeholder="Describe operational responsibilities, target territory, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Team
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW TEAM SQUAD DETAILS MODAL                                             */}
        {/* ========================================================================= */}
        {selectedTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative flex-shrink-0">
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg border-2 border-white/20">
                    <Users2 className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {selectedTeam.departmentId?.name || 'Field Services'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {selectedTeam.description || 'Operational field squad'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-blue-600">
                    Assigned Team Members ({selectedTeam.members?.length || 0})
                  </h4>
                  <span className="text-slate-400 text-[11px]">
                    Leader: <strong className="text-slate-800 font-semibold">{selectedTeam.manager?.name || 'Ritesh Srivastava'}</strong>
                  </span>
                </div>

                {selectedTeam.members && selectedTeam.members.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {selectedTeam.members.map((member) => (
                      <div key={member._id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={member.avatar}
                            name={member.name}
                            size="md"
                            shape="rounded-xl"
                            status={member.isOnline ? 'online' : undefined}
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{member.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{member.employeeId || 'EMP ID'} • {member.designation || 'Field Staff'}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {member.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Offline
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    No individual employees explicitly assigned to this team yet.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </KisanConnectLayout>
  );
}
