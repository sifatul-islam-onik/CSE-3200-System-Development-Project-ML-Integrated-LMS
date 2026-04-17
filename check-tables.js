const fs = require('fs');
const path = require('path');
const dir = 'client/src/styles';

fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.css')) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        if (content.match(/table|th |thead/i) && content.match(/#0[0-9a-f]{5}|#1[0-9a-f]{5}/i)) {
            console.log('File with table AND potential dark blue:', file);
        }
    }
});
