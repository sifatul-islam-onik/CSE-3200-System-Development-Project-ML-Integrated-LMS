import sys
import os

brand = '''
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
  color: white !important;
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
  color: white !important;
}
'''

for file in ['client/src/pages/Login.js', 'client/src/pages/ForgotPassword.js']:
    with open(file, 'r', encoding='utf-8') as f:
        js = f.read()

    js = js.replace(
        '<h1><Link to="/" style={{color: "white", textDecoration: "none"}}>OBESynK</Link></h1>',
        '<div className="OBESynK-auth-back-nav">\n            <Link to="/" className="OBESynK-auth-back-btn">Back to website &rarr;</Link>\n          </div>\n          <h1>OBESynK</h1>'
    )
    with open(file, 'w', encoding='utf-8') as f:
        f.write(js)

for file in ['client/src/styles/Login.css', 'client/src/styles/ForgotPassword.css']:
    with open(file, 'r', encoding='utf-8') as f:
        css = f.read()
    if '.OBESynK-auth-back-nav' not in css:
        css += '\n' + brand
        with open(file, 'w', encoding='utf-8') as f:
            f.write(css)

print("done")
