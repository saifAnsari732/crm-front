const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminTrackingHistory.jsx', 'utf8');

c = c.replace(
  /\{\s*filters\.employeeId && \(\s*<button[\s\S]*?onClick=\{handleDeleteHistory\}[\s\S]*?>\s*Delete\s*<\/button>\s*\)\s*\}/,
  ''
);

fs.writeFileSync('src/pages/admin/AdminTrackingHistory.jsx', c);
