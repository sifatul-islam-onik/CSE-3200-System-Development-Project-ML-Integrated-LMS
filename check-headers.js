const fs = require('fs');
const path = require('path');
const dir = 'client/src/styles';

fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.css')) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const thMatches = content.match(/th\s*\{[^}]*background[^}]*\}/gi) || [];
        const theadMatches = content.match(/thead\s*[\w\.\,\:\s]*\{[^}]*background[^}]*\}/gi) || [];
        if (thMatches.length || theadMatches.length) {
            console.log('\n---', file, '---');
            console.log(thMatches.join('\n'));
            console.log(theadMatches.join('\n'));
        }
    }
});
