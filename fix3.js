const fs = require('fs');

let loginJs = fs.readFileSync('client/src/pages/Login.js', 'utf8');
loginJs = loginJs.replace(
  '<h1><Link to=\"/\" style={{color: \"white\", textDecoration: \"none\"}}>OBESynK</Link></h1>',
  '<div className=\"OBESynK-auth-back-nav\">\n            <Link to=\"/\" className=\"OBESynK-auth-back-btn\">Back to website &rarr;</Link>\n          </div>\n          <h1>OBESynK</h1>'
);
fs.writeFileSync('client/src/pages/Login.js', loginJs);

let forgotJs = fs.readFileSync('client/src/pages/ForgotPassword.js', 'utf8');
forgotJs = forgotJs.replace(
  '<h1><Link to=\"/\" style={{color: \"white\", textDecoration: \"none\"}}>OBESynK</Link></h1>',
  '<div className=\"OBESynK-auth-back-nav\">\n            <Link to=\"/\" className=\"OBESynK-auth-back-btn\">Back to website &rarr;</Link>\n          </div>\n          <h1>OBESynK</h1>'
);
fs.writeFileSync('client/src/pages/ForgotPassword.js', forgotJs);

let brandCss = 
.OBESynK-auth-banner {
  position: relative;
}

.OBESynK-auth-back-nav {
  position: absolute;
  top: 2.5rem;
  right: 2.5rem;
}

.OBESynK-auth-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  text-decoration: none;
  padding: 0.6rem 1.2rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
}

.OBESynK-auth-back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  text-decoration: none;
  color: white;
}
;

['client/src/styles/Login.css', 'client/src/styles/ForgotPassword.css'].forEach(file => {
    let css = fs.readFileSync(file, 'utf8');
    if (!css.includes('.OBESynK-auth-back-nav')) {
        css += '\n' + brandCss;
        fs.writeFileSync(file, css);
    }
});

console.log('Update Complete.');
