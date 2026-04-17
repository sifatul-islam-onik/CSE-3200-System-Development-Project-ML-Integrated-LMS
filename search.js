const fs = require('fs');
const path = require('path');
function search(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'build') search(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.json')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('112238') || content.includes('112238')) {
                console.log(fullPath);
            }
        }
    });
}
search('E:\\CSE-3200-System-Development-Project-ML-Integrated-LMS\\client');
search('E:\\CSE-3200-System-Development-Project-ML-Integrated-LMS\\server');
console.log('Search complete');
