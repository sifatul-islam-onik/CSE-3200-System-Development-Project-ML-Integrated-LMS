const fs = require('fs');
const path = require('path');
const dir = 'client/src/styles';

const rep = [
    { file: 'AdminDashboard.css', rx: /background:\s*linear-gradient\([^)]*#10b981[^)]*#059669[^)]*\);/gi, text: 'background-color: #10b981;' },
    { file: 'AdminDashboard.css', rx: /background:\s*linear-gradient\([^)]*#3b82f6[^)]*#047857[^)]*\);/gi, text: 'background-color: #047857;' },
    { file: 'AdminDashboard.css', rx: /background:\s*linear-gradient\([^)]*#047857[^)]*#065f46[^)]*\);/gi, text: 'background-color: #047857;' }
];
rep.forEach(r => {
    try {
        const p = path.join(dir, r.file);
        let content = fs.readFileSync(p, 'utf8');
        let newContent = content.replace(r.rx, r.text);
        if (content !== newContent) {
            fs.writeFileSync(p, newContent, 'utf8');
            console.log('Fixed btn gradients in', r.file);
        }
    } catch(e) {}
});

const attainmentCssPath = path.join(dir, 'AttainmentView.css');
let attainmentContent = fs.readFileSync(attainmentCssPath, 'utf8');
if (!attainmentContent.includes('.btn-success {')) {
  attainmentContent += \n.btn-success { background-color: #10b981; color: white; }\n.btn-success:hover:not(:disabled) { background-color: #059669; }\n;
}
fs.writeFileSync(attainmentCssPath, attainmentContent, 'utf8');
console.log('Added btn-success to AttainmentView.css');

