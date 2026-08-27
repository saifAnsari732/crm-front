const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');

if (!c.includes('const [viewEmp, setViewEmp] = useState(null);')) {
  c = c.replace(
    'const [showEditModal, setShowEditModal] = useState(false);',
    'const [viewEmp, setViewEmp] = useState(null);\n  const [showEditModal, setShowEditModal] = useState(false);'
  );
}

c = c.replace(
  '<tr key={emp._id} className="hover:bg-[var(--bg-card-hover)] transition-all group">',
  '<tr key={emp._id} onClick={(e) => { if (!e.target.closest("button") && !e.target.closest("a")) setViewEmp(emp); }} className="hover:bg-[var(--bg-card-hover)] transition-all group cursor-pointer">'
);

const viewModalCode = `
      {/* View Details Modal */}
      {viewEmp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[var(--border-color)] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 md:p-8 bg-gradient-to-br from-primary-600/10 to-violet-600/10 border-b border-[var(--border-color)] relative">
              <button onClick={() => setViewEmp(null)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5 text-[var(--text-main)]" />
              </button>
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative group">
                  {viewEmp.avatar ? (
                    <img src={viewEmp.avatar} alt={viewEmp.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] object-cover shadow-2xl border-4 border-[var(--bg-card)]" />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-black text-4xl shadow-2xl border-4 border-[var(--bg-card)] uppercase">
                      {viewEmp.name?.[0]}
                    </div>
                  )}
                  {viewEmp.isOnline && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-[var(--bg-card)] animate-bounce shadow-lg" title="Live / Online" />
                  )}
                </div>
                
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-2">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary-500/10 text-primary-500 border border-primary-500/20">{viewEmp.role}</span>
                    {viewEmp.isBlocked ? (
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">Blocked</span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                    )}
                    {viewEmp.isTracking && (
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center gap-1"><Activity className="w-3 h-3" /> Tracking</span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mb-1 tracking-tight">{viewEmp.name}</h2>
                  <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest mb-4">{viewEmp.employeeId || 'No Emp ID'}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-8">
              {/* Grid Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> Department</p>
                  <p className="text-[var(--text-main)] font-bold">{viewEmp.department || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Designation</p>
                  <p className="text-[var(--text-main)] font-bold">{viewEmp.designation || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Contact No</p>
                  <p className="text-[var(--text-main)] font-bold">{viewEmp.contactNo || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] overflow-hidden">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-2">Email</p>
                  <p className="text-[var(--text-main)] font-bold truncate">{viewEmp.email}</p>
                </div>
              </div>

              {/* Advanced Details */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 border-b border-[var(--border-color)] pb-2"><IndianRupee className="w-4 h-4" /> Financial & Location Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 rounded-xl bg-[var(--bg-main)]">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Base Salary</p>
                    <p className="text-lg font-black text-[var(--text-main)]">?{viewEmp.salary || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-main)]">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Daily TA</p>
                    <p className="text-lg font-black text-[var(--text-main)]">?{viewEmp.TA || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-main)]">
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Daily DA</p>
                    <p className="text-lg font-black text-[var(--text-main)]">?{viewEmp.DA || 0}</p>
                  </div>
                </div>
                
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Allocated Area / Address</p>
                  <p className="text-[var(--text-main)] font-bold text-sm mb-2">{viewEmp.allocatedArea || 'No specific area allocated'}</p>
                  {(viewEmp.address?.street || viewEmp.address?.city) && (
                    <p className="text-[var(--text-muted)] text-xs italic">
                      {viewEmp.address.street}, {viewEmp.address.city}, {viewEmp.address.state} - {viewEmp.address.pincode}
                    </p>
                  )}
                </div>
              </div>

              {/* Hierarchy */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 border-b border-[var(--border-color)] pb-2"><Users className="w-4 h-4" /> Reporting Hierarchy</h3>
                {viewEmp.role === 'employee' ? (
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center font-black uppercase shadow-inner">
                      {viewEmp.manager?.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Reporting Manager</p>
                      <p className="text-[var(--text-main)] font-bold">{viewEmp.manager?.name || 'Not Assigned'}</p>
                    </div>
                  </div>
                ) : viewEmp.role === 'manager' && viewEmp.assignedEmployees ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Team Members ({viewEmp.assignedEmployees.length})</p>
                    {viewEmp.assignedEmployees.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {viewEmp.assignedEmployees.map(e => (
                           <div key={e._id} className="flex items-center gap-2 bg-[var(--bg-main)] px-3 py-2 rounded-xl border border-[var(--border-color)]">
                             <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-[10px] uppercase">{e.name?.[0]}</div>
                             <span className="text-xs font-bold">{e.name}</span>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-[var(--text-muted)]">No team members assigned yet.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-[var(--border-color)] flex justify-end">
               <button onClick={() => setViewEmp(null)} className="btn-secondary py-2.5 px-8 text-xs font-black uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}
`;

if (!c.includes('viewEmp && (')) {
  c = c.replace(
    '</AdminLayout>',
    viewModalCode + '\n    </AdminLayout>'
  );
}

fs.writeFileSync('src/pages/admin/AdminEmployees.jsx', c);
