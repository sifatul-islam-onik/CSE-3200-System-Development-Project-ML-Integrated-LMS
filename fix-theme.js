const fs = require('fs');

const themeFile = 'client/src/styles/theme.css';
let content = fs.readFileSync(themeFile, 'utf8');

content = content.replace(/--color-primary:\s*#04152b;/g, '--color-primary: #047857;');
content = content.replace(/--color-primary-dark:\s*#1a2a40;/g, '--color-primary-dark: #065f46;');
content = content.replace(/--color-primary-hover:\s*#38485f;/g, '--color-primary-hover: #059669;');
content = content.replace(/--color-primary-light:\s*#505f78;/g, '--color-primary-light: #a7f3d0;');
content = content.replace(/--color-background:\s*#f9f9ff;/g, '--color-background: #f8fafc;');
content = content.replace(/--color-text-primary:\s*#0b1c31;/g, '--color-text-primary: #0f172a;');
content = content.replace(/--color-text-secondary:\s*#44474d;/g, '--color-text-secondary: #475569;');
content = content.replace(/--color-border:\s*#c4c6cd;/g, '--color-border: #cbd5e1;');
content = content.replace(/--color-border-light:\s*#eff3ff;/g, '--color-border-light: #f1f5f9;');

fs.writeFileSync(themeFile, content);

const adminFile = 'client/src/styles/AdminDashboard.css';
let adminContent = fs.readFileSync(adminFile, 'utf8');
adminContent = adminContent.replace(/#1e3a8a/g, '#047857');
adminContent = adminContent.replace(/#1e40af/g, '#065f46');
adminContent = adminContent.replace(/#2563eb/g, '#047857');
adminContent = adminContent.replace(/#dbeafe/g, '#d1fae5');
adminContent = adminContent.replace(/#bfdbfe/g, '#a7f3d0');
adminContent = adminContent.replace(/rgba\(37, 99, 235, 0.1\)/g, 'rgba(4, 120, 87, 0.1)'); // bg-blue-50/10 -> bg-emerald-50/10 equivalent
adminContent = adminContent.replace(/rgba\(37, 99, 235, 0.2\)/g, 'rgba(4, 120, 87, 0.2)');

fs.writeFileSync(adminFile, adminContent);
console.log('Themes updated successfully.');
