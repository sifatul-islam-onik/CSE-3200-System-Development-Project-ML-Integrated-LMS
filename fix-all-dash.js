const fs = require('fs');
const path = require('path');

function replaceColorsInDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceColorsInDir(fullPath);
        } else if (file.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let orig = content;
            content = content.replace(/#112238/gi, '#047857');
            content = content.replace(/#04152b/gi, '#047857');
            content = content.replace(/#1a2a40/gi, '#065f46');
            content = content.replace(/#38485f/gi, '#059669');
            content = content.replace(/#0b1c31/gi, '#0f172a');
            content = content.replace(/#44474d/gi, '#475569');
            content = content.replace(/#eff3ff/gi, '#f1f5f9');
            content = content.replace(/#dde9ff/gi, '#d1fae5');
            content = content.replace(/#e6eeff/gi, '#ecfdf5');
            content = content.replace(/#c4c6cd/g, '#cbd5e1');
            content = content.replace(/#75777d/g, '#94a3b8');
            content = content.replace(/#505f78/g, '#10b981');
            
            if (content !== orig) {
               console.log('Fixed:', fullPath);
               fs.writeFileSync(fullPath, content);
            }
        }
    });
}
replaceColorsInDir('client/src/styles');
