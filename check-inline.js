const fs = require('fs');
const path = require('path');
const dir = 'client/src';

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    let filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'images' && file !== '__tests__') {
        filelist = walkSync(filePath, filelist);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        filelist.push(filePath);
      }
    }
  });
  return filelist;
};

walkSync(dir).forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.match(/#1e3a5f|#0c4a6e|#1e3a8a|#112238/i)) {
      console.log('Found legacy colors in:', file);
    }
  } catch(e){}
});
