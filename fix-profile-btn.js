const fs = require('fs');

const file = 'client/src/styles/Profile.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/background: linear-gradient\(135deg, #495057 0%, #3d444d 100%\);/gi, 'background-color: #047857;');
content = content.replace(/background: linear-gradient\(135deg, #3d444d 0%, #2d3238 100%\);/gi, 'background-color: #059669;');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed btn-primary in Profile.css');
