const fs = require('fs');
const path = require('path');
const dir = 'client/src/styles';
const targets = ['MarkEntry.css', 'CourseOBEView.css', 'CourseProfileView.css', 'AttainmentView.css', 'CourseForm.css'];

targets.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const colors = content.match(/#[0-9a-f]{3,6}/gi);
        if (colors) {
            console.log(file, [...new Set(colors)].join(', '));
        }
    } catch(e){}
});
