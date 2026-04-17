const fs = require('fs');

const files = [
    'client/src/components/MarkEntry.js',
    'client/src/components/ResultView.js'
];

const replacements = [
    { r: /#1e3a5f/gi, t: '#047857' }, // Emerald-700
    { r: /#0c4a6e/gi, t: '#065f46' }, // Emerald-800
    { r: /#e0f2fe/gi, t: '#d1fae5' }, // Emerald-100
    { r: /#f0f4ff/gi, t: '#ecfdf5' }, // Emerald-50
    { r: /#bae6fd/gi, t: '#6ee7b7' }, // Emerald-300
    { r: /#c7d2fe/gi, t: '#a7f3d0' }, // Emerald-200
    { r: /#334\b/gi, t: '#6ee7b7' }   // dark inner border in MarkEntry
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let newContent = content;
    replacements.forEach(rep => {
        newContent = newContent.replace(rep.r, rep.t);
    });
    if(newContent !== content) {
        fs.writeFileSync(f, newContent, 'utf8');
        console.log('Fixed inline styles in', f);
    }
});
