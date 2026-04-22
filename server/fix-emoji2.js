const fs = require('fs');
const file = 'utils/emailService.js';
let content = fs.readFileSync(file, 'utf8');

// Use a regex that catches any non-ascii character before 'This code'
content = content.replace(/[^\x00-\x7F]+\s*This code/g, 'This code');

fs.writeFileSync(file, content);
console.log('Clock emoji removed safely.');
