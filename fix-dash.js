const fs = require('fs');

const dFile = 'client/src/styles/Dashboard.css';
let content = fs.readFileSync(dFile, 'utf8');

// Replace old dark blues / grays with Emerald theme
content = content.replace(/#04152b/g, '#047857'); // Primary Emerald
content = content.replace(/#0b1c31/g, '#0f172a'); // slate 900
content = content.replace(/#eff3ff/g, '#f1f5f9'); // slate 100 for bg
content = content.replace(/#dde9ff/g, '#d1fae5'); // emerald 100
content = content.replace(/#e6eeff/g, '#ecfdf5'); // emerald 50
content = content.replace(/#c4c6cd/g, '#cbd5e1'); // slate 300
content = content.replace(/#75777d/g, '#94a3b8'); // slate 400
content = content.replace(/#505f78/g, '#10b981'); // emerald 500
content = content.replace(/#38485f/g, '#065f46'); // emerald 800

fs.writeFileSync(dFile, content);
console.log('Dashboard.css updated');
