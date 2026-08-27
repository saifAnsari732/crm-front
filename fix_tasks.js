const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminTasks.jsx', 'utf8');

c = c.replace(
  'className="group glass-card p-7 border-2 border-transparent hover:border-primary-500/40 transition-all duration-500 shadow-xl hover:shadow-primary-500/5 relative overflow-hidden"',
  'className="group glass-card p-4 sm:p-6 border-2 border-transparent hover:border-primary-500/40 transition-all duration-500 shadow-xl hover:shadow-primary-500/5 relative overflow-hidden"'
);

// We need to carefully replace the header section of the task card
// I'll use a regex that matches the div containing the badges and title and replace it
const originalBlock = `<div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">`;
                      
c = c.replace(
  /<div className="flex items-start justify-between mb-6 relative z-10">[\s\S]*?<h3 className="text-\[var\(--text-main\)\] font-black text-lg leading-tight group-hover:text-primary-400 transition-colors">\{task\.title\}<\/h3>\s*<\/div>\s*<\/div>/,
  `<div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={\`inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 rounded-full text-[9px] font-black uppercase tracking-widest border \${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          task.priority === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }\`}>
                           <span className={\`hidden sm:inline-block w-1 h-1 rounded-full \${
                             task.priority === 'high' ? 'bg-red-500' :
                             task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                           }\`} />
                          {task.priority} Priority
                        </span>
                        <span className={\`inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 rounded-full text-[9px] font-black uppercase tracking-widest border \${
                          task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          task.status === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }\`}>
                          {task.status}
                        </span>
                      </div>
                      <h3 className="text-[var(--text-main)] font-black text-base sm:text-lg leading-tight group-hover:text-primary-400 transition-colors">{task.title}</h3>
                    </div>
                    <button onClick={() => handleDelete(task._id)} className="flex-shrink-0 text-red-500 hover:text-red-600 transition-colors bg-red-500/10 p-2 rounded-xl" title="Delete Task">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>`
);

// Reduce spacing in description and footer
c = c.replace(
  '<p className="text-[var(--text-muted)] text-[11px] font-medium mb-6 line-clamp-3 leading-relaxed relative z-10">{task.description}</p>',
  '<p className="text-[var(--text-muted)] text-[11px] font-medium mb-4 sm:mb-6 line-clamp-3 leading-relaxed relative z-10 text-justify">{task.description}</p>'
);

c = c.replace(
  '<div className="space-y-4 pt-6 border-t border-[var(--border-color)] relative z-10">',
  '<div className="space-y-3 pt-4 border-t border-[var(--border-color)] relative z-10">'
);

fs.writeFileSync('src/pages/admin/AdminTasks.jsx', c);
