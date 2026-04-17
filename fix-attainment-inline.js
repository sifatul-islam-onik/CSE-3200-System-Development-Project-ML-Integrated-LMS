const fs = require('fs');
const path = require('path');

const dir = 'client/src/components/attainment';
const replacements = [
    { r: /#2980b9/gi, t: '#047857' }, // Emerald-700
    { r: /#3498db/gi, t: '#10b981' }, // Emerald-500
    { r: /#2c3e50/gi, t: '#065f46' }, // Emerald-800
    { r: /#34495e/gi, t: '#047857' }, // Emerald-700
    { r: /#1a5276/gi, t: '#065f46' }, // Emerald-800
    { r: /#1e3a8a/gi, t: '#047857' }, // Emerald-700
    { r: /#1e40af/gi, t: '#10b981' }, // Emerald-500
    { r: /#3730a3/gi, t: '#065f46' }, // Emerald-800
    { r: /#2c7be5/gi, t: '#0ea5e9' }  // sky-500 (just in case)
];

function processDir(d) {
    fs.readdirSync(d).forEach(file => {
        const fullPath = path.join(d, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let orig = content;
            replacements.forEach(rep => {
                content = content.replace(rep.r, rep.t);
            });
            if(content !== orig) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed inline styles in', fullPath);
            }
        }
    });
}
processDir(dir);
// Also check client/src/components globally just in case
processDir('client/src/components');
