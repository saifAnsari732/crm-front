const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminTasks.jsx', 'utf8');

const filterHtml = `
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border-color)] shadow-xl mb-6">
            <div className="flex-1 w-full relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none text-xs font-black uppercase tracking-widest">Team:</span>
              <select 
                value={empFilter} 
                onChange={e => setEmpFilter(e.target.value)}
                className="w-full bg-transparent border-none text-sm font-bold text-[var(--text-main)] focus:ring-0 cursor-pointer pl-16 py-2"
              >
                <option value="">All Assignees</option>
                {employees.filter(e => e.role === 'employee' || e.role === 'manager').map(e => (
                  <option key={e._id} value={e._id}>{e.name} ({e.employeeId || 'N/A'})</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-px h-px sm:h-8 bg-[var(--border-color)]"></div>
            <div className="flex-1 w-full relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none text-xs font-black uppercase tracking-widest">Date:</span>
              <input 
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full bg-transparent border-none text-sm font-bold text-[var(--text-main)] focus:ring-0 cursor-pointer pl-16 py-2"
              />
            </div>
            {(empFilter || dateFilter) && (
              <button 
                onClick={() => { setEmpFilter(''); setDateFilter(''); }}
                className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 hover:text-white hover:bg-red-500 px-4 py-2 rounded-xl transition-all w-full sm:w-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
`;

c = c.replace(
  '{showForm && (',
  filterHtml + '\n          {showForm && ('
);

fs.writeFileSync('src/pages/admin/AdminTasks.jsx', c);
