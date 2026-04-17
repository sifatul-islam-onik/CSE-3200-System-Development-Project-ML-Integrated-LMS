const fs = require('fs');
const file = 'client/src/styles/Profile.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/rgba\(73, 80, 87, 0.3\)/gi, 'rgba(4, 120, 87, 0.3)');

fs.writeFileSync(file, content, 'utf8');
