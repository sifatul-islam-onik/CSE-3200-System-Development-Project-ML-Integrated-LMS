const fs = require('fs');
const file = 'client/src/styles/ForgotPassword.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/background:\s*#f9f9ff;/g, 'background: #f8fafc;');
content = content.replace(/color:\s*#0b1c31;/g, 'color: #0f172a;');
content = content.replace(/font-family:\s*'Inter',\s*sans-serif;/g, 'font-family: "Inter", "Roboto", sans-serif;');
content = content.replace(/font-family:\s*'Newsreader',\s*serif;/g, 'font-family: "Inter", "Roboto", sans-serif;');

content = content.replace(/color:\s*#04152b;/g, 'color: #047857;');
content = content.replace(/color:\s*#44474d;/g, 'color: #475569;');
content = content.replace(/background:\s*#1a2a40;/g, 'background: #047857;');
content = content.replace(/border-color:\s*#04152b;/g, 'border-color: #065f46;');
content = content.replace(/box-shadow:\s*0\s+0\s+0\s+1px\s+#04152b;/g, 'box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.2);');

content = content.replace(/background:\s*#eff3ff;/g, 'background: #e2e8f0;');
content = content.replace(/color:\s*#1a2a40;/g, 'color: #065f46;');

content = content.replace(/box-shadow:\s*0\s+24px\s+48px\s+rgba\(11,\s*28,\s*49,\s*0\.06\);/g, 'box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);');
content = content.replace(/border:\s*1px\s+solid\s+rgba\(196,\s*198,\s*205,\s*0\.2\);/g, 'border: 1px solid rgba(0, 0, 0, 0.05);');
content = content.replace(/border-radius:\s*0;/g, 'border-radius: 8px;');
content = content.replace(/border:\s*1px\s+solid\s+rgba\(196,\s*198,\s*205,\s*0\.55\);/g, 'border: 1px solid #cbd5e1;');

content = content.replace(/border-left:\s*2px\s+solid\s+#e9c176;/g, 'border-left: 4px solid #047857;');
content = content.replace(/background:\s*#dde9ff;/g, 'background: #d1fae5;');

fs.writeFileSync(file, content);
console.log('CSS updated successfully.');
