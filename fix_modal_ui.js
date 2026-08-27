const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');

// Reduce header padding
c = c.replace(
  '<div className="p-6 md:p-8 bg-gradient-to-br from-primary-600/10 to-violet-600/10 border-b border-[var(--border-color)] relative">',
  '<div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-primary-600/10 to-violet-600/10 border-b border-[var(--border-color)] relative">'
);

// Reduce avatar size
c = c.replace(
  'className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] object-cover shadow-2xl border-4 border-[var(--bg-card)]"',
  'className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-2xl sm:rounded-[2rem] object-cover shadow-2xl border-2 sm:border-4 border-[var(--bg-card)]"'
);
c = c.replace(
  'className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-black text-4xl shadow-2xl border-4 border-[var(--bg-card)] uppercase"',
  'className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-black text-2xl sm:text-4xl shadow-2xl border-2 sm:border-4 border-[var(--bg-card)] uppercase"'
);

// Reduce name size
c = c.replace(
  '<h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mb-1 tracking-tight">{viewEmp.name}</h2>',
  '<h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--text-main)] mb-1 tracking-tight">{viewEmp.name}</h2>'
);
c = c.replace(
  '<p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest mb-4">{viewEmp.employeeId || \'No Emp ID\'}</p>',
  '<p className="text-[var(--text-muted)] text-xs sm:text-sm font-bold uppercase tracking-widest mb-3 sm:mb-4">{viewEmp.employeeId || \'No Emp ID\'}</p>'
);

// Reduce badge size
c = c.replace(
  /<span className="px-3 py-1 rounded-lg text-\[10px\]/g,
  '<span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[8px] sm:text-[10px]'
);

// Content padding
c = c.replace(
  '<div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-8">',
  '<div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar space-y-4 sm:space-y-8">'
);

// Grid info box padding
c = c.replace(
  /className="p-4 rounded-2xl bg-\[var\(--bg-main\)\] border border-\[var\(--border-color\)\]/g,
  'className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]'
);

fs.writeFileSync('src/pages/admin/AdminEmployees.jsx', c);
