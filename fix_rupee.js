const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');

c = c.replace('?{viewEmp.salary || 0}', '₹{viewEmp.salary || 0}');
c = c.replace('?{viewEmp.TA || 0}', '₹{viewEmp.TA || 0}');
c = c.replace('?{viewEmp.DA || 0}', '₹{viewEmp.DA || 0}');

fs.writeFileSync('src/pages/admin/AdminEmployees.jsx', c);
