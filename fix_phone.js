const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');

c = c.replace(
  'User, Trash2',
  'User, Trash2, Phone'
);

fs.writeFileSync('src/pages/admin/AdminEmployees.jsx', c);
