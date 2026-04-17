const fs = require('fs');

let loginJs = fs.readFileSync('client/src/pages/Login.js', 'utf8');
loginJs = loginJs.replace(
  '<main className=\"login-main OBESynK-login-main\">',
  '<div className=\"OBESynK-auth-banner\">\n          <div className=\"OBESynK-auth-banner-content\">\n            <h1><Link to=\"/\" style={{color: \"white\", textDecoration: \"none\"}}>OBESynK</Link></h1>\n            <h2>Empowering Academic Excellence</h2>\n            <p>Seamlessly integrating outcome-based education workflows for your institution.</p>\n          </div>\n        </div>\n      <main className=\"login-main OBESynK-login-main\">'
);
loginJs = loginJs.replace(
  '<div className=\"OBESynK-branding\">',
  '<div className=\"OBESynK-branding-mobile\">'
);
fs.writeFileSync('client/src/pages/Login.js', loginJs);


let forgotJs = fs.readFileSync('client/src/pages/ForgotPassword.js', 'utf8');
forgotJs = forgotJs.replace(
  '<main className=\"OBESynK-reset-main\">',
  '<div className=\"OBESynK-auth-banner\">\n          <div className=\"OBESynK-auth-banner-content\">\n            <h1><Link to=\"/\" style={{color: \"white\", textDecoration: \"none\"}}>OBESynK</Link></h1>\n            <h2>Empowering Academic Excellence</h2>\n            <p>Seamlessly integrating outcome-based education workflows for your institution.</p>\n          </div>\n        </div>\n      <main className=\"OBESynK-reset-main\">'
);
forgotJs = forgotJs.replace(
  '<div className=\"OBESynK-reset-branding\">',
  '<div className=\"OBESynK-branding-mobile\">'
);
fs.writeFileSync('client/src/pages/ForgotPassword.js', forgotJs);

console.log('JS Updated.');
