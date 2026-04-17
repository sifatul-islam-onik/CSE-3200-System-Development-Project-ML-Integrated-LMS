const fs = require('fs');
const file = 'utils/emailService.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\s*This code/g, 'This code');

fs.writeFileSync(file, content);
console.log('Clock emoji removed successfully.');
