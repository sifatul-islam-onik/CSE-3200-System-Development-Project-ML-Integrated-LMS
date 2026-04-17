const fs = require('fs');
const path = require('path');
const dir = 'client/src/styles';

const replacements = [
    { regex: /#2980b9/gi, replace: '#047857' }, // Emerald-700
    { regex: /#3498db/gi, replace: '#10b981' }, // Emerald-500
    { regex: /#2c3e50/gi, replace: '#065f46' }, // Emerald-800
    { regex: /#34495e/gi, replace: '#047857' }, // Emerald-700
    { regex: /#1a5276/gi, replace: '#065f46' }, // Emerald-800
    { regex: /#1e3a8a/gi, replace: '#047857' }, // Emerald-700
    { regex: /#1e40af/gi, replace: '#10b981' }, // Emerald-500
    { regex: /#3730a3/gi, replace: '#065f46' }, // Emerald-800
    { regex: /linear-gradient\([^)]*#667eea[^)]*#764ba2[^)]*\)/gi, replace: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }
];

let filesProcessed = 0;

fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.css')) {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content;

        replacements.forEach(r => {
            newContent = newContent.replace(r.regex, r.replace);
        });

        // specific for MarkEntry gradient
        newContent = newContent.replace(/#667eea/gi, 'var(--color-primary)').replace(/#764ba2/gi, 'var(--color-secondary)');

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Fixed tables in:', file);
            filesProcessed++;
        }
    }
});

console.log('Total files processed:', filesProcessed);
