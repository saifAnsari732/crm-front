const fs = require('fs');
let c = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');

if (!c.includes('Phone')) {
  c = c.replace(
    'Trash2\n} from \'lucide-react\';',
    'Trash2, Phone\n} from \'lucide-react\';'
  );
}

fs.writeFileSync('src/pages/admin/AdminEmployees.jsx', c);
